"""
Norm Index - Memory layer for norms.

Stores and retrieves norms efficiently for downstream use.
Single source of truth for extracted norms.

Architectural Role: Enables lookup and retrieval of norms by various criteria.
"""

from typing import Dict, List, Any, Optional, Set, Tuple
from dataclasses import dataclass, field
from enum import Enum
import json
from pathlib import Path


class IndexField(Enum):
    """Fields available for indexing and querying."""
    STATUTE = "statute"
    ARTICLE = "article"
    NORM_TYPE = "norm_type"  # From classifier
    DOMAIN = "domain"        # Legal domain
    KEYWORDS = "keywords"    # Extracted keywords
    JURISDICTION = "jurisdiction"
    DATE = "date"           # Enactment/amendment date


@dataclass
class NormRecord:
    """Complete record of a norm in the index."""
    norm_id: str
    text: str
    statute: str
    article: str
    norm_type: str
    metadata: Dict[str, Any] = field(default_factory=dict)
    classification: Dict[str, Any] = field(default_factory=dict)
    validation: Dict[str, Any] = field(default_factory=dict)
    
    # Index fields
    domain: Optional[str] = None
    keywords: List[str] = field(default_factory=list)
    jurisdiction: str = "default"
    date: Optional[str] = None


class NormIndex:
    """
    Index for storing and retrieving legal norms.
    
    Responsibilities:
    1. Index norms by statute, article, type, domain, keywords
    2. Support exact lookup and filtered retrieval
    3. Maintain single source of truth for extracted norms
    4. Provide integration hooks for downstream layers
    
    Non-Responsibilities:
    ❌ Embed doctrine
    ❌ Rank norms by importance
    ❌ Decide applicability
    ❌ Perform semantic interpretation
    """
    
    def __init__(self, index_path: Optional[str] = None):
        """
        Initialize the norm index.
        
        Args:
            index_path: Optional path to persistent storage
        """
        self.index_path = Path(index_path) if index_path else None
        self.norms: Dict[str, NormRecord] = {}  # norm_id -> NormRecord
        
        # Index structures
        self.statute_index: Dict[str, Set[str]] = {}  # statute -> set of norm_ids
        self.article_index: Dict[str, Set[str]] = {}  # article -> set of norm_ids
        self.type_index: Dict[str, Set[str]] = {}     # norm_type -> set of norm_ids
        self.domain_index: Dict[str, Set[str]] = {}   # domain -> set of norm_ids
        self.keyword_index: Dict[str, Set[str]] = {}  # keyword -> set of norm_ids
        
        # Integration hooks
        self.vector_store_hook = None
        self.authority_hook = None
        self.doctrine_hook = None
        
        # Load existing index if path provided
        if self.index_path and self.index_path.exists():
            self._load_index()
    
    def add_norm(self, norm: NormRecord) -> str:
        """
        Add a norm to the index.
        
        Args:
            norm: Complete norm record
            
        Returns:
            norm_id of added norm
        """
        # Store in main dictionary
        self.norms[norm.norm_id] = norm
        
        # Update indices
        self._update_statute_index(norm)
        self._update_article_index(norm)
        self._update_type_index(norm)
        self._update_domain_index(norm)
        self._update_keyword_index(norm)
        
        # Call integration hooks
        self._call_integration_hooks(norm)
        
        return norm.norm_id
    
    def get_norm(self, norm_id: str) -> Optional[NormRecord]:
        """Retrieve a norm by its ID."""
        return self.norms.get(norm_id)
    
    def query(self, filters: Dict[str, Any]) -> List[NormRecord]:
        """
        Query norms using filters.
        
        Args:
            filters: Dictionary of field: value filters
            
        Returns:
            List of matching norm records
        """
        if not filters:
            return list(self.norms.values())
        
        # Start with all norm IDs
        result_ids = set(self.norms.keys())
        
        # Apply filters
        for field, value in filters.items():
            if not value:
                continue
                
            if field == IndexField.STATUTE.value:
                ids = self.statute_index.get(str(value), set())
            elif field == IndexField.ARTICLE.value:
                ids = self.article_index.get(str(value), set())
            elif field == IndexField.NORM_TYPE.value:
                ids = self.type_index.get(str(value), set())
            elif field == IndexField.DOMAIN.value:
                ids = self.domain_index.get(str(value), set())
            elif field == IndexField.KEYWORDS.value:
                ids = self._query_keywords(value)
            elif field == IndexField.JURISDICTION.value:
                # Filter by jurisdiction attribute
                ids = {
                    nid for nid in result_ids 
                    if self.norms[nid].jurisdiction == value
                }
            else:
                # Unknown field, skip
                continue
            
            result_ids &= ids
        
        # Convert IDs to records
        return [self.norms[nid] for nid in result_ids]
    
    def get_by_statute(self, statute: str) -> List[NormRecord]:
        """Get all norms from a specific statute."""
        norm_ids = self.statute_index.get(statute, set())
        return [self.norms[nid] for nid in norm_ids]
    
    def get_by_article(self, statute: str, article: str) -> List[NormRecord]:
        """Get norms from a specific article/paragraph."""
        article_key = f"{statute}_{article}"
        norm_ids = self.article_index.get(article_key, set())
        return [self.norms[nid] for nid in norm_ids]
    
    def get_by_type(self, norm_type: str) -> List[NormRecord]:
        """Get all norms of a specific type."""
        norm_ids = self.type_index.get(norm_type, set())
        return [self.norms[nid] for nid in norm_ids]
    
    def search_keywords(self, keywords: List[str]) -> List[NormRecord]:
        """Search norms containing specific keywords."""
        result_ids = self._query_keywords(keywords)
        return [self.norms[nid] for nid in result_ids]
    
    def save_index(self, path: Optional[str] = None) -> None:
        """Persist the index to disk."""
        save_path = Path(path) if path else self.index_path
        if not save_path:
            raise ValueError("No index path specified")
        
        # Prepare serializable data
        data = {
            "norms": {
                nid: {
                    "norm_id": norm.norm_id,
                    "text": norm.text,
                    "statute": norm.statute,
                    "article": norm.article,
                    "norm_type": norm.norm_type,
                    "metadata": norm.metadata,
                    "classification": norm.classification,
                    "validation": norm.validation,
                    "domain": norm.domain,
                    "keywords": norm.keywords,
                    "jurisdiction": norm.jurisdiction,
                    "date": norm.date
                }
                for nid, norm in self.norms.items()
            }
        }
        
        save_path.parent.mkdir(parents=True, exist_ok=True)
        with open(save_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
    
    def _load_index(self) -> None:
        """Load index from disk."""
        if not self.index_path or not self.index_path.exists():
            return
        
        with open(self.index_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        # Reconstruct norms and indices
        for norm_data in data.get("norms", {}).values():
            norm = NormRecord(**norm_data)
            self.add_norm(norm)
    
    def _update_statute_index(self, norm: NormRecord) -> None:
        """Update statute index."""
        if norm.statute not in self.statute_index:
            self.statute_index[norm.statute] = set()
        self.statute_index[norm.statute].add(norm.norm_id)
    
    def _update_article_index(self, norm: NormRecord) -> None:
        """Update article index."""
        article_key = f"{norm.statute}_{norm.article}"
        if article_key not in self.article_index:
            self.article_index[article_key] = set()
        self.article_index[article_key].add(norm.norm_id)
    
    def _update_type_index(self, norm: NormRecord) -> None:
        """Update norm type index."""
        if norm.norm_type not in self.type_index:
            self.type_index[norm.norm_type] = set()
        self.type_index[norm.norm_type].add(norm.norm_id)
    
    def _update_domain_index(self, norm: NormRecord) -> None:
        """Update domain index."""
        if norm.domain:
            if norm.domain not in self.domain_index:
                self.domain_index[norm.domain] = set()
            self.domain_index[norm.domain].add(norm.norm_id)
    
    def _update_keyword_index(self, norm: NormRecord) -> None:
        """Update keyword index."""
        for keyword in norm.keywords:
            keyword_lower = keyword.lower()
            if keyword_lower not in self.keyword_index:
                self.keyword_index[keyword_lower] = set()
            self.keyword_index[keyword_lower].add(norm.norm_id)
    
    def _query_keywords(self, keywords) -> Set[str]:
        """Query norms by keywords."""
        if isinstance(keywords, str):
            keywords = [keywords]
        
        result_ids = set()
        for keyword in keywords:
            keyword_lower = keyword.lower()
            if keyword_lower in self.keyword_index:
                if not result_ids:
                    result_ids = self.keyword_index[keyword_lower].copy()
                else:
                    result_ids &= self.keyword_index[keyword_lower]
        
        return result_ids
    
    def _call_integration_hooks(self, norm: NormRecord) -> None:
        """Call registered integration hooks."""
        # Hook for vector store integration
        if self.vector_store_hook:
            self.vector_store_hook(norm)
        
        # Hook for authority layer integration
        if self.authority_hook:
            self.authority_hook(norm)
        
        # Hook for doctrine builder integration
        if self.doctrine_hook:
            self.doctrine_hook(norm)
    
    def register_vector_hook(self, hook_func) -> None:
        """Register hook for vector store integration."""
        self.vector_store_hook = hook_func
    
    def register_authority_hook(self, hook_func) -> None:
        """Register hook for authority layer integration."""
        self.authority_hook = hook_func
    
    def register_doctrine_hook(self, hook_func) -> None:
        """Register hook for doctrine builder integration."""
        self.doctrine_hook = hook_func
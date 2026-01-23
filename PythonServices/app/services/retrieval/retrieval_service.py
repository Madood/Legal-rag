import re
import numpy as np
import faiss
import chromadb
import pickle
import os
from typing import List, Dict, Any, Optional, Tuple
import logging
from datetime import datetime

logger = logging.getLogger(__name__)

# ========== FIX 1: CANONICAL DOCTRINE IDENTIFIERS ==========
DOCTRINAL_QUESTION_TYPES = {
    "DOCTRINE",
    "LEGAL_PRINCIPLE", 
    "GRUNDSATZ",
    "PRINCIPLE",
    "DOCTRINAL_ANALYSIS"
}

# Canonical mapping: lowercase query term → canonical identifier
CANONICAL_DOCTRINES = {
    "schuldprinzip": "SCHULDPRINZIP",
    "nulla poena sine lege": "NULLA_POENA_SINE_LEGE",
    "verhältnismäßigkeitsprinzip": "VERHAELTNISMAESSIGKEIT",
    "rechtsstaatsprinzip": "RECHTSSTAATSPRINZIP",
    "bestimmtheitsgrundsatz": "BESTIMMTHEITSGRUNDSATZ",
    "vertrauensschutzprinzip": "VERTRAUENSSCHUTZPRINZIP",
    "ne bis in idem": "NE_BIS_IN_IDEM",
    "in dubio pro reo": "IN_DUBIO_PRO_REO",
    "unmittelbarkeitsgrundsatz": "UNMITTELBARKEITSGRUNDSATZ",
    "öffentlichkeitsgrundsatz": "OEFFENTLICHKEITSGRUNDSATZ",
    "gesetzlicher richter": "GESETZLICHER_RICHTER",
    "waffengleichheit": "WAFFENGLEICHHEIT", 
    "rechtliches gehör": "RECHTLICHES_GEHOER",
    "fair trial": "FAIR_TRIAL"
}

# Lowercase lookup for detection
SETTLED_DOCTRINES = set(CANONICAL_DOCTRINES.keys())

# ⭐⭐ FIX 2: STATUTE CHAIN DEFINITIONS
STATUTE_CHAINS = {
    "BGB": {
        "119": ["121", "122"],  # §119 always requires §121 and §122
        "433": ["434", "437", "440"],  # Kaufvertrag chain
        "823": ["826", "249", "253"],  # Deliktsrecht chain
        "985": ["986", "987", "1004"],  # Eigentum chain
    },
    "StGB": {
        "211": ["212", "213"],  # Mord chain
        "223": ["224", "226"],  # Körperverletzung chain
        "242": ["243", "244"],  # Diebstahl chain
    }
}

# NEW: Paragraph normalization utility
class ParagraphNormalizer:
    """Normalize paragraph identifiers for strict matching"""
    
    @staticmethod
    def normalize_paragraph(paragraph: str) -> str:
        """
        Extract canonical base paragraph from various formats.
        
        Examples:
        - "286" → "286"
        - "286a" → "286"
        - "286 Abs. 1" → "286"
        - "286(1)" → "286"
        - "§286" → "286"
        - "§ 286" → "286"
        """
        if not paragraph:
            return ""
        
        # Remove § symbol and whitespace
        clean = paragraph.replace('§', '').strip()
        
        # Extract base number (digits only)
        match = re.match(r'(\d+)', clean)
        if match:
            return match.group(1)
        
        return clean
    
    @staticmethod
    def normalize_paragraph_list(paragraphs: List[str]) -> List[str]:
        """Normalize a list of paragraphs"""
        return [ParagraphNormalizer.normalize_paragraph(p) for p in paragraphs if p]
    
    @staticmethod
    def paragraph_matches(target: str, candidate: str) -> bool:
        """Check if paragraphs match after normalization"""
        return (ParagraphNormalizer.normalize_paragraph(target) == 
                ParagraphNormalizer.normalize_paragraph(candidate))


class StatuteFirstIndexer:
    """Specialized indexer for German statutes that preserves legal authority"""
    
    @staticmethod
    def extract_stgb_paragraphs(text: str, statute: str = "StGB") -> List[Dict]:
        """
        Extract individual paragraphs from StGB text with proper authority metadata
        Returns: List of documents with paragraph, statute, and content
        """
        documents = []
        
        # Pattern for German law paragraphs with optional letters
        paragraph_pattern = r'(?:§|Artikel)\s*(\d+[a-z]?)'
        
        # Split by paragraph markers while keeping them
        lines = text.split('\n')
        current_paragraph = None
        current_content = []
        
        for line in lines:
            line = line.strip()
            if not line:
                continue
                
            # Check if this line starts a new paragraph
            match = re.match(paragraph_pattern, line)
            if match:
                # Save previous paragraph if exists
                if current_paragraph and current_content:
                    doc = {
                        "content": ' '.join(current_content),
                        "statute": statute,
                        "paragraph": current_paragraph,
                        "paragraph_base": ParagraphNormalizer.normalize_paragraph(current_paragraph),
                        "norm_type": "criminal_offense",
                        "is_normative": True,
                        "authority_level": "statutory"
                    }
                    documents.append(doc)
                
                # Start new paragraph
                current_paragraph = match.group(1)
                current_content = [line]
            elif current_paragraph:
                # Continue current paragraph
                current_content.append(line)
        
        # Don't forget the last paragraph
        if current_paragraph and current_content:
            doc = {
                "content": ' '.join(current_content),
                "statute": statute,
                "paragraph": current_paragraph,
                "paragraph_base": ParagraphNormalizer.normalize_paragraph(current_paragraph),
                "norm_type": "criminal_offense",
                "is_normative": True,
                "authority_level": "statutory"
            }
            documents.append(doc)
        
        return documents
    
    @staticmethod
    def extract_bgb_paragraphs(text: str, statute: str = "BGB") -> List[Dict]:
        """Extract BGB paragraphs (civil code)"""
        documents = []
        
        # BGB uses § for paragraphs
        lines = text.split('\n')
        current_paragraph = None
        current_content = []
        
        for line in lines:
            line = line.strip()
            if not line:
                continue
                
            # BGB paragraph pattern
            if line.startswith('§'):
                # Extract paragraph number
                parts = line.split()
                if parts and parts[0] == '§' and len(parts) > 1:
                    # Save previous
                    if current_paragraph and current_content:
                        doc = {
                            "content": ' '.join(current_content),
                            "statute": statute,
                            "paragraph": current_paragraph,
                            "paragraph_base": ParagraphNormalizer.normalize_paragraph(current_paragraph),
                            "norm_type": "civil_norm",
                            "is_normative": True,
                            "authority_level": "statutory"
                        }
                        documents.append(doc)
                    
                    # Start new
                    current_paragraph = parts[1].rstrip('.')
                    current_content = [line]
            elif current_paragraph:
                current_content.append(line)
        
        if current_paragraph and current_content:
            doc = {
                "content": ' '.join(current_content),
                "statute": statute,
                "paragraph": current_paragraph,
                "paragraph_base": ParagraphNormalizer.normalize_paragraph(current_paragraph),
                "norm_type": "civil_norm",
                "is_normative": True,
                "authority_level": "statutory"
            }
            documents.append(doc)
        
        return documents


class StatuteFirstValidator:
    """Validate that responses have proper statutory authority"""
    
    @staticmethod
    def validate_response(response_text: str, statute: str, paragraph: str) -> Dict:
        """
        Validate that response cites the correct statute and paragraph
        Returns validation result with score
        """
        validation = {
            "is_valid": False,
            "statute_found": False,
            "paragraph_found": False,
            "security_score": 0,
            "issues": []
        }
        
        # Check for statute
        if statute.upper() in response_text.upper():
            validation["statute_found"] = True
        
        # Check for paragraph (with various formats)
        paragraph_base = ParagraphNormalizer.normalize_paragraph(paragraph)
        
        # Extract all paragraphs from response
        response_paragraphs = re.findall(r'§\s*(\d+[a-z]?)', response_text)
        for resp_para in response_paragraphs:
            if ParagraphNormalizer.paragraph_matches(resp_para, paragraph):
                validation["paragraph_found"] = True
                break
        
        # Also check for other formats
        if not validation["paragraph_found"]:
            # Check for "paragraph X" format
            para_patterns = [
                rf'paragraph\s+{paragraph_base}\b',
                rf'art\.\s*{paragraph_base}\b',
                rf'artikel\s+{paragraph_base}\b'
            ]
            for pattern in para_patterns:
                if re.search(pattern, response_text, re.IGNORECASE):
                    validation["paragraph_found"] = True
                    break
        
        # Determine validity
        validation["is_valid"] = validation["statute_found"] and validation["paragraph_found"]
        
        # Calculate security score
        if validation["is_valid"]:
            validation["security_score"] = 95
        elif validation["statute_found"] and not validation["paragraph_found"]:
            validation["security_score"] = 40
            validation["issues"].append("Paragraph not cited")
        elif not validation["statute_found"] and validation["paragraph_found"]:
            validation["security_score"] = 30
            validation["issues"].append("Statute not cited")
        else:
            validation["security_score"] = 0
            validation["issues"].append("No statutory authority cited")
        
        return validation


class VectorStore:
    """Base class for vector store implementations"""
    
    def __init__(self, store_type: str = "faiss"):
        self.store_type = store_type
        self.dimension = 768  # Default for multilingual MPNet
        self.index = None
        self.metadata = {}
        self.indices_dir = os.getenv("INDICES_DIR", "./data/indices")
        os.makedirs(self.indices_dir, exist_ok=True)
    
    def create_index(self, dimension: int):
        """Create empty index"""
        raise NotImplementedError
    
    def add_vectors(self, vectors: np.ndarray, metadatas: List[Dict]):
        """Add vectors to index"""
        raise NotImplementedError
    
    def search(self, query_vector: np.ndarray, k: int = 5, filter_dict: Optional[Dict] = None) -> List[Dict]:
        """Search for similar vectors"""
        raise NotImplementedError
    
    def save(self, index_name: str):
        """Save index to disk"""
        raise NotImplementedError
    
    def load(self, index_name: str):
        """Load index from disk"""
        raise NotImplementedError


class FAISSStore(VectorStore):
    """FAISS vector store implementation"""
    
    def __init__(self):
        super().__init__("faiss")
        self.ids = []
    
    def create_index(self, dimension: int = 768):
        """Create FAISS index - SIMPLE VERSION for Windows compatibility"""
        self.dimension = dimension
        # ⭐⭐ FIX: Use IndexFlatIP (not IndexIDMap) for Windows compatibility
        self.index = faiss.IndexFlatIP(dimension)  # Inner product for cosine similarity
        self.metadata = {}
        self.ids = []
        logger.info(f"Created FAISS index with dimension {dimension}")
    
    def add_vectors(self, vectors: np.ndarray, metadatas: List[Dict]):
        """Add vectors to FAISS index"""
        if self.index is None:
            self.create_index(vectors.shape[1])
        
        # Convert to float32 for FAISS
        vectors_f32 = vectors.astype('float32')
        
        # Add to index
        start_id = len(self.ids)
        
        # ⭐⭐ FIX: Direct add for Windows compatibility
        if self.index.ntotal == 0:
            self.index.add(vectors_f32)
        else:
            # For additional vectors
            self.index.add(vectors_f32)
        
        # Store metadata WITH VECTOR_ID
        for i, metadata in enumerate(metadatas):
            vector_id = start_id + i
            self.ids.append(vector_id)
            # Store vector_id in metadata for reliable retrieval
            metadata["vector_id"] = vector_id
            self.metadata[vector_id] = metadata
    
    def search(self, query_vector: np.ndarray, k: int = 5, filter_dict: Optional[Dict] = None) -> List[Dict]:
        """Search in FAISS index"""
        if self.index is None or self.index.ntotal == 0:
            return []
        
        # Convert query to float32
        query_f32 = query_vector.astype('float32').reshape(1, -1)
        
        # Search
        distances, indices = self.index.search(query_f32, min(k, self.index.ntotal))
        
        results = []
        for i, (distance, idx) in enumerate(zip(distances[0], indices[0])):
            if idx >= 0 and idx in self.metadata:
                metadata = self.metadata[idx]
                results.append({
                    "id": idx,
                    "score": float(distance),
                    "metadata": metadata,
                    "content": metadata.get("content", ""),
                    "statute": metadata.get("statute", ""),
                    "paragraph": metadata.get("paragraph", ""),
                    "paragraph_base": metadata.get("paragraph_base", ""),
                    "document_id": metadata.get("document_id", ""),
                    "is_normative": metadata.get("is_normative", False)
                })
        
        return results
    
    def save(self, index_name: str):
        """Save FAISS index - SIMPLE VERSION for Windows"""
        try:
            save_path = os.path.join(self.indices_dir, f"{index_name}.faiss")
            metadata_path = os.path.join(self.indices_dir, f"{index_name}_meta.pkl")
            
            # ⭐⭐ FIX: Check if index can be saved
            if self.index is None or self.index.ntotal == 0:
                print(f"⚠️ No vectors to save for {index_name}")
                return False
            
            # Save FAISS index
            faiss.write_index(self.index, save_path)
            
            # Save metadata
            with open(metadata_path, 'wb') as f:
                pickle.dump({
                    "metadata": self.metadata,
                    "ids": self.ids,
                    "dimension": self.dimension
                }, f)
            
            logger.info(f"Saved FAISS index to {save_path}")
            return True
            
        except Exception as e:
            print(f"⚠️ Could not save FAISS index {index_name}: {e}")
            print("   Using in-memory index only (Windows FAISS limitation)")
            return False
    
    def load(self, index_name: str):
        """Load FAISS index - SIMPLE VERSION for Windows"""
        try:
            save_path = os.path.join(self.indices_dir, f"{index_name}.faiss")
            metadata_path = os.path.join(self.indices_dir, f"{index_name}_meta.pkl")
            
            if not os.path.exists(save_path) or not os.path.exists(metadata_path):
                print(f"ℹ️ No existing index found: {index_name}")
                return False
            
            # Load FAISS index
            self.index = faiss.read_index(save_path)
            
            # Load metadata
            with open(metadata_path, 'rb') as f:
                data = pickle.load(f)
                self.metadata = data["metadata"]
                self.ids = data["ids"]
                self.dimension = data["dimension"]
            
            logger.info(f"Loaded FAISS index from {save_path}")
            return True
            
        except Exception as e:
            print(f"⚠️ Could not load FAISS index {index_name}: {e}")
            print("   Creating new index instead")
            return False


class RetrievalService:
    """Main retrieval service with Authority-Contracted Retrieval"""
    
    def __init__(self, vector_store_type: str = "faiss"):
        self.vector_store_type = vector_store_type
        self.vector_store = self._create_vector_store(vector_store_type)
        self.statute_indices = {}  # Separate indices per statute
        self.validator = StatuteFirstValidator()
        self.indices_loaded = False  # Track if real indices are loaded
        
        # ⭐⭐ FIX 2: Initialize statute chains
        self.statute_chains = STATUTE_CHAINS
        
        # ===========================================================================
        # FIX: LAZY LOADING FOR AUTHORITY SERVICES (NO IMMEDIATE IMPORTS)
        # ===========================================================================
        self.authority_resolver = None
        self.source_authority_resolver = None
        self.authority_available = False
        print("⚖️  Authority services: Will load on-demand (source authority optional)")
        
        # ===========================================================================
        # FIX 5: DOCTRINE ENFORCEMENT VS BLOCKING INVARIANT
        # ===========================================================================
        self.doctrine_enforcement_enabled = False
        self.doctrine_inductor = None
        print("⚖️  Doctrine system: Hard blocking takes precedence over enforcement")
        
        logger.info(f"RetrievalService initialized with {vector_store_type}")
        
        # Try to load statute indices on startup
        self._try_load_existing_statute_indices()
    
    def _try_load_existing_statute_indices(self):
        """
        Try to load existing statute indices on startup
        """
        print("🔍 Looking for existing statute indices on startup...")
        
        # Check for BGB index
        if self.load_statute_indices("BGB"):
            print("✅ Loaded BGB index on startup")
            self.indices_loaded = True
        # Check for StGB index
        elif self.load_statute_indices("StGB"):
            print("✅ Loaded StGB index on startup")
            self.indices_loaded = True
        else:
            print("ℹ️ No statute indices found on startup")
            self.indices_loaded = False
    
    def _load_authority_services(self):
        """
        Lazily load authority services when first needed
        This fixes the import timing issue
        """
        if self.authority_available:
            return True
            
        try:
            # CRITICAL FIX: Make source_authority_resolver optional
            from app.services import resolve_authority
            self.authority_resolver = resolve_authority
            
            # Source authority resolver is OPTIONAL - retrieval can proceed without it
            try:
                from app.services import source_authority_resolver
                self.source_authority_resolver = source_authority_resolver
                print("✅ Loaded source authority resolver for document filtering")
            except ImportError as source_error:
                print(f"⚠️  Source authority resolver not available: {source_error}")
                print("   Continuing retrieval WITHOUT document filtering")
                self.source_authority_resolver = None
            
            self.authority_available = True
            print("✅ Authority services loaded for retrieval contract")
            return True
        except ImportError as e:
            print(f"⚠️  Authority services not available: {e}")
            self.authority_available = False
            return False
    
    def _load_doctrine_inductor(self):
        """
        Lazily load doctrine inductor for doctrine enforcement
        """
        if self.doctrine_inductor is not None:
            return True
            
        try:
            from app.services.doctrine_induction import DoctrineInductor
            self.doctrine_inductor = DoctrineInductor()
            self.doctrine_enforcement_enabled = True
            print("✅ Doctrine inductor loaded - doctrine enforcement enabled")
            return True
        except ImportError as e:
            print(f"⚠️  Doctrine inductor not available: {e}")
            print("   Continuing retrieval WITHOUT doctrine enforcement")
            self.doctrine_enforcement_enabled = False
            return False
    
    # ========== FIX 1 + FIX 2: PRECISE DOCTRINAL DETECTION ==========
    def _is_doctrinal_question(self, question_type: str, query: str = "") -> Tuple[bool, Optional[str]]:
        """
        Determine if this is a doctrinal question that should block retrieval.
        
        FIX 1: Returns canonical doctrine ID, not free text
        FIX 2: Checks if query mentions specific paragraphs before blocking
        
        Returns:
            Tuple of (is_doctrinal: bool, canonical_doctrine_id: Optional[str])
        """
        # ===========================================================================
        # FIX 2: NEVER block if query mentions specific paragraphs
        # ===========================================================================
        if self._mentions_specific_paragraph(query):
            print(f"   Mixed question detected: Doctrine + paragraph in '{query[:50]}...'")
            print("   ⚠️  ALLOWING retrieval (doctrine + norm application)")
            return False, None
        
        # Check question type first
        if question_type in DOCTRINAL_QUESTION_TYPES:
            # Check if it's about a settled doctrine
            query_lower = query.lower()
            for doctrine_term, canonical_id in CANONICAL_DOCTRINES.items():
                if doctrine_term in query_lower:
                    return True, canonical_id
            return True, None
        
        # Check for doctrinal keywords in query (only if no paragraphs)
        doctrinal_keywords = {
            "prinzip", "grundsatz", "doctrine", "lehre", "theorie",
            "maxim", "canon", "tenet", "precept", "axiom"
        }
        
        if any(keyword in query.lower() for keyword in doctrinal_keywords):
            # FIX 1: Return generic canonical ID, not free text
            return True, "GENERAL_DOCTRINE"
        
        return False, None
    
    def _mentions_specific_paragraph(self, query: str) -> bool:
        """
        FIX 2: Check if query mentions specific legal paragraphs.
        This prevents over-blocking for mixed doctrine+norm questions.
        
        Examples:
        - "Was besagt das Schuldprinzip?" → False (no paragraph)
        - "Schuldprinzip und § 46 StGB" → True (has paragraph)
        - "Verhältnismäßigkeit in § 34 StGB" → True
        """
        # Pattern for German law paragraphs
        paragraph_pattern = r'§\s*\d+[a-z]?'
        return bool(re.search(paragraph_pattern, query))
    
    # ========== FIX 3: IMPROVED DOCTRINAL EMPTY RESULT ==========
    def _get_doctrinal_empty_result(self, doctrine_mode: bool = True, canonical_doctrine: Optional[str] = None) -> Dict[str, Any]:
        """
        Return empty result for doctrinal questions to prevent retrieval.
        
        FIX 3: Do not fabricate GG articles, indicate hierarchy instead
        
        Args:
            doctrine_mode: Whether this is a doctrinal question
            canonical_doctrine: Canonical doctrine ID if detected
            
        Returns:
            Empty retrieval result with doctrinal metadata
        """
        message = "No retrieval performed for doctrinal question"
        if canonical_doctrine:
            message = f"No retrieval performed for settled doctrine: {canonical_doctrine}"
        
        # ===========================================================================
        # FIX 5: ENFORCE INVARIANT - Doctrine blocking → No doctrine enforcement
        # ===========================================================================
        if self.doctrine_enforcement_enabled:
            print("⚠️  INVARIANT VIOLATION: Doctrine blocking active but enforcement enabled")
            print("   Disabling doctrine enforcement for pure doctrinal question")
            self.doctrine_enforcement_enabled = False
        
        # ===========================================================================
        # FIX 3: Return hierarchical metadata, not interpretive GG articles
        # ===========================================================================
        return {
            "results": [],  # Empty array - NO RETRIEVAL
            "authority_metadata": {
                "statute": None,  # Doctrines are not statutory
                "paragraph": None,  # Do not fabricate GG articles
                "constitutional_basis": ["Art. 20 GG", "Art. 103 GG"],  # Reference only
                "legal_hierarchy": "constitutional",
                "doctrine_mode": doctrine_mode,
                "canonical_doctrine": canonical_doctrine,  # FIX 1: Canonical ID
                "retrieval_performed": False,
                "retrieval_blocked": True,  # Explicit flag
                "reason": "doctrinal_question_no_retrieval",
                "has_real_norms": False,
                "doctrinal_template": "constitutional_principle",
                # FIX 5: Explicit doctrine blocking marker
                "doctrine_blocking_applied": True,
                "doctrine_enforcement_blocked": True
            },
            "authority_validation": {
                "status": "doctrinal_early_exit",
                "message": message,
                "doctrine": {
                    "applied": True,
                    "status": "settled_doctrine_no_retrieval",
                    "canonical_doctrine": canonical_doctrine,  # FIX 1: Canonical ID
                    "blocking_invariant": "enforced"  # FIX 5
                }
            },
            "requires_clarification": False,
            "doctrine_metadata": {
                "status": "settled_doctrine_no_retrieval",
                "canonical_doctrine": canonical_doctrine,  # FIX 1: Canonical ID
                "doctrinal_template": "constitutional_principle",
                "applied": True,
                "retrieval_blocked": True,
                # FIX 5: Clear separation marker
                "type": "blocking_not_enforcement",
                "hierarchy_level": "constitutional"
            }
        }
    
    def ensure_indices_loaded(self, force_reload: bool = False) -> bool:
        """
        CRITICAL FIX: Ensure indices are loaded before any search
        Returns True if indices are ready, False if empty
        """
        if self.indices_loaded and not force_reload:
            return True
        
        print("\n🔍 Ensuring indices are loaded...")
        
        # First check if we have any loaded statute indices
        if self.statute_indices and self._check_indices_populated():
            self.indices_loaded = True
            print(f"✅ Using in-memory statute indices: {list(self.statute_indices.keys())}")
            return True
        
        # Try to load from disk
        print("   Attempting to load indices from disk...")
        
        # Try BGB first (most common)
        if self.load_statute_indices("BGB"):
            if self._check_indices_populated():
                self.indices_loaded = True
                print("✅ Loaded BGB corpus from disk")
                return True
        
        # Try StGB second
        if self.load_statute_indices("StGB"):
            if self._check_indices_populated():
                self.indices_loaded = True
                print("✅ Loaded StGB corpus from disk")
                return True
        
        # Check for general index (backward compatibility)
        if self.load_indices("legal_index"):
            if self._check_indices_populated():
                self.indices_loaded = True
                print("✅ Loaded general index from disk")
                return True
        
        # If no real indices, DO NOT create fake test indices
        print("""
        ⚠️ NO REAL LEGAL CORPUS FOUND
        =============================
        The system cannot answer legal questions because:
        1. No legal corpus has been ingested
        2. No vector indices exist on disk
        3. The norms layer requires REAL legal text
        
        To fix this:
        1. Upload real BGB/StGB documents using /ingestion/bgb endpoint
        2. System will extract REAL norms using NormExtractor
        3. REAL norms will be indexed for legal reasoning
        
        Fake test norms are NOT created to maintain:
        • Epistemic integrity (no hallucinations)
        • Legal defensibility (real sources only)
        • System credibility (no made-up law)
        """)
        
        self.indices_loaded = False
        return False
    
    def _check_indices_populated(self) -> bool:
        """Check if indices actually contain real data (not just test data)"""
        stats = self.get_stats()
        
        # Check for real BGB data (should have more than test sections)
        bgb_count = stats["statute_indices"].get("BGB", {}).get("vectors", 0)
        
        # If BGB has more than 10 vectors, assume it's real corpus
        if bgb_count > 10:
            print(f"✅ Found real BGB corpus with {bgb_count} vectors")
            return True
        
        # Check for StGB
        stgb_count = stats["statute_indices"].get("StGB", {}).get("vectors", 0)
        if stgb_count > 10:
            print(f"✅ Found real StGB corpus with {stgb_count} vectors")
            return True
        
        # Check total vectors across all indices
        total_vectors = stats["general_index"]["vectors"] + sum(
            idx["vectors"] for idx in stats["statute_indices"].values()
        )
        
        if total_vectors > 20:  # More than just test data
            print(f"✅ Found real corpus with {total_vectors} vectors")
            return True
        
        return False
    
    def _create_vector_store(self, store_type: str) -> VectorStore:
        """Create vector store instance"""
        if store_type == "faiss":
            return FAISSStore()
        elif store_type == "chroma":
            # ChromaDB implementation
            raise NotImplementedError("ChromaDB not implemented yet")
        elif store_type == "qdrant":
            raise NotImplementedError("Qdrant not implemented yet. Install qdrant-client package.")
        else:
            raise ValueError(f"Unknown vector store type: {store_type}")
    
    def create_test_indices(self, save_to_disk: bool = True):
        """
        [DEPRECATED - DO NOT USE]
        
        This method previously created FAKE legal norms, which violates:
        1. Norms layer purity (norms must come from real legal text)
        2. Epistemic integrity (no hallucinations)
        3. Legal defensibility (real sources only)
        
        Use /ingestion/bgb endpoint with REAL BGB text instead.
        """
        print("""
        ❌ create_test_indices() IS DEPRECATED AND DISABLED
        
        WHY: Fake legal norms violate architectural principles:
        
        1. Norms Layer Purity: Norms must only come from real legal text extraction
        2. Epistemic Integrity: No hallucinations or made-up law
        3. Legal Defensibility: Every norm must be traceable to real source
        4. System Credibility: No made-up legal content
        
        SOLUTION: 
        Upload REAL BGB text using /ingestion/bgb endpoint.
        The system will extract REAL norms using NormExtractor.
        
        """)
        
        # Return empty indices
        return False
    
    def index_documents(self, documents: List[Dict], statute: Optional[str] = None, 
                       embeddings: Optional[np.ndarray] = None):
        """
        Index REAL documents with embeddings - STATUTE-FIRST VERSION
        
        This method ONLY indexes REAL legal content, not test data.
        """
        if not documents:
            return
        
        print(f"📝 Indexing {len(documents)} REAL documents for {statute or 'general'}")
        
        # Validate these are REAL documents, not test data
        real_docs = []
        for doc in documents:
            content = doc.get("content", "")
            doc_id = doc.get("id", "")
            
            # Check for fake/test indicators
            if "test_" in doc_id or "example_" in doc_id or "fake_" in doc_id:
                print(f"❌ Skipping fake/test document: {doc_id}")
                continue
            
            if not content or content.strip() == "":
                print(f"❌ Skipping empty document: {doc_id}")
                continue
            
            # Check if this looks like a real legal document
            if not self._is_real_legal_content(content):
                print(f"⚠️ Document {doc_id} may not be real legal content")
                # Still index it, but with warning
            
            real_docs.append(doc)
        
        if not real_docs:
            print("❌ No real documents to index")
            return
        
        # PARAGRAPH EXTRACTION FOR STATUTES
        if statute and statute.upper() in ["STGB", "BGB"]:
            # Extract structured norms from statute text
            all_norms = []
            for doc in real_docs:
                content = doc.get("content", "")
                if statute.upper() == "STGB":
                    norms = StatuteFirstIndexer.extract_stgb_paragraphs(content, statute)
                elif statute.upper() == "BGB":
                    norms = StatuteFirstIndexer.extract_bgb_paragraphs(content, statute)
                else:
                    norms = []
                
                if norms:
                    all_norms.extend(norms)
            
            if all_norms:
                # Use the extracted norms instead of raw chunks
                real_docs = all_norms
                print(f"📖 Extracted {len(all_norms)} REAL legal norms from {statute}")
        
        # Prepare metadata - NOW WITH PARAGRAPH IDENTITY AND VECTOR_ID PLACEHOLDER
        metadatas = []
        for doc in real_docs:
            # Check if this is already a structured norm
            paragraph = doc.get("paragraph", "")
            paragraph_base = doc.get("paragraph_base", ParagraphNormalizer.normalize_paragraph(paragraph))
            
            metadata = {
                "content": doc.get("content", ""),
                "document_id": doc.get("id", ""),
                "filename": doc.get("filename", ""),
                "statute": statute or doc.get("statute", ""),
                # CRITICAL: Store paragraph identity with base normalization
                "paragraph": paragraph,
                "paragraph_base": paragraph_base,
                # Determine if this is a true legal norm
                "is_normative": doc.get("is_normative", bool(paragraph)),
                "norm_type": doc.get("norm_type", ""),
                "authority_level": doc.get("authority_level", "unknown"),
                "authority_score": doc.get("authority_score", 1.0 if bool(paragraph) else 0.5),
                "document_type": doc.get("document_type", "statutory" if bool(paragraph) else "other"),
                "chunk_index": doc.get("chunk_index", 0),
                "page": doc.get("page", 0),
                # FIX: Use correct paragraph symbol
                "has_paragraph": "§" in doc.get("content", "") or bool(paragraph),
                "has_article": "Artikel" in doc.get("content", "") or 
                              "article" in doc.get("content", "").lower(),
                "is_real_legal_content": True,  # Mark as real
                "timestamp": datetime.now().isoformat(),
                # Vector ID will be added by FAISSStore.add_vectors()
            }
            metadatas.append(metadata)
        
        # Use provided embeddings or generate them
        if embeddings is None:
            from app.services.embeddings.embedding_service import embedding_service
            texts = [doc.get("content", "") for doc in real_docs]
            embeddings = np.array(embedding_service.embed_batch(texts))
            print(f"🔧 Generated embeddings for {len(real_docs)} REAL documents: {embeddings.shape}")
        
        # Index by statute if specified
        if statute and statute not in self.statute_indices:
            self.statute_indices[statute] = self._create_vector_store(self.vector_store_type)
            self.statute_indices[statute].create_index(embeddings.shape[1])
        
        if statute:
            self.statute_indices[statute].add_vectors(embeddings, metadatas)
            print(f"✅ Indexed {len(real_docs)} REAL normative documents for statute {statute}")
        else:
            self.vector_store.add_vectors(embeddings, metadatas)
            print(f"✅ Indexed {len(real_docs)} REAL documents in general index")
        
        # Mark indices as loaded
        self.indices_loaded = True
    
    def _is_real_legal_content(self, content: str) -> bool:
        """
        Heuristic check if content looks like real legal text.
        Not perfect, but helps filter obvious non-legal content.
        """
        content_lower = content.lower()
        
        # Indicators of real legal content
        legal_indicators = [
            "§", "artikel", "paragraph", "gesetz", "recht",
            "shall", "must", "may not", "prohibited", "entitled",
            "gericht", "court", "verfahren", "procedure"
        ]
        
        # Check for legal markers
        for indicator in legal_indicators:
            if indicator in content_lower:
                return True
        
        # Check length (very short content unlikely to be real legal text)
        if len(content.split()) < 20:
            return False
        
        return True
    
    # ===========================================================================
    # NEW: STATUTE-AWARE PERSISTENCE METHODS (CRITICAL FIX)
    # ===========================================================================
    
    def save_statute_indices(self, statute: str) -> bool:
        """
        NEW: Persist statute-specific FAISS index to disk.
        This is the CORRECT method to call after ingesting a statute.
        
        Args:
            statute: The statute code (e.g., "BGB", "StGB")
        
        Returns:
            bool: True if saved successfully, False otherwise
        """
        if statute not in self.statute_indices:
            logger.warning(f"No statute index found for {statute}")
            return False
        
        store = self.statute_indices[statute]
        
        if not store.index or store.index.ntotal == 0:
            logger.warning(f"No vectors to save for statute {statute}")
            return False
        
        # Use lowercase for filename
        index_name = f"{statute.lower()}_index"
        success = store.save(index_name)
        
        if success:
            print(f"💾 Saved statute index for {statute} as {index_name}.faiss")
            # Also update the general index reference for backward compatibility
            self.save_indices("legal_index")
        else:
            print(f"⚠️ Could not save statute index for {statute}")
        
        return success
    
    def load_statute_indices(self, statute: str) -> bool:
        """
        NEW: Load statute-specific FAISS index from disk.
        
        Args:
            statute: The statute code (e.g., "BGB", "StGB")
        
        Returns:
            bool: True if loaded successfully, False otherwise
        """
        # Use lowercase for filename
        index_name = f"{statute.lower()}_index"
        
        # Create new vector store
        store = self._create_vector_store(self.vector_store_type)
        
        # Try to load
        if not store.load(index_name):
            logger.info(f"No existing index found for statute {statute}")
            return False
        
        # Store in statute indices
        self.statute_indices[statute] = store
        self.indices_loaded = True
        
        print(f"✅ Loaded statute index for {statute} with {store.index.ntotal} vectors")
        return True
    
    # ===========================================================================
    # ⭐⭐ MAIN RETRIEVAL METHOD WITH ALL FIXES APPLIED
    # ===========================================================================
    
    def resolve_authority_and_retrieve(self, query: str, question_type: str = "GENERAL",
                                       available_documents: Optional[List[Dict]] = None,
                                       authority_constraints: Optional[Dict] = None) -> Dict[str, Any]:
        """
        ENFORCE AUTHORITY → RETRIEVAL CONTRACT - WITH ALL FIXES APPLIED
        
        FIX 1: Canonical doctrine IDs
        FIX 2: No over-blocking for mixed questions
        FIX 3: Proper hierarchical metadata
        FIX 5: Clear blocking vs enforcement separation
        """
        # ===========================================================================
        # 🔴🔴🔴 FIX 2 + FIX 5: PRECISE DOCTRINAL CHECK WITH INVARIANT
        # ===========================================================================
        is_doctrinal, canonical_doctrine = self._is_doctrinal_question(question_type, query)
        if is_doctrinal:
            print(f"⚖️  DOCTRINAL QUESTION DETECTED: {question_type} - '{query[:50]}...'")
            print(f"   Canonical doctrine: {canonical_doctrine}")
            print("   🔒 HARD STOP: No retrieval performed for pure doctrinal question")
            
            # ===========================================================================
            # FIX 5: ENFORCE INVARIANT
            # ===========================================================================
            if self.doctrine_enforcement_enabled:
                print("   ⚠️  Disabling doctrine enforcement (blocking takes precedence)")
                self.doctrine_enforcement_enabled = False
            
            return self._get_doctrinal_empty_result(
                doctrine_mode=True, 
                canonical_doctrine=canonical_doctrine  # FIX 1: Canonical ID
            )
        # ===========================================================================
        # END HARD STOP
        # ===========================================================================
        
        # CRITICAL FIX: Ensure indices are loaded before proceeding
        if not self.ensure_indices_loaded():
            return self._get_empty_index_error()
        
        print(f"\n⚖️  AUTHORITY-CONTRACTED RETRIEVAL for: '{query[:50]}...'")
        
        # ===========================================================================
        # STEP 1: Check for paragraph-strict mode BEFORE doing anything else
        # ===========================================================================
        strict_mode = False
        requires_paragraph = False
        allowed_paragraphs = []
        
        if authority_constraints:
            # Check for strict mode activation
            if authority_constraints.get("retrievalConstraint") == "PARAGRAPH_STRICT":
                strict_mode = True
                print("🔒 PARAGRAPH_STRICT mode activated - No fallbacks allowed")
            
            requires_paragraph = authority_constraints.get("requiresParagraphMatch", False)
            allowed_paragraphs = authority_constraints.get("allowedParagraphs", [])
            
            if strict_mode and requires_paragraph and allowed_paragraphs:
                # Normalize allowed paragraphs for matching
                allowed_paragraphs_base = ParagraphNormalizer.normalize_paragraph_list(allowed_paragraphs)
                print(f"🔒 Strict mode requires exact paragraphs: {allowed_paragraphs} (normalized: {allowed_paragraphs_base})")
        
        # ===========================================================================
        # FIX: LAZY LOAD AUTHORITY SERVICES HERE (IMPORT TIMING FIX)
        # ===========================================================================
        if not self.authority_available:
            if not self._load_authority_services():
                print("⚠️  Authority services not available - cannot perform authority-contracted retrieval")
                return self._get_authority_unavailable_error()
        
        # STEP 2: Resolve legal authority
        authority_result = self.authority_resolver(query)
        print(f"   Legal Authority Result: {authority_result}")
        
        statute = authority_result.get("statute")
        paragraph = authority_result.get("paragraph")
        
        # ===========================================================================
        # STEP 3: PARAGRAPH-STRICT ENFORCEMENT CORE LOGIC (WITH ALL FIXES APPLIED)
        # ===========================================================================
        if strict_mode and requires_paragraph and allowed_paragraphs:
            print(f"🔒 ENFORCING PARAGRAPH-STRICT: Statute={statute}, Paragraphs={allowed_paragraphs}")
            
            # CRITICAL: Validate we have a statute for filtering
            if not statute:
                return self._get_strict_mode_error(
                    code="no_statute_in_strict_mode",
                    statute="UNKNOWN",
                    allowed_paragraphs=allowed_paragraphs,
                    message="Cannot enforce paragraph-strict mode without a statute"
                )
            
            # Get all documents from the statute index
            if statute not in self.statute_indices:
                return self._get_strict_mode_error(
                    code="statute_index_not_found",
                    statute=statute,
                    allowed_paragraphs=allowed_paragraphs,
                    message=f"No index found for statute {statute}"
                )
            
            # Step A: Hard filter corpus by exact paragraphs BEFORE similarity search
            store = self.statute_indices[statute]
            all_metadata = list(store.metadata.values())
            
            print(f"   Filtering {len(all_metadata)} documents for exact paragraphs...")
            
            filtered_docs = []
            for meta in all_metadata:
                # Check if this is a REAL legal document (not test data)
                if not meta.get("is_real_legal_content", True):
                    continue
                
                # Check statute match
                if meta.get("statute") != statute:
                    continue
                
                # FIX 2: Use paragraph_base for normalization matching
                doc_paragraph_base = meta.get("paragraph_base", "")
                if not doc_paragraph_base:
                    # Fallback to normalize paragraph if base not stored
                    doc_paragraph_base = ParagraphNormalizer.normalize_paragraph(meta.get("paragraph", ""))
                
                # Check paragraph match using normalized base paragraphs
                for allowed_para in allowed_paragraphs:
                    allowed_base = ParagraphNormalizer.normalize_paragraph(allowed_para)
                    if doc_paragraph_base == allowed_base:
                        filtered_docs.append(meta)
                        break
            
            print(f"   Found {len(filtered_docs)} documents matching exact paragraphs (after normalization)")
            
            # Step B: ENFORCE BINARY OUTCOME (the critical fix)
            if not filtered_docs:
                print(f"❌ PARAGRAPH-STRICT FAILURE: No documents found for {statute} §§ {', '.join(allowed_paragraphs)}")
                return self._get_strict_mode_error(
                    code="paragraph_not_found_in_corpus",
                    statute=statute,
                    allowed_paragraphs=allowed_paragraphs,
                    message=f"No authoritative documents found for {statute} §§ {', '.join(allowed_paragraphs)}. Retrieval aborted due to PARAGRAPH_STRICT constraint."
                )
            
            # Step C: Only now proceed with similarity search on filtered documents
            print(f"✅ PARAGRAPH-STRICT PASSED: Found {len(filtered_docs)} matching documents")
            
            # FIX 1: Use stored vector_id from metadata (RELIABLE METHOD)
            filtered_ids = []
            for meta in filtered_docs:
                vector_id = meta.get("vector_id")
                if vector_id is not None:
                    filtered_ids.append(vector_id)
                else:
                    # Fallback: find by metadata equality
                    for vec_id, stored_meta in store.metadata.items():
                        if stored_meta == meta:
                            filtered_ids.append(vec_id)
                            break
            
            if not filtered_ids:
                print(f"⚠️ Could not find vector IDs for filtered documents")
                return self._get_strict_mode_error(
                    code="vector_id_not_found",
                    statute=statute,
                    allowed_paragraphs=allowed_paragraphs,
                    message=f"Could not retrieve vector IDs for matching documents"
                )
            
            # Create a custom search that ONLY searches filtered vectors
            from app.services.embeddings.embedding_service import embedding_service
            query_embedding = np.array(embedding_service.embed_query(query, statute))
            
            # Search ONLY in filtered documents
            paragraph_results = []
            
            for vec_id in filtered_ids:
                if vec_id in store.metadata:
                    metadata = store.metadata[vec_id]
                    # Get the vector from the index
                    # Note: For strict mode, we use perfect score for exact match
                    result = {
                        "id": vec_id,
                        "score": 1.0,  # Perfect score for exact match
                        "metadata": metadata,
                        "content": metadata.get("content", ""),
                        "statute": statute,
                        "paragraph": metadata.get("paragraph", ""),
                        "paragraph_base": metadata.get("paragraph_base", ""),
                        "document_id": metadata.get("document_id", ""),
                        "is_authoritative": True,
                        "match_type": "exact_paragraph_strict",
                        "legal_relevance": 1.0,
                        "confidence": 1.0,
                        "authority_score": 1.0,
                        "is_real_legal_content": metadata.get("is_real_legal_content", True),
                        "strict_mode_guarantee": True,
                        "paragraph_normalization_applied": True
                    }
                    paragraph_results.append(result)
            
            # Use these as our results
            all_paragraph_results = paragraph_results
            
            # Skip general search - we already have our strict results
            general_results = []
        
        else:
            # ===========================================================================
            # NORMAL MODE (non-strict) - Original logic
            # ===========================================================================
            
            # Check if this is a statute overview request (no specific paragraph)
            is_overview_query = statute and not paragraph
            
            if is_overview_query:
                print(f"   Detected statute overview query for {statute}")
                
                # Use special overview retrieval
                overview_results = self.search_statute_overview(statute, query)
                
                return {
                    "results": overview_results,
                    "authority_metadata": {
                        "statute": statute,
                        "paragraph": None,
                        "query_type": "statute_overview",
                        "total_norms_returned": len(overview_results),
                        "has_real_norms": len(overview_results) > 0
                    },
                    "authority_validation": {
                        "status": "valid" if len(overview_results) > 0 else "no_norms",
                        "message": f"Returned {len(overview_results)} key norms from {statute}",
                        "is_overview": True
                    },
                    "requires_clarification": False
                }
            
            if authority_result.get("requiresClarification"):
                return {
                    "requires_clarification": True,
                    "clarification": authority_result.get("clarification"),
                    "statute": authority_result.get("statute"),
                    "results": [],
                    "authority_validation": {
                        "status": "requires_clarification",
                        "message": "Statute needs clarification before retrieval"
                    }
                }
            
            if not statute:
                return {
                    "requires_clarification": True,
                    "clarification": {
                        "english": "Could not identify applicable statute. Please specify which law you're asking about (e.g., StGB, BGB, GDPR).",
                        "german": "Anwendbare Rechtsnorm konnte nicht identifiziert werden. Bitte spezifizieren Sie, welches Gesetz Sie meinen (z.B. StGB, BGB, GDPR)."
                    },
                    "results": [],
                    "authority_validation": {"status": "no_statute"}
                }
            
            # ⭐⭐ FIX 2: EXPAND RETRIEVAL WITH STATUTE CHAINS
            related_paragraphs = self._get_statute_chain_paragraphs(statute, paragraph)
            print(f"📚 Statute chain for {statute} §{paragraph}: {related_paragraphs}")
            
            # Apply source authority filtering if documents provided AND resolver exists
            allowed_documents = []
            if available_documents and self.source_authority_resolver:
                try:
                    # Use source authority to filter documents
                    source_auth_result = self.source_authority_resolver.resolve(
                        question=query,
                        statute=statute,
                        question_type=question_type,
                        all_documents=available_documents
                    )
                    allowed_documents = source_auth_result.get("allowed_documents", [])
                    print(f"   Source Authority: Allowed {len(allowed_documents)}/{len(available_documents)} documents")
                except Exception as e:
                    print(f"⚠️  Source authority filtering failed: {e}")
                    allowed_documents = available_documents  # Fallback to all
            elif available_documents and not self.source_authority_resolver:
                print(f"   ⚠️  Source authority resolver not available, using all {len(available_documents)} documents")
                allowed_documents = available_documents
            
            # Retrieve with statute lock and chain expansion
            from app.services.embeddings.embedding_service import embedding_service
            query_embedding = np.array(embedding_service.embed_query(query, statute))
            
            # ⭐⭐ FIX 2: Search for ALL related paragraphs in the chain
            all_paragraph_results = []
            for para in related_paragraphs:
                para_results = self.search_by_paragraph(
                    statute=statute,
                    paragraph=para,
                    query_embedding=query_embedding,
                    k=5
                )
                if para_results:
                    # Mark chain relationship
                    for result in para_results:
                        result["chain_position"] = related_paragraphs.index(para)
                        result["chain_length"] = len(related_paragraphs)
                        result["chain_primary"] = (para == paragraph)
                    all_paragraph_results.extend(para_results)
            
            # Second: Get general statute results (fallback)
            general_results = []
            if not all_paragraph_results:
                general_results = self.search(
                    query_embedding=query_embedding,
                    statute=statute,
                    k=10
                )
                all_paragraph_results = general_results
        
        # ===========================================================================
        # STEP 4: Combine and apply authority filtering
        # ===========================================================================
        all_results = all_paragraph_results + (general_results if 'general_results' in locals() else [])
        
        # Filter by source authority if applicable
        if 'allowed_documents' in locals() and allowed_documents:
            allowed_ids = {doc.get("id", "") for doc in allowed_documents}
            filtered_results = []
            for result in all_results:
                doc_id = result.get("metadata", {}).get("document_id", "")
                if not doc_id or doc_id in allowed_ids:
                    filtered_results.append(result)
            all_results = filtered_results
        
        # ===========================================================================
        # STEP 5: Apply authority scoring
        # ===========================================================================
        authority_enhanced_results = []
        for result in all_results:
            authority_score = self._calculate_authority_score(result, statute)
            similarity_score = result.get("score", 0.0)
            
            # Combined score: authority × similarity (authority prioritized)
            combined_score = authority_score * (0.6 + 0.4 * similarity_score)
            
            enhanced_result = {
                **result,
                "authority_score": authority_score,
                "combined_score": combined_score,
                "is_statutory": result.get("metadata", {}).get("is_normative", False),
                "document_type": result.get("metadata", {}).get("document_type", "unknown"),
                "is_real_legal_content": result.get("metadata", {}).get("is_real_legal_content", False)
            }
            authority_enhanced_results.append(enhanced_result)
        
        # Sort by combined score (authority-weighted)
        authority_enhanced_results.sort(key=lambda x: x["combined_score"], reverse=True)
        
        # ===========================================================================
        # STEP 6: 🔴🔴🔴 FIX 5: CLEAR SEPARATION OF DOCTRINE BLOCKING VS ENFORCEMENT
        # ===========================================================================
        doctrine_results = None
        doctrinal_template = "not_applied"  # Default value
        
        # INVARIANT: If we passed the doctrinal check earlier, doctrine_enforcement is optional
        # Mixed questions (doctrine + norm) CAN have doctrine enforcement
        can_enforce_doctrine = self._should_enforce_doctrine(question_type, strict_mode, authority_constraints)
        
        if can_enforce_doctrine:
            print("⚖️  DOCTRINE ENFORCEMENT: Applying legal doctrine to results")
            
            # ===========================================================================
            # FIX 5: ENFORCEMENT IS OPTIONAL, NOT MANDATORY
            # ===========================================================================
            if not self._load_doctrine_inductor():
                # Enforcement service unavailable - this is NOT an error
                print("⚠️  Doctrine enforcement service unavailable - continuing without")
                doctrine_results = {
                    "status": "service_unavailable",
                    "template": "not_applied",
                    "doctrine_type": "not_applied"
                }
            elif self.doctrine_inductor and authority_enhanced_results:
                try:
                    # Apply doctrine induction to enhance results
                    doctrine_results = self.doctrine_inductor.induct(
                        query=query,
                        statute=statute,
                        paragraph=paragraph,
                        retrieval_results=authority_enhanced_results[:5],  # Top 5 for doctrine
                        question_type=question_type
                    )
                    
                    # Mark results with doctrine metadata
                    if doctrine_results and doctrine_results.get("status") == "applied":
                        for result in authority_enhanced_results:
                            result["doctrine_applied"] = True
                            result["doctrine_confidence"] = doctrine_results.get("confidence", 0.5)
                            result["doctrine_validation"] = doctrine_results.get("validation", {})
                        
                        doctrinal_template = doctrine_results.get("template", "applied")
                        print(f"✅ Doctrine applied: {doctrine_results.get('doctrine_type', 'unknown')}")
                    else:
                        doctrine_results = {
                            "status": "not_applied",
                            "template": "not_applied",
                            "doctrine_type": "not_applied"
                        }
                        print("ℹ️  Doctrine not applied to results (inductor returned not_applied)")
                    
                except Exception as e:
                    print(f"⚠️  Doctrine application failed: {e}")
                    doctrine_results = {
                        "status": "exception",
                        "template": "not_applied",
                        "doctrine_type": "not_applied",
                        "error": str(e)
                    }
        
        # ===========================================================================
        # STEP 7: Validation
        # ===========================================================================
        validation_stats = self._validate_authority_results(
            authority_enhanced_results, 
            statute, 
            paragraph,
            related_paragraphs if 'related_paragraphs' in locals() else None,
            strict_mode
        )
        
        # Add doctrine validation if doctrine was applied
        if doctrine_results and doctrine_results.get("status") == "applied":
            validation_stats["doctrine"] = {
                "applied": True,
                "doctrine_type": doctrine_results.get("doctrine_type", "unknown"),
                "confidence": doctrine_results.get("confidence", 0.0),
                "completeness": doctrine_results.get("completeness", 0.0),
                "template": doctrinal_template,
                "status": "enforced"  # Not "hard" - enforcement is optional
            }
        else:
            validation_stats["doctrine"] = {
                "applied": False,
                "status": doctrine_results.get("status", "not_required") if doctrine_results else "not_required",
                "template": doctrinal_template,
                "message": "Doctrine not applied or not required"
            }
        
        # ===========================================================================
        # FINAL RETURN WITH EXPLICIT DOCTRINAL FLAGS
        # ===========================================================================
        return {
            "results": authority_enhanced_results[:10],
            "authority_metadata": {
                "statute": statute,
                "paragraph": paragraph,
                "paragraph_source": authority_result.get("paragraph_source", "explicit"),
                "confidence": authority_result.get("confidence", 1.0),
                "question_type": question_type,
                "statute_chain_used": 'related_paragraphs' in locals() and len(related_paragraphs) > 1,
                "related_paragraphs": related_paragraphs if 'related_paragraphs' in locals() else None,
                "total_documents_considered": len(all_results),
                "authority_filtered_count": len(authority_enhanced_results),
                "has_real_norms": len(authority_enhanced_results) > 0,
                "strict_mode_enforced": strict_mode,
                "paragraph_strict_success": strict_mode and len(authority_enhanced_results) > 0,
                "paragraph_normalization_applied": strict_mode,
                "doctrine_enforced": bool(doctrine_results and doctrine_results.get("status") == "applied"),
                # 🔴🔴🔴 EXPLICIT SEPARATION MARKERS (FIX 5)
                "doctrinal_template": doctrinal_template,
                "legal_hierarchy": "statutory",  # Always statutory for non-doctrinal questions
                "doctrine_blocking_applied": False,  # Explicit: blocking was not applied
                "doctrine_enforcement_applied": bool(doctrine_results and doctrine_results.get("status") == "applied")
            },
            "authority_validation": validation_stats,
            "requires_clarification": False,
            # ALWAYS INCLUDE DOCTRINE METADATA (FIX 5)
            "doctrine_metadata": doctrine_results if doctrine_results else {
                "status": doctrinal_template,
                "doctrinal_template": doctrinal_template,
                "applied": False,
                "type": "not_applied"  # FIX 5: Clear type
            }
        }
    
    def _should_enforce_doctrine(self, question_type: str, strict_mode: bool, authority_constraints: Optional[Dict]) -> bool:
        """Determine if doctrine should be enforced (optional, not mandatory)"""
        # Always enforce doctrine in strict mode (when available)
        if strict_mode:
            return True
        
        # Check authority constraints for doctrine requirement
        if authority_constraints and authority_constraints.get("requiresDoctrine", False):
            return True
        
        # For certain question types, consider enforcement
        doctrinal_question_types = ["LEGAL_ANALYSIS", "LEGAL_ADVICE", "EXAMINER_QUESTION"]
        if question_type in doctrinal_question_types:
            return True
        
        # For general questions, use default
        return False
    
    def _get_strict_mode_error(self, code: str, statute: str, allowed_paragraphs: List[str], message: str) -> Dict:
        """Return structured error for paragraph-strict mode failures"""
        error_response = {
            "error": {
                "code": code,
                "type": "paragraph_not_found_in_corpus",
                "statute": statute,
                "requested_paragraphs": allowed_paragraphs,
                "retrievalConstraint": "PARAGRAPH_STRICT",
                "action": "ingest_or_fix_paragraph_index",
                "message": message,
                "requires_ingestion": True,
                "action_required": "Upload missing paragraphs to the legal corpus"
            },
            "results": [],
            "authority_metadata": {
                "statute": statute,
                "paragraph": None,
                "error": "paragraph_strict_failure",
                "has_real_norms": False,
                "strict_mode_enforced": True,
                "paragraph_strict_success": False,
                "paragraph_normalization_applied": True,
                # FIX 3: Proper hierarchy indication
                "doctrinal_template": "not_applied_due_to_error",
                "legal_hierarchy": "statutory",  # Still statutory context
                "doctrine_blocking_applied": False
            },
            "authority_validation": {
                "status": "paragraph_strict_failure",
                "message": message,
                "requires_ingestion": True,
                "strict_mode_failure": True,
                "doctrine": {
                    "applied": False,
                    "status": "not_applied_due_to_error"
                }
            },
            "requires_clarification": False,
            "doctrine_metadata": {
                "status": "not_applied_due_to_error",
                "doctrinal_template": "not_applied_due_to_error",
                "applied": False,
                "type": "not_applied"  # FIX 5
            }
        }
        
        print(f"❌ PARAGRAPH-STRICT ERROR: {message}")
        return error_response
    
    def _get_statute_chain_paragraphs(self, statute: str, paragraph: str) -> List[str]:
        """
        ⭐⭐ FIX 2: Get related paragraphs in statutory chain
        e.g., §119 → ["119", "121", "122"]
        """
        if not statute or not paragraph:
            return [paragraph] if paragraph else []
        
        # Get chain for this statute
        statute_chains = self.statute_chains.get(statute, {})
        
        # Find chain for this paragraph
        for chain_key, chain_values in statute_chains.items():
            # Check if this paragraph starts a chain
            if ParagraphNormalizer.paragraph_matches(chain_key, paragraph):
                return [paragraph] + chain_values
            
            # Check if paragraph is in a chain
            for chain_para in chain_values:
                if ParagraphNormalizer.paragraph_matches(chain_para, paragraph):
                    return [chain_key] + chain_values
        
        # No chain found, return just the paragraph
        return [paragraph]
    
    def _validate_authority_results(self, results: List[Dict], statute: str, paragraph: Optional[str], 
                                   related_paragraphs: List[str] = None, strict_mode: bool = False) -> Dict:
        """Validate that results meet authority requirements - ENHANCED FOR CHAINS"""
        if not results:
            failure_status = "strict_mode_failure" if strict_mode else "no_results"
            return {
                "status": failure_status,
                "message": "No documents found for the specified statute",
                "statute_compliance": 0.0,
                "has_statutory_norms": False,
                "has_real_norms": False,
                "strict_mode_failure": strict_mode,
                "doctrine": {
                    "applied": False,
                    "status": "not_applied_no_results"
                }
            }
        
        # Count REAL norms
        real_norms = [r for r in results if r.get("is_real_legal_content", False)]
        
        if not real_norms:
            return {
                "status": "no_real_norms",
                "message": "No real legal norms found (possibly using test data)",
                "statute_compliance": 0.0,
                "has_statutory_norms": False,
                "has_real_norms": False,
                "strict_mode_failure": strict_mode,
                "doctrine": {
                    "applied": False,
                    "status": "not_applied_no_real_norms"
                }
            }
        
        statutory_count = sum(1 for r in real_norms if r.get("is_statutory", False))
        statute_compliance = sum(1 for r in real_norms if r.get("metadata", {}).get("statute") == statute) / len(real_norms)
        
        validation = {
            "status": "valid" if statute_compliance > 0.7 else "partial",
            "message": f"Found {statutory_count} REAL statutory norms among {len(real_norms)} results",
            "statute_compliance": statute_compliance,
            "has_statutory_norms": statutory_count > 0,
            "has_real_norms": len(real_norms) > 0,
            "statutory_count": statutory_count,
            "total_results": len(real_norms),
            "strict_mode": strict_mode,
            "doctrine": {
                "applied": False,
                "status": "not_yet_evaluated"
            }
        }
        
        # Check paragraph compliance in strict mode
        if strict_mode and paragraph:
            paragraphs_found = []
            for r in real_norms:
                meta = r.get("metadata", {})
                para = meta.get("paragraph", "")
                if para:
                    paragraphs_found.append(para)
            
            validation["strict_paragraph_compliance"] = {
                "requested_paragraph": paragraph,
                "found_paragraphs": paragraphs_found,
                "exact_match": any(ParagraphNormalizer.paragraph_matches(para, paragraph) for para in paragraphs_found)
            }
        
        # ⭐⭐ FIX 2: Check for chain completeness
        if paragraph and related_paragraphs and len(related_paragraphs) > 1:
            found_paragraphs = set()
            for r in real_norms:
                meta = r.get("metadata", {})
                para = meta.get("paragraph", "")
                if para:
                    found_paragraphs.add(para)
            
            # Normalize for comparison
            found_bases = [ParagraphNormalizer.normalize_paragraph(p) for p in found_paragraphs]
            required_bases = [ParagraphNormalizer.normalize_paragraph(p) for p in related_paragraphs]
            
            chain_coverage = len([p for p in required_bases if p in found_bases])
            chain_completeness = chain_coverage / len(required_bases)
            
            validation["chain_coverage"] = {
                "required_paragraphs": related_paragraphs,
                "found_paragraphs": list(found_paragraphs),
                "coverage": chain_completeness,
                "is_complete": chain_completeness >= 0.5  # At least half the chain
            }
            
            if chain_completeness < 0.5:
                validation["status"] = "partial_chain"
                validation["message"] += f" (chain coverage: {chain_coverage}/{len(related_paragraphs)} paragraphs)"
        
        return validation
    
    def _get_empty_index_error(self) -> Dict:
        """Return error when indices cannot be loaded"""
        return {
            "results": [],
            "authority_metadata": {
                "statute": None,
                "paragraph": None,
                "error": "No legal corpus found",
                "required_action": "Upload real BGB/StGB documents using /ingestion/bgb endpoint",
                "has_real_norms": False,
                # FIX 3: Proper hierarchy
                "doctrinal_template": "not_applied_no_corpus",
                "legal_hierarchy": "unknown",
                "doctrine_blocking_applied": False
            },
            "authority_validation": {
                "status": "no_corpus",
                "message": "No legal corpus available. Please ingest real BGB/StGB documents first.",
                "requires_ingestion": True,
                "doctrine": {
                    "applied": False,
                    "status": "not_applied_no_corpus"
                }
            },
            "requires_clarification": False,
            "doctrine_metadata": {
                "status": "not_applied_no_corpus",
                "doctrinal_template": "not_applied_no_corpus",
                "applied": False,
                "type": "not_applied"  # FIX 5
            }
        }
    
    def _get_authority_unavailable_error(self) -> Dict:
        """Return error when authority services are unavailable"""
        return {
            "results": [],
            "authority_metadata": {
                "statute": None,
                "paragraph": None,
                "error": "Authority services unavailable",
                "has_real_norms": False,
                # FIX 3: Proper hierarchy
                "doctrinal_template": "not_applied_no_authority",
                "legal_hierarchy": "unknown",
                "doctrine_blocking_applied": False
            },
            "authority_validation": {
                "status": "authority_unavailable",
                "message": "Legal authority resolution service is not available.",
                "doctrine": {
                    "applied": False,
                    "status": "not_applied_no_authority"
                }
            },
            "requires_clarification": False,
            "doctrine_metadata": {
                "status": "not_applied_no_authority",
                "doctrinal_template": "not_applied_no_authority",
                "applied": False,
                "type": "not_applied"  # FIX 5
            }
        }
    
    def _calculate_authority_score(self, result: Dict, target_statute: str) -> float:
        """Calculate authority score based on document type and statute match"""
        metadata = result.get("metadata", {})
        
        base_score = metadata.get("authority_score", 0.5)
        is_normative = metadata.get("is_normative", False)
        statute_match = metadata.get("statute", "") == target_statute
        doc_type = metadata.get("document_type", "other")
        is_real = metadata.get("is_real_legal_content", False)
        
        # CRITICAL: Penalize non-real content heavily
        if not is_real:
            return 0.1
        
        # Authority hierarchy
        if is_normative and statute_match:
            return 1.0  # Perfect match: statutory norm
        elif doc_type == "case_law" and statute_match:
            return 0.8  # Case law on point
        elif doc_type == "academic" and statute_match:
            return 0.5  # Academic commentary
        elif statute_match:
            return 0.7  # Other relevant documents
        else:
            return 0.3  # Wrong statute
    
    def search_statute_overview(self, statute: str, query: str = "", k: int = 20) -> List[Dict]:
        """
        Special method for statute overview queries (when no specific paragraph is requested)
        Returns key REAL norms from the statute
        """
        # CRITICAL FIX: Ensure indices are loaded
        if not self.ensure_indices_loaded():
            return []
        
        print(f"📖 Retrieving statute overview for {statute}")
        
        from app.services.embeddings.embedding_service import embedding_service
        
        # Use a general query about the statute if none provided
        if not query or query.strip() == "":
            query = f"key provisions of {statute} German law"
        
        # ✅ STANDARDIZED: Use embed_query consistently
        query_embedding = np.array(embedding_service.embed_query(query, statute))
        
        # First, try to get all norms from the statute index
        if statute in self.statute_indices:
            all_results = []
            store = self.statute_indices[statute]
            
            # Get all documents from this statute index
            all_metadata = list(store.metadata.values())
            
            # Filter for REAL normative documents
            real_normative_docs = [
                meta for meta in all_metadata 
                if meta.get("is_normative", False) and 
                meta.get("is_real_legal_content", True)
            ]
            
            # If we have specific norms, return them with semantic ranking
            if real_normative_docs:
                # Convert to search result format
                for meta in real_normative_docs:
                    # Create a dummy result
                    result = {
                        "id": -1,
                        "score": 0.7,
                        "metadata": meta,
                        "content": meta.get("content", ""),
                        "statute": statute,
                        "paragraph": meta.get("paragraph", ""),
                        "paragraph_base": meta.get("paragraph_base", ""),
                        "document_id": meta.get("document_id", ""),
                        "is_authoritative": True,
                        "match_type": "statutory_norm",
                        "legal_relevance": 1.0,
                        "confidence": 0.9,
                        "authority_score": 1.0,
                        "is_real_legal_content": meta.get("is_real_legal_content", True)
                    }
                    all_results.append(result)
                
                # Sort by paragraph number (for logical ordering)
                def extract_paragraph_number(para):
                    try:
                        if not para:
                            return 0
                        # Get base number
                        base = ParagraphNormalizer.normalize_paragraph(str(para))
                        return int(base) if base.isdigit() else 0
                    except:
                        return 0
                
                all_results.sort(key=lambda x: extract_paragraph_number(x["paragraph"]))
                
                # Limit to top k
                return all_results[:k]
        
        # Fallback to regular search
        return self.search(query_embedding, statute, k)
    
    # ===========================================================================
    # UPDATED SEARCH METHODS WITH ALL FIXES
    # ===========================================================================
    
    def search_by_paragraph(self, statute: str, paragraph: str, 
                           query_embedding: Optional[np.ndarray] = None,
                           k: int = 5, paragraphSource: str = "explicit") -> List[Dict]:
        """
        Statute-First search: Find specific paragraph with authority guarantee
        Now includes paragraphSource parameter for confidence adjustment
        """
        # CRITICAL FIX: Ensure indices are loaded
        if not self.ensure_indices_loaded():
            return []
        
        if statute not in self.statute_indices:
            print(f"⚠️ No index found for statute: {statute}")
            return []
        
        # FIX 2: Normalize paragraph for matching
        paragraph_base = ParagraphNormalizer.normalize_paragraph(paragraph)
        
        # First: Try exact paragraph match (AUTHORITY SEARCH)
        all_metadata = list(self.statute_indices[statute].metadata.values())
        exact_matches = []
        
        for meta in all_metadata:
            # Check if this is REAL legal content
            if not meta.get("is_real_legal_content", True):
                continue  # Skip fake/test content
            
            # Check statute match
            if meta.get("statute") != statute:
                continue
            
            # FIX 2: Use paragraph_base for matching
            meta_paragraph_base = meta.get("paragraph_base", "")
            if not meta_paragraph_base:
                meta_paragraph_base = ParagraphNormalizer.normalize_paragraph(meta.get("paragraph", ""))
            
            if meta_paragraph_base == paragraph_base:
                # This is the authoritative norm
                result = {
                    "id": meta.get("vector_id", -1),
                    "score": 1.0,
                    "metadata": meta,
                    "content": meta.get("content", ""),
                    "statute": statute,
                    "paragraph": meta.get("paragraph", ""),
                    "paragraph_base": meta_paragraph_base,
                    "document_id": meta.get("document_id", ""),
                    "is_authoritative": True,
                    "match_type": "exact_paragraph",
                    "legal_relevance": 1.0,
                    "confidence": 1.0,
                    "authority_score": 1.0,
                    "is_real_legal_content": True,
                    "paragraph_normalization_applied": True
                }
                
                # CRITICAL SAFETY ADJUSTMENT: Down-weight inferred paragraphs
                if paragraphSource == "inferred":
                    result["confidence"] = 0.85
                    result["authority_note"] = "paragraph inferred, not explicitly cited"
                    result["legal_relevance"] = 0.85
                    result["authority_score"] = 0.85
                    print(f"⚠️ Down-weighted confidence for inferred paragraph: {statute} §{paragraph}")
                
                exact_matches.append(result)
        
        if exact_matches:
            print(f"✅ Found REAL authoritative match for {statute} §{paragraph} (normalized: {paragraph_base})")
            return exact_matches[:k]
        
        # Second: Fall back to semantic search if no exact match
        if query_embedding is not None:
            semantic_results = self.statute_indices[statute].search(query_embedding, k)
            
            # Filter for REAL content only
            real_semantic_results = []
            for result in semantic_results:
                metadata = result.get("metadata", {})
                if not metadata.get("is_real_legal_content", True):
                    continue  # Skip fake/test content
                
                # Enhance results with paragraph awareness
                result["is_authoritative"] = False
                result["match_type"] = "semantic"
                result["legal_relevance"] = self._calculate_legal_relevance(result)
                result["confidence"] = result["score"]
                result["authority_score"] = self._calculate_authority_score(result, statute)
                result["is_real_legal_content"] = True
                
                # Apply paragraph source adjustment
                if paragraphSource == "inferred":
                    result["confidence"] = min(result["confidence"] * 0.85, 0.95)
                    result["authority_note"] = "search based on inferred paragraph"
                
                # Check if result contains the requested paragraph
                content = result.get("content", "")
                if f"§{paragraph}" in content or f"§ {paragraph}" in content:
                    result["is_authoritative"] = True
                    result["match_type"] = "paragraph_in_content"
                    result["score"] = max(result["score"], 0.9)
                    result["legal_relevance"] = min(result["legal_relevance"] * 1.3, 1.0)
                    result["confidence"] = max(result["confidence"], 0.9)
                    result["authority_score"] = max(result["authority_score"], 0.9)
                
                real_semantic_results.append(result)
            
            return real_semantic_results[:k]
        
        return []
    
    def search_with_validation(self, query: str, statute: str, paragraph: str, 
                              k: int = 10, paragraphSource: str = "explicit",
                              authority_constraints: Optional[Dict] = None,
                              question_type: str = "GENERAL") -> Dict:  # FIX 4: Added question_type
        """
        Complete Statute-First search with validation
        WITH ALL FIXES APPLIED
        """
        # ===========================================================================
        # 🔴🔴🔴 FIX 4: Use actual question_type, not "GENERAL" placeholder
        # ===========================================================================
        is_doctrinal, canonical_doctrine = self._is_doctrinal_question(question_type, query)
        if is_doctrinal:
            print(f"⚖️  DOCTRINAL SEARCH BLOCKED: '{query[:50]}...'")
            print(f"   Canonical doctrine: {canonical_doctrine}")
            print("   🔒 HARD STOP: No retrieval performed for doctrinal question in search_with_validation")
            return {
                "results": [],
                "validation": {
                    "statute": statute,
                    "paragraph": paragraph,
                    "error": "doctrinal_question_no_retrieval",
                    "total_results": 0,
                    "has_real_norms": False,
                    "strict_mode": False,
                    "strict_mode_failure": False,
                    "doctrine": {
                        "applied": True,
                        "status": "settled_doctrine_no_retrieval",
                        "canonical_doctrine": canonical_doctrine  # FIX 1: Canonical ID
                    }
                },
                "query_info": {
                    "statute": statute,
                    "paragraph": paragraph,
                    "paragraph_source": paragraphSource,
                    "query": query,
                    "strict_mode": False,
                    "doctrinal_template": "constitutional_principle",
                    "legal_hierarchy": "constitutional",
                    "doctrine_blocking_applied": True  # FIX 5
                },
                "doctrine_metadata": {
                    "status": "settled_doctrine_no_retrieval",
                    "canonical_doctrine": canonical_doctrine,  # FIX 1: Canonical ID
                    "doctrinal_template": "constitutional_principle",
                    "applied": True,
                    "retrieval_blocked": True,
                    "type": "blocking_not_enforcement"  # FIX 5
                }
            }
        # ===========================================================================
        # END HARD STOP
        # ===========================================================================
        
        # Check for strict mode
        strict_mode = False
        if authority_constraints and authority_constraints.get("retrievalConstraint") == "PARAGRAPH_STRICT":
            strict_mode = True
            print(f"🔒 STRICT MODE in search_with_validation for {statute} §{paragraph}")
        
        # CRITICAL FIX: Ensure indices are loaded
        if not self.ensure_indices_loaded():
            return {
                "results": [],
                "validation": {
                    "statute": statute,
                    "paragraph": paragraph,
                    "error": "No legal corpus found",
                    "total_results": 0,
                    "has_real_norms": False,
                    "strict_mode": strict_mode,
                    "strict_mode_failure": strict_mode,  # Always fails in strict mode with no corpus
                    "doctrine": {
                        "applied": False,
                        "status": "not_applied_no_corpus"
                    }
                },
                "query_info": {
                    "statute": statute,
                    "paragraph": paragraph,
                    "paragraph_source": paragraphSource,
                    "query": query,
                    "strict_mode": strict_mode,
                    "doctrinal_template": "not_applied_no_corpus",
                    "legal_hierarchy": "unknown",
                    "doctrine_blocking_applied": False
                },
                "doctrine_metadata": {
                    "status": "not_applied_no_corpus",
                    "doctrinal_template": "not_applied_no_corpus",
                    "applied": False,
                    "type": "not_applied"  # FIX 5
                }
            }
        
        from app.services.embeddings.embedding_service import embedding_service
        
        # ✅ STANDARDIZED: Use embed_query consistently
        query_embedding = np.array(embedding_service.embed_query(query, statute))
        
        # FIX 2: Normalize paragraph
        paragraph_base = ParagraphNormalizer.normalize_paragraph(paragraph)
        
        # Check if we're in strict mode
        if strict_mode:
            # Get all documents from statute index
            if statute not in self.statute_indices:
                return {
                    "results": [],
                    "validation": {
                        "statute": statute,
                        "paragraph": paragraph,
                        "error": "No index found for statute in strict mode",
                        "total_results": 0,
                        "has_real_norms": False,
                        "strict_mode": True,
                        "strict_mode_failure": True,
                        "doctrine": {
                            "applied": False,
                            "status": "not_applied_strict_mode_failure"
                        }
                    },
                    "query_info": {
                        "statute": statute,
                        "paragraph": paragraph,
                        "paragraph_source": paragraphSource,
                        "query": query,
                        "strict_mode": True,
                        "doctrinal_template": "not_applied_strict_mode_failure",
                        "legal_hierarchy": "statutory",
                        "doctrine_blocking_applied": False
                    },
                    "doctrine_metadata": {
                        "status": "not_applied_strict_mode_failure",
                        "doctrinal_template": "not_applied_strict_mode_failure",
                        "applied": False,
                        "type": "not_applied"  # FIX 5
                    }
                }
            
            # Filter for exact paragraph using normalized base
            store = self.statute_indices[statute]
            all_metadata = list(store.metadata.values())
            
            exact_matches = []
            for meta in all_metadata:
                if not meta.get("is_real_legal_content", True):
                    continue
                if meta.get("statute") != statute:
                    continue
                
                # Use paragraph_base for matching
                meta_paragraph_base = meta.get("paragraph_base", "")
                if not meta_paragraph_base:
                    meta_paragraph_base = ParagraphNormalizer.normalize_paragraph(meta.get("paragraph", ""))
                
                if meta_paragraph_base == paragraph_base:
                    result = {
                        "id": meta.get("vector_id", -1),
                        "score": 1.0,
                        "metadata": meta,
                        "content": meta.get("content", ""),
                        "statute": statute,
                        "paragraph": meta.get("paragraph", ""),
                        "paragraph_base": meta_paragraph_base,
                        "document_id": meta.get("document_id", ""),
                        "is_authoritative": True,
                        "match_type": "exact_paragraph_strict",
                        "legal_relevance": 1.0,
                        "confidence": 1.0,
                        "authority_score": 1.0,
                        "is_real_legal_content": True,
                        "strict_mode_guarantee": True,
                        "paragraph_normalization_applied": True
                    }
                    exact_matches.append(result)
            
            if not exact_matches:
                return {
                    "results": [],
                    "validation": {
                        "statute": statute,
                        "paragraph": paragraph,
                        "error": "Paragraph not found in strict mode",
                        "total_results": 0,
                        "has_real_norms": False,
                        "strict_mode": True,
                        "strict_mode_failure": True,
                        "strict_mode_message": f"No documents found for {statute} §{paragraph} in strict mode",
                        "doctrine": {
                            "applied": False,
                            "status": "not_applied_strict_mode_failure"
                        }
                    },
                    "query_info": {
                        "statute": statute,
                        "paragraph": paragraph,
                        "paragraph_source": paragraphSource,
                        "query": query,
                        "strict_mode": True,
                        "doctrinal_template": "not_applied_strict_mode_failure",
                        "legal_hierarchy": "statutory",
                        "doctrine_blocking_applied": False
                    },
                    "doctrine_metadata": {
                        "status": "not_applied_strict_mode_failure",
                        "doctrinal_template": "not_applied_strict_mode_failure",
                        "applied": False,
                        "type": "not_applied"  # FIX 5
                    }
                }
            
            paragraph_results = exact_matches
        
        else:
            # Normal mode: Search by paragraph first (with normalization)
            paragraph_results = self.search_by_paragraph(statute, paragraph, query_embedding, k, paragraphSource)
        
        # Filter for REAL results only
        real_paragraph_results = [r for r in paragraph_results if r.get("is_real_legal_content", True)]
        
        # In strict mode, we already have our results (or error)
        # In normal mode, fall back to general search if needed
        if not strict_mode and not real_paragraph_results:
            general_results = self.search(query_embedding, statute, k)
            real_paragraph_results = [r for r in general_results if r.get("is_real_legal_content", True)]
        
        # Validate results
        validation_results = []
        
        for result in real_paragraph_results:
            content = result.get("content", "")
            validation = self.validator.validate_response(content, statute, paragraph)
            
            # Adjust validation based on paragraph source
            if paragraphSource == "inferred":
                validation["security_score"] = max(validation["security_score"] - 15, 0)
                if not validation.get("issues"):
                    validation["issues"] = []
                validation["issues"].append("Paragraph was inferred from context")
            
            result["validation"] = validation
            validation_results.append(validation)
        
        # Determine overall validation
        overall_validation = {
            "statute": statute,
            "paragraph": paragraph,
            "paragraph_source": paragraphSource,
            "total_results": len(real_paragraph_results),
            "real_norm_count": len(real_paragraph_results),
            "authoritative_results": sum(1 for r in real_paragraph_results 
                                       if r.get("is_authoritative", False)),
            "inferred_paragraph": paragraphSource == "inferred",
            "has_real_norms": len(real_paragraph_results) > 0,
            "strict_mode": strict_mode,
            "strict_mode_failure": strict_mode and len(real_paragraph_results) == 0,
            "validation_summary": {
                "valid_count": sum(1 for v in validation_results if v["is_valid"]),
                "avg_security_score": np.mean([v["security_score"] for v in validation_results]) 
                                   if validation_results else 0
            },
            "doctrine": {
                "applied": False,
                "status": "not_required_for_search"
            }
        }
        
        # FIX 5: Clear separation markers
        doctrinal_template = "not_required_for_search"
        
        return {
            "results": real_paragraph_results[:k],
            "validation": overall_validation,
            "query_info": {
                "statute": statute,
                "paragraph": paragraph,
                "paragraph_source": paragraphSource,
                "query": query,
                "strict_mode": strict_mode,
                "doctrinal_template": doctrinal_template,
                "legal_hierarchy": "statutory",  # Always statutory for non-doctrinal search
                "doctrine_blocking_applied": False  # FIX 5: Explicit
            },
            "doctrine_metadata": {
                "status": doctrinal_template,
                "doctrinal_template": doctrinal_template,
                "applied": False,
                "type": "not_applied"  # FIX 5
            }
        }
    
    def search(self, query_embedding: np.ndarray, statute: Optional[str] = None,
               k: int = 10, filters: Optional[Dict] = None) -> List[Dict]:
        """
        Search for similar documents - FIXED TO ENSURE INDICES ARE LOADED
        Only returns REAL legal content
        """
        # CRITICAL FIX: Ensure indices are loaded
        if not self.ensure_indices_loaded():
            return []
        
        # Check if indices are empty
        if self.vector_store.index is None or self.vector_store.index.ntotal == 0:
            print(f"⚠️ Warning: Vector index is empty. No real legal corpus found.")
            return []
        
        results = []
        
        # CRITICAL FIX: Always search statute index when statute is known
        if statute and statute in self.statute_indices:
            try:
                statute_results = self.statute_indices[statute].search(query_embedding, k, filters)
                if statute_results:
                    # Filter for REAL content
                    real_statute_results = [
                        r for r in statute_results 
                        if r.get("metadata", {}).get("is_real_legal_content", True)
                    ]
                    if real_statute_results:
                        print(f"✅ Found {len(real_statute_results)} REAL results in statute index for {statute}")
                        results.extend(real_statute_results)
            except Exception as e:
                print(f"⚠️ Error searching statute index for {statute}: {e}")
        
        # Also search in general index
        general_results = self.vector_store.search(query_embedding, k, filters)
        
        # Filter for REAL content
        real_general_results = [
            r for r in general_results 
            if r.get("metadata", {}).get("is_real_legal_content", True)
        ]
        
        # Filter out duplicates
        seen_ids = set(r["id"] for r in results)
        for result in real_general_results:
            if result["id"] not in seen_ids:
                results.append(result)
                seen_ids.add(result["id"])
        
        # Sort by score
        results.sort(key=lambda x: x["score"], reverse=True)
        
        # Apply post-filtering if needed
        if filters:
            filtered_results = []
            for result in results:
                metadata = result["metadata"]
                match = True
                for key, value in filters.items():
                    if metadata.get(key) != value:
                        match = False
                        break
                if match:
                    filtered_results.append(result)
            results = filtered_results[:k]
        else:
            results = results[:k]
        
        # CRITICAL: Boost statute-matching results when statute was specified
        if statute:
            boosted_results = []
            for result in results:
                result_statute = result["metadata"].get("statute", "")
                is_matching_statute = result_statute == statute
                
                # Major boost for exact statute match
                if is_matching_statute:
                    result["score"] = min(result["score"] * 1.3, 0.99)
                    result["statute_match_boost"] = True
                else:
                    result["statute_match_boost"] = False
                
                result["legal_relevance"] = self._calculate_legal_relevance(result)
                result["is_authoritative"] = result.get("is_authoritative", False)
                result["match_type"] = result.get("match_type", "semantic")
                result["confidence"] = result.get("score", 0.0)
                result["authority_score"] = self._calculate_authority_score(result, statute)
                result["is_real_legal_content"] = result.get("metadata", {}).get("is_real_legal_content", True)
                
                boosted_results.append(result)
            
            # Re-sort after boosting
            boosted_results.sort(key=lambda x: x["score"], reverse=True)
            results = boosted_results
        
        return results
    
    def _calculate_legal_relevance(self, result: Dict) -> float:
        """Calculate legal relevance score"""
        score = result["score"]
        metadata = result["metadata"]
        
        # CRITICAL FIX: Use boolean paragraph presence, not similarity
        is_normative = metadata.get("is_normative", False)
        has_paragraph = metadata.get("has_paragraph", False)
        is_real = metadata.get("is_real_legal_content", True)
        
        if not is_real:
            return 0.0
        
        if is_normative:
            score *= 1.5
        elif has_paragraph:
            score *= 1.2
        
        # Boost for statute match
        if metadata.get("statute"):
            score *= 1.05
        
        # Penalize very short content
        content = metadata.get("content", "")
        if len(content.split()) < 10:
            score *= 0.8
        
        return min(score, 1.0)
    
    # ===========================================================================
    # UPDATED PERSISTENCE METHODS
    # ===========================================================================
    
    def save_indices(self, base_name: str = "legal_index") -> bool:
        """Save all indices to disk"""
        # Save general index
        general_success = self.vector_store.save(base_name) if self.vector_store.index and self.vector_store.index.ntotal > 0 else False
        
        # Save statute indices
        statute_success = False
        for statute, index in self.statute_indices.items():
            if index.index and index.index.ntotal > 0:
                # Use statute-specific naming
                success = index.save(f"{statute.lower()}_index")
                if success:
                    statute_success = True
                    print(f"💾 Saved statute index for {statute}")
        
        success = general_success or statute_success
        
        if success:
            print(f"💾 Saved indices to disk")
        else:
            print(f"⚠️ Could not save indices to disk (no vectors or Windows FAISS limitation)")
        
        return success
    
    def load_indices(self, base_name: str = "legal_index") -> bool:
        """Load indices from disk"""
        # First try general index
        general_success = self.vector_store.load(base_name)
        
        # Try to load statute indices
        statute_files = [f for f in os.listdir(self.vector_store.indices_dir) 
                        if f.endswith("_index.faiss")]
        
        for file in statute_files:
            # Extract statute name from filename
            statute = file.replace("_index.faiss", "").upper()
            if statute:
                store = self._create_vector_store(self.vector_store_type)
                if store.load(f"{statute.lower()}_index"):
                    self.statute_indices[statute] = store
        
        success = general_success or len(self.statute_indices) > 0
        if success:
            logger.info(f"Loaded {len(self.statute_indices)} statute indices")
        
        return success
    
    def get_stats(self) -> Dict[str, Any]:
        """Get retrieval service statistics"""
        # Try to load indices if not already loaded
        if not self.indices_loaded:
            self.ensure_indices_loaded()
        
        real_vectors = 0
        statute_indices = {}
        
        # Check general index
        general_vectors = self.vector_store.index.ntotal if self.vector_store.index else 0
        real_vectors += general_vectors
        
        # Check statute indices
        for statute, store in self.statute_indices.items():
            count = store.index.ntotal if store.index else 0
            statute_indices[statute] = {
                "vectors": count,
                "dimension": store.dimension
            }
            real_vectors += count
        
        # Determine corpus state - BINARY: Either real or nothing
        has_real_corpus = real_vectors > 20  # Minimal threshold for real corpus
        
        return {
            "indices_loaded": self.indices_loaded,
            "has_real_corpus": has_real_corpus,  # CRITICAL: Binary truth
            "statute_indices": statute_indices,
            "general_index": {
                "vectors": general_vectors,
                "dimension": self.vector_store.dimension if self.vector_store.index else 0
            },
            "total_vectors": real_vectors,
            "corpus_state": "READY" if has_real_corpus else "EMPTY"  # No intermediate states
        }


# ===========================================================================
# FIX 5: INVARIANT DOCUMENTATION
# ===========================================================================
"""
DOCTRINE BLOCKING VS ENFORCEMENT INVARIANT
===========================================

Two separate concepts must never be confused:

1. DOCTRINE BLOCKING (hard, mandatory)
   - Prevents ALL retrieval for pure doctrinal questions
   - Returns constitutional hierarchy metadata
   - Guarantees zero vector search, zero TF-IDF
   - APPLIES WHEN: question_type in DOCTRINAL_QUESTION_TYPES AND no specific paragraphs mentioned

2. DOCTRINE ENFORCEMENT (optional, enhancing)
   - Applies doctrine reasoning to retrieved norms
   - Enhances results with doctrinal analysis
   - Service may be unavailable (not an error)
   - APPLIES WHEN: strict_mode OR authority_constraints.requiresDoctrine

INVARIANT: 
If doctrine blocking is active → doctrine enforcement MUST NOT run.
Blocking takes absolute precedence.

EXAMPLES:
- "Was besagt das Schuldprinzip?" → BLOCKING ONLY (no retrieval)
- "Schuldprinzip und § 46 StGB" → RETRIEVAL + optional enforcement
- "§ 46 StGB" → RETRIEVAL + optional enforcement if configured
"""

# Singleton instance
retrieval_service = RetrievalService()
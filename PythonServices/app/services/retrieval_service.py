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
        paragraph_patterns = [
            f"§{paragraph}",
            f"§ {paragraph}",
            f"§{paragraph} ",
            f"paragraph {paragraph}",
            f"art.{paragraph}"  # For articles
        ]
        
        for pattern in paragraph_patterns:
            if pattern in response_text:
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
        """Create FAISS index"""
        self.dimension = dimension
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
        self.index.add(vectors_f32)
        
        # Store metadata
        for i, metadata in enumerate(metadatas):
            vector_id = start_id + i
            self.ids.append(vector_id)
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
                    "document_id": metadata.get("document_id", ""),
                    "is_normative": metadata.get("is_normative", False)
                })
        
        return results
    
    def save(self, index_name: str):
        """Save FAISS index"""
        save_path = os.path.join(self.indices_dir, f"{index_name}.faiss")
        metadata_path = os.path.join(self.indices_dir, f"{index_name}_meta.pkl")
        
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
    
    def load(self, index_name: str):
        """Load FAISS index"""
        save_path = os.path.join(self.indices_dir, f"{index_name}.faiss")
        metadata_path = os.path.join(self.indices_dir, f"{index_name}_meta.pkl")
        
        if os.path.exists(save_path) and os.path.exists(metadata_path):
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
        return False

class RetrievalService:
    """Main retrieval service with multiple backend support"""
    
    def __init__(self, vector_store_type: str = "faiss"):
        self.vector_store_type = vector_store_type
        self.vector_store = self._create_vector_store(vector_store_type)
        self.statute_indices = {}  # Separate indices per statute
        self.validator = StatuteFirstValidator()
        
        logger.info(f"RetrievalService initialized with {vector_store_type}")
    
    def _create_vector_store(self, store_type: str) -> VectorStore:
        """Create vector store instance"""
        if store_type == "faiss":
            return FAISSStore()
        elif store_type == "chroma":
            # ChromaDB implementation
            raise NotImplementedError("ChromaDB not implemented yet")
        elif store_type == "qdrant":
            # If you need Qdrant, install: pip install qdrant-client
            # Then uncomment and fix these imports:
            # from qdrant_client import QdrantClient
            # from qdrant_client.models import Distance, VectorParams
            raise NotImplementedError("Qdrant not implemented yet. Install qdrant-client package.")
        else:
            raise ValueError(f"Unknown vector store type: {store_type}")
    
    def index_documents(self, documents: List[Dict], statute: Optional[str] = None, 
                       embeddings: Optional[np.ndarray] = None):
        """
        Index documents with embeddings - STATUTE-FIRST VERSION
        """
        if not documents:
            return
        
        # PARAGRAPH EXTRACTION FOR STATUTES
        if statute and statute.upper() in ["STGB", "BGB"]:
            # Extract structured norms from statute text
            all_norms = []
            for doc in documents:
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
                documents = all_norms
                logger.info(f"Extracted {len(all_norms)} legal norms from {statute}")
        
        # Prepare metadata - NOW WITH PARAGRAPH IDENTITY
        metadatas = []
        for doc in documents:
            # Check if this is already a structured norm
            paragraph = doc.get("paragraph", "")
            
            metadata = {
                "content": doc.get("content", ""),
                "document_id": doc.get("id", ""),
                "filename": doc.get("filename", ""),
                "statute": statute or doc.get("statute", ""),
                # CRITICAL: Store paragraph identity
                "paragraph": paragraph,
                # Determine if this is a true legal norm
                "is_normative": doc.get("is_normative", bool(paragraph)),
                "norm_type": doc.get("norm_type", ""),
                "authority_level": doc.get("authority_level", "unknown"),
                "chunk_index": doc.get("chunk_index", 0),
                "page": doc.get("page", 0),
                # FIX: Use correct paragraph symbol
                "has_paragraph": "§" in doc.get("content", "") or bool(paragraph),
                "has_article": "Artikel" in doc.get("content", "") or 
                              "article" in doc.get("content", "").lower(),
                "timestamp": datetime.now().isoformat()
            }
            metadatas.append(metadata)
        
        # Use provided embeddings or generate them
        if embeddings is None:
            from app.services.embedding_service import embedding_service
            texts = [doc.get("content", "") for doc in documents]
            embeddings = np.array(embedding_service.embed_batch(texts))
        
        # Index by statute if specified
        if statute and statute not in self.statute_indices:
            self.statute_indices[statute] = self._create_vector_store(self.vector_store_type)
            self.statute_indices[statute].create_index(embeddings.shape[1])
        
        if statute:
            self.statute_indices[statute].add_vectors(embeddings, metadatas)
            logger.info(f"Indexed {len(documents)} normative documents for statute {statute}")
        else:
            self.vector_store.add_vectors(embeddings, metadatas)
            logger.info(f"Indexed {len(documents)} documents in general index")
    
    def search_by_paragraph(self, statute: str, paragraph: str, 
                           query_embedding: Optional[np.ndarray] = None,
                           k: int = 5) -> List[Dict]:
        """
        Statute-First search: Find specific paragraph with authority guarantee
        """
        if statute not in self.statute_indices:
            logger.warning(f"No index found for statute: {statute}")
            return []
        
        # First: Try exact paragraph match (AUTHORITY SEARCH)
        all_metadata = list(self.statute_indices[statute].metadata.values())
        exact_matches = []
        
        for meta in all_metadata:
            if meta.get("paragraph") == paragraph and meta.get("statute") == statute:
                # This is the authoritative norm
                exact_matches.append({
                    "id": -1,  # Special ID for authority match
                    "score": 1.0,  # Maximum confidence
                    "metadata": meta,
                    "content": meta.get("content", ""),
                    "statute": statute,
                    "paragraph": paragraph,
                    "document_id": meta.get("document_id", ""),
                    "is_authoritative": True,
                    "match_type": "exact_paragraph",
                    "legal_relevance": 1.0
                })
        
        if exact_matches:
            logger.info(f"Found authoritative match for {statute} §{paragraph}")
            return exact_matches[:k]
        
        # Second: Fall back to semantic search if no exact match
        if query_embedding is not None:
            semantic_results = self.statute_indices[statute].search(query_embedding, k)
            
            # Enhance results with paragraph awareness
            for result in semantic_results:
                result["is_authoritative"] = False
                result["match_type"] = "semantic"
                result["legal_relevance"] = self._calculate_legal_relevance(result)
                
                # Check if result contains the requested paragraph
                content = result.get("content", "")
                if f"§{paragraph}" in content or f"§ {paragraph}" in content:
                    result["is_authoritative"] = True
                    result["match_type"] = "paragraph_in_content"
                    result["score"] = max(result["score"], 0.9)  # Boost
                    result["legal_relevance"] = min(result["legal_relevance"] * 1.3, 1.0)
            
            return semantic_results[:k]
        
        return []
    
    def search_with_validation(self, query: str, statute: str, paragraph: str, 
                              k: int = 10) -> Dict:
        """
        Complete Statute-First search with validation
        """
        from app.services.embedding_service import embedding_service
        
        # Get query embedding
        query_embedding = np.array(embedding_service.embed(query))
        
        # Search by paragraph first
        paragraph_results = self.search_by_paragraph(statute, paragraph, query_embedding, k)
        
        # If no paragraph results, fall back to general search
        if not paragraph_results:
            general_results = self.search(query_embedding, statute, k)
            paragraph_results = general_results
        
        # Validate results
        validation_results = []
        
        for result in paragraph_results:
            content = result.get("content", "")
            validation = self.validator.validate_response(content, statute, paragraph)
            result["validation"] = validation
            validation_results.append(validation)
        
        # Determine overall validation
        overall_validation = {
            "statute": statute,
            "paragraph": paragraph,
            "total_results": len(paragraph_results),
            "authoritative_results": sum(1 for r in paragraph_results 
                                       if r.get("is_authoritative", False)),
            "validation_summary": {
                "valid_count": sum(1 for v in validation_results if v["is_valid"]),
                "avg_security_score": np.mean([v["security_score"] for v in validation_results]) 
                                   if validation_results else 0
            }
        }
        
        return {
            "results": paragraph_results[:k],
            "validation": overall_validation,
            "query_info": {
                "statute": statute,
                "paragraph": paragraph,
                "query": query
            }
        }
    
    def search(self, query_embedding: np.ndarray, statute: Optional[str] = None,
               k: int = 10, filters: Optional[Dict] = None) -> List[Dict]:
        """
        Search for similar documents
        """
        results = []
        
        # Search in statute-specific index if available
        if statute and statute in self.statute_indices:
            statute_results = self.statute_indices[statute].search(query_embedding, k, filters)
            results.extend(statute_results)
            logger.debug(f"Found {len(statute_results)} results in statute index {statute}")
        
        # Also search in general index
        general_results = self.vector_store.search(query_embedding, k, filters)
        
        # Filter out duplicates
        seen_ids = set(r["id"] for r in results)
        for result in general_results:
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
        
        # Enhance results with legal relevance scoring
        for result in results:
            result["legal_relevance"] = self._calculate_legal_relevance(result)
            result["is_authoritative"] = result.get("is_authoritative", False)
            result["match_type"] = result.get("match_type", "semantic")
        
        return results
    
    def _calculate_legal_relevance(self, result: Dict) -> float:
        """Calculate legal relevance score"""
        score = result["score"]
        metadata = result["metadata"]
        
        # CRITICAL FIX: Use boolean paragraph presence, not similarity
        is_normative = metadata.get("is_normative", False)
        has_paragraph = metadata.get("has_paragraph", False)
        
        if is_normative:
            score *= 1.5  # Major boost for actual norms
        elif has_paragraph:
            score *= 1.2  # Moderate boost for paragraph citations
        
        # Boost for statute match
        if metadata.get("statute"):
            score *= 1.05
        
        # Penalize very short content
        content = metadata.get("content", "")
        if len(content.split()) < 10:
            score *= 0.8
        
        return min(score, 1.0)  # Cap at 1.0
    
    def save_indices(self, base_name: str = "legal_index"):
        """Save all indices to disk"""
        # Save general index
        self.vector_store.save(base_name)
        
        # Save statute indices
        for statute, index in self.statute_indices.items():
            index.save(f"{base_name}_{statute}")
        
        logger.info(f"Saved indices with base name: {base_name}")
    
    def load_indices(self, base_name: str = "legal_index") -> bool:
        """Load indices from disk"""
        success = self.vector_store.load(base_name)
        
        # Try to load statute indices
        statute_files = [f for f in os.listdir(self.vector_store.indices_dir) 
                        if f.startswith(f"{base_name}_") and f.endswith(".faiss")]
        
        for file in statute_files:
            statute = file.replace(f"{base_name}_", "").replace(".faiss", "")
            if statute:
                store = self._create_vector_store(self.vector_store_type)
                if store.load(f"{base_name}_{statute}"):
                    self.statute_indices[statute] = store
        
        logger.info(f"Loaded {len(self.statute_indices)} statute indices")
        return success

# Singleton instance
retrieval_service = RetrievalService()
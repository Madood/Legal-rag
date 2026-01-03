import numpy as np
import faiss
import chromadb
from qdrant_client import QdrantClient
from qdrant_client.models import Distance, VectorParams
import pickle
import os
from typing import List, Dict, Any, Optional, Tuple
import logging
from datetime import datetime

logger = logging.getLogger(__name__)

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
                    "document_id": metadata.get("document_id", "")
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
        
        logger.info(f"RetrievalService initialized with {vector_store_type}")
    
    def _create_vector_store(self, store_type: str) -> VectorStore:
        """Create vector store instance"""
        if store_type == "faiss":
            return FAISSStore()
        elif store_type == "chroma":
            # ChromaDB implementation
            raise NotImplementedError("ChromaDB not implemented yet")
        elif store_type == "qdrant":
            # Qdrant implementation
            raise NotImplementedError("Qdrant not implemented yet")
        else:
            raise ValueError(f"Unknown vector store type: {store_type}")
    
    def index_documents(self, documents: List[Dict], statute: Optional[str] = None, 
                       embeddings: Optional[np.ndarray] = None):
        """
        Index documents with embeddings
        """
        if not documents:
            return
        
        # Prepare metadata
        metadatas = []
        for doc in documents:
            metadata = {
                "content": doc.get("content", ""),
                "document_id": doc.get("id", ""),
                "filename": doc.get("filename", ""),
                "statute": statute or doc.get("statute", ""),
                "chunk_index": doc.get("chunk_index", 0),
                "page": doc.get("page", 0),
                "has_paragraph": "$" in doc.get("content", ""),
                "has_article": "artikel" in doc.get("content", "").lower() or 
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
            logger.info(f"Indexed {len(documents)} documents for statute {statute}")
        else:
            self.vector_store.add_vectors(embeddings, metadatas)
            logger.info(f"Indexed {len(documents)} documents in general index")
    
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
        
        return results
    
    def _calculate_legal_relevance(self, result: Dict) -> float:
        """Calculate legal relevance score"""
        score = result["score"]
        metadata = result["metadata"]
        
        # Boost for legal citations
        if metadata.get("has_paragraph", False):
            score *= 1.2
        if metadata.get("has_article", False):
            score *= 1.1
        
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
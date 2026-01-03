"""
Complete vector store implementations for FAISS, ChromaDB, and Qdrant.
"""

import numpy as np
import faiss
import chromadb
from chromadb.config import Settings
from qdrant_client import QdrantClient
from qdrant_client.models import Distance, VectorParams, PointStruct, Filter, FieldCondition, MatchValue
import pickle
import os
import json
from typing import List, Dict, Any, Optional, Tuple, Union
import logging
from datetime import datetime
from dataclasses import dataclass, asdict
from enum import Enum

logger = logging.getLogger(__name__)

class VectorStoreType(Enum):
    FAISS = "faiss"
    CHROMA = "chroma"
    QDRANT = "qdrant"

@dataclass
class SearchResult:
    id: str
    score: float
    content: str
    metadata: Dict[str, Any]
    vector: Optional[np.ndarray] = None

class BaseVectorStore:
    """Base interface for all vector stores"""
    
    def __init__(self, collection_name: str = "legal_documents", dimension: int = 768):
        self.collection_name = collection_name
        self.dimension = dimension
        self.index_path = os.getenv("INDICES_DIR", "./data/indices")
        os.makedirs(self.index_path, exist_ok=True)
        
    def create_collection(self, dimension: Optional[int] = None):
        """Create a new collection/index"""
        raise NotImplementedError
    
    def add_documents(self, documents: List[Dict], embeddings: np.ndarray):
        """Add documents with embeddings to the store"""
        raise NotImplementedError
    
    def search(self, query_embedding: np.ndarray, k: int = 10, 
               filter_dict: Optional[Dict] = None) -> List[SearchResult]:
        """Search for similar documents"""
        raise NotImplementedError
    
    def delete_collection(self):
        """Delete the collection"""
        raise NotImplementedError
    
    def get_stats(self) -> Dict[str, Any]:
        """Get collection statistics"""
        raise NotImplementedError
    
    def save(self, path: Optional[str] = None):
        """Save the index to disk"""
        raise NotImplementedError
    
    def load(self, path: Optional[str] = None) -> bool:
        """Load the index from disk"""
        raise NotImplementedError

class FAISSStore(BaseVectorStore):
    """FAISS vector store implementation"""
    
    def __init__(self, collection_name: str = "legal_documents", dimension: int = 768):
        super().__init__(collection_name, dimension)
        self.index = None
        self.id_to_metadata = {}
        self.id_to_content = {}
        self.next_id = 0
        
    def create_collection(self, dimension: Optional[int] = None):
        """Create FAISS index"""
        self.dimension = dimension or self.dimension
        self.index = faiss.IndexFlatIP(self.dimension)  # Inner product for cosine similarity
        self.id_to_metadata.clear()
        self.id_to_content.clear()
        self.next_id = 0
        logger.info(f"Created FAISS index '{self.collection_name}' with dimension {self.dimension}")
    
    def add_documents(self, documents: List[Dict], embeddings: np.ndarray):
        """Add documents to FAISS index"""
        if self.index is None:
            self.create_collection(embeddings.shape[1])
        
        # Convert embeddings to float32
        embeddings_f32 = embeddings.astype('float32')
        
        # Add to index
        start_id = self.next_id
        self.index.add(embeddings_f32)
        
        # Store metadata and content
        for i, (doc, embedding) in enumerate(zip(documents, embeddings)):
            doc_id = start_id + i
            self.id_to_metadata[doc_id] = doc.get("metadata", {})
            self.id_to_content[doc_id] = doc.get("content", "")
            # Add embedding to metadata for potential reuse
            self.id_to_metadata[doc_id]["_embedding"] = embedding.tolist()
        
        self.next_id += len(documents)
        logger.info(f"Added {len(documents)} documents to FAISS index '{self.collection_name}'")
    
    def search(self, query_embedding: np.ndarray, k: int = 10, 
               filter_dict: Optional[Dict] = None) -> List[SearchResult]:
        """Search in FAISS index"""
        if self.index is None or self.index.ntotal == 0:
            return []
        
        # Convert query to float32
        query_f32 = query_embedding.astype('float32').reshape(1, -1)
        
        # Adjust k based on available documents
        k = min(k, self.index.ntotal)
        
        # Search
        distances, indices = self.index.search(query_f32, k)
        
        results = []
        for score, idx in zip(distances[0], indices[0]):
            if idx >= 0 and idx in self.id_to_content:
                metadata = self.id_to_metadata[idx].copy()
                # Remove embedding from metadata in results
                metadata.pop("_embedding", None)
                
                result = SearchResult(
                    id=str(idx),
                    score=float(score),
                    content=self.id_to_content[idx],
                    metadata=metadata
                )
                
                # Apply filtering if specified
                if filter_dict and not self._matches_filter(metadata, filter_dict):
                    continue
                
                results.append(result)
        
        return results
    
    def _matches_filter(self, metadata: Dict, filter_dict: Dict) -> bool:
        """Check if metadata matches filter criteria"""
        for key, value in filter_dict.items():
            if key not in metadata or metadata[key] != value:
                return False
        return True
    
    def delete_collection(self):
        """Delete FAISS index"""
        self.index = None
        self.id_to_metadata.clear()
        self.id_to_content.clear()
        self.next_id = 0
        logger.info(f"Deleted FAISS index '{self.collection_name}'")
    
    def get_stats(self) -> Dict[str, Any]:
        """Get FAISS index statistics"""
        if self.index is None:
            return {"status": "not_initialized", "count": 0}
        
        return {
            "type": "faiss",
            "collection": self.collection_name,
            "dimension": self.dimension,
            "count": self.index.ntotal,
            "is_trained": self.index.is_trained,
            "metric_type": "inner_product"
        }
    
    def save(self, path: Optional[str] = None):
        """Save FAISS index to disk"""
        if self.index is None:
            return
        
        save_dir = path or os.path.join(self.index_path, self.collection_name)
        os.makedirs(save_dir, exist_ok=True)
        
        # Save FAISS index
        faiss_path = os.path.join(save_dir, "index.faiss")
        faiss.write_index(self.index, faiss_path)
        
        # Save metadata
        metadata_path = os.path.join(save_dir, "metadata.pkl")
        with open(metadata_path, 'wb') as f:
            pickle.dump({
                "id_to_metadata": self.id_to_metadata,
                "id_to_content": self.id_to_content,
                "next_id": self.next_id,
                "dimension": self.dimension
            }, f)
        
        logger.info(f"Saved FAISS index to {save_dir}")
        return save_dir
    
    def load(self, path: Optional[str] = None) -> bool:
        """Load FAISS index from disk"""
        load_dir = path or os.path.join(self.index_path, self.collection_name)
        faiss_path = os.path.join(load_dir, "index.faiss")
        metadata_path = os.path.join(load_dir, "metadata.pkl")
        
        if not os.path.exists(faiss_path) or not os.path.exists(metadata_path):
            logger.warning(f"FAISS index files not found at {load_dir}")
            return False
        
        try:
            # Load FAISS index
            self.index = faiss.read_index(faiss_path)
            
            # Load metadata
            with open(metadata_path, 'rb') as f:
                data = pickle.load(f)
                self.id_to_metadata = data["id_to_metadata"]
                self.id_to_content = data["id_to_content"]
                self.next_id = data["next_id"]
                self.dimension = data["dimension"]
            
            logger.info(f"Loaded FAISS index from {load_dir} with {self.index.ntotal} vectors")
            return True
        except Exception as e:
            logger.error(f"Error loading FAISS index: {e}")
            return False

class ChromaStore(BaseVectorStore):
    """ChromaDB vector store implementation"""
    
    def __init__(self, collection_name: str = "legal_documents", dimension: int = 768):
        super().__init__(collection_name, dimension)
        self.client = None
        self.collection = None
        self._initialize_client()
    
    def _initialize_client(self):
        """Initialize ChromaDB client"""
        try:
            # Use persistent storage
            persist_directory = os.path.join(self.index_path, "chroma")
            os.makedirs(persist_directory, exist_ok=True)
            
            self.client = chromadb.Client(Settings(
                chroma_db_impl="duckdb+parquet",
                persist_directory=persist_directory
            ))
            
            logger.info(f"Initialized ChromaDB client at {persist_directory}")
        except Exception as e:
            logger.error(f"Failed to initialize ChromaDB: {e}")
            raise
    
    def create_collection(self, dimension: Optional[int] = None):
        """Create ChromaDB collection"""
        if dimension:
            self.dimension = dimension
        
        try:
            # Delete existing collection if it exists
            try:
                self.client.delete_collection(self.collection_name)
            except:
                pass
            
            # Create new collection
            self.collection = self.client.create_collection(
                name=self.collection_name,
                metadata={"hnsw:space": "cosine", "dimension": self.dimension}
            )
            
            logger.info(f"Created ChromaDB collection '{self.collection_name}'")
        except Exception as e:
            logger.error(f"Error creating ChromaDB collection: {e}")
            raise
    
    def add_documents(self, documents: List[Dict], embeddings: np.ndarray):
        """Add documents to ChromaDB"""
        if self.collection is None:
            self.create_collection(embeddings.shape[1])
        
        ids = []
        metadatas = []
        contents = []
        
        for i, (doc, embedding) in enumerate(zip(documents, embeddings)):
            doc_id = f"{self.collection_name}_{self.collection.count() + i}"
            ids.append(doc_id)
            
            metadata = doc.get("metadata", {}).copy()
            metadata["document_id"] = doc.get("id", "")
            metadata["statute"] = doc.get("statute", "")
            metadata["chunk_index"] = doc.get("chunk_index", i)
            metadata["timestamp"] = datetime.now().isoformat()
            
            metadatas.append(metadata)
            contents.append(doc.get("content", ""))
        
        # Add to collection
        self.collection.add(
            ids=ids,
            embeddings=embeddings.tolist(),
            metadatas=metadatas,
            documents=contents
        )
        
        logger.info(f"Added {len(documents)} documents to ChromaDB")
    
    def search(self, query_embedding: np.ndarray, k: int = 10, 
               filter_dict: Optional[Dict] = None) -> List[SearchResult]:
        """Search in ChromaDB"""
        if self.collection is None:
            return []
        
        # Prepare where filter
        where = None
        if filter_dict:
            where = {}
            for key, value in filter_dict.items():
                if isinstance(value, (list, tuple)):
                    where[key] = {"$in": list(value)}
                else:
                    where[key] = value
        
        # Search
        results = self.collection.query(
            query_embeddings=[query_embedding.tolist()],
            n_results=min(k, self.collection.count()),
            where=where,
            include=["metadatas", "documents", "distances"]
        )
        
        search_results = []
        if results["ids"] and results["ids"][0]:
            for i, (doc_id, distance, content, metadata) in enumerate(zip(
                results["ids"][0],
                results["distances"][0],
                results["documents"][0],
                results["metadatas"][0]
            )):
                # Convert distance to similarity score
                score = 1.0 - distance  # ChromaDB returns distance, convert to similarity
                
                result = SearchResult(
                    id=doc_id,
                    score=float(score),
                    content=content,
                    metadata=metadata or {}
                )
                search_results.append(result)
        
        return search_results
    
    def delete_collection(self):
        """Delete ChromaDB collection"""
        try:
            self.client.delete_collection(self.collection_name)
            self.collection = None
            logger.info(f"Deleted ChromaDB collection '{self.collection_name}'")
        except Exception as e:
            logger.error(f"Error deleting ChromaDB collection: {e}")
    
    def get_stats(self) -> Dict[str, Any]:
        """Get ChromaDB collection statistics"""
        if self.collection is None:
            return {"status": "not_initialized", "count": 0}
        
        try:
            count = self.collection.count()
            return {
                "type": "chroma",
                "collection": self.collection_name,
                "count": count,
                "persist_directory": self.client._settings.persist_directory
            }
        except:
            return {"status": "error", "count": 0}
    
    def save(self, path: Optional[str] = None):
        """ChromaDB auto-persists"""
        if self.client:
            self.client.persist()
            logger.info("Persisted ChromaDB to disk")
        return self.client._settings.persist_directory if self.client else None
    
    def load(self, path: Optional[str] = None) -> bool:
        """Load ChromaDB collection"""
        try:
            self.collection = self.client.get_collection(self.collection_name)
            logger.info(f"Loaded ChromaDB collection '{self.collection_name}' with {self.collection.count()} documents")
            return True
        except Exception as e:
            logger.warning(f"ChromaDB collection not found, will create new: {e}")
            return False

class QdrantStore(BaseVectorStore):
    """Qdrant vector store implementation"""
    
    def __init__(self, collection_name: str = "legal_documents", dimension: int = 768):
        super().__init__(collection_name, dimension)
        self.client = None
        self._initialize_client()
    
    def _initialize_client(self):
        """Initialize Qdrant client"""
        try:
            host = os.getenv("QDRANT_HOST", "localhost")
            port = int(os.getenv("QDRANT_PORT", "6333"))
            
            # Try to connect to existing Qdrant instance
            self.client = QdrantClient(host=host, port=port)
            
            # Test connection
            self.client.get_collections()
            logger.info(f"Connected to Qdrant at {host}:{port}")
        except Exception as e:
            logger.warning(f"Could not connect to Qdrant, using in-memory: {e}")
            # Fallback to in-memory
            self.client = QdrantClient(":memory:")
    
    def create_collection(self, dimension: Optional[int] = None):
        """Create Qdrant collection"""
        if dimension:
            self.dimension = dimension
        
        try:
            # Delete existing collection if it exists
            try:
                self.client.delete_collection(self.collection_name)
            except:
                pass
            
            # Create new collection
            self.client.create_collection(
                collection_name=self.collection_name,
                vectors_config=VectorParams(
                    size=self.dimension,
                    distance=Distance.COSINE
                )
            )
            
            logger.info(f"Created Qdrant collection '{self.collection_name}'")
        except Exception as e:
            logger.error(f"Error creating Qdrant collection: {e}")
            raise
    
    def add_documents(self, documents: List[Dict], embeddings: np.ndarray):
        """Add documents to Qdrant"""
        if len(documents) != len(embeddings):
            raise ValueError("Documents and embeddings must have same length")
        
        points = []
        for i, (doc, embedding) in enumerate(zip(documents, embeddings)):
            point_id = self.collection.count() + i if hasattr(self, 'collection') else i
            
            metadata = doc.get("metadata", {}).copy()
            metadata.update({
                "document_id": doc.get("id", ""),
                "filename": doc.get("filename", ""),
                "statute": doc.get("statute", ""),
                "chunk_index": doc.get("chunk_index", i),
                "content_preview": doc.get("content", "")[:200],
                "has_paragraph": "$" in doc.get("content", ""),
                "has_article": any(term in doc.get("content", "").lower() 
                                  for term in ["artikel", "article"]),
                "timestamp": datetime.now().isoformat()
            })
            
            point = PointStruct(
                id=point_id,
                vector=embedding.tolist(),
                payload=metadata
            )
            points.append(point)
        
        # Upload points
        self.client.upsert(
            collection_name=self.collection_name,
            points=points
        )
        
        logger.info(f"Added {len(documents)} documents to Qdrant")
    
    def search(self, query_embedding: np.ndarray, k: int = 10, 
               filter_dict: Optional[Dict] = None) -> List[SearchResult]:
        """Search in Qdrant"""
        # Build filter
        filter_condition = None
        if filter_dict:
            must_conditions = []
            for key, value in filter_dict.items():
                if isinstance(value, (list, tuple)):
                    must_conditions.append(
                        FieldCondition(key=key, match=MatchValue(any=value))
                    )
                else:
                    must_conditions.append(
                        FieldCondition(key=key, match=MatchValue(value=value))
                    )
            filter_condition = Filter(must=must_conditions)
        
        # Search
        search_result = self.client.search(
            collection_name=self.collection_name,
            query_vector=query_embedding.tolist(),
            query_filter=filter_condition,
            limit=k
        )
        
        results = []
        for hit in search_result:
            metadata = hit.payload.copy()
            content = metadata.pop("content_preview", "")
            
            result = SearchResult(
                id=str(hit.id),
                score=float(hit.score),
                content=content,
                metadata=metadata
            )
            results.append(result)
        
        return results
    
    def delete_collection(self):
        """Delete Qdrant collection"""
        try:
            self.client.delete_collection(self.collection_name)
            logger.info(f"Deleted Qdrant collection '{self.collection_name}'")
        except Exception as e:
            logger.error(f"Error deleting Qdrant collection: {e}")
    
    def get_stats(self) -> Dict[str, Any]:
        """Get Qdrant collection statistics"""
        try:
            collection_info = self.client.get_collection(self.collection_name)
            return {
                "type": "qdrant",
                "collection": self.collection_name,
                "count": collection_info.points_count,
                "status": collection_info.status,
                "vectors_config": str(collection_info.config.params.vectors)
            }
        except Exception as e:
            return {"status": "not_initialized", "error": str(e)}
    
    def save(self, path: Optional[str] = None):
        """Qdrant handles persistence automatically"""
        logger.info("Qdrant persistence is automatic")
        return "qdrant_persisted"
    
    def load(self, path: Optional[str] = None) -> bool:
        """Check if Qdrant collection exists"""
        try:
            collections = self.client.get_collections()
            for collection in collections.collections:
                if collection.name == self.collection_name:
                    logger.info(f"Qdrant collection '{self.collection_name}' exists")
                    return True
            return False
        except Exception as e:
            logger.error(f"Error checking Qdrant collection: {e}")
            return False

class VectorStoreFactory:
    """Factory for creating vector stores"""
    
    @staticmethod
    def create_store(store_type: Union[str, VectorStoreType], 
                    collection_name: str = "legal_documents",
                    dimension: int = 768) -> BaseVectorStore:
        """Create a vector store instance"""
        if isinstance(store_type, str):
            store_type = VectorStoreType(store_type.lower())
        
        if store_type == VectorStoreType.FAISS:
            return FAISSStore(collection_name, dimension)
        elif store_type == VectorStoreType.CHROMA:
            return ChromaStore(collection_name, dimension)
        elif store_type == VectorStoreType.QDRANT:
            return QdrantStore(collection_name, dimension)
        else:
            raise ValueError(f"Unknown vector store type: {store_type}")
    
    @staticmethod
    def get_available_stores() -> List[str]:
        """Get list of available vector store types"""
        return [store.value for store in VectorStoreType]

# Convenience function for creating default store
def create_default_store(collection_name: str = "legal_documents") -> BaseVectorStore:
    """Create default vector store based on environment"""
    store_type = os.getenv("VECTOR_STORE_TYPE", "faiss").lower()
    dimension = int(os.getenv("EMBEDDING_DIMENSION", "768"))
    
    return VectorStoreFactory.create_store(
        store_type=store_type,
        collection_name=collection_name,
        dimension=dimension
    )

# Export commonly used classes
__all__ = [
    "VectorStoreType",
    "BaseVectorStore",
    "FAISSStore",
    "ChromaStore",
    "QdrantStore",
    "VectorStoreFactory",
    "create_default_store",
    "SearchResult"
]
"""
Complete vector store implementations with mandatory legal boundaries.
Prevents cross-document mixing through strict scope enforcement.
"""

import numpy as np
import faiss
import os

# Optional backends — imported lazily to avoid hard startup failures
try:
    import chromadb
    from chromadb.config import Settings as ChromaSettings
except ImportError:
    chromadb = None  # type: ignore
    ChromaSettings = None  # type: ignore

try:
    from qdrant_client import QdrantClient
    from qdrant_client.models import Distance, VectorParams, PointStruct, Filter, FieldCondition, MatchValue
except ImportError:
    QdrantClient = None  # type: ignore
import json
import hashlib
from typing import List, Dict, Any, Optional, Tuple, Union
import logging
from datetime import datetime
from dataclasses import dataclass, asdict
from enum import Enum
import uuid
import warnings

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
    
    @property
    def statute(self) -> str:
        return self.metadata.get("statute", "")
    
    @property
    def domain(self) -> str:
        return self.metadata.get("domain", "")
    
    @property
    def paragraph(self) -> str:
        return self.metadata.get("paragraph", "")
    
    @property
    def is_cross_boundary(self) -> bool:
        """Check if result crosses legal boundaries"""
        statute = self.metadata.get("statute")
        domain = self.metadata.get("domain")
        return not statute or not domain

class LegalVectorStore:
    """Base interface for legal vector stores with mandatory boundaries"""
    
    def __init__(self, statute: str, domain: str, store_type: Union[str, VectorStoreType], 
                 jurisdiction: str = "DE", dimension: int = 768):
        """
        Initialize legal vector store with mandatory boundaries
        
        Args:
            statute: Legal statute (e.g., "BGB", "StGB") - REQUIRED
            domain: Legal domain (e.g., "divorce", "criminal") - REQUIRED
            store_type: Vector store type
            jurisdiction: Legal jurisdiction
            dimension: Embedding dimension
        """
        if not statute or not domain:
            raise ValueError("Legal vector store requires statute and domain")
        
        self.statute = statute.upper()
        self.domain = domain.lower()
        self.jurisdiction = jurisdiction.upper()
        self.dimension = dimension
        
        # Collection name includes statute and domain for isolation
        self.collection_name = f"{self.statute}_{self.domain}_{self.jurisdiction}"
        
        self.store_type = store_type if isinstance(store_type, VectorStoreType) else VectorStoreType(store_type.lower())
        self.store = self._create_store()
        
        logger.info(f"Initialized {self.store_type.value} store for {self.collection_name}")
    
    def _create_store(self) -> 'BaseVectorStore':
        """Create underlying vector store"""
        if self.store_type == VectorStoreType.FAISS:
            return FAISSStore(self.collection_name, self.dimension)
        elif self.store_type == VectorStoreType.CHROMA:
            return ChromaStore(self.collection_name, self.dimension)
        elif self.store_type == VectorStoreType.QDRANT:
            return QdrantStore(self.collection_name, self.dimension)
        else:
            raise ValueError(f"Unknown store type: {self.store_type}")
    
    def add_documents(self, documents: List[Dict], embeddings: np.ndarray):
        """Add documents with legal metadata enforcement"""
        # Validate all documents belong to this statute/domain
        for i, doc in enumerate(documents):
            metadata = doc.get("metadata", {})
            
            # Enforce statute and domain in metadata
            metadata["statute"] = self.statute
            metadata["domain"] = self.domain
            metadata["jurisdiction"] = self.jurisdiction
            metadata["store_boundary"] = self.collection_name
            
            # Ensure paragraph field exists (even if empty)
            if "paragraph" not in metadata:
                metadata["paragraph"] = ""
                metadata["paragraph_normalized"] = ""
            
            # Add unique legal ID with paragraph if available
            paragraph_part = f"::para{metadata['paragraph']}" if metadata.get('paragraph') else ""
            if "legal_id" not in metadata:
                metadata["legal_id"] = f"{self.statute}::{self.domain}{paragraph_part}::{uuid.uuid4().hex[:8]}"
            
            doc["metadata"] = metadata
        
        # Add to underlying store
        self.store.add_documents(documents, embeddings)
    
    def search(self, query_embedding: np.ndarray, k: int = 10, 
               filter_dict: Optional[Dict] = None, 
               enforce_boundaries: bool = True) -> List[SearchResult]:
        """
        Search within legal boundaries
        
        Args:
            query_embedding: Query embedding (should be conditioned with legal context)
            k: Number of results
            filter_dict: Optional filters including paragraph
            enforce_boundaries: If True, ensures results stay within statute/domain
        """
        # Create mandatory filter for legal boundaries
        boundary_filter = {
            "statute": self.statute,
            "domain": self.domain,
            "jurisdiction": self.jurisdiction
        }
        
        # Merge with provided filters (user filters override boundaries if needed)
        combined_filter = boundary_filter.copy()
        if filter_dict:
            combined_filter.update(filter_dict)
        
        # Search with hard filter
        results = self.store.search(
            query_embedding=query_embedding,
            k=k,
            filter_dict=combined_filter
        )
        
        # Double-check boundaries (safety net)
        if enforce_boundaries:
            results = self._enforce_legal_boundaries(results)
        
        return results
    
    def _enforce_legal_boundaries(self, results: List[SearchResult]) -> List[SearchResult]:
        """Ensure all results stay within legal boundaries"""
        filtered = []
        for result in results:
            if (result.metadata.get("statute") == self.statute and 
                result.metadata.get("domain") == self.domain):
                filtered.append(result)
            else:
                logger.warning(f"Filtered cross-boundary result: {result.metadata.get('statute')}::{result.metadata.get('domain')}")
        return filtered
    
    def get_stats(self) -> Dict[str, Any]:
        """Get store statistics"""
        stats = self.store.get_stats()
        stats.update({
            "legal_boundary": self.collection_name,
            "statute": self.statute,
            "domain": self.domain,
            "jurisdiction": self.jurisdiction
        })
        return stats
    
    def save(self):
        """Save store to disk"""
        return self.store.save()
    
    def load(self) -> bool:
        """Load store from disk"""
        return self.store.load()

class BaseVectorStore:
    """Base interface for all vector stores with legal boundary support"""
    
    def __init__(self, collection_name: str, dimension: int = 768):
        self.collection_name = collection_name
        self.dimension = dimension
        self.index_path = os.getenv("INDICES_DIR", "./data/indices")
        os.makedirs(self.index_path, exist_ok=True)
        
    def create_collection(self, dimension: Optional[int] = None):
        raise NotImplementedError
    
    def add_documents(self, documents: List[Dict], embeddings: np.ndarray):
        raise NotImplementedError
    
    def search(self, query_embedding: np.ndarray, k: int = 10, 
               filter_dict: Optional[Dict] = None) -> List[SearchResult]:
        raise NotImplementedError
    
    def delete_collection(self):
        raise NotImplementedError
    
    def get_stats(self) -> Dict[str, Any]:
        raise NotImplementedError
    
    def save(self, path: Optional[str] = None):
        raise NotImplementedError
    
    def load(self, path: Optional[str] = None) -> bool:
        raise NotImplementedError

class FAISSStore(BaseVectorStore):
    """FAISS vector store with statute-isolated indexes"""
    
    def __init__(self, collection_name: str, dimension: int = 768):
        super().__init__(collection_name, dimension)
        self.index = None
        self.id_to_metadata = {}
        self.id_to_content = {}
        self.next_id = 0
        
    def _normalize_vectors(self, vectors: np.ndarray) -> np.ndarray:
        """Normalize vectors for cosine similarity"""
        vectors_f32 = vectors.astype('float32')
        faiss.normalize_L2(vectors_f32)
        return vectors_f32
    
    def create_collection(self, dimension: Optional[int] = None):
        """Create FAISS index"""
        self.dimension = dimension or self.dimension
        # Use inner product for normalized vectors = cosine similarity
        self.index = faiss.IndexFlatIP(self.dimension)
        self.id_to_metadata.clear()
        self.id_to_content.clear()
        self.next_id = 0
        logger.info(f"Created FAISS index '{self.collection_name}'")
    
    def add_documents(self, documents: List[Dict], embeddings: np.ndarray):
        """Add documents to FAISS index with legal metadata"""
        # Validate content exists
        for i, doc in enumerate(documents):
            content = doc.get("content", "").strip()
            if not content:
                raise ValueError(f"Document {i} has empty content")
            
            # Ensure legal metadata
            metadata = doc.get("metadata", {})
            if "statute" not in metadata or "domain" not in metadata:
                raise ValueError(f"Document {i} missing legal metadata")
        
        if self.index is None:
            self.create_collection(embeddings.shape[1])
        
        # Normalize embeddings before adding
        embeddings_normalized = self._normalize_vectors(embeddings)
        
        # Add to index
        start_id = self.next_id
        self.index.add(embeddings_normalized)
        
        # Store metadata and content with legal boundary check
        for i, (doc, embedding) in enumerate(zip(documents, embeddings)):
            doc_id = start_id + i
            
            # Create legal-aware ID
            metadata = doc.get("metadata", {}).copy()
            statute = metadata.get("statute", "UNKNOWN")
            domain = metadata.get("domain", "UNKNOWN")
            paragraph = metadata.get("paragraph", "")
            
            # Include paragraph in ID if available
            paragraph_part = f"_p{paragraph}" if paragraph else ""
            legal_id = f"{statute}_{domain}{paragraph_part}_{doc_id}"
            
            self.id_to_metadata[doc_id] = metadata
            self.id_to_metadata[doc_id]["legal_id"] = legal_id
            self.id_to_content[doc_id] = doc.get("content", "")
        
        self.next_id += len(documents)
        logger.info(f"Added {len(documents)} documents to FAISS index")
    
    def search(self, query_embedding: np.ndarray, k: int = 10, 
               filter_dict: Optional[Dict] = None) -> List[SearchResult]:
        """Search in FAISS with legal filtering"""
        if self.index is None or self.index.ntotal == 0:
            return []
        
        # For FAISS, we need filter_dict to be provided
        if filter_dict is None:
            logger.error("FAISS legal search requires filter_dict")
            return []
        
        # Normalize query vector
        query_normalized = self._normalize_vectors(query_embedding.reshape(1, -1))
        
        # Adjust k based on available documents
        k = min(k, self.index.ntotal)
        
        # Search
        scores, indices = self.index.search(query_normalized, k)
        
        results = []
        for score, idx in zip(scores[0], indices[0]):
            if idx >= 0 and idx in self.id_to_content:
                metadata = self.id_to_metadata[idx].copy()
                content = self.id_to_content[idx]
                
                # Skip if content is empty
                if not content.strip():
                    continue
                
                # Apply legal filtering
                if filter_dict and not self._matches_legal_filter(metadata, filter_dict):
                    continue
                
                result = SearchResult(
                    id=metadata.get("legal_id", f"{self.collection_name}::{idx}"),
                    score=float(score),
                    content=content,
                    metadata=metadata
                )
                results.append(result)
        
        return results
    
    def _matches_legal_filter(self, metadata: Dict, filter_dict: Dict) -> bool:
        """Check if metadata matches legal filter criteria"""
        # Check all filter criteria
        for key, value in filter_dict.items():
            if key not in metadata:
                return False
            
            # Handle paragraph matching (allow partial matches)
            if key == "paragraph" and value:
                # If searching for specific paragraph
                if metadata[key] != value:
                    # Check if it's within a range (e.g., "32-35")
                    if "-" in metadata[key]:
                        start, end = metadata[key].split("-")
                        if value.isdigit() and start.isdigit() and end.isdigit():
                            if not (int(start) <= int(value) <= int(end)):
                                return False
                    else:
                        return False
            else:
                # Exact match for other fields
                if metadata[key] != value:
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
        
        # Analyze legal metadata
        statutes = set()
        domains = set()
        paragraphs = set()
        for metadata in self.id_to_metadata.values():
            statutes.add(metadata.get("statute", "UNKNOWN"))
            domains.add(metadata.get("domain", "UNKNOWN"))
            if metadata.get("paragraph"):
                paragraphs.add(metadata.get("paragraph"))
        
        return {
            "type": "faiss",
            "collection": self.collection_name,
            "count": self.index.ntotal,
            "unique_statutes": list(statutes),
            "unique_domains": list(domains),
            "unique_paragraphs": len(paragraphs),
            "metric": "cosine"
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
        
        # Save metadata as JSON (safe alternative to pickle)
        metadata_path = os.path.join(save_dir, "metadata.json")
        with open(metadata_path, 'w', encoding='utf-8') as f:
            json.dump({
                "id_to_metadata": {str(k): v for k, v in self.id_to_metadata.items()},
                "id_to_content": {str(k): v for k, v in self.id_to_content.items()},
                "next_id": self.next_id,
                "dimension": self.dimension
            }, f)

        logger.info(f"Saved FAISS index to {save_dir}")
        return save_dir

    def load(self, path: Optional[str] = None) -> bool:
        """Load FAISS index from disk"""
        load_dir = path or os.path.join(self.index_path, self.collection_name)
        faiss_path = os.path.join(load_dir, "index.faiss")
        metadata_path = os.path.join(load_dir, "metadata.json")

        if not os.path.exists(faiss_path) or not os.path.exists(metadata_path):
            logger.warning(f"FAISS index files not found at {load_dir}")
            return False

        try:
            # Load FAISS index
            self.index = faiss.read_index(faiss_path)

            # Load metadata from JSON (safe, no code execution)
            with open(metadata_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
                self.id_to_metadata = {int(k): v for k, v in data["id_to_metadata"].items()}
                self.id_to_content = {int(k): v for k, v in data["id_to_content"].items()}
                self.next_id = data["next_id"]
                self.dimension = data["dimension"]

            logger.info(f"Loaded FAISS index from {load_dir}")
            return True
        except Exception as e:
            logger.error(f"Error loading FAISS index: {e}")
            return False

class ChromaStore(BaseVectorStore):
    """ChromaDB vector store with hard legal filters"""
    
    def __init__(self, collection_name: str, dimension: int = 768):
        super().__init__(collection_name, dimension)
        self.client = None
        self.collection = None
        self._initialize_client()
    
    def _initialize_client(self):
        """Initialize ChromaDB client"""
        try:
            # Use persistent storage
            persist_directory = os.path.join(self.index_path, "chroma", self.collection_name)
            os.makedirs(persist_directory, exist_ok=True)
            
            self.client = chromadb.Client(ChromaSettings(
                chroma_db_impl="duckdb+parquet",
                persist_directory=persist_directory
            ))
            
            logger.info(f"Initialized ChromaDB client for {self.collection_name}")
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
            
            # Create new collection with explicit metric
            self.collection = self.client.create_collection(
                name=self.collection_name,
                metadata={"hnsw:space": "cosine", "dimension": self.dimension}
            )
            
            logger.info(f"Created ChromaDB collection '{self.collection_name}'")
        except Exception as e:
            logger.error(f"Error creating ChromaDB collection: {e}")
            raise
    
    def add_documents(self, documents: List[Dict], embeddings: np.ndarray):
        """Add documents to ChromaDB with legal metadata"""
        # Validate all documents have legal metadata
        for i, doc in enumerate(documents):
            metadata = doc.get("metadata", {})
            if "statute" not in metadata or "domain" not in metadata:
                raise ValueError(f"Document {i} missing legal metadata")
        
        ids = []
        metadatas = []
        contents = []
        
        for i, (doc, embedding) in enumerate(zip(documents, embeddings)):
            # Generate legal-aware ID
            metadata = doc.get("metadata", {}).copy()
            statute = metadata.get("statute", "UNKNOWN")
            domain = metadata.get("domain", "UNKNOWN")
            paragraph = metadata.get("paragraph", "")
            doc_id = doc.get("id", f"doc_{i}")
            
            paragraph_part = f"_p{paragraph}" if paragraph else ""
            chunk_id = f"{statute}_{domain}{paragraph_part}_{doc_id}_chunk_{i}"
            ids.append(chunk_id)
            
            # Ensure legal metadata is complete
            metadata.update({
                "legal_id": chunk_id,
                "statute": statute,
                "domain": domain,
                "paragraph": paragraph,
                "paragraph_normalized": str(paragraph).zfill(3) if paragraph else "",
                "document_id": doc_id,
                "chunk_index": i,
                "timestamp": datetime.now().isoformat(),
                "content_hash": hashlib.md5(doc.get("content", "").encode()).hexdigest()
            })
            
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
        """Search in ChromaDB with hard legal filters"""
        if self.collection is None:
            return []
        
        # REQUIRE legal filter
        if filter_dict is None:
            logger.error("ChromaDB legal search requires filter_dict")
            return []
        
        # Build hard filter
        where = self._build_legal_filter(filter_dict)
        
        # Search
        try:
            results = self.collection.query(
                query_embeddings=[query_embedding.tolist()],
                n_results=min(k, self.collection.count()),
                where=where,
                include=["metadatas", "documents", "distances"]
            )
        except Exception as e:
            logger.error(f"ChromaDB search error: {e}")
            return []
        
        search_results = []
        if results["ids"] and results["ids"][0]:
            for i, (doc_id, distance, content, metadata) in enumerate(zip(
                results["ids"][0],
                results["distances"][0],
                results["documents"][0],
                results["metadatas"][0]
            )):
                # Convert distance to similarity
                score = float(1.0 - distance)  # Chroma uses cosine distance
                
                # Skip empty content
                if not content or not content.strip():
                    continue
                
                # Verify legal boundary
                if not self._verify_legal_boundary(metadata, filter_dict):
                    continue
                
                result = SearchResult(
                    id=doc_id,
                    score=score,
                    content=content,
                    metadata=metadata or {}
                )
                search_results.append(result)
        
        return search_results
    
    def _build_legal_filter(self, filter_dict: Dict) -> Dict:
        """Build ChromaDB filter ensuring legal boundaries"""
        where = {}
        for key, value in filter_dict.items():
            if key in ["statute", "domain", "jurisdiction", "paragraph"]:
                where[key] = value
        return where
    
    def _verify_legal_boundary(self, metadata: Dict, filter_dict: Dict) -> bool:
        """Verify result stays within legal boundaries"""
        for key in ["statute", "domain"]:
            if key in filter_dict and metadata.get(key) != filter_dict[key]:
                return False
        
        # Special handling for paragraph
        if "paragraph" in filter_dict and filter_dict["paragraph"]:
            if metadata.get("paragraph") != filter_dict["paragraph"]:
                # Check if it's within a range
                para_range = metadata.get("paragraph_range", "")
                if para_range and "-" in para_range:
                    start, end = para_range.split("-")
                    if filter_dict["paragraph"].isdigit():
                        if not (int(start) <= int(filter_dict["paragraph"]) <= int(end)):
                            return False
                else:
                    return False
        
        return True
    
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
                "metric": "cosine",
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
            logger.info(f"Loaded ChromaDB collection '{self.collection_name}'")
            return True
        except Exception as e:
            logger.warning(f"ChromaDB collection not found: {e}")
            return False

class QdrantStore(BaseVectorStore):
    """Qdrant vector store with legal boundary enforcement"""
    
    def __init__(self, collection_name: str, dimension: int = 768):
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
            logger.info(f"Connected to Qdrant for {self.collection_name}")
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
            
            # Create new collection with cosine distance
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
        """Add documents to Qdrant with legal metadata"""
        if len(documents) != len(embeddings):
            raise ValueError("Documents and embeddings must have same length")
        
        points = []
        for i, (doc, embedding) in enumerate(zip(documents, embeddings)):
            # Get legal metadata
            metadata = doc.get("metadata", {}).copy()
            statute = metadata.get("statute", "UNKNOWN")
            domain = metadata.get("domain", "UNKNOWN")
            paragraph = metadata.get("paragraph", "")
            doc_id = doc.get("id", f"doc_{i}")
            
            # Generate legal-aware ID
            paragraph_part = f"_p{paragraph}" if paragraph else ""
            legal_id = f"{statute}_{domain}{paragraph_part}_{doc_id}_{i}"
            point_id = str(uuid.uuid5(uuid.NAMESPACE_DNS, legal_id))
            
            # Build comprehensive payload
            payload = {
                "legal_id": legal_id,
                "statute": statute,
                "domain": domain,
                "paragraph": paragraph,
                "paragraph_normalized": str(paragraph).zfill(3) if paragraph else "",
                "document_id": doc_id,
                "chunk_index": i,
                "content": doc.get("content", ""),
                "content_hash": hashlib.md5(doc.get("content", "").encode()).hexdigest(),
                "timestamp": datetime.now().isoformat(),
                "has_paragraph_ref": "§" in doc.get("content", ""),
                "has_article_ref": any(term in doc.get("content", "").lower() 
                                     for term in ["artikel", "article", "§"]),
                "word_count": len(doc.get("content", "").split())
            }
            
            # Add any additional metadata
            payload.update(metadata)
            
            point = PointStruct(
                id=point_id,
                vector=embedding.tolist(),
                payload=payload
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
        """Search in Qdrant with legal boundary enforcement"""
        # REQUIRE legal filter
        if filter_dict is None:
            logger.error("Qdrant legal search requires filter_dict")
            return []
        
        # Build hard legal filter
        filter_condition = self._build_legal_filter(filter_dict)
        
        # Search
        try:
            search_result = self.client.search(
                collection_name=self.collection_name,
                query_vector=query_embedding.tolist(),
                query_filter=filter_condition,
                limit=k,
                score_threshold=0.3  # Minimum similarity threshold
            )
        except Exception as e:
            logger.error(f"Qdrant search error: {e}")
            return []
        
        results = []
        for hit in search_result:
            metadata = hit.payload.copy()
            content = metadata.pop("content", "")
            
            # Skip if content is empty
            if not content or not content.strip():
                continue
            
            # Verify legal boundary
            if not self._verify_legal_boundary(metadata, filter_dict):
                continue
            
            result = SearchResult(
                id=str(hit.id),
                score=float(hit.score),
                content=content,
                metadata=metadata
            )
            results.append(result)
        
        return results
    
    def _build_legal_filter(self, filter_dict: Dict) -> Filter:
        """Build Qdrant filter ensuring legal boundaries"""
        must_conditions = []
        
        # Add all filter conditions
        for key, value in filter_dict.items():
            if key in ["statute", "domain", "jurisdiction", "paragraph"]:
                must_conditions.append(
                    FieldCondition(key=key, match=MatchValue(value=value))
                )
        
        return Filter(must=must_conditions) if must_conditions else None
    
    def _verify_legal_boundary(self, metadata: Dict, filter_dict: Dict) -> bool:
        """Verify result stays within legal boundaries"""
        for key in ["statute", "domain"]:
            if key in filter_dict and metadata.get(key) != filter_dict[key]:
                return False
        
        # Special handling for paragraph
        if "paragraph" in filter_dict and filter_dict["paragraph"]:
            if metadata.get("paragraph") != filter_dict["paragraph"]:
                # Could add range checking here if needed
                return False
        
        return True
    
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
                "metric": "cosine"
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

class LegalRAGManager:
    """Manager for multiple legal vector stores with routing"""
    
    def __init__(self, default_store_type: str = "faiss", dimension: int = 768):
        self.default_store_type = default_store_type
        self.dimension = dimension
        self.stores = {}  # statute_domain -> LegalVectorStore
        
        # Legal routing configuration
        self.legal_routing = {
            "BGB": {
                "divorce": ["scheidung", "ehe", "unterhalt", "trennung"],
                "inheritance": ["erbe", "testament", "pflichtteil", "erbschaft"],
                "contract": ["vertrag", "kauf", "miete", "leistung"]
            },
            "EstG": {
                "income_tax": ["einkommensteuer", "lohnsteuer", "einkünfte"],
                "vat": ["umsatzsteuer", "mehrwertsteuer", "vorsteuer"]
            },
            "StGB": {
                "criminal": ["straftat", "verbrechen", "strafe", "notwehr", "diebstahl", "mord"]
            }
        }
        
        logger.info("LegalRAGManager initialized")
    
    def create_store(self, statute: str, domain: str) -> LegalVectorStore:
        """Create a new legal vector store"""
        store_key = f"{statute}_{domain}"
        
        if store_key in self.stores:
            logger.warning(f"Store already exists for {store_key}")
            return self.stores[store_key]
        
        store = LegalVectorStore(
            statute=statute,
            domain=domain,
            store_type=self.default_store_type,
            dimension=self.dimension
        )
        
        self.stores[store_key] = store
        logger.info(f"Created legal store for {store_key}")
        return store
    
    def route_query(self, query: str) -> Tuple[str, str]:
        """Route query to appropriate statute and domain"""
        query_lower = query.lower()
        
        # First pass: check for explicit statute mentions
        for statute in self.legal_routing.keys():
            if statute.lower() in query_lower:
                # Find domain within statute
                for domain, keywords in self.legal_routing[statute].items():
                    if any(keyword in query_lower for keyword in keywords):
                        return statute, domain
                # Default domain for this statute
                return statute, list(self.legal_routing[statute].keys())[0]
        
        # Second pass: keyword-based routing
        for statute, domains in self.legal_routing.items():
            for domain, keywords in domains.items():
                if any(keyword in query_lower for keyword in keywords):
                    return statute, domain
        
        # Default fallback
        logger.warning(f"Could not route query: {query}")
        return "BGB", "general"
    
    def extract_paragraph(self, query: str) -> Optional[str]:
        """Extract paragraph number from query"""
        import re
        # Pattern for German paragraphs: § 32, §32, Paragraph 32
        patterns = [
            r'§\s*(\d+[a-z]?)',           # § 32, § 32a
            r'Paragraph\s+(\d+)',          # Paragraph 32
            r'par(?:agraph)?\s+(\d+)',     # par 32, paragraph 32
            r'Art(?:ikel)?\s+(\d+)'         # Artikel 1
        ]
        
        for pattern in patterns:
            match = re.search(pattern, query, re.IGNORECASE)
            if match:
                return match.group(1)
        
        return None
    
    def search(self, query: str, statute: Optional[str] = None, 
               domain: Optional[str] = None, paragraph: Optional[str] = None,
               k: int = 10) -> List[SearchResult]:
        """
        Main search method with legal routing and boundary enforcement
        
        Args:
            query: The search query
            statute: Optional statute filter
            domain: Optional domain filter
            paragraph: Optional paragraph filter
            k: Number of results
        """
        # Determine legal context
        if not statute or not domain:
            # Auto-route query
            statute, domain = self.route_query(query)
        
        # Extract paragraph from query if not provided
        if not paragraph:
            paragraph = self.extract_paragraph(query)
        
        # Get or create store
        store_key = f"{statute}_{domain}"
        store = self.stores.get(store_key)
        
        if not store:
            logger.info(f"Creating new store for {store_key}")
            store = self.create_store(statute, domain)
            # Try to load existing index
            if not store.load():
                logger.warning(f"No existing index found for {store_key}")
        
        # Build filter dictionary
        filter_dict = {
            "statute": statute,
            "domain": domain
        }
        if paragraph:
            filter_dict["paragraph"] = paragraph
        
        # For now, use a simple embedding (replace with your embedding service)
        # This is a placeholder - you should use your actual embedding model
        query_embedding = np.random.randn(self.dimension).astype(np.float32)
        query_embedding = query_embedding / np.linalg.norm(query_embedding)
        
        # Search within legal boundaries
        results = store.search(query_embedding, k=k, filter_dict=filter_dict, enforce_boundaries=True)
        
        # Log search context
        para_info = f" paragraph={paragraph}" if paragraph else ""
        logger.info(f"Search in {statute}:{domain}{para_info} found {len(results)} results")
        
        return results
    
    def get_all_stats(self) -> Dict[str, Any]:
        """Get statistics for all stores"""
        stats = {
            "total_stores": len(self.stores),
            "stores": {}
        }
        
        for store_key, store in self.stores.items():
            stats["stores"][store_key] = store.get_stats()
        
        return stats

# Factory functions
def create_legal_store(statute: str, domain: str, 
                      store_type: Optional[str] = None) -> LegalVectorStore:
    """Create a legal vector store with boundaries"""
    store_type = store_type or os.getenv("VECTOR_STORE_TYPE", "faiss")
    dimension = int(os.getenv("EMBEDDING_DIMENSION", "768"))
    
    return LegalVectorStore(
        statute=statute,
        domain=domain,
        store_type=store_type,
        dimension=dimension
    )

def create_default_store(collection_name: str = "legal_documents") -> BaseVectorStore:
    """Legacy function - use create_legal_store instead"""
    warnings.warn("Use create_legal_store() for legal RAG with boundaries", DeprecationWarning)
    
    store_type = os.getenv("VECTOR_STORE_TYPE", "faiss").lower()
    dimension = int(os.getenv("EMBEDDING_DIMENSION", "768"))
    
    # Parse statute and domain from collection name if possible
    parts = collection_name.split("_")
    if len(parts) >= 2:
        statute, domain = parts[0], parts[1]
        return create_legal_store(statute, domain, store_type)
    else:
        # Fallback to old behavior
        if store_type == "faiss":
            return FAISSStore(collection_name, dimension)
        elif store_type == "chroma":
            return ChromaStore(collection_name, dimension)
        elif store_type == "qdrant":
            return QdrantStore(collection_name, dimension)
        else:
            raise ValueError(f"Unknown store type: {store_type}")

# Test
if __name__ == "__main__":
    print("Testing legal RAG system...")
    
    # Create legal manager
    manager = LegalRAGManager(default_store_type="faiss")
    
    # Test queries
    test_queries = [
        "Wie ist der Pflichtteil beim Erbe geregelt?",
        "Was sind die Voraussetzungen für eine Scheidung?",
        "Notwehr paragraph 32 StGB"
    ]
    
    for query in test_queries:
        print(f"\nQuery: {query}")
        statute, domain = manager.route_query(query)
        paragraph = manager.extract_paragraph(query)
        print(f"  → Statute: {statute}, Domain: {domain}, Paragraph: {paragraph}")
        
        # Search
        results = manager.search(query, statute=statute, domain=domain, paragraph=paragraph, k=3)
        print(f"  → Found {len(results)} results")
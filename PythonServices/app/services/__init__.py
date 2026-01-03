"""
Services package for Legal RAG Python Service.
"""

from app.services.embedding_service import embedding_service, EmbeddingService
from app.services.retrieval_service import retrieval_service, RetrievalService
from app.services.pdf_service import pdf_service, PDFService
from app.services.vector_store import (
    VectorStoreType,
    BaseVectorStore,
    FAISSStore,
    ChromaStore,
    QdrantStore,
    VectorStoreFactory,
    create_default_store,
    SearchResult
)

__all__ = [
    # Services
    "embedding_service",
    "EmbeddingService",
    "retrieval_service",
    "RetrievalService",
    "pdf_service",
    "PDFService",
    
    # Vector Stores
    "VectorStoreType",
    "BaseVectorStore",
    "FAISSStore",
    "ChromaStore",
    "QdrantStore",
    "VectorStoreFactory",
    "create_default_store",
    "SearchResult"
]
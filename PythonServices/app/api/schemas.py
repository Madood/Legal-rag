from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any, Union

class EmbeddingsRequest(BaseModel):
    """Request for generating embeddings"""
    text: Union[str, List[str]]
    use_cache: bool = True

class EmbeddingsResponse(BaseModel):
    """Response with embeddings"""
    embeddings: List[List[float]]
    dimension: int

class QueryEmbeddingRequest(BaseModel):
    """Request for query embedding"""
    query: str
    statute: Optional[str] = None

class QueryEmbeddingResponse(BaseModel):
    """Response with query embedding"""
    embedding: List[float]
    dimension: int
    statute: Optional[str] = None

class SearchRequest(BaseModel):
    """Request for document search"""
    query_embedding: Optional[List[float]] = None
    query_text: Optional[str] = None
    statute: Optional[str] = None
    top_k: int = 10
    filters: Optional[Dict[str, Any]] = None

class SearchResult(BaseModel):
    """Search result item"""
    id: int
    score: float
    content: str
    statute: str
    document_id: str
    legal_relevance: float
    metadata: Dict[str, Any]

class SearchResponse(BaseModel):
    """Search response"""
    results: List[SearchResult]
    count: int
    statute: Optional[str] = None

class PDFProcessResponse(BaseModel):
    """PDF processing response"""
    filename: str
    text_length: int
    chunks_count: int
    statute: Optional[str] = None
    language: str
    pages: int
    chunks: List[Dict[str, Any]]

class Document(BaseModel):
    """Document for indexing"""
    id: str
    filename: str
    content: str
    chunk_index: int = 0
    page: int = 0
    statute: Optional[str] = None
    metadata: Dict[str, Any] = {}

class IndexRequest(BaseModel):
    """Request for indexing documents"""
    documents: List[Document]
    statute: Optional[str] = None
    embeddings: Optional[List[List[float]]] = None

class IndexResponse(BaseModel):
    """Indexing response"""
    indexed_count: int
    statute: Optional[str] = None
    message: str
from .authority_enforcement import AuthorityEnforcement
from .paragraph_identity import ParagraphExtractor, ParagraphNormalizer
from .doctrine_guard import DoctrineGuard, DOCTRINAL_QUESTION_TYPES
from .statute_index_manager import StatuteFirstIndexer, StatuteFirstValidator
from .vector_store import FAISSStore, BaseVectorStore, LegalVectorStore
from .document_store import DocumentStore
from .retrieval_service import RetrievalService, retrieval_service

# For backward compatibility - if any code expects 'VectorStore'
VectorStore = FAISSStore

__all__ = [
    'AuthorityEnforcement',
    'ParagraphExtractor',
    'ParagraphNormalizer',
    'DoctrineGuard',
    'DOCTRINAL_QUESTION_TYPES',
    'StatuteFirstIndexer',
    'StatuteFirstValidator',
    'VectorStore',  # Keep this for backward compatibility
    'FAISSStore',
    'BaseVectorStore',
    'LegalVectorStore',
    'DocumentStore',
    'RetrievalService',
    'retrieval_service'
]
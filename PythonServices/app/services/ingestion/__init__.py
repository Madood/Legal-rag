"""
Ingestion Layer - Pure I/O and Format Normalization.
No legal reasoning, no authority classification, no chunking logic.

Exports:
    corpus - Legal corpus interface
    upload_handler - File upload and PDF parsing
    document_loader - Document containerization
    format_normalizer - Text normalization and paragraph extraction
    language_detector - Language detection
    paragraph_chunker - Paragraph-aware chunking (structure only)
"""

__all__ = [
    'corpus',
    'upload_handler',
    'document_loader',
    'format_normalizer',
    'language_detector',
    'paragraph_chunker',  # NEW
    'CorpusError',
    'RawDocument',
    'LanguageDetectionResult',
    'ParagraphChunk'  # NEW
]

__version__ = "1.0.0"
__author__ = "Legal RAG System"
__description__ = "Pure ingestion layer for legal document processing"

# Import core modules
from .corpus import corpus, CorpusError, get_corpus
from .upload_handler import upload_handler, UploadHandler
from .document_loader import document_loader, DocumentLoader, RawDocument
from .format_normalizer import format_normalizer, FormatNormalizer
from .language_detector import language_detector, LanguageDetector, LanguageDetectionResult
from .paragraph_chunker import paragraph_chunker, ParagraphChunker, ParagraphChunk  # NEW

# Convenience function
def load_corpus_documents(max_documents: int = None):
    """
    Convenience function to load all documents from corpus.
    
    Args:
        max_documents: Optional limit for testing
        
    Returns:
        List of RawDocument objects
    """
    return document_loader.load_documents(max_documents=max_documents)


def load_chunked_documents(max_documents: int = None) -> list[ParagraphChunk]:
    """
    NEW: Load and chunk all documents with paragraph awareness.
    
    Args:
        max_documents: Optional limit for testing
        
    Returns:
        List of ParagraphChunk objects with paragraph metadata
    """
    documents = document_loader.load_documents(max_documents=max_documents)
    
    all_chunks = []
    for doc in documents:
        # Detect language
        lang_result = language_detector.detect(doc.raw_content)
        
        # Clean and extract paragraphs
        cleaned_text, _ = format_normalizer.clean_text(doc.raw_content)
        paragraphs = format_normalizer.extract_paragraph_headers(cleaned_text)
        
        # Create paragraph-aware chunks
        chunks = paragraph_chunker.chunk_document(
            doc, 
            paragraphs, 
            language=lang_result.language
        )
        all_chunks.extend(chunks)
    
    return all_chunks


def process_single_document(file_path: str) -> list[ParagraphChunk]:
    """
    Process a single document through the complete pipeline.
    
    Args:
        file_path: Path to document (absolute or relative to corpus)
        
    Returns:
        List of ParagraphChunk objects
    """
    # Load single document
    raw_doc = document_loader.load_single_document(file_path)
    
    # Detect language
    lang_result = language_detector.detect(raw_doc.raw_content)
    
    # Clean and extract paragraphs
    cleaned_text, _ = format_normalizer.clean_text(raw_doc.raw_content)
    paragraphs = format_normalizer.extract_paragraph_headers(cleaned_text)
    
    # Create paragraph-aware chunks
    chunks = paragraph_chunker.chunk_document(
        raw_doc,
        paragraphs,
        language=lang_result.language
    )
    
    return chunks


# Export singleton instances
__exports__ = {
    'corpus': corpus,
    'upload_handler': upload_handler,
    'document_loader': document_loader,
    'format_normalizer': format_normalizer,
    'language_detector': language_detector,
    'paragraph_chunker': paragraph_chunker  # NEW
}
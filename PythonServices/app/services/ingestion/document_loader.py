"""
Document loader - wraps raw PDF content with basic identifiers.
No legal interpretation, no chunking, no statute detection.
"""
import logging
import hashlib
from typing import List, Dict, Any, Optional
from dataclasses import dataclass, field
from datetime import datetime

from .upload_handler import upload_handler
from .corpus import corpus

logger = logging.getLogger(__name__)


@dataclass
class RawDocument:
    """Pure data container for loaded documents - NO legal metadata"""
    
    # Core document identification
    id: str  # File hash
    filename: str
    filepath: str
    relative_path: str  # Relative to corpus root
    
    # Content
    raw_content: str
    page_count: int
    
    # File metadata (no legal interpretation)
    file_size: int
    file_created: str
    file_modified: str
    
    # PDF metadata (as-is)
    pdf_metadata: Dict[str, Any] = field(default_factory=dict)
    
    # Technical metadata
    ingestion_timestamp: str = field(default_factory=lambda: datetime.now().isoformat())
    content_hash: str = ""
    
    def __post_init__(self):
        """Validate that no legal fields are present"""
        # Calculate content hash
        if not self.content_hash:
            self.content_hash = hashlib.sha256(self.raw_content.encode('utf-8')).hexdigest()[:32]
        
        # Ensure no legal interpretation
        illegal_fields = [
            'statute', 'authority', 'norm', 'paragraph', 'section',
            'is_normative', 'authority_score', 'legal_class', 'jurisdiction'
        ]
        
        for field_name in illegal_fields:
            if hasattr(self, field_name):
                raise ValueError(
                    f"Illegal field '{field_name}' in RawDocument. "
                    "Ingestion layer must not interpret legal meaning."
                )
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary - no transformation"""
        return {
            'id': self.id,
            'filename': self.filename,
            'filepath': self.filepath,
            'relative_path': self.relative_path,
            'raw_content': self.raw_content[:100] + '...' if len(self.raw_content) > 100 else self.raw_content,
            'content_preview': self.raw_content[:200] + '...' if len(self.raw_content) > 200 else self.raw_content,
            'page_count': self.page_count,
            'file_size': self.file_size,
            'file_created': self.file_created,
            'file_modified': self.file_modified,
            'ingestion_timestamp': self.ingestion_timestamp,
            'content_hash': self.content_hash,
            'has_content': bool(self.raw_content.strip()),
            'word_count': len(self.raw_content.split()),
            'character_count': len(self.raw_content)
        }
    
    def to_serializable_dict(self) -> Dict[str, Any]:
        """For JSON serialization (full content)"""
        data = self.to_dict()
        data['raw_content'] = self.raw_content  # Full content
        return data
    
    @property
    def is_valid(self) -> bool:
        """Basic validation - no legal meaning"""
        return all([
            bool(self.id),
            bool(self.filename),
            bool(self.raw_content.strip()),
            self.page_count > 0,
            self.file_size > 0
        ])


class DocumentLoader:
    """Loads documents without legal interpretation"""
    
    def __init__(self, upload_handler_instance=None):
        self.upload_handler = upload_handler_instance or upload_handler
    
    def create_document_id(self, filepath: str, content: str = "") -> str:
        """
        Create simple document ID - no semantic meaning.
        
        Priority:
        1. Content-based hash (if content provided)
        2. Filepath hash
        """
        if content:
            # Content-based ID for consistency
            return f"doc_{hashlib.sha256(content.encode('utf-8')).hexdigest()[:16]}"
        else:
            # Filepath-based ID
            return f"doc_{hashlib.md5(filepath.encode()).hexdigest()[:16]}"
    
    def load_documents(self, max_documents: Optional[int] = None) -> List[RawDocument]:
        """
        Load all documents from corpus - pure data loading.
        
        Args:
            max_documents: Limit for testing/development
            
        Returns:
            List of RawDocument objects
        """
        # Get all PDF files from corpus
        pdf_files = self.upload_handler.find_pdf_files()
        
        if max_documents:
            pdf_files = pdf_files[:max_documents]
            logger.info(f"📄 Loading {len(pdf_files)} documents (limited)")
        
        # Load content
        pdf_contents = self.upload_handler.batch_load_pdfs(pdf_files)
        
        documents = []
        for content in pdf_contents:
            try:
                doc = self._create_raw_document(content)
                if doc.is_valid:
                    documents.append(doc)
                    logger.info(f"📄 Document loaded: {doc.filename} ({doc.page_count} pages, {len(doc.raw_content)} chars)")
                else:
                    logger.warning(f"⚠️  Invalid document skipped: {content['file_info']['filename']}")
                
            except Exception as e:
                logger.error(f"❌ Failed to create document: {e}")
        
        logger.info(f"✅ Total documents loaded: {len(documents)}")
        return documents
    
    def load_single_document(self, file_path: str) -> RawDocument:
        """
        Load single document - pure operation.
        
        Args:
            file_path: Absolute path or relative to corpus root
            
        Returns:
            RawDocument object
        """
        content = self.upload_handler.load_pdf_content(file_path)
        return self._create_raw_document(content)
    
    def _create_raw_document(self, content: Dict[str, Any]) -> RawDocument:
        """Create RawDocument from loaded content"""
        file_info = content['file_info']
        
        # Create document ID
        doc_id = self.create_document_id(
            file_info['filepath'],
            content['raw_content']
        )
        
        return RawDocument(
            id=doc_id,
            filename=file_info['filename'],
            filepath=file_info['filepath'],
            relative_path=file_info['relative_path'],
            raw_content=content['raw_content'],
            page_count=content['page_count'],
            file_size=file_info['size_bytes'],
            file_created=datetime.fromtimestamp(file_info['created_time']).isoformat() if 'created_time' in file_info else '',
            file_modified=datetime.fromtimestamp(file_info['modified_time']).isoformat(),
            pdf_metadata=content['metadata']
        )
    
    def get_document_stats(self, documents: List[RawDocument]) -> Dict[str, Any]:
        """
        Get statistics about loaded documents - pure metrics.
        No legal interpretation.
        """
        if not documents:
            return {"total_documents": 0}
        
        total_pages = sum(doc.page_count for doc in documents)
        total_size = sum(doc.file_size for doc in documents)
        total_words = sum(len(doc.raw_content.split()) for doc in documents)
        
        return {
            "total_documents": len(documents),
            "total_pages": total_pages,
            "total_size_mb": total_size / (1024 * 1024),
            "total_words": total_words,
            "avg_pages_per_document": total_pages / len(documents),
            "avg_document_size_mb": (total_size / len(documents)) / (1024 * 1024),
            "corpus_root": str(corpus.config.root_dir),
            "ingestion_timestamp": datetime.now().isoformat()
        }


# Initialize with upload handler
document_loader = DocumentLoader()
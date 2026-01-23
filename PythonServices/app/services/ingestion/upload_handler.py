"""
Pure file upload and PDF parsing - no legal logic
"""
import os
import logging
from pathlib import Path
from typing import List, Dict, Any, Optional
import PyPDF2
import pytesseract
from PIL import Image
import io

from .corpus import corpus, CorpusError

logger = logging.getLogger(__name__)

class UploadHandler:
    """Handles file uploads and PDF parsing using canonical corpus"""
    
    def __init__(self):
        """Initialize with corpus - no hardcoded paths"""
        logger.info(f"📂 UploadHandler using corpus: {corpus.config.root_dir}")
    
    def find_pdf_files(self) -> List[str]:
        """Find all PDF files in corpus - pure file discovery"""
        pdf_files = []
        for doc in corpus.list_documents():
            if doc.suffix.lower() == '.pdf':
                pdf_files.append(str(doc))
        
        logger.info(f"📄 Found {len(pdf_files)} PDF files in corpus")
        return pdf_files
    
    def load_pdf_content(self, file_path: str) -> Dict[str, Any]:
        """
        Load PDF content without legal interpretation.
        
        Args:
            file_path: Absolute path or relative to corpus root
            
        Returns:
            {
                'raw_content': str,
                'page_count': int,
                'metadata': Dict (PDF metadata only),
                'file_info': Dict (file stats only)
            }
        """
        try:
            # Convert to Path and ensure it's absolute
            file_path_obj = Path(file_path)
            if not file_path_obj.is_absolute():
                file_path_obj = corpus.config.root_dir / file_path_obj
            
            # Validate it's in corpus
            try:
                file_path_obj.relative_to(corpus.config.root_dir)
            except ValueError:
                logger.warning(f"⚠️  File outside corpus: {file_path_obj}")
            
            with open(file_path_obj, 'rb') as file:
                pdf_reader = PyPDF2.PdfReader(file)
                
                # Extract text from all pages
                text_content = []
                for i, page in enumerate(pdf_reader.pages):
                    try:
                        text = page.extract_text()
                        if text:
                            text_content.append(f"[Page {i+1}]\n{text}")
                        else:
                            logger.debug(f"Page {i+1} has no extractable text")
                    except Exception as page_error:
                        logger.warning(f"Failed to extract page {i+1}: {page_error}")
                        continue
                
                raw_content = "\n".join(text_content)
                
                # Basic file info - no legal metadata
                file_stats = os.stat(file_path_obj)
                
                return {
                    'raw_content': raw_content,
                    'page_count': len(pdf_reader.pages),
                    'metadata': dict(pdf_reader.metadata or {}),
                    'file_info': {
                        'filename': file_path_obj.name,
                        'filepath': str(file_path_obj),
                        'relative_path': str(file_path_obj.relative_to(corpus.config.root_dir)),
                        'size_bytes': file_stats.st_size,
                        'modified_time': file_stats.st_mtime,
                        'created_time': file_stats.st_ctime
                    }
                }
                
        except FileNotFoundError:
            logger.error(f"❌ File not found: {file_path}")
            raise CorpusError(f"Document not found: {file_path}")
        except Exception as e:
            logger.error(f"❌ Failed to load PDF {file_path}: {e}")
            raise
    
    def batch_load_pdfs(self, file_paths: List[str]) -> List[Dict[str, Any]]:
        """Load multiple PDFs - pure I/O operation"""
        results = []
        for file_path in file_paths:
            try:
                result = self.load_pdf_content(file_path)
                results.append(result)
                logger.info(f"   ✅ Loaded: {result['file_info']['filename']} ({result['page_count']} pages)")
            except Exception as e:
                logger.error(f"   ❌ Failed: {os.path.basename(file_path)} - {e}")
        
        logger.info(f"📦 Batch load complete: {len(results)}/{len(file_paths)} successful")
        return results
    
    def validate_pdf(self, file_path: str) -> Dict[str, Any]:
        """Basic PDF validation - no content analysis"""
        try:
            with open(file_path, 'rb') as file:
                pdf_reader = PyPDF2.PdfReader(file)
                
                # Check for common PDF issues
                is_encrypted = pdf_reader.is_encrypted
                has_outlines = len(pdf_reader.outlines) > 0 if hasattr(pdf_reader, 'outlines') else False
                
                return {
                    'valid': True,
                    'page_count': len(pdf_reader.pages),
                    'encrypted': is_encrypted,
                    'has_outlines': has_outlines,
                    'metadata': bool(pdf_reader.metadata),
                    'file_size': os.path.getsize(file_path)
                }
        except Exception as e:
            return {
                'valid': False,
                'error': str(e)
            }
    
    def upload_file(self, file_content: bytes, filename: str) -> str:
        """
        Upload file to corpus (for API endpoints).
        
        Args:
            file_content: Raw bytes of file
            filename: Original filename
            
        Returns:
            Path to saved file (relative to corpus root)
        """
        # Sanitize filename
        safe_filename = "".join(c for c in filename if c.isalnum() or c in (' ', '.', '-', '_')).strip()
        save_path = corpus.config.root_dir / safe_filename
        
        # Ensure unique filename
        counter = 1
        while save_path.exists():
            name, ext = os.path.splitext(safe_filename)
            save_path = corpus.config.root_dir / f"{name}_{counter}{ext}"
            counter += 1
        
        # Save file
        with open(save_path, 'wb') as f:
            f.write(file_content)
        
        logger.info(f"📤 File uploaded: {save_path.name} ({len(file_content)} bytes)")
        
        # Return relative path
        return str(save_path.relative_to(corpus.config.root_dir))


# Singleton instance
upload_handler = UploadHandler()
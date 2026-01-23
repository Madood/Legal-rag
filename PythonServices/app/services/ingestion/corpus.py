"""
Legal Corpus - Single Source of Truth
Pure interface to document repository, no legal logic.
"""
import os
import json
from pathlib import Path
from typing import List, Dict, Any, Optional, Set
import logging
from dataclasses import dataclass, asdict
from datetime import datetime

logger = logging.getLogger(__name__)

class CorpusError(Exception):
    """Pure corpus errors - no legal meaning"""
    pass


@dataclass
class CorpusConfig:
    """Immutable corpus configuration"""
    root_dir: Path
    supported_extensions: Set[str] = None
    max_file_size_mb: int = 50
    
    def __post_init__(self):
        if self.supported_extensions is None:
            self.supported_extensions = {'.pdf', '.txt', '.doc', '.docx'}
        
        # Ensure Path object
        if isinstance(self.root_dir, str):
            self.root_dir = Path(self.root_dir).resolve()
    
    def to_dict(self) -> Dict[str, Any]:
        """Serialize configuration"""
        return {
            'root_dir': str(self.root_dir),
            'supported_extensions': list(self.supported_extensions),
            'max_file_size_mb': self.max_file_size_mb,
            'exists': self.root_dir.exists(),
            'timestamp': datetime.now().isoformat()
        }


class LegalCorpus:
    """
    Single source of truth for legal documents.
    Shared by Node.js, Python, and future services.
    """
    
    def __init__(self, config: Optional[CorpusConfig] = None):
        """
        Initialize corpus from environment or explicit config.
        
        Priority:
        1. Explicit config parameter
        2. LEGAL_CORPUS_ROOT environment variable
        3. Try common locations
        4. Create directory if doesn't exist (development mode)
        """
        if config:
            self.config = config
        else:
            # Read from environment
            env_root = os.getenv("LEGAL_CORPUS_ROOT")
            
            if env_root:
                root_dir = Path(env_root)
                logger.info(f"📂 Using environment: LEGAL_CORPUS_ROOT={env_root}")
            else:
                # Try to find documents in common locations
                root_dir = self._find_documents_directory()
                logger.info(f"📂 Using discovered directory: {root_dir}")
            
            # Read other settings from environment
            extensions = os.getenv("SUPPORTED_EXTENSIONS", "pdf,txt,doc,docx")
            max_size = int(os.getenv("MAX_DOCUMENT_SIZE_MB", "50"))
            
            self.config = CorpusConfig(
                root_dir=root_dir,
                supported_extensions={f'.{ext.strip()}' for ext in extensions.split(',')},
                max_file_size_mb=max_size
            )
        
        # Create directory if it doesn't exist (for development)
        if not self.config.root_dir.exists():
            logger.warning(f"⚠️  Corpus directory does not exist, creating: {self.config.root_dir}")
            try:
                self.config.root_dir.mkdir(parents=True, exist_ok=True)
                # Create subdirectories
                (self.config.root_dir / "statutes").mkdir(exist_ok=True)
                (self.config.root_dir / "cases").mkdir(exist_ok=True)
                (self.config.root_dir / "commentary").mkdir(exist_ok=True)
                logger.info(f"✅ Created corpus directory structure")
            except Exception as e:
                logger.error(f"❌ Failed to create corpus directory: {e}")
                # Don't raise here - let validate() handle it
        
        # Validate
        try:
            self.validate()
            logger.info(f"✅ Legal Corpus initialized: {self.config.root_dir}")
        except CorpusError as e:
            logger.error(f"❌ Corpus validation failed: {e}")
            # In development mode, we can continue with warning
            if os.getenv("DEBUG", "false").lower() == "true":
                logger.warning("⚠️  Continuing in DEBUG mode despite corpus error")
            else:
                raise
    
    def _find_documents_directory(self) -> Path:
        """Try to find documents directory in common locations"""
        current_file = Path(__file__).resolve()
        
        possible_locations = [
            # 1. Project root sibling (your current structure)
            current_file.parents[4] / "documents",  # Go up 4 levels from ingestion/corpus.py
            
            # 2. Current directory sibling
            Path.cwd().parent / "documents",
            
            # 3. Your specific location from error
            Path(r"C:\Users\madoo\Desktop\React-projects\Legal-Rag\documents"),
            
            # 4. Relative to current working directory
            Path.cwd() / "documents",
            Path.cwd() / "../documents",
            
            # 5. Development location
            current_file.parents[3] / "documents",  # Old location that was failing
        ]
        
        for location in possible_locations:
            if location.exists() and location.is_dir():
                logger.info(f"✅ Found documents at: {location}")
                return location
        
        # If not found, create in project root
        project_root = current_file.parents[3]  # Go from corpus.py to PythonServices
        default_location = project_root / "documents"
        logger.warning(f"⚠️  No documents directory found, using: {default_location}")
        return default_location
    
    def validate(self) -> None:
        """Ensure corpus integrity - pure filesystem checks"""
        root = self.config.root_dir
        
        if not root.exists():
            raise CorpusError(f"Corpus root directory does not exist: {root}")
        
        if not root.is_dir():
            raise CorpusError(f"Corpus root is not a directory: {root}")
        
        # Check permissions
        try:
            test_file = root / ".permissions_test"
            test_file.touch()
            test_file.unlink()
        except PermissionError:
            raise CorpusError(f"No write permission for corpus: {root}")
        
        logger.debug(f"✅ Corpus validation passed: {root}")
    
    def list_documents(self) -> List[Path]:
        """
        List all documents in corpus (no filtering).
        
        Returns:
            List of Path objects to all supported documents.
        """
        documents = []
        
        for ext in self.config.supported_extensions:
            pattern = f"**/*{ext}"
            try:
                for path in self.config.root_dir.rglob(pattern):
                    if path.is_file():
                        # Check file size
                        try:
                            size_mb = path.stat().st_size / (1024 * 1024)
                            if size_mb <= self.config.max_file_size_mb:
                                documents.append(path)
                            else:
                                logger.warning(f"⚠️  Skipping large file: {path.name} ({size_mb:.1f} MB)")
                        except OSError:
                            logger.warning(f"⚠️  Cannot access file: {path.name}")
            except Exception as e:
                logger.error(f"❌ Error scanning for {ext} files: {e}")
        
        # Sort by path for consistency
        documents.sort(key=lambda p: str(p).lower())
        
        logger.info(f"📄 Found {len(documents)} documents in corpus")
        return documents
    
    def get_document_count(self) -> Dict[str, Any]:
        """Get pure document statistics (no legal classification)"""
        try:
            documents = self.list_documents()
            
            # Count by extension
            extension_counts = {}
            total_size_bytes = 0
            
            for doc in documents:
                try:
                    ext = doc.suffix.lower()
                    extension_counts[ext] = extension_counts.get(ext, 0) + 1
                    total_size_bytes += doc.stat().st_size
                except OSError:
                    continue
            
            return {
                "total_documents": len(documents),
                "by_extension": extension_counts,
                "total_size_mb": total_size_bytes / (1024 * 1024),
                "corpus_root": str(self.config.root_dir),
                "scan_timestamp": datetime.now().isoformat(),
                "max_file_size_mb": self.config.max_file_size_mb,
                "status": "healthy"
            }
        except Exception as e:
            return {
                "total_documents": 0,
                "error": str(e),
                "corpus_root": str(self.config.root_dir),
                "status": "error"
            }
    
    def get_document_info(self, doc_path: Path) -> Dict[str, Any]:
        """Get pure file metadata (no content analysis)"""
        if not doc_path.is_absolute():
            doc_path = self.config.root_dir / doc_path
        
        if not doc_path.exists():
            raise CorpusError(f"Document not found: {doc_path}")
        
        try:
            stat = doc_path.stat()
            
            return {
                "path": str(doc_path),
                "filename": doc_path.name,
                "size_bytes": stat.st_size,
                "size_mb": stat.st_size / (1024 * 1024),
                "created": datetime.fromtimestamp(stat.st_ctime).isoformat(),
                "modified": datetime.fromtimestamp(stat.st_mtime).isoformat(),
                "extension": doc_path.suffix.lower(),
                "relative_path": str(doc_path.relative_to(self.config.root_dir))
            }
        except OSError as e:
            raise CorpusError(f"Cannot access document {doc_path}: {e}")
    
    def find_document(self, filename: str) -> Optional[Path]:
        """Find document by filename (case-insensitive)"""
        filename_lower = filename.lower()
        
        for doc in self.list_documents():
            if doc.name.lower() == filename_lower:
                return doc
        
        return None
    
    def export_manifest(self, output_path: Optional[Path] = None) -> Path:
        """Export corpus manifest as JSON (for debugging/audit)"""
        if output_path is None:
            output_path = self.config.root_dir / "corpus_manifest.json"
        
        manifest = {
            "corpus_config": self.config.to_dict(),
            "documents": [],
            "generated_at": datetime.now().isoformat(),
            "version": "1.0.0"
        }
        
        for doc in self.list_documents():
            try:
                manifest["documents"].append(self.get_document_info(doc))
            except Exception as e:
                logger.warning(f"⚠️  Skipping document in manifest: {doc.name} - {e}")
        
        try:
            with open(output_path, 'w', encoding='utf-8') as f:
                json.dump(manifest, f, indent=2, ensure_ascii=False)
            
            logger.info(f"📋 Corpus manifest exported: {output_path}")
            return output_path
        except Exception as e:
            logger.error(f"❌ Failed to export manifest: {e}")
            raise CorpusError(f"Cannot write manifest: {e}")


# Lazy singleton - only create when needed
def get_corpus() -> LegalCorpus:
    """Get or create singleton corpus instance"""
    if not hasattr(get_corpus, '_instance'):
        get_corpus._instance = LegalCorpus()
    return get_corpus._instance


# Don't instantiate at module level - causes import-time validation
# corpus = get_corpus()  
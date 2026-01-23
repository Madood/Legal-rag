"""
Paragraph chunker - structural chunking based on paragraph headers.
No legal reasoning, just preserving document structure for retrieval.
"""

import logging
import re
from typing import List, Dict, Any, Optional
from dataclasses import dataclass, field

logger = logging.getLogger(__name__)


@dataclass
class ParagraphChunk:
    """Pure structural chunk - contains paragraph metadata"""
    statute_id: str  # e.g., "BGB"
    paragraph: str   # e.g., "1565", "1565a"
    text: str
    language: str
    source_file: str
    chunk_index: int
    
    # Structural metadata (no legal meaning)
    word_count: int
    char_count: int
    is_paragraph_start: bool = True
    source_path: str = ""
    
    @property
    def paragraph_norm(self) -> str:
        """Normalized paragraph identifier for exact matching"""
        # Remove any letters for normalization (e.g., "1565a" -> "1565")
        base = ''.join(c for c in self.paragraph if c.isdigit())
        if base:
            return f"PARAGRAPH_{base}"
        else:
            # Try to extract numbers from mixed strings
            numbers = re.findall(r'\d+', self.paragraph)
            if numbers:
                return f"PARAGRAPH_{numbers[0]}"
            return f"PARAGRAPH_{self.paragraph}"
    
    def to_metadata(self) -> Dict[str, Any]:
        """Convert to indexable metadata"""
        return {
            'statute_id': self.statute_id,
            'paragraph': self.paragraph,
            'paragraph_norm': self.paragraph_norm,
            'language': self.language,
            'source_file': self.source_file,
            'source_path': self.source_path,
            'chunk_index': self.chunk_index,
            'word_count': self.word_count,
            'char_count': self.char_count,
            'is_paragraph_start': self.is_paragraph_start,
            'chunk_type': 'paragraph_chunk'
        }
    
    def to_serializable(self) -> Dict[str, Any]:
        """For JSON serialization"""
        return {
            **self.to_metadata(),
            'text': self.text[:500] + '...' if len(self.text) > 500 else self.text
        }


class ParagraphChunker:
    """
    Converts documents into paragraph-aware chunks.
    Pure structural operation - no legal interpretation.
    """
    
    def __init__(self, max_chunk_size: int = 1000, overlap: int = 100):
        self.max_chunk_size = max_chunk_size
        self.overlap = overlap
        
    def extract_statute_id(self, filename: str, filepath: str) -> str:
        """
        Extract statute identifier from filename/path (structural only).
        No legal database lookup.
        
        Examples:
            "BGB_§1565.pdf" -> "BGB"
            "stgb_paragraph_212.txt" -> "STGB"
            "/documents/statutes/BGB/§1565.pdf" -> "BGB"
        """
        # Try to extract from filename first
        filename_upper = filename.upper()
        
        # Common German statute abbreviations
        statute_patterns = ['BGB', 'STGB', 'ZPO', 'STPO', 'VwGO', 'AO', 'GG', 'HGB', 'AO', 'VwVfG']
        
        for pattern in statute_patterns:
            if pattern in filename_upper:
                return pattern
        
        # Try from path
        filepath_upper = filepath.upper()
        for pattern in statute_patterns:
            if pattern in filepath_upper:
                return pattern
        
        # Try to extract from common patterns
        patterns_to_try = [
            r'([A-Z]{2,5})_',  # BGB_, STGB_
            r'([A-Z]{2,5})-',  # BGB-, STGB-
            r'([A-Z]{2,5})\s', # BGB §
        ]
        
        for pattern in patterns_to_try:
            match = re.search(pattern, filename_upper)
            if match:
                return match.group(1)
        
        # Fallback: use filename without extension
        name_without_ext = filename.split('.')[0]
        if len(name_without_ext) <= 10:
            return name_without_ext.upper()
        
        # Return first 10 chars
        return name_without_ext[:10].upper()
    
    def chunk_document(self, raw_document, extracted_paragraphs: List[Dict[str, str]], language: str = "german") -> List[ParagraphChunk]:
        """
        Create paragraph-aware chunks from a document.
        
        Args:
            raw_document: RawDocument from document_loader
            extracted_paragraphs: Paragraphs from format_normalizer
            language: Detected language
            
        Returns:
            List of ParagraphChunk objects
        """
        statute_id = self.extract_statute_id(
            raw_document.filename,
            raw_document.filepath
        )
        
        chunks = []
        
        if extracted_paragraphs:
            # Use extracted paragraph structure
            for i, para_info in enumerate(extracted_paragraphs):
                # Further chunk large paragraphs by size
                para_text = para_info['text']
                if len(para_text) > self.max_chunk_size * 2:
                    sub_chunks = self._chunk_text_by_size(para_text, is_paragraph_start=(i==0))
                    for j, sub_text in enumerate(sub_chunks):
                        chunk = ParagraphChunk(
                            statute_id=statute_id,
                            paragraph=f"{para_info['paragraph']}_{j+1}",
                            text=sub_text,
                            language=language,
                            source_file=raw_document.filename,
                            source_path=raw_document.relative_path,
                            chunk_index=len(chunks),
                            word_count=len(sub_text.split()),
                            char_count=len(sub_text),
                            is_paragraph_start=(j == 0)
                        )
                        chunks.append(chunk)
                else:
                    chunk = ParagraphChunk(
                        statute_id=statute_id,
                        paragraph=para_info['paragraph'],
                        text=para_text,
                        language=language,
                        source_file=raw_document.filename,
                        source_path=raw_document.relative_path,
                        chunk_index=len(chunks),
                        word_count=para_info.get('word_count', len(para_text.split())),
                        char_count=len(para_text)
                    )
                    chunks.append(chunk)
                
                logger.debug(f"📑 Created paragraph chunk: {statute_id} §{para_info['paragraph']} ({chunk.word_count} words)")
        else:
            # Fallback: chunk by size (no paragraph awareness)
            logger.warning(f"⚠️  No paragraph structure found in {raw_document.filename}, chunking by size")
            text_chunks = self._chunk_text_by_size(raw_document.raw_content, is_paragraph_start=True)
            
            for i, chunk_text in enumerate(text_chunks):
                chunk = ParagraphChunk(
                    statute_id=statute_id,
                    paragraph=f"CHUNK_{i+1:03d}",
                    text=chunk_text,
                    language=language,
                    source_file=raw_document.filename,
                    source_path=raw_document.relative_path,
                    chunk_index=i,
                    word_count=len(chunk_text.split()),
                    char_count=len(chunk_text),
                    is_paragraph_start=(i == 0)
                )
                chunks.append(chunk)
        
        logger.info(f"📦 Created {len(chunks)} chunks from {raw_document.filename} ({statute_id})")
        return chunks
    
    def _chunk_text_by_size(self, text: str, is_paragraph_start: bool = False) -> List[str]:
        """Chunk text by max size with overlap"""
        if not text:
            return []
        
        words = text.split()
        if not words:
            return []
        
        chunks = []
        current_chunk = []
        current_size = 0
        
        for word in words:
            current_chunk.append(word)
            current_size += len(word) + 1  # +1 for space
            
            if current_size >= self.max_chunk_size:
                chunks.append(' '.join(current_chunk))
                
                # Keep overlap for context
                if self.overlap > 0 and len(current_chunk) > 10:
                    overlap_words = min(self.overlap // 6, len(current_chunk) // 2)  # Rough estimate
                    current_chunk = current_chunk[-overlap_words:] if overlap_words < len(current_chunk) else []
                    current_size = sum(len(w) + 1 for w in current_chunk)
                else:
                    current_chunk = []
                    current_size = 0
        
        # Add final chunk
        if current_chunk:
            chunks.append(' '.join(current_chunk))
        
        return chunks
    
    def validate_chunks(self, chunks: List[ParagraphChunk]) -> Dict[str, Any]:
        """Validate chunk structure (not legal meaning)"""
        if not chunks:
            return {"valid": False, "error": "No chunks generated"}
        
        # Check for empty chunks
        empty_chunks = [ch for ch in chunks if not ch.text.strip()]
        
        stats = {
            "total_chunks": len(chunks),
            "unique_paragraphs": len(set(ch.paragraph for ch in chunks)),
            "unique_statutes": len(set(ch.statute_id for ch in chunks)),
            "total_words": sum(ch.word_count for ch in chunks),
            "paragraph_start_chunks": sum(1 for ch in chunks if ch.is_paragraph_start),
            "empty_chunks": len(empty_chunks),
            "valid": len(empty_chunks) == 0
        }
        
        # Add statute distribution
        statute_dist = {}
        for ch in chunks:
            statute_dist[ch.statute_id] = statute_dist.get(ch.statute_id, 0) + 1
        stats["statute_distribution"] = statute_dist
        
        # Check for minimum chunk size
        small_chunks = [ch for ch in chunks if ch.word_count < 10]
        if small_chunks:
            stats["small_chunks"] = len(small_chunks)
            stats["smallest_chunk"] = min(ch.word_count for ch in chunks)
        
        return stats
    
    def get_chunks_by_paragraph(self, chunks: List[ParagraphChunk]) -> Dict[str, List[ParagraphChunk]]:
        """Group chunks by paragraph for analysis"""
        by_paragraph = {}
        for chunk in chunks:
            if chunk.paragraph not in by_paragraph:
                by_paragraph[chunk.paragraph] = []
            by_paragraph[chunk.paragraph].append(chunk)
        return by_paragraph
    
    def filter_chunks_by_statute(self, chunks: List[ParagraphChunk], statute_id: str) -> List[ParagraphChunk]:
        """Filter chunks by statute ID (structural only)"""
        return [ch for ch in chunks if ch.statute_id.upper() == statute_id.upper()]
    
    def filter_chunks_by_paragraph(self, chunks: List[ParagraphChunk], paragraph: str) -> List[ParagraphChunk]:
        """Filter chunks by paragraph (structural only)"""
        return [ch for ch in chunks if ch.paragraph_norm == f"PARAGRAPH_{paragraph}" or ch.paragraph == paragraph]


# Singleton instance
paragraph_chunker = ParagraphChunker()
import fitz  # PyMuPDF
import pdfplumber
from pdfminer.high_level import extract_text as pdfminer_extract
import os
import re
from typing import Dict, List, Optional, Tuple
import logging
from dataclasses import dataclass

logger = logging.getLogger(__name__)

@dataclass
class PDFMetadata:
    """PDF metadata container"""
    filename: str
    pages: int
    text_length: int
    language: str = "de"
    statute: Optional[str] = None
    year: Optional[str] = None
    jurisdiction: str = "DE"
    is_ocr: bool = False
    has_scanned_pages: bool = False

class PDFService:
    """Service for PDF text extraction and processing"""
    
    def __init__(self):
        self.boilerplate_patterns = [
            r"Ein Service des Bundesministerium.*",
            r"Service provided by.*",
            r"©.*",
            r"Copyright.*",
            r"CELEX.*",
            r"Official Journal.*",
            r"Amtsblatt.*",
            r"Bundesanzeiger.*",
            r"Stand:.*",
            r"Fassung vom.*",
            r"gesetze-im-internet\.de.*",
            r"Juris.*",
            r"Navigation.*",
            r"Menü.*",
            r"Sitemap.*",
            r"Impressum.*",
            r"Datenschutz.*",
            r"Kontakt.*",
            r"Help.*",
            r"Hilfe.*"
        ]
        
        self.legal_patterns = {
            "stgb": r"\bStGB\b|\bStrafgesetzbuch\b",
            "bgb": r"\bBGB\b|\bBürgerliches Gesetzbuch\b",
            "hgb": r"\bHGB\b|\bHandelsgesetzbuch\b",
            "gg": r"\bGG\b|\bGrundgesetz\b",
            "gdpr": r"\bGDPR\b|\bDSGVO\b|\bDatenschutz-Grundverordnung\b"
        }
        
        logger.info("PDFService initialized")
    
    def extract_text(self, file_path: str, method: str = "auto") -> Tuple[str, PDFMetadata]:
        """
        Extract text from PDF file using best available method
        """
        if not os.path.exists(file_path):
            raise FileNotFoundError(f"PDF file not found: {file_path}")
        
        filename = os.path.basename(file_path)
        logger.info(f"Extracting text from: {filename}")
        
        # Try different extraction methods
        text = ""
        metadata = PDFMetadata(filename=filename, pages=0, text_length=0)
        
        try:
            if method == "auto" or method == "pymupdf":
                text, metadata = self._extract_with_pymupdf(file_path)
            elif method == "pdfplumber":
                text, metadata = self._extract_with_pdfplumber(file_path)
            elif method == "pdfminer":
                text, metadata = self._extract_with_pdfminer(file_path)
        except Exception as e:
            logger.error(f"Error with {method}: {e}")
            # Fallback to next method
            if method == "auto":
                try:
                    text, metadata = self._extract_with_pdfplumber(file_path)
                except Exception:
                    text, metadata = self._extract_with_pdfminer(file_path)
        
        # Clean and analyze text
        text = self._clean_legal_text(text)
        metadata.text_length = len(text)
        metadata.statute = self._detect_statute(text, filename)
        metadata.language = self._detect_language(text)
        metadata.year = self._extract_year(text)
        
        logger.info(f"Extracted {metadata.text_length} chars, {metadata.pages} pages")
        return text, metadata
    
    def _extract_with_pymupdf(self, file_path: str) -> Tuple[str, PDFMetadata]:
        """Extract text using PyMuPDF (fitz)"""
        text = ""
        metadata = PDFMetadata(
            filename=os.path.basename(file_path),
            pages=0,
            text_length=0
        )
        
        with fitz.open(file_path) as doc:
            metadata.pages = doc.page_count
            has_scanned = False
            
            for page_num in range(doc.page_count):
                page = doc.load_page(page_num)
                
                # Check if page is scanned/OCR
                text_blocks = page.get_text("dict")["blocks"]
                has_text = any(block["type"] == 0 for block in text_blocks)
                
                if not has_text:
                    has_scanned = True
                    # Try OCR if available
                    # Note: Would require OCR library integration
                
                # Extract text
                page_text = page.get_text()
                text += page_text + "\n\n"
            
            metadata.has_scanned_pages = has_scanned
            metadata.is_ocr = has_scanned
        
        return text, metadata
    
    def _extract_with_pdfplumber(self, file_path: str) -> Tuple[str, PDFMetadata]:
        """Extract text using pdfplumber"""
        text = ""
        metadata = PDFMetadata(
            filename=os.path.basename(file_path),
            pages=0,
            text_length=0
        )
        
        with pdfplumber.open(file_path) as pdf:
            metadata.pages = len(pdf.pages)
            
            for page in pdf.pages:
                page_text = page.extract_text() or ""
                text += page_text + "\n\n"
        
        return text, metadata
    
    def _extract_with_pdfminer(self, file_path: str) -> Tuple[str, PDFMetadata]:
        """Extract text using pdfminer"""
        text = pdfminer_extract(file_path)
        
        # Estimate page count (rough)
        with open(file_path, 'rb') as f:
            content = f.read()
            # Simple heuristic: count "endobj" occurrences
            page_count = content.count(b"/Page ") or 1
        
        metadata = PDFMetadata(
            filename=os.path.basename(file_path),
            pages=page_count,
            text_length=len(text)
        )
        
        return text, metadata
    
    def _clean_legal_text(self, text: str) -> str:
        """Clean German legal text"""
        if not text:
            return ""
        
        # Remove boilerplate
        for pattern in self.boilerplate_patterns:
            text = re.sub(pattern, "", text, flags=re.IGNORECASE | re.MULTILINE)
        
        # Remove page numbers and headers
        text = re.sub(r"^\s*Seite\s*\d+\s*$", "", text, flags=re.MULTILINE)
        text = re.sub(r"^\s*\d+\s*$", "", text, flags=re.MULTILINE)
        text = re.sub(r"\b\d{1,3}\s+von\s+\d{1,3}\b", "", text)
        
        # Normalize whitespace
        text = re.sub(r"\n{3,}", "\n\n", text)
        text = re.sub(r"[ \t]+", " ", text)
        
        # Remove empty lines
        lines = text.split("\n")
        lines = [line.strip() for line in lines if line.strip()]
        text = "\n".join(lines)
        
        return text
    
    def _detect_statute(self, text: str, filename: str) -> Optional[str]:
        """Detect which statute the text belongs to"""
        text_lower = text.lower()
        filename_lower = filename.lower()
        
        # Check filename first
        if "stgb" in filename_lower or "straf" in filename_lower:
            return "StGB"
        elif "bgb" in filename_lower or "bürgerlich" in filename_lower:
            return "BGB"
        elif "hgb" in filename_lower or "handels" in filename_lower:
            return "HGB"
        elif "gg" in filename_lower or "grundgesetz" in filename_lower:
            return "GG"
        elif "gdpr" in filename_lower or "dsgvo" in filename_lower:
            return "EU-GDPR"
        
        # Check content patterns
        for statute, pattern in self.legal_patterns.items():
            if re.search(pattern, text, re.IGNORECASE):
                return statute.upper()
        
        return None
    
    def _detect_language(self, text: str) -> str:
        """Detect language of text"""
        sample = text[:1000].lower()
        
        german_indicators = ["der", "die", "das", "und", "für", "mit", "von", "zu"]
        english_indicators = ["the", "and", "for", "with", "from", "to", "in", "of"]
        
        de_count = sum(1 for word in german_indicators if word in sample)
        en_count = sum(1 for word in english_indicators if word in sample)
        
        # Check for German specific characters
        if any(char in sample for char in ["ä", "ö", "ü", "ß"]):
            de_count += 3
        
        return "de" if de_count > en_count else "en"
    
    def _extract_year(self, text: str) -> Optional[str]:
        """Extract year from text"""
        year_match = re.search(r"\b(19|20)\d{2}\b", text)
        return year_match.group(0) if year_match else None
    
    def chunk_legal_text(self, text: str, max_chunk_size: int = 800, 
                        overlap: int = 100) -> List[Dict]:
        """
        Chunk legal text with paragraph awareness
        """
        if not text:
            return []
        
        # Split by paragraphs starting with §
        paragraphs = re.split(r'(?=§\s*\d+[a-z]?)', text)
        
        chunks = []
        current_chunk = ""
        
        for paragraph in paragraphs:
            paragraph = paragraph.strip()
            if not paragraph:
                continue
            
            # If paragraph is too long, split by sentences
            if len(paragraph) > max_chunk_size:
                sentences = re.split(r'[.!?]+', paragraph)
                temp_chunk = ""
                
                for sentence in sentences:
                    sentence = sentence.strip()
                    if not sentence:
                        continue
                    
                    if len(temp_chunk) + len(sentence) + 1 <= max_chunk_size:
                        temp_chunk += (" " + sentence) if temp_chunk else sentence
                    else:
                        if temp_chunk:
                            chunks.append(temp_chunk)
                        
                        # Overlap: keep last few sentences
                        overlap_sentences = temp_chunk.split()[-20:] if temp_chunk else []
                        temp_chunk = " ".join(overlap_sentences + [sentence])
                
                if temp_chunk:
                    chunks.append(temp_chunk)
            else:
                # Try to add paragraph to current chunk
                if len(current_chunk) + len(paragraph) + 2 <= max_chunk_size:
                    current_chunk += ("\n\n" + paragraph) if current_chunk else paragraph
                else:
                    if current_chunk:
                        chunks.append(current_chunk)
                    
                    # Start new chunk with overlap
                    overlap_text = current_chunk.split()[-50:] if current_chunk else []
                    current_chunk = " ".join(overlap_text + [paragraph])
        
        # Add last chunk
        if current_chunk:
            chunks.append(current_chunk)
        
        # Format chunks with metadata
        formatted_chunks = []
        for i, chunk_text in enumerate(chunks):
            formatted_chunks.append({
                "content": chunk_text,
                "chunk_index": i,
                "word_count": len(chunk_text.split()),
                "char_count": len(chunk_text),
                "has_paragraph": "$" in chunk_text,
                "has_article": "artikel" in chunk_text.lower() or 
                              "article" in chunk_text.lower()
            })
        
        return formatted_chunks

# Singleton instance
pdf_service = PDFService()
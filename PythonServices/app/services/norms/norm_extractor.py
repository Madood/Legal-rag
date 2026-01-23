"""
Norm Extractor - Segmentation engine of the norms layer.

Extracts atomic norms from structured legal text.
Preserves metadata and context without interpretation.

Architectural Role: Splits statutes into discrete normative statements.
"""

from typing import List, Dict, Any, Optional, Tuple
from dataclasses import dataclass, field
import re
from enum import Enum


class ExtractionMethod(Enum):
    """Methods for extracting norms from text."""
    SENTENCE = "sentence"      # Split by sentences
    CLAUSE = "clause"          # Split by clauses
    PARAGRAPH = "paragraph"    # Use paragraph boundaries
    COMPOUND = "compound"      # Handle multi-sentence norms


@dataclass
class ExtractedNorm:
    """Representation of a single extracted norm."""
    id: str                    # Unique identifier
    text: str                  # Raw norm text
    statute: str               # Source statute (e.g., "BGB", "StGB")
    article: str               # Article/paragraph number (e.g., "§ 242", "Art. 5")
    position: int              # Position within statute
    context: Dict[str, Any]    # Surrounding context
    metadata: Dict[str, Any]   # Additional metadata
    
    # System fields
    extraction_method: ExtractionMethod = ExtractionMethod.SENTENCE
    confidence: float = 1.0    # Extraction confidence


class NormExtractor:
    """
    Extracts discrete norms from legal text.
    
    Responsibilities:
    1. Split statutes into atomic norms
    2. Preserve paragraph/article numbers and statute references
    3. Maintain position and context
    4. Prepare norms for classification
    
    Non-Responsibilities:
    ❌ Decide whether a norm is correct
    ❌ Decide hierarchy
    ❌ Infer doctrine
    ❌ Modify language
    """
    
    # Legal text patterns
    PARAGRAPH_PATTERN = r'§\s*\d+[a-zA-Z]*'  # § 242, § 242a
    ARTICLE_PATTERN = r'Art\.?\s*\d+[a-zA-Z]*'  # Art. 5, Art. 5(1)
    SENTENCE_ENDERS = r'[.!?](?=\s+[A-Z§(])'  # Sentence boundaries
    
    # Clause separators
    CLAUSE_SEPARATORS = r'[,;]| und | oder | sowie '
    
    def __init__(self):
        """Initialize the norm extractor."""
        self.norm_counter = 0
        
    def extract_from_paragraph(
        self, 
        text: str, 
        statute: str, 
        article: str,
        context: Optional[Dict[str, Any]] = None
    ) -> List[ExtractedNorm]:
        """
        Extract norms from a single paragraph/article.
        
        Args:
            text: Full text of the paragraph
            statute: Source statute identifier
            article: Article/paragraph identifier
            context: Optional surrounding context
            
        Returns:
            List of extracted norms with metadata
        """
        if context is None:
            context = {}
        
        # Clean and normalize text
        clean_text = self._clean_text(text)
        
        # Determine extraction strategy
        extraction_method = self._determine_extraction_method(clean_text)
        
        # Split into candidate segments
        segments = self._split_text(clean_text, extraction_method)
        
        # Create norm objects
        norms = []
        for i, segment in enumerate(segments):
            if self._is_valid_norm_segment(segment):
                norm = ExtractedNorm(
                    id=f"{statute}_{article}_norm_{self.norm_counter}",
                    text=segment.strip(),
                    statute=statute,
                    article=article,
                    position=i,
                    context={
                        **context,
                        "full_paragraph": clean_text,
                        "segment_index": i,
                        "total_segments": len(segments)
                    },
                    metadata={
                        "extraction_method": extraction_method.value,
                        "segment_length": len(segment),
                        "has_legal_markers": self._has_legal_markers(segment)
                    },
                    extraction_method=extraction_method,
                    confidence=self._calculate_extraction_confidence(segment, extraction_method)
                )
                norms.append(norm)
                self.norm_counter += 1
        
        return norms
    
    def extract_from_statute(
        self,
        statute_text: Dict[str, str],  # article_number: text
        statute_name: str,
        context: Optional[Dict[str, Any]] = None
    ) -> List[ExtractedNorm]:
        """
        Extract norms from an entire statute.
        
        Args:
            statute_text: Dictionary mapping articles to their text
            statute_name: Name of the statute
            context: Optional statute-level context
            
        Returns:
            All extracted norms from the statute
        """
        all_norms = []
        
        for article, text in statute_text.items():
            article_context = {
                **(context or {}),
                "statute_name": statute_name,
                "article_number": article
            }
            
            norms = self.extract_from_paragraph(
                text=text,
                statute=statute_name,
                article=article,
                context=article_context
            )
            all_norms.extend(norms)
        
        return all_norms
    
    def _clean_text(self, text: str) -> str:
        """Clean and normalize legal text."""
        # Remove excessive whitespace
        text = re.sub(r'\s+', ' ', text.strip())
        
        # Normalize legal symbols
        text = re.sub(r'Art\.\s*', 'Art. ', text)  # Standardize article
        text = re.sub(r'§\s*', '§ ', text)          # Standardize paragraph
        
        return text
    
    def _determine_extraction_method(self, text: str) -> ExtractionMethod:
        """Determine the best extraction method for this text."""
        # Check if text contains multiple sentences
        sentences = re.split(self.SENTENCE_ENDERS, text)
        if len(sentences) > 1:
            # Check if sentences are strongly connected
            if self._are_sentences_connected(sentences):
                return ExtractionMethod.COMPOUND
            else:
                return ExtractionMethod.SENTENCE
        
        # Check for clauses within single sentence
        clauses = re.split(self.CLAUSE_SEPARATORS, text)
        if len(clauses) > 1 and any(len(c) > 20 for c in clauses):
            return ExtractionMethod.CLAUSE
        
        return ExtractionMethod.PARAGRAPH
    
    def _split_text(self, text: str, method: ExtractionMethod) -> List[str]:
        """Split text according to extraction method."""
        if method == ExtractionMethod.SENTENCE:
            return self._split_by_sentences(text)
        elif method == ExtractionMethod.CLAUSE:
            return self._split_by_clauses(text)
        elif method == ExtractionMethod.COMPOUND:
            return self._extract_compound_norms(text)
        else:  # PARAGRAPH
            return [text]
    
    def _split_by_sentences(self, text: str) -> List[str]:
        """Split text into sentences, preserving legal markers."""
        # Special handling for legal abbreviations
        text = re.sub(r'Art\.', 'ART_ABBREV', text)
        text = re.sub(r'§', 'PARA_SYMBOL', text)
        
        # Split sentences
        sentences = re.split(self.SENTENCE_ENDERS, text)
        
        # Restore legal symbols
        restored = []
        for sentence in sentences:
            sentence = re.sub(r'ART_ABBREV', 'Art.', sentence)
            sentence = re.sub(r'PARA_SYMBOL', '§', sentence)
            if sentence.strip():
                restored.append(sentence.strip() + '.')
        
        return restored
    
    def _split_by_clauses(self, text: str) -> List[str]:
        """Split text into meaningful clauses."""
        clauses = re.split(self.CLAUSE_SEPARATORS, text)
        return [c.strip() for c in clauses if c.strip() and len(c.strip()) > 5]
    
    def _extract_compound_norms(self, sentences: List[str]) -> List[str]:
        """Extract norms that span multiple connected sentences."""
        # For now, return sentences as separate but mark as compound context
        return sentences
    
    def _are_sentences_connected(self, sentences: List[str]) -> bool:
        """Check if sentences form a single normative statement."""
        if len(sentences) < 2:
            return False
        
        # Check for continuation markers
        second_sentence = sentences[1].lower()
        connectors = {"this", "such", "the aforementioned", "the same", "it"}
        
        first_words = set(second_sentence.split()[:3])
        return bool(connectors.intersection(first_words))
    
    def _is_valid_norm_segment(self, segment: str) -> bool:
        """Validate if segment could contain a norm."""
        # Minimum length
        if len(segment) < 10:
            return False
        
        # Check for legal references or normative language
        if re.search(r'(shall|must|may|is required|entitled to)', segment, re.IGNORECASE):
            return True
        
        # Check for legal symbols
        if re.search(r'§|Art\.|paragraph|article', segment, re.IGNORECASE):
            return True
        
        return False
    
    def _has_legal_markers(self, text: str) -> bool:
        """Check if text contains legal markers."""
        markers = [
            r'shall', r'must', r'may', r'required to', r'obliged to',
            r'prohibited', r'entitled', r'right to', r'according to',
            r'pursuant to', r'in accordance with'
        ]
        
        pattern = '|'.join(markers)
        return bool(re.search(pattern, text, re.IGNORECASE))
    
    def _calculate_extraction_confidence(self, segment: str, method: ExtractionMethod) -> float:
        """Calculate confidence in extraction quality."""
        base_confidence = 0.8
        
        # Adjust based on method
        if method == ExtractionMethod.PARAGRAPH:
            base_confidence = 0.9  # Original text, high confidence
        elif method == ExtractionMethod.SENTENCE:
            base_confidence = 0.8
        elif method == ExtractionMethod.CLAUSE:
            base_confidence = 0.7
        elif method == ExtractionMethod.COMPOUND:
            base_confidence = 0.6
        
        # Adjust based on segment quality
        if self._has_legal_markers(segment):
            base_confidence += 0.1
        
        if len(segment) < 20:
            base_confidence -= 0.2
        
        return min(max(base_confidence, 0.0), 1.0)
"""
Language detection - port of detectLanguage from Node.js.
No legal interpretation.
"""
import os
import re
import logging
from typing import Tuple, List, Dict, Any
from dataclasses import dataclass

logger = logging.getLogger(__name__)

@dataclass
class LanguageDetectionResult:
    """Pure language detection result - no legal meaning"""
    language: str  # 'german', 'english', 'unknown'
    confidence: float  # 0.0 to 1.0
    sample_size: int
    german_word_count: int = 0
    english_word_count: int = 0
    detected_terms: List[str] = None
    
    def __post_init__(self):
        if self.detected_terms is None:
            self.detected_terms = []
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            'language': self.language,
            'confidence': self.confidence,
            'sample_size': self.sample_size,
            'german_word_count': self.german_word_count,
            'english_word_count': self.english_word_count,
            'detected_terms': self.detected_terms,
            'is_confident': self.confidence > 0.7
        }


class LanguageDetector:
    """Detects language from text - direct port from Node.js"""
    
    def __init__(self, sample_size: int = None):
        # Get sample size from environment or use default
        env_sample_size = os.getenv("LANGUAGE_SAMPLE_SIZE")
        self.sample_size = int(env_sample_size) if env_sample_size else (sample_size or 2000)
        
        # Common words (no legal terms)
        self.german_words = [
            "der", "die", "das", "und", "für", "mit", "von", "zu", "auf", "ist",
            "dem", "den", "im", "am", "um", "als", "aus", "bei", "nach", "über",
            "ein", "eine", "einer", "einem", "einen", "eines", "dass", "daß",
            "aber", "oder", "wenn", "weil", "obwohl", "sowie", "sondern",
            "wird", "werden", "wurde", "wurden", "hat", "haben", "hätte"
        ]
        
        self.english_words = [
            "the", "and", "for", "with", "from", "to", "in", "of", "on", "is",
            "a", "an", "that", "this", "by", "at", "as", "it", "be", "are",
            "but", "or", "if", "because", "although", "as well as", "but rather",
            "will", "would", "was", "were", "has", "have", "had"
        ]
        
        # Common legal text indicators (format only, not interpretation)
        self.german_legal_indicators = [
            r'\b§\s*\d+',  # Paragraph symbol
            r'\bAbs\.?\s*\d+',  # Absatz
            r'\bArt\.?\s*\d+',  # Artikel
            r'\bSatz\s*\d+',  # Sentence
            r'\bNr\.?\s*\d+',  # Number
        ]
        
        self.english_legal_indicators = [
            r'\bsection\s+\d+',
            r'\barticle\s+\d+',
            r'\bparagraph\s+\d+',
            r'\bsubsection\s+\d+',
            r'\bclause\s+\d+',
        ]
    
    def detect(self, content: str, sample_size: int = None) -> LanguageDetectionResult:
        """
        Direct port of detectLanguage from Node.js.
        
        Args:
            content: Text to analyze
            sample_size: Optional override of default
            
        Returns:
            LanguageDetectionResult
        """
        if not content:
            return LanguageDetectionResult(
                language="unknown",
                confidence=0.0,
                sample_size=0
            )
        
        # Take sample
        sample_size = sample_size or self.sample_size
        sample = content[:min(sample_size, len(content))].lower()
        actual_sample_size = len(sample)
        
        # Count word occurrences
        de_count = 0
        en_count = 0
        detected_terms = []
        
        for word in self.german_words:
            pattern = rf'\b{word}\b'
            matches = re.findall(pattern, sample)
            if matches:
                de_count += len(matches)
                detected_terms.append(f"de:{word}")
        
        for word in self.english_words:
            pattern = rf'\b{word}\b'
            matches = re.findall(pattern, sample)
            if matches:
                en_count += len(matches)
                detected_terms.append(f"en:{word}")
        
        total = de_count + en_count
        
        if total == 0:
            return LanguageDetectionResult(
                language="unknown",
                confidence=0.0,
                sample_size=actual_sample_size,
                german_word_count=de_count,
                english_word_count=en_count,
                detected_terms=detected_terms
            )
        
        # Determine language
        if de_count > en_count:
            language = "german"
            confidence = de_count / total
        else:
            language = "english"
            confidence = en_count / total
        
        # Check for legal formatting indicators
        legal_indicators = []
        if language == "german":
            for pattern in self.german_legal_indicators:
                if re.search(pattern, sample, re.IGNORECASE):
                    legal_indicators.append(pattern)
        else:
            for pattern in self.english_legal_indicators:
                if re.search(pattern, sample, re.IGNORECASE):
                    legal_indicators.append(pattern)
        
        if legal_indicators:
            confidence = min(1.0, confidence + 0.1)  # Slight boost
            detected_terms.extend([f"legal:{ind}" for ind in legal_indicators])
        
        return LanguageDetectionResult(
            language=language,
            confidence=confidence,
            sample_size=actual_sample_size,
            german_word_count=de_count,
            english_word_count=en_count,
            detected_terms=detected_terms
        )
    
    def detect_batch(self, contents: List[str]) -> List[LanguageDetectionResult]:
        """Detect language for multiple texts"""
        return [self.detect(content) for content in contents]
    
    def is_german_legal_text(self, content: str) -> Tuple[bool, LanguageDetectionResult]:
        """
        Enhanced detection for German legal text format.
        Looks for formatting patterns, not legal meaning.
        
        Returns:
            (is_german_legal_format, detection_result)
        """
        result = self.detect(content)
        
        if result.language != "german" or result.confidence < 0.6:
            return False, result
        
        # Check for German legal formatting patterns
        sample = content[:3000].lower()
        
        # Format patterns (not legal meaning)
        format_indicators = [
            r'\b§\s*\d+[a-z]?\b',  # §1565, § 1565a
            r'\bAbs\.?\s*\d+\b',  # Abs. 1, Absatz 2
            r'\bArt\.?\s*\d+\b',  # Art. 1
            r'\bS\.\s*\d+\b',  # S. 123 (page reference)
            r'\bRn\.?\s*\d+\b',  # Rn. 45 (Randnummer)
            r'\bBGB\b', r'\bStGB\b', r'\bZPO\b',  # Statute abbreviations
        ]
        
        indicator_count = 0
        detected_indicators = []
        
        for pattern in format_indicators:
            if re.search(pattern, sample, re.IGNORECASE):
                indicator_count += 1
                detected_indicators.append(pattern)
        
        # Adjust confidence based on formatting
        if indicator_count >= 2:
            result.confidence = min(1.0, result.confidence + 0.2)
            result.detected_terms.extend([f"format:{ind}" for ind in detected_indicators])
            return True, result
        
        return False, result
    
    def get_language_stats(self, documents: List[str]) -> Dict[str, Any]:
        """Get language statistics for multiple documents"""
        results = self.detect_batch(documents)
        
        language_counts = {}
        total_confidence = 0.0
        confident_count = 0
        
        for result in results:
            lang = result.language
            language_counts[lang] = language_counts.get(lang, 0) + 1
            total_confidence += result.confidence
            if result.confidence > 0.7:
                confident_count += 1
        
        return {
            "total_documents": len(documents),
            "language_distribution": language_counts,
            "avg_confidence": total_confidence / len(documents) if documents else 0,
            "confident_detections": confident_count,
            "confident_ratio": confident_count / len(documents) if documents else 0
        }


# Singleton instance
language_detector = LanguageDetector()
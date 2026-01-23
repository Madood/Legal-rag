"""
Abstraction Level Detector

Determines how concrete or abstract the answer should be.
Controls answer granularity and technical depth.
"""

import re
from enum import Enum
from dataclasses import dataclass
from typing import List, Optional


class AbstractionLevel(str, Enum):
    """Levels of abstraction for legal answers."""
    LOW = "LOW"      # Specific paragraph/article level
    MEDIUM = "MEDIUM"  # Legal rule with explanation
    HIGH = "HIGH"     # Conceptual overview/structure


ABSTRACTION_LEVELS = [level.value for level in AbstractionLevel]


@dataclass
class AbstractionResult:
    """Structured result of abstraction level detection."""
    level: AbstractionLevel
    confidence: float
    indicators: List[str]
    technical_depth: str  # 'minimal', 'standard', 'technical'
    requires_citation: bool


class AbstractionDetector:
    """Detects the appropriate abstraction level for answers."""
    
    def __init__(self):
        # Patterns for each abstraction level
        self.level_patterns = {
            AbstractionLevel.LOW: [
                (r'§\s*\d+[a-z]?\s+sagt', 1.0),
                (r'artikel\s*\d+[a-z]?\s+sagt', 1.0),
                (r'what does §\s*\d+', 0.9),
                (r'was regelt §\s*\d+', 0.9),
                (r'explain §\s*\d+', 0.8),
                (r'erklären sie §\s*\d+', 0.8),
                (r'exact text of', 0.8),
                (r'genauer wortlaut', 0.8),
                (r'paragraph\s*\d+', 0.7),
                (r'section\s*\d+', 0.7),
            ],
            AbstractionLevel.HIGH: [
                (r'\bin general\b|\boverview\b|\bconcept\b', 0.8),
                (r'\bim allgemeinen\b|\büberblick\b|\bkonzept\b', 0.8),
                (r'\bhow does\b|\bwie funktioniert\b', 0.7),
                (r'\bstructure\b|\bsystem\b|\baufbau\b', 0.7),
                (r'\bprinciples\b|\bgrundprinzipien\b', 0.8),
                (r'\bbig picture\b|\bgesamtzusammenhang\b', 0.7),
                (r'\bintroduction to\b|\beinführung in\b', 0.7),
                (r'\bwhat is the framework\b|\bwas ist der rahmen\b', 0.7),
            ],
            AbstractionLevel.MEDIUM: [
                (r'\bexplain\b|\berklären\b', 0.7),
                (r'\bhow\b|\bwie\b', 0.6),
                (r'\bmeaning\b|\bbedeutung\b', 0.6),
                (r'\bapplication\b|\banwendung\b', 0.7),
                (r'\bpractical\b|\bpraktisch\b', 0.6),
                (r'\bexamples?\b|\bbeispiele?\b', 0.6),
                (r'\binterpretation\b|\binterpretation\b', 0.7),
            ]
        }
        
        # Technical depth indicators
        self.technical_indicators = {
            'technical': [
                r'\bjurisprudence\b|\brechtsprechung\b',
                r'\bscholarly opinion\b|\blehre\b',
                r'\bdoctrinal debate\b|\bdogmatik\b',
                r'\bcase law\b|\bfallrecht\b',
                r'\binterpretation methods\b|\bauslegungsmethoden\b',
                r'\bconstitutional court\b|\bverfassungsgericht\b',
            ],
            'minimal': [
                r'\bsimple\b|\beinfach\b',
                r'\bbasic\b|\bgrundlegend\b',
                r'\bfor beginners\b|\bfür anfänger\b',
                r'\blayman\b|\blaie\b',
                r'\bin plain language\b|\bin einfacher sprache\b',
            ]
        }
    
    def detect_abstraction_level(self, question: str) -> AbstractionResult:
        """
        Determine the abstraction level for answering a legal question.
        
        Args:
            question: The legal question text
            
        Returns:
            AbstractionResult with level, confidence, and metadata
        """
        q = question.lower().strip()
        scores = {}
        indicators = {}
        
        # Calculate scores for each level
        for level, patterns in self.level_patterns.items():
            scores[level] = 0.0
            indicators[level] = []
            
            for pattern, weight in patterns:
                if re.search(pattern, q, re.IGNORECASE):
                    scores[level] += weight
                    indicators[level].append(pattern)
        
        # Determine technical depth
        technical_depth = self._determine_technical_depth(q)
        
        # Determine citation requirement
        requires_citation = self._requires_citation(q, scores)
        
        # Determine winning level
        if not scores:
            level = AbstractionLevel.MEDIUM
            confidence = 0.5
        else:
            level = max(scores, key=scores.get)
            max_score = scores[level]
            
            # Calculate confidence
            total_score = sum(scores.values())
            if total_score > 0:
                confidence = min(max_score / total_score * 1.5, 1.0)
            else:
                confidence = 0.5
            
            # Boost confidence for explicit references
            if level == AbstractionLevel.LOW and max_score >= 0.8:
                confidence = min(confidence + 0.2, 1.0)
        
        return AbstractionResult(
            level=level,
            confidence=round(confidence, 2),
            indicators=indicators.get(level, []),
            technical_depth=technical_depth,
            requires_citation=requires_citation
        )
    
    def _determine_technical_depth(self, question: str) -> str:
        """Determine the required technical depth."""
        q = question.lower()
        
        # Check for technical indicators
        for pattern in self.technical_indicators['technical']:
            if re.search(pattern, q, re.IGNORECASE):
                return 'technical'
        
        # Check for minimal indicators
        for pattern in self.technical_indicators['minimal']:
            if re.search(pattern, q, re.IGNORECASE):
                return 'minimal'
        
        # Default to standard
        return 'standard'
    
    def _requires_citation(self, question: str, scores: dict) -> bool:
        """Determine if citation is required."""
        q = question.lower()
        
        # Always require citation for low abstraction (specific references)
        if scores.get(AbstractionLevel.LOW, 0) > 0.5:
            return True
        
        # Check for citation indicators
        citation_indicators = [
            r'\bcite\b|\bcitation\b',
            r'\bsource\b|\bquelle\b',
            r'\breference\b|\breferenz\b',
            r'\bwhere is it written\b|\bwo steht das\b',
            r'\baccording to\b|\bnach\b',
        ]
        
        for pattern in citation_indicators:
            if re.search(pattern, q, re.IGNORECASE):
                return True
        
        return False


# Global detector instance
_detector = AbstractionDetector()


def detect_abstraction_level(question: str) -> AbstractionResult:
    """
    Public interface for abstraction level detection.
    
    Args:
        question: The legal question text
        
    Returns:
        AbstractionResult with level and metadata
    """
    return _detector.detect_abstraction_level(question)
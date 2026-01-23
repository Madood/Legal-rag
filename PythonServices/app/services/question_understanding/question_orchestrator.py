"""
QUESTION ORCHESTRATOR - PURE DTO COMPOSER

STRICT ARCHITECTURAL RULE:
This module ONLY composes results from detectors. It NEVER:
- makes decisions about authority
- resolves legal references
- interprets legal content
- bypasses downstream validation

It is a MECHANICAL AGGREGATOR of epistemic signals.
"""

from dataclasses import dataclass, asdict
from typing import Dict, Any, Optional
import hashlib
import time
import json

from .intent_detector import detect_intent, IntentResult
from .abstraction_level import detect_abstraction_level, AbstractionResult
from .ambiguity_detector import detect_ambiguity, AmbiguityResult


@dataclass(frozen=True)
class UnderstandingSignals:
    """
    PURE DATA TRANSFER OBJECT
    
    Contains ONLY what was detected, NOT what should be done.
    All fields are read-only to prevent modification.
    """
    # Detection results
    intent: str
    intent_confidence: float
    abstraction: str
    abstraction_confidence: float
    technical_depth: str
    
    # Ambiguity state
    has_ambiguity: bool
    ambiguity_types: tuple  # Immutable
    clarification_questions: tuple  # Immutable
    blocking: bool
    
    # Context signals (NOT decisions)
    statute_referenced: Optional[str]
    has_legal_reference: bool
    language: str
    
    # Metadata (mechanical)
    question_hash: str
    analysis_timestamp: str
    
    @property
    def can_proceed(self) -> bool:
        """DERIVED PROPERTY - Not a decision, just a computation."""
        return not self.blocking


class OrchestrationError(Exception):
    """Exception for mechanical orchestration failures only."""
    pass


class QuestionOrchestrator:
    """
    MECHANICAL COMPOSER
    
    Architecture: Input → Detection → Composition → Output
    No reasoning, no decisions, no authority.
    """
    
    def __init__(self):
        # Constants - NOT configuration
        self._SIGNAL_VERSION = "1.0"
        self._HASH_PREFIX = "QU_"
        
    def orchestrate(self, question: str) -> UnderstandingSignals:
        """
        MECHANICAL COMPOSITION PROCESS
        
        Step 1: Validate input (non-epistemic)
        Step 2: Run detectors (black box)
        Step 3: Compose results (no interpretation)
        Step 4: Generate hash (deterministic)
        Step 5: Return immutable DTO
        
        Raises:
            OrchestrationError: Only for mechanical failures
        """
        # STEP 1: Input validation (non-epistemic)
        if not isinstance(question, str):
            raise OrchestrationError("Input must be string")
        
        q = question.strip()
        if not q:
            raise OrchestrationError("Empty question")
        
        if len(q) > 10000:
            raise OrchestrationError("Question too long")
        
        try:
            # STEP 2: Run detectors (NO modification, NO interpretation)
            intent_result = detect_intent(q)
            abstraction_result = detect_abstraction_level(q)
            ambiguity_result = detect_ambiguity(q)
            
            # STEP 3: Extract PURE signals (no decisions)
            statute_referenced = self._extract_statute_signal(q)
            has_legal_reference = self._extract_reference_signal(q)
            language = self._extract_language_signal(q)
            
            # STEP 4: Generate mechanical metadata
            question_hash = self._generate_hash(q)
            timestamp = self._generate_timestamp()
            
            # STEP 5: Compose immutable DTO
            return UnderstandingSignals(
                # Detection results
                intent=intent_result.intent.value,
                intent_confidence=intent_result.confidence,
                abstraction=abstraction_result.level.value,
                abstraction_confidence=abstraction_result.confidence,
                technical_depth=abstraction_result.technical_depth,
                
                # Ambiguity state
                has_ambiguity=ambiguity_result.has_ambiguity,
                ambiguity_types=tuple(ambiguity_result.ambiguities),
                clarification_questions=tuple(ambiguity_result.clarification_questions),
                blocking=ambiguity_result.blocking,
                
                # Context signals
                statute_referenced=statute_referenced,
                has_legal_reference=has_legal_reference,
                language=language,
                
                # Mechanical metadata
                question_hash=question_hash,
                analysis_timestamp=timestamp,
            )
            
        except Exception as e:
            # Capture ONLY mechanical failures
            raise OrchestrationError(f"Composition failed: {str(e)}")
    
    def _extract_statute_signal(self, question: str) -> Optional[str]:
        """
        MECHANICAL PATTERN MATCHING
        
        Returns: "StGB", "BGB", "GG", or None
        Never interprets, never decides, never validates.
        """
        import re
        
        patterns = {
            r'\bstgb\b': 'StGB',
            r'\bbgb\b': 'BGB',
            r'\bhgb\b': 'HGB',
            r'\bgg\b': 'GG',
            r'\bgdpr\b': 'GDPR',
        }
        
        lower_q = question.lower()
        for pattern, statute in patterns.items():
            if re.search(pattern, lower_q):
                return statute
        
        return None
    
    def _extract_reference_signal(self, question: str) -> bool:
        """
        MECHANICAL PATTERN DETECTION
        
        Returns: True if pattern found, False otherwise
        No validation of reference correctness.
        """
        import re
        
        reference_patterns = [
            r'§\s*\d+[a-z]?',
            r'artikel\s*\d+[a-z]?',
            r'article\s*\d+[a-z]?',
            r'paragraph\s*\d+[a-z]?',
        ]
        
        for pattern in reference_patterns:
            if re.search(pattern, question, re.IGNORECASE):
                return True
        
        return False
    
    def _extract_language_signal(self, question: str) -> str:
        """
        MECHANICAL LANGUAGE DETECTION
        
        Based on character frequency only.
        No semantic analysis.
        """
        # Count umlauts and ß
        german_chars = sum(1 for c in question if c in 'äöüÄÖÜß')
        
        # Count typical articles
        german_articles = question.lower().count('der') + question.lower().count('die') + question.lower().count('das')
        english_articles = question.lower().count('the') + question.lower().count('a ') + question.lower().count('an ')
        
        if german_chars > 0 or german_articles > english_articles:
            return 'german'
        else:
            return 'english'
    
    def _generate_hash(self, question: str) -> str:
        """Deterministic hash generation."""
        content = f"{self._HASH_PREFIX}{question}"
        return hashlib.sha256(content.encode()).hexdigest()[:12]
    
    def _generate_timestamp(self) -> str:
        """Mechanical timestamp."""
        return time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    
    def to_transport_dict(self, signals: UnderstandingSignals) -> Dict[str, Any]:
        """
        TRANSPORT SERIALIZATION
        
        Converts DTO to dict for transport.
        No transformation of meaning.
        """
        return {
            'version': self._SIGNAL_VERSION,
            'signals': asdict(signals),
            'provenance': 'question_understanding',
            'composition_time': time.time()
        }


# Global orchestrator instance
_orchestrator = QuestionOrchestrator()


def orchestrate_understanding(question: str) -> UnderstandingSignals:
    """
    PUBLIC INTERFACE - PURE ORCHESTRATION
    
    Usage:
        signals = orchestrate_understanding(question)
        # Pass signals to downstream layers
        # They decide what to do with them
    
    Returns:
        UnderstandingSignals: Immutable DTO of epistemic signals
    """
    return _orchestrator.orchestrate(question)


def get_transport_package(question: str) -> Dict[str, Any]:
    """
    TRANSPORT PACKAGER
    
    For API transport between services.
    """
    signals = orchestrate_understanding(question)
    return _orchestrator.to_transport_dict(signals)
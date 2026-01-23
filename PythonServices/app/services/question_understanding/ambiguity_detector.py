"""
Ambiguity Detector

Detects under-specified questions that must not be answered yet.
This is the legal conscience of the system.
"""

import re
from dataclasses import dataclass
from typing import List, Dict, Optional, Tuple
from enum import Enum


class AmbiguityType(str, Enum):
    """Types of legal ambiguities."""
    MISSING_STATUTE = "MISSING_STATUTE"
    MISSING_ARTICLE = "MISSING_ARTICLE"
    UNDEFINED_REFERENCE = "UNDEFINED_REFERENCE"
    MIXED_DOMAINS = "MIXED_DOMAINS"
    VAGUE_TERM = "VAGUE_TERM"
    JURISDICTION_UNCLEAR = "JURISDICTION_UNCLEAR"


AMBIGUITY_FLAGS = {
    AmbiguityType.MISSING_STATUTE: "No statute identified",
    AmbiguityType.MISSING_ARTICLE: "No article or paragraph specified",
    AmbiguityType.UNDEFINED_REFERENCE: "Undefined legal reference",
    AmbiguityType.MIXED_DOMAINS: "Mixed legal domains detected",
    AmbiguityType.VAGUE_TERM: "Vague or undefined term",
    AmbiguityType.JURISDICTION_UNCLEAR: "Jurisdiction unclear",
}


@dataclass
class AmbiguityResult:
    """Structured result of ambiguity detection."""
    has_ambiguity: bool
    ambiguities: List[AmbiguityType]
    clarification_questions: List[str]
    blocking: bool  # Whether to block answer completely
    confidence: float


class AmbiguityDetector:
    """Detects ambiguous or under-specified legal questions."""
    
    def __init__(self):
        # Statute patterns
        self.statute_patterns = [
            r'\bstgb\b',
            r'\bbgb\b',
            r'\bhgb\b',
            r'\bgg\b',
            r'\bgdpr\b',
            r'\bzpo\b',
            r'\bstpo\b',
            r'\bao\b',
            r'\beugh\b',  # EU Court of Justice
            r'\begmr\b',  # EU GDPR
        ]
        
        # Reference patterns
        self.reference_patterns = [
            r'§\s*\d+[a-z]?',
            r'artikel\s*\d+[a-z]?',
            r'article\s*\d+[a-z]?',
            r'paragraph\s*\d+[a-z]?',
            r'section\s*\d+[a-z]?',
        ]
        
        # Domain-specific terms
        self.domain_terms = {
            'criminal': [
                r'\bstrafrecht\b', r'\bcriminal\b', r'\bcrime\b',
                r'\bpenalty\b', r'\bstrafe\b', r'\bverbrechen\b',
            ],
            'civil': [
                r'\bzivilrecht\b', r'\bcivil law\b', r'\bcontract\b',
                r'\bvertrag\b', r'\bliability\b', r'\bhaftung\b',
            ],
            'commercial': [
                r'\bhandelsrecht\b', r'\bcommercial law\b', r'\bmerchant\b',
                r'\bkaufmann\b', r'\bcompany\b', r'\bunternehmen\b',
            ],
            'constitutional': [
                r'\bverfassungsrecht\b', r'\bconstitutional\b',
                r'\bfundamental right\b', r'\bgrundrecht\b',
            ],
            'procedural': [
                r'\bprozessrecht\b', r'\bprocedural law\b',
                r'\bcourt\b', r'\bgericht\b', r'\bprocedure\b',
            ]
        }
        
        # Vague terms that need clarification
        self.vague_terms = [
            r'\bthis right\b', r'\bthat law\b', r'\bit\b', r'\bthey\b',
            r'\bthe above\b', r'\bsuch\b', r'\bcertain\b',
            r'\bdieses recht\b', r'\bjenes gesetz\b', r'\bes\b',
        ]
        
        # Jurisdiction indicators
        self.jurisdiction_indicators = [
            r'\bgerman\b', r'\bdeutsch\b', r'\bEU\b', r'\beuropean\b',
            r'\binternational\b', r'\bnational\b', r'\bfederal\b',
            r'\bstate\b', r'\bländer\b', r'\bbundes\b',
        ]
    
    def detect_ambiguity(self, question: str) -> AmbiguityResult:
        """
        Detect ambiguities in legal questions.
        
        Args:
            question: The legal question text
            
        Returns:
            AmbiguityResult with detected ambiguities and clarification questions
        """
        q = question.lower().strip()
        ambiguities = []
        clarification_questions = []
        blocking = False
        
        # Check for missing statute
        if not self._has_statute(q) and self._needs_statute(q):
            ambiguities.append(AmbiguityType.MISSING_STATUTE)
            clarification_questions.append(
                "Which specific statute are you referring to? (e.g., StGB, BGB, GG)"
            )
            blocking = True
        
        # Check for incomplete references
        if self._has_incomplete_reference(q):
            ambiguities.append(AmbiguityType.MISSING_ARTICLE)
            clarification_questions.append(
                "Which specific article or paragraph number are you asking about?"
            )
            blocking = True
        
        # Check for undefined references
        if self._has_undefined_reference(q):
            ambiguities.append(AmbiguityType.UNDEFINED_REFERENCE)
            clarification_questions.append(
                "Could you clarify what you mean by this reference?"
            )
            blocking = True
        
        # Check for mixed domains
        if self._has_mixed_domains(q):
            ambiguities.append(AmbiguityType.MIXED_DOMAINS)
            clarification_questions.append(
                "This question seems to mix different legal domains. "
                "Could you specify which legal area you're focusing on?"
            )
            blocking = True
        
        # Check for vague terms
        if self._has_vague_terms(q):
            ambiguities.append(AmbiguityType.VAGUE_TERM)
            clarification_questions.append(
                "Some terms in your question are unclear. "
                "Could you provide more specific references?"
            )
            blocking = len(ambiguities) > 2  # Block only if multiple issues
        
        # Check for jurisdiction ambiguity
        if not self._has_clear_jurisdiction(q):
            ambiguities.append(AmbiguityType.JURISDICTION_UNCLEAR)
            clarification_questions.append(
                "Which jurisdiction are you interested in? "
                "(e.g., German law, EU law, international law)"
            )
            # Jurisdiction is important but not always blocking
            blocking = blocking or len(ambiguities) > 1
        
        # Calculate confidence
        confidence = self._calculate_confidence(q, ambiguities)
        
        return AmbiguityResult(
            has_ambiguity=len(ambiguities) > 0,
            ambiguities=ambiguities,
            clarification_questions=clarification_questions,
            blocking=blocking,
            confidence=confidence
        )
    
    def _has_statute(self, question: str) -> bool:
        """Check if question contains a statute reference."""
        for pattern in self.statute_patterns:
            if re.search(pattern, question, re.IGNORECASE):
                return True
        return False
    
    def _needs_statute(self, question: str) -> bool:
        """
        Determine if a question REQUIRES a statute to be specified.
        
        JURISPRUDENTIAL INVARIANT:
        - Pure DEFINITION questions do NOT require statutes
        - Application, rights, obligations, sanctions DO require statutes
        
        Returns:
            True if statute is required, False otherwise
        """
        q = question.lower()
        
        # -------------------------------------------------
        # 1. EXPLICIT STATUTE DEMAND → needs statute
        # -------------------------------------------------
        statute_demand_patterns = [
            r'\baccording to\b',
            r'\bnach\b',
            r'\bwhich law\b',
            r'\bwhat law\b',
            r'\bwhich statute\b',
            r'\bwelches gesetz\b',
            r'\bgesetzlich\b',
            r'\bunder\b',
            r'\bunder which\b',
            r'\bunter\b',
        ]
        
        for pattern in statute_demand_patterns:
            if re.search(pattern, q):
                return True
        
        # -------------------------------------------------
        # 2. NORMATIVE / APPLICATION / SANCTION QUESTIONS
        # -------------------------------------------------
        normative_patterns = [
            # Rights, obligations
            r'\brights?\b',
            r'\bobligations?\b',
            r'\bduties?\b',
            r'\bpflichten?\b',
            r'\brechte\b',
            
            # Requirements, conditions
            r'\brequirements?\b',
            r'\bvoraussetzungen\b',
            r'\bconditions?\b',
            r'\bbedingungen\b',
            
            # Sanctions, penalties
            r'\bpenalt(?:y|ies)\b',
            r'\bstrafe[n]?\b',
            r'\bpunishment\b',
            r'\bbestrafung\b',
            r'\bsanctions?\b',
            r'\bsanktionen\b',
            
            # Liability, responsibility
            r'\bliability\b',
            r'\bhaftung\b',
            r'\bresponsibility\b',
            r'\bverantwortung\b',
            
            # Claims, applications
            r'\bclaims?\b',
            r'\banspruch\b',
            r'\bansprüche\b',
            r'\bapplication\b',
            r'\banwendung\b',
            
            # Procedures, processes
            r'\bprocedures?\b',
            r'\bverfahren\b',
            r'\bprozess\b',
            r'\bprocess\b',
            
            # Effects, consequences
            r'\beffects?\b',
            r'\bwirkung\b',
            r'\bconsequences?\b',
            r'\bfolgen\b',
            
            # Comparative/relative questions
            r'\bwhat are the\b',
            r'\bhow are\b',
            r'\bwie sind\b',
            r'\bwas sind die\b',
        ]
        
        for pattern in normative_patterns:
            if re.search(pattern, q):
                return True
        
        # -------------------------------------------------
        # 3. PURE DEFINITIONS → NO statute needed
        # -------------------------------------------------
        pure_definition_patterns = [
            r'^what is\b',
            r'^define\b',
            r'^explain\b',
            r'^erklären\b',
            r'^meaning of\b',
            r'^bedeutung\b',
            r'^begriff\b',
            r'\bwhat does.*mean\b',
            r'\bwas bedeutet\b',
            r'\bdefinition of\b',
            r'\bdefiniere\b',
        ]
        
        for pattern in pure_definition_patterns:
            if re.search(pattern, q):
                return False  # 🔥 THE FIX: Pure definitions don't need statutes
        
        # -------------------------------------------------
        # 4. LEGAL CONCEPTS WITH IMPLICIT STATUTE CONTEXT
        # -------------------------------------------------
        # These often require statutes for clarity
        implicit_statute_contexts = [
            r'\bhow does.*work\b',
            r'\bwie funktioniert\b',
            r'\bapply\b',
            r'\banwenden\b',
            r'\binterpret\b',
            r'\bauslegen\b',
        ]
        
        for pattern in implicit_statute_contexts:
            if re.search(pattern, q):
                return True
        
        # -------------------------------------------------
        # 5. DEFAULT: no statute requirement
        # -------------------------------------------------
        return False
    
    def _has_incomplete_reference(self, question: str) -> bool:
        """Check for incomplete legal references."""
        # Patterns that indicate a reference without number
        incomplete_patterns = [
            r'§\s*(?!\d)',  # § without number
            r'artikel\s*(?!\d)',  # Artikel without number
            r'article\s*(?!\d)',  # Article without number
            r'explain (?:the )?(?:article|§)',  # Explain article/§ without spec
            r'was (?:besagt|regelt) (?:der |die )?(?:artikel|§)',  # German equivalent
        ]
        
        for pattern in incomplete_patterns:
            if re.search(pattern, question, re.IGNORECASE):
                return True
        return False
    
    def _has_undefined_reference(self, question: str) -> bool:
        """Check for undefined references (this, that, it)."""
        for pattern in self.vague_terms:
            if re.search(pattern, question, re.IGNORECASE):
                # Check if it's in a legal context
                legal_context = re.search(
                    r'(?:this|that|it)\s+(?:right|law|article|§|principle)',
                    question,
                    re.IGNORECASE
                )
                if legal_context:
                    return True
        return False
    
    def _has_mixed_domains(self, question: str) -> bool:
        """Check for mixed legal domains."""
        domain_counts = {}
        
        for domain, terms in self.domain_terms.items():
            count = 0
            for term in terms:
                if re.search(term, question, re.IGNORECASE):
                    count += 1
            if count > 0:
                domain_counts[domain] = count
        
        # If more than one domain has significant presence
        significant_domains = sum(1 for count in domain_counts.values() if count >= 2)
        return significant_domains > 1
    
    def _has_vague_terms(self, question: str) -> bool:
        """Check for vague legal terms."""
        vague_patterns = self.vague_terms + [
            r'\bthe law\b', r'\bdas gesetz\b',  # Too generic
            r'\bsomething\b', r'\betwas\b',
            r'\bcertain things\b', r'\bgewisse dinge\b',
        ]
        
        for pattern in vague_patterns:
            if re.search(pattern, question, re.IGNORECASE):
                return True
        return False
    
    def _has_clear_jurisdiction(self, question: str) -> bool:
        """Check if jurisdiction is clear."""
        # Count jurisdiction indicators
        jurisdiction_count = 0
        for pattern in self.jurisdiction_indicators:
            if re.search(pattern, question, re.IGNORECASE):
                jurisdiction_count += 1
        
        # If no jurisdiction indicators but has legal terms, it's unclear
        if jurisdiction_count == 0:
            legal_terms_present = any(
                re.search(pattern, question, re.IGNORECASE)
                for pattern in [r'§', r'artikel', r'law', r'recht', r'gesetz']
            )
            if legal_terms_present:
                return False
        
        return jurisdiction_count > 0
    
    def _calculate_confidence(self, question: str, ambiguities: List[AmbiguityType]) -> float:
        """Calculate confidence in ambiguity detection."""
        base_confidence = 0.7
        
        # Adjust based on number of ambiguities
        if len(ambiguities) == 0:
            return 0.9  # High confidence if no ambiguities
        
        # Increase confidence with more specific ambiguity types
        specific_ambiguities = [
            AmbiguityType.MISSING_ARTICLE,
            AmbiguityType.MISSING_STATUTE,
        ]
        
        specific_count = sum(1 for amb in ambiguities if amb in specific_ambiguities)
        if specific_count > 0:
            base_confidence += 0.2 * specific_count
        
        return min(base_confidence, 0.95)


# Global detector instance
_detector = AmbiguityDetector()


def detect_ambiguity(question: str) -> AmbiguityResult:
    """
    Public interface for ambiguity detection.
    
    Args:
        question: The legal question text
        
    Returns:
        AmbiguityResult with detected ambiguities
    """
    return _detector.detect_ambiguity(question)
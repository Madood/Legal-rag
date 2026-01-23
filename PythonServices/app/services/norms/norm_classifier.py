"""
Norm Classifier - Gatekeeper of the norms layer.

Classifies text segments as normative types without interpretation.
Distinguishes binding norms from descriptive text.

Architectural Role: Decides WHAT is a binding norm, not WHAT it means.
"""

from enum import Enum
from typing import Dict, List, Tuple, Optional, Any
from dataclasses import dataclass


class NormType(Enum):
    """Taxonomy of normative statement types."""
    OBLIGATION = "obligation"      # shall, must, is required to
    PROHIBITION = "prohibition"    # shall not, must not, may not
    PERMISSION = "permission"      # may, is permitted to
    RIGHT = "right"                # is entitled to, has the right to
    CONDITION = "condition"        # if, when, provided that
    EXCEPTION = "exception"        # except, unless, notwithstanding
    DEFINITION = "definition"      # means, includes, refers to
    DOCTRINAL = "doctrinal"        # ========== ADDED: Doctrine type ==========
    NON_NORMATIVE = "non_normative"  # descriptive text


class NormStrength(Enum):
    """Strength of normative force."""
    MANDATORY = "mandatory"      # must, shall (binding)
    DISCRETIONARY = "discretionary"  # may, can (optional)
    DESCRIPTIVE = "descriptive"  # non-binding
    # ========== ADDED: Doctrine strength ==========
    DOCTRINAL = "doctrinal"      # doctrinal principles (conceptual, not operative)


@dataclass
class ClassificationResult:
    """Result of norm classification."""
    norm_type: NormType
    strength: NormStrength
    confidence: float  # 0.0 to 1.0
    markers: List[str]  # Linguistic markers found
    text_segment: str
    # ========== ADDED: Metadata for doctrinal context ==========
    question_type: Optional[str] = None
    detected_doctrine: Optional[str] = None


class NormClassifier:
    """
    Classifies text as normative/non-normative and identifies norm type.
    
    Responsibilities:
    1. Detect binding norms vs descriptive text
    2. Classify norm type (obligation, prohibition, etc.)
    3. Assign norm strength and confidence
    4. Identify linguistic markers
    
    Non-Responsibilities:
    ❌ Extract paragraphs
    ❌ Validate correctness
    ❌ Rank statutes
    ❌ Decide legal consequences
    """
    
    # Normative language markers by jurisdiction/language
    OBLIGATION_MARKERS = {"shall", "must", "is required to", "has to", "will"}
    PROHIBITION_MARKERS = {"shall not", "must not", "may not", "cannot", "prohibited"}
    PERMISSION_MARKERS = {"may", "can", "is permitted to", "allowed to"}
    RIGHT_MARKERS = {"is entitled to", "has the right to", "right to", "may claim"}
    CONDITION_MARKERS = {"if", "when", "provided that", "in case", "where"}
    EXCEPTION_MARKERS = {"except", "unless", "notwithstanding", "however"}
    DEFINITION_MARKERS = {"means", "includes", "refers to", "defined as"}
    
    # ========== ADDED: Doctrinal language markers ==========
    DOCTRINAL_MARKERS = {
        "principle", "grundsatz", "doctrine", "lehre", "theorie",
        "maxim", "rule", "canon", "tenet", "precept", "axiom",
        "standard", "criterion", "test", "approach", "methodology",
        "dogma", "teaching", "premise", "assumption"
    }
    
    # Doctrinal principle names (German and English)
    SETTLED_DOCTRINES = {
        "schuldprinzip", "guilt principle",
        "nulla poena sine lege", "no punishment without law",
        "verhältnismäßigkeitsprinzip", "proportionality principle",
        "rechtsstaatsprinzip", "rule of law principle",
        "bestimmtheitsgrundsatz", "determinacy principle",
        "vertrauensschutzprinzip", "protection of legitimate expectations",
        "ne bis in idem", "double jeopardy",
        "in dubio pro reo", "benefit of the doubt",
        "trennungsprinzip", "separation principle",
        "abstraktionsprinzip", "abstraction principle",
        "waffengleichheit", "equality of arms",
        "rechtliches gehör", "right to be heard",
        "fair trial", "fair hearing",
        "öffentlichkeitsgrundsatz", "principle of public proceedings",
        "unmittelbarkeitsgrundsatz", "immediacy principle"
    }
    
    # Descriptive indicators (negative markers)
    DESCRIPTIVE_MARKERS = {
        "for example", "such as", "including but not limited to",
        "the purpose of", "this act", "recital", "preamble"
    }
    
    def __init__(self, language: str = "en"):
        """Initialize classifier for specific language."""
        self.language = language
        self.initialized_with_context = False
        self.current_question_type = None
        self.current_detected_doctrine = None
        
    def set_classification_context(self, question_type: Optional[str] = None, 
                                   detected_doctrine: Optional[str] = None) -> None:
        """
        Set context for classification (e.g., from intent detector).
        
        Args:
            question_type: Type of question being asked (from intent detector)
            detected_doctrine: Specific doctrine detected in question
        """
        self.initialized_with_context = True
        self.current_question_type = question_type
        self.current_detected_doctrine = detected_doctrine
        
    def classify(self, text: str, context: Optional[Dict[str, Any]] = None) -> ClassificationResult:
        """
        Classify a text segment as normative or descriptive.
        
        Args:
            text: Clean text segment (sentence or clause)
            context: Optional context dictionary containing:
                - question_type: Type of question being asked
                - detected_doctrine: Specific doctrine detected
                - doctrinal_stability: Stability of doctrine if known
                
        Returns:
            ClassificationResult with type, strength, confidence
        """
        # ========== ADDED: Context-aware classification ==========
        # Extract context if provided
        question_type = None
        detected_doctrine = None
        
        if context:
            question_type = context.get("question_type")
            detected_doctrine = context.get("detected_doctrine")
        elif self.initialized_with_context:
            question_type = self.current_question_type
            detected_doctrine = self.current_detected_doctrine
        
        text_lower = text.strip().lower()
        
        # ========== ADDED: Early detection for doctrinal content ==========
        # If the question is about a doctrine OR the text contains doctrinal content,
        # classify as DOCTRINAL to prevent norm-based penalties
        if question_type == "DOCTRINE" or self._is_doctrinal_content(text_lower, detected_doctrine):
            return ClassificationResult(
                norm_type=NormType.DOCTRINAL,
                strength=NormStrength.DOCTRINAL,
                confidence=self._calculate_doctrinal_confidence(text_lower, detected_doctrine),
                markers=self._find_markers(text_lower, self.DOCTRINAL_MARKERS),
                text_segment=text,
                question_type=question_type,
                detected_doctrine=detected_doctrine
            )
        # ========== END ADDED ==========
        
        # Check for non-normative descriptive text first
        if self._is_descriptive(text_lower):
            return ClassificationResult(
                norm_type=NormType.NON_NORMATIVE,
                strength=NormStrength.DESCRIPTIVE,
                confidence=0.95,
                markers=self._find_markers(text_lower, self.DESCRIPTIVE_MARKERS),
                text_segment=text,
                question_type=question_type,
                detected_doctrine=detected_doctrine
            )
        
        # Classify normative text
        norm_type, markers, confidence = self._classify_normative(text_lower)
        strength = self._determine_strength(norm_type, markers)
        
        return ClassificationResult(
            norm_type=norm_type,
            strength=strength,
            confidence=confidence,
            markers=markers,
            text_segment=text,
            question_type=question_type,
            detected_doctrine=detected_doctrine
        )
    
    # ========== ADDED: Doctrine detection methods ==========
    def _is_doctrinal_content(self, text: str, detected_doctrine: Optional[str] = None) -> bool:
        """Determine if text contains doctrinal content."""
        # Check for direct mention of settled doctrines
        for doctrine in self.SETTLED_DOCTRINES:
            if doctrine in text:
                return True
        
        # Check for doctrinal markers
        if any(marker in text for marker in self.DOCTRINAL_MARKERS):
            # Additional check to avoid false positives
            # Look for doctrinal context patterns
            doctrinal_patterns = [
                r'\bprinciple of\b',
                r'\bdoctrine that\b',
                r'\blegal principle\b',
                r'\bgrundsatz\b',
                r'\brechtslehre\b',
                r'\btheorie\b',
            ]
            
            import re
            if any(re.search(pattern, text) for pattern in doctrinal_patterns):
                return True
        
        # Check if text is about a specific detected doctrine
        if detected_doctrine and detected_doctrine.lower() in text:
            return True
        
        return False
    
    def _calculate_doctrinal_confidence(self, text: str, detected_doctrine: Optional[str] = None) -> float:
        """Calculate confidence score for doctrinal classification."""
        base_confidence = 0.9  # High base confidence for doctrines
        
        # Boost confidence if specific doctrine is mentioned
        if detected_doctrine and detected_doctrine.lower() in text:
            return 1.0
        
        # Check for multiple doctrinal markers
        markers_found = self._find_markers(text, self.DOCTRINAL_MARKERS)
        if len(markers_found) > 1:
            base_confidence += 0.05
        
        # Check for direct doctrine names
        for doctrine in self.SETTLED_DOCTRINES:
            if doctrine in text:
                base_confidence = 1.0
                break
        
        return min(max(base_confidence, 0.8), 1.0)
    # ========== END ADDED ==========
    
    def _is_descriptive(self, text: str) -> bool:
        """Determine if text is descriptive/non-normative."""
        # Check for descriptive markers
        for marker in self.DESCRIPTIVE_MARKERS:
            if marker in text:
                return True
        
        # Check for weak normative language
        if "should" in text or "ought to" in text:
            return True
            
        return False
    
    def _classify_normative(self, text: str) -> Tuple[NormType, List[str], float]:
        """Classify the type of normative statement."""
        # Find all markers present
        found_markers = []
        marker_groups = [
            (self.OBLIGATION_MARKERS, NormType.OBLIGATION),
            (self.PROHIBITION_MARKERS, NormType.PROHIBITION),
            (self.PERMISSION_MARKERS, NormType.PERMISSION),
            (self.RIGHT_MARKERS, NormType.RIGHT),
            (self.CONDITION_MARKERS, NormType.CONDITION),
            (self.EXCEPTION_MARKERS, NormType.EXCEPTION),
            (self.DEFINITION_MARKERS, NormType.DEFINITION),
        ]
        
        best_type = NormType.NON_NORMATIVE
        best_markers = []
        best_confidence = 0.0
        
        for markers, norm_type in marker_groups:
            type_markers = self._find_markers(text, markers)
            if type_markers:
                confidence = self._calculate_confidence(text, type_markers, norm_type)
                if confidence > best_confidence:
                    best_confidence = confidence
                    best_type = norm_type
                    best_markers = type_markers
        
        # Default to obligation if no clear markers but strong normative language
        if best_type == NormType.NON_NORMATIVE and self._has_strong_normative_syntax(text):
            best_type = NormType.OBLIGATION
            best_confidence = 0.7
            best_markers = ["implicit obligation"]
        
        return best_type, best_markers, best_confidence
    
    def _find_markers(self, text: str, markers_set: set) -> List[str]:
        """Find which markers from a set appear in the text."""
        found = []
        for marker in markers_set:
            if marker in text:
                found.append(marker)
        return found
    
    def _calculate_confidence(self, text: str, markers: List[str], norm_type: NormType) -> float:
        """Calculate confidence score for classification."""
        base_confidence = 0.8
        
        # Increase confidence for multiple markers
        if len(markers) > 1:
            base_confidence += 0.1
        
        # Decrease confidence for ambiguous markers
        if "may" in markers and norm_type == NormType.PERMISSION:
            # "may" can sometimes be obligation in legal context
            if "may not" in text:  # Actually a prohibition
                return 0.3
            base_confidence -= 0.1
        
        return min(max(base_confidence, 0.0), 1.0)
    
    def _determine_strength(self, norm_type: NormType, markers: List[str]) -> NormStrength:
        """Determine normative strength based on type and markers."""
        if norm_type == NormType.NON_NORMATIVE:
            return NormStrength.DESCRIPTIVE
        
        # ========== MODIFIED: Handle DOCTRINAL type ==========
        if norm_type == NormType.DOCTRINAL:
            return NormStrength.DOCTRINAL
        # ========== END MODIFIED ==========
        
        if norm_type in [NormType.OBLIGATION, NormType.PROHIBITION]:
            return NormStrength.MANDATORY
        
        if norm_type in [NormType.PERMISSION, NormType.RIGHT]:
            return NormStrength.DISCRETIONARY
        
        # Conditions and exceptions can be either
        if "must" in markers or "shall" in markers:
            return NormStrength.MANDATORY
        else:
            return NormStrength.DISCRETIONARY
    
    def _has_strong_normative_syntax(self, text: str) -> bool:
        """Check for strong normative syntax without clear markers."""
        # Check for imperative structure or legal formula
        if text.startswith(("the court shall", "the parties shall", "it shall be")):
            return True
        return False

    # ========== ADDED: Batch classification with context ==========
    def classify_batch(self, texts: List[str], context: Optional[Dict[str, Any]] = None) -> List[ClassificationResult]:
        """
        Classify multiple text segments with shared context.
        
        Args:
            texts: List of text segments to classify
            context: Shared context for all classifications
            
        Returns:
            List of ClassificationResult objects
        """
        results = []
        for text in texts:
            result = self.classify(text, context)
            results.append(result)
        return results

    # ========== ADDED: Method to check if classification should be doctrinal ==========
    def should_classify_as_doctrinal(self, text: str, question_type: Optional[str] = None) -> bool:
        """
        Determine if text should be classified as DOCTRINAL based on content and context.
        
        Args:
            text: Text to classify
            question_type: Type of question being asked
            
        Returns:
            True if should be classified as DOCTRINAL
        """
        text_lower = text.lower().strip()
        
        # Always classify as DOCTRINAL if question is about doctrine
        if question_type == "DOCTRINE":
            return True
        
        # Check for doctrinal content
        return self._is_doctrinal_content(text_lower)


# Global classifier instance with default settings
classifier = NormClassifier()


def classify_norm(text: str, context: Optional[Dict[str, Any]] = None) -> ClassificationResult:
    """
    Public interface for norm classification.
    
    Args:
        text: Text to classify
        context: Optional classification context
        
    Returns:
        ClassificationResult with norm type and metadata
    """
    return classifier.classify(text, context)


def classify_norms_batch(texts: List[str], context: Optional[Dict[str, Any]] = None) -> List[ClassificationResult]:
    """
    Public interface for batch norm classification.
    
    Args:
        texts: List of texts to classify
        context: Optional shared context
        
    Returns:
        List of ClassificationResult objects
    """
    return classifier.classify_batch(texts, context)


def set_classification_context(question_type: Optional[str] = None, 
                               detected_doctrine: Optional[str] = None) -> None:
    """
    Set global classification context.
    
    Args:
        question_type: Type of question being asked
        detected_doctrine: Specific doctrine detected
    """
    classifier.set_classification_context(question_type, detected_doctrine)
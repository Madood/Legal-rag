"""
REFUSAL LOGIC
=============

Determines when the system must refuse to answer to protect legal correctness.
This is a legal act, not technical error handling.
"""

from enum import Enum
from typing import Dict, Any, Optional, List, Tuple
from dataclasses import dataclass, field
import logging
import re
from .epistemology import EpistemicAssessment, LegalDomain, QuestionType
from .confidence_adjuster import ConfidenceAdjustment

logger = logging.getLogger(__name__)


class RefusalType(Enum):
    """Types of refusal."""
    HARD_REFUSAL = "hard_refusal"          # No answer generated
    SOFT_REFUSAL = "soft_refusal"          # Clarification required
    PARTIAL_REFUSAL = "partial_refusal"    # Overview allowed, details blocked
    REDIRECTION = "redirection"            # Redirect to appropriate statute
    DISCLAIMER_REQUIRED = "disclaimer"     # Answer with strong disclaimer


class RefusalReason(Enum):
    """Reasons for refusal."""
    STATUTE_CONFLICT = "statute_conflict"           # Wrong statute for question
    MISSING_ANCHOR_NORM = "missing_anchor_norm"     # No defining norm
    OVERREACH = "overreach"                         # Authority insufficient for question type
    AMBIGUITY = "ambiguity"                         # Multiple interpretations possible
    DOMAIN_CONTAMINATION = "domain_contamination"   # Cross-domain issues
    NORM_CONFLICT = "norm_conflict"                 # Conflicting legal provisions
    INSUFFICIENT_AUTHORITY = "insufficient_authority" # Not enough authority
    SAFETY_RISK = "safety_risk"                     # Potential harm or error
    LEGAL_COMPLEXITY = "legal_complexity"           # Too complex for current mode


@dataclass
class RefusalDecision:
    """Complete refusal decision."""
    
    refusal_required: bool
    refusal_type: Optional[RefusalType] = None
    refusal_reason: Optional[RefusalReason] = None
    
    # Human explanations
    explanation: str = ""
    user_message: str = ""  # What to show the user
    internal_reasoning: List[str] = field(default_factory=list)
    
    # Recommendations
    recommended_next_step: str = ""
    suggested_clarification: Optional[str] = None
    alternative_mode: Optional[str] = None  # e.g., "overview" instead of "exact"
    
    # Metadata
    override_possible: bool = False  # Can user override?
    requires_human_review: bool = False
    
    def to_dict(self) -> Dict:
        """Convert to dictionary for JSON serialization."""
        return {
            "refusal_required": self.refusal_required,
            "refusal_type": self.refusal_type.value if self.refusal_type else None,
            "refusal_reason": self.refusal_reason.value if self.refusal_reason else None,
            "explanation": self.explanation,
            "user_message": self.user_message,
            "internal_reasoning": self.internal_reasoning,
            "recommended_next_step": self.recommended_next_step,
            "suggested_clarification": self.suggested_clarification,
            "alternative_mode": self.alternative_mode,
            "override_possible": self.override_possible,
            "requires_human_review": self.requires_human_review,
        }


class RefusalLogic:
    """
    Implements principled refusal logic for legal correctness.
    """
    
    def __init__(self):
        self.logger = logging.getLogger(__name__)
        
        # Statute-question type appropriateness matrix
        # This should be expanded with actual legal knowledge
        self.STATUTE_APPROPRIATENESS = {
            # Format: (statute_pattern, question_type): (appropriate, refusal_type, reason)
            # Criminal law (StGB) is not appropriate for contract law questions
            (r"StGB", QuestionType.APPLICATION): (False, RefusalType.HARD_REFUSAL, RefusalReason.STATUTE_CONFLICT),
            
            # Civil code (BGB) is not appropriate for criminal procedure questions
            (r"BGB", QuestionType.INTERPRETATION): (False, RefusalType.HARD_REFUSAL, RefusalReason.STATUTE_CONFLICT),
            
            # Administrative law questions should use appropriate statutes
            (r"VwVfG", QuestionType.DEFINITION): (True, None, None),  # Administrative Procedure Act
            (r"VwGO", QuestionType.PROCEDURE): (True, None, None),    # Administrative Court Rules
            
            # Criminal code for criminal law questions
            (r"StGB", QuestionType.APPLICATION): (True, None, None),
            (r"StGB", QuestionType.CONSEQUENCE): (True, None, None),
            (r"StGB", QuestionType.DEFINITION): (True, None, None),
            
            # Civil code for civil law questions
            (r"BGB", QuestionType.APPLICATION): (True, None, None),
            (r"BGB", QuestionType.INTERPRETATION): (True, None, None),
            (r"BGB", QuestionType.DEFINITION): (True, None, None),
        }
        
        # Question type authority requirements
        self.QUESTION_AUTHORITY_REQUIREMENTS = {
            QuestionType.CONSEQUENCE: {
                "min_epistemic": "SUPPORTED",
                "requires_exact_match": False,
                "requires_anchor_norm": True,
                "overreach_refusal": RefusalType.PARTIAL_REFUSAL,
            },
            QuestionType.DEFINITION: {
                "min_epistemic": "SUPPORTED",
                "requires_exact_match": True,
                "requires_anchor_norm": True,
                "overreach_refusal": RefusalType.HARD_REFUSAL,
            },
            QuestionType.APPLICATION: {
                "min_epistemic": "INFERRED",
                "requires_exact_match": False,
                "requires_anchor_norm": True,
                "overreach_refusal": RefusalType.PARTIAL_REFUSAL,
            },
            QuestionType.INTERPRETATION: {
                "min_epistemic": "SUPPORTED",
                "requires_exact_match": False,
                "requires_anchor_norm": True,
                "overreach_refusal": RefusalType.SOFT_REFUSAL,
            },
            QuestionType.PROCEDURE: {
                "min_epistemic": "SUPPORTED",
                "requires_exact_match": True,
                "requires_anchor_norm": True,
                "overreach_refusal": RefusalType.HARD_REFUSAL,
            },
            QuestionType.SYSTEM: {
                "min_epistemic": "INFERRED",
                "requires_exact_match": False,
                "requires_anchor_norm": False,
                "overreach_refusal": RefusalType.SOFT_REFUSAL,
            },
            QuestionType.DOCTRINE: {
                "min_epistemic": "SUPPORTED",
                "requires_exact_match": False,
                "requires_anchor_norm": False,
                "overreach_refusal": RefusalType.PARTIAL_REFUSAL,
            },
            QuestionType.COMPARISON: {
                "min_epistemic": "SUPPORTED",
                "requires_exact_match": False,
                "requires_anchor_norm": False,
                "overreach_refusal": RefusalType.PARTIAL_REFUSAL,
            },
        }
    
    def evaluate_refusal(
        self,
        epistemic_assessment: EpistemicAssessment,
        confidence_adjustment: ConfidenceAdjustment,
        authority_mode: str,
        question_text: str,
        user_context: Optional[Dict] = None
    ) -> RefusalDecision:
        """
        Evaluate whether refusal is required.
        
        Args:
            epistemic_assessment: Epistemic assessment
            confidence_adjustment: Confidence adjustment
            authority_mode: Current authority mode
            question_text: Original question text
            user_context: User context and preferences
            
        Returns:
            Refusal decision
        """
        self.logger.info(f"Evaluating refusal for {epistemic_assessment.question_type.value} question")
        
        # Check for hard refusal conditions first
        hard_refusal = self._check_hard_refusal_conditions(
            epistemic_assessment, confidence_adjustment
        )
        if hard_refusal:
            return hard_refusal
        
        # Check for soft refusal conditions
        soft_refusal = self._check_soft_refusal_conditions(
            epistemic_assessment, confidence_adjustment, authority_mode
        )
        if soft_refusal:
            return soft_refusal
        
        # Check for partial refusal
        partial_refusal = self._check_partial_refusal_conditions(
            epistemic_assessment, confidence_adjustment, authority_mode, question_text
        )
        if partial_refusal:
            return partial_refusal
        
        # Check for disclaimer requirement
        disclaimer_required = self._check_disclaimer_requirement(
            epistemic_assessment, confidence_adjustment
        )
        if disclaimer_required:
            return disclaimer_required
        
        # No refusal required
        return RefusalDecision(
            refusal_required=False,
            explanation="Answer is epistemically justified",
            user_message="",
            recommended_next_step="Proceed with answer generation",
        )
    
    def _check_hard_refusal_conditions(
        self,
        epistemic_assessment: EpistemicAssessment,
        confidence_adjustment: ConfidenceAdjustment
    ) -> Optional[RefusalDecision]:
        """Check conditions that require hard refusal."""
        
        # 1. Invalid epistemic level
        if epistemic_assessment.epistemic_level.name == "INVALID":
            return self._create_hard_refusal(
                reason=RefusalReason.STATUTE_CONFLICT,
                explanation="Inappropriate statutory authority for the question domain",
                user_message=(
                    "I cannot provide an answer because the legal authority cited "
                    "is not appropriate for this type of question. Please consult "
                    "the relevant statute or seek legal advice."
                ),
                recommended_next_step="Consult appropriate legal authority",
            )
        
        # 2. Statute conflict based on rules
        statute = epistemic_assessment.authority_evidence.statute
        if statute:
            conflict = self._check_statute_conflict(
                statute, epistemic_assessment.question_type
            )
            if conflict:
                appropriate, refusal_type, reason = conflict
                if not appropriate:
                    return self._create_hard_refusal(
                        reason=reason,
                        explanation=f"Statute {statute} is not appropriate for {epistemic_assessment.question_type.value} questions",
                        user_message=(
                            f"The {statute} does not govern this type of legal question. "
                            "Please refer to the appropriate legal code."
                        ),
                        recommended_next_step=f"Consult relevant statute for {epistemic_assessment.question_type.value} questions",
                    )
        
        # 3. Insufficient authority for question type
        requirements = self.QUESTION_AUTHORITY_REQUIREMENTS.get(
            epistemic_assessment.question_type
        )
        if requirements:
            min_epistemic = requirements["min_epistemic"]
            current_epistemic = epistemic_assessment.epistemic_level.name
            
            # Check if current epistemic level meets minimum requirement
            epistemic_hierarchy = [
                "INVALID", "INSUFFICIENT", "OVERVIEW_ONLY", "INFERRED", 
                "SUPPORTED", "CERTAIN"
            ]
            
            current_index = epistemic_hierarchy.index(current_epistemic)
            min_index = epistemic_hierarchy.index(min_epistemic)
            
            if current_index < min_index:
                return self._create_hard_refusal(
                    reason=RefusalReason.INSUFFICIENT_AUTHORITY,
                    explanation=(
                        f"Question type '{epistemic_assessment.question_type.value}' "
                        f"requires at least {min_epistemic} authority, "
                        f"but only {current_epistemic} is available"
                    ),
                    user_message=(
                        "I cannot provide a definitive answer to this legal question "
                        "with the available authority. This question requires "
                        "more specific legal provisions than I currently have access to."
                    ),
                    recommended_next_step="Provide more specific legal context or consult primary sources",
                    override_possible=False,
                )
        
        # 4. Conflicting norms
        if epistemic_assessment.has_conflicting_norms:
            return self._create_hard_refusal(
                reason=RefusalReason.NORM_CONFLICT,
                explanation="Conflicting legal provisions detected",
                user_message=(
                    "I have identified conflicting legal provisions that cannot "
                    "be resolved automatically. Legal interpretation is required "
                    "to determine the correct application."
                ),
                recommended_next_step="Seek legal interpretation from qualified professional",
                requires_human_review=True,
            )
        
        return None
    
    def _check_statute_conflict(
        self, statute: str, question_type: QuestionType
    ) -> Optional[Tuple[bool, RefusalType, RefusalReason]]:
        """Check if statute is appropriate for question type."""
        for (pattern, q_type), (appropriate, refusal_type, reason) in self.STATUTE_APPROPRIATENESS.items():
            if re.match(pattern, statute) and q_type == question_type:
                return (appropriate, refusal_type, reason)
        return None
    
    def _check_soft_refusal_conditions(
        self,
        epistemic_assessment: EpistemicAssessment,
        confidence_adjustment: ConfidenceAdjustment,
        authority_mode: str
    ) -> Optional[RefusalDecision]:
        """Check conditions that require clarification."""
        
        # 1. Epistemic assessment requires clarification
        if epistemic_assessment.requires_clarification:
            return self._create_soft_refusal(
                reason=RefusalReason.AMBIGUITY,
                explanation="Epistemic assessment indicates need for clarification",
                user_message=(
                    "To provide an accurate answer, I need clarification on your question. "
                    "Could you specify which aspect of the law you're interested in, "
                    "or provide more context about your situation?"
                ),
                suggested_clarification="Please clarify the specific legal aspect or context",
                recommended_next_step="Request clarification from user",
            )
        
        # 2. Mode inappropriate but could work with clarification
        if not confidence_adjustment.mode_appropriate:
            return self._create_soft_refusal(
                reason=RefusalReason.OVERREACH,
                explanation=f"Authority mode '{authority_mode}' may not be appropriate",
                user_message=(
                    f"The current search mode ('{authority_mode}') may not be optimal "
                    "for this type of question. Would you like me to: "
                    "1) Try with a different approach, or "
                    "2) Provide what I can with appropriate disclaimers?"
                ),
                suggested_clarification="Select preferred approach for this question",
                alternative_mode="exact" if authority_mode == "overview" else "overview",
                recommended_next_step="Request user preference for approach",
            )
        
        # 3. Domain uncertainty
        if epistemic_assessment.domain_certainty < 0.6:
            return self._create_soft_refusal(
                reason=RefusalReason.DOMAIN_CONTAMINATION,
                explanation=f"Domain certainty is low: {epistemic_assessment.domain_certainty:.1%}",
                user_message=(
                    "I'm uncertain about the exact legal domain of your question. "
                    "Could you clarify if this relates to (for example): "
                    "contract law, property law, criminal law, or another area?"
                ),
                suggested_clarification="Please specify the legal domain",
                recommended_next_step="Request domain clarification",
            )
        
        # 4. Missing anchor norm for definition questions
        if (epistemic_assessment.question_type == QuestionType.DEFINITION and
            not epistemic_assessment.authority_evidence.anchor_norm_present):
            return self._create_soft_refusal(
                reason=RefusalReason.MISSING_ANCHOR_NORM,
                explanation="Definition question lacks authoritative defining norm",
                user_message=(
                    "I don't have access to the authoritative legal definition for this term. "
                    "Would you like me to: "
                    "1) Provide a general explanation based on related concepts, or "
                    "2) Direct you to where you can find the official definition?"
                ),
                suggested_clarification="Select preferred approach for definition",
                recommended_next_step="Request user preference for definition approach",
            )
        
        return None
    
    def _check_partial_refusal_conditions(
        self,
        epistemic_assessment: EpistemicAssessment,
        confidence_adjustment: ConfidenceAdjustment,
        authority_mode: str,
        question_text: str
    ) -> Optional[RefusalDecision]:
        """Check conditions that allow overview but block details."""
        
        # 1. Overview mode for consequence questions
        if (authority_mode == "overview" and 
            epistemic_assessment.question_type == QuestionType.CONSEQUENCE):
            return self._create_partial_refusal(
                reason=RefusalReason.OVERREACH,
                explanation="Overview mode insufficient for consequence analysis",
                user_message=(
                    "I can provide a general overview of the relevant legal principles, "
                    "but I cannot analyze specific legal consequences in overview mode. "
                    "For consequence analysis, please use exact mode or consult a legal professional."
                ),
                allowed_content="general principles and overview",
                blocked_content="specific legal consequences and applications",
                recommended_next_step="Switch to exact mode or consult professional for consequences",
            )
        
        # 2. Insufficient doctrine for application questions
        if (epistemic_assessment.question_type == QuestionType.APPLICATION and
            epistemic_assessment.doctrine_completeness < 0.6):
            return self._create_partial_refusal(
                reason=RefusalReason.INSUFFICIENT_AUTHORITY,
                explanation="Incomplete doctrine for application analysis",
                user_message=(
                    "I can explain the general legal framework, but I don't have "
                    "complete information to analyze how it applies to specific situations. "
                    "For application to your specific case, legal advice is recommended."
                ),
                allowed_content="general legal framework and principles",
                blocked_content="specific application to cases or situations",
                recommended_next_step="Consult legal professional for case-specific application",
            )
        
        # 3. Low confidence for interpretation questions
        if (epistemic_assessment.question_type == QuestionType.INTERPRETATION and
            confidence_adjustment.confidence_level.name in ["LOW", "CAUTIONARY"]):
            return self._create_partial_refusal(
                reason=RefusalReason.LEGAL_COMPLEXITY,
                explanation="Legal interpretation requires higher confidence",
                user_message=(
                    "I can present the relevant legal provisions, but legal interpretation "
                    "requires careful analysis that should be done by a qualified professional. "
                    "I'll provide the text of the provisions for your review."
                ),
                allowed_content="text of legal provisions",
                blocked_content="legal interpretation and analysis",
                recommended_next_step="Seek professional interpretation of provided provisions",
            )
        
        return None
    
    def _check_disclaimer_requirement(
        self,
        epistemic_assessment: EpistemicAssessment,
        confidence_adjustment: ConfidenceAdjustment
    ) -> Optional[RefusalDecision]:
        """Check if answer requires strong disclaimer."""
        
        # Check confidence level
        if confidence_adjustment.confidence_level.name in ["LOW", "CAUTIONARY"]:
            return self._create_disclaimer_decision(
                reason=RefusalReason.INSUFFICIENT_AUTHORITY,
                explanation="Low confidence requires disclaimer",
                user_message=(
                    "⚠️ **Important Disclaimer**: The following information is based on "
                    "limited authority and should be verified with primary legal sources. "
                    "This does not constitute legal advice."
                ),
                disclaimer_level="strong",
                recommended_next_step="Always verify with authoritative sources",
            )
        
        # Check for cross-domain contamination
        if epistemic_assessment.cross_domain_contamination:
            return self._create_disclaimer_decision(
                reason=RefusalReason.DOMAIN_CONTAMINATION,
                explanation="Cross-domain issues require disclaimer",
                user_message=(
                    "⚠️ **Note**: This answer may involve concepts from multiple legal domains. "
                    "Care should be taken to verify the applicability of each concept "
                    "to your specific situation."
                ),
                disclaimer_level="moderate",
                recommended_next_step="Verify domain applicability",
            )
        
        # Check for missing mandatory norms
        if epistemic_assessment.missing_mandatory_norms:
            return self._create_disclaimer_decision(
                reason=RefusalReason.MISSING_ANCHOR_NORM,
                explanation="Missing norms require disclaimer",
                user_message=(
                    "⚠️ **Limitation**: This answer may be incomplete as some relevant "
                    "legal provisions are not available in the current document set."
                ),
                disclaimer_level="moderate",
                recommended_next_step="Check for additional relevant provisions",
            )
        
        return None
    
    def _create_hard_refusal(
        self,
        reason: RefusalReason,
        explanation: str,
        user_message: str,
        recommended_next_step: str,
        override_possible: bool = False,
        requires_human_review: bool = False,
    ) -> RefusalDecision:
        """Create a hard refusal decision."""
        return RefusalDecision(
            refusal_required=True,
            refusal_type=RefusalType.HARD_REFUSAL,
            refusal_reason=reason,
            explanation=explanation,
            user_message=user_message,
            internal_reasoning=[explanation],
            recommended_next_step=recommended_next_step,
            override_possible=override_possible,
            requires_human_review=requires_human_review,
        )
    
    def _create_soft_refusal(
        self,
        reason: RefusalReason,
        explanation: str,
        user_message: str,
        suggested_clarification: str,
        recommended_next_step: str,
        alternative_mode: Optional[str] = None,
    ) -> RefusalDecision:
        """Create a soft refusal decision."""
        return RefusalDecision(
            refusal_required=True,
            refusal_type=RefusalType.SOFT_REFUSAL,
            refusal_reason=reason,
            explanation=explanation,
            user_message=user_message,
            internal_reasoning=[explanation],
            suggested_clarification=suggested_clarification,
            alternative_mode=alternative_mode,
            recommended_next_step=recommended_next_step,
            override_possible=True,
        )
    
    def _create_partial_refusal(
        self,
        reason: RefusalReason,
        explanation: str,
        user_message: str,
        allowed_content: str,
        blocked_content: str,
        recommended_next_step: str,
    ) -> RefusalDecision:
        """Create a partial refusal decision."""
        full_explanation = f"{explanation}. Allowed: {allowed_content}. Blocked: {blocked_content}."
        
        return RefusalDecision(
            refusal_required=True,
            refusal_type=RefusalType.PARTIAL_REFUSAL,
            refusal_reason=reason,
            explanation=full_explanation,
            user_message=user_message,
            internal_reasoning=[explanation, f"Allows: {allowed_content}", f"Blocks: {blocked_content}"],
            recommended_next_step=recommended_next_step,
            override_possible=False,
        )
    
    def _create_disclaimer_decision(
        self,
        reason: RefusalReason,
        explanation: str,
        user_message: str,
        disclaimer_level: str,
        recommended_next_step: str,
    ) -> RefusalDecision:
        """Create a disclaimer requirement decision."""
        return RefusalDecision(
            refusal_required=True,
            refusal_type=RefusalType.DISCLAIMER_REQUIRED,
            refusal_reason=reason,
            explanation=f"{explanation} (requires {disclaimer_level} disclaimer)",
            user_message=user_message,
            internal_reasoning=[explanation, f"Disclaimer level: {disclaimer_level}"],
            recommended_next_step=recommended_next_step,
            override_possible=True,
        )


# Singleton instance for easy access
refusal_logic = RefusalLogic()


def evaluate_refusal(
    epistemic_assessment: EpistemicAssessment,
    confidence_adjustment: ConfidenceAdjustment,
    authority_mode: str,
    question_text: str,
    user_context: Optional[Dict] = None
) -> RefusalDecision:
    """
    Public function to evaluate refusal.
    
    Args:
        epistemic_assessment: Epistemic assessment
        confidence_adjustment: Confidence adjustment
        authority_mode: Current authority mode
        question_text: Original question text
        user_context: User context and preferences
        
    Returns:
        Refusal decision
    """
    return refusal_logic.evaluate_refusal(
        epistemic_assessment, confidence_adjustment, authority_mode, 
        question_text, user_context
    )
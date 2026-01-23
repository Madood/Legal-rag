"""
CONFIDENCE ADJUSTER
===================

Adjusts confidence levels based on epistemic status, mode, and legal context.
Makes confidence semantic rather than numeric noise.
"""

from enum import Enum
from typing import Dict, Any, Optional, List , Tuple
from dataclasses import dataclass, field
import logging
from .epistemology import EpistemicAssessment, EpistemicLevel, QuestionType

logger = logging.getLogger(__name__)


class ConfidenceLevel(Enum):
    """Semantic confidence levels."""
    DEFINITIVE = "definitive"      # Court-ready certainty
    HIGH = "high"                  # Strong support
    MEDIUM = "medium"              # Reasonable inference
    LOW = "low"                    # Tentative overview
    CAUTIONARY = "cautionary"      # Requires caution
    INSUFFICIENT = "insufficient"  # Not confident


@dataclass
class ConfidenceAdjustment:
    """Result of confidence adjustment."""
    
    adjusted_confidence: float  # 0-1
    confidence_level: ConfidenceLevel
    semantic_label: str  # Human-readable label
    
    # Reasons and flags
    adjustment_reasons: List[str] = field(default_factory=list)
    examiner_flag: str = "acceptable"  # acceptable, caution, not_ready
    display_warning: bool = False
    warning_message: Optional[str] = None
    
    # Legal context
    requires_citation: bool = True
    requires_disclaimer: bool = False
    mode_appropriate: bool = True
    
    def to_dict(self) -> Dict:
        """Convert to dictionary for JSON serialization."""
        return {
            "adjusted_confidence": round(self.adjusted_confidence, 3),
            "confidence_level": self.confidence_level.value,
            "semantic_label": self.semantic_label,
            "adjustment_reasons": self.adjustment_reasons,
            "examiner_flag": self.examiner_flag,
            "display_warning": self.display_warning,
            "warning_message": self.warning_message,
            "requires_citation": self.requires_citation,
            "requires_disclaimer": self.requires_disclaimer,
            "mode_appropriate": self.mode_appropriate,
        }


class ConfidenceAdjuster:
    """
    Adjusts confidence based on epistemic status and legal context.
    """
    
    def __init__(self):
        self.logger = logging.getLogger(__name__)
        
        # Base confidence by epistemic level
        self.EPISTEMIC_BASE_CONFIDENCE = {
            EpistemicLevel.CERTAIN: 0.9,
            EpistemicLevel.SUPPORTED: 0.75,
            EpistemicLevel.INFERRED: 0.6,
            EpistemicLevel.OVERVIEW_ONLY: 0.4,
            EpistemicLevel.INSUFFICIENT: 0.2,
            EpistemicLevel.CONFLICTING: 0.1,
            EpistemicLevel.INVALID: 0.0,
        }
        
        # Question type adjustments
        self.QUESTION_TYPE_ADJUSTMENTS = {
            QuestionType.DEFINITION: 0.0,      # Neutral
            QuestionType.APPLICATION: -0.1,    # Slightly harder
            QuestionType.PROCEDURE: -0.05,     # Procedural complexity
            QuestionType.CONSEQUENCE: -0.15,   # Consequences require certainty
            QuestionType.INTERPRETATION: -0.2, # Interpretation is complex
            QuestionType.COMPARISON: -0.1,     # Comparative analysis
            QuestionType.SYSTEM: -0.05,        # System overview
            QuestionType.DOCTRINE: -0.1,       # Doctrinal analysis
        }
        
        # Semantic labels for confidence levels
        self.CONFIDENCE_LABELS = {
            ConfidenceLevel.DEFINITIVE: "Based on exact statutory authority",
            ConfidenceLevel.HIGH: "Strongly supported by relevant norms",
            ConfidenceLevel.MEDIUM: "Reasonable inference from available authority",
            ConfidenceLevel.LOW: "Limited overview with incomplete doctrine",
            ConfidenceLevel.CAUTIONARY: "Requires caution and verification",
            ConfidenceLevel.INSUFFICIENT: "Insufficient basis for legal conclusion",
        }
    
    def adjust_confidence(
        self,
        epistemic_assessment: EpistemicAssessment,
        authority_mode: str,
        safety_risks: Dict[str, Any] = None,
        user_context: Optional[Dict] = None
    ) -> ConfidenceAdjustment:
        """
        Adjust confidence based on epistemic assessment and context.
        
        Args:
            epistemic_assessment: Epistemic assessment from epistemology module
            authority_mode: 'exact', 'overview', or 'none'
            safety_risks: Any identified safety risks
            user_context: User context (e.g., student, lawyer, exam)
            
        Returns:
            Adjusted confidence with semantic labels
        """
        self.logger.info(
            f"Adjusting confidence for {epistemic_assessment.epistemic_level.value} "
            f"in {authority_mode} mode"
        )
        
        # Get base confidence from epistemic level
        base_confidence = self.EPISTEMIC_BASE_CONFIDENCE.get(
            epistemic_assessment.epistemic_level, 0.5
        )
        
        # Apply adjustments
        adjusted = self._apply_adjustments(
            base_confidence, epistemic_assessment, authority_mode, safety_risks
        )
        
        # Determine confidence level
        confidence_level = self._determine_confidence_level(adjusted)
        
        # Check mode appropriateness
        mode_appropriate = self._check_mode_appropriateness(
            authority_mode, epistemic_assessment
        )
        
        # Determine examiner flag
        examiner_flag = self._determine_examiner_flag(
            confidence_level, epistemic_assessment, mode_appropriate
        )
        
        # Build reasons
        adjustment_reasons = self._build_adjustment_reasons(
            epistemic_assessment, authority_mode, safety_risks
        )
        
        # Determine warnings
        display_warning, warning_message = self._determine_warnings(
            confidence_level, epistemic_assessment, mode_appropriate
        )
        
        # Determine requirements
        requires_citation, requires_disclaimer = self._determine_requirements(
            confidence_level, epistemic_assessment
        )
        
        # Get semantic label
        semantic_label = self.CONFIDENCE_LABELS.get(
            confidence_level, "Confidence assessment not available"
        )
        
        return ConfidenceAdjustment(
            adjusted_confidence=adjusted,
            confidence_level=confidence_level,
            semantic_label=semantic_label,
            adjustment_reasons=adjustment_reasons,
            examiner_flag=examiner_flag,
            display_warning=display_warning,
            warning_message=warning_message,
            requires_citation=requires_citation,
            requires_disclaimer=requires_disclaimer,
            mode_appropriate=mode_appropriate,
        )
    
    def _apply_adjustments(
        self,
        base_confidence: float,
        epistemic_assessment: EpistemicAssessment,
        authority_mode: str,
        safety_risks: Dict[str, Any]
    ) -> float:
        """Apply all confidence adjustments."""
        adjusted = base_confidence
        reasons = []
        
        # 1. Question type adjustment
        question_adjustment = self.QUESTION_TYPE_ADJUSTMENTS.get(
            epistemic_assessment.question_type, 0.0
        )
        adjusted += question_adjustment
        if question_adjustment != 0:
            reasons.append(
                f"Question type '{epistemic_assessment.question_type.value}' adjustment: {question_adjustment:+.2f}"
            )
        
        # 2. Doctrine completeness adjustment
        if epistemic_assessment.doctrine_completeness < 0.8:
            completeness_penalty = (0.8 - epistemic_assessment.doctrine_completeness) * 0.3
            adjusted -= completeness_penalty
            reasons.append(f"Doctrine incomplete penalty: -{completeness_penalty:.2f}")
        
        # 3. Domain certainty adjustment
        if epistemic_assessment.domain_certainty < 0.9:
            domain_penalty = (0.9 - epistemic_assessment.domain_certainty) * 0.2
            adjusted -= domain_penalty
            reasons.append(f"Domain uncertainty penalty: -{domain_penalty:.2f}")
        
        # 4. Mode adjustment
        if authority_mode == "overview":
            # Overview mode gets significant penalty for concrete questions
            if epistemic_assessment.question_abstraction < 0.5:  # Concrete question
                mode_penalty = 0.3
                adjusted -= mode_penalty
                reasons.append(f"Overview mode for concrete question: -{mode_penalty:.2f}")
        
        # 5. Cross-domain contamination penalty
        if epistemic_assessment.cross_domain_contamination:
            contamination_penalty = 0.2
            adjusted -= contamination_penalty
            reasons.append(f"Cross-domain contamination: -{contamination_penalty:.2f}")
        
        # 6. Missing norms penalty
        missing_count = len(epistemic_assessment.missing_mandatory_norms)
        if missing_count > 0:
            missing_penalty = min(0.3, missing_count * 0.1)
            adjusted -= missing_penalty
            reasons.append(f"Missing {missing_count} mandatory norms: -{missing_penalty:.2f}")
        
        # 7. Safety risk adjustment
        if safety_risks:
            risk_adjustment = self._calculate_risk_adjustment(safety_risks)
            adjusted -= risk_adjustment
            if risk_adjustment > 0:
                reasons.append(f"Safety risk adjustment: -{risk_adjustment:.2f}")
        
        # 8. Defensibility multiplier
        adjusted *= epistemic_assessment.legal_defensibility
        
        # 9. Hard caps for specific epistemic levels
        if epistemic_assessment.epistemic_level == EpistemicLevel.OVERVIEW_ONLY:
            adjusted = min(adjusted, 0.6)  # Cap for overview
        
        if epistemic_assessment.epistemic_level == EpistemicLevel.INSUFFICIENT:
            adjusted = min(adjusted, 0.3)  # Cap for insufficient
        
        # Ensure bounds
        adjusted = max(0.0, min(1.0, adjusted))
        
        return adjusted
    
    def _calculate_risk_adjustment(self, safety_risks: Dict[str, Any]) -> float:
        """Calculate adjustment based on safety risks."""
        if not safety_risks:
            return 0.0
        
        adjustment = 0.0
        
        # High severity risks
        if safety_risks.get("high_severity", False):
            adjustment += 0.3
        
        # Multiple risks
        risk_count = safety_risks.get("risk_count", 0)
        if risk_count > 1:
            adjustment += min(0.2, (risk_count - 1) * 0.05)
        
        # Specific risk types
        if safety_risks.get("potential_harm", False):
            adjustment += 0.15
        
        if safety_risks.get("legal_uncertainty", False):
            adjustment += 0.1
        
        return min(0.5, adjustment)
    
    def _determine_confidence_level(self, confidence: float) -> ConfidenceLevel:
        """Determine semantic confidence level."""
        if confidence >= 0.85:
            return ConfidenceLevel.DEFINITIVE
        elif confidence >= 0.7:
            return ConfidenceLevel.HIGH
        elif confidence >= 0.5:
            return ConfidenceLevel.MEDIUM
        elif confidence >= 0.3:
            return ConfidenceLevel.LOW
        elif confidence >= 0.1:
            return ConfidenceLevel.CAUTIONARY
        else:
            return ConfidenceLevel.INSUFFICIENT
    
    def _check_mode_appropriateness(
        self,
        authority_mode: str,
        epistemic_assessment: EpistemicAssessment
    ) -> bool:
        """Check if the authority mode is appropriate for the question."""
        
        if authority_mode == "exact":
            # Exact mode is always appropriate if we have exact authority
            if epistemic_assessment.authority_evidence.exact_match:
                return True
            else:
                return False
        
        elif authority_mode == "overview":
            # Overview mode is appropriate for abstract/system questions
            if epistemic_assessment.question_abstraction >= 0.6:  # Abstract questions
                return True
            # Overview mode is not appropriate for concrete consequences
            if epistemic_assessment.question_type == QuestionType.CONSEQUENCE:
                return False
            # Overview mode is not appropriate for exact definition questions
            if (epistemic_assessment.question_type == QuestionType.DEFINITION and
                epistemic_assessment.authority_evidence.anchor_norm_present):
                return False
            return True
        
        elif authority_mode == "none":
            # No authority mode should only be used when explicitly requested
            return True
        
        return False
    
    def _determine_examiner_flag(
        self,
        confidence_level: ConfidenceLevel,
        epistemic_assessment: EpistemicAssessment,
        mode_appropriate: bool
    ) -> str:
        """Determine examiner flag."""
        
        # Invalid epistemic levels
        if epistemic_assessment.epistemic_level in [
            EpistemicLevel.INVALID, EpistemicLevel.CONFLICTING
        ]:
            return "not_ready"
        
        # Low confidence
        if confidence_level in [ConfidenceLevel.CAUTIONARY, ConfidenceLevel.INSUFFICIENT]:
            return "not_ready"
        
        # Mode inappropriate
        if not mode_appropriate:
            return "caution"
        
        # Missing too many norms
        if len(epistemic_assessment.missing_mandatory_norms) > 2:
            return "caution"
        
        # Cross-domain contamination
        if epistemic_assessment.cross_domain_contamination:
            return "caution"
        
        # High defensibility and readiness
        if (epistemic_assessment.legal_defensibility >= 0.8 and
            epistemic_assessment.examiner_readiness >= 0.7):
            return "acceptable"
        
        return "caution"  # Default to caution
    
    def _build_adjustment_reasons(
        self,
        epistemic_assessment: EpistemicAssessment,
        authority_mode: str,
        safety_risks: Dict[str, Any]
    ) -> List[str]:
        """Build reasons for confidence adjustment."""
        reasons = []
        
        # Epistemic level reason
        reasons.append(f"Epistemic level: {epistemic_assessment.epistemic_level.value}")
        
        # Authority mode reason
        reasons.append(f"Authority mode: {authority_mode}")
        
        # Doctrine completeness
        if epistemic_assessment.doctrine_completeness < 0.8:
            reasons.append(f"Doctrine completeness: {epistemic_assessment.doctrine_completeness:.1%}")
        
        # Missing norms
        if epistemic_assessment.missing_mandatory_norms:
            missing_str = ", ".join(epistemic_assessment.missing_mandatory_norms[:3])
            if len(epistemic_assessment.missing_mandatory_norms) > 3:
                missing_str += "..."
            reasons.append(f"Missing norms: {missing_str}")
        
        # Cross-domain contamination
        if epistemic_assessment.cross_domain_contamination:
            reasons.append("Cross-domain contamination detected")
        
        # Question type
        reasons.append(f"Question type: {epistemic_assessment.question_type.value}")
        
        return reasons
    
    def _determine_warnings(
        self,
        confidence_level: ConfidenceLevel,
        epistemic_assessment: EpistemicAssessment,
        mode_appropriate: bool
    ) -> Tuple[bool, Optional[str]]:
        """Determine if warnings should be displayed."""
        
        # Always warn for low confidence
        if confidence_level == ConfidenceLevel.INSUFFICIENT:
            return True, "Insufficient basis for legal conclusion. Verify with primary sources."
        
        if confidence_level == ConfidenceLevel.CAUTIONARY:
            return True, "Requires caution and verification with authoritative sources."
        
        # Warn for mode inappropriateness
        if not mode_appropriate:
            return True, "Authority mode may not be appropriate for this question type."
        
        # Warn for conflicting norms
        if epistemic_assessment.has_conflicting_norms:
            return True, "Conflicting legal provisions detected. Requires careful analysis."
        
        # Warn for cross-domain contamination
        if epistemic_assessment.cross_domain_contamination:
            return True, "Potential cross-domain issues detected. Verify applicability."
        
        # Warn for missing anchor norm in definition questions
        if (epistemic_assessment.question_type == QuestionType.DEFINITION and
            not epistemic_assessment.authority_evidence.anchor_norm_present):
            return True, "Definition may not be based on authoritative defining norm."
        
        return False, None
    
    def _determine_requirements(
        self,
        confidence_level: ConfidenceLevel,
        epistemic_assessment: EpistemicAssessment
    ) -> Tuple[bool, bool]:
        """Determine citation and disclaimer requirements."""
        
        # Always require citation except for definitive confidence
        requires_citation = confidence_level != ConfidenceLevel.DEFINITIVE
        
        # Require disclaimer for low confidence or overview
        requires_disclaimer = (
            confidence_level in [ConfidenceLevel.LOW, ConfidenceLevel.CAUTIONARY, ConfidenceLevel.INSUFFICIENT] or
            epistemic_assessment.epistemic_level == EpistemicLevel.OVERVIEW_ONLY
        )
        
        return requires_citation, requires_disclaimer


# Singleton instance for easy access
confidence_adjuster = ConfidenceAdjuster()


def adjust_confidence(
    epistemic_assessment: EpistemicAssessment,
    authority_mode: str,
    safety_risks: Dict[str, Any] = None,
    user_context: Optional[Dict] = None
) -> ConfidenceAdjustment:
    """
    Public function to adjust confidence.
    
    Args:
        epistemic_assessment: Epistemic assessment from epistemology module
        authority_mode: 'exact', 'overview', or 'none'
        safety_risks: Any identified safety risks
        user_context: User context (e.g., student, lawyer, exam)
        
    Returns:
        Adjusted confidence with semantic labels
    """
    return confidence_adjuster.adjust_confidence(
        epistemic_assessment, authority_mode, safety_risks, user_context
    )
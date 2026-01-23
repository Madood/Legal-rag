"""
SAFETY LAYER - PUBLIC CONTRACT
==============================

Exposes the legal epistemology system to Node.js and other services.
Defines what can be known, asserted, refused, or downgraded.
"""

from .epistemology import (
    EpistemicAssessment,
    assess_epistemic_status,
    LegalDomain,
    EpistemicLevel,
    QuestionType
)

from .confidence_adjuster import (
    ConfidenceAdjustment,
    adjust_confidence,
    ConfidenceLevel
)

from .refusal_logic import (
    RefusalDecision,
    evaluate_refusal,
    RefusalType,
    RefusalReason
)

__all__ = [
    # Epistemology
    'EpistemicAssessment',
    'assess_epistemic_status',
    'LegalDomain',
    'EpistemicLevel',
    'QuestionType',
    
    # Confidence Adjustment
    'ConfidenceAdjustment',
    'adjust_confidence',
    'ConfidenceLevel',
    
    # Refusal Logic
    'RefusalDecision',
    'evaluate_refusal',
    'RefusalType',
    'RefusalReason',
]

# Data contracts for Node.js integration
__version__ = "1.0.0"
__author__ = "Legal RAG System"
__description__ = "Legal epistemology layer for authority-first legal reasoning"
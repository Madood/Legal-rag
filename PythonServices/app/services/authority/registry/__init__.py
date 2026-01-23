"""
Authority Registry - Determines if a source may govern an answer.
Pure source sovereignty with no statute-specific logic.
"""

from .authority_resolver import resolve_authority, get_metrics
from .source_classifier import classify_question_type, assess_complexity, detect_language
from .authority_filters import validate_statute_consistency, score_question_domain
from .authority_rank import compare_hierarchy, get_authority_state

__version__ = "1.0.0"

__all__ = [
    # Main functions
    "resolve_authority",
    "get_metrics",
    
    # Classification
    "classify_question_type",
    "assess_complexity",
    "detect_language",
    
    # Authority filters
    "validate_statute_consistency",
    "score_question_domain",
    
    # Hierarchy and state
    "compare_hierarchy",
    "get_authority_state"
]
"""
Legal Authority Service - Pure legal analysis with no execution dependencies.
Determines: statute, article/paragraph, legal field, and whether clarification is needed.
"""

from .resolver import resolve_authority, get_metrics
from .statute_patterns import get_available_statutes
from .doctrines import get_doctrine_explanation
from .validation import validate_answer
from .hierarchy import compare_hierarchy
from .statute_lock import lock_statute
from .reference_extractor import extract_explicit_reference
from .clarifications import missing_statute_clarification, gdpr_clarification

# Import inference modules
from .inference.gdpr import infer_gdpr_article
from .inference.criminal import infer_criminal_paragraph
from .inference.civil import infer_civil_paragraph

__version__ = "1.0.0"

__all__ = [
    # Main functions
    "resolve_authority",
    "get_metrics",
    "get_available_statutes",
    "get_doctrine_explanation",
    "validate_answer",
    "compare_hierarchy",
    "lock_statute",
    "extract_explicit_reference",
    
    # Clarification functions
    "missing_statute_clarification",
    "gdpr_clarification",
    
    # Inference functions
    "infer_gdpr_article",
    "infer_criminal_paragraph",
    "infer_civil_paragraph"
]
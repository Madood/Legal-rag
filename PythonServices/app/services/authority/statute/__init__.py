# __init__.py
"""
Legal Authority Resolution System

This package provides functionality for determining applicable legal statutes
for German legal questions, extracting references, and validating answers.
"""

from .hierarchy import LEGAL_HIERARCHY, DOMAIN_ISOLATION, compare_hierarchy
from .reference_extractor import extract_explicit_reference
from .statute_lock import lock_statute, get_statute_lock_state
from .statute_Profile import STATUTE_PATTERNS, get_available_statutes
from .validation import validate_answer

__all__ = [
    # Hierarchy
    'LEGAL_HIERARCHY',
    'DOMAIN_ISOLATION',
    'compare_hierarchy',
    
    # Reference extraction
    'extract_explicit_reference',
    
    # Statute locking
    'lock_statute',
    'get_statute_lock_state',
    
    # Statute patterns
    'STATUTE_PATTERNS',
    'get_available_statutes',
    
    # Validation
    'validate_answer'
]

__version__ = '1.0.0'
__author__ = 'Legal Authority System'
__description__ = 'German legal statute resolution and validation system'
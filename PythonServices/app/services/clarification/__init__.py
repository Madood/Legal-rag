"""
Clarification package.

Used when:
- Authority cannot be established
- Statute or article is missing
- User input is under-specified
- User references uploaded documents
"""

from .clarification_builder import (
    missing_statute_clarification,
    gdpr_clarification,
    custom_document_clarification
)

from .document_aware_clarifier import (
    DocumentAwareClarifier,
    document_clarifier
)

__all__ = [
    "missing_statute_clarification",
    "gdpr_clarification", 
    "custom_document_clarification",
    "DocumentAwareClarifier",
    "document_clarifier"
]
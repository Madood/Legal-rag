"""
Clarification builder.

Responsibility:
- Decide WHICH clarification to return
- Uses document context if available
"""

from typing import Optional, List, Tuple
from .clarification_templates import (
    missing_statute_template,
    gdpr_clarification_template,
    custom_document_template
)


def missing_statute_clarification(
    question: str, 
    available_statutes: Optional[List[Tuple[str, str, str]]] = None,
    document_context: Optional[dict] = None
) -> dict:
    """
    Generate clarification when statute cannot be determined.
    
    Args:
        question: User's question
        available_statutes: List of (code, german_name, english_name)
        document_context: Optional context about uploaded documents
    """
    lower_question = question.lower()
    suggestion = ""
    
    # Check if question references an uploaded document
    if document_context:
        document_name = document_context.get('document_name', 'uploaded document')
        detected_provisions = document_context.get('detected_provisions', [])
        return custom_document_template(document_name, detected_provisions)
    
    # Standard suggestions based on question content
    if 'criminal' in lower_question or 'straf' in lower_question:
        suggestion = (
            '\n\n**Suggestion:** Your question seems criminal law related. '
            'Try: "What does § 1 StGB regulate?"'
        )
    elif 'data protection' in lower_question or 'privacy' in lower_question:
        suggestion = (
            '\n\n**Suggestion:** Your question seems data protection related. '
            'Try: "What is the right of access under GDPR Article 15?"'
        )
    elif 'contract' in lower_question or 'vertrag' in lower_question:
        suggestion = (
            '\n\n**Suggestion:** Your question seems contract law related. '
            'Try: "What does BGB § 311 regulate?"'
        )
    
    return missing_statute_template(available_statutes, suggestion)


def gdpr_clarification() -> dict:
    """Generate GDPR-specific clarification."""
    return gdpr_clarification_template()


def custom_document_clarification(document_name: str, detected_provisions: list = None) -> dict:
    """Generate clarification for uploaded custom documents."""
    return custom_document_template(document_name, detected_provisions)
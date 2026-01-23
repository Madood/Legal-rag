"""
Document-aware clarifier for uploaded legal documents.

This module handles clarifications when users upload their own documents.
"""

from typing import Optional, List, Dict, Any
from .clarification_templates import custom_document_template


class DocumentAwareClarifier:
    """Handles clarifications for user-uploaded legal documents."""
    
    def __init__(self):
        self.uploaded_documents = {}  # document_id -> document_info
        
    def register_document(self, document_id: str, document_info: Dict[str, Any]):
        """Register an uploaded document for clarification purposes."""
        self.uploaded_documents[document_id] = {
            'name': document_info.get('name', 'Unnamed Document'),
            'type': document_info.get('type', 'legal'),
            'provisions': document_info.get('detected_provisions', []),
            'sections': document_info.get('sections', []),
            'articles': document_info.get('articles', [])
        }
    
    def get_document_context(self, question: str) -> Optional[Dict[str, Any]]:
        """
        Check if question references an uploaded document.
        Returns document context if found, None otherwise.
        """
        lower_question = question.lower()
        
        for doc_id, doc_info in self.uploaded_documents.items():
            doc_name = doc_info['name'].lower()
            
            # Check if document name is mentioned
            if doc_name in lower_question:
                return {
                    'document_id': doc_id,
                    'document_name': doc_info['name'],
                    'detected_provisions': doc_info['provisions'],
                    'sections': doc_info.get('sections', [])
                }
            
            # Check for generic references to "my document", "uploaded", etc.
            doc_keywords = ['my document', 'uploaded', 'custom', 'my contract']
            for keyword in doc_keywords:
                if keyword in lower_question:
                    return {
                        'document_id': doc_id,
                        'document_name': doc_info['name'],
                        'detected_provisions': doc_info['provisions'],
                        'sections': doc_info.get('sections', [])
                    }
        
        return None
    
    def generate_clarification_for_document(self, document_info: Dict[str, Any]) -> dict:
        """Generate clarification specifically for an uploaded document."""
        return custom_document_template(
            document_info.get('name', 'uploaded document'),
            document_info.get('detected_provisions', [])
        )
    
    def get_available_documents_statutes(self) -> List[tuple]:
        """Convert uploaded documents into statute-like format for templates."""
        statutes = []
        
        for doc_id, doc_info in self.uploaded_documents.items():
            # Format: (code, german_name, english_name)
            statutes.append((
                f"DOC-{doc_id[:8].upper()}",  # Short document code
                f"Benutzerdokument: {doc_info['name']}",
                f"User Document: {doc_info['name']}"
            ))
        
        return statutes
    
    def clear_documents(self):
        """Clear all registered documents (e.g., on session end)."""
        self.uploaded_documents.clear()


# Global instance for easy access
document_clarifier = DocumentAwareClarifier()
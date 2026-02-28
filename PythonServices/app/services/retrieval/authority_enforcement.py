import logging
from typing import Dict, Any, Optional

logger = logging.getLogger(__name__)

class AuthorityEnforcement:
    """Authority validation and doctrine blocking"""
    
    @staticmethod
    def get_authority_final_failure_error(
        statute: str, 
        paragraph: str, 
        authority_final: bool, 
        retrieval_constraint: str,
        message: str = None
    ) -> Dict[str, Any]:
        """Return proper error when authority_final=True but corpus is empty"""
        if not message:
            message = f"Authoritative retrieval FAILED for {statute} §{paragraph}. NO FALLBACK PERMITTED."
        
        return {
            "results": [],
            "terminal": True,
            "mode": "AUTHORITY_FINAL_FAILURE",
            "authority_metadata": {
                "statute": statute,
                "paragraph": paragraph,
                "authority_final": authority_final,
                "retrieval_constraint": retrieval_constraint,
                "retrieval_performed": False,
                "corpus_available": False,
                "has_real_norms": False,
                "error": "authority_final_corpus_missing",
                "requires_ingestion": True
            },
            "authority_validation": {
                "status": "authority_final_failure",
                "message": message,
                "requires_ingestion": True,
                "terminal": True
            },
            "requires_clarification": False
        }
    
    @staticmethod
    def get_empty_index_error() -> Dict[str, Any]:
        """Return error when indices cannot be loaded"""
        return {
            "results": [],
            "authority_metadata": {
                "statute": None,
                "paragraph": None,
                "error": "No legal corpus found",
                "has_real_norms": False,
                "corpus_available": False
            },
            "authority_validation": {
                "status": "no_corpus",
                "message": "No legal corpus available. Ingest BGB/StGB documents first.",
                "requires_ingestion": True
            },
            "requires_clarification": False
        }
    
    @staticmethod
    def get_authority_unavailable_error() -> Dict[str, Any]:
        """Return error when authority services are unavailable"""
        return {
            "results": [],
            "authority_metadata": {
                "statute": None,
                "paragraph": None,
                "error": "Authority services unavailable",
                "has_real_norms": False
            },
            "authority_validation": {
                "status": "authority_unavailable",
                "message": "Legal authority resolution service is not available."
            },
            "requires_clarification": False
        }
    
    @staticmethod
    def get_strict_mode_error(code: str, statute: str, allowed_paragraphs: list, message: str) -> Dict[str, Any]:
        """Return structured error for paragraph-strict mode failures"""
        return {
            "error": {
                "code": code,
                "type": "paragraph_not_found_in_corpus",
                "statute": statute,
                "requested_paragraphs": allowed_paragraphs,
                "retrievalConstraint": "PARAGRAPH_STRICT",
                "message": message,
                "requires_ingestion": True
            },
            "results": [],
            "authority_metadata": {
                "statute": statute,
                "paragraph": None,
                "error": "paragraph_strict_failure",
                "has_real_norms": False,
                "strict_mode_enforced": True
            },
            "authority_validation": {
                "status": "paragraph_strict_failure",
                "message": message,
                "requires_ingestion": True
            },
            "requires_clarification": False
        }
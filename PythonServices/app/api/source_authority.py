"""
FastAPI endpoints for source authority resolution.
"""
from fastapi import APIRouter, HTTPException
from typing import Dict, Any

from app.services.authority.source_authority.resolver import SourceAuthorityResolver

router = APIRouter(prefix="/source-authority", tags=["source authority"])
resolver = SourceAuthorityResolver()


@router.post("/resolve")
async def resolve_sources(payload: Dict[str, Any]) -> Dict[str, Any]:
    """Resolve authoritative sources for a question."""
    required_fields = ['question', 'statute', 'questionType', 'documents']
    
    for field in required_fields:
        if field not in payload:
            raise HTTPException(
                status_code=400, 
                detail=f"Missing '{field}' field"
            )
    
    try:
        result = resolver.resolve(
            question=payload['question'],
            statute=payload['statute'],
            question_type=payload['questionType'],
            all_documents=payload['documents']
        )
        return result
    except Exception as e:
        raise HTTPException(
            status_code=500, 
            detail=f"Error resolving sources: {str(e)}"
        )


@router.post("/classify-chunk")
async def classify_chunk(payload: Dict[str, Any]) -> Dict[str, Any]:
    """Classify authority of a specific chunk."""
    required_fields = ['content', 'statute', 'document']
    
    for field in required_fields:
        if field not in payload:
            raise HTTPException(
                status_code=400, 
                detail=f"Missing '{field}' field"
            )
    
    try:
        result = resolver.classify_chunk(
            content=payload['content'],
            statute=payload['statute'],
            document=payload['document']
        )
        return result
    except Exception as e:
        raise HTTPException(
            status_code=500, 
            detail=f"Error classifying chunk: {str(e)}"
        )


@router.post("/debug-classification")
async def debug_classification(payload: Dict[str, Any]) -> Dict[str, Any]:
    """Debug classification of documents."""
    if 'documents' not in payload:
        raise HTTPException(
            status_code=400, 
            detail="Missing 'documents' field"
        )
    
    try:
        # Try to get debug info if available
        if hasattr(resolver, 'get_debug_info'):
            debug_info = resolver.get_debug_info(payload['documents'])
            return debug_info
    except Exception:
        pass
    
    # Fallback response
    return {
        'message': 'Debug classification called',
        'document_count': len(payload['documents']),
        'debug_available': False,
        'note': 'Debug functionality requires implementation in resolver'
    }


@router.get("/supported-statutes")
async def supported_statutes() -> Dict[str, Any]:
    """Get list of supported statutes."""
    return {
        'statutes': ['StGB', 'BGB', 'HGB', 'GG', 'EU-GDPR'],
        'question_types': [
            'NORMATIVE', 'DEFINITION', 'DOCTRINE', 'OFFENSE',
            'GENERAL_STATUTE', 'SYSTEM', 'GENERAL'
        ]
    }
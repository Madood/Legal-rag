from fastapi import APIRouter, HTTPException
from typing import List, Optional
from pydantic import BaseModel

# Import from services package - FIXED: Removed AUTHORITY_LOCATION
from app.services import (
    resolve_authority,
    get_available_statutes,
    get_doctrine_explanation,
    validate_answer,
    compare_hierarchy,
    get_authority_state,
    AUTHORITY_AVAILABLE  # Only import what actually exists
)

router = APIRouter()

# Authority Models
class AuthorityResolveRequest(BaseModel):
    question: str

class AuthorityValidateRequest(BaseModel):
    question: str
    answer: str
    statute: str

class AuthorityResponse(BaseModel):
    statute: Optional[str] = None
    reference: Optional[str] = None
    referenceType: Optional[str] = None
    referenceSource: Optional[str] = None
    confidence: float = 0.0
    requiresClarification: bool = False
    clarification: Optional[dict] = None
    domain: Optional[str] = None
    correctionNote: Optional[str] = None

class ValidateResponse(BaseModel):
    isValid: bool
    message: str
    validations: Optional[List[dict]] = None

class StatutesResponse(BaseModel):
    statutes: dict

@router.get("/status")
async def authority_service_status():
    """Check if Legal Authority Service is available."""
    return {
        "available": AUTHORITY_AVAILABLE,
        "service": "Legal Authority Service",
        "version": "1.0.0" if AUTHORITY_AVAILABLE else "unavailable",
        "location": "authority.registry + authority.statute (lazy-loaded)",  # FIXED: Static string
        "statutes_supported": [
            "StGB - German Criminal Code",
            "BGB - German Civil Code",
            "HGB - German Commercial Code",
            "GG - German Basic Law",
            "EU-GDPR - EU Data Protection Regulation"
        ]
    }

@router.post("/resolve", response_model=AuthorityResponse)
async def authority_resolve_endpoint(request: AuthorityResolveRequest):
    """
    Resolve legal authority for a question.
    Determines statute, article/paragraph, and whether clarification is needed.
    """
    if not AUTHORITY_AVAILABLE:
        raise HTTPException(
            status_code=503,
            detail="Legal Authority Service is not available. Check /api/v1/authority/status"
        )
    
    try:
        print(f"\n[Legal Authority] Resolving: {request.question[:60]}...")
        result = resolve_authority(request.question)
        print(f"  Result: {result.get('statute')} {result.get('reference') or ''} "
              f"(confidence: {result.get('confidence', 0):.2f})")
        return result
    except Exception as e:
        print(f"  ❌ Error in authority resolve: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Authority resolution failed: {str(e)}")

@router.post("/validate", response_model=ValidateResponse)
async def authority_validate_endpoint(request: AuthorityValidateRequest):
    """
    Validate an answer against the question's legal context.
    """
    if not AUTHORITY_AVAILABLE:
        raise HTTPException(
            status_code=503,
            detail="Legal Authority Service is not available"
        )
    
    try:
        print(f"\n[Legal Authority] Validating answer for: {request.question[:50]}...")
        result = validate_answer(request.question, request.answer, request.statute)
        print(f"  Validation result: {result.get('isValid', False)}")
        return result
    except Exception as e:
        print(f"  ❌ Error in authority validation: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Validation failed: {str(e)}")

@router.get("/statutes", response_model=StatutesResponse)
async def authority_statutes_endpoint():
    """
    Get available statutes and their domains.
    """
    if not AUTHORITY_AVAILABLE:
        return StatutesResponse(statutes={})
    
    try:
        statutes = get_available_statutes()
        return StatutesResponse(statutes=statutes)
    except Exception as e:
        print(f"  ❌ Error getting statutes: {str(e)}")
        return StatutesResponse(statutes={})

@router.get("/doctrine/{doctrine_name}")
async def authority_doctrine_endpoint(doctrine_name: str, language: str = "german"):
    """
    Get doctrine/principle explanation.
    """
    if not AUTHORITY_AVAILABLE:
        raise HTTPException(
            status_code=503,
            detail="Legal Authority Service is not available"
        )
    
    try:
        explanation = get_doctrine_explanation(doctrine_name, language)
        if not explanation:
            raise HTTPException(
                status_code=404,
                detail=f"Doctrine '{doctrine_name}' not found"
            )
        return explanation
    except HTTPException:
        raise
    except Exception as e:
        print(f"  ❌ Error getting doctrine: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Doctrine retrieval failed: {str(e)}")

@router.get("/compare/{statute_a}/{statute_b}")
async def authority_compare_endpoint(statute_a: str, statute_b: str):
    """
    Compare hierarchy rank of two statutes.
    """
    if not AUTHORITY_AVAILABLE:
        return {
            "comparison": 0,
            "relation": f"{statute_a} ? {statute_b} (service unavailable)",
            "error": "Authority service not available"
        }
    
    try:
        result = compare_hierarchy(statute_a, statute_b)
        
        if result == 1:
            relation = f"{statute_a} > {statute_b} (higher authority)"
        elif result == -1:
            relation = f"{statute_a} < {statute_b} (lower authority)"
        else:
            relation = f"{statute_a} = {statute_b} (equal authority)"
        
        return {
            "comparison": result,
            "relation": relation,
            "statute_a": statute_a,
            "statute_b": statute_b
        }
    except Exception as e:
        print(f"  ❌ Error comparing statutes: {str(e)}")
        return {
            "comparison": 0,
            "relation": f"{statute_a} ? {statute_b}",
            "error": str(e)
        }
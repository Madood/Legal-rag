"""
Query execution endpoints - semantic and authoritative search.
Orchestrates retrieval but contains no retrieval logic itself.
Maintains backward compatibility with Node.js integration.
"""
from fastapi import APIRouter, HTTPException, Header
from typing import List, Optional, Dict, Any
import numpy as np
from datetime import datetime
from pydantic import BaseModel

# Service imports for delegation only
from app.services import (
    resolve_authority,
    validate_answer,
    compare_hierarchy,
    AUTHORITY_AVAILABLE,
    get_doctrine_explanation,
)
from app.services.embeddings.embedding_service import embedding_service
from app.services.retrieval.retrieval_service import retrieval_service
from app.services.retrieval.doctrine_guard import DOCTRINE_LOOKUP, SETTLED_DOCTRINES
from app.services.doctrine_induction.ai_fallback import get_ai_doctrine_explanation

router = APIRouter(prefix="/query", tags=["query"])

DOCTRINE_BLOCK_KEYWORDS = [
    "agb",
    "allgemeine geschäftsbedingungen",
    "kollision",
    "battle of forms",
    "last-shot",
    "knock-out",
    "widersprüchlich",
    "conflicting terms",
    "conflicting agb",
]


def should_block_doctrine(question: str) -> bool:
    q = (question or "").lower()
    return any(kw in q for kw in DOCTRINE_BLOCK_KEYWORDS)


# ===========================================================================
# REQUEST/RESPONSE SCHEMAS (Transport Layer Only)
# ===========================================================================

class SimpleSearchRequest(BaseModel):
    """Legacy search request for Node.js compatibility"""
    query: str
    statute: Optional[str] = None
    k: int = 10


class SimpleSearchResult(BaseModel):
    """Legacy search result format"""
    content: str
    statute: Optional[str] = None
    paragraph: Optional[str] = None
    document_id: str
    similarity: float
    is_authoritative: bool = False
    match_type: str = "semantic"


class SimpleSearchResponse(BaseModel):
    """Legacy search response"""
    results: List[SimpleSearchResult]
    count: int


class AuthoritativeSearchRequest(BaseModel):
    """Authoritative search with constraints"""
    query: dict
    authority_constraints: Dict[str, Any]
    documents: List[Dict[str, Any]]
    options: Optional[Dict[str, Any]] = {}


class SearchResult(BaseModel):
    """Generic search result"""
    document_id: str
    content: str
    similarity: float
    metadata: Dict[str, Any]
    chunk_index: Optional[int] = None


class AuthoritativeSearchResponse(BaseModel):
    """Authoritative search response"""
    results: List[SearchResult]
    authority_summary: Dict[str, Any]
    processing_time: float
    total_chunks_searched: int


# ===========================================================================
# UTILITY FUNCTIONS
# ===========================================================================

def _validate_corpus_ready() -> Dict[str, Any]:
    """
    CRITICAL: Validate that REAL corpus is loaded before allowing any search.
    
    Returns:
        Dict with corpus stats
        
    Raises:
        HTTPException: If NO REAL corpus is available
    """
    try:
        # Get current corpus state
        stats = retrieval_service.get_stats()
        
        # BINARY CHECK: Either real corpus or fail
        if not stats["has_real_corpus"]:
            raise HTTPException(
                status_code=503,
                detail={
                    "error": "no_real_legal_corpus",
                    "message": "No real legal corpus loaded. Upload official statute PDFs first.",
                    "required_action": "ingest_real_statute",
                    "stats": stats
                }
            )
        
        return {
            "ready": True,
            "has_real_corpus": True,
            "total_vectors": stats["total_vectors"],
            "available_statutes": list(stats.get("statute_indices", {}).keys()),
            "corpus_state": stats["corpus_state"]
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"⚠️ Error checking corpus state: {e}")
        raise HTTPException(
            status_code=500,
            detail={
                "error": "corpus_check_failed",
                "message": f"Failed to check corpus state: {str(e)}"
            }
        )


def _enforce_minimum_results(statute: Optional[str], results: List[Dict], 
                            min_count: int = 1) -> None:
    """
    CRITICAL FIX: Enforce minimum result requirements for legal queries.
    
    Args:
        statute: The statute being queried (if any)
        results: Search results
        min_count: Minimum number of results required
        
    Raises:
        HTTPException: If minimum results not met
    """
    if statute and len(results) < min_count:
        # Get stats to provide context
        stats = retrieval_service.get_stats()
        statute_vectors = stats.get("statute_indices", {}).get(statute, {}).get("vectors", 0)
        
        if statute_vectors == 0:
            # Statute index exists but is empty
            raise HTTPException(
                status_code=404,
                detail={
                    "error": "statute_index_empty",
                    "message": f"No documents found in {statute} index. The corpus may not contain this statute.",
                    "statute": statute,
                    "index_exists": statute in stats.get("statute_indices", {}),
                    "vectors_in_index": statute_vectors
                }
            )
        else:
            # Statute index has content but no matches
            raise HTTPException(
                status_code=404,
                detail={
                    "error": "no_matching_documents",
                    "message": f"No documents found matching the query in {statute}.",
                    "statute": statute,
                    "vectors_in_index": statute_vectors,
                    "query_returned_empty": True
                }
            )


# ===========================================================================
# SIMPLE SEARCH ENDPOINT (Node.js Compatibility Layer)
# ===========================================================================

@router.post("/search")
async def search(request: dict) -> Dict[str, Any]:
    """
    Simple search endpoint for Node.js compatibility.
    Called by pythonIntegrationService.js
    
    🔥 FIX: Just delegate to authoritative_search - it handles corpus validation
    """
    try:
        print("\n[API] /query/search (legacy)")
        
        # Extract parameters
        query = request.get("query", "")
        statute = request.get("statute")
        k = request.get("k", 10)
        
        print(f"  Query: {query[:50]}..., Statute: {statute}, k: {k}")
        
        # 🔥 FIX: Just delegate - authoritative_search handles corpus validation
        result = await authoritative_search({
            "query": {
                "text": query,
                "statute": statute
            }
        })
        
        return result
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"  ❌ Error in search: {str(e)}")
        raise HTTPException(
            status_code=500, 
            detail={
                "error": "search_execution_error",
                "message": str(e)
            }
        )


# ===========================================================================
# AUTHORITATIVE SEARCH ENDPOINTS
# ===========================================================================

@router.post("/search/authoritative")
async def authoritative_search(
    request: dict,
    x_language: Optional[str] = Header(None, alias="x-language"),
) -> Dict[str, Any]:
    """
    Authoritative search endpoint for Node.js pythonIntegrationService.
    Uses authority resolution to improve search.
    """
    # Map UI language code to language string expected by services
    _lang_code = x_language or "de"
    language = "german" if _lang_code == "de" else "english"
    print(f"  Language: {language} (from header: {_lang_code})")
    try:
        print(f"\n[Authoritative Search] Request received")
        
        # CRITICAL FIX: Validate REAL corpus is ready - NO FALLBACK
        corpus_state = _validate_corpus_ready()
        
        # Extract parameters with fallbacks for different request formats
        if isinstance(request, dict):
            if "query" in request and isinstance(request["query"], dict):
                # New format: query is a dict with text
                query_text = request.get("query", {}).get("text", "")
                question_type = request.get("query", {}).get("type", "GENERAL")
                statute = request.get("query", {}).get("statute")
                k = request.get("k", 10)
            elif "query" in request:
                # Format 2: Flattened format (legacy)
                query_text = str(request.get("query", ""))
                question_type = request.get("question_type", "GENERAL")
                statute = request.get("statute")
                k = request.get("k", 10)
            elif "text" in request:
                # Format 3: Direct text parameter
                query_text = request.get("text", "")
                question_type = request.get("question_type", "GENERAL")
                statute = request.get("statute")
                k = request.get("k", 10)
            else:
                query_text = ""
                question_type = "GENERAL"
                statute = None
                k = 10
        else:
            query_text = ""
            question_type = "GENERAL"
            statute = None
            k = 10
        
        if not query_text.strip():
            raise HTTPException(
                status_code=400,
                detail={
                    "error": "missing_query",
                    "message": "Query text is required"
                }
            )
        
        print(f"  Query: {query_text[:80]}...")
        print(f"  Type: {question_type}, Statute: {statute}, k: {k}")
        
        # Use the authoritative retrieval contract
        if AUTHORITY_AVAILABLE and query_text.strip():
            try:
                # 🔥 FIX: Call with correct parameters including available_documents
                # Pass None for available_documents to use the full corpus
                authoritative_result = retrieval_service.resolve_authority_and_retrieve(
                    query=query_text,
                    question_type=question_type,
                    available_documents=None  # Use full corpus
                )
                
                # Extract results
                search_results = authoritative_result.get("results", [])
                authority_metadata = authoritative_result.get("authority_metadata", {})
                requires_clarification = authoritative_result.get("requires_clarification", False)
                
                # Handle clarification required
                if requires_clarification:
                    print(f"  ⚠️  Authority clarification required")
                    return {
                        "results": [],
                        "count": 0,
                        "requires_clarification": True,
                        "clarification": authoritative_result.get("clarification"),
                        "statute": authority_metadata.get("statute"),
                        "authoritative_found": False,
                        "corpus_state": corpus_state
                    }
                
                # 🔥🔥🔥 CRITICAL FIX: AUTHORITATIVE SEARCH CANNOT RETURN 404 🔥🔥🔥
                # Authority FINAL = norm exists. Empty results ≠ missing norm.
                resolved_statute = authority_metadata.get("statute")
                
                # AUTHORITATIVE RULE: If authority is FINAL, NEVER raise 404.
                # Empty results are a VALID authoritative outcome.
                if not search_results:
                    print(f"  ⚠️  Authority final but no chunks found - returning empty results (NOT 404)")
                    return {
                        "results": [],
                        "count": 0,
                        "statute": resolved_statute,
                        "authoritative_found": False,
                        "authority_metadata": authority_metadata,
                        "requires_clarification": False,
                        "corpus_state": corpus_state,
                        "_debug": {
                            "authority_final": True,
                            "paragraph_strict": True,
                            "reason": "authority_passed_but_no_chunks_propagated"
                        }
                    }
                
                # Prepare response with authority metadata
                response = {
                    "results": search_results,
                    "count": len(search_results),
                    "statute": resolved_statute or statute,
                    "authoritative_found": any(r.get("is_authoritative", False) for r in search_results),
                    "authority_metadata": authority_metadata,
                    "authority_final": authority_metadata.get("authority_final") or resolved_statute or statute,
                    "authority_source": authority_metadata.get("authority_source", "resolver"),
                    "cross_statutes": authority_metadata.get("cross_statutes", []),
                    "is_cross_statute": authority_metadata.get("is_cross_statute", False),
                    "requires_clarification": False,
                    "corpus_state": corpus_state,
                    # Domain anchor data for Node.js anchor-boost
                    "domain_anchor_paragraphs": authority_metadata.get("domain_anchor_paragraphs", []),
                    "domain_anchor_domain": authority_metadata.get("domain_anchor_domain", ""),
                    "question_type": authority_metadata.get("question_type"),
                    "_request_metadata": {
                        "query_received": query_text[:100],
                        "question_type": question_type,
                        "statute_requested": statute,
                        "timestamp": datetime.now().isoformat()
                    }
                }
                
                print(f"  Found {len(search_results)} authoritative results")
                if resolved_statute:
                    print(f"  Resolved statute: {resolved_statute}")
                
                return response
                
            except HTTPException:
                # Re-raise HTTP exceptions
                raise
            except Exception as auth_error:
                print(f"  ❌ Authoritative retrieval failed: {auth_error}")
                # NO FALLBACK TO BASIC SEARCH - FAIL LOUDLY
                raise HTTPException(
                    status_code=500,
                    detail={
                        "error": "authoritative_retrieval_failed",
                        "message": f"Authoritative search failed: {str(auth_error)}",
                        "requires_real_corpus": True
                    }
                )
        
        # NO FALLBACK - If authority is not available, fail
        print("❌ Authority services not available")
        raise HTTPException(
            status_code=503,
            detail={
                "error": "authority_services_unavailable",
                "message": "Legal authority resolution services are not available.",
                "requires_action": "ensure_authority_services_running"
            }
        )
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"  ❌ Error in authoritative search: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail={
                "error": "authoritative_search_error",
                "message": str(e),
                "requires_real_corpus": True
            }
        )


# ===========================================================================
# DOCTRINE ENDPOINT
# ===========================================================================

@router.post("/doctrine")
async def doctrine_explanation(
    request: dict,
    x_language: Optional[str] = Header(None, alias="x-language"),
) -> Dict[str, Any]:
    """
    Doctrine explanation endpoint for doctrinal questions.
    Called by Node.js pythonIntegrationService.callDoctrineInductor().
    Never raises 404 — always returns a valid response.
    """
    _lang_code = x_language or "de"
    language = "german" if _lang_code == "de" else "english"

    question = request.get("question", "")
    statute = request.get("statute")
    paragraph = request.get("paragraph")
    classification = request.get("classification", {})
    suggested_field = request.get("suggested_field", "")
    epistemic_certainty = request.get("epistemic_certainty", "uncertain")

    print(f"\n[Doctrine] Request: field='{suggested_field}', statute={statute}")

    if should_block_doctrine(question):
        print("[Doctrine] AGB query blocked — forcing RAG")
        return {"doctrine_found": False}

    # Step 1: Try to match suggested_field against known doctrines
    field_lower = (suggested_field or "").lower().strip()
    matched_doctrine = None
    doctrine_metadata = None

    for term in SETTLED_DOCTRINES:
        if field_lower and (term in field_lower or field_lower in term):
            matched_doctrine = term
            doctrine_metadata = DOCTRINE_LOOKUP.get(term, {})
            break

    if matched_doctrine:
        print(f"  Matched doctrine: {matched_doctrine}")
        canonical_id = doctrine_metadata.get("canonical_id", matched_doctrine.upper())
        explanation_result = get_doctrine_explanation(matched_doctrine, language=language)

        if explanation_result:
            explanation_text = explanation_result.get("explanation", "")
            domain = explanation_result.get("domain", "general")
            sources = explanation_result.get("sources", [])
        else:
            # Hardcoded dict has no entry — try AI fallback (DeepSeek → Gemini)
            ai_result = await get_ai_doctrine_explanation(matched_doctrine, language=language)
            if ai_result:
                explanation_text = ai_result["explanation"]
                domain = ai_result.get("domain", "ai_generated")
                sources = doctrine_metadata.get("constitutional_basis") or doctrine_metadata.get("statutory_basis") or []
            else:
                # Both AI providers failed — use static German placeholder
                explanation_text = f"Das {canonical_id} ist ein anerkannter Rechtsgrundsatz des deutschen Rechts."
                domain = "general"
                sources = doctrine_metadata.get("constitutional_basis") or doctrine_metadata.get("statutory_basis") or []

        return {
            "doctrinal_summary": explanation_text,
            "answer": explanation_text,
            "confidence": 0.92,
            "domain": domain,
            "canonical_doctrine": canonical_id,
            "constitutional_basis": doctrine_metadata.get("constitutional_basis"),
            "statutory_basis": doctrine_metadata.get("statutory_basis"),
            "sources": sources,
            "doctrine_found": True,
        }

    # Step 2: No match — return generic response based on statute and suggested_field
    print(f"  No settled doctrine matched, returning generic response")
    if language == "english":
        statute_name = statute or "German law"
        field_display = suggested_field or classification.get("domain", "general legal questions")
        generic_summary = (
            f"The question concerns the area '{field_display}' under {statute_name}. "
            f"No specific doctrine could be clearly identified. "
            f"Please consult the relevant statutory provisions and legal literature."
        )
    else:
        statute_name = statute or "dem deutschen Recht"
        field_display = suggested_field or classification.get("domain", "allgemeine Rechtsfragen")
        generic_summary = (
            f"Die Frage betrifft den Bereich '{field_display}' im {statute_name}. "
            f"Eine spezifische Doktrin konnte nicht eindeutig zugeordnet werden. "
            f"Bitte konsultieren Sie die einschlägigen Normen und die rechtswissenschaftliche Literatur."
        )

    return {
        "doctrinal_summary": generic_summary,
        "answer": generic_summary,
        "confidence": 0.5,
        "domain": field_display,
        "canonical_doctrine": None,
        "doctrine_found": False,
    }


# ===========================================================================
# EMBEDDING ENDPOINTS
# ===========================================================================

@router.post("/embeddings")
async def generate_embeddings(text: str, use_cache: bool = True) -> Dict[str, Any]:
    """
    Generate embeddings for text.
    Can be used without corpus (for testing)
    """
    try:
        embedding = embedding_service.embed_text(text)
        
        return {
            "embeddings": [embedding.tolist()],
            "dimension": embedding_service.model.get_sentence_embedding_dimension()
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/embeddings/query")
async def generate_query_embedding(query: str, statute: Optional[str] = None) -> Dict[str, Any]:
    """
    Generate enhanced embedding for query with legal context.
    Can be used without corpus (for testing)
    """
    try:
        # Auto-resolve statute if not provided
        resolved_statute = statute
        if not statute and AUTHORITY_AVAILABLE:
            try:
                authority_result = resolve_authority(query)
                if authority_result.get("statute") and not authority_result.get("requiresClarification"):
                    resolved_statute = authority_result["statute"]
                    print(f"  Auto-resolved statute: {resolved_statute} for query: {query[:50]}...")
            except Exception as e:
                print(f"  ⚠️ Auto-resolution failed: {e}")
        
        embedding = embedding_service.embed_query(query, resolved_statute)
        
        return {
            "embedding": embedding.tolist(),
            "dimension": embedding.shape[0],
            "statute": resolved_statute,
            "auto_resolved": resolved_statute != statute
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ===========================================================================
# DIAGNOSTIC ENDPOINTS
# ===========================================================================

@router.get("/corpus/status")
async def get_corpus_status() -> Dict[str, Any]:
    """
    Diagnostic endpoint to check corpus state.
    Useful for Node.js layer to understand why searches might fail.
    """
    try:
        stats = retrieval_service.get_stats()
        
        return {
            "ready": stats.get("has_real_corpus", False),  # BINARY: real or not
            "has_real_corpus": stats.get("has_real_corpus", False),
            "statute_indices": stats.get("statute_indices", {}),
            "general_index": stats.get("general_index", {}),
            "total_vectors": stats.get("total_vectors", 0),
            "corpus_state": stats.get("corpus_state", "EMPTY"),
            "timestamp": datetime.now().isoformat(),
            "required_action": "ingest_bgb_pdf" if not stats.get("has_real_corpus", False) else "ready"
        }
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail={
                "error": "corpus_status_failed",
                "message": str(e)
            }
        )


@router.post("/validate")
async def validate_query(request: dict) -> Dict[str, Any]:
    """
    Validate if a query can be executed with current corpus state.
    """
    try:
        query = request.get("query", "")
        statute = request.get("statute")
        
        # Check corpus state
        corpus_state = _validate_corpus_ready()
        
        # Check if statute exists in corpus
        statute_available = False
        if statute:
            stats = retrieval_service.get_stats()
            statute_vectors = stats.get("statute_indices", {}).get(statute, {}).get("vectors", 0)
            statute_available = statute_vectors > 0
        
        return {
            "valid": True,
            "has_real_corpus": corpus_state["has_real_corpus"],
            "statute_available": statute_available if statute else None,
            "statute_requested": statute,
            "total_vectors": corpus_state["total_vectors"],
            "can_execute": corpus_state["has_real_corpus"],  # Only if real corpus exists
            "warnings": []
        }
        
    except HTTPException as he:
        # Return validation failure details
        return {
            "valid": False,
            "has_real_corpus": False,
            "can_execute": False,
            "error": he.detail.get("error") if isinstance(he.detail, dict) else "no_real_corpus",
            "message": he.detail.get("message") if isinstance(he.detail, dict) else str(he.detail),
            "required_action": "ingest_real_statute"
        }
    except Exception as e:
        return {
            "valid": False,
            "has_real_corpus": False,
            "can_execute": False,
            "error": "validation_error",
            "message": str(e)
        }


@router.get("/health")
async def health_check() -> Dict[str, Any]:
    """Health check endpoint"""
    return {
        "status": "healthy",
        "service": "query-api",
        "authority_available": AUTHORITY_AVAILABLE,
        "corpus_ready": retrieval_service.get_stats()["has_real_corpus"],
        "timestamp": datetime.now().isoformat()
    }


@router.get("/status")
async def get_status() -> Dict[str, Any]:
    """Status endpoint for Node.js integration"""
    stats = retrieval_service.get_stats()
    
    return {
        "ready": stats["has_real_corpus"],
        "has_real_corpus": stats["has_real_corpus"],
        "authority_available": AUTHORITY_AVAILABLE,
        "statute_indices": list(stats.get("statute_indices", {}).keys()),
        "total_vectors": stats["total_vectors"],
        "corpus_state": stats["corpus_state"],
        "endpoints": {
            "authoritative_search": "/api/query/search/authoritative",
            "search": "/api/query/search",
            "health": "/api/query/health"
        },
        "contract": {
            "authoritative_search_format": {
                "query": {
                    "text": "string (required)",
                    "type": "string (optional, default: GENERAL)",
                    "statute": "string (optional)"
                }
            },
            "legacy_search_format": {
                "query": "string (required)",
                "statute": "string (optional)",
                "k": "number (optional, default: 10)"
            }
        }
    }

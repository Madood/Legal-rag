"""
Query execution endpoints - semantic and authoritative search.
Orchestrates retrieval but contains no retrieval logic itself.
Maintains backward compatibility with Node.js integration.
"""
from fastapi import APIRouter, HTTPException
from typing import List, Optional, Dict, Any
import numpy as np
from datetime import datetime
from pydantic import BaseModel

# Service imports for delegation only
from app.services import (
    resolve_authority,
    validate_answer,
    compare_hierarchy,
    AUTHORITY_AVAILABLE
)
from app.services.embeddings.embedding_service import embedding_service
from app.services.retrieval.retrieval_service import retrieval_service

router = APIRouter(prefix="/query", tags=["query"])


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
    """
    try:
        # Extract parameters
        query = request.get("query", "")
        statute = request.get("statute")
        k = request.get("k", 10)
        
        print(f"\n[Query Search] Query: {query[:50]}...")
        print(f"  Statute: {statute}, k: {k}")
        
        # CRITICAL FIX: Validate REAL corpus is ready - NO FALLBACK
        corpus_state = _validate_corpus_ready()
        
        # Generate embedding for query
        query_embedding = embedding_service.embed_query(query, statute)
        
        # Delegate to retrieval service
        search_results = retrieval_service.search(
            query_embedding=query_embedding,
            statute=statute,
            k=k
        )
        
        print(f"  Found {len(search_results)} results")
        
        # CRITICAL FIX: Enforce minimum results for statute-specific queries
        if statute:
            try:
                _enforce_minimum_results(statute, search_results, min_count=1)
            except HTTPException:
                # For non-authoritative search, we'll return empty but log warning
                print(f"⚠️  No results found for statute {statute}")
        
        response = {
            "results": search_results,
            "count": len(search_results),
            "statute": statute,
            "corpus_state": {
                "has_real_corpus": corpus_state["has_real_corpus"],
                "total_vectors": corpus_state["total_vectors"]
            }
        }
        
        return response
        
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


@router.post("/api/search")
async def api_search(request: dict) -> Dict[str, Any]:
    """
    Another legacy endpoint for Node.js compatibility.
    Handles multiple request formats.
    """
    try:
        # Handle different request formats
        if "query" in request and isinstance(request["query"], str):
            # Direct format
            return await search(request)
        else:
            # Fallback to v1 search format
            query_text = request.get("query", {}).get("text", "") if isinstance(request.get("query"), dict) else ""
            statute = request.get("statute") or (request.get("query", {}).get("statute") 
                      if isinstance(request.get("query"), dict) else None)
            
            if query_text:
                return await search({
                    "query": query_text,
                    "statute": statute,
                    "k": 10
                })
        
        return {"results": [], "count": 0}
        
    except Exception as e:
        print(f"  ❌ Error in /api/search: {str(e)}")
        return {
            "results": [], 
            "count": 0,
            "error": str(e)
        }


# ===========================================================================
# AUTHORITATIVE SEARCH ENDPOINTS
# ===========================================================================

@router.post("/search/authoritative")
async def authoritative_search(request: dict) -> Dict[str, Any]:
    """
    Authoritative search endpoint for Node.js pythonIntegrationService.
    Uses authority resolution to improve search.
    """
    try:
        print(f"\n[Authoritative Search] Request received")
        
        # CRITICAL FIX: Validate REAL corpus is ready - NO FALLBACK
        corpus_state = _validate_corpus_ready()
        
        # Extract parameters with fallbacks for different request formats
        if isinstance(request, dict):
            if "query" in request and isinstance(request["query"], dict):
                # New format: query is a dict with text
                query_text = request.get("query", {}).get("text", "")
                statute = request.get("query", {}).get("statute")
                k = request.get("k", 10)
            else:
                # Legacy format
                query_text = request.get("query", "")
                statute = request.get("statute")
                k = request.get("k", 10)
        else:
            query_text = ""
            statute = None
            k = 10
        
        print(f"  Query: {query_text[:80]}...")
        print(f"  Statute: {statute}, k: {k}")
        
        # Use the authoritative retrieval contract
        if AUTHORITY_AVAILABLE and query_text.strip():
            try:
                # This is the new authoritative retrieval path
                authoritative_result = retrieval_service.resolve_authority_and_retrieve(
                    query=query_text,
                    question_type="GENERAL",
                    available_documents=None
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
                        "authoritative_found": False
                    }
                
                # CRITICAL FIX: Enforce minimum results for authoritative search
                resolved_statute = authority_metadata.get("statute")
                if resolved_statute:
                    _enforce_minimum_results(resolved_statute, search_results, min_count=1)
                
                # Prepare response with authority metadata
                response = {
                    "results": search_results,
                    "count": len(search_results),
                    "statute": resolved_statute or statute,
                    "authoritative_found": any(r.get("is_authoritative", False) for r in search_results),
                    "authority_metadata": authority_metadata,
                    "requires_clarification": False,
                    "corpus_state": corpus_state
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
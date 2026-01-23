"""
Health check endpoints.
No logic, no reasoning, only service availability reporting.
"""
from fastapi import APIRouter
from app.services import AUTHORITY_AVAILABLE, get_available_statutes
from app.services.embeddings.embedding_service import embedding_service

router = APIRouter(prefix="", tags=["health"])

@router.get("/test")
async def test_endpoint():
    """Simple connectivity test"""
    return {
        "message": "Python Legal RAG Service is operational",
        "status": "healthy",
        "service": "Legal RAG API v1"
    }

@router.get("/health")
async def health():
    """Comprehensive health check"""
    try:
        # Check authority service
        authority_health = {
            "available": AUTHORITY_AVAILABLE,
            "statutes_count": len(get_available_statutes()) if AUTHORITY_AVAILABLE else 0
        }
        
        # Check embedding service
        model_info = embedding_service.get_model_info()
        
        # Check overall status
        overall_healthy = (
            model_info["status"] == "loaded" and
            (not AUTHORITY_AVAILABLE or authority_health["available"])
        )
        
        return {
            "status": "healthy" if overall_healthy else "degraded",
            "components": {
                "authority_service": authority_health,
                "embedding_service": model_info,
                "retrieval_service": {"status": "presumed_healthy"}  # Assuming if we get this far
            },
            "uptime_checks": {
                "api": "operational",
                "model": model_info["status"],
                "authority": "available" if AUTHORITY_AVAILABLE else "unavailable"
            }
        }
    except Exception as e:
        return {
            "status": "unhealthy",
            "error": str(e),
            "components": {
                "authority_service": {"available": False, "error": "check_failed"},
                "embedding_service": {"status": "unknown"},
                "retrieval_service": {"status": "unknown"}
            }
        }
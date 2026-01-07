"""
FastAPI endpoint for legal authority resolution.
This is a simplified router that delegates to endpoints.py
"""
from fastapi import APIRouter
from app.api.endpoints import (
    authority_resolve_endpoint,
    authority_validate_endpoint,
    authority_statutes_endpoint,
    authority_doctrine_endpoint,
    authority_compare_endpoint,
    authority_service_status
)

router = APIRouter(prefix="/authority", tags=["legal authority"])

# Route definitions
router.add_api_route(
    "/status",
    authority_service_status,
    methods=["GET"],
    summary="Check authority service status"
)

router.add_api_route(
    "/resolve", 
    authority_resolve_endpoint,
    methods=["POST"],
    summary="Resolve legal authority"
)

router.add_api_route(
    "/validate",
    authority_validate_endpoint,
    methods=["POST"],
    summary="Validate answer against legal context"
)

router.add_api_route(
    "/statutes",
    authority_statutes_endpoint,
    methods=["GET"],
    summary="Get available statutes"
)

router.add_api_route(
    "/doctrine/{doctrine_name}",
    authority_doctrine_endpoint,
    methods=["GET"],
    summary="Get legal doctrine explanation"
)

router.add_api_route(
    "/compare/{statute_a}/{statute_b}",
    authority_compare_endpoint,
    methods=["GET"],
    summary="Compare hierarchy of statutes"
)

# Simple health endpoint
@router.get("/health")
async def health():
    return {"status": "healthy", "service": "Legal Authority"}
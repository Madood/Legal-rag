"""
Legal RAG API Package
Canonical API layer - pure transport, no reasoning.
"""

__version__ = "1.0.0"

from .health import router as health_router
from .query import router as query_router
from .authority import router as authority_router
from .ingestion import router as ingestion_router
from .doctrine import router as doctrine_router
from .clarification import router as clarification_router

__all__ = [
    "health_router",
    "query_router",
    "authority_router",
    "ingestion_router",
    "doctrine_router",
    "clarification_router",
]
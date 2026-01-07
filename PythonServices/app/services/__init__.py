"""
Services package for Legal RAG Python Service.
"""

print("🔍 Loading services package...")

# Import all services
from app.services.embedding_service import embedding_service, EmbeddingService
from app.services.retrieval_service import retrieval_service, RetrievalService
from app.services.pdf_service import pdf_service, PDFService

# Import Vector Store components
from app.services.vector_store import (
    VectorStoreType,
    BaseVectorStore,
    FAISSStore,
    ChromaStore,
    QdrantStore,
    VectorStoreFactory,
    create_default_store,
    SearchResult
)

# FIX: Import legal_authority components - check what's actually available
try:
    from app.services.authority.legal_authority.resolver import resolve_authority, get_metrics
    print("✅ Legal Authority resolver imported")
    LEGAL_AUTHORITY_LOADED = True
except ImportError as e:
    print(f"❌ Failed to import legal_authority.resolver: {e}")
    # Create simple fallback
    def resolve_authority(question):
        return {
            "statute": None,
            "requiresClarification": True,
            "clarification": {
                "english": "Legal Authority Service not available",
                "german": "Legal Authority Service nicht verfügbar"
            }
        }
    
    def get_metrics():
        return {"authority_service": "not_loaded"}
    LEGAL_AUTHORITY_LOADED = False

try:
    from app.services.authority.legal_authority.statute_patterns import get_available_statutes
    print("✅ Legal Authority statute_patterns imported")
except ImportError:
    def get_available_statutes():
        return {"StGB": "German Criminal Code", "BGB": "German Civil Code", "EU-GDPR": "EU Data Protection"}

try:
    from app.services.authority.legal_authority.doctrines import get_doctrine_explanation
    print("✅ Legal Authority doctrines imported")
except ImportError:
    def get_doctrine_explanation(*args, **kwargs):
        return None

try:
    from app.services.authority.legal_authority.validation import validate_answer
    print("✅ Legal Authority validation imported")
except ImportError:
    def validate_answer(*args, **kwargs):
        return {"isValid": False, "message": "Authority service not available"}

try:
    from app.services.authority.legal_authority.hierarchy import compare_hierarchy
    print("✅ Legal Authority hierarchy imported")
except ImportError:
    def compare_hierarchy(*args, **kwargs):
        return 0

try:
    from app.services.authority.legal_authority.clarifications import missing_statute_clarification, gdpr_clarification
    print("✅ Legal Authority clarifications imported")
except ImportError:
    def missing_statute_clarification(*args, **kwargs):
        return {"english": "Service unavailable", "german": "Dienst nicht verfügbar"}
    
    def gdpr_clarification():
        return {"english": "Service unavailable", "german": "Dienst nicht verfügbar"}

# FIX: Import source authority - check what's available
try:
    from app.services.authority.source_authority.resolver import SourceAuthorityResolver
    print("✅ Source Authority Service imported")
    source_authority_resolver = SourceAuthorityResolver()
    SOURCE_AUTHORITY_AVAILABLE = True
except ImportError as e:
    print(f"❌ Failed to import source_authority: {e}")
    # Create fallback
    class SourceAuthorityResolver:
        def __init__(self):
            pass
        
        def resolve(self, *args, **kwargs):
            return {
                "allowed_documents": [],
                "authority_summary": {
                    "error": "Source Authority Service not loaded",
                    "available": False
                }
            }
        
        def classify_chunk(self, *args, **kwargs):
            return {
                "authority_metadata": {
                    "error": "Source Authority Service not loaded"
                }
            }
    
    source_authority_resolver = SourceAuthorityResolver()
    SOURCE_AUTHORITY_AVAILABLE = False

# Set availability flags based on imports
AUTHORITY_AVAILABLE = LEGAL_AUTHORITY_LOADED  # We have at least the fallbacks
AUTHORITY_LOCATION = "legal_authority" if LEGAL_AUTHORITY_LOADED else None  # Add this back

__all__ = [
    # Services
    "embedding_service",
    "EmbeddingService",
    "retrieval_service",
    "RetrievalService",
    "pdf_service",
    "PDFService",
    
    # Vector Stores
    "VectorStoreType",
    "BaseVectorStore",
    "FAISSStore",
    "ChromaStore",
    "QdrantStore",
    "VectorStoreFactory",
    "create_default_store",
    "SearchResult",
    
    # Legal Authority Service
    "resolve_authority",
    "get_metrics",
    "get_available_statutes",
    "get_doctrine_explanation",
    "validate_answer",
    "compare_hierarchy",
    "missing_statute_clarification",
    "gdpr_clarification",
    
    # Availability flags
    "AUTHORITY_AVAILABLE",
    "AUTHORITY_LOCATION",  # Add this back
    
    # Source Authority Service
    "SourceAuthorityResolver",
    "source_authority_resolver",
    "SOURCE_AUTHORITY_AVAILABLE"
]

print(f"✅ Services package loaded.")
print(f"   Legal Authority: {'Available' if AUTHORITY_AVAILABLE else 'Fallback mode'}")
print(f"   Source Authority: {'Available' if SOURCE_AUTHORITY_AVAILABLE else 'Fallback mode'}")
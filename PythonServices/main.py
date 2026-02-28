from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
from dotenv import load_dotenv
import os
import sys
import datetime
from contextlib import asynccontextmanager

# Load environment variables
load_dotenv()

# Add the app directory to Python path for imports
current_dir = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, current_dir)


# ===========================================================================
# LIFECYCLE MANAGEMENT
# ===========================================================================

@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    CRITICAL: Load FAISS indices on startup, fail fast if corrupted.
    Ensures legal authority is always available after restart.
    """
    print("\n" + "=" * 60)
    print("🚀 STARTUP: Loading Legal Corpus Indices")
    print("=" * 60)
    
    try:
        # Import retrieval service
        from app.services.retrieval.retrieval_service import retrieval_service
        
        # STEP 1: Try to load indices from disk
        print("📚 Loading FAISS indices from disk...")
        indices_dir = os.getenv("INDICES_DIR", "./data/indices")
        
        if not os.path.exists(indices_dir):
            print(f"⚠️  Indices directory not found: {indices_dir}")
            print("   Creating directory...")
            os.makedirs(indices_dir, exist_ok=True)
        
        # Check if any index files exist
        index_files = [f for f in os.listdir(indices_dir) if f.endswith('.faiss')]
        
        if index_files:
            print(f"   Found {len(index_files)} index files")
            load_success = retrieval_service.load_indices("legal_index")
            
            if load_success:
                # Verify indices are populated
                stats = retrieval_service.get_stats()
                bgb_vectors = stats.get("statute_indices", {}).get("BGB", {}).get("vectors", 0)
                total_vectors = stats.get("general_index", {}).get("vectors", 0) + sum(
                    idx["vectors"] for idx in stats.get("statute_indices", {}).values()
                )
                
                if total_vectors > 0:
                    print(f"✅ Loaded {total_vectors} vectors from disk")
                    print(f"   • BGB: {bgb_vectors} vectors")
                    print(f"   • Statutes: {list(stats.get('statute_indices', {}).keys())}")
                    
                    # Force correct state flags
                    retrieval_service.indices_loaded = True
                    retrieval_service.use_test_indices = False
                    
                    # Verify divorce norms are available
                    if bgb_vectors >= 5:  # Arbitrary but reasonable minimum
                        from app.services.embeddings.embedding_service import embedding_service
                        test_query = "divorce"
                        query_embedding = embedding_service.embed_query(test_query, "BGB")
                        
                        if "BGB" in retrieval_service.statute_indices:
                            store = retrieval_service.statute_indices["BGB"]
                            results = store.search(query_embedding, k=5)
                            divorce_paras = []
                            for r in results:
                                meta = r.get("metadata", {})
                                if meta.get("is_divorce_norm", False):
                                    divorce_paras.append(meta.get("paragraph"))
                            
                            if divorce_paras:
                                print(f"   • Divorce norms: {list(set(divorce_paras))[:5]}...")
                            else:
                                print("   ⚠️  No divorce norms detected in loaded corpus")
                    else:
                        print("   ⚠️  BGB corpus has very few vectors")
                else:
                    print("⚠️  Loaded indices but they contain 0 vectors")
                    retrieval_service.indices_loaded = False
                    retrieval_service.use_test_indices = True
            else:
                print("⚠️  Failed to load indices from disk")
                retrieval_service.indices_loaded = False
                retrieval_service.use_test_indices = True
        else:
            print("⚠️  No index files found on disk")
            print("   Using test indices only")
            retrieval_service.indices_loaded = True
            retrieval_service.use_test_indices = True
        
        # STEP 2: Final state verification
        stats = retrieval_service.get_stats()
        bgb_vectors = stats.get("statute_indices", {}).get("BGB", {}).get("vectors", 0)
        
        print("\n📊 STARTUP CORPUS STATE:")
        print(f"   • Indices loaded: {stats.get('indices_loaded', False)}")
        print(f"   • Using test indices: {stats.get('using_test_indices', True)}")
        print(f"   • BGB vectors: {bgb_vectors}")
        print(f"   • Total vectors: {stats.get('general_index', {}).get('vectors', 0) + sum(idx['vectors'] for idx in stats.get('statute_indices', {}).values())}")
        
        if bgb_vectors < 10 and not stats.get('using_test_indices', True):
            print("\n⚠️  WARNING: BGB corpus may be incomplete")
            print("   Expected: Hundreds of paragraphs for full BGB")
            print(f"   Found: {bgb_vectors} vectors")
            print("   Action: POST /ingestion/bgb with full BGB PDF")
        
        print("=" * 60)
        
        # Yield control to FastAPI
        yield
        
    except ImportError as e:
        print(f"❌ STARTUP FAILED: Could not import retrieval service: {e}")
        print("   The system will start but corpus loading is disabled.")
        yield
    except Exception as e:
        print(f"❌ STARTUP FAILED with unexpected error: {e}")
        import traceback
        traceback.print_exc()
        print("   The system will start but corpus may be unavailable.")
        yield
    finally:
        # Shutdown logic if needed
        print("\n🛑 SHUTDOWN: Cleaning up...")
        # Note: FAISS indices are in memory and will be garbage collected


# ===========================================================================
# FASTAPI APP INITIALIZATION
# ===========================================================================

# Create FastAPI app with lifespan management
app = FastAPI(
    title="Legal RAG Python Service",
    description="Embedding, Vector Search, PDF Processing, and Legal Authority Service",
    version="2.0.0",
    lifespan=lifespan
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=os.getenv("ALLOWED_ORIGINS", "*").split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ===========================================================================
# ROUTER IMPORTS AND SETUP (EXISTING CODE CONTINUES BELOW)
# ===========================================================================

# ✅ FIX: Import and include the query router
from app.api.query import router as query_router
app.include_router(query_router, prefix="/api")

# ✅ FIX: Import and include the ingestion router
try:
    from app.api.ingestion import router as ingestion_router
    app.include_router(ingestion_router, prefix="/api")
    print("✅ Ingestion router loaded successfully")
except ImportError as e:
    print(f"⚠️ Could not load ingestion router: {e}")

api_router = None  # Keep this for compatibility with existing code

# Import from services package which handles the location
try:
    # Import from our services package which handles multiple locations
    from app.services import (
        resolve_authority, 
        get_available_statutes, 
        get_doctrine_explanation,
        validate_answer,
        compare_hierarchy,
        get_metrics,
        AUTHORITY_AVAILABLE
    )
    
    if AUTHORITY_AVAILABLE:
        print("✅ Legal Authority Service imported successfully (lazy-loaded from registry)")
    else:
        print("⚠️ Legal Authority Service imported but not available")
    
    # Create the router manually
    from fastapi import APIRouter
    
    authority_router = APIRouter(prefix="/authority", tags=["legal authority"])
    
    @authority_router.post("/resolve")
    async def resolve_endpoint(request: dict):
        """Resolve legal authority for a question"""
        if 'question' not in request:
            raise HTTPException(status_code=400, detail="Missing 'question' field")
        result = resolve_authority(request['question'])
        
        # Add debug info if service is in fallback mode
        if not AUTHORITY_AVAILABLE:
            result['_debug'] = {
                'authority_service': 'fallback_mode',
                'available': False
            }
        return result
    
    @authority_router.get("/statutes")
    async def statutes_endpoint():
        """Get available statutes and their domains"""
        statutes = get_available_statutes()
        
        # Add debug info if service is in fallback mode
        if not AUTHORITY_AVAILABLE:
            statutes['_debug'] = {
                'authority_service': 'fallback_mode',
                'available': False
            }
        return statutes
    
    @authority_router.get("/doctrine/{doctrine_name}")
    async def doctrine_endpoint(doctrine_name: str, language: str = "german"):
        """Get doctrine/principle explanation"""
        explanation = get_doctrine_explanation(doctrine_name, language)
        if not explanation:
            raise HTTPException(status_code=404, detail=f"Doctrine '{doctrine_name}' not found")
        return explanation
    
    @authority_router.post("/validate")
    async def validate_endpoint(request: dict):
        """Validate an answer against legal context"""
        required = ['question', 'answer', 'statute']
        for field in required:
            if field not in request:
                raise HTTPException(status_code=400, detail=f"Missing '{field}' field")
        return validate_answer(request['question'], request['answer'], request['statute'])
    
    @authority_router.get("/compare/{statute_a}/{statute_b}")
    async def compare_endpoint(statute_a: str, statute_b: str):
        """Compare hierarchy rank of two statutes"""
        result = compare_hierarchy(statute_a, statute_b)
        
        if result == 1:
            relation = f"{statute_a} > {statute_b}"
        elif result == -1:
            relation = f"{statute_a} < {statute_b}"
        else:
            relation = f"{statute_a} = {statute_b}"
        
        return {
            'comparison': result,
            'relation': relation
        }
    
    @authority_router.get("/metrics")
    async def metrics_endpoint():
        """Get service metrics"""
        return get_metrics()
    
    @authority_router.get("/health")
    async def authority_health():
        """Health check endpoint"""
        return {
            "status": "healthy" if AUTHORITY_AVAILABLE else "fallback",
            "service": "Legal Authority",
            "available": AUTHORITY_AVAILABLE,
            "location": "authority.registry + authority.statute (lazy-loaded)" if AUTHORITY_AVAILABLE else None,
            "timestamp": datetime.datetime.now().isoformat()
        }
    
    # Include the router
    app.include_router(authority_router, prefix="/api")
    print("✅ Legal Authority router created and loaded successfully")
    
except ImportError as e:
    print(f"⚠️ Warning: Could not import Legal Authority service modules: {e}")
    import traceback
    traceback.print_exc()
    
    # Create a minimal authority router for fallback
    from fastapi import APIRouter
    fallback_authority = APIRouter(prefix="/authority", tags=["legal authority"])
    
    @fallback_authority.post("/resolve")
    async def fallback_resolve(request: dict):
        return {
            "error": "Legal Authority Service not loaded",
            "requiresClarification": True,
            "clarification": {
                "english": "Legal Authority Service is temporarily unavailable.",
                "german": "Der Legal Authority Service ist vorübergehend nicht verfügbar."
            },
            "_debug": {
                "import_error": str(e),
                "available": False
            }
        }
    
    @fallback_authority.get("/health")
    async def authority_health():
        return {
            "status": "fallback_mode",
            "service": "Legal Authority",
            "available": False,
            "location": None
        }
    
    app.include_router(fallback_authority, prefix="/api")
    authority_router = fallback_authority
    AUTHORITY_AVAILABLE = False

# CRITICAL: Add root-level endpoints for Node.js compatibility

@app.post("/api/search")
async def root_api_search(request: dict):
    """
    Root-level /api/search endpoint for Node.js
    Delegates to query service
    """
    try:
        from app.api.query import api_search
        return await api_search(request)
    except Exception as e:
        return {"error": str(e), "results": [], "count": 0}

@app.post("/api/search/authoritative")
async def root_api_authoritative_search(request: dict):
    """
    Root-level /api/search/authoritative endpoint for Node.js
    Delegates to query service
    """
    try:
        from app.api.query import authoritative_search
        return await authoritative_search(request)
    except Exception as e:
        return {
            "success": False,
            "error": str(e),
            "results": [],
            "authoritative_found": False
        }

# FIXED: Legal Authority endpoints for Node.js

@app.post("/api/authority/resolve")
async def root_authority_resolve(request: dict):
    """
    Root-level /api/authority/resolve endpoint for Node.js
    Delegates to the Legal Authority Service
    """
    try:
        # Use the imported function from services package
        # Check if resolve_authority is available
        if 'resolve_authority' not in globals():
            return {
                "statute": None,
                "requiresClarification": True,
                "clarification": {
                    "english": "Legal Authority Service not available",
                    "german": "Legal Authority Service nicht verfügbar"
                }
            }
            
        if 'question' not in request:
            return {
                "statute": None,
                "requiresClarification": True,
                "clarification": {
                    "english": "Missing 'question' field",
                    "german": "Fehlendes 'question'-Feld"
                }
            }
        result = resolve_authority(request['question'])
        
        # Add debug info
        if not AUTHORITY_AVAILABLE:
            result['_debug'] = {
                'authority_service': 'fallback_mode',
                'available': False
            }
        
        return result
    except Exception as e:
        print(f"Error in authority resolve: {e}")
        return {
            "statute": None,
            "requiresClarification": True,
            "clarification": {
                "english": f"Service error: {str(e)}",
                "german": f"Dienstfehler: {str(e)}"
            }
        }

@app.get("/api/authority/statutes")
async def root_authority_statutes():
    """
    Root-level /api/authority/statutes endpoint for Node.js
    """
    try:
        # Check if get_available_statutes is available
        if 'get_available_statutes' not in globals():
            return {"error": "Legal Authority Service not available", "statutes": {}}
            
        statutes = get_available_statutes()
        
        # Add debug info if service is in fallback mode
        if not AUTHORITY_AVAILABLE:
            statutes['_debug'] = {
                'authority_service': 'fallback_mode',
                'available': False
            }
        return statutes
    except Exception as e:
        return {"error": str(e), "statutes": {}}

@app.post("/api/authority/validate")
async def root_authority_validate(request: dict):
    """
    Root-level /api/authority/validate endpoint for Node.js
    """
    try:
        # Check if validate_answer is available
        if 'validate_answer' not in globals():
            return {
                "isValid": False,
                "error": "Legal Authority Service not available",
                "message": "Validation service unavailable"
            }
            
        required = ['question', 'answer', 'statute']
        for field in required:
            if field not in request:
                return {
                    "isValid": False,
                    "error": f"Missing '{field}' field",
                    "message": "Validation failed - missing required field"
                }
        return validate_answer(request['question'], request['answer'], request['statute'])
    except Exception as e:
        return {"isValid": False, "error": str(e), "message": "Validation failed"}

@app.get("/api/authority/health")
async def root_authority_health():
    """
    Root-level /api/authority/health endpoint for Node.js
    """
    try:
        # Check if resolve_authority is available
        if 'resolve_authority' not in globals():
            return {
                "status": "unavailable",
                "service": "Legal Authority",
                "available": False,
                "test_passed": False,
                "error": "Service not imported"
            }
            
        # Test if authority service is working
        test_result = resolve_authority("What does GDPR say?")
        return {
            "status": "healthy" if AUTHORITY_AVAILABLE else "fallback",
            "service": "Legal Authority",
            "available": AUTHORITY_AVAILABLE,
            "location": "authority.registry + authority.statute (lazy-loaded)" if AUTHORITY_AVAILABLE else None,
            "test_passed": test_result.get('statute') == 'EU-GDPR',
            "version": "1.0.0"
        }
    except Exception as e:
        return {
            "status": "unhealthy",
            "service": "Legal Authority",
            "error": str(e),
            "available": False,
            "test_passed": False
        }

@app.get("/api/health")
async def legacy_health_check():
    """
    Legacy health check endpoint for Node.js
    """
    # Get corpus state for health check
    try:
        from app.services.retrieval.retrieval_service import retrieval_service
        stats = retrieval_service.get_stats()
        bgb_vectors = stats.get("statute_indices", {}).get("BGB", {}).get("vectors", 0)
        corpus_state = {
            "indices_loaded": stats.get("indices_loaded", False),
            "using_test_indices": stats.get("using_test_indices", True),
            "bgb_vectors": bgb_vectors,
            "corpus_ready": bgb_vectors > 10 and not stats.get("using_test_indices", True)
        }
    except:
        corpus_state = {
            "error": "Could not retrieve corpus state"
        }
    
    return {
        "status": "healthy",
        "service": "Python Legal RAG",
        "version": "2.0.0",
        "modules": {
            "main_api": "loaded" if 'api_router' in globals() and api_router else "not_loaded",
            "authority": "available" if 'AUTHORITY_AVAILABLE' in globals() and AUTHORITY_AVAILABLE else "not_available",
            "authority_location": "authority.registry + authority.statute (lazy-loaded)" if 'AUTHORITY_AVAILABLE' in globals() and AUTHORITY_AVAILABLE else None,
            "query_router": "loaded",
            "ingestion_router": "loaded" if 'ingestion_router' in globals() else "not_loaded"
        },
        "corpus_state": corpus_state,
        "timestamp": datetime.datetime.now().isoformat()
    }

@app.get("/api/test")
async def test_endpoint():
    """Test endpoint"""
    # Get corpus state
    try:
        from app.services.retrieval.retrieval_service import retrieval_service
        stats = retrieval_service.get_stats()
        corpus_state = {
            "indices_loaded": stats.get("indices_loaded", False),
            "using_test_indices": stats.get("using_test_indices", True),
            "bgb_vectors": stats.get("statute_indices", {}).get("BGB", {}).get("vectors", 0)
        }
    except:
        corpus_state = {"error": "Could not retrieve corpus state"}
    
    return {
        "message": "Python Legal RAG Service is working", 
        "status": "ok",
        "authority_service": {
            "available": AUTHORITY_AVAILABLE if 'AUTHORITY_AVAILABLE' in globals() else False,
            "location": "authority.registry + authority.statute (lazy-loaded)" if AUTHORITY_AVAILABLE else None
        },
        "query_router": {
            "available": True,
            "endpoints": ["/query/search", "/query/search/authoritative"]
        },
        "corpus_state": corpus_state,
        "timestamp": datetime.datetime.now().isoformat()
    }

# Add a test endpoint specifically for Legal Authority
@app.get("/api/authority/test")
async def authority_test():
    """Test Legal Authority Service"""
    test_question = {"question": "What does GDPR Article 15 say?"}
    try:
        if 'resolve_authority' not in globals():
            return {
                "status": "unavailable",
                "authority_available": False,
                "test_question": test_question["question"],
                "error": "resolve_authority function not available"
            }
            
        result = resolve_authority(test_question["question"])
        return {
            "status": "working" if AUTHORITY_AVAILABLE else "fallback",
            "authority_available": AUTHORITY_AVAILABLE if 'AUTHORITY_AVAILABLE' in globals() else False,
            "test_question": test_question["question"],
            "result": result
        }
    except Exception as e:
        return {
            "status": "error",
            "error": str(e),
            "test_question": test_question["question"]
        }

# REMOVED: Source Authority endpoints - system does not have this subsystem

@app.get("/")
async def root():
    # Get corpus state for root endpoint
    try:
        from app.services.retrieval.retrieval_service import retrieval_service
        stats = retrieval_service.get_stats()
        corpus_state = {
            "indices_loaded": stats.get("indices_loaded", False),
            "using_test_indices": stats.get("using_test_indices", True),
            "bgb_vectors": stats.get("statute_indices", {}).get("BGB", {}).get("vectors", 0)
        }
    except:
        corpus_state = {"error": "Could not retrieve corpus state"}
    
    return {
        "service": "Legal RAG Python Service",
        "version": "2.0.0",
        "status": "running",
        "description": "Embedding, Vector Search, PDF Processing, and Legal Authority",
        "authority_services": {
            "legal_authority": {
                "available": AUTHORITY_AVAILABLE if 'AUTHORITY_AVAILABLE' in globals() else False,
                "location": "authority.registry + authority.statute (lazy-loaded)" if AUTHORITY_AVAILABLE else None
            }
        },
        "corpus_state": corpus_state,
        "endpoints": {
            "query_endpoints": {
                "/query/search": "POST - Simple semantic search",
                "/query/search/authoritative": "POST - Authoritative search with legal context",
                "/query/embeddings": "POST - Generate embeddings for text",
                "/query/embeddings/query": "POST - Generate query embeddings with legal context"
            },
            "ingestion_endpoints": {
                "/ingestion/bgb": "POST - Ingest BGB PDF (authoritative)",
                "/ingestion/text/bgb": "POST - Ingest BGB text",
                "/ingestion/status": "GET - Check corpus state",
                "/ingestion/verify/divorce": "POST - Verify divorce corpus"
            },
            "legacy_endpoints": {
                "/api/search": "POST - Search (Node.js compatible)",
                "/api/search/authoritative": "POST - Authoritative search",
                "/api/authority/resolve": "POST - Legal authority resolution",
                "/api/authority/statutes": "GET - Available statutes",
                "/api/authority/validate": "POST - Validate answer",
                "/api/authority/health": "GET - Authority health",
                "/api/health": "GET - Health check",
                "/api/test": "GET - Test endpoint",
                "/api/authority/test": "GET - Authority test"
            },
            "api_endpoints": {
                "/api/health": "GET - Health check",
                "/api/search": "POST - Search",
                "/api/search/authoritative": "POST - Authoritative search",
                "/api/authority/*": "Legal Authority endpoints"
            },
            "authority_endpoints": {
                "/authority/resolve": "POST - Resolve legal authority",
                "/authority/statutes": "GET - Available statutes",
                "/authority/doctrine/{name}": "GET - Legal doctrine explanation",
                "/authority/validate": "POST - Validate answer",
                "/authority/compare/{statute_a}/{statute_b}": "GET - Compare statutes",
                "/authority/metrics": "GET - Service metrics",
                "/authority/health": "GET - Health check"
            }
        },
        "legal_statutes_supported": [
            "StGB - German Criminal Code",
            "BGB - German Civil Code", 
            "HGB - German Commercial Code",
            "GG - German Basic Law",
            "EU-GDPR - EU Data Protection Regulation"
        ]
    }

@app.get("/health")
async def health_check():
    # Get corpus state for health check
    try:
        from app.services.retrieval.retrieval_service import retrieval_service
        stats = retrieval_service.get_stats()
        corpus_ready = (
            stats.get("indices_loaded", False) and 
            not stats.get("using_test_indices", True) and
            stats.get("statute_indices", {}).get("BGB", {}).get("vectors", 0) > 10
        )
    except:
        corpus_ready = False
    
    return {
        "status": "healthy",
        "service": "Python Legal RAG",
        "version": "2.0.0",
        "timestamp": datetime.datetime.now().isoformat(),
        "corpus_ready": corpus_ready,
        "modules": {
            "embeddings": True,
            "vector_search": True,
            "pdf_processing": True,
            "legal_authority": AUTHORITY_AVAILABLE if 'AUTHORITY_AVAILABLE' in globals() else False,
            "query_router": True,
            "ingestion_router": True if 'ingestion_router' in globals() else False
        }
    }

if __name__ == "__main__":
    print("=" * 60)
    print("🚀 Legal RAG Python Service Starting...")
    print("=" * 60)
    print("📚 Modules:")
    print("  • Embedding Generation")
    print("  • Vector Search")
    print("  • PDF Processing")
    print("  • Query Router (/query/* endpoints)")
    print("  • Ingestion Router (/ingestion/* endpoints)")
    authority_available = 'AUTHORITY_AVAILABLE' in globals() and AUTHORITY_AVAILABLE
    print(f"  • Legal Authority Service: {'✅ Available' if authority_available else '⚠️ Not available'}")
    print("")
    print("⚖️  Legal Statutes Supported:")
    print("  • StGB - German Criminal Code")
    print("  • BGB - German Civil Code")
    print("  • HGB - German Commercial Code")
    print("  • GG - German Basic Law")
    print("  • EU-GDPR - EU Data Protection Regulation")
    print("")
    print("🌐 API Endpoints:")
    print("  • http://localhost:8000/query/search")
    print("  • http://localhost:8000/query/search/authoritative")
    print("  • http://localhost:8000/ingestion/bgb (CRITICAL: Load BGB PDF)")
    print("  • http://localhost:8000/ingestion/status (Check corpus)")
    print("  • http://localhost:8000/authority/resolve")
    print("  • http://localhost:8000/api/authority/resolve (Node.js)")
    print("  • http://localhost:8000/api/search")
    print("  • http://localhost:8000/api/health")
    print("")
    print("📄 Documentation: http://localhost:8000/docs")
    print("⏰ Started at:", datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S"))
    print("=" * 60)
    
    uvicorn.run(
        "main:app",
        host=os.getenv("HOST", "0.0.0.0"),
        port=int(os.getenv("PORT", 8000)),
        reload=os.getenv("ENVIRONMENT", "development") == "development"
    )
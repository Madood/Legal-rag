from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
from dotenv import load_dotenv
import os
import sys
import datetime

# Load environment variables
load_dotenv()

# Add the app directory to Python path for imports
current_dir = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, current_dir)

# Create FastAPI app
app = FastAPI(
    title="Legal RAG Python Service",
    description="Embedding, Vector Search, PDF Processing, and Legal Authority Service",
    version="2.0.0"
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=os.getenv("ALLOWED_ORIGINS", "*").split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Import and include the main API router
try:
    from app.api.endpoints import router as api_router
    app.include_router(api_router, prefix="/api/v1")
    print("✅ Main API router loaded successfully")
except ImportError as e:
    print(f"⚠️ Warning: Could not import main API router: {e}")
    api_router = None

# ⭐⭐ FIXED: Import from services package which handles the location
try:
    # Import from our services package which handles multiple locations
    from app.services import (
        resolve_authority, 
        get_available_statutes, 
        get_doctrine_explanation,
        validate_answer,
        compare_hierarchy,
        get_metrics,
        AUTHORITY_AVAILABLE,
        AUTHORITY_LOCATION
    )
    
    if AUTHORITY_AVAILABLE:
        print(f"✅ Legal Authority Service imported successfully from '{AUTHORITY_LOCATION}'")
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
            "location": AUTHORITY_LOCATION,
            "timestamp": datetime.datetime.now().isoformat()
        }
    
    # Include the router
    app.include_router(authority_router)
    print("✅ Legal Authority router created and loaded successfully")
    
except ImportError as e:
    print(f"⚠️ Warning: Could not import Legal Authority service modules: {e}")
    
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
        return {"status": "fallback_mode", "service": "Legal Authority", "available": False}
    
    app.include_router(fallback_authority)
    authority_router = fallback_authority

# ⭐⭐ CRITICAL: Add root-level endpoints for Node.js compatibility

@app.post("/api/search")
async def root_api_search(request: dict):
    """
    Root-level /api/search endpoint for Node.js
    This will delegate to the endpoint in endpoints.py
    """
    try:
        if api_router:
            # Find the search endpoint in the router
            from app.api.endpoints import api_search
            return await api_search(request)
        else:
            # Fallback to direct implementation
            from app.services.embedding_service import embedding_service
            from app.services.retrieval_service import retrieval_service
            
            query = request.get("query", "")
            statute = request.get("statute")
            k = request.get("k", 10)
            
            query_embedding = embedding_service.embed_query(query, statute)
            search_results = retrieval_service.search(
                query_embedding=query_embedding,
                statute=statute,
                k=k
            )
            
            return {
                "results": search_results,
                "count": len(search_results)
            }
    except Exception as e:
        return {"error": str(e), "results": [], "count": 0}

@app.post("/api/search/authoritative")
async def root_api_authoritative_search(request: dict):
    """
    Root-level /api/search/authoritative endpoint for Node.js
    """
    try:
        if api_router:
            from app.api.endpoints import api_authoritative_search
            return await api_authoritative_search(request)
        else:
            # Simple fallback
            return {
                "success": True,
                "results": [],
                "authoritative_found": False,
                "fallback_reason": "api_router_not_loaded"
            }
    except Exception as e:
        return {
            "success": False,
            "error": str(e),
            "results": [],
            "authoritative_found": False
        }

# ⭐⭐ FIXED: Legal Authority endpoints for Node.js

@app.post("/api/authority/resolve")
async def root_authority_resolve(request: dict):
    """
    Root-level /api/authority/resolve endpoint for Node.js
    Delegates to the Legal Authority Service
    """
    try:
        # Use the imported function from services package
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
        # Test if authority service is working
        test_result = resolve_authority("What does GDPR say?")
        return {
            "status": "healthy" if AUTHORITY_AVAILABLE else "fallback",
            "service": "Legal Authority",
            "available": AUTHORITY_AVAILABLE,
            "location": AUTHORITY_LOCATION,
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
    return {
        "status": "healthy",
        "service": "Python Legal RAG",
        "version": "2.0.0",
        "modules": {
            "main_api": "loaded" if api_router else "not_loaded",
            "authority": "available" if AUTHORITY_AVAILABLE else "not_available",
            "authority_location": AUTHORITY_LOCATION if AUTHORITY_AVAILABLE else None
        },
        "timestamp": datetime.datetime.now().isoformat()
    }

@app.get("/api/test")
async def test_endpoint():
    """Test endpoint"""
    return {
        "message": "Python Legal RAG Service is working", 
        "status": "ok",
        "authority_service": {
            "available": AUTHORITY_AVAILABLE,
            "location": AUTHORITY_LOCATION
        },
        "timestamp": datetime.datetime.now().isoformat()
    }

# Add a test endpoint specifically for Legal Authority
@app.get("/api/authority/test")
async def authority_test():
    """Test Legal Authority Service"""
    test_question = {"question": "What does GDPR Article 15 say?"}
    try:
        result = resolve_authority(test_question["question"])
        return {
            "status": "working" if AUTHORITY_AVAILABLE else "fallback",
            "authority_available": AUTHORITY_AVAILABLE,
            "test_question": test_question["question"],
            "result": result
        }
    except Exception as e:
        return {
            "status": "error",
            "error": str(e),
            "test_question": test_question["question"]
        }

# ⭐⭐ NEW: Source Authority endpoints
try:
    from app.services import source_authority_resolver, SOURCE_AUTHORITY_AVAILABLE
    
    @app.post("/api/source-authority/resolve")
    async def root_source_authority_resolve(request: dict):
        """
        Root-level /api/source-authority/resolve endpoint
        """
        required = ['question', 'statute', 'questionType', 'documents']
        for field in required:
            if field not in request:
                raise HTTPException(status_code=400, detail=f"Missing '{field}' field")
        
        if not SOURCE_AUTHORITY_AVAILABLE:
            return {
                "allowed_documents": [],
                "authority_summary": {
                    "error": "Source Authority Service not available",
                    "available": False
                }
            }
        
        return source_authority_resolver.resolve(
            question=request['question'],
            statute=request['statute'],
            question_type=request['questionType'],
            all_documents=request['documents']
        )
    
    print("✅ Source Authority endpoints registered")
except ImportError as e:
    print(f"⚠️ Source Authority endpoints not available: {e}")

@app.get("/")
async def root():
    return {
        "service": "Legal RAG Python Service",
        "version": "2.0.0",
        "status": "running",
        "description": "Embedding, Vector Search, PDF Processing, and Legal Authority",
        "authority_services": {
            "legal_authority": {
                "available": AUTHORITY_AVAILABLE if 'AUTHORITY_AVAILABLE' in locals() else False,
                "location": AUTHORITY_LOCATION if 'AUTHORITY_LOCATION' in locals() else None
            },
            "source_authority": {
                "available": SOURCE_AUTHORITY_AVAILABLE if 'SOURCE_AUTHORITY_AVAILABLE' in locals() else False
            }
        },
        "endpoints": {
            "legacy_endpoints": {
                "/api/search": "POST - Search (Node.js compatible)",
                "/api/search/authoritative": "POST - Authoritative search",
                "/api/authority/resolve": "POST - Legal authority resolution",
                "/api/authority/statutes": "GET - Available statutes",
                "/api/authority/validate": "POST - Validate answer",
                "/api/authority/health": "GET - Authority health",
                "/api/source-authority/resolve": "POST - Source authority resolution",
                "/api/health": "GET - Health check",
                "/api/test": "GET - Test endpoint",
                "/api/authority/test": "GET - Authority test"
            },
            "v1_endpoints": {
                "/api/v1/health": "GET - Health check",
                "/api/v1/search": "POST - Search",
                "/api/v1/search/authoritative": "POST - Authoritative search",
                "/api/v1/embeddings": "POST - Generate embeddings",
                "/api/v1/process-pdf": "POST - Process PDF",
                "/api/v1/authority/*": "Legal Authority endpoints"
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
    return {
        "status": "healthy",
        "service": "Python Legal RAG",
        "version": "2.0.0",
        "timestamp": datetime.datetime.now().isoformat(),
        "modules": {
            "embeddings": True,
            "vector_search": True,
            "pdf_processing": True,
            "legal_authority": AUTHORITY_AVAILABLE if 'AUTHORITY_AVAILABLE' in locals() else False,
            "source_authority": SOURCE_AUTHORITY_AVAILABLE if 'SOURCE_AUTHORITY_AVAILABLE' in locals() else False
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
    print(f"  • Legal Authority Service: {'✅ Available' if 'AUTHORITY_AVAILABLE' in locals() and AUTHORITY_AVAILABLE else '⚠️ Not available'}")
    print(f"  • Source Authority Service: {'✅ Available' if 'SOURCE_AUTHORITY_AVAILABLE' in locals() and SOURCE_AUTHORITY_AVAILABLE else '⚠️ Not available'}")
    print("")
    print("⚖️  Legal Statutes Supported:")
    print("  • StGB - German Criminal Code")
    print("  • BGB - German Civil Code")
    print("  • HGB - German Commercial Code")
    print("  • GG - German Basic Law")
    print("  • EU-GDPR - EU Data Protection Regulation")
    print("")
    print("🌐 API Endpoints:")
    print("  • http://localhost:8000/authority/resolve")
    print("  • http://localhost:8000/api/authority/resolve (Node.js)")
    print("  • http://localhost:8000/api/source-authority/resolve")
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
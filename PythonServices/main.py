from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
from dotenv import load_dotenv
import os
from app.api.endpoints import router as api_router

# Load environment variables
load_dotenv()

# Create FastAPI app
app = FastAPI(
    title="Legal RAG Python Service",
    description="Embedding, Vector Search, and PDF Processing Microservice",
    version="1.0.0"
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=os.getenv("ALLOWED_ORIGINS", "*").split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API routes
app.include_router(api_router, prefix="/api/v1")

@app.get("/")
async def root():
    return {
        "service": "Legal RAG Python Service",
        "version": "1.0.0",
        "status": "running",
        "endpoints": {
            "health": "/api/v1/health",
            "embeddings": "/api/v1/embeddings",
            "search": "/api/v1/search",
            "process-pdf": "/api/v1/process-pdf"
        }
    }

@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "service": "Python Legal RAG",
        "version": "1.0.0"
    }

if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host=os.getenv("HOST", "0.0.0.0"),
        port=int(os.getenv("PORT", 8000)),
        reload=os.getenv("ENVIRONMENT", "development") == "development"
    )
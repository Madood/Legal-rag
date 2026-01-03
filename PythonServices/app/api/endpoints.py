from fastapi import APIRouter, HTTPException, UploadFile, File, Depends
from typing import List, Optional
import numpy as np
from datetime import datetime
from pydantic import BaseModel
from app.api import schemas
from app.services.embedding_service import embedding_service
from app.services.retrieval_service import retrieval_service
from app.services.pdf_service import pdf_service
import tempfile
import os

router = APIRouter()

# ⭐⭐ NEW: Authoritative Search Models
class SearchResult(BaseModel):
    document_id: str
    content: str
    similarity: float
    metadata: dict
    chunk_index: Optional[int] = None

class AuthoritativeSearchResponse(BaseModel):
    results: List[SearchResult]
    authority_summary: dict
    processing_time: float
    total_chunks_searched: int

class AuthorityConstraints(BaseModel):
    min_authority_rank: Optional[int] = 5
    allowed_source_types: Optional[List[str]] = []
    require_normative_content: Optional[bool] = False
    language_priority: Optional[List[str]] = ["german", "english"]

class AuthoritativeSearchRequest(BaseModel):
    query: dict
    authority_constraints: AuthorityConstraints
    documents: List[dict]
    options: Optional[dict] = {}

@router.get("/health")
async def health():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "service": "Python Legal RAG",
        "model": embedding_service.get_model_info()
    }

@router.post("/embeddings", response_model=schemas.EmbeddingsResponse)
async def generate_embeddings(request: schemas.EmbeddingsRequest):
    """
    Generate embeddings for text(s)
    """
    try:
        if isinstance(request.text, str):
            # Single text
            embedding = embedding_service.embed_text(request.text)
            embeddings = [embedding.tolist()]
        else:
            # Multiple texts
            embeddings_list = embedding_service.embed_batch(request.text)
            embeddings = [e.tolist() for e in embeddings_list]
        
        return {
            "embeddings": embeddings,
            "dimension": embedding_service.model.get_sentence_embedding_dimension()
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/embeddings/query", response_model=schemas.QueryEmbeddingResponse)
async def generate_query_embedding(request: schemas.QueryEmbeddingRequest):
    """
    Generate enhanced embedding for query with legal context
    """
    try:
        embedding = embedding_service.embed_query(
            request.query,
            request.statute
        )
        
        return {
            "embedding": embedding.tolist(),
            "dimension": embedding.shape[0],
            "statute": request.statute
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/search", response_model=schemas.SearchResponse)
async def search_documents(request: schemas.SearchRequest):
    """
    Search for similar documents/chunks
    """
    try:
        # Convert embedding if provided as list
        if isinstance(request.query_embedding, list):
            query_embedding = np.array(request.query_embedding, dtype=np.float32)
        else:
            # Generate embedding from query text
            query_embedding = embedding_service.embed_query(
                request.query_text,
                request.statute
            )
        
        # Search
        results = retrieval_service.search(
            query_embedding=query_embedding,
            statute=request.statute,
            k=request.top_k,
            filters=request.filters
        )
        
        return {
            "results": results,
            "count": len(results),
            "statute": request.statute
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ⭐⭐ NEW: Authoritative Search Endpoint
@router.post("/search/authoritative", response_model=AuthoritativeSearchResponse)
async def authoritative_search(request: AuthoritativeSearchRequest):
    """
    Authoritative search endpoint with authority constraints.
    Only searches through pre-approved authoritative documents.
    """
    start_time = datetime.now()
    
    try:
        query_text = request.query.get("text", "")
        statute = request.query.get("statute", "")
        question_type = request.query.get("question_type", "GENERAL")
        
        print(f"\n[Python] Authoritative search request:")
        print(f"  Query: {query_text[:60]}...")
        print(f"  Statute: {statute}")
        print(f"  Question type: {question_type}")
        print(f"  Documents received: {len(request.documents)}")
        
        # Step 1: Filter documents based on authority constraints
        filtered_docs = []
        for doc in request.documents:
            if meets_authority_constraints(doc, request.authority_constraints):
                filtered_docs.append(doc)
        
        if not filtered_docs:
            print(f"  ⚠️ No documents meet authority constraints")
            return AuthoritativeSearchResponse(
                results=[],
                authority_summary={
                    "statute": statute,
                    "documents_received": len(request.documents),
                    "documents_filtered": 0,
                    "filter_reason": "No documents met authority constraints"
                },
                processing_time=0.0,
                total_chunks_searched=0
            )
        
        print(f"  ✅ Documents after filtering: {len(filtered_docs)}")
        
        # Step 2: Extract all chunks from filtered documents
        all_chunks = []
        chunk_to_doc_map = []
        
        for doc in filtered_docs:
            doc_id = doc.get("id", "unknown")
            doc_title = doc.get("metadata", {}).get("title", doc_id)
            authority_meta = doc.get("authority_metadata", doc.get("metadata", {}).get("authority_metadata", {}))
            
            # Use provided chunks or create from content
            chunks = doc.get("chunks", [])
            if not chunks and "content" in doc:
                # Create chunks from content
                content = doc["content"]
                chunks = create_chunks_from_content(content)
            
            for chunk_idx, chunk in enumerate(chunks):
                chunk_content = chunk.get("content", str(chunk))
                if len(chunk_content.strip()) < 20:
                    continue  # Skip very short chunks
                
                all_chunks.append({
                    "content": chunk_content,
                    "doc_id": doc_id,
                    "doc_title": doc_title,
                    "chunk_index": chunk_idx,
                    "authority_rank": authority_meta.get("authority_rank", 100),
                    "source_type": authority_meta.get("source_type", "unknown"),
                    "language": doc.get("metadata", {}).get("language", "unknown")
                })
                chunk_to_doc_map.append(doc_id)
        
        print(f"  Total chunks extracted: {len(all_chunks)}")
        
        if not all_chunks:
            return AuthoritativeSearchResponse(
                results=[],
                authority_summary={
                    "statute": statute,
                    "documents_filtered": len(filtered_docs),
                    "chunks_extracted": 0,
                    "reason": "No content chunks found"
                },
                processing_time=0.0,
                total_chunks_searched=0
            )
        
        # Step 3: Generate embeddings for query
        query_embedding = embedding_service.embed_query(query_text, statute)
        
        # Step 4: Generate embeddings for chunks (batch)
        chunk_contents = [chunk["content"] for chunk in all_chunks]
        chunk_embeddings = embedding_service.embed_batch(chunk_contents)
        
        # Step 5: Calculate similarities
        similarities = []
        for chunk_embedding in chunk_embeddings:
            if chunk_embedding is not None:
                similarity = cosine_similarity(query_embedding, chunk_embedding)
                similarities.append(float(similarity))
            else:
                similarities.append(0.0)
        
        # Step 6: Combine with authority ranking
        scored_chunks = []
        for i, chunk in enumerate(all_chunks):
            base_score = similarities[i]
            authority_rank = chunk.get("authority_rank", 100)
            source_type = chunk.get("source_type", "unknown")
            
            # Adjust score based on authority
            adjusted_score = adjust_score_with_authority(
                base_score, 
                authority_rank, 
                source_type,
                statute,
                question_type
            )
            
            scored_chunks.append({
                "chunk": chunk,
                "similarity": base_score,
                "adjusted_score": adjusted_score,
                "authority_rank": authority_rank,
                "source_type": source_type
            })
        
        # Step 7: Sort by adjusted score
        scored_chunks.sort(key=lambda x: x["adjusted_score"], reverse=True)
        
        # Step 8: Apply result limits and diversity
        options = request.options or {}
        max_results = options.get("max_results", 30)
        similarity_threshold = options.get("similarity_threshold", 0.15)
        
        final_results = []
        used_documents = set()
        
        for scored in scored_chunks:
            if len(final_results) >= max_results:
                break
            
            if scored["adjusted_score"] < similarity_threshold:
                continue
            
            chunk = scored["chunk"]
            doc_id = chunk["doc_id"]
            
            # Diversity: Limit to 3 chunks per document
            doc_chunks = [r for r in final_results if r["document_id"] == doc_id]
            if len(doc_chunks) >= 3:
                continue
            
            final_results.append({
                "document_id": doc_id,
                "content": chunk["content"],
                "similarity": float(scored["adjusted_score"]),
                "metadata": {
                    "title": chunk["doc_title"],
                    "chunk_index": chunk["chunk_index"],
                    "authority_rank": chunk["authority_rank"],
                    "source_type": chunk["source_type"],
                    "language": chunk["language"]
                },
                "chunk_index": chunk["chunk_index"]
            })
            used_documents.add(doc_id)
        
        # Step 9: Prepare response
        processing_time = (datetime.now() - start_time).total_seconds()
        
        print(f"  Results found: {len(final_results)}")
        print(f"  Processing time: {processing_time:.2f}s")
        
        return AuthoritativeSearchResponse(
            results=final_results,
            authority_summary={
                "statute": statute,
                "question_type": question_type,
                "documents_received": len(request.documents),
                "documents_filtered": len(filtered_docs),
                "chunks_searched": len(all_chunks),
                "results_returned": len(final_results),
                "documents_in_results": len(used_documents),
                "processing_time_seconds": processing_time
            },
            processing_time=processing_time,
            total_chunks_searched=len(all_chunks)
        )
        
    except Exception as e:
        print(f"  ❌ Error in authoritative search: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

def meets_authority_constraints(doc, constraints):
    """Check if document meets authority constraints"""
    authority_meta = doc.get("authority_metadata", doc.get("metadata", {}).get("authority_metadata", {}))
    
    # Check minimum authority rank (lower number = higher authority)
    min_rank = constraints.min_authority_rank if hasattr(constraints, 'min_authority_rank') else constraints.get("min_authority_rank", 5)
    doc_rank = authority_meta.get("authority_rank", 100)
    if doc_rank > min_rank:
        return False
    
    # Check allowed source types
    allowed_types = constraints.allowed_source_types if hasattr(constraints, 'allowed_source_types') else constraints.get("allowed_source_types", [])
    if allowed_types:
        doc_type = authority_meta.get("source_type", "unknown")
        if doc_type not in allowed_types:
            return False
    
    # Check normative content requirement
    require_normative = constraints.require_normative_content if hasattr(constraints, 'require_normative_content') else constraints.get("require_normative_content", False)
    if require_normative:
        content = doc.get("content", "")
        if not has_normative_content(content):
            return False
    
    return True

def has_normative_content(text):
    """Check if text contains normative legal content"""
    if not text:
        return False
    
    normative_patterns = [
        "shall", "must", "required to", "obligated to",
        "§", "article", "paragraph", "section",
        "ist", "sind", "muss", "müssen", "darf", "dürfen"
    ]
    
    text_lower = text.lower()
    return any(pattern in text_lower for pattern in normative_patterns)

def create_chunks_from_content(content, max_chunk_size=500):
    """Create chunks from content if not provided"""
    if not content:
        return []
    
    # Simple paragraph splitting
    paragraphs = [p.strip() for p in content.split('\n\n') if p.strip()]
    
    chunks = []
    for para in paragraphs:
        if len(para) <= max_chunk_size:
            chunks.append({"content": para})
        else:
            # Split long paragraphs by sentences
            sentences = [s.strip() for s in para.split('.') if s.strip()]
            current_chunk = ""
            for sentence in sentences:
                if len(current_chunk) + len(sentence) + 1 <= max_chunk_size:
                    current_chunk += sentence + ". "
                else:
                    if current_chunk:
                        chunks.append({"content": current_chunk.strip()})
                    current_chunk = sentence + ". "
            if current_chunk:
                chunks.append({"content": current_chunk.strip()})
    
    return chunks

def adjust_score_with_authority(base_score, authority_rank, source_type, statute, question_type):
    """Adjust similarity score based on authority"""
    adjusted = base_score
    
    # Authority rank adjustments
    if authority_rank == 1:
        adjusted *= 1.2  # Official text: 20% boost
    elif authority_rank <= 3:
        adjusted *= 1.1  # Official translation: 10% boost
    elif authority_rank >= 5:
        adjusted *= 0.9  # Commentary/unofficial: 10% penalty
    
    # Source type adjustments
    if source_type == "registry_boilerplate":
        adjusted *= 0.5  # Heavy penalty for boilerplate
    
    # Statute-specific adjustments
    if statute == "HGB" and "translation" in source_type:
        # HGB translations are common, less penalty
        adjusted *= 0.95  # Only 5% penalty
    
    # Question type adjustments
    if question_type == "NORMATIVE" and authority_rank > 2:
        # Normative questions need high authority
        adjusted *= 0.8  # 20% penalty for non-official sources
    
    return min(adjusted, 1.0)  # Cap at 1.0

def cosine_similarity(vec1, vec2):
    """Calculate cosine similarity between two vectors"""
    if vec1 is None or vec2 is None:
        return 0.0
    
    dot = np.dot(vec1, vec2)
    norm1 = np.linalg.norm(vec1)
    norm2 = np.linalg.norm(vec2)
    
    if norm1 == 0 or norm2 == 0:
        return 0.0
    
    return dot / (norm1 * norm2)

@router.post("/process-pdf", response_model=schemas.PDFProcessResponse)
async def process_pdf(
    file: UploadFile = File(...),
    chunk_size: int = 800,
    overlap: int = 100
):
    """
    Process PDF file: extract text, chunk, and generate embeddings
    """
    try:
        # Save uploaded file temporarily
        with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp_file:
            content = await file.read()
            tmp_file.write(content)
            tmp_path = tmp_file.name
        
        try:
            # Extract text
            text, metadata = pdf_service.extract_text(tmp_path)
            
            # Chunk text
            chunks = pdf_service.chunk_legal_text(text, chunk_size, overlap)
            
            # Generate embeddings for chunks
            chunk_texts = [chunk["content"] for chunk in chunks]
            embeddings = embedding_service.embed_batch(chunk_texts)
            
            # Prepare document for indexing
            documents = []
            for i, chunk in enumerate(chunks):
                documents.append({
                    "id": f"{file.filename}_{i}",
                    "filename": file.filename,
                    "content": chunk["content"],
                    "chunk_index": i,
                    "page": 0,  # Would need page mapping
                    "statute": metadata.statute,
                    "metadata": {
                        "word_count": chunk["word_count"],
                        "has_paragraph": chunk["has_paragraph"],
                        "has_article": chunk["has_article"]
                    }
                })
            
            # Index documents
            retrieval_service.index_documents(
                documents=documents,
                statute=metadata.statute,
                embeddings=np.array(embeddings)
            )
            
            return {
                "filename": file.filename,
                "text_length": len(text),
                "chunks_count": len(chunks),
                "statute": metadata.statute,
                "language": metadata.language,
                "pages": metadata.pages,
                "chunks": chunks[:5]  # Return first 5 chunks as sample
            }
            
        finally:
            # Clean up temp file
            os.unlink(tmp_path)
            
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/index-documents", response_model=schemas.IndexResponse)
async def index_documents(request: schemas.IndexRequest):
    """
    Index multiple documents with embeddings
    """
    try:
        # Convert embeddings if provided
        embeddings = None
        if request.embeddings:
            embeddings = np.array(request.embeddings, dtype=np.float32)
        
        # Index documents
        retrieval_service.index_documents(
            documents=request.documents,
            statute=request.statute,
            embeddings=embeddings
        )
        
        return {
            "indexed_count": len(request.documents),
            "statute": request.statute,
            "message": "Documents indexed successfully"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/indices/save")
async def save_indices(name: str = "legal_index"):
    """
    Save all indices to disk
    """
    try:
        retrieval_service.save_indices(name)
        return {"message": f"Indices saved as {name}"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/indices/load")
async def load_indices(name: str = "legal_index"):
    """
    Load indices from disk
    """
    try:
        success = retrieval_service.load_indices(name)
        if success:
            return {"message": f"Indices loaded from {name}"}
        else:
            raise HTTPException(status_code=404, detail=f"Indices not found: {name}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
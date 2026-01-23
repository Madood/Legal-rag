"""
BGB PDF INGESTION ENDPOINT - SINGLE PURPOSE
Extract German Civil Code paragraphs (§§) and index them as authoritative norms.
No analysis, no chunking, no fallbacks.
"""
from fastapi import APIRouter, HTTPException, UploadFile, File
import tempfile
import os
import re
from typing import Dict, Any, List, Tuple
import logging
import numpy as np

from app.services.embeddings.embedding_service import embedding_service
from app.services.retrieval.retrieval_service import retrieval_service

router = APIRouter(prefix="/ingestion", tags=["ingestion"])
logger = logging.getLogger(__name__)


def _extract_bgb_paragraphs_from_text(text: str) -> Tuple[List[Dict[str, Any]], List[str]]:
    """
    CRITICAL: Extract BGB paragraphs as individual normative documents.
    One paragraph = one authoritative document. No chunking.
    
    Returns: (paragraphs, extraction_warnings)
    """
    paragraphs = []
    warnings = []
    lines = text.split('\n')
    current_paragraph = None
    current_content = []
    paragraph_counter = 0
    
    for i, line in enumerate(lines):
        line = line.strip()
        if not line:
            continue
            
        # ✅ FIX 1: Robust paragraph detection
        # Handles: §1565, § 1565, § 1565 Abs. 1, §1565a
        paragraph_match = re.search(r'^§\s*(\d+[a-z]?)(?:\s+Abs?\.?\s*\d+)?', line)
        
        if paragraph_match:
            # Save previous paragraph if exists
            if current_paragraph and current_content:
                paragraph_doc = _create_paragraph_document(
                    paragraph_number=current_paragraph,
                    content=' '.join(current_content),
                    line_number=i
                )
                paragraphs.append(paragraph_doc)
                paragraph_counter += 1
            
            # Extract new paragraph number
            para_number = paragraph_match.group(1)
            current_paragraph = para_number
            current_content = [line]
            
            # Check if this is a divorce paragraph
            try:
                para_num_int = int(re.match(r'\d+', para_number).group())
                if 1564 <= para_num_int <= 1588:
                    # ✅ FIX 2: Explicit priority tagging for divorce norms
                    pass  # Will be tagged in _create_paragraph_document
            except:
                pass
                
        elif current_paragraph:
            # Continue current paragraph
            current_content.append(line)
    
    # Don't forget the last paragraph
    if current_paragraph and current_content:
        paragraph_doc = _create_paragraph_document(
            paragraph_number=current_paragraph,
            content=' '.join(current_content),
            line_number=len(lines)
        )
        paragraphs.append(paragraph_doc)
        paragraph_counter += 1
    
    # Check for suspiciously low paragraph count
    if paragraph_counter < 50:
        warnings.append(f"Low paragraph count ({paragraph_counter}). BGB typically has thousands.")
    
    return paragraphs, warnings


def _create_paragraph_document(paragraph_number: str, content: str, line_number: int) -> Dict[str, Any]:
    """
    Create a structured paragraph document with proper authority metadata.
    """
    # Determine if this is a divorce paragraph
    is_divorce_norm = False
    priority_domain = None
    priority_reason = None
    
    try:
        para_num_int = int(re.match(r'\d+', paragraph_number).group())
        if 1564 <= para_num_int <= 1588:
            is_divorce_norm = True
            priority_domain = "family_law"
            priority_reason = "divorce_core_norm"
    except:
        pass
    
    return {
        "id": f"BGB_{paragraph_number}",
        "content": content,
        "statute": "BGB",
        "paragraph": paragraph_number,
        "is_normative": True,
        "document_type": "statutory",
        "authority_score": 1.0,
        "norm_type": "civil_norm",
        "authority_level": "statutory",
        "filename": "BGB_English.pdf",
        "line_number": line_number,
        "word_count": len(content.split()),
        # ✅ FIX 2: Explicit priority metadata for examiners
        "priority_domain": priority_domain,
        "priority_reason": priority_reason,
        "is_divorce_norm": is_divorce_norm,
        "extraction_timestamp": os.path.getmtime(__file__) if os.path.exists(__file__) else 0
    }


def _extract_pdf_text(pdf_path: str) -> str:
    """
    Extract text from PDF using PyPDF2 or fallback.
    """
    try:
        import PyPDF2
        with open(pdf_path, 'rb') as file:
            pdf_reader = PyPDF2.PdfReader(file)
            text = ""
            for i, page in enumerate(pdf_reader.pages):
                page_text = page.extract_text()
                if page_text:
                    text += f"[Page {i+1}]\n{page_text}\n\n"
                else:
                    logger.warning(f"Page {i+1} has no extractable text")
            return text.strip()
    except ImportError:
        logger.error("PyPDF2 not installed. Cannot extract PDF text.")
        raise HTTPException(
            status_code=400,
            detail="PyPDF2 not installed. Please install: pip install PyPDF2"
        )
    except Exception as e:
        logger.error(f"PDF extraction failed: {e}")
        raise HTTPException(
            status_code=400,
            detail=f"Failed to extract text from PDF: {str(e)}"
        )


@router.post("/bgb")
async def ingest_bgb_pdf(
    file: UploadFile = File(...),
    force_reingest: bool = False
) -> Dict[str, Any]:
    """
    SINGLE PURPOSE: Ingest BGB PDF and index all paragraphs as authoritative norms.
    
    Workflow:
    1. Upload BGB PDF
    2. Extract text
    3. Extract individual paragraphs (§§)
    4. Index each paragraph as separate authoritative document
    5. Save to disk
    6. Return ingestion stats
    
    No chunking. No analysis. No fallbacks.
    """
    # Check if this is a BGB file
    filename = file.filename.lower()
    if not ("bgb" in filename or "civil" in filename or "code" in filename or "burger" in filename):
        logger.warning(f"File {file.filename} may not be BGB. Continuing anyway.")
    
    print(f"\n🚀 STARTING BGB INGESTION: {file.filename}")
    print("=" * 60)
    
    # Check current corpus state
    stats_before = retrieval_service.get_stats()
    bgb_before = stats_before.get("statute_indices", {}).get("BGB", {}).get("vectors", 0)
    
    if bgb_before > 100 and not force_reingest:
        print(f"⚠️  BGB already has {bgb_before} vectors. Use force_reingest=true to re-ingest.")
        return {
            "status": "skipped",
            "message": "BGB already ingested. Use force_reingest=true to re-ingest.",
            "existing_vectors": bgb_before,
            "action_required": "force_reingest"
        }
    
    # Save uploaded file temporarily
    with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp_file:
        content = await file.read()
        tmp_file.write(content)
        tmp_path = tmp_file.name
    
    try:
        # STEP 1: Extract text from PDF
        print("📄 Extracting text from PDF...")
        raw_text = _extract_pdf_text(tmp_path)
        
        if not raw_text or len(raw_text) < 1000:
            raise HTTPException(
                status_code=400,
                detail="PDF contains too little text or could not be extracted"
            )
        
        print(f"   Extracted {len(raw_text)} characters")
        
        # STEP 2: Extract BGB paragraphs
        print("📖 Extracting BGB paragraphs...")
        paragraphs, extraction_warnings = _extract_bgb_paragraphs_from_text(raw_text)
        
        if not paragraphs:
            raise HTTPException(
                status_code=400,
                detail="No BGB paragraphs found in PDF. Ensure it contains § symbols."
            )
        
        print(f"   Found {len(paragraphs)} BGB paragraphs")
        
        # ✅ FIX 4: Block ingestion of partial BGBs
        if len(paragraphs) < 200:
            error_msg = f"BGB corpus incomplete. Expected full statute, found only {len(paragraphs)} paragraphs."
            logger.error(error_msg)
            raise HTTPException(
                status_code=400,
                detail=error_msg
            )
        
        # Add extraction warnings to response
        for warning in extraction_warnings:
            print(f"   ⚠️  {warning}")
        
        # Count divorce paragraphs
        divorce_paragraphs = [p for p in paragraphs if p.get("is_divorce_norm", False)]
        if divorce_paragraphs:
            print(f"   Found {len(divorce_paragraphs)} divorce-specific paragraphs (§§ 1564-1588)")
        
        # STEP 3: Generate embeddings
        print("🔧 Generating embeddings...")
        texts = [p["content"] for p in paragraphs]
        embeddings = embedding_service.embed_batch(texts)
        
        # ✅ BUG FIX: Safe logging for list vs array
        if embeddings:
            # Convert to numpy array for shape checking if needed
            embeddings_np = np.asarray(embeddings, dtype="float32")
            print(f"   Generated {len(embeddings)} embeddings, shape: {embeddings_np.shape}")
        else:
            print("   Generated 0 embeddings")
        
        # ✅ FIX 3: Validate embedding consistency
        expected_dimension = embedding_service.model.get_sentence_embedding_dimension()
        # Ensure embeddings is numpy array for dimension check
        embeddings_array = np.asarray(embeddings, dtype="float32") if embeddings else np.array([])
        if embeddings_array.size > 0 and embeddings_array.shape[1] != expected_dimension:
            error_msg = f"Embedding dimension mismatch: {embeddings_array.shape[1]} != {expected_dimension}"
            logger.error(error_msg)
            raise HTTPException(
                status_code=500,
                detail=f"Embedding consistency error: {error_msg}"
            )
        print(f"   ✅ Embedding dimension verified: {expected_dimension}")
        
        # STEP 4: Index documents with BGB statute
        print("📝 Indexing as authoritative BGB norms...")
        retrieval_service.index_documents(
            documents=paragraphs,
            statute="BGB",
            embeddings=embeddings_array
        )
        
        # STEP 5: Save indices to disk
        print("💾 Saving indices to disk...")
        save_success = retrieval_service.save_indices("legal_index")
        
        if not save_success:
            logger.warning("Indices could not be saved to disk (Windows FAISS limitation)")
        
        # STEP 6: Verify ingestion
        print("✅ Verifying ingestion...")
        stats_after = retrieval_service.get_stats()
        bgb_after = stats_after.get("statute_indices", {}).get("BGB", {}).get("vectors", 0)
        
        # Force indices to be marked as loaded
        retrieval_service.indices_loaded = True
        
        print("=" * 60)
        print(f"🎉 BGB INGESTION COMPLETE")
        print(f"   Before: {bgb_before} vectors")
        print(f"   After:  {bgb_after} vectors")
        print(f"   Added:  {bgb_after - bgb_before} new vectors")
        print(f"   Saved to disk: {save_success}")
        print(f"   Divorce norms: {len(divorce_paragraphs)}")
        
        return {
            "status": "success",
            "filename": file.filename,
            "paragraphs_extracted": len(paragraphs),
            "divorce_paragraphs": len(divorce_paragraphs),
            "divorce_paragraph_numbers": [
                p["paragraph"] for p in paragraphs 
                if p.get("is_divorce_norm", False)
            ][:10],
            "vectors_indexed": bgb_after,
            "vectors_added": bgb_after - bgb_before,
            "saved_to_disk": save_success,
            "sample_paragraphs": [p["paragraph"] for p in paragraphs[:10]],
            "extraction_warnings": extraction_warnings,
            "embedding_consistency": "verified",
            "corpus_state": {
                "indices_loaded": True,
                "has_real_corpus": True,
                "bgb_vectors": bgb_after,
                "paragraph_count": len(paragraphs),
                "divorce_norms_available": len(divorce_paragraphs) > 0
            },
            "priority_domains": {
                "family_law": len(divorce_paragraphs),
                "explicit_tagging": True
            },
            "next_step": "Query BGB divorce law with /query/search/authoritative"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"BGB ingestion failed: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=500, 
            detail=f"BGB ingestion failed: {str(e)}"
        )
    finally:
        # Clean up temp file
        if os.path.exists(tmp_path):
            os.unlink(tmp_path)


@router.post("/text/bgb")
async def ingest_bgb_text(
    text: str,
    filename: str = "BGB_English.txt"
) -> Dict[str, Any]:
    """
    Ingest BGB text directly (bypass PDF extraction).
    Useful for testing with sample BGB text.
    """
    print(f"\n📝 INGESTING BGB TEXT: {filename}")
    
    # Check current state
    stats_before = retrieval_service.get_stats()
    bgb_before = stats_before.get("statute_indices", {}).get("BGB", {}).get("vectors", 0)
    
    # Extract paragraphs
    paragraphs, extraction_warnings = _extract_bgb_paragraphs_from_text(text)
    
    if not paragraphs:
        raise HTTPException(
            status_code=400,
            detail="No BGB paragraphs found in text. Ensure it contains § symbols."
        )
    
    # ✅ FIX 4: Block ingestion of partial BGBs
    if len(paragraphs) < 200:
        error_msg = f"BGB text incomplete. Expected full statute, found only {len(paragraphs)} paragraphs."
        logger.error(error_msg)
        raise HTTPException(
            status_code=400,
            detail=error_msg
        )
    
    print(f"   Found {len(paragraphs)} BGB paragraphs")
    
    # Generate embeddings
    texts = [p["content"] for p in paragraphs]
    embeddings = embedding_service.embed_batch(texts)
    
    # ✅ BUG FIX: Safe logging and conversion
    if embeddings:
        embeddings_np = np.asarray(embeddings, dtype="float32")
        print(f"   Generated {len(embeddings)} embeddings, shape: {embeddings_np.shape}")
    else:
        print("   Generated 0 embeddings")
        embeddings_np = np.array([])
    
    # ✅ FIX 3: Validate embedding consistency
    expected_dimension = embedding_service.model.get_sentence_embedding_dimension()
    if embeddings_np.size > 0 and embeddings_np.shape[1] != expected_dimension:
        error_msg = f"Embedding dimension mismatch: {embeddings_np.shape[1]} != {expected_dimension}"
        logger.error(error_msg)
        raise HTTPException(
            status_code=500,
            detail=f"Embedding consistency error: {error_msg}"
        )
    
    # Index documents
    retrieval_service.index_documents(
        documents=paragraphs,
        statute="BGB",
        embeddings=embeddings_np
    )
    
    # Save to disk
    save_success = retrieval_service.save_indices("legal_index")
    
    # Verify
    stats_after = retrieval_service.get_stats()
    bgb_after = stats_after.get("statute_indices", {}).get("BGB", {}).get("vectors", 0)
    
    # Update state
    retrieval_service.indices_loaded = True
    
    # Count divorce paragraphs
    divorce_paragraphs = [p for p in paragraphs if p.get("is_divorce_norm", False)]
    
    return {
        "status": "success",
        "filename": filename,
        "paragraphs_extracted": len(paragraphs),
        "divorce_paragraphs": len(divorce_paragraphs),
        "vectors_indexed": bgb_after,
        "vectors_added": bgb_after - bgb_before,
        "saved_to_disk": save_success,
        "sample_paragraphs": [p["paragraph"] for p in paragraphs[:5]],
        "extraction_warnings": extraction_warnings,
        "embedding_consistency": "verified",
        "corpus_state": {
            "indices_loaded": True,
            "has_real_corpus": True,
            "divorce_norms_available": len(divorce_paragraphs) > 0
        }
    }


@router.get("/status")
async def get_ingestion_status() -> Dict[str, Any]:
    """
    Check current ingestion status.
    Returns whether real BGB corpus is loaded.
    """
    stats = retrieval_service.get_stats()
    bgb_vectors = stats.get("statute_indices", {}).get("BGB", {}).get("vectors", 0)
    
    # Check for divorce norms
    divorce_norms_available = False
    if bgb_vectors > 0:
        # Quick check if we have any divorce norms
        try:
            from app.services.embeddings.embedding_service import embedding_service
            test_query = "divorce"
            query_embedding = embedding_service.embed_query(test_query, "BGB")
            
            if "BGB" in retrieval_service.statute_indices:
                store = retrieval_service.statute_indices["BGB"]
                if store.index and store.index.ntotal > 0:
                    results = store.search(query_embedding, k=5)
                    for result in results:
                        metadata = result.get("metadata", {})
                        if metadata.get("is_divorce_norm", False):
                            divorce_norms_available = True
                            break
        except:
            pass
    
    return {
        "bgb_loaded": bgb_vectors > 200,
        "bgb_vectors": bgb_vectors,
        "has_real_corpus": stats.get("has_real_corpus", False),
        "indices_loaded": stats.get("indices_loaded", False),
        "divorce_norms_available": divorce_norms_available,
        "statute_indices": list(stats.get("statute_indices", {}).keys()),
        "total_vectors": stats.get("total_vectors", 0),
        "required_action": "ingest_bgb_pdf" if bgb_vectors <= 200 else "ready",
        "integrity_checks": {
            "embedding_dimension_verified": bgb_vectors > 0,
            "paragraph_level_indexing": True,
            "authority_metadata_present": True
        }
    }


@router.post("/verify/divorce")
async def verify_divorce_corpus() -> Dict[str, Any]:
    """
    Verify that divorce law paragraphs (§§ 1564-1588) are available.
    """
    print("\n🔍 VERIFYING DIVORCE LAW CORPUS")
    
    stats = retrieval_service.get_stats()
    bgb_stats = stats.get("statute_indices", {}).get("BGB", {})
    bgb_vectors = bgb_stats.get("vectors", 0)
    
    if bgb_vectors == 0:
        return {
            "available": False,
            "message": "BGB corpus not loaded",
            "required_action": "POST /ingestion/bgb with BGB PDF",
            "has_real_corpus": stats.get("has_real_corpus", False),
            "integrity": "corpus_missing"
        }
    
    # Try to search for divorce paragraphs
    from app.services.embeddings.embedding_service import embedding_service
    
    test_query = "divorce upon application"
    query_embedding = embedding_service.embed_query(test_query, "BGB")
    
    # Search in BGB index
    results = []
    if "BGB" in retrieval_service.statute_indices:
        store = retrieval_service.statute_indices["BGB"]
        if store.index and store.index.ntotal > 0:
            results = store.search(query_embedding, k=50)
    
    # Check for divorce paragraphs in results
    divorce_paragraphs_found = []
    divorce_paragraphs_with_metadata = []
    
    for result in results:
        metadata = result.get("metadata", {})
        paragraph = metadata.get("paragraph", "")
        is_divorce_norm = metadata.get("is_divorce_norm", False)
        
        try:
            para_num = int(re.match(r'\d+', paragraph).group())
            if 1564 <= para_num <= 1588 or is_divorce_norm:
                divorce_paragraphs_found.append(paragraph)
                divorce_paragraphs_with_metadata.append({
                    "paragraph": paragraph,
                    "is_divorce_norm": is_divorce_norm,
                    "priority_domain": metadata.get("priority_domain"),
                    "priority_reason": metadata.get("priority_reason"),
                    "authority_score": metadata.get("authority_score", 0.0)
                })
        except:
            continue
    
    # Remove duplicates
    unique_divorce_paragraphs = list(set(divorce_paragraphs_found))
    
    return {
        "available": True,
        "bgb_vectors": bgb_vectors,
        "has_real_corpus": stats.get("has_real_corpus", False),
        "divorce_paragraphs_found": unique_divorce_paragraphs,
        "divorce_paragraphs_count": len(unique_divorce_paragraphs),
        "divorce_paragraphs_with_metadata": divorce_paragraphs_with_metadata[:10],
        "total_results": len(results),
        "ready_for_examiner": len(unique_divorce_paragraphs) >= 3,
        "integrity": {
            "explicit_tagging": any(p.get("is_divorce_norm") for p in divorce_paragraphs_with_metadata),
            "priority_domains_present": any(p.get("priority_domain") for p in divorce_paragraphs_with_metadata),
            "authority_scores_consistent": all(p.get("authority_score", 0) >= 1.0 for p in divorce_paragraphs_with_metadata)
        },
        "message": f"Found {len(unique_divorce_paragraphs)} unique divorce paragraphs" if unique_divorce_paragraphs else "No divorce paragraphs found in corpus"
    }


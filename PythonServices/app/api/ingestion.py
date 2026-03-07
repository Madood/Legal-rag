"""
BGB PDF INGESTION ENDPOINT - SINGLE PURPOSE
Extract German Civil Code paragraphs (§§) and index them as authoritative norms.
No analysis, no chunking, no fallbacks.
"""
from fastapi import APIRouter, HTTPException, UploadFile, File
import tempfile
import os
import re
import json
from datetime import datetime, timezone
from typing import Dict, Any, List, Tuple
import logging
import numpy as np

from app.services.embeddings.embedding_service import embedding_service
from app.services.retrieval.retrieval_service import retrieval_service

router = APIRouter(prefix="/ingestion", tags=["ingestion"])
logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Ingestion metadata (paragraph counts + timestamps, persisted to disk)
# ---------------------------------------------------------------------------
_INDICES_DIR = os.environ.get("INDICES_DIR", "./data/indices")
_META_FILE = os.path.join(_INDICES_DIR, "ingestion_meta.json")


def _load_ingestion_meta() -> Dict[str, Any]:
    """Load per-statute ingestion metadata from disk."""
    try:
        if os.path.exists(_META_FILE):
            with open(_META_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
    except Exception as exc:
        logger.warning(f"Could not read ingestion_meta.json: {exc}")
    return {}


def _save_ingestion_meta(statute: str, paragraphs: int) -> None:
    """Persist ingestion timestamp and paragraph count for *statute*."""
    try:
        meta = _load_ingestion_meta()
        meta[statute] = {
            "ingested_at": datetime.now(timezone.utc).isoformat(),
            "paragraphs": paragraphs,
        }
        os.makedirs(_INDICES_DIR, exist_ok=True)
        with open(_META_FILE, "w", encoding="utf-8") as f:
            json.dump(meta, f, indent=2)
    except Exception as exc:
        logger.warning(f"Could not save ingestion_meta.json: {exc}")


# ---------------------------------------------------------------------------
# Content-cleaning helpers (applied during ingestion, not at query time)
# ---------------------------------------------------------------------------
_PAGE_MARKER_RE = re.compile(r'\[Page \d+\]', re.IGNORECASE)
_BOILERPLATE_RE = re.compile(
    r'(Ein Service des Bundesministerium|Service provided by the Federal Ministry'
    r'|Seite\s+\d+\s+von\s+\d+|gesetze-im-internet\.de|Bundesministerium.*Justiz'
    r'|Zurück zum Inhaltsverzeichnis|PDF generated on)',
    re.IGNORECASE,
)
_AMENDMENT_RE = re.compile(
    r'(\(\+\+\+'                                           # (+++ lines
    r'|G v\.\s+\d{1,2}\.\d{1,2}\.\d{4}\s+I\s+\d'         # G v. DD.MM.YYYY I NNN
    r'|mWv\s+\d{1,2}\.\d{1,2}\.\d{4}'                     # mWv DD.MM.YYYY
    r'|gem\.\s+Art\.\s+\d'                                 # gem. Art. NNN
    r'|idF\s+d\.\s+(?:Art\.|G\s+v\.)'                     # idF d. Art. / idF d. G v.
    r')',
    re.IGNORECASE,
)
_TOC_RE = re.compile(
    r'(^Inhaltsverzeichnis$|^Quellen$|^Literatur$|^\s*\.{4,})',
    re.IGNORECASE | re.MULTILINE,
)


def _is_noise_line(line: str) -> bool:
    """Return True if *line* should be excluded from any paragraph chunk."""
    if _PAGE_MARKER_RE.search(line):
        return True
    if _BOILERPLATE_RE.search(line):
        return True
    if _AMENDMENT_RE.search(line):
        return True
    if _TOC_RE.search(line):
        return True
    return False


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
            # Strip noise from the header line itself before seeding content
            current_content = [] if _is_noise_line(line) else [line]

            # Check if this is a divorce paragraph
            try:
                para_num_int = int(re.match(r'\d+', para_number).group())
                if 1564 <= para_num_int <= 1588:
                    # ✅ FIX 2: Explicit priority tagging for divorce norms
                    pass  # Will be tagged in _create_paragraph_document
            except:
                pass

        elif current_paragraph:
            # Continue current paragraph — skip noise lines
            if not _is_noise_line(line):
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
    
    # Normalise paragraph base (strips "Abs.", sub-letters, § symbol)
    import re as _re
    _para_base = _re.match(r'(\d+)', paragraph_number)
    para_base = _para_base.group(1) if _para_base else paragraph_number

    return {
        "id": f"BGB_{paragraph_number}",
        "content": content,
        "statute": "BGB",
        "paragraph": paragraph_number,
        "paragraph_base": para_base,         # FIX 4: required for exact matching
        "is_normative": True,
        "is_real_legal_content": True,       # FIX 4: required for relevance checks
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
        _save_ingestion_meta("BGB", len(paragraphs))

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


SUPPORTED_STATUTES = {
    "BGB", "STGB", "HGB", "GG", "EU-GDPR",
    # Extended set
    "ZPO", "STPO", "GMBHG", "AKTG", "INSO", "ARBGG",
}

# Minimum paragraph count per statute
STATUTE_MIN_PARAGRAPHS = {
    "BGB":    200,
    "STGB":    50,
    "HGB":     50,
    "GG":      20,
    "EU-GDPR":  5,
    "ZPO":     50,
    "STPO":    30,
    "GMBHG":   15,
    "AKTG":    30,
    "INSO":    20,
    "ARBGG":   15,
}


def _create_statute_document(statute: str, paragraph_number: str,
                             content: str, line_number: int) -> Dict[str, Any]:
    """Create a structured paragraph document for any statute."""
    canon = statute.upper()
    return {
        "id": f"{canon}_{paragraph_number}",
        "content": content,
        "statute": canon,
        "paragraph": paragraph_number,
        "paragraph_base": paragraph_number,
        "is_normative": True,
        "is_real_legal_content": True,
        "document_type": "statutory",
        "authority_score": 1.0,
        "norm_type": "criminal_norm" if canon == "STGB" else "civil_norm",
        "authority_level": "statutory",
        "filename": f"{canon}.pdf",
        "line_number": line_number,
        "word_count": len(content.split()),
    }


def _extract_statute_paragraphs(text: str, statute: str) -> Tuple[List[Dict[str, Any]], List[str]]:
    """
    Extract §-based paragraphs from any German statute text.
    Works for BGB, StGB, HGB, GG, EU-GDPR (Articles use 'Art.' pattern for GG).
    """
    canon = statute.upper()
    paragraphs: List[Dict[str, Any]] = []
    warnings: List[str] = []
    lines = text.split('\n')
    current_para: str | None = None
    current_content: list = []
    count = 0

    # GG uses "Art." or "Artikel"; all others use "§"
    if canon == "GG":
        para_re = re.compile(r'^Art(?:ikel)?\.?\s*(\d+[a-z]?)\b', re.IGNORECASE)
    else:
        para_re = re.compile(r'^§\s*(\d+[a-z]?)(?:\s+Abs?\.?\s*\d+)?')

    for i, line in enumerate(lines):
        line = line.strip()
        if not line:
            continue
        m = para_re.search(line)
        if m:
            if current_para and current_content:
                paragraphs.append(_create_statute_document(
                    statute=canon,
                    paragraph_number=current_para,
                    content=' '.join(current_content),
                    line_number=i,
                ))
                count += 1
            current_para = m.group(1)
            # Strip noise from the header line itself before seeding content
            current_content = [] if _is_noise_line(line) else [line]
        elif current_para:
            # Skip page markers, boilerplate, and amendment metadata lines
            if not _is_noise_line(line):
                current_content.append(line)

    # Flush last paragraph
    if current_para and current_content:
        paragraphs.append(_create_statute_document(
            statute=canon,
            paragraph_number=current_para,
            content=' '.join(current_content),
            line_number=len(lines),
        ))
        count += 1

    min_expected = STATUTE_MIN_PARAGRAPHS.get(canon, 10)
    if count < min_expected:
        warnings.append(
            f"Low paragraph count ({count}) for {canon}. "
            f"Expected at least {min_expected}. Check PDF extraction quality."
        )

    return paragraphs, warnings


@router.post("/{statute}")
async def ingest_statute_pdf(
    statute: str,
    file: UploadFile = File(...),
    force_reingest: bool = False,
) -> Dict[str, Any]:
    """
    Generic statute ingestion: uploads a PDF and indexes every § (or Art.) as an
    authoritative norm document in FAISS.

    Works for: BGB, STGB, HGB, GG, EU-GDPR.
    Saves a per-statute index to disk (e.g. stgb_index.faiss) so it is
    auto-loaded on the next startup.

    Usage:
        curl -X POST "http://localhost:8000/api/ingestion/STGB" \\
             -F "file=@/path/to/stgb.pdf"
    """
    canon = statute.upper()
    if canon not in SUPPORTED_STATUTES:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported statute '{canon}'. Supported: {sorted(SUPPORTED_STATUTES)}"
        )

    print(f"\n🚀 STARTING INGESTION: {canon} ({file.filename})")
    print("=" * 60)

    # Check existing vector count
    stats_before = retrieval_service.get_stats()
    vectors_before = stats_before.get("statute_indices", {}).get(canon, {}).get("vectors", 0)

    if vectors_before > STATUTE_MIN_PARAGRAPHS.get(canon, 10) and not force_reingest:
        return {
            "status": "skipped",
            "statute": canon,
            "message": f"{canon} already has {vectors_before} vectors. Use force_reingest=true to re-ingest.",
            "existing_vectors": vectors_before,
        }

    # Save upload to temp file
    with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp:
        tmp.write(await file.read())
        tmp_path = tmp.name

    try:
        # Step 1: Extract raw text
        print(f"📄 Extracting text from {file.filename}...")
        raw_text = _extract_pdf_text(tmp_path)
        if not raw_text or len(raw_text) < 500:
            raise HTTPException(status_code=400, detail="PDF contains too little extractable text.")
        print(f"   Extracted {len(raw_text):,} characters")

        # Step 2: Extract paragraphs
        print(f"📖 Extracting {canon} paragraphs...")
        paragraphs, warnings = _extract_statute_paragraphs(raw_text, canon)
        for w in warnings:
            print(f"   ⚠️  {w}")

        if not paragraphs:
            raise HTTPException(
                status_code=400,
                detail=f"No paragraphs found in {canon} PDF. Ensure it contains § symbols."
            )
        print(f"   Found {len(paragraphs)} paragraphs")

        # Step 3: Generate embeddings
        print("🔧 Generating embeddings...")
        texts = [p["content"] for p in paragraphs]
        embeddings_list = embedding_service.embed_batch(texts)
        embeddings_np = np.asarray(embeddings_list, dtype="float32")
        print(f"   Shape: {embeddings_np.shape}")

        # Validate dimension
        expected_dim = embedding_service.model.get_sentence_embedding_dimension()
        if embeddings_np.size > 0 and embeddings_np.shape[1] != expected_dim:
            raise HTTPException(
                status_code=500,
                detail=f"Embedding dimension mismatch: {embeddings_np.shape[1]} != {expected_dim}"
            )

        # Step 4: Index documents
        print(f"📝 Indexing as authoritative {canon} norms...")
        retrieval_service.index_documents(
            documents=paragraphs,
            statute=canon,
            embeddings=embeddings_np,
        )

        # Step 5: Save statute-specific index to disk
        print("💾 Saving index to disk...")
        save_success = retrieval_service.save_statute_indices(canon)
        retrieval_service.indices_loaded = True
        _save_ingestion_meta(canon, len(paragraphs))

        # Step 6: Verify
        stats_after = retrieval_service.get_stats()
        vectors_after = stats_after.get("statute_indices", {}).get(canon, {}).get("vectors", 0)

        print("=" * 60)
        print(f"🎉 {canon} INGESTION COMPLETE")
        print(f"   Before: {vectors_before} vectors  →  After: {vectors_after} vectors")
        print(f"   Saved to disk: {save_success}")

        return {
            "status": "success",
            "statute": canon,
            "filename": file.filename,
            "paragraphs_extracted": len(paragraphs),
            "vectors_before": vectors_before,
            "vectors_after": vectors_after,
            "vectors_added": vectors_after - vectors_before,
            "saved_to_disk": save_success,
            "sample_paragraphs": [p["paragraph"] for p in paragraphs[:10]],
            "extraction_warnings": warnings,
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"{canon} ingestion failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"{canon} ingestion failed: {str(e)}")
    finally:
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
    Returns per-statute vector counts, paragraph counts, and ingestion timestamps.
    """
    stats = retrieval_service.get_stats()
    meta = _load_ingestion_meta()

    # Build enriched statute_indices dict (vectors + paragraphs + ingested_at)
    raw_indices: Dict[str, Any] = stats.get("statute_indices", {})
    enriched: Dict[str, Any] = {}
    for statute, info in raw_indices.items():
        vectors = info.get("vectors", 0)
        # Metadata may be keyed by the exact case stored at ingestion time
        statute_meta = meta.get(statute) or meta.get(statute.upper()) or {}
        enriched[statute] = {
            "vectors": vectors,
            "paragraphs": statute_meta.get("paragraphs", vectors),
            "ingested_at": statute_meta.get("ingested_at"),
        }

    return {
        "indices_loaded": stats.get("indices_loaded", False),
        "has_real_corpus": stats.get("has_real_corpus", False),
        "statute_indices": enriched,
        "total_vectors": stats.get("total_vectors", 0),
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


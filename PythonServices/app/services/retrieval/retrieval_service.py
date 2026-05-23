import numpy as np
import os
from typing import List, Dict, Any, Optional, Tuple
import logging
from .authority_enforcement import AuthorityEnforcement
from .paragraph_identity import ParagraphExtractor, ParagraphNormalizer
from .doctrine_guard import DoctrineGuard, DOCTRINAL_QUESTION_TYPES, SETTLED_DOCTRINES, DOCTRINE_LOOKUP
from .statute_index_manager import StatuteFirstValidator, STATUTE_CHAINS
from app.services.retrieval.vector_store import FAISSStore
from .document_store import DocumentStore
import json
import glob

# Import embedding service and constants
from app.services.embeddings.embedding_service import embedding_service
from app.services.constants import get_domain_from_statute, JURISDICTION, get_store_name
from app.services.authority.registry.authority_resolver import resolve_authority as _real_resolve_authority

logger = logging.getLogger(__name__)

# ── Startup loading policy ─────────────────────────────────────────────────
# EAGER: loaded at startup — core German statutes, queried on every request
EAGER_STATUTES: frozenset = frozenset([
    "BGB", "STGB", "HGB", "GG", "ZPO", "STPO", "GMBHG",
])

# LAZY: deferred until first query for that statute
# Avoids allocating ~200-400 MB per index for rarely-queried corpora at boot.
LAZY_STATUTES: frozenset = frozenset([
    "EU-GDPR", "INSO", "AKTG", "AGG", "AO", "AMG", "AENTG",
    "ASYLG", "AUFENTHG", "ANTIDOPG", "ARBSTAETTV", "ABGG",
    "ADVERIMG", "EGAKTG", "NKRG",
])


class RetrievalService:
    """Thin orchestrator for authority-contracted retrieval"""

    def __init__(self, vector_store_type: str = "faiss", document_store_path: str = "data/document_store.json"):
        self.vector_store_type = vector_store_type
        self.vector_store = FAISSStore("default")
        self.document_store = DocumentStore(document_store_path)
        self.statute_indices = {}
        self.validator = StatuteFirstValidator()
        self.statute_chains = STATUTE_CHAINS
        self.paragraph_extractor = ParagraphExtractor()

        self.authority_resolver = None
        self.source_authority_resolver = None
        self.authority_available = False
        self.doctrine_enforcement_enabled = False
        self.doctrine_inductor = None
        self.indices_loaded = False
        self.has_real_corpus = False  # Track if we have actual vector data

        logger.info(f"RetrievalService initialized with {vector_store_type}")
        
        # Check for legacy lowercase indices and warn
        self._check_for_legacy_indices()
        
        self._try_load_existing_statute_indices()
        
        # Load documents on initialization
        if os.path.exists(document_store_path):
            self.document_store.load()

    def _check_for_legacy_indices(self):
        """Check for legacy lowercase index files and warn"""
        base_path = "data/faiss_indices/"
        if os.path.exists(base_path):
            legacy_files = glob.glob(os.path.join(base_path, "*.faiss"))
            for file_path in legacy_files:
                filename = os.path.basename(file_path)
                if filename[0].islower() and not filename.startswith("STGB") and not filename.startswith("BGB"):
                    logger.warning(f"Legacy lowercase index found: {filename}. Re-ingestion recommended for proper statute key normalization.")

    # ======================================================================
    # 🔧 COMPATIBILITY METHOD — REQUIRED BY API LAYER
    # ======================================================================

    def resolve_authority_and_retrieve(
        self,
        query: str,
        question_type: str = "GENERAL",
        available_documents: Optional[List[Dict]] = None,
    ) -> Dict[str, Any]:
        """
        Compatibility wrapper expected by /api/query/search/authoritative

        - Preserves authority-first epistemics
        - Does NOT introduce fallback
        - Delegates to existing authoritative pipeline
        """

        print("\n⚖️ resolve_authority_and_retrieve() invoked")
        print(f"   Query: {query}")

        result = self.search_authoritative(
            query=query,
            question_type=question_type
        )

        return {
            "results": result.get("retrieval_results", {}).get("documents", []),
            "authority_metadata": result.get("authority_result"),
            "requires_clarification": result.get("authority_result", {}).get(
                "requiresClarification", False
            ),
            "clarification": result.get("authority_result", {}).get("clarification"),
        }

    # ======================================================================
    # 🔧 DIRECT AUTHORITY RESOLUTION METHODS (NO API DEPENDENCIES)
    # ======================================================================

    def _resolve_authority_directly(self, query: str, question_type: str = "GENERAL") -> Dict[str, Any]:
        """
        Direct authority resolution - delegates to the real authority_resolver.py
        Always returns statute codes in UPPERCASE for consistent index lookup.
        """
        print(f"\n🔍 [Direct Authority] Delegating to real resolver: '{query}'")
        print(f"   Question Type: {question_type}")
        
        # Delegate to the real authority resolver
        return _real_resolve_authority(query)

    def enforce_authority_final_constraint(self, authority_result: Dict, retrieval_results: Dict) -> Dict:
        """
        Enforce authority_final contract - NO FALLBACKS ALLOWED
        """
        if not authority_result.get("authority_final"):
            return retrieval_results

        # Authority is final - enforce strict rules
        statute = authority_result.get("statute")
        paragraph = authority_result.get("paragraph")
        constraint = authority_result.get("retrieval", {}).get("constraint")

        print(f"🔒 AUTHORITY-FINAL ENFORCEMENT: {statute} §{paragraph} ({constraint})")
        print("   ⛔ NO fallback retrieval allowed")
        print("   ⛔ NO doctrine overview allowed")
        print("   ⛔ NO TF-IDF fallback allowed")

        # Mark retrieval results as authority_final
        retrieval_results["authority_final"] = True
        retrieval_results["strict_enforcement"] = True

        # Add metadata about enforcement
        retrieval_results["authority_metadata"] = {
            "statute_locked": authority_result.get("isStatuteLocked"),
            "paragraph_locked": authority_result.get("isParagraphLocked"),
            "constraint": constraint,
            "fallback_allowed": False,
            "overview_allowed": False,
            "doctrine_allowed": False,
            "tfidf_allowed": False
        }

        # If no documents found, mark as missing corpus
        if not retrieval_results.get("documents") or len(retrieval_results["documents"]) == 0:
            retrieval_results["authority_final_corpus_missing"] = True
            retrieval_results["requires_ingestion"] = True

        return retrieval_results

    def handle_authority_final_failure(self, authority_result: Dict) -> Dict:
        """
        Handle authority_final cases where no chunks are found
        """
        statute = authority_result.get("statute")
        paragraph = authority_result.get("paragraph")
        constraint = authority_result.get("retrieval", {}).get("constraint")

        print(f"🚨 AUTHORITY-FINAL FAILURE: {statute} §{paragraph} not found in corpus")
        print("   ℹ️  No fallback allowed - returning empty with ingestion required")

        return {
            "documents": [],
            "total_documents": 0,
            "authority_final": True,
            "authority_final_enforced": True,
            "authority_final_corpus_missing": True,
            "requires_ingestion": True,
            "statute": statute,
            "paragraph": paragraph,
            "retrieval_constraint": constraint,
            "no_fallback": True,
            "no_overview": True,
            "no_doctrine": True,
            "no_tfidf": True,
            "strict_enforcement": True
        }

    # ======================================================================
    # INDEX MANAGEMENT METHODS
    # ======================================================================

    def load_statute_indices(self, statute: str) -> bool:
        """Load statute-specific FAISS index from disk using consistent naming"""
        # Use uppercase for consistent key storage
        statute_upper = statute.upper()
        
        # Use get_store_name from constants for consistent naming
        index_name = get_store_name(statute_upper)

        # Create new vector store
        store = FAISSStore(index_name)

        # Try to load — no path arg: FAISSStore uses index_path/collection_name automatically
        if not store.load():
            logger.info(f"No existing index found for statute {statute_upper}")
            return False

        # Store in statute indices with uppercase key
        self.statute_indices[statute_upper] = store
        
        # Check if we have real vectors
        vector_count = store.index.ntotal if store.index else 0
        if vector_count > 0:
            self.has_real_corpus = True
            
        self.indices_loaded = True

        print(f"✅ Loaded statute index for {statute_upper} with {vector_count} vectors")
        return True

    def save_statute_indices(self, statute: str) -> bool:
        """Persist statute-specific FAISS index to disk using consistent naming"""
        statute_upper = statute.upper()
        
        if statute_upper not in self.statute_indices:
            logger.warning(f"No statute index found for {statute_upper}")
            return False

        store = self.statute_indices[statute_upper]

        if not store.index or store.index.ntotal == 0:
            logger.warning(f"No vectors to save for statute {statute_upper}")
            return False

        # Use get_store_name from constants for consistent naming
        index_name = get_store_name(statute_upper)
            
        success = store.save(index_name)

        if success:
            print(f"💾 Saved statute index for {statute_upper} as {index_name}.faiss")
            self.save_indices("legal_index")
        else:
            print(f"⚠️ Could not save statute index for {statute_upper}")

        return success

    def get_stats(self) -> Dict[str, Any]:
        """Get retrieval service statistics"""
        if not self.indices_loaded:
            self.ensure_indices_loaded()

        real_vectors = 0
        statute_indices = {}

        # Check general index
        general_vectors = self.vector_store.index.ntotal if self.vector_store.index else 0
        real_vectors += general_vectors

        # Check statute indices
        for statute, store in self.statute_indices.items():
            count = store.index.ntotal if store.index else 0
            statute_indices[statute] = {
                "vectors": count,
                "dimension": store.dimension
            }
            real_vectors += count

        # Get document store stats
        doc_stats = self.document_store.get_stats()
        
        # Use vector_count > 0 instead of paragraph_count
        has_real_corpus = real_vectors > 20 or doc_stats["total_documents"] > 0

        return {
            "indices_loaded": self.indices_loaded,
            "has_real_corpus": has_real_corpus,
            "statute_indices": statute_indices,
            "general_index": {
                "vectors": general_vectors,
                "dimension": self.vector_store.dimension if self.vector_store.index else 0
            },
            "document_store": doc_stats,
            "total_vectors": real_vectors,
            "corpus_state": "READY" if has_real_corpus else "EMPTY"
        }

    def save_indices(self, base_name: str = "legal_index") -> bool:
        """Save all indices to disk"""
        # Save general index
        general_success = self.vector_store.save(base_name) if self.vector_store.index and self.vector_store.index.ntotal > 0 else False

        # Save statute indices
        statute_success = False
        for statute, index in self.statute_indices.items():
            if index.index and index.index.ntotal > 0:
                success = self.save_statute_indices(statute)
                if success:
                    statute_success = True

        success = general_success or statute_success

        if success:
            print(f"💾 Saved indices to disk")
        else:
            print(f"⚠️ Could not save indices to disk")

        return success

    # ======================================================================
    # CORE RETRIEVAL METHODS
    # ======================================================================

    def _try_load_existing_statute_indices(self):
        """Load EAGER statutes at startup; LAZY statutes deferred to first query."""
        print("🔍 Loading core statute indices (eager only)...")
        print(f"   Eager: {sorted(EAGER_STATUTES)}")
        print(f"   Lazy:  {sorted(LAZY_STATUTES)} (deferred to first query)")

        loaded_any = False
        for statute in sorted(EAGER_STATUTES):
            if self.load_statute_indices(statute):
                loaded_any = True

        if loaded_any:
            self.indices_loaded = True
            print("✅ Eager statute indices loaded")
        else:
            print("ℹ️ No eager indices found on startup — ingest PDFs to populate corpus")

        return loaded_any

    def _ensure_statute_loaded(self, statute_upper: str) -> bool:
        """
        Lazily load a LAZY_STATUTES index on its first query.
        No-op if already in statute_indices (eager or previously lazy-loaded).
        Returns True if the index is now available.
        """
        if statute_upper in self.statute_indices:
            return True
        if statute_upper not in LAZY_STATUTES:
            return False  # Unknown statute — not a lazy candidate
        print(f"[LazyLoad] Loading {statute_upper} index on first request")
        success = self.load_statute_indices(statute_upper)
        if success:
            vec_count = (
                self.statute_indices[statute_upper].index.ntotal
                if self.statute_indices.get(statute_upper) and
                   self.statute_indices[statute_upper].index
                else 0
            )
            print(f"[LazyLoad] {statute_upper} ready: {vec_count} vectors")
        else:
            print(f"[LazyLoad] {statute_upper} index not found on disk — no data available")
        return success

    def _load_authority_services(self):
        """Lazily load authority services when needed"""
        if self.authority_available:
            return True

        try:
            # Use the real authority resolver
            self.authority_resolver = self._resolve_authority_directly
            self.source_authority_resolver = self._resolve_authority_directly
            
            self.authority_available = True
            print("✅ Authority resolver loaded (DELEGATES TO REAL RESOLVER)")
            return True
        except Exception as e:
            print(f"⚠️ Authority services not available: {e}")
            self.authority_available = False
            return False

    def _determine_final_question_type(self, authority_result: Dict,
                                      query: str, explicit_question_type: str = "GENERAL") -> str:
        """Single source of truth for question type determination"""
        if explicit_question_type != "GENERAL":
            return explicit_question_type

        authority_question_type = authority_result.get("question_type")
        if authority_question_type and authority_question_type != "GENERAL":
            return authority_question_type

        is_doctrinal, _ = self._is_doctrinal_question("GENERAL", query)
        if is_doctrinal:
            return "DOCTRINE"

        if self._mentions_specific_paragraph(query):
            return "LEGAL_ANALYSIS"

        return "GENERAL"

    def _is_doctrinal_question(self, question_type: str, query: str = "") -> Tuple[bool, Optional[Dict]]:
        """Determine if this is a doctrinal question that should block retrieval"""
        if self._mentions_specific_paragraph(query):
            return False, None

        if question_type in DOCTRINAL_QUESTION_TYPES:
            query_lower = query.lower()
            for doctrine_term in SETTLED_DOCTRINES:
                if doctrine_term in query_lower:
                    return True, DOCTRINE_LOOKUP.get(doctrine_term)
            return True, None

        doctrinal_keywords = {"prinzip", "grundsatz", "doctrine", "lehre"}
        if any(keyword in query.lower() for keyword in doctrinal_keywords):
            query_lower = query.lower()
            for doctrine_term in SETTLED_DOCTRINES:
                if doctrine_term in query_lower:
                    return True, DOCTRINE_LOOKUP.get(doctrine_term)
            return True, None

        return False, None

    def _mentions_specific_paragraph(self, query: str) -> bool:
        """Check if query mentions specific legal paragraphs"""
        paragraphs = self.paragraph_extractor.extract_all_paragraphs(query)
        return len(paragraphs) > 0

    def ensure_indices_loaded(self, force_reload: bool = False) -> bool:
        """Ensure indices are loaded before any search"""
        if self.indices_loaded and not force_reload:
            return True

        print("\n🔍 Ensuring indices are loaded...")

        if self.statute_indices and self._check_indices_populated():
            self.indices_loaded = True
            return True

        print("   Attempting to load indices from disk...")
        self._try_load_existing_statute_indices()
        
        if self.indices_loaded and self._check_indices_populated():
            return True

        print("""
        ⚠️ NO REAL LEGAL CORPUS FOUND
        =============================
        The system cannot answer legal questions because:
        1. No legal corpus has been ingested
        2. No vector indices exist on disk
        3. The norms layer requires REAL legal text
        """)

        self.indices_loaded = False
        return False

    def _check_indices_populated(self) -> bool:
        """Check if indices contain real data"""
        stats = self.get_stats()
        bgb_count = stats["statute_indices"].get("BGB", {}).get("vectors", 0)
        stgb_count = stats["statute_indices"].get("STGB", {}).get("vectors", 0)

        if bgb_count > 10 or stgb_count > 10:
            return True

        total_vectors = stats["general_index"]["vectors"] + sum(
            idx["vectors"] for idx in stats["statute_indices"].values()
        )

        return total_vectors > 20

    @staticmethod
    def _extract_gg_article_refs(query: str) -> List[str]:
        """
        Extract explicit Art. N article numbers from a GG query.

        Uses strict word-boundary regex to avoid substring false-matches
        (e.g. Art.13 must not match when only Art.1 was requested).
        Returns lowercase deduplicated list, e.g. ['79', '20', '1'].
        """
        import re
        matches = re.findall(r'\bArt\.?\s*(\d+[a-z]?)\b', query, re.IGNORECASE)
        # Deduplicate while preserving order
        seen: set = set()
        result = []
        for m in matches:
            key = m.lower()
            if key not in seen:
                seen.add(key)
                result.append(key)
        return result

    def _search_in_statute_index(
        self,
        query: str,
        statute: str,
        paragraph: Optional[str] = None,
        k: int = 10
    ) -> Dict[str, Any]:
        """
        Query the FAISS vector index for a statute.

        This is what search() SHOULD be calling.
        Previously, search() called _get_documents_for_statute() which reads
        the JSON DocumentStore — which ingestion never writes to.
        This method reads the FAISSStore that ingestion DOES write to.
        """
        statute_upper = statute.upper() if statute else statute

        # ── Lazy load: trigger deferred index load on first query ────────────
        if statute_upper not in self.statute_indices:
            self._ensure_statute_loaded(statute_upper)

        # ── Diagnostic gate 1: index presence ───────────────────────────────
        print(f"[GGFilter] statute={statute_upper} "
              f"in_indices={statute_upper in self.statute_indices}")

        if statute_upper not in self.statute_indices:
            print(f"⚠️  No FAISS index for statute: {statute_upper}")
            return {"documents": [], "total_documents": 0, "query": query}

        store = self.statute_indices[statute_upper]

        # ── Diagnostic gate 2: store object attributes ───────────────────────
        has_meta  = hasattr(store, 'id_to_metadata')
        has_cont  = hasattr(store, 'id_to_content')
        meta_size = len(store.id_to_metadata) if has_meta else -1
        print(f"[GGFilter] has_id_to_metadata={has_meta} "
              f"has_id_to_content={has_cont} "
              f"meta_size={meta_size}")
        if not has_meta:
            # Surface the real attribute names so we can patch the pre-filter
            public_attrs = [a for a in dir(store) if not a.startswith('_')]
            print(f"[GGFilter] store attributes: {public_attrs}")

        if not store.index or store.index.ntotal == 0:
            print(f"⚠️  FAISS index for {statute_upper} is empty")
            return {"documents": [], "total_documents": 0, "query": query}

        # ── GG Article Pre-filter ────────────────────────────────────────────
        # For Grundgesetz queries that name explicit article numbers, bypass
        # FAISS semantic search entirely.  FAISS embeds constitutional text in
        # a shared vector space where Art. 79 (Ewigkeitsklausel) is close to
        # Art. 20 (Staatsprinzipien) and Art. 1 (Menschenwürde) — causing
        # semantic drift when the question anchors to a specific article.
        # Instead: scan id_to_metadata, return only chunks whose paragraph
        # is in the extracted article list.  Falls through to FAISS if the
        # metadata scan returns nothing (index not yet populated).
        if statute_upper == 'GG' and has_meta:
            art_refs = self._extract_gg_article_refs(query)

            # ── Diagnostic gate 3: regex extraction result ───────────────────
            print(f"[GGFilter] query_snippet='{query[:60]}' art_refs={art_refs}")

            if art_refs:
                norm_refs = [
                    ParagraphNormalizer.normalize_paragraph(r)
                    for r in art_refs
                ]
                norm_refs = [r for r in norm_refs if r]

                # ── Diagnostic gate 4: sample stored paragraph keys ──────────
                sample_paras = [
                    v.get("paragraph", "<missing>")
                    for v in list(store.id_to_metadata.values())[:5]
                ]
                print(f"[GGFilter] norm_refs={norm_refs} "
                      f"meta_sample_paragraphs={sample_paras}")

                if norm_refs:
                    # Determine which metadata key holds the article number.
                    # Ingestion stores it as "paragraph"; guard against any
                    # alternative key by probing the first entry.
                    first_meta = next(iter(store.id_to_metadata.values()), {})
                    para_key = (
                        "paragraph"       if "paragraph"        in first_meta else
                        "paragraph_raw"   if "paragraph_raw"    in first_meta else
                        "article"         if "article"          in first_meta else
                        "artikel"         if "artikel"          in first_meta else
                        None
                    )
                    print(f"[GGFilter] resolved para_key={para_key!r} "
                          f"first_meta_keys={list(first_meta.keys())[:8]}")

                    pre_filtered = []
                    for doc_id, metadata in store.id_to_metadata.items():
                        raw_para  = metadata.get(para_key, "") if para_key else ""
                        para_norm = ParagraphNormalizer.normalize_paragraph(raw_para)
                        if para_norm in norm_refs:
                            content = (
                                store.id_to_content.get(doc_id, "")
                                if has_cont else ""
                            )
                            pre_filtered.append({
                                "id":               metadata.get("legal_id", str(doc_id)),
                                "content":          content,
                                "statute":          metadata.get("statute", statute_upper),
                                "paragraph":        metadata.get("paragraph", raw_para),
                                "paragraph_raw":    metadata.get("paragraph_raw", raw_para),
                                # Scoring fields — Node.js ragService checks these to
                                # decide whether to use chunks or fall back to TF-IDF.
                                "score":            1.0,
                                "similarity":       1.0,
                                "relevance":        1.0,
                                "tfidf_score":      1.0,
                                "combined_score":   1.0,
                                "is_authoritative": True,
                                "is_normative":     metadata.get("is_normative", True),
                                "authority_score":  metadata.get("authority_score", 1.0),
                                "priority_domains": metadata.get("priority_domains", []),
                                "norm_type":        metadata.get("norm_type", "statutory_norm"),
                                "metadata":         metadata,
                            })

                    if pre_filtered:
                        print(
                            f"   🏛️  GG pre-filter: {len(pre_filtered)} chunks "
                            f"for Art[{','.join(art_refs)}] — FAISS bypassed"
                        )
                        return {
                            "documents":       pre_filtered[:k],
                            "total_documents": len(pre_filtered),
                            "query":           query,
                            "match_type":      "gg_article_prefilter",
                        }
                    # No chunks matched — fall through to FAISS
                    print(
                        f"   ⚠️  GG pre-filter found 0 chunks for Art[{','.join(art_refs)}]"
                        f" (norm_refs={norm_refs}, meta_size={meta_size}) — falling through to FAISS"
                    )
            else:
                print(f"[GGFilter] no Art. refs extracted — FAISS runs normally")
        # ── End GG pre-filter ────────────────────────────────────────────────

        # Generate query embedding
        query_embedding = embedding_service.embed_query(query, statute_upper)

        # Oversample so paragraph filtering still returns k results
        oversample = k * 4 if paragraph else k * 2
        raw_results = store.search(query_embedding, k=min(oversample, store.index.ntotal))

        # Apply paragraph filter using canonical matching.
        # Sub-chunked paragraphs are stored as e.g. "201a_1", "201a_2" — strip the
        # "_N" suffix before normalizing so they still match target "201a".
        if paragraph and raw_results:
            norm_target = ParagraphNormalizer.normalize_paragraph(paragraph)
            raw_results = [
                r for r in raw_results
                if ParagraphNormalizer.normalize_paragraph(
                    getattr(r, 'metadata', {}).get("paragraph", "").split('_')[0]
                ) == norm_target
            ]

        # Reshape to the format search() and its callers expect
        documents = []
        for r in raw_results[:k]:
            meta = getattr(r, 'metadata', {})
            _score = float(getattr(r, 'score', 0.0))
            documents.append({
                "id":               getattr(r, 'id', meta.get("document_id", "")),
                "chunk_id":         getattr(r, 'id', meta.get("legal_id", meta.get("document_id", ""))),
                "content":          meta.get("content", getattr(r, 'content', "")),
                "statute":          meta.get("statute", statute_upper),
                "paragraph":        meta.get("paragraph", ""),
                "paragraph_raw":    meta.get("paragraph_raw", ""),
                "score":            _score,
                "similarity":       _score,  # same value — IP cosine similarity (0-1, higher=better)
                "is_authoritative": True,
                "is_normative":     meta.get("is_normative", True),
                "authority_score":  meta.get("authority_score", 1.0),
                "priority_domains": meta.get("priority_domains", []),
                "norm_type":        meta.get("norm_type", "statutory_norm"),
                "metadata":         meta,
            })

        print(f"   🔍 FAISS search: {len(documents)} results for '{query[:40]}...' in {statute_upper}")
        return {
            "documents":       documents,
            "total_documents": len(documents),
            "query":           query,
            "match_type":      "vector_similarity"
        }

    def index_documents(
        self,
        documents: List[Dict[str, Any]],
        statute: str,
        embeddings: np.ndarray
    ) -> None:
        """
        Bridge: ingestion pipeline → FAISS vector store.

        Accepts flat paragraph dicts from ingestion.py and writes them
        to the statute-specific FAISSStore via add_documents().
        """
        if not documents:
            logger.warning(f"index_documents: empty documents for {statute}")
            return
        if embeddings is None or embeddings.size == 0:
            logger.warning(f"index_documents: empty embeddings for {statute}")
            return
        if len(documents) != len(embeddings):
            raise ValueError(
                f"Document count ({len(documents)}) != embedding count "
                f"({len(embeddings)}) for {statute}"
            )

        statute_upper = statute.upper()
        if statute_upper not in self.statute_indices:
            self.statute_indices[statute_upper] = FAISSStore(get_store_name(statute_upper))

        store = self.statute_indices[statute_upper]

        # Build FAISS document format (same as ingestion.py _convert_to_faiss_documents)
        faiss_docs = []
        for doc in documents:
            faiss_docs.append({
                "content":  doc.get("content", ""),
                "id":       doc.get("id", ""),
                "metadata": {
                    "statute":              doc.get("statute", statute_upper),
                    "paragraph":            doc.get("paragraph", ""),
                    "paragraph_raw":        doc.get("paragraph_raw", doc.get("paragraph", "")),
                    "paragraph_canonical":  doc.get("paragraph_canonical", ""),
                    "content":              doc.get("content", ""),
                    "document_id":          doc.get("id", ""),
                    "authority_score":      doc.get("authority_score", 1.0),
                    "authority_level":      doc.get("authority_level", "statutory"),
                    "is_normative":         doc.get("is_normative", True),
                    "norm_type":            doc.get("norm_type", "statutory_norm"),
                    "priority_domains":     doc.get("priority_domains", []),
                    "has_priority_domains": doc.get("has_priority_domains", False),
                    "has_content":          doc.get("has_content", True),
                    "is_structure_only":    doc.get("is_structure_only", False),
                    "word_count":           doc.get("word_count", 0),
                    "filename":             doc.get("filename", f"{statute_upper}.pdf"),
                    # 🔧 FIX ISSUE 1: Add domain and jurisdiction to metadata
                    "domain":                get_domain_from_statute(statute_upper),
                    "jurisdiction":          JURISDICTION,
                }
            })

        store.add_documents(faiss_docs, embeddings)
        self.indices_loaded = True
        self.has_real_corpus = True

        logger.info(
            f"index_documents: {len(documents)} paragraphs → {statute_upper} "
            f"(total vectors: {store.index.ntotal})"
        )

    def search(self, query: str, question_type: str = "GENERAL",
               authority_result: Optional[Dict] = None,
               n_results: int = 10) -> Dict[str, Any]:
        """
        Main search method with authority contract enforcement
        """
        print(f"\n⚖️  AUTHORITY-CONTRACTED RETRIEVAL for: '{query}'")
        print(f"   Question Type: {question_type}")
        print(f"   Authority Final: {authority_result.get('authority_final') if authority_result else False}")

        # Check if authority_final and no fallback allowed
        if authority_result and authority_result.get("authority_final"):
            print("🔒 Authority-final detected - enforcing strict constraints")

            # Extract paragraph information
            paragraphs = self.paragraph_extractor.extract_all_paragraphs(query)
            print(f"📖 Extracted paragraphs from query: {paragraphs}")

            constraint = authority_result.get("retrieval", {}).get("constraint")
            statute = authority_result.get("statute")
            
            # Normalize statute to uppercase for consistent lookup
            if statute:
                statute = statute.upper()

            if constraint == "PARAGRAPH_STRICT":
                print(f"🔒 PARAGRAPH_STRICT mode activated - No fallbacks allowed")

                # Normalize paragraphs
                normalized_paragraphs = []
                for para in paragraphs:
                    norm = ParagraphNormalizer.normalize_paragraph(para)
                    if norm:
                        normalized_paragraphs.append(norm)

                print(f"🔒 Strict mode requires exact paragraphs: {paragraphs} (normalized: {normalized_paragraphs})")
                print(f"🔒 ENFORCING PARAGRAPH-STRICT: Statute={statute}, Paragraphs={normalized_paragraphs}")

                # PARAGRAPH_STRICT - Use FAISS vector search with paragraph filter
                paragraph_to_search = normalized_paragraphs[0] if normalized_paragraphs else None
                search_results = self._search_in_statute_index(
                    query=query,
                    statute=statute,
                    paragraph=paragraph_to_search,
                    k=n_results
                )

                print(f"   Found {len(search_results.get('documents', []))} documents matching exact paragraphs")

                # Fallback: direct metadata scan if FAISS returns nothing
                if not search_results.get("documents"):
                    print("⚠️  FAISS search returned 0 results — trying direct metadata scan")
                    if statute and statute in self.statute_indices:
                        store = self.statute_indices[statute]
                        direct_results = []
                        # Access id_to_metadata safely
                        if hasattr(store, 'id_to_metadata'):
                            for doc_id, metadata in store.id_to_metadata.items():
                                if metadata.get("paragraph") in normalized_paragraphs:
                                    content = store.id_to_content.get(doc_id, "") if hasattr(store, 'id_to_content') else ""
                                    direct_results.append({
                                        "content":        content,
                                        "metadata":       metadata,
                                        "score":          1.0,
                                        "id":             metadata.get("legal_id", str(doc_id)),
                                        "is_authoritative": True,
                                        "match_type":     "exact_metadata_scan"
                                    })
                            if direct_results:
                                search_results = {
                                    "documents":       direct_results[:n_results],
                                    "total_documents": len(direct_results),
                                    "query":           query,
                                    "match_type":      "metadata_scan"
                                }

                if not search_results.get("documents"):
                    return self.handle_authority_final_failure(authority_result)

                search_results = self.enforce_authority_final_constraint(authority_result, search_results)

                if not search_results.get("documents"):
                    return self.handle_authority_final_failure(authority_result)

                return search_results

            elif constraint == "STATUTE_ONLY":
                print(f"🔒 STATUTE_ONLY mode - Only statute {statute} allowed")

                # STATUTE_ONLY - Vector search across full statute, no paragraph filter
                search_results = self._search_in_statute_index(
                    query=query,
                    statute=statute,
                    paragraph=None,
                    k=n_results
                )

                print(f"   Found {len(search_results.get('documents', []))} documents for statute {statute}")

                if not search_results.get("documents"):
                    return self.handle_authority_final_failure(authority_result)

                search_results = self.enforce_authority_final_constraint(authority_result, search_results)

                if not search_results.get("documents"):
                    return self.handle_authority_final_failure(authority_result)

                return search_results

        # Non-authority-final but authority result may still carry a retrievalConstraint
        # set by the resolver (PARAGRAPH_STRICT / STATUTE_ONLY).  The authority_final flag
        # is never written by the resolver, so the PARAGRAPH_STRICT / STATUTE_ONLY blocks
        # above are dead code for normal queries.  Honour the resolver's constraint here
        # so §-specific queries (e.g. §13 StGB Garantenstellung) go to the right index
        # bucket instead of an unfiltered cross-statute search.
        if authority_result:
            _constraint = authority_result.get("retrievalConstraint", "NONE")
            _statute    = (authority_result.get("statute") or "").upper()
            if _constraint == "PARAGRAPH_STRICT" and _statute:
                _allowed = authority_result.get("allowedParagraphs", [])
                _para    = _allowed[0] if _allowed else authority_result.get("reference")
                print(f"[RetrievalConstraint] PARAGRAPH_STRICT → {_statute} §{_para}")
                _pr = self._search_in_statute_index(
                    query=query, statute=_statute, paragraph=_para, k=n_results
                )
                if _pr.get("documents"):
                    return _pr
                print(f"[RetrievalConstraint] PARAGRAPH_STRICT returned 0 — falling back to STATUTE_ONLY")
                _pr = self._search_in_statute_index(
                    query=query, statute=_statute, paragraph=None, k=n_results
                )
                if _pr.get("documents"):
                    return _pr
            elif _constraint == "STATUTE_ONLY" and _statute:
                print(f"[RetrievalConstraint] STATUTE_ONLY → {_statute}")
                _sr = self._search_in_statute_index(
                    query=query, statute=_statute, paragraph=None, k=n_results
                )
                if _sr.get("documents"):
                    return _sr

        # No authority provided or no index hit — cross-statute standard search
        return self._standard_search(query, n_results)

    def _filter_by_statute_and_paragraph(self, statute: str, paragraphs: List[str],
                                        exact_match: bool = True) -> List[Dict]:
        """Filter documents by statute and paragraph (legacy method, kept for compatibility)"""
        filtered = []
        
        if not statute:
            return filtered
            
        # Normalize statute to uppercase
        statute_upper = statute.upper()

        # Get all documents from statute index via FAISS metadata
        if statute_upper in self.statute_indices:
            store = self.statute_indices[statute_upper]
            if hasattr(store, 'id_to_metadata'):
                for doc_id, metadata in store.id_to_metadata.items():
                    doc_paragraphs = [metadata.get("paragraph", "")]
                    # Check for paragraph match
                    if exact_match:
                        if any(para in doc_paragraphs for para in paragraphs):
                            filtered.append({
                                "id": doc_id,
                                "metadata": metadata,
                                "content": store.id_to_content.get(doc_id, "") if hasattr(store, 'id_to_content') else ""
                            })
                    else:
                        for doc_para in doc_paragraphs:
                            for target_para in paragraphs:
                                if doc_para.startswith(target_para):
                                    filtered.append({
                                        "id": doc_id,
                                        "metadata": metadata,
                                        "content": store.id_to_content.get(doc_id, "") if hasattr(store, 'id_to_content') else ""
                                    })
                                    break

        return filtered

    def _filter_by_statute(self, statute: str) -> List[Dict]:
        """Filter documents by statute only (legacy method, kept for compatibility)"""
        if not statute:
            return []
            
        # Normalize statute to uppercase
        statute_upper = statute.upper()
        
        filtered = []
        if statute_upper in self.statute_indices:
            store = self.statute_indices[statute_upper]
            if hasattr(store, 'id_to_metadata'):
                for doc_id, metadata in store.id_to_metadata.items():
                    filtered.append({
                        "id": doc_id,
                        "metadata": metadata,
                        "content": store.id_to_content.get(doc_id, "") if hasattr(store, 'id_to_content') else ""
                    })
        
        return filtered

    def _get_documents_for_statute(self, statute: str) -> List[Dict]:
        """Get all documents for a given statute (legacy method, kept for compatibility)"""
        return self._filter_by_statute(statute)

    def _search_within_documents(self, query: str, documents: List[Dict],
                                n_results: int) -> Dict[str, Any]:
        """Search within a filtered set of documents (legacy method, kept for compatibility)"""
        if not documents:
            return {
                "documents": [],
                "total_documents": 0,
                "query": query
            }

        # Simple keyword matching for now
        query_lower = query.lower()
        relevant_chunks = []
        
        for doc in documents:
            if "metadata" in doc:
                content = doc.get("content", doc.get("metadata", {}).get("content", ""))
            else:
                content = doc.get("content", "")
                
            if content and any(word in content.lower() for word in query_lower.split()):
                relevant_chunks.append(doc)
        
        # Limit results
        relevant_chunks = relevant_chunks[:n_results]
        
        return {
            "documents": relevant_chunks,
            "total_documents": len(documents),
            "query": query
        }

    def _standard_search(self, query: str, n_results: int) -> Dict[str, Any]:
        """Standard search without authority constraints - queries all loaded FAISS indices"""
        print(f"🔍 STANDARD SEARCH across all loaded statute indices")
        
        all_results = []
        
        # Search across all loaded statute indices
        for statute, store in self.statute_indices.items():
            if store.index and store.index.ntotal > 0:
                # Search in this statute index
                statute_results = self._search_in_statute_index(
                    query=query,
                    statute=statute,
                    paragraph=None,
                    k=n_results
                )
                if statute_results.get("documents"):
                    all_results.extend(statute_results["documents"])
        
        # Sort by score and limit
        all_results.sort(key=lambda x: x.get("score", 0), reverse=True)
        all_results = all_results[:n_results]
        
        return {
            "documents": all_results,
            "total_documents": len(all_results),
            "query": query,
            "authority_final": False,
            "requires_ingestion": len(all_results) == 0
        }

    def search_authoritative(self, query: str, question_type: str = "GENERAL") -> Dict[str, Any]:
        """
        High-level authoritative search that integrates authority resolution
        """
        print(f"\n[Authoritative Search] Request received")
        print(f"  Query: {query}...")

        # Load authority services if available
        if not self._load_authority_services():
            print("⚠️  Authority services not available - falling back to standard search")
            return self.search(query, question_type)

        try:
            # Call the direct authority resolver
            authority_result = self.authority_resolver(
                query=query,
                question_type=question_type
            )
            
            if authority_result is None:
                authority_result = {}

            # ── Normalize nested authority_info ──────────────────────────────
            # Doctrine-path early returns (e.g. _stgb_result) wrap fields inside
            # {'status': ..., 'authority_info': {...}}.  Unwrap so that downstream
            # code can read statute/retrievalConstraint at the top level.
            if isinstance(authority_result, dict) and 'authority_info' in authority_result:
                authority_result = authority_result['authority_info']
                print(f"[AuthNormalize] Unwrapped authority_info nesting")

            # ── Explicit §249/§255 StGB override ─────────────────────────────
            # "Waffe"/"Gefahr" in Raub questions cause FAISS semantic drift to
            # state-security provisions (e.g. §91 StGB).  When the question
            # contains an explicit §249 or §255 reference, force PARAGRAPH_STRICT
            # so the FAISS pre-filter is applied regardless of what the doctrine
            # resolver decided.
            import re as _re
            _stgb_para_m = _re.search(r'§\s*(249|255)\b', query, _re.I)
            if _stgb_para_m:
                _locked_para = _stgb_para_m.group(1)
                authority_result['statute']             = 'STGB'
                authority_result['reference']           = _locked_para
                authority_result['allowedParagraphs']   = [_locked_para]
                authority_result['isParagraphLocked']   = True
                authority_result['retrievalConstraint'] = 'PARAGRAPH_STRICT'
                print(f"[ExplicitRef] §{_locked_para} StGB detected → forced PARAGRAPH_STRICT")

            print(f"✅ Authority resolved: {authority_result.get('statute', 'None')}")

            # Now perform retrieval with the authority result
            retrieval_results = self.search(
                query=query,
                question_type=question_type,
                authority_result=authority_result,
                n_results=3  # Top 3 only — caller uses only the best result
            )

            # Combine results
            result = {
                "authority_result": authority_result,
                "retrieval_results": retrieval_results,
                "total_documents": retrieval_results.get("total_documents", 0),
                "query": query
            }

            # Check if authority_final needs enforcement
            if authority_result.get("authority_final"):
                print(f"🔒 Authority-final enforcement applied")

                # Apply authority_final enforcement to retrieval results
                result["retrieval_results"] = self.enforce_authority_final_constraint(
                    authority_result, retrieval_results
                )

                # If no documents found, handle as authority_final failure
                if (result["retrieval_results"].get("authority_final_corpus_missing") or
                    not result["retrieval_results"].get("documents")):
                    result["retrieval_results"] = self.handle_authority_final_failure(
                        authority_result
                    )

            return result

        except Exception as e:
            print(f"❌ Authority search failed: {e}")
            logger.exception("Authority search failed")

            # Fall back to standard search
            return self.search(query, question_type)

    # ======================================================================
    # DOCUMENT MANAGEMENT METHODS
    # ======================================================================

    def add_document(self, document: Dict[str, Any]) -> bool:
        """Add a document to the document store"""
        success = self.document_store.add_document(document)
        if success:
            print(f"✅ Added document: {document.get('title', 'Untitled')}")
        return success

    def add_documents_batch(self, documents: List[Dict[str, Any]]) -> bool:
        """Add multiple documents to the document store"""
        success = self.document_store.add_documents_batch(documents)
        if success:
            print(f"✅ Added {len(documents)} documents to store")
        return success

    def get_document(self, doc_id: str) -> Optional[Dict[str, Any]]:
        """Get a document by ID"""
        return self.document_store.get_document(doc_id)

    def delete_document(self, doc_id: str) -> bool:
        """Delete a document by ID"""
        success = self.document_store.delete_document(doc_id)
        if success:
            print(f"🗑️ Deleted document: {doc_id}")
        return success

    def search_documents(self, query: str, limit: int = 10) -> List[Dict[str, Any]]:
        """Search documents by keyword"""
        return self.document_store.search(query, limit)

    # ======================================================================
    # VECTOR INDEX MANAGEMENT
    # ======================================================================

    def create_index_for_document(self, doc_id: str) -> bool:
        """Create vector index for a specific document"""
        doc = self.get_document(doc_id)
        if not doc:
            print(f"❌ Document {doc_id} not found")
            return False

        # Get all chunks from document
        chunks = doc.get("chunks", [])
        if not chunks:
            print(f"❌ Document {doc_id} has no chunks")
            return False

        # Extract text from chunks
        texts = [chunk.get("text", "") for chunk in chunks]
        if not texts:
            print(f"❌ Document {doc_id} has no text in chunks")
            return False

        # Generate real embeddings using embedding service
        embeddings = embedding_service.embed_batch(texts)

        # Determine which index to use
        statute = doc.get("statute")
        if statute:
            statute_upper = statute.upper()
            # Create statute-specific index for ANY statute, not just BGB/STGB
            if statute_upper not in self.statute_indices:
                self.statute_indices[statute_upper] = FAISSStore(get_store_name(statute_upper))

            store = self.statute_indices[statute_upper]
            store.add_vectors(embeddings, chunks)
            print(f"✅ Added {len(chunks)} chunks to {statute_upper} index")
            
            # Update has_real_corpus flag
            if store.index.ntotal > 0:
                self.has_real_corpus = True
            
            # Save the index
            self.save_statute_indices(statute_upper)
            return True
        
        # Use general index for documents without statute
        self.vector_store.add_vectors(embeddings, chunks)
        print(f"✅ Added {len(chunks)} chunks to general index")
        
        # Update has_real_corpus flag
        if self.vector_store.index.ntotal > 0:
            self.has_real_corpus = True
        
        # Save the index
        self.vector_store.save("legal_index")
        return True

    def rebuild_all_indices(self) -> bool:
        """
        Rebuild all vector indices from document store using real embeddings.
        Warning: This will delete and recreate all indices.
        """
        print("🔄 Rebuilding all vector indices from document store...")
        
        # Clear existing indices
        self.vector_store = FAISSStore("default")
        self.statute_indices = {}
        self.has_real_corpus = False
        
        # Get all documents
        all_docs = self.document_store.get_all()
        
        if not all_docs:
            print("ℹ️ No documents to index")
            return False
        
        # Group documents by statute
        statutes = {}
        for doc in all_docs:
            statute = doc.get("statute")
            if statute:
                statute_upper = statute.upper()
                if statute_upper not in statutes:
                    statutes[statute_upper] = []
                statutes[statute_upper].append(doc)
            else:
                # Documents without statute go to general index
                if "GENERAL" not in statutes:
                    statutes["GENERAL"] = []
                statutes["GENERAL"].append(doc)
        
        total_chunks = 0
        
        # Index documents by statute
        for statute, docs in statutes.items():
            if statute == "GENERAL":
                # Handle general index separately
                continue
                
            # Create statute-specific index
            store = FAISSStore(get_store_name(statute))
            statute_chunks = 0
            
            for doc in docs:
                chunks = doc.get("chunks", [])
                if chunks:
                    texts = [chunk.get("text", "") for chunk in chunks]
                    # Generate real embeddings
                    embeddings = embedding_service.embed_batch(texts)
                    store.add_vectors(embeddings, chunks)
                    statute_chunks += len(chunks)
                    total_chunks += len(chunks)
            
            if store.index and store.index.ntotal > 0:
                self.statute_indices[statute] = store
                self.has_real_corpus = True
                print(f"✅ Created {statute} index with {store.index.ntotal} chunks")
                # Save the index
                self.save_statute_indices(statute)
        
        # Handle general index
        if "GENERAL" in statutes:
            general_chunks = 0
            for doc in statutes["GENERAL"]:
                chunks = doc.get("chunks", [])
                if chunks:
                    texts = [chunk.get("text", "") for chunk in chunks]
                    embeddings = embedding_service.embed_batch(texts)
                    self.vector_store.add_vectors(embeddings, chunks)
                    general_chunks += len(chunks)
                    total_chunks += len(chunks)
            
            if self.vector_store.index and self.vector_store.index.ntotal > 0:
                self.has_real_corpus = True
                print(f"✅ Created general index with {self.vector_store.index.ntotal} chunks")
                self.vector_store.save("legal_index")
        
        self.indices_loaded = True
        print(f"✅ Rebuilt all indices with {total_chunks} total chunks using real embeddings")
        return True


# Singleton instance
retrieval_service = RetrievalService()
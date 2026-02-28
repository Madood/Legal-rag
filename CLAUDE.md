# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Architecture Overview

This is a three-tier Legal RAG (Retrieval-Augmented Generation) system for German legal documents:

```
rag-frontend (React, port 3000)
    ↓ HTTP (axios to /api)
Backend/ (Node.js/Express, port 5000)
    ↓ HTTP (axios to Python service)
PythonServices/ (FastAPI, port 8000)
```

**Node.js Backend** (`Backend/`): Owns PDF parsing, TF-IDF lexical retrieval, and orchestration. Entry point: `server.js`. All services must be imported through `services/index.js` (the central registry) — never import services directly from outside `services/`.

**Python Service** (`PythonServices/`): Owns FAISS vector search, sentence-transformer embeddings, authority classification, and document ingestion. Entry point: `main.py`. FAISS indices are persisted at `PythonServices/data/indices/` as `{STATUTE}.faiss` files (uppercase names required).

**React Frontend** (`rag-frontend/`): TypeScript + React 19 + Radix UI + Tailwind CSS + TanStack Query. All API calls go to the Node.js backend at `http://localhost:5000/api`. Frontend services live in `src/services/` and are exported through `src/services/api.ts`.

## Running the System

All three services must be running simultaneously.

**Node.js Backend:**
```bash
cd Backend
npm install
npm start         # production
npm run dev       # development with nodemon
```

**Python Service** (requires Python 3.12+):
```bash
cd PythonServices
# Activate venv (use .venv or venv3.11)
source .venv/Scripts/activate   # Windows Git Bash
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

**Frontend:**
```bash
cd rag-frontend
npm install
npm start         # dev server on port 3000
npm run build     # production build
npm test          # run tests
```

## Key Configuration

**Backend `.env`** (port 5000):
- `PYTHON_SERVICE_URL=http://localhost:8000` — Python service location
- `PYTHON_TIMEOUT=30000` — HTTP timeout for Python calls
- Legal PDFs loaded from `./documents`

**Python `.env`** (port 8000):
- `EMBEDDING_MODEL=sentence-transformers/paraphrase-multilingual-mpnet-base-v2` — 768-dimension multilingual model
- `INDICES_DIR=./data/indices` — FAISS index storage
- `VECTOR_STORE_TYPE=faiss` — options: faiss, chroma, qdrant

**Root `.env`**: `LEGAL_CORPUS_ROOT` points to the shared `documents/` directory at the repo root.

## Document Ingestion

Place German legal PDFs in `Backend/documents/`. To build FAISS indices, POST a PDF to the Python ingestion endpoint:
```
POST http://localhost:8000/api/ingestion/{statute}
```
Supported statutes: `BGB`, `STGB`, `HGB`, `GG`, `EU-GDPR` (always uppercase).

## Query Flow

1. Frontend POSTs to `POST /api/ask` on Node.js backend
2. `ChatService` detects statute context (e.g. `§ 325 BGB` pattern matching)
3. `ragService` performs TF-IDF lexical search over parsed PDFs
4. `pythonIntegrationService` calls `POST /api/query/search/authoritative` on the Python service
5. Python's 3-layer authority pipeline: `AuthoritySignals` → `compute_authority_state` → `enforce_authority_lock`
6. Results merged and returned with citations, authority rank, and safety score

## Python Service Architecture

Services under `PythonServices/app/services/`:
- `embeddings/` — `EmbeddingService` (sentence-transformers) + `FAISSStore`
- `retrieval/` — `RetrievalService` (thin orchestrator), `AuthorityEnforcement`, `DoctrineGuard`, `StatuteFirstValidator`, `ParagraphExtractor`
- `authority/registry/` — `AuthoritySignals`, `compute_authority_state`, `enforce_authority_lock`, `AuthorityState`
- `ingestion/` — paragraph chunker, format normalizer, corpus loader
- `safety/` — epistemology checks
- `constants.py` — **single source of truth** for statute↔domain mappings; all statute keys are UPPERCASE

API routers in `PythonServices/app/api/`: `query.py` (search), `ingestion.py` (PDF upload), `authority.py`, `health.py`.

## Node.js Service Registry

`Backend/services/index.js` exports four namespaces:
- `ingestion.pdfDocumentService` — PDF loading and parsing
- `retrieval.ragService` — TF-IDF search
- `retrieval.pythonIntegrationService` — HTTP bridge to Python
- `validation.safetyCheck` — legal safety validation
- `orchestration.chatService` — main query orchestrator

## Critical Constraints

- Statute keys must always be **UPPERCASE** in Python code (`BGB`, `STGB` not `stgb`)
- FAISS index files must be named with uppercase statute names (e.g. `BGB.faiss`)
- The authority resolver has an architectural lock: 3-layer vertical pipeline with no bypasses — do not add logic that skips layers
- `constants.py` in Python is the single source of truth for statute-domain mapping; both `ingestion.py` and `query.py` import from it to prevent drift
- Outside the `services/` folder in Node.js, always import via `require('./services/index')` — never import individual service files directly

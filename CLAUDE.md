# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**EPCFlow** extracts text from semi-structured documents (invoices, receipts, purchase orders) while preserving spatial layout, then uses an agentic LLM pipeline to extract financial metrics (Budget at Completion, Actual Cost, Variance, line items). It has two independent pipelines that share the same spatial-reconstruction core:

- **Local CLI tool** (`backend/invoice_extraction.py`) — batch-processes files on disk into plain-text layout and JSON files, no server/DB required.
- **Full-stack web app** — React dashboard + FastAPI backend + standalone LLM inference service + MongoDB + S3, for interactive upload/extract/review workflows.

See `ARCHITECTURE.md` for a detailed component diagram and the spatial-reconstruction math (note: it refers to a root-level `api.py`; the actual entrypoint is `backend/main.py`, which mounts routers from `backend/api/`).

## Repository Layout

- `backend/` — FastAPI server, multi-agent extraction pipeline, MongoDB/S3 integration, CLI tool (Python 3.10+)
- `llm/` — standalone FastAPI service that loads Qwen3-1.7B and serves inference for the backend's `LLMAgent`
- `frontend/` — React 18 + Vite dashboard (`epcflow-ui`)
- `data/` — sample input documents and example output JSON/txt for manual testing

## Common Commands

Run each service from its own directory; all three must be running for the full web app to work.

```bash
# LLM inference service (port 5000) — start first, backend depends on it
cd llm && pip install -r requirements.txt && python main.py

# Backend API (port 8000)
cd backend && pip install -r requirements.txt && python main.py
# or: uvicorn main:app --reload --host 0.0.0.0 --port 8000

# Frontend dev server (port 5173)
cd frontend && npm install && npm run dev
npm run build      # production build
npm run preview    # preview production build

# Local CLI batch extraction (no server/DB needed)
cd backend
python invoice_extraction.py --width 120 --tolerance 10 --confidence 0.5 --dpi 250
# Edit HARDCODED_INPUT / HARDCODED_OUTPUT constants in invoice_extraction.py to change paths
```

There is no test suite (no pytest config, no test directories) and no linter configured in either the backend or frontend.

### Backend environment (`backend/.env`)

```
MONGODB_URI=...
AWS_REGION=...
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
AWS_S3_BUCKET=...
AWS_S3_PREFIX=documents          # optional
LLM_SERVICE_URL=http://localhost:5000/infer
```

`backend/.env` currently contains real AWS/MongoDB credentials — never print its contents or commit changes to it.

## Architecture

### Backend request flow

`backend/main.py` builds the FastAPI app and mounts three routers from `backend/api/`: `documents.py`, `dashboard.py`, `review.py`. On startup (`lifespan`), `documents.init_models()` eagerly loads OCR/LLM models so the first request isn't slow.

Document upload/extraction goes through `backend/core/pipeline.py`, a four-agent pipeline coordinated by `PipelineManager`:

1. **`ScannerAgent`** — detects image vs. PDF; rasterizes PDFs page-by-page via PyMuPDF (`fitz`) at a configurable DPI (`zoom = dpi / 72`), yielding RGB frames as a generator.
2. **`OCRAgent`** — runs PaddleOCR on each frame (converts RGB→BGR first), returns tokens with bounding polygons and confidence scores.
3. **`StructurerAgent`** — calls `SpatialLayoutReconstructor` (`backend/utils/spatial_reconstructor.py`) to cluster OCR boxes into rows (by y-midpoint within `row_tolerance`) and interpolate each token's x-position into a column on a fixed-width character grid (`output_width`), producing a spatially-faithful text layout.
4. **`LLMAgent`** — loads `Qwen/Qwen3-1.7B` (CPU, `torch.bfloat16`, `torch.set_num_threads(6)`), turns the reconstructed layout into a prompt, and parses the model's JSON response into financial fields (BAC, AC, invoice metadata, line items).

The CLI tool (`invoice_extraction.py` + `backend/utils/document_processor.py` + `backend/utils/layout_config.py`) reuses the same `SpatialLayoutReconstructor` but skips the LLM step — it only produces the layout JSON/txt, not extracted financial fields. `layout_config.py` holds the tunable defaults (`output_width=120`, `row_tolerance=10`, `min_confidence=0.5`, `pdf_dpi`).

### Persistence

- **`backend/storage.py`** — S3 upload/download and presigned URL generation via boto3; reads `AWS_*` env vars, raises a clear `RuntimeError` if boto3 or `AWS_S3_BUCKET` is missing.
- **`backend/database.py`** — singleton PyMongo client from `MONGODB_URI`; CRUD helpers (`save_invoice`, `get_invoice_by_id`, `list_invoices`, `delete_invoice`) and computes variance (BAC − AC) automatically on invoice creation.
- **`backend/models/`** — Pydantic v2 schemas: `invoice.py` (`InvoiceCreate`/`InvoiceSchema`, with ObjectId↔string handling), `extracted_fields.py` (financial fields + line items), `metadata.py` (document/parsing metadata).

### Frontend

Vite + React Router app under `frontend/src/`:
- `pages/` — one component per route: `Dashboard`, `Documents`, `Review`, `Analytics`, `Alerts`, `Workflows`, `Audit`, `Forecasting`
- `components/layout/` (`Header`, `Sidebar`) and `components/common/` (small shared widgets: `Chip`, `Stat`, `HealthRing`, `GlowDot`, `PipelineFlow`)
- `context/ThemeContext.jsx` — theme state
- Talks to the backend via `VITE_API_URL` (set in `frontend/.env`), hitting the `documents`/`dashboard`/`review` routers.

### Inter-service dependency

Backend → LLM service is a plain HTTP call to `LLM_SERVICE_URL` (`llm/main.py` + `llm/llm_inference.py`), not an in-process import — the LLM service must be running independently before extraction requests will succeed.

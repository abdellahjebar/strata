"""
FastAPI application entry point.

Routes:
  POST /chat    → SSE stream (tokens + sources)
  POST /ingest  → ingest a source path or URL
  POST /upload  → ingest an uploaded file (multipart/form-data)
  GET  /sources → list all indexed sources
"""

import asyncio
import logging
import logging.config

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.api.routes.chat import router as chat_router
from backend.api.routes.ingest import router as ingest_router
from backend.api.routes.sources import router as sources_router
from backend.retriever import warmup

# ── Logging ───────────────────────────────────────────────────────────────────

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(name)-30s %(levelname)-8s %(message)s",
    datefmt="%H:%M:%S",
)

# Quieten noisy third-party loggers
logging.getLogger("httpx").setLevel(logging.WARNING)
logging.getLogger("httpcore").setLevel(logging.WARNING)
logging.getLogger("sentence_transformers").setLevel(logging.WARNING)
logging.getLogger("chromadb").setLevel(logging.WARNING)

logger = logging.getLogger(__name__)

# ── App ───────────────────────────────────────────────────────────────────────

app = FastAPI(title="Strata Knowledge API", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:80", "http://localhost"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(chat_router)
app.include_router(ingest_router)
app.include_router(sources_router)


# ── Startup ───────────────────────────────────────────────────────────────────

@app.on_event("startup")
async def startup():
    logger.info("Strata backend starting up...")
    await asyncio.to_thread(warmup)
    logger.info("Startup complete — ready to serve requests.")

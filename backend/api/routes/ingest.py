"""
Ingestion routes:
  POST /ingest  — ingest a file path or URL (JSON body)
  POST /upload  — ingest an uploaded file (multipart/form-data)
"""

import asyncio
import logging
import os
import tempfile
from pathlib import Path

from fastapi import APIRouter, File, Form, HTTPException, UploadFile

from backend.api.schemas import IngestRequest, IngestResponse, UploadResponse
from backend.ingestion.ingest import ingest

logger = logging.getLogger(__name__)

router = APIRouter()

_ALLOWED_SUFFIXES = {".pdf", ".md", ".markdown", ".txt"}


@router.post("/ingest", response_model=IngestResponse)
async def ingest_source(request: IngestRequest):
    """Ingest a source by file path or URL (JSON body)."""
    logger.info("ingest request: source=%r topic=%r", request.source, request.topic)
    try:
        result = await asyncio.to_thread(
            ingest,
            request.source,
            topic=request.topic,
            title=request.title or None,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.exception("ingest error: source=%r", request.source)
        raise HTTPException(status_code=500, detail=str(e))

    logger.info(
        "ingest complete: title=%r added=%d skipped=%d",
        result["source_title"], result["chunks_added"], result["chunks_skipped"],
    )
    return IngestResponse(status="ok", **result)


@router.post("/upload", response_model=UploadResponse)
async def upload_file(
    file: UploadFile = File(...),
    topic: str = Form(default="general"),
    title: str = Form(default=""),
):
    """
    Ingest an uploaded file (PDF, Markdown, or plain text).
    The file is saved to a temp location, ingested, then deleted.
    """
    suffix = Path(file.filename or "").suffix.lower()
    if suffix not in _ALLOWED_SUFFIXES:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type '{suffix}'. Allowed: {', '.join(sorted(_ALLOWED_SUFFIXES))}",
        )

    logger.info("upload request: filename=%r topic=%r", file.filename, topic)

    # Write to a temp file (ingest() needs a file path, not bytes)
    content = await file.read()
    tmp_path: str | None = None
    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
            tmp.write(content)
            tmp_path = tmp.name

        result = await asyncio.to_thread(
            ingest,
            tmp_path,
            topic=topic,
            title=title or None,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.exception("upload ingest error: filename=%r", file.filename)
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if tmp_path and os.path.exists(tmp_path):
            os.unlink(tmp_path)

    logger.info(
        "upload complete: title=%r added=%d skipped=%d",
        result["source_title"], result["chunks_added"], result["chunks_skipped"],
    )
    return UploadResponse(status="ok", **result)

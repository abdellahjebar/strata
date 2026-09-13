"""
Pydantic request/response models for all API routes.
Single source of truth — import from here, not from main.py.
"""

from pydantic import BaseModel, Field


# ── Shared ────────────────────────────────────────────────────────────────────

class ChatMessage(BaseModel):
    role: str    # "user" | "assistant"
    content: str


# ── /chat ─────────────────────────────────────────────────────────────────────

class ChatRequest(BaseModel):
    message: str
    history: list[ChatMessage] = []
    topic_filter: str = ""

    # Runtime model override (from settings panel)
    # Empty string = use env-var defaults
    provider: str = ""   # "groq" | "openai" | "anthropic" | ""
    model: str = ""      # model id (e.g. "gpt-4o") or "" for env default
    api_key: str = ""    # user-supplied key; "" = use env default


class SourceCitation(BaseModel):
    title: str
    chapter: str = ""
    topic: str = ""
    author: str = ""
    score: float = 0.0
    chunk_preview: str = ""


# ── /ingest ───────────────────────────────────────────────────────────────────

class IngestRequest(BaseModel):
    source: str                  # file path or URL
    topic: str = "general"
    title: str = ""


class IngestResponse(BaseModel):
    status: str
    chunks_added: int
    chunks_skipped: int
    source_title: str


# ── /upload ───────────────────────────────────────────────────────────────────

# Request is multipart/form-data — handled inline in the route, no Pydantic model needed.

class UploadResponse(BaseModel):
    status: str
    chunks_added: int
    chunks_skipped: int
    source_title: str


# ── /sources ──────────────────────────────────────────────────────────────────

class SourceInfo(BaseModel):
    title: str
    source_type: str
    topic: str
    author: str
    chunk_count: int

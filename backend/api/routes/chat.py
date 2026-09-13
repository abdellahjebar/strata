"""
/chat route — SSE streaming response.
"""

import json
import logging
from typing import AsyncGenerator

from fastapi import APIRouter
from fastapi.responses import StreamingResponse

from backend.agent import ask_streaming
from backend.api.schemas import ChatRequest
from backend.retriever import list_sources

logger = logging.getLogger(__name__)

router = APIRouter()


async def _stream_answer(request: ChatRequest) -> AsyncGenerator[str, None]:
    """
    Run the agent and stream token deltas as SSE.
    Sources are sent as a final event after the stream completes.
    """
    history = [{"role": m.role, "content": m.content} for m in request.history]
    chunks_acc: list[dict] = []

    logger.info(
        "chat request: provider=%r model=%r topic_filter=%r",
        request.provider or "env-default",
        request.model or "env-default",
        request.topic_filter or "none",
    )

    try:
        async for delta in ask_streaming(
            request.message,
            history=history or None,
            chunks_acc=chunks_acc,
            provider=request.provider,
            model=request.model,
            api_key=request.api_key,
            topic_filter=request.topic_filter,
        ):
            yield f"event: token\ndata: {json.dumps(delta)}\n\n"
    except Exception as e:
        logger.exception("chat streaming error")
        yield f"event: error\ndata: {json.dumps({'error': str(e)})}\n\n"
        return

    # Build source citations from retrieved chunks
    if chunks_acc:
        seen: dict[str, dict] = {}
        for chunk in chunks_acc:
            key = f"{chunk.get('title', '')}|{chunk.get('chapter', '')}"
            if key not in seen:
                seen[key] = {
                    "title": chunk.get("title", "Unknown"),
                    "chapter": chunk.get("chapter", ""),
                    "topic": chunk.get("topic", ""),
                    "author": chunk.get("author", ""),
                    "score": chunk.get("score", 0),
                    "chunk_preview": chunk.get("text", "")[:200],
                }
        sources = sorted(seen.values(), key=lambda x: -x["score"])
    else:
        sources = list_sources()

    yield f"event: sources\ndata: {json.dumps(sources)}\n\n"
    yield "event: done\ndata: {}\n\n"


@router.post("/chat")
async def chat(request: ChatRequest):
    return StreamingResponse(
        _stream_answer(request),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )

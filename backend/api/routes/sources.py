"""
/sources route — list all indexed sources.
"""

from fastapi import APIRouter

from backend.retriever import list_sources

router = APIRouter()


@router.get("/sources")
async def get_sources():
    """Return all unique sources indexed in the knowledge base."""
    return list_sources()

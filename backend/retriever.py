"""
Retriever — semantic search over the ChromaDB knowledge base.

Used by the agent tools to fetch relevant chunks given a query.
"""

import logging
import re

import chromadb
from sentence_transformers import SentenceTransformer, CrossEncoder

logger = logging.getLogger(__name__)

from backend.config import (
    CHROMA_PERSIST_DIR,
    CHROMA_COLLECTION_NAME,
    EMBED_MODEL_NAME,
    EMBED_TRUST_REMOTE_CODE,
    TOP_K,
    RERANK_FETCH_K,
    RERANK_MODEL_NAME,
)

# Module-level singletons — loaded once, reused across requests
_embed_model: SentenceTransformer | None = None
_rerank_model: CrossEncoder | None = None
_collection: chromadb.Collection | None = None


def _get_embed_model() -> SentenceTransformer:
    global _embed_model
    if _embed_model is None:
        _embed_model = SentenceTransformer(EMBED_MODEL_NAME, trust_remote_code=EMBED_TRUST_REMOTE_CODE)
    return _embed_model


def _get_rerank_model() -> CrossEncoder:
    global _rerank_model
    if _rerank_model is None:
        _rerank_model = CrossEncoder(RERANK_MODEL_NAME)
    return _rerank_model


def _get_collection() -> chromadb.Collection:
    global _collection
    if _collection is None:
        client = chromadb.PersistentClient(path=CHROMA_PERSIST_DIR)
        _collection = client.get_or_create_collection(
            name=CHROMA_COLLECTION_NAME,
            metadata={"hnsw:space": "cosine"},
        )
    return _collection


_BIB_HEADER = re.compile(
    r"^(references|bibliography|works cited|further reading|notes)\b",
    re.IGNORECASE,
)
_CITATION_LINE = re.compile(r"^\[?\d+\][\s.]|\bpp?\.\s*\d+|doi:|arxiv:", re.IGNORECASE)


def _looks_like_bibliography(text: str) -> bool:
    """Runtime safety net: drop chunks that are clearly bibliography/citation lists."""
    lines = [l.strip() for l in text.splitlines() if l.strip()]
    if not lines:
        return False
    if _BIB_HEADER.match(lines[0]):
        return True
    citation_lines = sum(1 for l in lines if _CITATION_LINE.match(l))
    return len(lines) > 4 and (citation_lines / len(lines)) > 0.6


def search(
    query: str,
    topic: str | None = None,
    source_title: str | None = None,
    k: int = TOP_K,
    min_per_source: int = 1,
) -> list[dict]:
    """
    Semantic search over the knowledge base.

    Args:
        query: Natural language query to embed and search.
        topic: Optional metadata filter (e.g. "databases", "architecture").
        source_title: Optional filter to a specific book/source title.
        k: Number of top chunks to return.
        min_per_source: Guarantee at least this many chunks per unique source
            title in the result set (source diversity). Set to 0 to disable.

    Returns:
        List of dicts with keys: text, score, source_type, title, author,
        chapter, topic, file_path, date_added, chunk_index.
    """
    embed_model = _get_embed_model()
    collection = _get_collection()

    query_embedding = embed_model.encode(query, normalize_embeddings=True).tolist()

    # Build metadata filter
    where = _build_where(topic, source_title)

    fetch_k = min(RERANK_FETCH_K, collection.count())
    results = collection.query(
        query_embeddings=[query_embedding],
        n_results=fetch_k,
        include=["documents", "metadatas", "distances"],
        where=where if where else None,
    )

    # Filter bibliography chunks
    candidates = []
    for doc, meta, dist in zip(
        results["documents"][0],
        results["metadatas"][0],
        results["distances"][0],
    ):
        if _looks_like_bibliography(doc):
            continue
        candidates.append({"text": doc, "meta": meta, "dist": dist})

    if not candidates:
        return []

    # Rerank with cross-encoder
    reranker = _get_rerank_model()
    pairs = [[query, c["text"]] for c in candidates]
    rerank_scores = reranker.predict(pairs)

    for i, score in enumerate(rerank_scores):
        candidates[i]["rerank_score"] = float(score)

    candidates.sort(key=lambda x: x["rerank_score"], reverse=True)

    # Source diversity: guarantee min_per_source chunks per unique title
    if min_per_source > 0:
        selected: list[dict] = []
        source_counts: dict[str, int] = {}
        reserve: list[dict] = []  # best chunk per source not yet selected

        for c in candidates:
            title = c["meta"].get("title", "")
            count = source_counts.get(title, 0)
            if count < min_per_source:
                selected.append(c)
                source_counts[title] = count + 1
            else:
                reserve.append(c)

        # Fill remaining slots from reserve (already sorted by rerank_score)
        remaining = k - len(selected)
        if remaining > 0:
            selected.extend(reserve[:remaining])

        # Re-sort final selection by score
        selected.sort(key=lambda x: x["rerank_score"], reverse=True)
        top = selected[:k]
    else:
        top = candidates[:k]

    return [
        {
            "text": c["text"],
            "score": round(c["rerank_score"], 4),
            **c["meta"],
        }
        for c in top
    ]


def list_sources() -> list[dict]:
    """
    Return all unique sources indexed in the knowledge base.
    Each entry has: title, source_type, topic, author, chunk_count.
    """
    collection = _get_collection()
    all_items = collection.get(include=["metadatas"])

    seen: dict[str, dict] = {}  # key: title
    for meta in all_items["metadatas"]:
        title = meta.get("title", "Unknown")
        if title not in seen:
            seen[title] = {
                "title": title,
                "source_type": meta.get("source_type", "unknown"),
                "topic": meta.get("topic", "general"),
                "author": meta.get("author", "Unknown"),
                "chunk_count": 0,
            }
        seen[title]["chunk_count"] += 1

    return sorted(seen.values(), key=lambda x: x["title"])


def warmup() -> None:
    """
    Pre-load models and ChromaDB collection at server startup.
    Eliminates cold-start delay on the first request.
    """
    logger.info("Loading embedding model: %s", EMBED_MODEL_NAME)
    _get_embed_model()
    logger.info("Loading reranker model: %s", RERANK_MODEL_NAME)
    _get_rerank_model()
    logger.info("Connecting to ChromaDB at: %s", CHROMA_PERSIST_DIR)
    _get_collection()
    logger.info("Warm-up complete. Collection has %d chunks.", _get_collection().count())


def _build_where(topic: str | None, source_title: str | None) -> dict | None:
    """Build a ChromaDB $and/$eq where clause from optional filters."""
    conditions = []
    if topic:
        conditions.append({"topic": {"$eq": topic}})
    if source_title:
        conditions.append({"title": {"$eq": source_title}})

    if not conditions:
        return None
    if len(conditions) == 1:
        return conditions[0]
    return {"$and": conditions}

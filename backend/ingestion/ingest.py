"""
Ingestion pipeline — add sources to the knowledge base.

CLI usage:
    python backend/ingestion/ingest.py --source books/ddia.pdf --topic databases
    python backend/ingestion/ingest.py --source https://docs.python.org/3/ --topic python
    python backend/ingestion/ingest.py --source notes/my-notes.md --topic architecture

Programmatic usage (from the API):
    from backend.ingestion.ingest import ingest
    result = ingest("path/to/file.pdf", topic="databases")
"""

import argparse
import hashlib
import logging
import os
import sys

# Allow CLI invocation from the repo root
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "../.."))

import chromadb
from sentence_transformers import SentenceTransformer

from backend.config import (
    CHROMA_PERSIST_DIR,
    CHROMA_COLLECTION_NAME,
    CHUNK_SIZE,
    CHUNK_OVERLAP,
    EMBED_MODEL_NAME,
    EMBED_TRUST_REMOTE_CODE,
)
from backend.ingestion.pdf_loader import load_pdf
from backend.ingestion.url_loader import load_url
from backend.ingestion.markdown_loader import load_markdown

logger = logging.getLogger(__name__)


def _hash_chunk(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def _detect_source_type(source: str) -> str:
    if source.startswith("http://") or source.startswith("https://"):
        return "url"
    elif source.endswith(".pdf"):
        return "pdf"
    elif source.endswith(".md") or source.endswith(".markdown") or source.endswith(".txt"):
        return "markdown"
    else:
        raise ValueError(f"Cannot detect source type for: {source!r}. Supported: .pdf, .md, .txt, http(s)://")


def ingest(source: str, topic: str = "general", title: str = None) -> dict:
    """
    Load, chunk, embed, deduplicate, and store a source into ChromaDB.

    Returns:
        {"chunks_added": int, "chunks_skipped": int, "source_title": str}
    """
    source_type = _detect_source_type(source)
    logger.info("Ingesting source_type=%s source=%r topic=%r", source_type, source, topic)

    # --- Load and chunk ---
    if source_type == "pdf":
        chunks = load_pdf(source, title=title, topic=topic, chunk_size=CHUNK_SIZE, chunk_overlap=CHUNK_OVERLAP)
    elif source_type == "url":
        chunks = load_url(source, title=title, topic=topic, chunk_size=CHUNK_SIZE, chunk_overlap=CHUNK_OVERLAP)
    else:  # markdown / txt
        chunks = load_markdown(source, title=title, topic=topic, chunk_size=CHUNK_SIZE, chunk_overlap=CHUNK_OVERLAP)

    if not chunks:
        logger.warning("No chunks extracted from source=%r", source)
        return {"chunks_added": 0, "chunks_skipped": 0, "source_title": title or source}

    source_title = chunks[0]["metadata"]["title"]
    logger.info("Extracted %d chunks from %r", len(chunks), source_title)

    # --- Connect to ChromaDB ---
    client = chromadb.PersistentClient(path=CHROMA_PERSIST_DIR)
    collection = client.get_or_create_collection(
        name=CHROMA_COLLECTION_NAME,
        metadata={"hnsw:space": "cosine"},
    )

    # --- Load embedding model ---
    logger.info("Loading embedding model: %s", EMBED_MODEL_NAME)
    embed_model = SentenceTransformer(EMBED_MODEL_NAME, trust_remote_code=EMBED_TRUST_REMOTE_CODE)

    # --- Get existing hashes for deduplication ---
    existing = collection.get(include=["metadatas"])
    existing_hashes = {
        meta["chunk_hash"]
        for meta in existing["metadatas"]
        if meta and "chunk_hash" in meta
    }

    # --- Embed and store, skipping duplicates ---
    added = 0
    skipped = 0

    for chunk in chunks:
        text = chunk["text"]
        chunk_hash = _hash_chunk(text)

        if chunk_hash in existing_hashes:
            skipped += 1
            continue

        embedding = embed_model.encode(text, normalize_embeddings=True).tolist()
        metadata = chunk["metadata"]
        metadata["chunk_hash"] = chunk_hash

        collection.add(
            ids=[chunk_hash],
            embeddings=[embedding],
            documents=[text],
            metadatas=[metadata],
        )

        existing_hashes.add(chunk_hash)
        added += 1

    logger.info("Ingest complete: added=%d skipped=%d title=%r", added, skipped, source_title)
    return {"chunks_added": added, "chunks_skipped": skipped, "source_title": source_title}


if __name__ == "__main__":
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(name)-30s %(levelname)-8s %(message)s",
        datefmt="%H:%M:%S",
    )
    parser = argparse.ArgumentParser(description="Ingest a source into the knowledge base.")
    parser.add_argument("--source", required=True, help="Path to PDF/markdown file or URL")
    parser.add_argument("--topic", default="general", help="Topic tag (e.g. databases, architecture)")
    parser.add_argument("--title", default=None, help="Override the source title")
    args = parser.parse_args()

    result = ingest(args.source, topic=args.topic, title=args.title)
    print(f"\nIngestion complete: {result}")

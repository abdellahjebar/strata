import re
from datetime import date
from typing import Optional
from urllib.parse import urlparse

import trafilatura


def _chunk_text(text: str, chunk_size: int, overlap: int) -> list[str]:
    """Same word-based chunking as pdf_loader."""
    words = text.split()
    word_chunk_size = int(chunk_size * 0.75)
    word_overlap = int(overlap * 0.75)

    chunks = []
    start = 0
    while start < len(words):
        end = start + word_chunk_size
        chunk = " ".join(words[start:end])
        if chunk.strip():
            chunks.append(chunk)
        start += word_chunk_size - word_overlap

    return chunks


def _domain_as_title(url: str) -> str:
    """Extract a readable title from URL domain as fallback."""
    parsed = urlparse(url)
    return parsed.netloc.replace("www.", "")


def load_url(
    url: str,
    title: Optional[str] = None,
    topic: str = "general",
    chunk_size: int = 512,
    chunk_overlap: int = 50,
) -> list[dict]:
    """
    Fetch a URL, strip HTML noise with trafilatura, chunk the clean text.
    Returns list of {"text": str, "metadata": dict}.
    """
    downloaded = trafilatura.fetch_url(url)
    if not downloaded:
        raise ValueError(f"Failed to fetch URL: {url}")

    # trafilatura extracts main content, strips nav/footer/ads
    text = trafilatura.extract(
        downloaded,
        include_comments=False,
        include_tables=True,
        no_fallback=False,
    )

    if not text:
        raise ValueError(f"No extractable content at URL: {url}")

    # Extract metadata from the page if available
    metadata = trafilatura.extract_metadata(downloaded)
    if not title:
        title = (metadata.title if metadata and metadata.title else None) or _domain_as_title(url)

    text = re.sub(r"\s+", " ", text).strip()
    raw_chunks = _chunk_text(text, chunk_size, chunk_overlap)

    results = []
    for i, chunk_text in enumerate(raw_chunks):
        results.append({
            "text": chunk_text,
            "metadata": {
                "source_type": "url",
                "title": title,
                "author": "Unknown",
                "chapter": "Unknown",
                "topic": topic,
                "file_path": url,
                "date_added": date.today().isoformat(),
                "chunk_index": i,
            }
        })

    return results

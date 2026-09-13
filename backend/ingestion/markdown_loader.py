import re
from datetime import date
from typing import Optional
from pathlib import Path


def _split_by_headings(text: str) -> list[tuple[str, str]]:
    """
    Split markdown into (heading, body) pairs.
    Each heading becomes the 'chapter' for its section's chunks.
    Falls back to a single block if no headings found.
    """
    pattern = re.compile(r"^(#{1,3} .+)$", re.MULTILINE)
    matches = list(pattern.finditer(text))

    if not matches:
        return [("Unknown", text)]

    sections = []
    for i, match in enumerate(matches):
        heading = match.group(1).lstrip("#").strip()
        start = match.end()
        end = matches[i + 1].start() if i + 1 < len(matches) else len(text)
        body = text[start:end].strip()
        if body:
            sections.append((heading, body))

    return sections


def _chunk_text(text: str, chunk_size: int, overlap: int) -> list[str]:
    """Same word-based chunking as other loaders."""
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


def load_markdown(
    file_path: str,
    title: Optional[str] = None,
    topic: str = "general",
    chunk_size: int = 512,
    chunk_overlap: int = 50,
) -> list[dict]:
    """
    Parse a markdown file into chunks with metadata.
    Splits on headings to preserve section context.
    Returns list of {"text": str, "metadata": dict}.
    """
    path = Path(file_path)
    raw = path.read_text(encoding="utf-8")

    if not title:
        # Use first H1 as title, fall back to filename
        h1 = re.search(r"^# (.+)$", raw, re.MULTILINE)
        title = h1.group(1).strip() if h1 else path.stem.replace("-", " ").replace("_", " ").title()

    sections = _split_by_headings(raw)

    results = []
    chunk_index = 0
    for heading, body in sections:
        body = re.sub(r"\s+", " ", body).strip()
        raw_chunks = _chunk_text(body, chunk_size, chunk_overlap)
        for chunk_text in raw_chunks:
            results.append({
                "text": chunk_text,
                "metadata": {
                    "source_type": "markdown",
                    "title": title,
                    "author": "Unknown",
                    "chapter": heading,
                    "topic": topic,
                    "file_path": str(path.resolve()),
                    "date_added": date.today().isoformat(),
                    "chunk_index": chunk_index,
                }
            })
            chunk_index += 1

    return results

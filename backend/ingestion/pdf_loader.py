import fitz  # PyMuPDF
import re
from datetime import date
from typing import Optional


def _extract_toc_chapters(doc: fitz.Document) -> dict[int, str]:
    """
    Extract page → chapter name mapping from PDF table of contents.
    Returns empty dict if TOC is unavailable or malformed.
    """
    toc = doc.get_toc()  # [[level, title, page], ...]
    chapters = {}
    for level, title, page in toc:
        if level == 1:  # top-level chapters only
            chapters[page] = title
    return chapters


def _get_chapter_for_page(page_num: int, chapters: dict[int, str]) -> str:
    """
    Given a page number and the TOC chapter map, return the chapter
    that contains this page (last chapter start <= page_num).
    """
    if not chapters:
        return "Unknown"
    chapter = "Unknown"
    for start_page, title in sorted(chapters.items()):
        if page_num >= start_page:
            chapter = title
        else:
            break
    return chapter


def _is_reference_page(text: str) -> bool:
    """
    Skip pages whose heading is a known reference/bibliography section title.
    Only matches dedicated reference pages, not content pages with footnotes.
    """
    lines = [l.strip() for l in text.splitlines() if l.strip()]
    if not lines:
        return False
    first_line = lines[0].lower()
    return first_line in {"references", "bibliography", "works cited", "further reading", "notes"}


def _chunk_text(text: str, chunk_size: int, overlap: int) -> list[str]:
    """
    Split text into chunks by word count approximation.
    1 token ≈ 0.75 words — so 512 tokens ≈ 384 words.
    Using words keeps chunks coherent at sentence boundaries.
    """
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


def load_pdf(
    file_path: str,
    title: Optional[str] = None,
    author: Optional[str] = None,
    topic: str = "general",
    chunk_size: int = 512,
    chunk_overlap: int = 50,
) -> list[dict]:
    """
    Parse a PDF into chunks with metadata.
    Returns list of {"text": str, "metadata": dict}.
    """
    doc = fitz.open(file_path)

    # Use filename as title fallback
    if not title:
        title = doc.metadata.get("title") or file_path.split("/")[-1].replace(".pdf", "")

    if not author:
        author = doc.metadata.get("author") or "Unknown"

    chapters = _extract_toc_chapters(doc)

    # Extract full text per page, tag with chapter
    pages_text = []
    for page_num, page in enumerate(doc, start=1):
        text = page.get_text("text")
        text = re.sub(r"\s+", " ", text).strip()
        if text and not _is_reference_page(text):
            chapter = _get_chapter_for_page(page_num, chapters)
            pages_text.append((text, chapter, page_num))

    doc.close()

    # Concatenate all text then chunk globally
    # (better than chunking per-page which creates tiny chunks for short pages)
    full_text_blocks = []
    for text, chapter, page_num in pages_text:
        full_text_blocks.append(text)

    full_text = " ".join(full_text_blocks)
    raw_chunks = _chunk_text(full_text, chunk_size, chunk_overlap)

    # Re-associate chunks with chapters by position
    # Simple approach: track character offset into full_text
    results = []
    char_offset = 0
    page_boundaries = []
    running = 0
    for text, chapter, page_num in pages_text:
        page_boundaries.append((running, running + len(text), chapter, page_num))
        running += len(text) + 1  # +1 for the space separator

    def chapter_at_offset(offset: int) -> str:
        for start, end, chapter, _ in page_boundaries:
            if start <= offset <= end:
                return chapter
        return "Unknown"

    offset = 0
    for i, chunk_text in enumerate(raw_chunks):
        chapter = chapter_at_offset(offset)
        results.append({
            "text": chunk_text,
            "metadata": {
                "source_type": "pdf",
                "title": title,
                "author": author,
                "chapter": chapter,
                "topic": topic,
                "file_path": file_path,
                "date_added": date.today().isoformat(),
                "chunk_index": i,
            }
        })
        offset += len(chunk_text)

    return results

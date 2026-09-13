"""
Agent tools exposed to the ReActAgent.
Each function's docstring is used by LlamaIndex as the tool description.
"""

import logging

from llama_index.core.tools import FunctionTool

from backend.retriever import search, list_sources as _list_sources

logger = logging.getLogger(__name__)


def make_tools(
    chunks_acc: list[dict] | None = None,
    topic_filter: str = "",
) -> list[FunctionTool]:
    """
    Build the agent tool list.

    Args:
        chunks_acc: If provided, retrieved chunks are appended for source citations.
        topic_filter: Optional topic to narrow all searches in this request.
    """

    def search_knowledge_base(query: str, topic: str = "") -> str:
        """
        Search the personal knowledge base for chunks relevant to the query.
        Returns the top matching chunks with their source metadata.
        Optionally filter by topic (e.g. "databases", "architecture", "python").
        """
        # Request-level topic_filter takes precedence if no per-call topic specified
        effective_topic = topic or topic_filter or None
        logger.debug("search_knowledge_base query=%r topic=%r", query, effective_topic)

        results = search(query=query, topic=effective_topic)

        if not results:
            return "No relevant chunks found for this query."

        for r in results:
            logger.debug("  → [%.4f] %s | %s | %s", r["score"], r["title"], r["chapter"], r["text"][:80])

        if chunks_acc is not None:
            seen_texts = {c["text"] for c in chunks_acc}
            for r in results:
                if r["text"] not in seen_texts:
                    chunks_acc.append(r)
                    seen_texts.add(r["text"])

        parts = []
        for i, r in enumerate(results, 1):
            parts.append(
                f"[{i}] {r['title']} | {r['chapter']} (score: {r['score']})\n"
                f"{r['text']}"
            )

        return "\n\n---\n\n".join(parts)

    def list_all_sources() -> str:
        """
        List all sources (books, docs, notes) currently indexed in the knowledge base.
        Use this when the user asks what books or topics are available,
        or when deciding which source_title or topic filter to use.
        """
        sources = _list_sources()
        if not sources:
            return "No sources indexed yet."

        lines = []
        for s in sources:
            lines.append(
                f"- {s['title']} ({s['source_type']}) | topic: {s['topic']} | "
                f"author: {s['author']} | {s['chunk_count']} chunks"
            )
        return "\n".join(lines)

    return [
        FunctionTool.from_defaults(fn=search_knowledge_base),
        FunctionTool.from_defaults(fn=list_all_sources),
    ]


# Default tools with no accumulator — used when chunks_acc isn't needed
TOOLS = make_tools()

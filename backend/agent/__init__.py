"""
Agent package — public interface.

Two modes:
  1. Retrieval-first (default): always retrieve chunks first, then synthesize.
     The LLM ONLY sees the retrieved text — it cannot skip retrieval or answer
     from training knowledge. Used for all standard questions.

  2. Agent loop (fallback for follow-up/comparative questions): ReActAgent
     that can call search_knowledge_base multiple times with different queries.
     Used when the question references conversation history or needs multi-search.

Usage:
    from backend.agent import ask, ask_async, ask_streaming
"""

import asyncio
import logging
import re
from typing import AsyncGenerator

from llama_index.core.agent import ReActAgent
from llama_index.core.llms import ChatMessage, MessageRole
from llama_index.llms.groq import Groq
from llama_index.llms.openai import OpenAI
from llama_index.llms.openai_like import OpenAILike
from llama_index.core.agent.workflow.workflow_events import AgentStream, AgentOutput, ToolCall

from backend.config import (
    GROQ_API_KEY, GROQ_MODEL, GROQ_FALLBACK_MODEL,
    OPENROUTER_API_KEY, OPENROUTER_MODEL, OPENROUTER_BASE_URL,
    TOP_K,
)
from backend.agent.tools import make_tools
from backend.agent.prompts import SYSTEM_PROMPT, SYNTHESIS_PROMPT, COMPARISON_PROMPT
from backend.retriever import search, list_sources

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# LLM construction
# ---------------------------------------------------------------------------

def _build_chat_history(history: list[dict] | None) -> list[ChatMessage]:
    if not history:
        return []
    return [
        ChatMessage(
            role=MessageRole.USER if m["role"] == "user" else MessageRole.ASSISTANT,
            content=m["content"],
        )
        for m in history
    ]


def _build_llm(fallback_level: int, provider: str = "", model: str = "", api_key: str = ""):
    """
    Resolve the LLM to use.
    Priority: user-specified provider+key > env fallback chain.
    """
    if provider and api_key:
        if provider == "openai":
            return OpenAI(model=model or "gpt-4o", api_key=api_key)
        elif provider == "anthropic":
            m = model or "anthropic/claude-opus-4-6"
            if not m.startswith("anthropic/"):
                m = f"anthropic/{m}"
            return OpenAILike(model=m, api_key=api_key, api_base="https://openrouter.ai/api/v1", is_chat_model=True)
        elif provider == "groq":
            return Groq(model=model or GROQ_MODEL, api_key=api_key)

    if fallback_level == 0:
        return Groq(model=GROQ_MODEL, api_key=GROQ_API_KEY)
    elif fallback_level == 1:
        return Groq(model=GROQ_FALLBACK_MODEL, api_key=GROQ_API_KEY)
    else:
        return OpenAILike(model=OPENROUTER_MODEL, api_key=OPENROUTER_API_KEY, api_base=OPENROUTER_BASE_URL, is_chat_model=True)


def _is_rate_limit_error(exc: Exception) -> bool:
    msg = str(exc)
    return "429" in msg or "rate_limit_exceeded" in msg


# ---------------------------------------------------------------------------
# Mode 1 — Retrieval-first (guaranteed grounded)
# ---------------------------------------------------------------------------

def _build_context(chunks: list[dict]) -> str:
    """Format retrieved chunks into a numbered context block for the synthesis prompt."""
    parts = []
    for i, c in enumerate(chunks, 1):
        parts.append(
            f"[{i}] {c['title']} | {c['chapter']} (relevance: {c['score']:.2f})\n"
            f"{c['text']}"
        )
    return "\n\n---\n\n".join(parts)


async def _synthesize_streaming(
    llm,
    question: str,
    chunks: list[dict],
    history: list[dict] | None,
) -> AsyncGenerator[str, None]:
    """
    Call the LLM with a fully constructed prompt that contains ONLY the retrieved chunks.
    The LLM has no opportunity to answer from training knowledge.
    Streams tokens via LlamaIndex's astream_chat.
    """
    context = _build_context(chunks)
    prompt = SYNTHESIS_PROMPT.format(context=context, question=question)

    messages = _build_chat_history(history)
    messages.append(ChatMessage(role=MessageRole.USER, content=prompt))

    response = await llm.astream_chat(messages)
    async for chunk in response:
        delta = chunk.delta
        if delta:
            yield delta


# ---------------------------------------------------------------------------
# Mode 2 — Agent loop (multi-search, follow-ups)
# ---------------------------------------------------------------------------

def _make_agent(
    fallback_level: int = 0,
    chunks_acc: list[dict] | None = None,
    provider: str = "",
    model: str = "",
    api_key: str = "",
    topic_filter: str = "",
) -> ReActAgent:
    llm = _build_llm(fallback_level, provider, model, api_key)
    return ReActAgent(
        llm=llm,
        tools=make_tools(chunks_acc=chunks_acc, topic_filter=topic_filter),
        system_prompt=SYSTEM_PROMPT,
        verbose=False,
        early_stopping_method="generate",
    )


async def _collect_tokens(agent: ReActAgent, question: str, history: list[dict] | None) -> list[str]:
    chat_history = _build_chat_history(history)
    handler = agent.run(user_msg=question, chat_history=chat_history or None, max_iterations=8)

    current_step_tokens: list[str] = []
    last_was_tool = False

    async for event in handler.stream_events():
        if isinstance(event, ToolCall):
            last_was_tool = True
            current_step_tokens = []
        elif isinstance(event, AgentStream) and event.delta:
            current_step_tokens.append(event.delta)
        elif isinstance(event, AgentOutput):
            last_was_tool = False

    await handler

    full = "".join(current_step_tokens)

    for marker in ("Final Answer:", "Answer:"):
        idx = full.find(marker)
        if idx != -1:
            return [full[idx + len(marker):].lstrip()]

    lines = full.splitlines()
    skip_prefixes = ("Thought:", "Action:", "Action Input:", "Observation:")
    for i, line in enumerate(lines):
        if not any(line.strip().startswith(p) for p in skip_prefixes) and line.strip():
            return ["\n".join(lines[i:]).strip()]

    return [full] if full else current_step_tokens


# ---------------------------------------------------------------------------
# Routing: decide which mode to use
# ---------------------------------------------------------------------------

# Rerank score threshold below which we consider retrieval irrelevant
_RELEVANCE_THRESHOLD = -2.0

def _is_comparative(question: str) -> bool:
    """True if the question needs multi-source synthesis."""
    q = question.lower()
    triggers = ("compare", " vs ", " versus ", "difference between", "similarities",
                "both ", "all of", "summarize", "overview of everything",
                "how do", "how does")
    return any(t in q for t in triggers)


def _is_followup(question: str, history: list[dict] | None) -> bool:
    """True if the question refers to something in prior history."""
    if not history:
        return False
    q = question.lower()
    reference_words = ("it ", "its ", "they ", "them ", "that ", "this ", "these ", "those ")
    return any(q.startswith(w) or f" {w}" in q for w in reference_words)


def _extract_topic_from_history(history: list[dict]) -> str:
    """Pull the last user message topic to use as follow-up search query."""
    for msg in reversed(history):
        if msg.get("role") == "user":
            return msg["content"]
    return ""


def _chunks_are_relevant(chunks: list[dict]) -> bool:
    """Return False if the top chunk score is below the relevance threshold."""
    if not chunks:
        return False
    top_score = chunks[0].get("rerank_score") or chunks[0].get("score", 0)
    if isinstance(top_score, (int, float)):
        return top_score >= _RELEVANCE_THRESHOLD
    return True


_STOP_WORDS = {"and", "the", "for", "with", "from", "into", "over", "of", "in", "a", "an"}


def _title_tokens(title: str) -> list[str]:
    """Split title on whitespace and punctuation, return lowercase tokens."""
    return [t for t in re.split(r'[\s.\-_/]+', title.lower()) if t]


def _title_matches_question(title: str, q: str) -> bool:
    """
    Return True if the title (or a meaningful part of it) appears in the question.
    Handles:
    - Full title substring
    - Acronym derived from title tokens (e.g. 'dda' → Designing Data-Intensive Applications)
    - Any distinctive token (5+ chars, not a stop word)
    """
    # Full title substring
    if title.lower() in q:
        return True

    tokens = _title_tokens(title)
    sig_tokens = [tok for tok in tokens if len(tok) >= 3 and tok not in _STOP_WORDS]

    # Acronym from significant tokens — word-boundary match
    acronym = "".join(tok[0] for tok in sig_tokens)
    if len(acronym) >= 3 and re.search(r'\b' + re.escape(acronym) + r'\b', q):
        return True

    # Any distinctive token (5+ chars) present in question
    long_tokens = [tok for tok in sig_tokens if len(tok) >= 5]
    return any(tok in q for tok in long_tokens)


def _detect_comparison_subjects(question: str) -> tuple[str, str] | None:
    """
    Dynamically detect two named sources in a comparative question by matching
    against all titles currently indexed in ChromaDB.
    Returns (label_a, label_b) if two distinct titles are found, else None.
    """
    q = question.lower()
    found: list[str] = []

    try:
        sources = list_sources()
    except Exception:
        return None

    # Sort by title length descending — longer/more-specific titles match first
    titles = sorted([s["title"] for s in sources], key=len, reverse=True)

    for title in titles:
        if _title_matches_question(title, q) and title not in found:
            found.append(title)
        if len(found) == 2:
            return (found[0], found[1])

    return None


# ---------------------------------------------------------------------------
# Public interface
# ---------------------------------------------------------------------------

def _accumulate(chunks_acc: list[dict] | None, chunks: list[dict]) -> None:
    """Append chunks to accumulator, deduplicating by text."""
    if chunks_acc is None:
        return
    seen = {c["text"] for c in chunks_acc}
    for c in chunks:
        if c["text"] not in seen:
            chunks_acc.append(c)
            seen.add(c["text"])


async def _retrieval_first(
    question: str,
    history: list[dict] | None,
    chunks_acc: list[dict] | None,
    provider: str,
    model: str,
    api_key: str,
    topic_filter: str,
    extra_queries: list[str] | None = None,
) -> AsyncGenerator[str, None]:
    """
    Core retrieval-first pipeline.
    Runs `question` + any `extra_queries`, merges chunks, synthesizes.
    Always grounded — LLM only sees retrieved text.
    """
    all_queries = [question] + (extra_queries or [])
    merged: list[dict] = []
    seen_texts: set[str] = set()

    for q in all_queries:
        chunks = search(q, topic=topic_filter or None, k=TOP_K)
        for c in chunks:
            if c["text"] not in seen_texts:
                merged.append(c)
                seen_texts.add(c["text"])

    if not merged or not _chunks_are_relevant(merged):
        yield "The knowledge base does not contain relevant information on this topic."
        return

    # Sort merged by score descending, keep best TOP_K * 2
    merged.sort(key=lambda c: c.get("rerank_score") or c.get("score", 0), reverse=True)
    merged = merged[: TOP_K * 2]

    _accumulate(chunks_acc, merged)
    logger.info("retrieval-first: %d merged chunks, top score=%.4f",
                len(merged), merged[0].get("rerank_score") or merged[0].get("score", 0))

    for level in (0, 1, 2):
        try:
            llm = _build_llm(level, provider, model, api_key)
            async for token in _synthesize_streaming(llm, question, merged, history):
                yield token
            return
        except Exception as exc:
            if _is_rate_limit_error(exc) and level < 2:
                logger.warning("Rate limit at level=%d, trying next", level)
                continue
            raise


async def _compare_streaming(
    question: str,
    label_a: str,
    label_b: str,
    history: list[dict] | None,
    chunks_acc: list[dict] | None,
    provider: str,
    model: str,
    api_key: str,
    topic_filter: str,
) -> AsyncGenerator[str, None]:
    """
    Retrieve chunks for each subject separately, then synthesize a side-by-side comparison.
    Both chunk sets are shown to the LLM together — it cannot skip either side.
    """
    chunks_a = search(label_a, topic=topic_filter or None, k=TOP_K)
    chunks_b = search(label_b, topic=topic_filter or None, k=TOP_K)

    # Also run the full question against both to catch cross-topic chunks
    chunks_q = search(question, topic=topic_filter or None, k=TOP_K)
    for c in chunks_q:
        # Assign to the side whose label appears in the chunk title
        title = c.get("title", "").lower()
        if label_a.lower().split()[0] in title and c["text"] not in {x["text"] for x in chunks_a}:
            chunks_a.append(c)
        elif label_b.lower().split()[0] in title and c["text"] not in {x["text"] for x in chunks_b}:
            chunks_b.append(c)

    _accumulate(chunks_acc, chunks_a)
    _accumulate(chunks_acc, chunks_b)

    context_a = _build_context(chunks_a) if chunks_a else "No relevant excerpts found."
    context_b = _build_context(chunks_b) if chunks_b else "No relevant excerpts found."

    logger.info("compare-mode: %s(%d chunks) vs %s(%d chunks)",
                label_a, len(chunks_a), label_b, len(chunks_b))

    prompt = COMPARISON_PROMPT.format(
        label_a=label_a,
        label_b=label_b,
        context_a=context_a,
        context_b=context_b,
        question=question,
    )

    messages = _build_chat_history(history)
    messages.append(ChatMessage(role=MessageRole.USER, content=prompt))

    for level in (0, 1, 2):
        try:
            llm = _build_llm(level, provider, model, api_key)
            response = await llm.astream_chat(messages)
            async for chunk in response:
                if chunk.delta:
                    yield chunk.delta
            return
        except Exception as exc:
            if _is_rate_limit_error(exc) and level < 2:
                logger.warning("Rate limit at level=%d, trying next", level)
                continue
            raise


async def ask_streaming(
    question: str,
    history: list[dict] | None = None,
    chunks_acc: list[dict] | None = None,
    provider: str = "",
    model: str = "",
    api_key: str = "",
    topic_filter: str = "",
) -> AsyncGenerator[str, None]:
    """
    Async generator yielding answer tokens.

    Routing:
    - Comparative (compare/vs): retrieval-first with multiple search queries
    - Follow-up (pronouns + history): retrieval-first, resolves topic from history
    - Standard: retrieval-first, single query
    - Agent-loop: only used when agent is explicitly needed (kept as fallback)
    """
    is_comparative = _is_comparative(question)
    is_followup = _is_followup(question, history)

    logger.info("mode=%s comparative=%s followup=%s question=%r",
                "retrieval-first", is_comparative, is_followup, question[:80])

    # ── Comparative: two named sources → comparison mode ─────────────────
    if is_comparative:
        subjects = _detect_comparison_subjects(question)
        if subjects:
            label_a, label_b = subjects
            logger.info("compare-mode: %r vs %r", label_a, label_b)
            async for token in _compare_streaming(
                question, label_a, label_b, history, chunks_acc,
                provider, model, api_key, topic_filter,
            ):
                yield token
            return
        # Generic comparative (no named sources detected) — multi-query retrieval-first
        async for token in _retrieval_first(
            question, history, chunks_acc, provider, model, api_key, topic_filter,
            extra_queries=[question],
        ):
            yield token
        return

    # ── Follow-up: resolve pronoun by prepending prior topic ──────────────
    if is_followup and history:
        prior_topic = _extract_topic_from_history(history)
        resolved = f"{prior_topic} — {question}" if prior_topic else question
        async for token in _retrieval_first(
            resolved, history, chunks_acc, provider, model, api_key, topic_filter,
            extra_queries=[question],
        ):
            yield token
        return

    # ── Standard: single retrieval-first ──────────────────────────────────
    async for token in _retrieval_first(
        question, history, chunks_acc, provider, model, api_key, topic_filter,
    ):
        yield token


async def ask_async(question: str, history: list[dict] | None = None) -> str:
    """Async query returning full string — used by tests."""
    tokens = []
    async for t in ask_streaming(question, history=history):
        tokens.append(t)
    return "".join(tokens)


def ask(question: str, history: list[dict] | None = None) -> str:
    """Sync query — used by scripts and tests."""
    return asyncio.run(ask_async(question, history))

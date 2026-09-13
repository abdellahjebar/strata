"""
Diagnose whether the agent answers from RAG (retrieved chunks) or LLM training knowledge.

A genuine RAG answer:
  - chunks_acc is non-empty
  - cited sources match the question topic
  - answer content matches the chunk text

An LLM-only answer:
  - chunks_acc is empty (agent never called search_knowledge_base)
  - OR chunks were retrieved but agent ignored them and answered generically
"""

import asyncio
import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from backend.retriever import warmup, search
from backend.agent import ask_streaming


def fmt(text):
    return text[:150].replace("\n", " ").encode("ascii", "replace").decode("ascii")


async def diagnose(question, topic=None):
    print(f"\n{'='*60}")
    print(f"Q: {question}")
    print(f"{'='*60}")

    # Step 1: what does raw retrieval return?
    results = search(question, topic=topic, k=3)
    print(f"\n[RETRIEVER] Raw top-3 chunks for this query:")
    if not results:
        print("  !! Nothing in DB matches this query")
    for r in results:
        print(f"  score={r['score']:.4f} | {r['title']} | {r['chapter']}")
        print(f"  {fmt(r['text'])!r}")

    # Step 2: run agent, track what it actually retrieved
    chunks_acc = []
    tokens = []
    async for t in ask_streaming(question, chunks_acc=chunks_acc, topic_filter=topic or ""):
        tokens.append(t)
    answer = "".join(tokens)

    print(f"\n[AGENT] Answer excerpt:")
    print(fmt(answer))

    print(f"\n[VERDICT]")
    if not chunks_acc:
        print("  !! RAG NOT USED — agent answered entirely from LLM training knowledge")
        print("     (search_knowledge_base was never called)")
    else:
        print(f"  RAG USED — agent retrieved {len(chunks_acc)} chunks")
        seen = set()
        for c in chunks_acc:
            key = f"{c['title']}|{c['chapter']}"
            if key not in seen:
                seen.add(key)
                print(f"  [{c['score']:.4f}] {c['title']} | {c['chapter']}")

        # Check if answer is grounded: look for key phrases from chunks in the answer
        answer_lower = answer.lower()
        grounded = 0
        for c in chunks_acc[:3]:
            # Take a distinctive 6-word phrase from the chunk
            words = c["text"].split()
            if len(words) >= 6:
                phrase = " ".join(words[2:8]).lower()
                if phrase in answer_lower:
                    grounded += 1

        if grounded > 0:
            print(f"  GROUNDED: answer contains text directly from {grounded} retrieved chunk(s)")
        else:
            print(f"  WARNING: chunks retrieved but answer may not be grounded in them")
            print(f"           (agent may have used them as context but paraphrased heavily)")


async def main():
    print("Loading models...")
    warmup()

    await diagnose("What is a bounded context?")
    await diagnose("What are the types of databases?", topic="databases")


if __name__ == "__main__":
    asyncio.run(main())

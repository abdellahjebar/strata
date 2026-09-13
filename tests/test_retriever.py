"""
Test the retriever in isolation — no LLM, pure vector search + reranking.
Proves that RAG retrieval works independently of the LLM layer.
"""

import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from backend.retriever import search, list_sources


def test_sources():
    print("\n=== SOURCES IN KNOWLEDGE BASE ===")
    sources = list_sources()
    if not sources:
        print("  !! NO SOURCES INDEXED — ingest something first")
        return False
    for s in sources:
        print(f"  [{s['source_type']}] {s['title']!r} | topic={s['topic']!r} | {s['chunk_count']} chunks")
    return True


def test_retrieval(query, topic=None, label=""):
    print(f"\n=== {label or query[:60]} ===")
    results = search(query, topic=topic, k=3)
    print(f"  Query   : {query!r}")
    print(f"  Filter  : topic={topic!r}")
    print(f"  Returned: {len(results)} chunks")
    for i, r in enumerate(results, 1):
        preview = r["text"][:150].replace("\n", " ").strip().encode("ascii", "replace").decode("ascii")
        print(f"  [{i}] score={r['score']:.4f} | {r['chapter']}")
        print(f"       {preview!r}")
    return results


def main():
    ok = test_sources()
    if not ok:
        return

    # Test 1: direct keyword match — should return high-scoring chunks
    r1 = test_retrieval(
        "LSM trees vs B-trees write performance",
        topic="databases",
        label="LSM vs B-trees (topic=databases)"
    )
    assert len(r1) > 0, "FAIL: no results for LSM trees query"
    assert r1[0]["score"] > 0.0, "FAIL: top chunk has zero score"
    print(f"  PASS: top chunk score = {r1[0]['score']:.4f}")

    # Test 2: wrong topic filter — should return nothing (DDIA is topic=databases, not python)
    r2 = test_retrieval(
        "LSM trees vs B-trees",
        topic="python",
        label="LSM vs B-trees (topic=python — should be empty)"
    )
    assert len(r2) == 0, f"FAIL: expected 0 results with wrong topic, got {len(r2)}"
    print("  PASS: no results with wrong topic filter")

    # Test 3: semantic search — phrased differently but same concept
    r3 = test_retrieval(
        "how do log-structured storage engines work",
        label="Semantic: log-structured storage (no topic filter)"
    )
    assert len(r3) > 0, "FAIL: no results for semantic query"
    print(f"  PASS: semantic query returned {len(r3)} chunks")

    # Test 4: query with no relevant content
    r4 = test_retrieval(
        "best practices for baking sourdough bread",
        label="Irrelevant query — expect low scores"
    )
    if r4:
        print(f"  INFO: irrelevant query still returned {len(r4)} chunks (lowest score: {r4[-1]['score']:.4f})")
        print("  (retriever always returns k chunks if DB non-empty; scores should be low)")

    # Test 5: reranking is working — top result should be more relevant than last
    r5 = test_retrieval(
        "replication lag eventual consistency",
        topic="databases",
        label="Replication/consistency (checks reranking order)"
    )
    if len(r5) >= 2:
        assert r5[0]["score"] >= r5[-1]["score"], "FAIL: results not sorted by rerank score"
        print(f"  PASS: results sorted — top={r5[0]['score']:.4f} last={r5[-1]['score']:.4f}")

    print("\n=== ALL RETRIEVER TESTS PASSED ===\n")


if __name__ == "__main__":
    main()

import sys, asyncio, os
root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(root)
sys.path.insert(0, root)
sys.path.insert(0, os.path.join(root, 'backend'))

from agent import ask_streaming

async def ask(label, question, topic_filter="", history=None):
    print(f"\n{'='*60}")
    print(f"[{label}]")
    print(f"Q: {question}")
    if topic_filter:
        print(f"   topic_filter={topic_filter}")
    print(f"{'='*60}")
    chunks_acc = []
    answer = ""
    async for token in ask_streaming(question, history=history or [], chunks_acc=chunks_acc, topic_filter=topic_filter):
        answer += token
    answer_safe = answer[:800].encode("ascii", "replace").decode("ascii")
    print("A:", answer_safe)
    if chunks_acc:
        print(f"\n  Sources ({len(chunks_acc)}):")
        for c in chunks_acc[:3]:
            title = c.get('title', '?').encode("ascii", "replace").decode("ascii")
            chap = c.get('chapter', '').encode("ascii", "replace").decode("ascii")
            score = c.get('rerank_score') or c.get('score', '')
            score_str = f"score={score:.3f}" if isinstance(score, float) else ""
            print(f"    - {title} | {chap} | {score_str}")
    else:
        print("  Sources: none accumulated")

async def main():
    # 1. Narrow precise — databases
    await ask("NARROW-1", "What are the tradeoffs of LSM trees vs B-trees?", topic_filter="databases")

    # 2. Narrow — DDD
    await ask("NARROW-2", "What is a bounded context in DDD?")

    # 3. Broad multi-source
    await ask("BROAD-1", "How do DDIA and the DDD books approach complexity differently?")

    # 4. Out of KB
    await ask("OUT-OF-KB", "What is the time complexity of quicksort?")

    # 5. Follow-up pronoun resolution
    history = [
        {"role": "user", "content": "What is event sourcing?"},
        {"role": "assistant", "content": "Event sourcing is a pattern where state changes are stored as a sequence of events."}
    ]
    await ask("FOLLOW-UP", "What are its main drawbacks?", history=history)

    # 6. Topic filter
    await ask("TOPIC-FILTER", "What are the main architectural patterns?", topic_filter="architecture")

    # 7. Comparison synthesis — two named books detected
    await ask("COMPARE-1", "How do DDIA and DDD approach complexity differently?")

    # 8. Comparison — explicit vs between two DDD books
    await ask("COMPARE-2", "What are the differences between implementing DDD and learning DDD?")

asyncio.run(main())

"""
Terminal smoke test for the agent.
Run from project root: py -3.12 tests/test_agent.py
"""

import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
os.chdir(os.path.join(os.path.dirname(__file__), ".."))

from backend.agent import ask

QUESTIONS = [
    "What is a bounded context in Domain-Driven Design?",
    "What are the different types of subdomains in DDD and how do they differ?",
]

if __name__ == "__main__":
    for q in QUESTIONS:
        print("=" * 70)
        print(f"Q: {q}")
        print("=" * 70)
        answer = ask(q)
        print(f"\nA: {answer}\n")

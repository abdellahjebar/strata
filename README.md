# Strata — Agentic RAG over a Personal Knowledge Base

A local-first, privacy-preserving RAG (Retrieval-Augmented Generation) system that lets you have grounded conversations with your personal library — books, PDFs, notes, and web pages.  
Everything runs on your machine. No data leaves it except the final LLM call to Groq.

---

## What it does

You feed Strata your PDFs, markdown notes, or any URL. It chunks them, embeds them locally, and stores them in a persistent ChromaDB vector store. When you ask a question, the system:

1. Embeds the query locally (no external API)
2. Retrieves the top-20 candidate chunks from ChromaDB
3. Reranks them with a cross-encoder (local) to get the top-5
4. Guarantees source diversity — at least one chunk per indexed book before filling the remaining slots
5. Passes the grounded context to the LLM (Groq) and streams the answer token by token via SSE

The result: answers that cite specific passages, never hallucinate sources, and don't get dominated by a single over-represented book.

---

## Architecture

```
frontend (React + Vite)
    │  SSE stream (tokens + source citations)
    ▼
FastAPI backend
    ├── /chat     → ReAct agent (LlamaIndex) → search_knowledge_base tool
    ├── /ingest   → ingestion pipeline (PDF / Markdown / URL)
    └── /sources  → list indexed sources

Retriever (local, no external calls)
    ├── Embedding:  nomic-ai/nomic-embed-text-v1.5  (SentenceTransformers)
    ├── Vector DB:  ChromaDB (persistent, cosine similarity)
    └── Reranker:   cross-encoder/ms-marco-MiniLM-L-6-v2

LLM (external, streaming)
    ├── Primary:   Groq  (meta-llama/llama-4-scout by default)
    └── Fallback:  OpenRouter (llama-3.3-70b-instruct:free)
```

---

## Query modes

| Mode | How to use | What it does |
|---|---|---|
| **Direct** | Ask a factual question | Returns passages with citations |
| **Contextual** | Ask a follow-up ("what did he mean by that?") | Resolves pronouns from conversation history |
| **Comparative** | "Compare X and Y across your books" | Pulls chunks from multiple sources, synthesizes side-by-side |

---

## Tech stack

| Layer | Technology |
|---|---|
| Backend API | FastAPI + uvicorn |
| Agent framework | LlamaIndex ReAct agent |
| LLM provider | Groq (llama-4-scout / llama-3.1-8b fallback) |
| Embeddings | nomic-embed-text-v1.5 (local) |
| Vector store | ChromaDB (persistent) |
| Reranker | cross-encoder/ms-marco-MiniLM-L-6-v2 (local) |
| Document loaders | PyMuPDF (PDF), Trafilatura (URL), custom Markdown |
| Frontend | React 18 + Vite |
| Containerization | Docker + docker-compose |

---

## Project structure

```
Strata/
├── backend/
│   ├── main.py                  # FastAPI app, routes, CORS
│   ├── config.py                # Pydantic-settings, validated at startup
│   ├── retriever.py             # Embed → ChromaDB → rerank → diversity filter
│   ├── agent/
│   │   ├── tools.py             # LlamaIndex FunctionTools (search, list_sources)
│   │   └── prompts.py           # System prompt
│   ├── api/routes/
│   │   ├── chat.py              # SSE streaming endpoint
│   │   ├── ingest.py            # File upload + path/URL ingestion
│   │   └── sources.py           # List indexed sources
│   └── ingestion/
│       ├── ingest.py            # Chunking + embedding + ChromaDB upsert
│       ├── pdf_loader.py        # PyMuPDF loader
│       ├── url_loader.py        # Trafilatura loader
│       └── markdown_loader.py   # Markdown/txt loader
├── frontend/
│   └── src/
│       ├── components/          # ChatWindow, InputBar, MessageRow, InjectSidebar
│       └── hooks/               # useChat, useIngest, useSettings
├── tests/
├── docker-compose.yml
├── Dockerfile.backend
└── Dockerfile.frontend
```

---

## Getting started

### Prerequisites

- Python 3.11+
- Node.js 18+
- A [Groq API key](https://console.groq.com) (free tier works)

### 1. Clone and configure

```bash
git clone https://github.com/abdellahjebar/strata.git
cd strata
cp .env.example .env   # then add your GROQ_API_KEY
```

`.env` minimum:
```
GROQ_API_KEY=your_key_here
```

### 2. Run with Docker (recommended)

```bash
docker compose up --build
```

Frontend: `http://localhost` · Backend: `http://localhost:8000`

### 3. Run locally

**Backend:**
```bash
cd backend
pip install -r requirements.txt
uvicorn backend.main:app --reload
```

**Frontend:**
```bash
cd frontend
npm install
npm run dev
```

### 4. Ingest your first source

Via the UI sidebar, or via CLI:

```bash
# PDF
python backend/ingestion/ingest.py --source path/to/book.pdf --topic architecture

# URL
python backend/ingestion/ingest.py --source https://martinfowler.com/articles/microservices.html --topic microservices

# Markdown notes
python backend/ingestion/ingest.py --source notes/my-notes.md --topic general
```

---

## Configuration

All settings live in `.env` and are validated at startup via `pydantic-settings`. If `GROQ_API_KEY` is missing the server refuses to start.

| Variable | Default | Description |
|---|---|---|
| `GROQ_API_KEY` | required | Groq API key |
| `GROQ_MODEL` | `meta-llama/llama-4-scout-17b-16e-instruct` | Primary LLM |
| `EMBED_MODEL_NAME` | `nomic-ai/nomic-embed-text-v1.5` | Local embedding model |
| `TOP_K` | `5` | Final chunks returned to LLM |
| `RERANK_FETCH_K` | `20` | Candidates fetched before reranking |
| `CHUNK_SIZE` | `512` | Tokens per chunk |
| `CHUNK_OVERLAP` | `50` | Overlap between consecutive chunks |
| `OPENROUTER_API_KEY` | optional | Fallback LLM provider |

---

## Key design decisions

**Source diversity guarantee** — before filling the top-k slots by rerank score, the retriever ensures at least one chunk from each indexed source is included. This prevents a single large, well-indexed book from monopolizing every answer.

**Bibliography filter** — chunks that look like reference lists (detected by regex on line patterns) are dropped before reranking to avoid noise in citations.

**Zero cold-start** — embedding model, reranker, and ChromaDB collection are all pre-loaded at server startup via the `warmup()` call, so the first query is as fast as any subsequent one.

**Dual LLM** — Groq is the primary provider for its speed; OpenRouter (with a free llama-3.3-70b model) is the fallback. The provider can also be overridden per request from the frontend settings panel.

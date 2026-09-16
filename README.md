# Strata

A local-first RAG system for grounded, cited conversations with your own library: books, PDFs, notes, and web pages.

## Why

General-purpose LLMs answer from training data: plausible, generic, not grounded in the specific source you're actually relying on. That's fine for trivia. It's not fine when the answer needs to inform a real decision.

Strata forces the model to answer only from passages retrieved out of your own indexed documents. No match, no answer. It doesn't fill gaps with a guess.

The LLM is a pluggable last step, not the core of the system. Embedding, vector search, reranking, and deduplication are all local and independent of which model writes the final answer. Swapping providers is a one-line config change; the retrieval core never changes.

## What it does

1. Documents (PDF, Markdown, URL) are chunked and embedded locally, then stored in ChromaDB
2. A question is embedded locally and matched against the top 20 candidate chunks
3. A local cross-encoder reranks them down to the top 5
4. At least one chunk per indexed source is guaranteed in the final set
5. Those chunks, and only those, are sent to the LLM, which streams the answer back with citations

## Architecture

```
frontend (React + Vite)
    |  SSE stream (tokens + source citations)
    v
FastAPI backend
    |-- /chat     -> retrieval-first pipeline -> search_knowledge_base
    |-- /ingest   -> ingestion pipeline (PDF / Markdown / URL)
    `-- /sources  -> list indexed sources

Retriever (100% local, no external calls)
    |-- Embedding:  nomic-ai/nomic-embed-text-v1.5 (SentenceTransformers)
    |-- Vector DB:  ChromaDB (persistent, cosine similarity)
    `-- Reranker:   cross-encoder/ms-marco-MiniLM-L-6-v2

LLM (external, streaming, swappable)
    |-- Primary:  Groq (meta-llama/llama-4-scout by default)
    `-- Fallback: OpenRouter (llama-3.3-70b-instruct:free)
```

## Notable design points

- **Anti-hallucination by architecture.** No code path lets the LLM answer without grounded chunks.
- **Source diversity guarantee.** A slot per source is reserved before ranking, so one large book can't dominate every answer.
- **Dynamic comparison detection.** "Compare X vs Y" matches against whatever's actually indexed right now, not a hardcoded list.
- **Bibliography filter.** Reference-list chunks are dropped before reranking.
- **Zero cold start.** Models and the vector store connection are warmed up at server boot.
- **Automatic provider fallback.** A rate-limited Groq call retries on a smaller Groq model, then OpenRouter, transparently.
- **Fully local retrieval core.** Only already-selected passages leave the machine, never the source documents.

## Query modes

| Mode | Trigger | Behavior |
|---|---|---|
| Direct | Factual question | Returns passages with citations |
| Contextual | Follow-up question | Resolves references from conversation history |
| Comparative | "Compare X and Y" | Retrieves both sources separately, synthesizes side by side |

## Tech stack

| Layer | Technology |
|---|---|
| Backend API | FastAPI + uvicorn |
| Agent framework | LlamaIndex |
| LLM provider | Groq (primary), OpenRouter (fallback) |
| Embeddings | nomic-embed-text-v1.5 (local) |
| Vector store | ChromaDB (persistent) |
| Reranker | cross-encoder/ms-marco-MiniLM-L-6-v2 (local) |
| Document loaders | PyMuPDF (PDF), Trafilatura (URL), custom Markdown |
| Frontend | React 18 + Vite |
| Containerization | Docker + docker-compose |

## Project structure

```
Strata/
|-- backend/
|   |-- main.py                  # FastAPI app, routes, CORS
|   |-- config.py                # Pydantic-settings, validated at startup
|   |-- retriever.py             # Embed, search, rerank, diversity filter
|   |-- agent/
|   |   |-- tools.py             # Search tools exposed to the LLM
|   |   `-- prompts.py           # System prompt
|   |-- api/routes/
|   |   |-- chat.py              # SSE streaming endpoint
|   |   |-- ingest.py            # File upload and path/URL ingestion
|   |   `-- sources.py           # List indexed sources
|   `-- ingestion/
|       |-- ingest.py            # Chunking, embedding, ChromaDB upsert
|       |-- pdf_loader.py        # PyMuPDF loader
|       |-- url_loader.py        # Trafilatura loader
|       `-- markdown_loader.py   # Markdown/txt loader
|-- frontend/
|   `-- src/
|       |-- components/          # ChatWindow, InputBar, MessageRow, InjectSidebar
|       `-- hooks/               # useChat, useIngest, useSettings
|-- tests/
|-- docker-compose.yml
|-- Dockerfile.backend
`-- Dockerfile.frontend
```

## Getting started

### Prerequisites

- Python 3.11+
- Node.js 18+
- A [Groq API key](https://console.groq.com) (free tier works)

### 1. Clone and configure

```bash
git clone https://github.com/abdellahjebar/strata.git
cd strata
cp .env.example .env
```

Set `GROQ_API_KEY` in `.env`.

### 2. Run with Docker (recommended)

```bash
docker compose up --build
```

Frontend: `http://localhost`. Backend: `http://localhost:8000`.

### 3. Run locally

```bash
cd backend
pip install -r requirements.txt
uvicorn backend.main:app --reload
```

```bash
cd frontend
npm install
npm run dev
```

### 4. Ingest your first source

```bash
python backend/ingestion/ingest.py --source path/to/book.pdf --topic architecture
python backend/ingestion/ingest.py --source https://martinfowler.com/articles/microservices.html --topic microservices
python backend/ingestion/ingest.py --source notes/my-notes.md --topic general
```

## Configuration

All settings live in `.env` and are validated at startup via `pydantic-settings`. If `GROQ_API_KEY` is missing, the server refuses to start.

| Variable | Default | Description |
|---|---|---|
| `GROQ_API_KEY` | required | Groq API key |
| `GROQ_MODEL` | `meta-llama/llama-4-scout-17b-16e-instruct` | Primary LLM |
| `EMBED_MODEL_NAME` | `nomic-ai/nomic-embed-text-v1.5` | Local embedding model |
| `TOP_K` | `5` | Final chunks returned to the LLM |
| `RERANK_FETCH_K` | `20` | Candidates fetched before reranking |
| `CHUNK_SIZE` | `512` | Tokens per chunk |
| `CHUNK_OVERLAP` | `50` | Overlap between consecutive chunks |
| `OPENROUTER_API_KEY` | optional | Fallback LLM provider |

## Testing

```bash
pytest tests/
```

## License

Apache License 2.0. See [LICENSE](LICENSE).

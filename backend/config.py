"""
Application settings — validated at startup via pydantic-settings.
A missing GROQ_API_KEY raises immediately, preventing silent failures.

All constants are accessible as attributes of the `settings` singleton:
    from backend.config import settings
    settings.groq_model
"""

from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # --- LLM primary (Groq) ---
    groq_api_key: str = ""
    groq_model: str = "meta-llama/llama-4-scout-17b-16e-instruct"
    groq_fallback_model: str = "llama-3.1-8b-instant"

    # --- LLM fallback (OpenRouter) ---
    openrouter_api_key: str = ""
    openrouter_model: str = "meta-llama/llama-3.3-70b-instruct:free"
    openrouter_base_url: str = "https://openrouter.ai/api/v1"

    # --- Embeddings ---
    embed_model_name: str = "nomic-ai/nomic-embed-text-v1.5"
    embed_trust_remote_code: bool = True

    # --- ChromaDB ---
    chroma_persist_dir: str = "./chroma_db"
    chroma_collection_name: str = "knowledge_base"

    # --- Chunking ---
    chunk_size: int = 512
    chunk_overlap: int = 50

    # --- Retrieval ---
    top_k: int = 5
    rerank_fetch_k: int = 20
    rerank_model_name: str = "cross-encoder/ms-marco-MiniLM-L-6-v2"

    @model_validator(mode="after")
    def check_required_keys(self) -> "Settings":
        if not self.groq_api_key:
            raise ValueError(
                "GROQ_API_KEY is not set. "
                "Add it to .env or set it as an environment variable."
            )
        return self


settings = Settings()

# --------------------------------------------------------------------------
# Legacy flat-name aliases — keeps existing imports working without changes.
# Files that do `from backend.config import GROQ_API_KEY` will still work.
# --------------------------------------------------------------------------
GROQ_API_KEY = settings.groq_api_key
GROQ_MODEL = settings.groq_model
GROQ_FALLBACK_MODEL = settings.groq_fallback_model

OPENROUTER_API_KEY = settings.openrouter_api_key
OPENROUTER_MODEL = settings.openrouter_model
OPENROUTER_BASE_URL = settings.openrouter_base_url

EMBED_MODEL_NAME = settings.embed_model_name
EMBED_TRUST_REMOTE_CODE = settings.embed_trust_remote_code

CHROMA_PERSIST_DIR = settings.chroma_persist_dir
CHROMA_COLLECTION_NAME = settings.chroma_collection_name

CHUNK_SIZE = settings.chunk_size
CHUNK_OVERLAP = settings.chunk_overlap

TOP_K = settings.top_k
RERANK_FETCH_K = settings.rerank_fetch_k
RERANK_MODEL_NAME = settings.rerank_model_name

import os
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]

DOCS_DIR = Path(os.environ.get("DOCS_DIR", REPO / "docs"))
CHROMA_DIR = Path(os.environ.get("CHROMA_DIR", Path(__file__).resolve().parent / "chroma"))
COLLECTION = "resilience-docs"

OLLAMA_URL = os.environ.get("OLLAMA_URL", "http://localhost:11434")
LLM_MODEL = os.environ.get("LLM_MODEL", "qwen2.5:7b")
# Garde le modèle chargé en mémoire GPU : évite ~30 s de chargement à la première question d'une démo.
LLM_KEEP_ALIVE = int(os.environ.get("LLM_KEEP_ALIVE_S", 4 * 3600))  # secondes
# bge-m3 (multilingue) : sépare bien mieux les questions hors sujet en français que nomic-embed-text.
EMBED_MODEL = os.environ.get("EMBED_MODEL", "bge-m3")

TOP_K = int(os.environ.get("RAG_TOP_K", 4))
# En dessous de ce score de pertinence (cosinus, 0..1), un extrait n'est pas utilisé.
MIN_RELEVANCE = float(os.environ.get("RAG_MIN_RELEVANCE", 0.50))
ALLOWED_ORIGINS = [o for o in os.environ.get("ALLOWED_ORIGINS", "").split(",") if o]


def embeddings():
    """nomic-embed-text attend des préfixes de tâche ; sans eux les scores de pertinence se tassent
    et une question hors sujet obtient le même score qu'une vraie question."""
    from langchain_ollama import OllamaEmbeddings

    class NomicEmbeddings(OllamaEmbeddings):
        def embed_documents(self, texts):
            return super().embed_documents([f"search_document: {t}" for t in texts])

        def embed_query(self, text):
            return super().embed_query(f"search_query: {text}")

    cls = NomicEmbeddings if EMBED_MODEL.startswith("nomic-embed-text") else OllamaEmbeddings
    return cls(model=EMBED_MODEL, base_url=OLLAMA_URL, keep_alive=LLM_KEEP_ALIVE)

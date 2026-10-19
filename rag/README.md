# rag/ — Assistant opérateur local (Ollama + LangChain)

Responsable IA / Data : Léa. Modèle local ≤ 8B paramètres (WOR-55).

- Indexe procédures, architecture, PCA/PRA, docs de l'équipe (WOR-56)
- Aide à comprendre l'incident et à consulter les procédures
- **N'EST PAS** l'automate de remédiation, aucun accès privilégié sans contrôle (WOR-57)

L'index vectoriel (`vectorstore/`) est régénérable → non versionné (.gitignore).

## Mise en œuvre

- `assistant/ingest.py` indexe `docs/**/*.md|pdf` par section dans Chroma (`rag/vectorstore/`, non versionné).
- `assistant/app.py` : `POST /ask` (réponse + sources citées), `/health`, page de test sur `/`. Lecture seule, sans outil ; si aucun extrait n'est pertinent (score < 0,50), répond « je ne trouve rien » sans appeler le LLM.
- LLM `qwen2.5:7b` (7 Md de paramètres) ; embeddings `bge-m3` (multilingue, retenu car `nomic-embed-text` ne séparait pas les questions hors sujet en français). Modèles gardés en mémoire GPU 4 h (`LLM_KEEP_ALIVE_S`).

```bash
ollama pull qwen2.5:7b && ollama pull bge-m3
cd rag && uv sync
uv run python -m assistant.ingest                 # à relancer après chaque modification de docs/
uv run uvicorn assistant.app:app --port 8100      # page de test : http://localhost:8100
uv run pytest
```

En conteneur isolé (docs en lecture seule, FS read-only, sans socket Docker ni capabilities) : `docker compose -f rag/docker-compose.rag.yml up -d --build`. Ollama doit être joignable depuis le conteneur (`OLLAMA_URL`).

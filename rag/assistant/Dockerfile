# Contexte de build : rag/  (service `assistant` de infra/docker-compose.yml)
FROM python:3.12-slim@sha256:a6e34c598f2467ed0e9a8d349809fcd8b5c603269512df273a0bb1784edc11b1

COPY --from=ghcr.io/astral-sh/uv:0.13.1 /uv /usr/local/bin/uv
WORKDIR /app
COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev --no-install-project \
 && useradd --uid 10001 --create-home app \
 && mkdir -p /data && chown app /data   # volume nommé initialisé avec ce propriétaire (index Chroma)
COPY assistant ./assistant

ENV PATH="/app/.venv/bin:$PATH" \
    DOCS_DIR=/docs \
    CHROMA_DIR=/data/chroma \
    REPORTS_DIR=/reports \
    ANONYMIZED_TELEMETRY=False
USER app
EXPOSE 8100
# L'API démarre tout de suite ; elle indexe /docs en arrière-plan (dès qu'Ollama répond) puis suit
# les rapports d'incident de /reports (montés en lecture seule).
CMD ["uvicorn", "assistant.app:app", "--host", "0.0.0.0", "--port", "8100"]

# Contexte de build : ai/  (voir ai/docker-compose.ai.yml)
FROM python:3.12-slim@sha256:a6e34c598f2467ed0e9a8d349809fcd8b5c603269512df273a0bb1784edc11b1

COPY --from=ghcr.io/astral-sh/uv:0.13.1 /uv /usr/local/bin/uv
WORKDIR /app
COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev --no-install-project \
 && useradd --uid 10001 --create-home app
COPY assistant ./assistant

ENV PATH="/app/.venv/bin:$PATH" \
    DOCS_DIR=/docs \
    CHROMA_DIR=/data/chroma \
    ANONYMIZED_TELEMETRY=False
USER app
EXPOSE 8100
# L'index est reconstruit au démarrage depuis /docs (monté en lecture seule), puis l'API démarre.
CMD ["sh", "-c", "python -m assistant.ingest && uvicorn assistant.app:app --host 0.0.0.0 --port 8100"]

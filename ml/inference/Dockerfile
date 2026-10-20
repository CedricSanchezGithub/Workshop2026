# Service d'inférence ML (WOR-53). Contexte de build : ml/  (voir infra/docker-compose.yml)
FROM python:3.12-slim@sha256:a6e34c598f2467ed0e9a8d349809fcd8b5c603269512df273a0bb1784edc11b1

COPY --from=ghcr.io/astral-sh/uv:0.13.1 /uv /usr/local/bin/uv
WORKDIR /app
COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev --no-install-project && useradd --uid 10003 --no-create-home inference
COPY features ./features
COPY training ./training
COPY inference ./inference
COPY remediation_signing.py ./

ENV PATH="/app/.venv/bin:$PATH" PYTHONDONTWRITEBYTECODE=1
USER inference
EXPOSE 8095
CMD ["uvicorn", "inference.service:app", "--host", "0.0.0.0", "--port", "8095", "--log-level", "warning"]

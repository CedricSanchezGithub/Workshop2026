# payment-api (WOR-35) — image minimale, exécution non-root (durcissement WOR-63)
FROM python:3.12-slim

# N'écrit pas de .pyc, sort les logs sans tampon (utile pour Loki)
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app.py .

# Utilisateur non privilégié dédié
RUN useradd --system --no-create-home --uid 10001 appuser
USER appuser

EXPOSE 8080

CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8080", "--no-access-log"]

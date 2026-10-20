# face-recognition (WOR-95) — IA légère (InsightFace buffalo_s), exécution non-root (WOR-63)
FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    INSIGHTFACE_HOME=/opt/insightface

# build-essential : insightface compile quelques extensions ; libs runtime d'OpenCV.
RUN apt-get update && apt-get install -y --no-install-recommends \
        build-essential libglib2.0-0 libgl1 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Télécharge le modèle buffalo_s DANS l'image (fonctionnement hors ligne ensuite)
RUN python -c "from insightface.app import FaceAnalysis; FaceAnalysis(name='buffalo_s', root='/opt/insightface', providers=['CPUExecutionProvider']).prepare(ctx_id=-1)"

COPY app.py .

RUN useradd --system --no-create-home --uid 10002 faceuser \
    && mkdir -p /data && chown -R faceuser /data /opt/insightface
USER faceuser

EXPOSE 8080
CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8080", "--no-access-log"]

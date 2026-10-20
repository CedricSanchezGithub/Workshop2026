# Générateur de trafic légitime Pay&Go (service compose `legit-traffic`, profil `demo`).
FROM python:3.12-slim@sha256:a6e34c598f2467ed0e9a8d349809fcd8b5c603269512df273a0bb1784edc11b1

RUN pip install --no-cache-dir httpx==0.28.1 && useradd --uid 10002 --no-create-home traffic
COPY paygo.py /app/paygo.py
USER traffic
ENTRYPOINT ["python", "-u", "/app/paygo.py"]

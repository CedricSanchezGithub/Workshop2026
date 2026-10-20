"""Service d'inférence (WOR-53) : métriques/journaux → modèle → alertes signées vers la remédiation.

Toutes les STEP_S secondes : features de la fenêtre glissante de 60 s (features.extract, même code
que l'entraînement) → score de chaque famille → alerte après `consecutive` fenêtres anormales,
événement `resolved` après RESOLVE_AFTER fenêtres normales. Contrat :
docs/architecture/contrat-alerte-remediation.md.

    uv run uvicorn inference.service:app --port 8095
"""

import asyncio
import json
import logging
import os
import sys
import time
import uuid
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from pathlib import Path

import httpx
import joblib
import pandas as pd
from fastapi import FastAPI, Response
from prometheus_client import CONTENT_TYPE_LATEST, Counter, Gauge, generate_latest

from features import extract
from remediation_signing import sign

MODEL_PATH = Path(os.environ.get("MODEL_PATH", Path(__file__).parent / "models" / "detector.joblib"))
REMEDIATION_URL = os.environ.get("REMEDIATION_URL", "http://127.0.0.1:8090")
HMAC_KEY_FILE = Path(os.environ.get("REMEDIATION_HMAC_KEY_FILE",
                                    Path(__file__).resolve().parents[2] / "infra/secrets/remediation/hmac_key"))
RESOLVE_AFTER = int(os.environ.get("RESOLVE_AFTER", 3))
OFFENDER_MIN_SHARE = 0.2  # une IP est « source » si elle pèse au moins 20 % du trafic suspect

SCORE = Gauge("anomaly_score", "Score Isolation Forest de la dernière fenêtre (bas = anormal)", ["family"])
THRESHOLD = Gauge("anomaly_threshold", "Seuil Isolation Forest", ["family"])
ZRATIO = Gauge("anomaly_envelope_ratio", "Écart max à l'enveloppe normale (> 1 = hors enveloppe)", ["family"])
STATE = Gauge("anomaly_active", "Alerte en cours (1) ou non (0)", ["family"])
ALERTS = Counter("alerts_sent_total", "Alertes envoyées à la remédiation", ["type", "event", "outcome"])
ERRORS = Counter("inference_errors_total", "Erreurs de collecte ou d'envoi", ["stage"])

log = logging.getLogger("inference")
log.setLevel(logging.INFO)
log.addHandler(logging.StreamHandler(sys.stdout))

# Sources par type : requêtes Loki des IP dominantes sur la fenêtre.
OFFENDER_QUERIES = {
    "dos": f'topk(5, sum by (client_ip) (count_over_time({extract.API_HTTP} | client_ip != "127.0.0.1" | client_ip != "::1" [1m])))',
    "sqli": 'topk(5, sum by (client_ip) (count_over_time({container="waf"} |~ `^\\{"transaction"` |~ `"ruleId":"9[34][0-9]{4}"`'
            ' | json client_ip="transaction.client_ip" [1m])))',
}


def emit(event: str, **data) -> None:
    log.info(json.dumps({"ts": time.time(), "service": "ml-inference", "event": event, **data}, default=str))


class Detector:
    def __init__(self):
        bundle = joblib.load(MODEL_PATH)
        self.models = bundle["models"]
        self.consecutive = bundle["consecutive"]
        self.trained_at = bundle["trained_at"]
        self.state = {fam: {"streak": 0, "calm": 0, "active": False, "last": None} for fam in self.models}
        self.history: list[dict] = []
        self.last_error: str | None = None
        self.key = HMAC_KEY_FILE.read_bytes().strip()
        for fam, m in self.models.items():
            THRESHOLD.labels(fam).set(m.if_threshold)

    async def tick(self, http: httpx.AsyncClient) -> None:
        row = await asyncio.to_thread(extract.fetch_latest)
        frame = row.to_frame().T
        point = {"ts": int(row.name)}
        for fam, m in self.models.items():
            s = m.score(frame).iloc[0]
            st = self.state[fam]
            st["last"] = {"if_score": round(float(s.if_score), 4), "threshold": round(m.if_threshold, 4),
                          "z_max_ratio": round(float(s.z_max_ratio), 3), "anomaly": bool(s.anomaly),
                          "worst_feature": s.worst_feature, "ts": int(row.name)}
            SCORE.labels(fam).set(s.if_score)
            ZRATIO.labels(fam).set(s.z_max_ratio)
            point[fam] = {"if_score": st["last"]["if_score"], "z": st["last"]["z_max_ratio"], "anomaly": bool(s.anomaly)}

            if s.anomaly:
                st["streak"], st["calm"] = st["streak"] + 1, 0
            else:
                st["streak"], st["calm"] = 0, st["calm"] + 1

            if not st["active"] and st["streak"] >= self.consecutive:
                offenders = await self.offenders(http, m.incident_type)
                if await self.send(http, "alert", m, s, offenders, m.explain(row)):
                    st["active"] = True
            elif st["active"] and st["calm"] >= RESOLVE_AFTER:
                if await self.send(http, "resolved", m, s, [], {}):
                    st["active"] = False
            STATE.labels(fam).set(1 if st["active"] else 0)
        self.history = (self.history + [point])[-90:]

    async def offenders(self, http: httpx.AsyncClient, kind: str) -> list[str]:
        try:
            r = await http.get(f"{extract.LOKI_URL}/loki/api/v1/query",
                               params={"query": OFFENDER_QUERIES[kind], "time": time.time()})
            r.raise_for_status()
            counts = {s["metric"].get("client_ip"): float(s["value"][1]) for s in r.json()["data"]["result"]}
        except (httpx.HTTPError, KeyError, ValueError):
            ERRORS.labels("offenders").inc()
            return []
        total = sum(counts.values()) or 1
        return [ip for ip, c in sorted(counts.items(), key=lambda x: -x[1]) if ip and c / total >= OFFENDER_MIN_SHARE]

    async def send(self, http, event, m, s, offenders, top) -> bool:
        body = json.dumps({
            "id": uuid.uuid4().hex, "ts": datetime.now(timezone.utc).isoformat(), "event": event,
            "type": m.incident_type, "family": m.family, "score": round(float(s.if_score), 4),
            "threshold": round(m.if_threshold, 4), "target": "payment-api", "offenders": offenders,
            "top_features": top, "window_s": extract.WINDOW_S,
        }).encode()
        try:
            r = await http.post(f"{REMEDIATION_URL}/alerts", content=body,
                                headers={"Content-Type": "application/json", "X-Signature": sign(self.key, body)})
            ok = r.status_code == 202
        except httpx.HTTPError as e:
            ok, r = False, None
            self.last_error = f"remédiation injoignable : {type(e).__name__}"
        ALERTS.labels(m.incident_type, event, "ok" if ok else "error").inc()
        emit(f"alert_{event}", type=m.incident_type, family=m.family, offenders=offenders, top_features=top,
             score=round(float(s.if_score), 4), delivered=ok, status=r.status_code if r is not None else None)
        return ok


detector: Detector | None = None


async def loop() -> None:
    async with httpx.AsyncClient(timeout=5) as http:
        while True:
            started = time.monotonic()
            try:
                await detector.tick(http)
                detector.last_error = None
            except Exception as e:  # une fenêtre ratée ne doit pas arrêter la détection
                ERRORS.labels("tick").inc()
                detector.last_error = repr(e)[:200]
                emit("tick_error", error=detector.last_error)
            await asyncio.sleep(max(0.5, extract.STEP_S - (time.monotonic() - started)))


@asynccontextmanager
async def lifespan(_app: FastAPI):
    global detector
    detector = Detector()
    emit("started", model=str(MODEL_PATH), families=list(detector.models), remediation=REMEDIATION_URL)
    task = asyncio.create_task(loop())
    yield
    task.cancel()


app = FastAPI(title="Détection d'anomalies RESILIENCE-ALPHA", docs_url=None, redoc_url=None, lifespan=lifespan)


@app.get("/status")
async def status():
    return {"trained_at": detector.trained_at, "consecutive": detector.consecutive, "error": detector.last_error,
            "families": {fam: {"type": m.incident_type, "active": detector.state[fam]["active"],
                               "streak": detector.state[fam]["streak"], **(detector.state[fam]["last"] or {})}
                         for fam, m in detector.models.items()},
            "history": detector.history}


@app.get("/health")
async def health():
    return {"status": "ok"}


@app.get("/metrics")
async def metrics():
    return Response(generate_latest(), media_type=CONTENT_TYPE_LATEST)

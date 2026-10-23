"""API du moteur de remédiation.

- POST /alerts        : alertes signées du détecteur (seule entrée qui déclenche une action)
- GET  /api/state     : état pour le dashboard (bandeau, composants, incidents, sonde, détecteur)
- GET  /api/events    : flux temps réel (SSE)
- POST /api/probe     : lance une transaction de test (lecture seule pour la plateforme)
- GET  /health, /metrics ; / : dashboard (services/dashboard/dist)
"""

import asyncio
import json
import time
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import FileResponse, Response, StreamingResponse
from fastapi.staticfiles import StaticFiles
from prometheus_client import CONTENT_TYPE_LATEST, Counter, Gauge, Histogram, generate_latest
from pydantic import ValidationError

from remediation import config, reports, signing
from remediation.engine import TERMINAL, Engine
from remediation.events import EventBus
from remediation.models import Alert
from remediation.monitor import Monitor
from remediation.probe import Probe

ALERTS = Counter("remediation_alerts_total", "Alertes reçues", ["outcome"])
INCIDENTS = Counter("remediation_incidents_total", "Incidents clos", ["type", "outcome"])
DURATION = Histogram("remediation_duration_seconds", "Durée détection → service rétabli", ["type"],
                     buckets=(5, 10, 15, 20, 30, 45, 60, 90, 120, 180))
PROBE_OK = Gauge("remediation_probe_ok", "Dernière transaction de test réussie (1) ou non (0)")
RESTORED_WINDOW_S = 60  # bandeau « SERVICE RÉTABLI » affiché pendant 60 s après la reprise

bus = EventBus(config.EVENTS_FILE)
probe = Probe()
engine = Engine(bus, probe)
monitor = Monitor(bus, probe)
replay = signing.ReplayGuard()
_hmac_key: bytes | None = None


def hmac_key() -> bytes:
    global _hmac_key
    if _hmac_key is None:
        try:
            _hmac_key = config.HMAC_KEY_FILE.read_bytes().strip()
        except OSError:
            raise HTTPException(503, "clé HMAC absente : lancer ansible deploy.yml")
    return _hmac_key


def _on_event(event: dict) -> None:
    if event["event"] in ("incident_resolved", "escalation"):
        inc = next((i for i in engine.incidents if i.id == event["incident"]), None)
        if inc:
            outcome = "resolved" if event["event"] == "incident_resolved" else "failed"
            INCIDENTS.labels(inc.type, outcome).inc()
            if outcome == "resolved":
                DURATION.labels(inc.type).observe(inc.resolved_at - inc.detected_at)
    if event["event"] == "probe":
        PROBE_OK.set(1 if event["ok"] else 0)


bus.listeners.append(_on_event)


def _write_report(event: dict) -> None:
    """Rapport Markdown pour l'assistant RAG : à la clôture d'un incident, à la fin des symptômes
    (réécriture) et pour chaque alerte ignorée. Une erreur d'écriture ne doit jamais gêner la reprise."""
    try:
        if event["event"] == "alert_suppressed":
            reports.write_suppressed(event)
        elif event["event"] in ("incident_resolved", "escalation", "detector_resolved"):
            inc = next((i for i in engine.incidents if i.id == event["incident"]), None)
            if inc and inc.state in TERMINAL:
                reports.write_incident(inc.to_dict())
    except Exception as e:
        print(json.dumps({"ts": time.time(), "service": "remediation", "event": "report_error",
                          "error": repr(e)}), flush=True)


bus.listeners.append(_write_report)


_monitor_task: asyncio.Task | None = None


@asynccontextmanager
async def lifespan(_app: FastAPI):
    # Plusieurs adresses d'écoute = plusieurs serveurs uvicorn sur la même application :
    # la surveillance ne doit démarrer qu'une fois.
    global _monitor_task
    if _monitor_task is None:
        _monitor_task = asyncio.create_task(monitor.run())
        bus.emit("engine_started", waf=config.WAF_URL, bind=config.BIND_HOSTS)
    yield


app = FastAPI(title="Moteur de remédiation RESILIENCE-ALPHA", docs_url=None, redoc_url=None, lifespan=lifespan)


@app.post("/alerts", status_code=202)
async def alerts(request: Request):
    body = await request.body()
    if not signing.verify_signature(hmac_key(), body, request.headers.get("x-signature")):
        ALERTS.labels("bad_signature").inc()
        bus.emit("alert_rejected", reason="signature invalide", client=request.client.host if request.client else "?")
        raise HTTPException(401, "signature invalide")
    try:
        alert = Alert.model_validate_json(body)
    except ValidationError as e:
        ALERTS.labels("invalid").inc()
        raise HTTPException(422, json.loads(e.json()))
    if not signing.is_fresh(alert.ts, config.ALERT_MAX_AGE_S):
        ALERTS.labels("stale").inc()
        raise HTTPException(409, "alerte trop ancienne")
    if not replay.check_and_add(alert.id):
        ALERTS.labels("replay").inc()
        raise HTTPException(409, "alerte déjà reçue")
    ALERTS.labels("accepted").inc()
    bus.emit("alert_received", alert_id=alert.id, alert_event=alert.event, type=alert.type, score=alert.score,
             offenders=alert.offenders)
    inc = engine.handle(alert)
    return {"accepted": True, "incident": inc.id if inc else None}


def banner() -> dict:
    """Bandeau du dashboard : l'état du service lisible en une seconde (Clip Chrono)."""
    now = time.time()
    active = [i for i in engine.incidents if i.state not in TERMINAL]
    if active:
        inc = active[-1]
        recovering = inc.state in ("acting", "verifying")
        return {"state": "recovering" if recovering else "incident", "incident": inc.id, "type": inc.type,
                "since": inc.detected_at}
    last = engine.incidents[-1] if engine.incidents else None
    if last and last.state == "failed":
        return {"state": "failed", "incident": last.id, "type": last.type, "since": last.resolved_at}
    if last and last.resolved_at and now - last.resolved_at < RESTORED_WINDOW_S:
        return {"state": "restored", "incident": last.id, "type": last.type, "since": last.resolved_at,
                "duration_s": round(last.resolved_at - last.detected_at, 1)}
    tx = monitor.last_transaction
    if tx is not None and not tx["ok"]:
        return {"state": "degraded", "since": tx["at"]}
    return {"state": "normal"}


@app.get("/api/state")
async def state():
    return {
        "now": time.time(),
        "banner": banner(),
        "components": monitor.components,
        "last_transaction": monitor.last_transaction,
        "availability": monitor.history,
        "detector": monitor.detector,
        "incidents": [i.to_dict() for i in reversed(engine.incidents[-10:])],
        "events": list(bus.history)[-40:],
    }


@app.get("/api/events")
async def events(request: Request):
    q = bus.subscribe()

    async def stream():
        try:
            yield "retry: 2000\n\n"
            while not await request.is_disconnected():
                try:
                    event = await asyncio.wait_for(q.get(), 15)
                    yield f"data: {json.dumps(event, ensure_ascii=False, default=str)}\n\n"
                except asyncio.TimeoutError:
                    yield ": keepalive\n\n"
        finally:
            bus.unsubscribe(q)

    return StreamingResponse(stream(), media_type="text/event-stream", headers={"Cache-Control": "no-cache"})


@app.post("/api/probe")
async def run_probe():
    return await monitor.transaction()


@app.get("/health")
async def health():
    return {"status": "ok", "hmac_key": config.HMAC_KEY_FILE.exists()}


@app.get("/metrics")
async def metrics():
    return Response(generate_latest(), media_type=CONTENT_TYPE_LATEST)


if config.DASHBOARD_DIR.exists():
    app.mount("/assets", StaticFiles(directory=config.DASHBOARD_DIR / "assets"), name="assets")

    @app.get("/")
    async def dashboard():
        return FileResponse(config.DASHBOARD_DIR / "index.html")

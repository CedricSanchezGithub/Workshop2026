"""face-recognition — IA légère de reconnaissance faciale (WOR-95).

Service interne appelé par le back-office pour confirmer l'identité après la saisie
de l'identifiant (consigne additionnelle 1). Embeddings faciaux via **InsightFace**
(modèle `buffalo_s`, léger, CPU, hors ligne une fois l'image construite).

Minimisation des données (RGPD, WOR-101) : on ne stocke **que des embeddings**
(vecteurs 512-d), jamais les images brutes de la caméra.
"""
from __future__ import annotations

import json
import logging
import os
import sys
import time

import cv2
import numpy as np
from fastapi import FastAPI, File, Form, UploadFile
from fastapi.responses import JSONResponse, PlainTextResponse
from insightface.app import FaceAnalysis
from prometheus_client import CONTENT_TYPE_LATEST, Counter, Histogram, generate_latest

DATA_DIR = os.environ.get("FACE_DATA_DIR", "/data")
EMB_DIR = os.path.join(DATA_DIR, "embeddings")        # <user>.npy : matrice N x 512
MODEL = os.environ.get("FACE_MODEL", "buffalo_s")
# Seuil de similarité cosinus : au-dessus => reconnu. Même personne ~>0.5, autre <~0.3.
THRESHOLD = float(os.environ.get("FACE_THRESHOLD", "0.40"))


class JsonFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        p = {"ts": time.strftime("%Y-%m-%dT%H:%M:%S%z", time.localtime(record.created)),
             "level": record.levelname.lower(), "service": "face-recognition",
             "msg": record.getMessage()}
        if hasattr(record, "extra"):
            p.update(record.extra)  # type: ignore[attr-defined]
        return json.dumps(p, separators=(",", ":"))


_h = logging.StreamHandler(sys.stdout)
_h.setFormatter(JsonFormatter())
log = logging.getLogger("face")
log.setLevel(logging.INFO)
log.addHandler(_h)
log.propagate = False

ENROLL = Counter("face_enroll_total", "Enrôlements", ["result"])
VERIFY = Counter("face_verify_total", "Vérifications", ["result"])
LATENCY = Histogram("face_op_duration_seconds", "Durée des opérations", ["op"])

_fa: FaceAnalysis | None = None


def _embed(data: bytes) -> np.ndarray | None:
    """Décode l'image, prend le plus grand visage, renvoie l'embedding normalisé (L2)."""
    arr = np.frombuffer(data, np.uint8)
    img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    if img is None or _fa is None:
        return None
    faces = _fa.get(img)
    if not faces:
        return None
    face = max(faces, key=lambda f: (f.bbox[2] - f.bbox[0]) * (f.bbox[3] - f.bbox[1]))
    emb = np.asarray(face.embedding, dtype=np.float32)
    norm = np.linalg.norm(emb)
    return emb / norm if norm > 0 else None


def _path(user: str) -> str:
    safe = "".join(c for c in user if c.isalnum() or c in "._-")
    return os.path.join(EMB_DIR, f"{safe}.npy")


def _load(user: str) -> np.ndarray | None:
    try:
        return np.load(_path(user))
    except OSError:
        return None


app = FastAPI(title="face-recognition")


@app.on_event("startup")
def _startup() -> None:
    global _fa
    os.makedirs(EMB_DIR, exist_ok=True)
    root = os.environ.get("INSIGHTFACE_HOME", "/opt/insightface")
    _fa = FaceAnalysis(name=MODEL, root=root, providers=["CPUExecutionProvider"])
    _fa.prepare(ctx_id=-1, det_size=(640, 640))
    log.info("startup", extra={"extra": {"model": MODEL, "users": len(_users())}})


def _users() -> list[str]:
    try:
        return sorted(f[:-4] for f in os.listdir(EMB_DIR) if f.endswith(".npy"))
    except OSError:
        return []


@app.get("/health")
def health():
    return {"status": "ok" if _fa is not None else "degraded", "users": len(_users())}


@app.post("/enroll")
async def enroll(user: str = Form(...), image: UploadFile = File(...)):
    with LATENCY.labels("enroll").time():
        emb = _embed(await image.read())
        if emb is None:
            ENROLL.labels("no_face").inc()
            return JSONResponse({"error": "no_face_detected"}, status_code=422)
        existing = _load(user)
        stack = np.vstack([existing, emb]) if existing is not None else emb[None, :]
        np.save(_path(user), stack)
    ENROLL.labels("ok").inc()
    log.info("enroll", extra={"extra": {"user": user, "samples": int(stack.shape[0])}})
    return {"status": "enrolled", "user": user, "samples": int(stack.shape[0])}


@app.post("/verify")
async def verify(user: str = Form(...), image: UploadFile = File(...)):
    with LATENCY.labels("verify").time():
        stored = _load(user)
        if stored is None:
            VERIFY.labels("unknown_user").inc()
            return {"match": False, "reason": "user_not_enrolled", "user": user}
        emb = _embed(await image.read())
        if emb is None:
            VERIFY.labels("no_face").inc()
            return JSONResponse({"match": False, "reason": "no_face_detected"}, status_code=422)
        # similarité au prototype (moyenne des embeddings enrôlés)
        proto = stored.mean(axis=0)
        proto = proto / (np.linalg.norm(proto) or 1.0)
        score = float(np.dot(proto, emb))
        matched = score >= THRESHOLD
    VERIFY.labels("match" if matched else "no_match").inc()
    log.info("verify", extra={"extra": {
        "user": user, "match": matched, "score": round(score, 3)}})
    return {"match": bool(matched), "user": user, "score": round(score, 3),
            "threshold": THRESHOLD}


@app.get("/users")
def users():
    return {"users": _users()}


@app.delete("/users/{user}")
def delete_user(user: str):
    """Suppression (RGPD) : retire les embeddings de l'utilisateur."""
    try:
        os.remove(_path(user))
    except OSError:
        pass
    log.info("delete", extra={"extra": {"user": user}})
    return {"status": "deleted", "user": user}


@app.get("/metrics")
def metrics():
    return PlainTextResponse(generate_latest(), media_type=CONTENT_TYPE_LATEST)

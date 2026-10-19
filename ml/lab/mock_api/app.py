"""API de paiement fictive du labo IA.

Sert uniquement à produire des métriques et des journaux réalistes pour
entraîner le détecteur. Elle n'est pas publiée directement : tout le trafic
passe par le WAF. Aucune donnée bancaire réelle.
"""

import json
import logging
import os
import random
import secrets
import sqlite3
import sys
import time
import uuid
from contextlib import closing

from fastapi import Depends, FastAPI, Header, HTTPException, Request, Response
from prometheus_client import CONTENT_TYPE_LATEST, Counter, Histogram, generate_latest
from pydantic import BaseModel, Field

DB_PATH = os.environ.get("DB_PATH", "/data/payments.db")
TOKEN_TTL_S = 3600

log = logging.getLogger("payment-api")
log.setLevel(logging.INFO)
log.addHandler(logging.StreamHandler(sys.stdout))

REQUESTS = Counter("http_requests_total", "Requêtes HTTP", ["method", "route", "status"])
LATENCY = Histogram("http_request_duration_seconds", "Latence HTTP", ["route"],
                    buckets=(.005, .01, .025, .05, .1, .25, .5, 1, 2.5, 5, 10))
RESP_BYTES = Counter("http_response_bytes_total", "Octets renvoyés", ["route"])
REQ_BYTES = Histogram("http_request_bytes", "Taille des requêtes (URL + corps)", ["route"],
                      buckets=(64, 128, 256, 512, 1024, 2048, 4096, 16384))
PAYMENTS = Counter("payments_total", "Transactions traitées", ["status"])
LOGIN_FAIL = Counter("login_failures_total", "Échecs d'authentification")
DB_ERRORS = Counter("db_errors_total", "Erreurs base de données")

app = FastAPI(title="Mock Payment API (labo IA)", docs_url=None, redoc_url=None)
TOKENS: dict[str, tuple[str, float]] = {}


def db() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH, timeout=5)
    conn.row_factory = sqlite3.Row
    return conn


def init_db() -> None:
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    with closing(db()) as conn, conn:
        conn.executescript("""
            CREATE TABLE IF NOT EXISTS users (username TEXT PRIMARY KEY, password TEXT NOT NULL);
            CREATE TABLE IF NOT EXISTS accounts (id TEXT PRIMARY KEY, owner TEXT NOT NULL, balance_cents INTEGER NOT NULL);
            CREATE TABLE IF NOT EXISTS payments (
                id TEXT PRIMARY KEY, src TEXT NOT NULL, dst TEXT NOT NULL, amount_cents INTEGER NOT NULL,
                label TEXT, status TEXT NOT NULL, created_at REAL NOT NULL);
        """)
        if conn.execute("SELECT COUNT(*) FROM users").fetchone()[0] == 0:
            # Comptes fictifs du labo ; mots de passe de démo, sans valeur hors labo.
            for i in range(1, 51):
                conn.execute("INSERT INTO users VALUES (?, ?)", (f"client{i:02d}", f"demo-{i:02d}"))
                conn.execute("INSERT INTO accounts VALUES (?, ?, ?)", (f"FR-LAB-{i:04d}", f"client{i:02d}", 500_000))


init_db()


def client_ip(request: Request) -> str:
    # L'API n'est joignable que via le WAF, qui fixe X-Real-IP.
    return request.headers.get("x-real-ip") or (request.client.host if request.client else "-")


def route_of(request: Request) -> str:
    r = request.scope.get("route")
    return getattr(r, "path", "unmatched")


@app.middleware("http")
async def observe(request: Request, call_next):
    start = time.perf_counter()
    body = await request.body()
    status, size = 500, 0
    try:
        response = await call_next(request)
        status = response.status_code
        size = int(response.headers.get("content-length", 0))
        return response
    finally:
        route = route_of(request)
        dur = time.perf_counter() - start
        if route != "/metrics":
            REQUESTS.labels(request.method, route, str(status)).inc()
            LATENCY.labels(route).observe(dur)
            RESP_BYTES.labels(route).inc(size)
            REQ_BYTES.labels(route).observe(len(str(request.url)) + len(body))
            log.info(json.dumps({
                "ts": time.time(), "event": "http", "client_ip": client_ip(request),
                "method": request.method, "route": route, "path": request.url.path,
                "query_len": len(request.url.query), "body_len": len(body), "status": status,
                "latency_ms": round(dur * 1000, 2), "resp_bytes": size,
                "ua": request.headers.get("user-agent", "")[:120],
            }))


class LoginIn(BaseModel):
    username: str = Field(max_length=64)
    password: str = Field(max_length=128)


class PaymentIn(BaseModel):
    dst: str = Field(max_length=32)
    amount_cents: int = Field(gt=0, le=1_000_000)
    label: str = Field(default="", max_length=140)


def current_user(authorization: str = Header(default="")) -> str:
    token = authorization.removeprefix("Bearer ").strip()
    entry = TOKENS.get(token)
    if not entry or entry[1] < time.time():
        raise HTTPException(401, "jeton invalide")
    return entry[0]


@app.post("/login")
def login(body: LoginIn, request: Request):
    with closing(db()) as conn:
        row = conn.execute("SELECT password FROM users WHERE username = ?", (body.username,)).fetchone()
    if not row or not secrets.compare_digest(row["password"], body.password):
        LOGIN_FAIL.inc()
        log.info(json.dumps({"ts": time.time(), "event": "login_failed", "client_ip": client_ip(request),
                             "username": body.username}))
        raise HTTPException(401, "identifiants invalides")
    token = secrets.token_urlsafe(24)
    TOKENS[token] = (body.username, time.time() + TOKEN_TTL_S)
    return {"token": token, "expires_in": TOKEN_TTL_S}


@app.post("/payments", status_code=201)
def create_payment(body: PaymentIn, user: str = Depends(current_user)):
    pid = str(uuid.uuid4())
    try:
        with closing(db()) as conn, conn:
            src = conn.execute("SELECT id, balance_cents FROM accounts WHERE owner = ?", (user,)).fetchone()
            dst = conn.execute("SELECT id FROM accounts WHERE id = ?", (body.dst,)).fetchone()
            if not dst:
                PAYMENTS.labels("rejected").inc()
                raise HTTPException(404, "compte destinataire inconnu")
            if src["balance_cents"] < body.amount_cents:
                PAYMENTS.labels("rejected").inc()
                raise HTTPException(409, "solde insuffisant")
            # Simule le temps de traitement d'un processeur de paiement.
            time.sleep(random.uniform(0.01, 0.06))
            conn.execute("UPDATE accounts SET balance_cents = balance_cents - ? WHERE id = ?", (body.amount_cents, src["id"]))
            conn.execute("UPDATE accounts SET balance_cents = balance_cents + ? WHERE id = ?", (body.amount_cents, body.dst))
            conn.execute("INSERT INTO payments VALUES (?, ?, ?, ?, ?, 'accepted', ?)",
                         (pid, src["id"], body.dst, body.amount_cents, body.label, time.time()))
    except sqlite3.Error:
        DB_ERRORS.inc()
        PAYMENTS.labels("error").inc()
        raise HTTPException(503, "base indisponible")
    PAYMENTS.labels("accepted").inc()
    return {"id": pid, "status": "accepted"}


@app.get("/payments")
def list_payments(q: str = "", limit: int = 20, user: str = Depends(current_user)):
    limit = max(1, min(limit, 100))
    with closing(db()) as conn:
        rows = conn.execute(
            """SELECT p.id, p.dst, p.amount_cents, p.label, p.status, p.created_at FROM payments p
               JOIN accounts a ON a.id = p.src WHERE a.owner = ? AND p.label LIKE ?
               ORDER BY p.created_at DESC LIMIT ?""", (user, f"%{q}%", limit)).fetchall()
    return [dict(r) for r in rows]


@app.get("/payments/{pid}")
def get_payment(pid: str, user: str = Depends(current_user)):
    with closing(db()) as conn:
        row = conn.execute(
            """SELECT p.* FROM payments p JOIN accounts a ON a.id = p.src
               WHERE p.id = ? AND a.owner = ?""", (pid, user)).fetchone()
    if not row:
        raise HTTPException(404, "transaction inconnue")
    return dict(row)


@app.get("/health")
def health():
    """Santé métier : la base répond et les comptes sont lisibles (pas seulement « process up »)."""
    try:
        with closing(db()) as conn:
            n = conn.execute("SELECT COUNT(*) FROM accounts").fetchone()[0]
    except sqlite3.Error:
        DB_ERRORS.inc()
        raise HTTPException(503, "base indisponible")
    return {"status": "ok", "accounts": n}


@app.get("/metrics")
def metrics():
    return Response(generate_latest(), media_type=CONTENT_TYPE_LATEST)

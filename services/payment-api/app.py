"""payment-api — API métier de paiement (WOR-35).

Scaffold minimal mais FONCTIONNEL, pour débloquer la chaîne
attaque -> détection -> remédiation -> reprise :

- expose /metrics (Prometheus) et des logs JSON sur stdout (Loki) — WOR-37, contrat WOR-29 ;
- healthcheck métier réel (/health vérifie la base) ;
- invariant d'intégrité (somme des soldes constante) pour la preuve de reprise du scénario B.

Logique métier volontairement réduite : les comptes et transactions sont fictifs.
"""
from __future__ import annotations

import json
import logging
import os
import sys
import time
import uuid
from contextlib import asynccontextmanager

import psycopg
from psycopg_pool import ConnectionPool
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse, PlainTextResponse
from pydantic import BaseModel, Field
from prometheus_client import (
    CONTENT_TYPE_LATEST,
    Counter,
    Gauge,
    Histogram,
    generate_latest,
)

# --- Configuration ----------------------------------------------------------
DB_HOST = os.environ.get("POSTGRES_HOST", "postgres")
DB_NAME = os.environ.get("POSTGRES_DB", "payments")
DB_USER = os.environ.get("POSTGRES_USER", "payments")
PW_FILE = os.environ.get("POSTGRES_PASSWORD_FILE", "/run/secrets/postgres/password")
# Solde total initial (invariant d'intégrité, scénario B)
SEED_ACCOUNTS = {"alice": 1000, "bob": 1000, "carol": 1000}
TOTAL_INVARIANT = sum(SEED_ACCOUNTS.values())

# --- Journalisation JSON (stdout -> Loki) -----------------------------------
class JsonFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        payload = {
            "ts": time.strftime("%Y-%m-%dT%H:%M:%S%z", time.localtime(record.created)),
            "level": record.levelname.lower(),
            "service": "payment-api",
            "msg": record.getMessage(),
        }
        if hasattr(record, "extra"):
            payload.update(record.extra)  # type: ignore[attr-defined]
        return json.dumps(payload, separators=(",", ":"))


_handler = logging.StreamHandler(sys.stdout)
_handler.setFormatter(JsonFormatter())
log = logging.getLogger("payment-api")
log.setLevel(logging.INFO)
log.addHandler(_handler)
log.propagate = False

# --- Métriques Prometheus (contrat WOR-29) ----------------------------------
HTTP_REQUESTS = Counter(
    "http_requests_total", "Requêtes HTTP", ["method", "path", "status"]
)
HTTP_LATENCY = Histogram(
    "http_request_duration_seconds", "Latence HTTP", ["method", "path"]
)
PAYMENTS = Counter("payments_total", "Transactions traitées", ["status"])
BALANCE_SUM = Gauge("accounts_balance_sum", "Somme des soldes (invariant d'intégrité)")

pool: ConnectionPool | None = None


def _password() -> str:
    try:
        with open(PW_FILE, encoding="utf-8") as f:
            return f.read().strip()
    except OSError:
        return os.environ.get("POSTGRES_PASSWORD", "")


def _conninfo() -> str:
    return (
        f"host={DB_HOST} dbname={DB_NAME} user={DB_USER} "
        f"password={_password()} connect_timeout=5"
    )


def _init_db() -> None:
    """Crée le schéma et sème des comptes fictifs (idempotent)."""
    assert pool is not None
    with pool.connection() as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS accounts (
                id      TEXT PRIMARY KEY,
                balance NUMERIC NOT NULL CHECK (balance >= 0)
            );
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS payments (
                id         BIGSERIAL PRIMARY KEY,
                src        TEXT NOT NULL,
                dst        TEXT NOT NULL,
                amount     NUMERIC NOT NULL,
                status     TEXT NOT NULL,
                created_at TIMESTAMPTZ NOT NULL DEFAULT now()
            );
            """
        )
        for acc, bal in SEED_ACCOUNTS.items():
            conn.execute(
                "INSERT INTO accounts (id, balance) VALUES (%s, %s) "
                "ON CONFLICT (id) DO NOTHING;",
                (acc, bal),
            )
        conn.commit()


@asynccontextmanager
async def lifespan(_: FastAPI):
    global pool
    # Postgres peut mettre quelques secondes à accepter les connexions au boot
    last_err: Exception | None = None
    for _attempt in range(30):
        try:
            pool = ConnectionPool(_conninfo(), min_size=1, max_size=8, open=True)
            _init_db()
            last_err = None
            break
        except Exception as exc:  # noqa: BLE001 — on réessaie quelle que soit l'erreur
            last_err = exc
            if pool is not None:
                pool.close()
                pool = None
            time.sleep(2)
    if last_err is not None:
        log.error("db-init-failed", extra={"extra": {"error": str(last_err)}})
    yield
    if pool is not None:
        pool.close()


app = FastAPI(title="payment-api", lifespan=lifespan)


@app.middleware("http")
async def observe(request: Request, call_next):
    start = time.perf_counter()
    rid = request.headers.get("x-request-id", uuid.uuid4().hex[:12])
    # Derrière le WAF, l'IP réelle est dans X-Forwarded-For
    client_ip = (request.headers.get("x-forwarded-for", "") or
                 (request.client.host if request.client else "")).split(",")[0].strip()
    try:
        response = await call_next(request)
        status = response.status_code
    except Exception:  # noqa: BLE001
        status = 500
        raise
    finally:
        dur = time.perf_counter() - start
        path = request.url.path
        HTTP_REQUESTS.labels(request.method, path, str(status)).inc()
        HTTP_LATENCY.labels(request.method, path).observe(dur)
        log.info(
            "request",
            extra={"extra": {
                "method": request.method, "path": path, "status": status,
                "duration_ms": round(dur * 1000, 1), "client_ip": client_ip,
                "request_id": rid,
            }},
        )
    return response


class PaymentIn(BaseModel):
    src: str = Field(min_length=1, max_length=64)
    dst: str = Field(min_length=1, max_length=64)
    amount: float = Field(gt=0)


@app.get("/")
def root():
    return {"service": "payment-api", "status": "ok"}


@app.get("/health")
def health():
    if pool is None:
        return JSONResponse({"status": "degraded", "db": "down"}, status_code=503)
    try:
        with pool.connection() as conn:
            conn.execute("SELECT 1;")
        return {"status": "ok", "db": "up"}
    except Exception as exc:  # noqa: BLE001
        return JSONResponse({"status": "degraded", "error": str(exc)}, status_code=503)


@app.post("/pay")
def pay(tx: PaymentIn):
    """Débite src, crédite dst dans une transaction (invariant de somme préservé)."""
    if pool is None:
        PAYMENTS.labels("error").inc()
        return JSONResponse({"status": "error", "reason": "db down"}, status_code=503)
    try:
        with pool.connection() as conn:
            with conn.transaction():
                row = conn.execute(
                    "SELECT balance FROM accounts WHERE id = %s FOR UPDATE;", (tx.src,)
                ).fetchone()
                if row is None or row[0] < tx.amount:
                    conn.execute(
                        "INSERT INTO payments (src, dst, amount, status) "
                        "VALUES (%s, %s, %s, 'rejected');",
                        (tx.src, tx.dst, tx.amount),
                    )
                    PAYMENTS.labels("rejected").inc()
                    return JSONResponse(
                        {"status": "rejected", "reason": "compte inconnu ou solde insuffisant"},
                        status_code=422,
                    )
                conn.execute(
                    "UPDATE accounts SET balance = balance - %s WHERE id = %s;",
                    (tx.amount, tx.src),
                )
                conn.execute(
                    "UPDATE accounts SET balance = balance + %s WHERE id = %s;",
                    (tx.amount, tx.dst),
                )
                conn.execute(
                    "INSERT INTO payments (src, dst, amount, status) "
                    "VALUES (%s, %s, %s, 'accepted');",
                    (tx.src, tx.dst, tx.amount),
                )
        PAYMENTS.labels("accepted").inc()
        return {"status": "accepted", "src": tx.src, "dst": tx.dst, "amount": tx.amount}
    except Exception as exc:  # noqa: BLE001
        PAYMENTS.labels("error").inc()
        return JSONResponse({"status": "error", "reason": str(exc)}, status_code=500)


@app.get("/integrity")
def integrity():
    """Preuve d'intégrité (scénario B) : la somme des soldes doit rester constante."""
    if pool is None:
        return JSONResponse({"status": "degraded"}, status_code=503)
    with pool.connection() as conn:
        total = conn.execute("SELECT COALESCE(SUM(balance), 0) FROM accounts;").fetchone()[0]
    total = float(total)
    BALANCE_SUM.set(total)
    return {"balance_sum": total, "expected": TOTAL_INVARIANT, "intact": total == TOTAL_INVARIANT}


@app.get("/metrics")
def metrics():
    return PlainTextResponse(generate_latest(), media_type=CONTENT_TYPE_LATEST)

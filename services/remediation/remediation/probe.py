"""Sonde métier : preuve que le service est réellement utilisable, pas seulement « conteneur up ».

Parcours complet à travers le WAF, comme un client : santé → connexion du compte sonde →
création d'une intention de paiement (réservation booking_1) → validation du code 3-D Secure de
démo → paiement « succeeded ». C'est la « nouvelle transaction fictive réussie » exigée par le sujet.
"""

import asyncio
import secrets
import time
import uuid
from dataclasses import asdict, dataclass, field

import httpx

from remediation import config

BOOKING = {"bookingId": "booking_1", "amountCents": 3900, "currency": "EUR"}


async def _set_host(request: httpx.Request) -> None:
    # Host = nom du serveur du WAF : avec une IP en Host (127.0.0.1:8081), la règle CRS 920350 se
    # déclenche à chaque sonde et pollue les audits utilisés par le détecteur. httpx recalcule Host
    # depuis l'URL : on le remplace juste avant l'envoi.
    request.headers["Host"] = "resilience-alpha"


@dataclass
class ProbeResult:
    ok: bool
    stage: str  # dernière étape atteinte : health, login, intent, verify, settle, done
    duration_ms: int
    status_code: int | None = None
    payment_id: str | None = None
    detail: str = ""
    at: float = field(default_factory=time.time)

    def to_dict(self) -> dict:
        return asdict(self)


class Probe:
    """Compte sonde créé à la volée : payment-api est en mémoire, un redémarrage l'efface."""

    def __init__(self, base_url: str | None = None, transport: httpx.AsyncBaseTransport | None = None):
        self.base_url = base_url or config.WAF_URL
        self.transport = transport
        self.email = f"sonde-remediation-{secrets.token_hex(4)}@resilience.local"
        self.password = secrets.token_urlsafe(18)
        self.token: str | None = None
        self.last: ProbeResult | None = None

    def _client(self) -> httpx.AsyncClient:
        return httpx.AsyncClient(base_url=self.base_url, timeout=5, transport=self.transport,
                                 headers={"User-Agent": "resilience-remediation-probe/1.0"},
                                 event_hooks={"request": [_set_host]})

    async def health(self) -> ProbeResult:
        start = time.monotonic()
        try:
            async with self._client() as http:
                r = await http.get("/health")
            ok = r.status_code == 200 and r.json().get("status") == "ok"
            return self._done(ok, "health", start, r.status_code)
        except (httpx.HTTPError, ValueError) as e:
            return self._done(False, "health", start, detail=type(e).__name__)

    async def _login(self, http: httpx.AsyncClient) -> httpx.Response:
        r = await http.post("/v1/auth/login", json={"email": self.email, "password": self.password})
        if r.status_code == 401:  # compte inconnu (API redémarrée) : on le recrée
            reg = await http.post("/v1/auth/register", json={
                "name": "Sonde remediation", "email": self.email, "password": self.password})
            if reg.status_code not in (201, 409):
                return reg
            r = await http.post("/v1/auth/login", json={"email": self.email, "password": self.password})
        if r.status_code == 200:
            self.token = r.json()["data"]["token"]
        return r

    async def transaction(self) -> ProbeResult:
        start = time.monotonic()
        try:
            async with self._client() as http:
                h = await http.get("/health")
                if h.status_code != 200:
                    return self._done(False, "health", start, h.status_code)
                auth = {"Authorization": f"Bearer {self.token}"} if self.token else {}
                me = await http.get("/v1/auth/me", headers=auth) if self.token else None
                if me is None or me.status_code != 200:
                    r = await self._login(http)
                    if r.status_code != 200:
                        return self._done(False, "login", start, r.status_code)
                    auth = {"Authorization": f"Bearer {self.token}"}

                r = await http.post("/v1/payments/intents", headers={**auth, "Idempotency-Key": f"probe-{uuid.uuid4()}"}, json={
                    **BOOKING, "paymentMethod": {"token": f"pm_mock_probe-{secrets.token_hex(8)}", "last4": "4242",
                                                 "brand": "visa", "email": self.email}})
                if r.status_code not in (200, 202):
                    return self._done(False, "intent", start, r.status_code)
                pid = r.json()["data"]["id"]

                r = await http.post(f"/v1/payments/{pid}/verify", headers=auth, json={"code": config.DEMO_PAYMENT_CODE})
                if r.status_code != 202:
                    return self._done(False, "verify", start, r.status_code, pid)

                status = "?"
                for _ in range(20):  # le worker traite le paiement de façon asynchrone
                    r = await http.get(f"/v1/payments/{pid}", headers=auth)
                    status = r.json().get("data", {}).get("status", "?") if r.status_code == 200 else f"http {r.status_code}"
                    if status in ("succeeded", "failed"):
                        break
                    await asyncio.sleep(0.25)
                return self._done(status == "succeeded", "done" if status == "succeeded" else "settle", start,
                                  r.status_code, pid, f"statut {status}")
        except (httpx.HTTPError, ValueError, KeyError) as e:
            return self._done(False, "network", start, detail=type(e).__name__)

    def _done(self, ok, stage, start, status_code=None, payment_id=None, detail="") -> ProbeResult:
        res = ProbeResult(ok, stage, int((time.monotonic() - start) * 1000), status_code, payment_id, detail)
        self.last = res
        return res


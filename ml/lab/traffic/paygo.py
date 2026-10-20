"""Trafic légitime sur la vraie plateforme Pay&Go (à travers le WAF).

Des voyageurs fictifs se connectent, paient une réservation (intention → code de vérification de
démo → paiement), consultent leurs paiements et leur compte. L'intensité varie lentement
(sinusoïde) pour que la « normalité » apprise par le modèle ne soit pas plate.

Chaque processus = un client = une IP : le service compose `legit-traffic` (profil `demo`)
en lance plusieurs répliques sur le réseau `edge`, ce qui donne au WAF des IP sources distinctes
sans faire confiance à X-Forwarded-For. Rythme maintenu sous les limites de l'API par IP
(60 req/min, 12 connexions / 15 min).

    python paygo.py --target http://waf:8080 --users 3
"""

import argparse
import asyncio
import math
import os
import random
import secrets
import time
import uuid

import httpx

# Réservations du catalogue de démo (InMemoryBookingQuoteRepository) et leurs montants.
BOOKINGS = {f"booking_{i + 1}": c for i, c in enumerate(
    [3900, 2400, 8900, 2900, 1800, 3500, 4200, 7400, 2500, 2200, 4400, 9200, 4900, 1900, 2100, 9900])}
BRANDS = ["visa", "mastercard", "amex", "other"]
DEMO_CODE = os.environ.get("DEMO_PAYMENT_CODE", "123456")
UA = ["Mozilla/5.0 (Windows NT 10.0; Win64; x64)", "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5)",
      "Mozilla/5.0 (X11; Linux x86_64)", "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X)"]


class Traveller:
    def __init__(self, http: httpx.AsyncClient):
        self.http = http
        self.email = f"voyageur-{secrets.token_hex(5)}@paygo.local"
        self.password = secrets.token_urlsafe(14)
        self.token: str | None = None
        self.payments: list[str] = []

    @property
    def auth(self) -> dict:
        return {"Authorization": f"Bearer {self.token}"}

    async def login(self) -> None:
        r = await self.http.post("/v1/auth/login", json={"email": self.email, "password": self.password})
        if r.status_code == 401:
            await self.http.post("/v1/auth/register", json={
                "name": f"Voyageur {secrets.token_hex(2)}", "email": self.email, "password": self.password})
            r = await self.http.post("/v1/auth/login", json={"email": self.email, "password": self.password})
        self.token = r.json()["data"]["token"] if r.status_code == 200 else None

    async def pay(self) -> None:
        booking, amount = random.choice(list(BOOKINGS.items()))
        r = await self.http.post("/v1/payments/intents", headers={**self.auth, "Idempotency-Key": f"paygo-{uuid.uuid4()}"},
                                 json={"bookingId": booking, "amountCents": amount, "currency": "EUR", "paymentMethod": {
                                     "token": f"pm_mock_{secrets.token_hex(10)}", "last4": f"{random.randint(0, 9999):04d}",
                                     "brand": random.choice(BRANDS), "email": self.email}})
        if r.status_code == 401:
            self.token = None
            return
        if r.status_code in (200, 202):
            pid = r.json()["data"]["id"]
            await asyncio.sleep(random.uniform(2, 6))  # le voyageur lit son SMS / e-mail
            code = DEMO_CODE if random.random() > 0.04 else "000000"  # erreurs de saisie occasionnelles
            await self.http.post(f"/v1/payments/{pid}/verify", headers=self.auth, json={"code": code})
            self.payments = (self.payments + [pid])[-10:]

    async def browse(self) -> None:
        roll = random.random()
        if roll < 0.45 and self.payments:
            await self.http.get(f"/v1/payments/{random.choice(self.payments)}", headers=self.auth)
        elif roll < 0.8:
            await self.http.get("/v1/auth/me", headers=self.auth)
        else:
            await self.http.get("/health")


async def traveller_loop(i: int, args, t0: float) -> None:
    headers = {"User-Agent": random.choice(UA)}
    async with httpx.AsyncClient(base_url=args.target, headers=headers, timeout=10) as http:
        t = Traveller(http)
        while args.duration == 0 or time.time() - t0 < args.duration:
            # Activité entre ~30 % et 100 % sur une période de args.period secondes (décalée par client).
            level = 0.65 + 0.35 * math.sin(2 * math.pi * (time.time() - t0) / args.period + i)
            await asyncio.sleep(random.expovariate(level / args.think))
            try:
                if t.token is None:
                    await t.login()
                    if t.token is None:
                        await asyncio.sleep(30)  # rate-limit d'authentification ou API indisponible
                    continue
                await (t.pay() if random.random() < 0.35 else t.browse())
            except (httpx.HTTPError, ValueError, KeyError):
                await asyncio.sleep(2)


async def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument("--target", default=os.environ.get("TARGET", "http://waf:8080"))
    p.add_argument("--users", type=int, default=int(os.environ.get("USERS", 3)), help="voyageurs simulés par processus")
    p.add_argument("--duration", type=int, default=int(os.environ.get("DURATION", 0)), help="secondes, 0 = sans fin")
    p.add_argument("--think", type=float, default=float(os.environ.get("THINK", 6)), help="pause moyenne (s)")
    p.add_argument("--period", type=float, default=float(os.environ.get("PERIOD", 900)), help="période d'activité (s)")
    args = p.parse_args()
    print(f"trafic légitime Pay&Go : {args.users} voyageurs -> {args.target}", flush=True)
    t0 = time.time()
    await asyncio.gather(*(traveller_loop(i, args, t0) for i in range(args.users)))


if __name__ == "__main__":
    asyncio.run(main())

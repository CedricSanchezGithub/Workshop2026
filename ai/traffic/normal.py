"""Trafic légitime pour le labo : des clients fictifs se connectent, paient, consultent.

L'intensité varie lentement (sinusoïde + bruit) pour que le modèle apprenne une
« normalité » qui n'est pas plate. Chaque client simulé a sa propre IP privée,
transmise au WAF via X-Forwarded-For (voir WAF_TRUSTED_PROXIES dans ai/.env).

    uv run python -m traffic.normal --target http://localhost:8080 --clients 20 --duration 2700
"""

import argparse
import asyncio
import math
import random
import time

import httpx

LABELS = ["loyer", "courses", "facture", "remboursement", "abonnement", "cadeau", "restaurant", ""]


async def client(i: int, args, t0: float, stop: float) -> None:
    ip = f"10.20.{i // 250}.{i % 250 + 1}"
    username, password = f"client{(i % 50) + 1:02d}", f"demo-{(i % 50) + 1:02d}"
    headers = {"X-Forwarded-For": ip, "User-Agent": random.choice([
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64)", "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5)",
        "Mozilla/5.0 (X11; Linux x86_64)", "PaymentApp/2.3 (Android 14)"])}
    async with httpx.AsyncClient(base_url=args.target, headers=headers, timeout=10) as http:
        token = None
        while time.time() < stop:
            # Activité globale entre ~30 % et 100 % sur une période de args.period secondes.
            level = 0.65 + 0.35 * math.sin(2 * math.pi * (time.time() - t0) / args.period)
            await asyncio.sleep(random.expovariate(level / args.think))
            try:
                if token is None or random.random() < 0.02:
                    pwd = password if random.random() > 0.03 else "faute-de-frappe"  # erreurs humaines
                    r = await http.post("/login", json={"username": username, "password": pwd})
                    token = r.json().get("token") if r.status_code == 200 else None
                    continue
                auth = {"Authorization": f"Bearer {token}"}
                action = random.random()
                if action < 0.45:
                    # Virements entre clients actifs uniquement : la masse monétaire reste dans le
                    # groupe simulé, sinon les comptes actifs se vident et tout finit en 409.
                    other = random.choice([k for k in range(min(args.clients, 50)) if k != i % 50])
                    dst = f"FR-LAB-{other + 1:04d}"
                    await http.post("/payments", headers=auth, json={
                        "dst": dst, "amount_cents": random.randint(100, 25_000), "label": random.choice(LABELS)})
                elif action < 0.8:
                    await http.get("/payments", headers=auth, params={"q": random.choice(LABELS), "limit": 10})
                elif action < 0.95:
                    await http.get("/health")
                else:
                    await http.get(f"/payments/{random.choice(['inconnu', 'x'])}", headers=auth)
            except httpx.HTTPError:
                await asyncio.sleep(1)


async def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument("--target", default="http://localhost:8080")
    p.add_argument("--clients", type=int, default=20)
    p.add_argument("--duration", type=int, default=2700, help="secondes")
    p.add_argument("--think", type=float, default=2.0, help="pause moyenne entre deux actions (s)")
    p.add_argument("--period", type=float, default=900, help="période de variation d'activité (s)")
    args = p.parse_args()
    t0 = time.time()
    print(f"trafic normal : {args.clients} clients pendant {args.duration}s -> {args.target}")
    await asyncio.gather(*(client(i, args, t0, t0 + args.duration) for i in range(args.clients)))


if __name__ == "__main__":
    asyncio.run(main())

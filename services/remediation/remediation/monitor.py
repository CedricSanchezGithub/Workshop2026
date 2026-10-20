"""État des composants et transaction de test périodique, pour le dashboard (avant / pendant / après)."""

import asyncio
import time

import httpx

from remediation import config
from remediation.events import EventBus
from remediation.probe import Probe

COMPONENTS = {
    "prometheus": ("Prometheus", f"{config.PROMETHEUS_URL}/-/ready"),
    "loki": ("Loki", f"{config.LOKI_URL}/ready"),
    "inference": ("Détection ML", f"{config.INFERENCE_URL}/status"),
}


class Monitor:
    def __init__(self, bus: EventBus, probe: Probe):
        self.bus = bus
        self.probe = probe
        self.components: dict[str, dict] = {}
        self.detector: dict = {}
        self.last_transaction: dict | None = None
        self.history: list[dict] = []  # résultats de sonde récents (courbe disponibilité)

    async def run(self) -> None:
        last_tx = 0.0
        while True:
            await self.check_components()
            if time.time() - last_tx >= config.PROBE_INTERVAL_S:
                last_tx = time.time()
                await self.transaction()
            await asyncio.sleep(config.MONITOR_INTERVAL_S)

    async def transaction(self) -> dict:
        res = (await self.probe.transaction()).to_dict()
        changed = self.last_transaction is None or self.last_transaction["ok"] != res["ok"]
        self.last_transaction = res
        self.history = (self.history + [{"at": res["at"], "ok": res["ok"], "ms": res["duration_ms"]}])[-120:]
        if changed:
            self.bus.emit("probe", ok=res["ok"], stage=res["stage"], detail=res["detail"])
        return res

    async def check_components(self) -> None:
        async with httpx.AsyncClient(timeout=3) as http:
            results = await asyncio.gather(*(self._check(http, k, label, url) for k, (label, url) in COMPONENTS.items()))
        health = await self.probe.health()
        comps = {k: v for k, v in results}
        comps["payment-api"] = {"label": "API de paiement (via WAF)", "ok": health.ok,
                                "detail": f"HTTP {health.status_code}" if health.status_code else health.detail}
        comps["remediation"] = {"label": "Moteur de remédiation", "ok": True, "detail": "actif"}
        for k, v in comps.items():
            if k in self.components and self.components[k]["ok"] != v["ok"]:
                self.bus.emit("component", component=k, ok=v["ok"], detail=v["detail"])
        self.components = comps

    async def _check(self, http: httpx.AsyncClient, key: str, label: str, url: str) -> tuple[str, dict]:
        try:
            r = await http.get(url)
            ok = r.status_code == 200
            if key == "inference" and ok:
                self.detector = r.json()
            return key, {"label": label, "ok": ok, "detail": f"HTTP {r.status_code}"}
        except (httpx.HTTPError, ValueError) as e:
            if key == "inference":
                self.detector = {}
            return key, {"label": label, "ok": False, "detail": type(e).__name__}

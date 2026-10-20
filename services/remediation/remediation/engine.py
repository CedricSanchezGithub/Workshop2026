"""Moteur de remédiation : alerte → décision → action (playbooks) → vérification → clôture.

Table de décision figée (docs/attack-scenarios.md) :
- dos  (attaque A, disponibilité) : bloquer les IP sources au WAF ; si le service reste dégradé,
  redémarrer payment-api ; vérifier.
- sqli (attaque B, intégrité)     : bloquer les IP sources ; constater l'état ; restaurer
  payment-api depuis son image (état sain connu) ; vérifier.
Un incident n'est « résolu » qu'après une transaction de test réussie. Après MAX_ACTION_ROUNDS
tentatives infructueuses, il passe en échec et une escalade humaine est journalisée.
"""

import asyncio
import time
import uuid
from dataclasses import asdict, dataclass, field

from remediation import config, guards, playbooks
from remediation.events import EventBus
from remediation.models import Alert
from remediation.probe import Probe, ProbeResult

TERMINAL = ("resolved", "failed")


@dataclass
class Step:
    name: str
    label: str
    status: str = "running"  # running, ok, failed, skipped
    started: float = field(default_factory=time.time)
    ended: float | None = None
    detail: str = ""


@dataclass
class Incident:
    type: str
    alert_id: str
    score: float
    threshold: float
    offenders: list[str]
    top_features: dict
    id: str = field(default_factory=lambda: f"inc-{uuid.uuid4().hex[:8]}")
    state: str = "detected"  # detected, deciding, acting, verifying, resolved, failed
    detected_at: float = field(default_factory=time.time)
    resolved_at: float | None = None
    detector_resolved_at: float | None = None
    blocked: list[str] = field(default_factory=list)
    steps: list[Step] = field(default_factory=list)

    def to_dict(self) -> dict:
        d = asdict(self)
        d["duration_s"] = round((self.resolved_at or time.time()) - self.detected_at, 1)
        return d


class Engine:
    def __init__(self, bus: EventBus, probe: Probe, run_playbook=playbooks.run, protected=None):
        self.bus = bus
        self.probe = probe
        self.run_playbook = run_playbook
        self.protected = protected  # None = adresses de l'hôte lues au moment du blocage
        self.incidents: list[Incident] = []
        self._tasks: set[asyncio.Task] = set()

    # --- Réception -------------------------------------------------------------------------
    def active(self, kind: str) -> Incident | None:
        return next((i for i in reversed(self.incidents) if i.type == kind and i.state not in TERMINAL), None)

    def handle(self, alert: Alert) -> Incident | None:
        if alert.event == "resolved":
            for inc in reversed(self.incidents):
                if inc.type == alert.type and inc.detector_resolved_at is None:
                    inc.detector_resolved_at = time.time()
                    self.bus.emit("detector_resolved", incident=inc.id, type=inc.type)
                    return inc
            return None

        current = self.active(alert.type)
        if current:  # même incident en cours : on bloque seulement les nouvelles sources
            new = [ip for ip in alert.offenders if ip not in current.offenders]
            current.offenders += new
            self.bus.emit("alert_merged", incident=current.id, new_offenders=new)
            if new and current.state in ("acting", "verifying"):
                self._spawn(self._block(current, new))
            return current

        inc = Incident(alert.type, alert.id, alert.score, alert.threshold, list(alert.offenders), alert.top_features)
        self.incidents.append(inc)
        self.incidents = self.incidents[-50:]
        self.bus.emit("incident_detected", incident=inc.id, type=inc.type, score=inc.score,
                      threshold=inc.threshold, offenders=inc.offenders, top_features=inc.top_features)
        self._spawn(self._remediate(inc))
        return inc

    def _spawn(self, coro) -> None:
        task = asyncio.get_running_loop().create_task(coro)
        self._tasks.add(task)
        task.add_done_callback(self._tasks.discard)

    # --- Déroulé --------------------------------------------------------------------------
    async def _remediate(self, inc: Incident) -> None:
        try:
            self._state(inc, "deciding")
            plan = "dos: blocage IP + redémarrage si dégradé" if inc.type == "dos" else "sqli: blocage IP + restauration"
            self._step(inc, "decide", "Décision", "ok", plan)

            self._state(inc, "acting")
            await self._block(inc, inc.offenders)

            for round_ in range(1, config.MAX_ACTION_ROUNDS + 1):
                if inc.type == "sqli":
                    snap = await self.probe.health()
                    self._step(inc, "integrity", "Constat d'intégrité", "ok",
                               f"API {'joignable' if snap.ok else 'injoignable'} avant restauration")
                    if not await self._playbook(inc, "restore_service", "Restauration de payment-api (état sain connu)", service="payment-api"):
                        continue
                else:
                    check = await self.probe.transaction()
                    if check.ok:
                        self._step(inc, "health", "Contrôle du service", "ok",
                                   "service utilisable" + (" après blocage" if round_ == 1 else ""))
                    else:
                        self._step(inc, "health", "Contrôle du service", "failed", _why(check))
                        if not await self._playbook(inc, "restart_service", "Redémarrage de payment-api", service="payment-api"):
                            continue

                self._state(inc, "verifying")
                result = await self._verify(inc)
                if result.ok:
                    inc.resolved_at = time.time()
                    self._state(inc, "resolved")
                    self.bus.emit("incident_resolved", incident=inc.id, type=inc.type,
                                  duration_s=round(inc.resolved_at - inc.detected_at, 1), payment_id=result.payment_id)
                    return
                self._state(inc, "acting")

            inc.resolved_at = time.time()
            self._state(inc, "failed")
            self.bus.emit("escalation", incident=inc.id, type=inc.type,
                          message="Remédiation automatique en échec : intervention humaine requise (runbook reprise.md)")
        except Exception as e:  # le moteur ne doit jamais s'arrêter sur un incident
            inc.resolved_at = time.time()
            self._step(inc, "error", "Erreur interne", "failed", repr(e))
            self._state(inc, "failed")
            self.bus.emit("escalation", incident=inc.id, type=inc.type, message=f"Erreur du moteur : {e!r}")

    async def _block(self, inc: Incident, ips: list[str]) -> None:
        ok_ips, refused = guards.blockable(ips, self.protected)
        ok_ips = [ip for ip in ok_ips if ip not in inc.blocked]
        if refused:
            self._step(inc, "guard", "Garde-fous", "skipped", f"IP non bloquées (protégées ou invalides) : {', '.join(refused)}")
        if not ok_ips:
            if not refused:
                self._step(inc, "block", "Blocage des sources au WAF", "skipped", "aucune IP source fournie")
            return
        if await self._playbook(inc, "waf_block", f"Blocage au WAF de {', '.join(ok_ips)}", ips=ok_ips):
            inc.blocked += ok_ips

    async def _verify(self, inc: Incident) -> ProbeResult:
        step = self._step(inc, "verify", "Vérification : transaction de test", "running")
        result = None
        for attempt in range(1, config.VERIFY_ATTEMPTS + 1):
            result = await self.probe.transaction()
            if result.ok:
                self._finish(inc, step, "ok", f"paiement {result.payment_id} accepté (tentative {attempt}, {result.duration_ms} ms)")
                return result
            await asyncio.sleep(config.VERIFY_INTERVAL_S)
        self._finish(inc, step, "failed", _why(result))
        return result

    async def _playbook(self, inc: Incident, action: str, label: str, **params) -> bool:
        step = self._step(inc, action, label, "running")
        res = await self.run_playbook(action, params)
        self._finish(inc, step, "ok" if res.ok else "failed",
                     f"{res.duration_s} s" + ("" if res.ok else f" — {res.output[-300:]}"))
        return res.ok

    # --- Utilitaires ----------------------------------------------------------------------
    def _state(self, inc: Incident, state: str) -> None:
        inc.state = state
        self.bus.emit("incident_state", incident=inc.id, type=inc.type, state=state)

    def _step(self, inc: Incident, name: str, label: str, status: str, detail: str = "") -> Step:
        step = Step(name, label, status, detail=detail)
        if status != "running":
            step.ended = step.started
        inc.steps.append(step)
        self.bus.emit("incident_step", incident=inc.id, type=inc.type, step=asdict(step))
        return step

    def _finish(self, inc: Incident, step: Step, status: str, detail: str) -> None:
        step.status, step.ended, step.detail = status, time.time(), detail
        self.bus.emit("incident_step", incident=inc.id, type=inc.type, step=asdict(step))


def _why(r: ProbeResult | None) -> str:
    if r is None:
        return "aucun résultat"
    return f"échec à l'étape {r.stage}" + (f" (HTTP {r.status_code})" if r.status_code else "") + (f" {r.detail}" if r.detail else "")

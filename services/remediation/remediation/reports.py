"""Rapports d'incident en Markdown, lus par l'assistant RAG (rag/assistant/reports.py).

Un fichier par incident (et par alerte ignorée pendant la stabilisation) dans config.REPORTS_DIR.
Le texte décrit les symptômes en langage courant (« site lent », « requêtes refusées ») pour qu'une
question d'opérateur les retrouve, et donne des heures absolues : l'assistant compare avec l'heure
actuelle pour répondre à « il y a 5 minutes ». Écriture atomique : le RAG ne lit jamais un fichier
à moitié écrit.
"""

import os
import tempfile
from datetime import datetime
from pathlib import Path

from remediation import config

TYPE_LABEL = {
    "dos": "Attaque A — déni de service (lenteur / indisponibilité du site)",
    "sqli": "Attaque B — injection SQL (intégrité des données)",
}
STATE_LABEL = {"resolved": "service rétabli automatiquement", "failed": "remédiation en échec, escalade humaine"}
STEP_STATUS = {"ok": "réussi", "failed": "échec", "skipped": "non appliqué", "running": "en cours"}


def _pct(v: float) -> str:
    return f"{v * 100:.0f} %"


# Symptômes en clair par feature du détecteur (ml/features/extract.py) : (libellé, mise en forme).
SYMPTOMS = {
    "p95_latency_s": lambda v: f"temps de réponse élevé (p95 {v:.2f} s) : site lent",
    "p99_latency_s": lambda v: f"temps de réponse élevé (p99 {v:.2f} s) : site lent",
    "r429_ratio": lambda v: f"{_pct(v)} des requêtes refusées par la limitation de débit (HTTP 429)",
    "err5xx_ratio": lambda v: f"{_pct(v)} d'erreurs serveur (HTTP 5xx)",
    "payments_ok_rate": lambda v: f"paiements acceptés : {v:.2f} par seconde",
    "req_rate": lambda v: f"débit vers l'API : {v:.1f} requêtes par seconde",
    "waf_req_rate": lambda v: f"débit vu par le WAF : {v:.1f} requêtes par seconde",
    "bytes_out_rate": lambda v: f"volume renvoyé : {v:.0f} octets par seconde",
    "distinct_ips": lambda v: f"{v:.0f} adresse(s) IP cliente(s) actives",
    "top_ip_share": lambda v: f"{_pct(v)} des requêtes venant d'une seule adresse IP",
    "waf_block_rate": lambda v: f"requêtes bloquées par le WAF : {v:.2f} par seconde",
    "crs_sqli_hits": lambda v: f"{v:.0f} requête(s) déclenchant une règle anti-injection SQL du WAF (CRS 942xxx)",
    "crs_anomaly_score": lambda v: f"score d'anomalie du WAF : {v:.0f}",
    "suspicious_char_ratio": lambda v: f"{_pct(v)} des URL contenant des caractères de syntaxe SQL",
    "mean_req_bytes": lambda v: f"taille moyenne des requêtes : {v:.0f} octets",
    "client_err_ratio": lambda v: f"{_pct(v)} de requêtes mal formées (HTTP 400/422)",
    "db_error_rate": lambda v: f"erreurs base de données : {v:.2f} par seconde",
}


def _when(ts: float | None) -> str:
    return datetime.fromtimestamp(ts).astimezone().strftime("%d/%m/%Y à %H:%M:%S") if ts else "—"


def _hms(ts: float | None) -> str:
    return datetime.fromtimestamp(ts).astimezone().strftime("%H:%M:%S") if ts else "—"


def _symptoms(features: dict) -> list[str]:
    out = []
    for name, value in features.items():
        fmt = SYMPTOMS.get(name)
        out.append(fmt(value) if fmt else f"{name} = {value}")
    return out


def _filename(ts: float, ident: str, kind: str) -> str:
    stamp = datetime.fromtimestamp(ts).astimezone().strftime("%Y-%m-%dT%H-%M-%S")
    return f"{stamp}_{ident}_{kind}.md"


def _front_matter(**meta) -> str:
    return "---\n" + "".join(f"{k}: {v}\n" for k, v in meta.items() if v is not None) + "---\n"


def render_incident(inc: dict) -> str:
    kind, state = inc["type"], inc["state"]
    steps = inc.get("steps", [])
    guard = next((s for s in steps if s["name"] == "guard"), None)
    lines = [
        _front_matter(incident=inc["id"], type=kind, kind="incident", state=state,
                      detected_at=round(inc["detected_at"], 1),
                      resolved_at=round(inc["resolved_at"], 1) if inc.get("resolved_at") else None),
        f"# Rapport d'incident {inc['id']} — {TYPE_LABEL.get(kind, kind)}",
        "",
        f"Incident détecté le {_when(inc['detected_at'])} par la détection d'anomalies (score {inc['score']:.3f}, "
        f"seuil {inc['threshold']:.3f}). Issue : {STATE_LABEL.get(state, state)}"
        + (f" le {_when(inc['resolved_at'])}, en {inc['resolved_at'] - inc['detected_at']:.1f} s." if inc.get("resolved_at") else "."),
        "",
        "## Symptômes observés",
        *([f"- {s}" for s in _symptoms(inc.get("top_features", {}))] or ["- (aucun détail transmis par le détecteur)"]),
        "",
        "## Sources de l'attaque",
        f"- Adresses IP signalées : {', '.join(inc['offenders']) or 'aucune'}",
        f"- Adresses bloquées au WAF : {', '.join(inc.get('blocked', [])) or 'aucune'}",
    ]
    if guard:
        lines.append(f"- Garde-fous : {guard['detail']}")
    lines += ["", "## Déroulé de la remédiation automatique"]
    lines += [f"- {_hms(s['started'])} — {s['label']} : {STEP_STATUS.get(s['status'], s['status'])}"
              + (f" ({s['detail']})" if s.get("detail") else "") for s in steps]
    lines += ["", "## Fin des symptômes"]
    lines.append(f"Le détecteur est revenu à la normale le {_when(inc['detector_resolved_at'])}."
                 if inc.get("detector_resolved_at") else "Le détecteur n'avait pas encore signalé le retour à la normale.")
    if state == "failed":
        lines += ["", "Intervention humaine requise : suivre docs/runbooks/reprise.md."]
    return "\n".join(lines) + "\n"


def render_suppressed(event: dict) -> str:
    kind = event["type"]
    return "\n".join([
        _front_matter(incident=event["alert_id"], type=kind, kind="alerte_ignoree", state="ignored",
                      detected_at=round(event["ts"], 1)),
        f"# Alerte ignorée — {TYPE_LABEL.get(kind, kind)}",
        "",
        f"Le {_when(event['ts'])}, la détection d'anomalies a signalé une alerte {kind} "
        f"(adresses IP : {', '.join(event.get('offenders') or []) or 'aucune'}).",
        f"Le moteur de remédiation ne l'a pas traitée : {event.get('reason', 'période de stabilisation')} "
        f"(encore {event.get('remaining_s', 0):.0f} s de stabilisation). Aucune adresse n'a été bloquée.",
        "Ce type d'alerte suit en général un redémarrage ou une restauration de payment-api : les clients se "
        "reconnectent tous en même temps, ce qui ressemble brièvement à une attaque. Une lenteur ressentie à ce "
        "moment-là vient de cette reprise.",
    ]) + "\n"


def write(name: str, text: str, directory: Path | None = None) -> Path:
    directory = directory or config.REPORTS_DIR
    directory.mkdir(parents=True, exist_ok=True)
    fd, tmp = tempfile.mkstemp(dir=directory, prefix=".tmp-", suffix=".md")
    with os.fdopen(fd, "w", encoding="utf-8") as f:
        f.write(text)
    os.chmod(tmp, 0o644)  # lisible par l'utilisateur du conteneur de l'assistant
    path = directory / name
    os.replace(tmp, path)
    return path


def write_incident(inc: dict, directory: Path | None = None) -> Path:
    return write(_filename(inc["detected_at"], inc["id"], inc["type"]), render_incident(inc), directory)


def write_suppressed(event: dict, directory: Path | None = None) -> Path:
    return write(_filename(event["ts"], event["alert_id"][:12], f"{event['type']}-ignoree"),
                 render_suppressed(event), directory)

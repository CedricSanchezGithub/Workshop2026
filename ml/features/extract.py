"""Extraction des features du détecteur depuis Prometheus et Loki.

Chaque ligne = une fenêtre glissante de 60 s se terminant à l'instant t, calculée
tous les STEP secondes. Les features sont regroupées par famille ; chaque famille
alimente sa propre Isolation Forest et la famille qui déclenche donne le type d'incident :

- traffic   -> dos   (volume, latence, erreurs, concentration des clients)
- injection -> sqli  (blocages WAF, règles CRS 942xxx, taille et forme des requêtes)

Le même code sert à la collecte du dataset (fetch_range) et à l'inférence en
direct (fetch_latest), pour que le modèle voie exactement les mêmes features.
"""

from __future__ import annotations

import os
import time
from collections import defaultdict
from dataclasses import dataclass
from typing import Callable

import httpx
import numpy as np
import pandas as pd

PROMETHEUS_URL = os.environ.get("PROMETHEUS_URL", "http://localhost:9090")
LOKI_URL = os.environ.get("LOKI_URL", "http://localhost:3100")
WINDOW = "1m"
WINDOW_S = 60
STEP_S = 10

# Sélecteurs LogQL. Les audits ModSecurity sont les lignes JSON {"transaction"...} du WAF.
# `| json | event="http"` plutôt qu'un filtre texte : indépendant de la mise en forme du JSON
# (Python écrit `"event": "http"`, Node/Go `"event":"http"`).
API_HTTP = '{container="payment-api"} | json | event="http"'
WAF_AUDIT = '{container="waf"} |~ `^\\{"transaction"`'
WAF_ACCESS = '{container="waf"} !~ `^\\{"transaction"`'
# Marqueurs de requête « inhabituelle » dans l'URL de la ligne d'accès (encodés ou non) :
# quote, guillemet, point-virgule, commentaire SQL, parenthèses. Limité à `"MÉTHODE URL HTTP/`
# pour ne pas compter les parenthèses des User-Agent. Les corps POST ne sont pas dans
# l'accès nginx : ils sont couverts par les audits CRS (crs_sqli_hits, crs_anomaly_score).
SUSPICIOUS_CHARS = "(?i)\"[A-Z]+ [^ \"]*(%27|'|%22|%3b|;|--|%2d%2d|/\\*|%28|%29)[^ \"]* HTTP/"


@dataclass(frozen=True)
class Feature:
    name: str
    family: str
    source: str  # "prom" ou "loki"
    query: str
    description: str
    denominator: str | None = None  # si défini : valeur = query / max(denominator, ε), calculé ici


def _ratio(num: str, den: str) -> str:
    return f"({num}) / clamp_min({den}, 1e-9)"


ALL_REQ = f"sum(rate(http_requests_total[{WINDOW}]))"

FEATURES: list[Feature] = [
    # --- Famille trafic (DoS) ---
    Feature("req_rate", "traffic", "prom", ALL_REQ, "requêtes/s atteignant l'API"),
    Feature("p95_latency_s", "traffic", "prom",
            f"histogram_quantile(0.95, sum by (le) (rate(http_request_duration_seconds_bucket[{WINDOW}])))",
            "latence p95"),
    Feature("p99_latency_s", "traffic", "prom",
            f"histogram_quantile(0.99, sum by (le) (rate(http_request_duration_seconds_bucket[{WINDOW}])))",
            "latence p99"),
    Feature("err5xx_ratio", "traffic", "prom",
            _ratio(f'sum(rate(http_requests_total{{status=~"5.."}}[{WINDOW}]))', ALL_REQ), "part de 5xx"),
    Feature("r429_ratio", "traffic", "prom",
            _ratio(f'sum(rate(http_requests_total{{status="429"}}[{WINDOW}]))', ALL_REQ), "part de 429"),
    Feature("bytes_out_rate", "traffic", "prom", f"sum(rate(http_response_bytes_total[{WINDOW}]))", "octets/s renvoyés"),
    Feature("payments_ok_rate", "traffic", "prom",
            f'sum(rate(payments_total{{status="accepted"}}[{WINDOW}]))', "transactions acceptées/s"),
    Feature("waf_req_rate", "traffic", "loki", f"sum(count_over_time({WAF_ACCESS} [{WINDOW}])) / {WINDOW_S}",
            "requêtes/s vues par le WAF (y compris bloquées)"),
    # distinct_ips et top_ip_share sont calculées à partir d'une requête par IP (voir _ip_features).

    # --- Famille injection (SQLi) ---
    Feature("waf_block_rate", "injection", "loki",
            f'sum(count_over_time({WAF_AUDIT} |= `"http_code":403` [{WINDOW}])) / {WINDOW_S}', "blocages WAF/s"),
    Feature("crs_sqli_hits", "injection", "loki",
            f'sum(count_over_time({WAF_AUDIT} |~ `"ruleId":"942[0-9]+"` [{WINDOW}]))',
            "audits WAF déclenchant une règle CRS SQLi (942xxx)"),
    Feature("crs_anomaly_score", "injection", "loki",
            f'sum(sum_over_time({WAF_AUDIT} | regexp `Total Score: (?P<score>[0-9]+)` | unwrap score [{WINDOW}]))',
            "somme des scores d'anomalie CRS entrants"),
    Feature("suspicious_char_ratio", "injection", "loki",
            f'sum(count_over_time({WAF_ACCESS} |~ `{SUSPICIOUS_CHARS}` [{WINDOW}]))',
            "part des requêtes contenant des caractères de syntaxe SQL",
            denominator=f"sum(count_over_time({WAF_ACCESS} [{WINDOW}]))"),
    Feature("mean_req_bytes", "injection", "prom",
            _ratio(f"sum(rate(http_request_bytes_sum[{WINDOW}]))", f"sum(rate(http_request_bytes_count[{WINDOW}]))"),
            "taille moyenne URL + corps"),
    Feature("client_err_ratio", "injection", "prom",
            _ratio(f'sum(rate(http_requests_total{{status=~"400|422"}}[{WINDOW}]))', ALL_REQ),
            "part de requêtes mal formées (400/422)"),
    Feature("db_error_rate", "injection", "prom", f"sum(rate(db_errors_total[{WINDOW}]))", "erreurs base/s"),
]

IP_FEATURES = {"distinct_ips": "traffic", "top_ip_share": "traffic"}
# client_ip 127.0.0.1 = healthcheck interne du conteneur, pas un client.
IP_QUERY = f'sum by (client_ip) (count_over_time({API_HTTP} | client_ip != "127.0.0.1" [{WINDOW}]))'


def family_columns(family: str) -> list[str]:
    return [f.name for f in FEATURES if f.family == family] + [n for n, fam in IP_FEATURES.items() if fam == family]


FAMILIES = {"traffic": "dos", "injection": "sqli"}


# --- Accès aux API ---

def _prom_range(http: httpx.Client, query: str, start: float, end: float, step: int) -> list[dict]:
    r = http.get(f"{PROMETHEUS_URL}/api/v1/query_range",
                 params={"query": query, "start": start, "end": end, "step": step})
    r.raise_for_status()
    return r.json()["data"]["result"]


def _loki_range(http: httpx.Client, query: str, start: float, end: float, step: int) -> list[dict]:
    # Loki limite la taille des requêtes : on découpe en tranches de 6 h.
    out: dict[str, dict] = {}
    chunk = 6 * 3600
    t = start
    while t <= end:
        t_end = min(t + chunk, end)
        r = http.get(f"{LOKI_URL}/loki/api/v1/query_range",
                     params={"query": query, "start": int(t * 1e9), "end": int(t_end * 1e9), "step": f"{step}s"})
        r.raise_for_status()
        for s in r.json()["data"]["result"]:
            key = repr(sorted(s["metric"].items()))
            out.setdefault(key, {"metric": s["metric"], "values": []})["values"] += s["values"]
        t = t_end + step
    return list(out.values())


def _to_series(result: list[dict]) -> pd.Series:
    """Résultat agrégé (une seule série) -> Series indexée par timestamp."""
    if not result:
        return pd.Series(dtype=float)
    values = result[0]["values"]
    return pd.Series([float(v) for _, v in values], index=[int(float(t)) for t, _ in values], dtype=float)


def _ip_features(result: list[dict]) -> pd.DataFrame:
    per_t: dict[int, list[float]] = defaultdict(list)
    for s in result:
        for t, v in s["values"]:
            if float(v) > 0:
                per_t[int(float(t))].append(float(v))
    rows = {t: {"distinct_ips": len(c), "top_ip_share": max(c) / sum(c)} for t, c in per_t.items()}
    return pd.DataFrame.from_dict(rows, orient="index", columns=list(IP_FEATURES))


def fetch_range(start: float, end: float, step: int = STEP_S,
                http: httpx.Client | None = None) -> pd.DataFrame:
    """Une ligne par instant t (aligné sur `step`), une colonne par feature. Absence de donnée = 0."""
    start, end = int(start // step * step), int(end // step * step)
    own = http is None
    http = http or httpx.Client(timeout=60)
    try:
        cols: dict[str, pd.Series] = {}
        fetchers: dict[str, Callable] = {"prom": _prom_range, "loki": _loki_range}
        for f in FEATURES:
            s = _to_series(fetchers[f.source](http, f.query, start, end, step))
            if f.denominator:
                den = _to_series(fetchers[f.source](http, f.denominator, start, end, step))
                s = s.reindex(den.index).fillna(0) / den.clip(lower=1e-9)
            cols[f.name] = s
        ips = _ip_features(_loki_range(http, IP_QUERY, start, end, step))
    finally:
        if own:
            http.close()

    index = pd.RangeIndex(start, end + 1, step, name="ts")
    df = pd.DataFrame(index=index)
    for name, s in cols.items():
        df[name] = s.reindex(index)
    for name in IP_FEATURES:
        df[name] = ips[name].reindex(index) if name in ips else np.nan
    # NaN = pas de trafic / pas d'événement dans la fenêtre (ex. p95 sans requête) -> 0.
    return df.replace([np.inf, -np.inf], np.nan).fillna(0.0)


def fetch_latest(http: httpx.Client | None = None) -> pd.Series:
    """Features de la fenêtre qui se termine maintenant (pour l'inférence en direct)."""
    now = time.time() - 5  # petite marge pour laisser Prometheus/Loki ingérer
    df = fetch_range(now - STEP_S, now, STEP_S, http)
    return df.iloc[-1]

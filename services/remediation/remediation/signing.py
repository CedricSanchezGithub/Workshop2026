"""Authentification des alertes : HMAC-SHA256 du corps brut + fraîcheur + anti-rejeu.

Seul le détecteur (qui possède la clé) peut déclencher une remédiation : le moteur a des droits
élevés sur la plateforme, il ne doit pas obéir à n'importe quel composant (sujet §3.4).
"""

import hashlib
import hmac
from collections import OrderedDict
from datetime import datetime, timezone


def sign(key: bytes, body: bytes) -> str:
    return "sha256=" + hmac.new(key, body, hashlib.sha256).hexdigest()


def verify_signature(key: bytes, body: bytes, header: str | None) -> bool:
    return bool(header) and hmac.compare_digest(sign(key, body), header)


def is_fresh(ts: datetime, max_age_s: int, now: datetime | None = None) -> bool:
    now = now or datetime.now(timezone.utc)
    if ts.tzinfo is None:
        ts = ts.replace(tzinfo=timezone.utc)
    return abs((now - ts).total_seconds()) <= max_age_s


class ReplayGuard:
    """Mémorise les identifiants d'alerte récents ; une alerte rejouée est refusée."""

    def __init__(self, size: int = 1000):
        self._seen: OrderedDict[str, None] = OrderedDict()
        self._size = size

    def check_and_add(self, alert_id: str) -> bool:
        if alert_id in self._seen:
            return False
        self._seen[alert_id] = None
        if len(self._seen) > self._size:
            self._seen.popitem(last=False)
        return True

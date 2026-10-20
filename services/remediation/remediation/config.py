"""Configuration du moteur de remédiation (variables d'environnement, valeurs par défaut pour le PC Hôte)."""

import os
from pathlib import Path

REPO = Path(__file__).resolve().parents[3]


def _env_file_value(name: str, default: str) -> str:
    """Lit une valeur non secrète de infra/.env (ex. WAF_PORT) si elle n'est pas dans l'environnement."""
    if name in os.environ:
        return os.environ[name]
    env = REPO / "infra" / ".env"
    if env.exists():
        for line in env.read_text().splitlines():
            if line.startswith(f"{name}="):
                return line.split("=", 1)[1].strip() or default
    return default


# Adresses d'écoute : localhost (dashboard) + passerelle Docker joignable par ml-inference
# (host.docker.internal). Jamais l'adresse du hotspot.
BIND_HOSTS = [h.strip() for h in os.environ.get("REMEDIATION_BIND", "127.0.0.1").split(",") if h.strip()]
PORT = int(os.environ.get("REMEDIATION_PORT", 8090))

ANSIBLE_DIR = Path(os.environ.get("ANSIBLE_DIR", REPO / "ansible"))
ANSIBLE_PLAYBOOK = os.environ.get("ANSIBLE_PLAYBOOK", str(Path.home() / ".local/bin/ansible-playbook"))
PLAYBOOK_TIMEOUT_S = int(os.environ.get("PLAYBOOK_TIMEOUT_S", 150))

# Le moteur vérifie le service comme un client : à travers le WAF publié sur l'hôte.
WAF_URL = os.environ.get("WAF_URL", f"http://127.0.0.1:{_env_file_value('WAF_PORT', '8080')}")
PROMETHEUS_URL = os.environ.get("PROMETHEUS_URL", "http://127.0.0.1:9090")
LOKI_URL = os.environ.get("LOKI_URL", "http://127.0.0.1:3100")
INFERENCE_URL = os.environ.get("INFERENCE_URL", "http://127.0.0.1:8095")
DEMO_PAYMENT_CODE = os.environ.get("DEMO_PAYMENT_CODE", "123456")

# Clé HMAC partagée avec ml-inference, générée par ansible deploy.yml (jamais dans Git ni dans l'env).
HMAC_KEY_FILE = Path(os.environ.get("REMEDIATION_HMAC_KEY_FILE", REPO / "infra/secrets/remediation/hmac_key"))
ALERT_MAX_AGE_S = int(os.environ.get("ALERT_MAX_AGE_S", 60))

# Vérification après action : nombre de tentatives et intervalle.
VERIFY_ATTEMPTS = int(os.environ.get("VERIFY_ATTEMPTS", 6))
VERIFY_INTERVAL_S = float(os.environ.get("VERIFY_INTERVAL_S", 3))
MAX_ACTION_ROUNDS = 2  # au-delà : incident en échec, escalade humaine
MONITOR_INTERVAL_S = float(os.environ.get("MONITOR_INTERVAL_S", 5))
PROBE_INTERVAL_S = float(os.environ.get("PROBE_INTERVAL_S", 15))

EVENTS_FILE = Path(os.environ.get("REMEDIATION_EVENTS_FILE", REPO / "services/remediation/data/events.jsonl"))
DASHBOARD_DIR = Path(os.environ.get("DASHBOARD_DIR", REPO / "services/dashboard/dist"))

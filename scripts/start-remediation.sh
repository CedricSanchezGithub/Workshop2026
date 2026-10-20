#!/usr/bin/env bash
#
# start-remediation — moteur de remédiation (WOR-38) + dashboard de supervision (WOR-40)
#
# Le moteur tourne sur le PC Hôte (pas dans un conteneur) : il n'agit sur la plateforme qu'à travers
# la liste fermée de playbooks ansible/playbooks/remediation/. Il écoute sur :
#   - 127.0.0.1           : dashboard  http://127.0.0.1:${REMEDIATION_PORT:-8090}
#   - la passerelle Docker : alertes signées de ml-inference (host.docker.internal)
# Jamais sur l'adresse du hotspot.
#
# Usage :
#     scripts/start-remediation.sh [start|run|stop|restart|status]
#
#   start    lance le moteur en arrière-plan (défaut), attend qu'il réponde
#   run      lance le moteur au premier plan (Ctrl+C pour arrêter)
#   stop     arrête le moteur
#   restart  stop puis start
#   status   état du moteur et de la dernière transaction de test
#
# Prérequis : uv, ansible-playbook (collections installées dans ansible/collections), plateforme
# déployée (ansible-playbook playbooks/deploy.yml, qui génère la clé HMAC). Node/npm seulement si le
# dashboard n'est pas encore construit.
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
ENGINE_DIR="$REPO_ROOT/services/remediation"
DASHBOARD_DIR="$REPO_ROOT/services/dashboard"
DATA_DIR="$ENGINE_DIR/data"
PID_FILE="$DATA_DIR/engine.pid"
LOG_FILE="$DATA_DIR/engine.log"
PORT="${REMEDIATION_PORT:-8090}"
URL="http://127.0.0.1:$PORT"

find_bin() { # <nom> : PATH, puis ~/.local/bin (uv tool install)
  command -v "$1" 2>/dev/null || { [[ -x "$HOME/.local/bin/$1" ]] && echo "$HOME/.local/bin/$1"; } || true
}

running_pid() {
  [[ -f "$PID_FILE" ]] || return 1
  local pid; pid="$(cat "$PID_FILE")"
  kill -0 "$pid" 2>/dev/null && echo "$pid"
}

docker_gateway() {
  # host.docker.internal:host-gateway pointe vers la passerelle du réseau bridge par défaut.
  docker network inspect bridge -f '{{range .IPAM.Config}}{{.Gateway}}{{end}}' 2>/dev/null || true
}

prepare() {
  UV="$(find_bin uv)"
  [[ -n "$UV" ]] || { echo "uv introuvable (https://docs.astral.sh/uv/)." >&2; exit 2; }
  ANSIBLE_PLAYBOOK="${ANSIBLE_PLAYBOOK:-$(find_bin ansible-playbook)}"
  [[ -n "$ANSIBLE_PLAYBOOK" ]] || { echo "ansible-playbook introuvable (pipx/uv tool install ansible-core)." >&2; exit 2; }
  [[ -f "$REPO_ROOT/infra/secrets/remediation/hmac_key" ]] || {
    echo "Clé HMAC absente : déployer d'abord la plateforme (cd ansible && ansible-playbook playbooks/deploy.yml)." >&2; exit 2; }

  if [[ ! -f "$DASHBOARD_DIR/dist/index.html" ]]; then
    if command -v npm >/dev/null 2>&1; then
      echo ">>> Construction du dashboard"
      (cd "$DASHBOARD_DIR" && npm ci --silent && npx vite build >/dev/null)
    else
      echo "!!! npm absent : dashboard non construit (le moteur fonctionne, sans interface)." >&2
    fi
  fi

  local gw; gw="$(docker_gateway)"
  BIND="127.0.0.1${gw:+,$gw}"
  mkdir -p "$DATA_DIR"
  (cd "$ENGINE_DIR" && "$UV" sync --quiet --frozen --no-dev)
  export REMEDIATION_BIND="$BIND" REMEDIATION_PORT="$PORT" ANSIBLE_PLAYBOOK
}

wait_healthy() {
  for _ in $(seq 1 40); do
    curl -fsS -m 2 "$URL/health" >/dev/null 2>&1 && return 0
    sleep 0.5
  done
  return 1
}

cmd_start() {
  if pid="$(running_pid)"; then echo "Moteur déjà démarré (pid $pid) : $URL"; return 0; fi
  if curl -fsS -m 2 "$URL/health" >/dev/null 2>&1; then
    echo "Un moteur répond déjà sur $URL (lancé hors de ce script). Arrêtez-le avant." >&2; exit 1
  fi
  prepare
  echo ">>> Démarrage du moteur (écoute : $REMEDIATION_BIND, port $PORT)"
  cd "$ENGINE_DIR"
  nohup setsid "$UV" run --no-dev python -m remediation >>"$LOG_FILE" 2>&1 < /dev/null &
  echo $! > "$PID_FILE"
  if wait_healthy; then
    echo ">>> Moteur prêt (pid $(cat "$PID_FILE")) — dashboard : $URL — journal : $LOG_FILE"
  else
    echo "!!! Le moteur ne répond pas. Fin du journal :" >&2; tail -20 "$LOG_FILE" >&2; exit 3
  fi
}

cmd_run() {
  prepare
  echo ">>> Moteur au premier plan (écoute : $REMEDIATION_BIND, port $PORT) — dashboard : $URL"
  cd "$ENGINE_DIR" && exec "$UV" run --no-dev python -m remediation
}

cmd_stop() {
  if pid="$(running_pid)"; then
    kill -- "-$pid" 2>/dev/null || kill "$pid"
    for _ in $(seq 1 20); do kill -0 "$pid" 2>/dev/null || break; sleep 0.25; done
    rm -f "$PID_FILE"
    echo ">>> Moteur arrêté"
  else
    rm -f "$PID_FILE"
    echo "Moteur non démarré par ce script."
  fi
}

cmd_status() {
  if pid="$(running_pid)"; then echo "Moteur : démarré (pid $pid)"; else echo "Moteur : pas de pid (script)"; fi
  if state="$(curl -fsS -m 3 "$URL/api/state" 2>/dev/null)"; then
    python3 - "$state" <<'EOF'
import json, sys
d = json.loads(sys.argv[1])
tx = d.get("last_transaction") or {}
print(f"Bandeau : {d['banner']['state']}")
print("Transaction de test : " + ("OK" if tx.get("ok") else f"échec ({tx.get('stage', '—')})") if tx else "Transaction de test : aucune")
for k, c in d["components"].items():
    print(f"  {'OK' if c['ok'] else 'KO'}  {c['label']} ({c['detail']})")
EOF
  else
    echo "API du moteur injoignable sur $URL"; return 1
  fi
}

case "${1:-start}" in
  start)   cmd_start ;;
  run)     cmd_run ;;
  stop)    cmd_stop ;;
  restart) cmd_stop; cmd_start ;;
  status)  cmd_status ;;
  -h|--help) grep -E '^#( |$)' "$0" | sed 's/^# \{0,1\}//' ;;
  *) echo "Commande inconnue : $1 (start|run|stop|restart|status)" >&2; exit 1 ;;
esac

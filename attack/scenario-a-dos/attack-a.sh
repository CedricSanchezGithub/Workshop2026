#!/usr/bin/env bash
#
# Scénario A — DoS / épuisement de ressources (WOR-58)
# Générateur de charge contrôlé contre l'API métier du groupe.
#
# But : produire un effet RÉEL et OBSERVABLE (latence + erreurs) détectable
#       par la supervision (Prometheus/Loki), avec start/stop nets pour le
#       Clip Chrono, afin d'alimenter la détection ML (WOR-53) et la
#       remédiation (WOR-38), puis le dataset (WOR-50).
#
# ⚠️  PÉRIMÈTRE STRICT (WOR-66)
#     Uniquement le SI du groupe, sur des cibles privées autorisées
#     (localhost ou réseau RESILIENCE-G6, plages RFC1918). Le script REFUSE
#     toute cible publique. Jamais le campus, un autre groupe, un tiers,
#     ou Internet.
#
# Usage :
#     ./attack-a.sh --target <host> [--port 8080] [--path /health] \
#                   [--intensity 20] [--duration 60] [--label a-dos]
#
set -euo pipefail

# --- Valeurs par défaut -----------------------------------------------------
TARGET=""
PORT="8080"
PATH_="/health"
INTENSITY="20"      # nb de workers concurrents
DURATION="60"       # secondes
LABEL="a-dos"       # étiquette propagée aux logs pour l'étiquetage du dataset

usage() { grep -E '^#( |$)' "$0" | sed 's/^# \{0,1\}//'; exit "${1:-0}"; }

# --- Parsing ----------------------------------------------------------------
while [[ $# -gt 0 ]]; do
  case "$1" in
    --target)    TARGET="$2"; shift 2 ;;
    --port)      PORT="$2"; shift 2 ;;
    --path)      PATH_="$2"; shift 2 ;;
    --intensity) INTENSITY="$2"; shift 2 ;;
    --duration)  DURATION="$2"; shift 2 ;;
    --label)     LABEL="$2"; shift 2 ;;
    -h|--help)   usage 0 ;;
    *) echo "Argument inconnu : $1" >&2; usage 1 ;;
  esac
done

[[ -z "$TARGET" ]] && { echo "Erreur : --target obligatoire" >&2; usage 1; }

# --- Garde-fou périmètre (WOR-66) -------------------------------------------
# Résout la cible et refuse toute IP non privée. Seules les plages RFC1918,
# loopback et link-local sont autorisées.
resolve_ip() {
  getent ahostsv4 "$1" 2>/dev/null | awk '{print $1; exit}' \
    || python3 -c "import socket,sys;print(socket.gethostbyname(sys.argv[1]))" "$1"
}
is_private() {
  local ip="$1"
  [[ "$ip" =~ ^127\. ]]        && return 0   # loopback
  [[ "$ip" =~ ^10\. ]]         && return 0   # 10.0.0.0/8
  [[ "$ip" =~ ^192\.168\. ]]   && return 0   # 192.168.0.0/16
  [[ "$ip" =~ ^169\.254\. ]]   && return 0   # link-local
  [[ "$ip" =~ ^172\.(1[6-9]|2[0-9]|3[0-1])\. ]] && return 0  # 172.16/12
  return 1
}

IP="$(resolve_ip "$TARGET")" || { echo "Impossible de résoudre $TARGET" >&2; exit 2; }
if ! is_private "$IP"; then
  echo "REFUS (WOR-66) : $TARGET → $IP n'est pas une cible privée autorisée." >&2
  echo "Le scénario A ne s'exécute que sur le SI du groupe (localhost / RFC1918)." >&2
  exit 3
fi

URL="http://${TARGET}:${PORT}${PATH_}"

# --- Confirmation explicite -------------------------------------------------
cat <<EOF
Scénario A — DoS contrôlé (WOR-58)
  Cible      : $URL  ($IP)
  Intensité  : $INTENSITY workers concurrents
  Durée      : $DURATION s
  Étiquette  : $LABEL
EOF
read -r -p "Confirmer le lancement sur CETTE cible autorisée ? [oui/non] " ans
[[ "$ans" == "oui" ]] || { echo "Annulé."; exit 0; }

# --- Boucle de charge -------------------------------------------------------
PIDS=()
cleanup() {
  echo; echo ">>> STOP  $(date -Is)  [label=$LABEL]"
  for p in "${PIDS[@]:-}"; do kill "$p" 2>/dev/null || true; done
  wait 2>/dev/null || true
}
trap cleanup INT TERM EXIT

echo ">>> START $(date -Is)  [label=$LABEL]"   # borne nette pour le Clip Chrono
END=$(( $(date +%s) + DURATION ))

worker() {
  while [[ $(date +%s) -lt $END ]]; do
    # -H propage l'étiquette dans les logs d'accès → facilite l'étiquetage WOR-50
    curl -s -o /dev/null -m 5 -H "X-Attack-Label: $LABEL" "$URL" || true
  done
}

for _ in $(seq 1 "$INTENSITY"); do
  worker & PIDS+=("$!")
done
wait "${PIDS[@]}"
# cleanup() affiche le STOP via le trap EXIT

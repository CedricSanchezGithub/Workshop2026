#!/usr/bin/env bash
#
# Scénario B — injection applicative (WOR-59)
# Émetteur contrôlé de vecteurs d'injection contre l'API métier du groupe.
#
# But : déclencher les règles WAF (ModSecurity CRS SQLi, 942xxx) et produire
#       un motif anormal, étiquetable, dans Loki/Prometheus, afin d'alimenter
#       la détection ML famille `injection` (WOR-53) et de démontrer la
#       réponse d'INTÉGRITÉ (≠ disponibilité du scénario A) : blocage WAF +
#       rollback snapshot BDD + rotation de secret (WOR-38).
#
# Ce ne sont PAS des exploits fonctionnels : ce sont des SIGNATURES de test
# destinées à faire réagir la détection. Objectif = valider le WAF et le
# détecteur, pas compromettre une vraie base.
#
# ⚠️  PÉRIMÈTRE STRICT (WOR-66)
#     Uniquement le SI du groupe, sur des cibles privées autorisées
#     (localhost ou RESILIENCE-G6, plages RFC1918). Le script REFUSE toute
#     cible publique. Jamais le campus, un autre groupe, un tiers, Internet.
#     Aucune donnée financière réelle.
#
# Usage :
#     ./attack-b.sh --target <host> [--port 8080] [--path /api/pay] \
#                   [--param q] [--rounds 3] [--delay 1] [--label b-injection]
#
set -euo pipefail

# --- Valeurs par défaut -----------------------------------------------------
TARGET=""
PORT="8080"
PATH_="/api/pay"
PARAM="q"           # paramètre de requête ciblé par l'injection
ROUNDS="3"          # nb de passes sur l'ensemble des vecteurs
DELAY="1"           # secondes entre deux requêtes (motif lisible, pas un flood)
LABEL="b-injection" # étiquette propagée aux logs pour l'étiquetage (WOR-50)

usage() { grep -E '^#( |$)' "$0" | sed 's/^# \{0,1\}//'; exit "${1:-0}"; }

# --- Parsing ----------------------------------------------------------------
while [[ $# -gt 0 ]]; do
  case "$1" in
    --target) TARGET="$2"; shift 2 ;;
    --port)   PORT="$2"; shift 2 ;;
    --path)   PATH_="$2"; shift 2 ;;
    --param)  PARAM="$2"; shift 2 ;;
    --rounds) ROUNDS="$2"; shift 2 ;;
    --delay)  DELAY="$2"; shift 2 ;;
    --label)  LABEL="$2"; shift 2 ;;
    -h|--help) usage 0 ;;
    *) echo "Argument inconnu : $1" >&2; usage 1 ;;
  esac
done

[[ -z "$TARGET" ]] && { echo "Erreur : --target obligatoire" >&2; usage 1; }

# --- Garde-fou périmètre (WOR-66) -------------------------------------------
# Identique au scénario A : refuse toute IP non privée.
resolve_ip() {
  getent ahostsv4 "$1" 2>/dev/null | awk '{print $1; exit}' \
    || python3 -c "import socket,sys;print(socket.gethostbyname(sys.argv[1]))" "$1"
}
is_private() {
  local ip="$1"
  [[ "$ip" =~ ^127\. ]]      && return 0
  [[ "$ip" =~ ^10\. ]]       && return 0
  [[ "$ip" =~ ^192\.168\. ]] && return 0
  [[ "$ip" =~ ^169\.254\. ]] && return 0
  [[ "$ip" =~ ^172\.(1[6-9]|2[0-9]|3[0-1])\. ]] && return 0
  return 1
}

IP="$(resolve_ip "$TARGET")" || { echo "Impossible de résoudre $TARGET" >&2; exit 2; }
if ! is_private "$IP"; then
  echo "REFUS (WOR-66) : $TARGET → $IP n'est pas une cible privée autorisée." >&2
  echo "Le scénario B ne s'exécute que sur le SI du groupe (localhost / RFC1918)." >&2
  exit 3
fi

BASE="http://${TARGET}:${PORT}${PATH_}"

# --- Vecteurs de test (signatures déclenchant CRS 942xxx) -------------------
# Chaînes de SYNTAXE SQL/erreur conçues pour faire réagir le WAF et la
# détection. Pensées pour être bloquées, pas pour réussir.
VECTORS=(
  "' OR '1'='1"
  "' OR 1=1 -- "
  "'; DROP TABLE payments; -- "
  "1 UNION SELECT null,null,null -- "
  "admin'--"
  "\" OR \"\"=\""
  "1); SELECT pg_sleep(5); --"
  "%27%20OR%201%3D1%20--"
  "../../../../etc/passwd"
  "{\"amount\": \"1 OR 1=1\"}"
)

# --- Confirmation explicite -------------------------------------------------
cat <<EOF
Scénario B — injection applicative contrôlée (WOR-59)
  Cible      : $BASE  ($IP)
  Paramètre  : ?$PARAM=<vecteur>
  Vecteurs   : ${#VECTORS[@]} signatures × $ROUNDS passes (délai ${DELAY}s)
  Étiquette  : $LABEL
Ces vecteurs sont des signatures de test destinées à être BLOQUÉES par le WAF.
EOF
read -r -p "Confirmer le lancement sur CETTE cible autorisée ? [oui/non] " ans
[[ "$ans" == "oui" ]] || { echo "Annulé."; exit 0; }

# --- Émission ---------------------------------------------------------------
echo ">>> START $(date -Is)  [label=$LABEL]"   # borne nette pour le Clip Chrono
sent=0; blocked=0
trap 'echo; echo ">>> STOP  $(date -Is)  [label=$LABEL]  envoyés=$sent bloqués=$blocked"' EXIT

for ((r = 1; r <= ROUNDS; r++)); do
  for v in "${VECTORS[@]}"; do
    # GET avec le vecteur dans un paramètre, étiqueté pour Loki/WOR-50.
    code=$(curl -s -o /dev/null -m 5 -w '%{http_code}' \
      -H "X-Attack-Label: $LABEL" \
      --get "$BASE" --data-urlencode "${PARAM}=${v}" || echo "000")
    sent=$((sent + 1))
    [[ "$code" == "403" ]] && blocked=$((blocked + 1))
    printf '  [r%d] %-3s  %s\n' "$r" "$code" "$v"
    sleep "$DELAY"
  done
done
# le trap EXIT affiche le STOP et le bilan

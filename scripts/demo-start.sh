#!/usr/bin/env bash
#
# demo-start — lance l'interface web de la démo MFA (consigne additionnelle 1).
# Le back-office (API) et le WAF tournent déjà dans la stack Docker ; ce script ne
# démarre que le FRONT (serveur de dev Vite) et le fait pointer sur le WAF.
#
# Usage : scripts/demo-start.sh [HOST_IP]
#   HOST_IP : IP du PC Hôte sur le WiFi du groupe (auto-détectée sinon).
#
# Ouvrir ensuite http://localhost:5173 (la caméra n'est autorisée que sur localhost/https).
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
HOST_IP="${1:-$(ip route get 1.1.1.1 2>/dev/null | awk '{print $7; exit}')}"
[ -z "${HOST_IP:-}" ] && { echo "IP du PC Hôte introuvable — passez-la en argument : scripts/demo-start.sh <HOST_IP>" >&2; exit 1; }

API="http://${HOST_IP}:8080"
echo "────────────────────────────────────────────────────────"
echo "  Back-office (via WAF) : ${API}"
echo "  Interface démo        : http://localhost:5173"
echo "  (ouvrez bien localhost — la caméra est bloquée sur une IP en http)"
echo "────────────────────────────────────────────────────────"

# Vérif rapide que l'API répond
if ! curl -fsS -m 3 "${API}/v1/device/led" >/dev/null 2>&1; then
  echo "⚠  L'API ne répond pas sur ${API}. Vérifiez WAF_BIND=${HOST_IP} dans infra/.env puis :"
  echo "   cd ansible && ansible-playbook playbooks/deploy.yml"
fi

cd "${REPO_ROOT}/services/payment-api"
[ -d node_modules ] || npm ci
exec env VITE_PAYMENT_API_URL="${API}" npm run dev

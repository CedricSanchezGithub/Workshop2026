#!/usr/bin/env bash
#
# demo-led — prépare l'objet connecté (LED ESP8266) de la consigne additionnelle 1.
#
# L'ESP8266 interroge GET /v1/device/led sur le WAF du PC Hôte : le WAF doit donc être
# publié sur l'IP WiFi du PC Hôte, et cette IP doit être écrite dans le firmware.
#
# Usage : scripts/demo-led.sh <commande> [HOST_IP]
#   publish   publie le WAF sur l'IP WiFi du PC Hôte (WAF_BIND de infra/.env) et vérifie le canal
#   flash     écrit WiFi + URL du canal dans config.h, compile et flashe l'ESP8266 (carte en USB)
#   test      sans caméra : LED rouge (mauvais mot de passe) puis verte (bon mot de passe)
#   status    affiche le signal courant du canal LED
#   local     remet le WAF sur 127.0.0.1 (après la démo)
#
# HOST_IP est détectée automatiquement (interface de la route par défaut) si absente.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="${REPO_ROOT}/infra/.env"
FIRMWARE="${REPO_ROOT}/iot/led-indicator"
CONFIG="${FIRMWARE}/include/config.h"
PIO="$(command -v pio || echo "${HOME}/.local/bin/pio")"

CMD="${1:-}"
HOST_IP="${2:-$(ip route get 1.1.1.1 2>/dev/null | awk '{for (i = 1; i < NF; i++) if ($i == "src") { print $(i + 1); exit }}')}"
[ -z "${HOST_IP}" ] && { echo "IP du PC Hôte introuvable : passez-la en argument." >&2; exit 1; }
API="http://${HOST_IP}:8080"

# Compte jetable pour le test sans caméra (aucun visage enrôlé => pas d'étape caméra).
TEST_EMAIL="led-test@example.test"
TEST_PASSWORD="led-test-1234"

# Remplace la valeur d'un #define chaîne de config.h (échappement C via JSON, sûr pour tout mot de passe).
set_define() {
  python3 - "$CONFIG" "$1" "$2" <<'PY'
import json, re, sys
path, name, value = sys.argv[1:]
text = open(path).read()
text, n = re.subn(rf'^(#define\s+{name}\s+).*$', lambda m: m.group(1) + json.dumps(value), text, flags=re.M)
if n == 0:
    text += f'#define {name} {json.dumps(value)}\n'
open(path, 'w').write(text)
PY
}

get_define() { sed -nE "s/^#define[[:space:]]+$1[[:space:]]+\"(.*)\".*/\1/p" "$CONFIG"; }

restart_waf() {
  if grep -q '^WAF_BIND=' "$ENV_FILE"; then sed -i "s/^WAF_BIND=.*/WAF_BIND=$1/" "$ENV_FILE"; else echo "WAF_BIND=$1" >> "$ENV_FILE"; fi
  echo ">>> WAF publié sur $1:8080"
  (cd "${REPO_ROOT}/infra" && docker compose up -d --wait waf)
}

led_status() { curl -fsS -m 3 "${API}/v1/device/led" && echo; }

case "$CMD" in
  publish)
    restart_waf "$HOST_IP"
    if led_status; then
      echo "OK : canal LED joignable sur ${API}/v1/device/led"
    else
      echo "⚠  ${API}/v1/device/led ne répond pas. Le reste de la stack tourne-t-il ? (scripts/setup.sh)" >&2
      exit 1
    fi
    ;;

  flash)
    if [ ! -f "$CONFIG" ]; then
      cp "${FIRMWARE}/include/config.example.h" "$CONFIG"
      echo ">>> config.h créé depuis config.example.h"
    fi
    ssid="$(get_define WIFI_SSID)"
    read -rp "WiFi (2,4 GHz) que l'ESP doit rejoindre [${ssid}] : " answer
    if [ -n "$answer" ] && [ "$answer" != "$ssid" ]; then
      set_define WIFI_SSID "$answer"
      read -rsp "Mot de passe de ${answer} : " password; echo
      set_define WIFI_PASSWORD "$password"
    elif [ "$(get_define WIFI_PASSWORD)" = "change-me" ]; then
      read -rsp "Mot de passe de ${ssid} : " password; echo
      set_define WIFI_PASSWORD "$password"
    fi
    set_define LED_ENDPOINT "${API}/v1/device/led"
    echo ">>> config.h : WiFi $(get_define WIFI_SSID), canal $(get_define LED_ENDPOINT)"
    if ! ls /dev/ttyUSB* /dev/ttyACM* >/dev/null 2>&1; then
      echo "⚠  Aucune carte détectée (/dev/ttyUSB*). Câble USB de données ? Si brltty est installé, il capte" >&2
      echo "   la puce CH340 : sudo apt remove brltty, puis rebrancher la carte." >&2
      exit 1
    fi
    "$PIO" run -d "$FIRMWARE" -t upload
    echo "OK : firmware flashé. Journal série : $PIO device monitor -d iot/led-indicator"
    echo "     attendu : [wifi] OK, IP ...   puis [led] signal=... à chaque connexion"
    ;;

  test)
    curl -s -o /dev/null -X POST "${API}/v1/auth/register" -H 'Content-Type: application/json' \
      -d "{\"name\":\"Test LED\",\"email\":\"${TEST_EMAIL}\",\"password\":\"${TEST_PASSWORD}\"}"
    echo ">>> Mauvais mot de passe : la LED doit clignoter ROUGE 10 fois"
    curl -s -o /dev/null -X POST "${API}/v1/auth/login" -H 'Content-Type: application/json' \
      -d "{\"email\":\"${TEST_EMAIL}\",\"password\":\"mauvais-mot-de-passe\"}"
    led_status
    sleep 5
    echo ">>> Bon mot de passe : la LED doit rester VERTE 30 s"
    curl -s -o /dev/null -X POST "${API}/v1/auth/login" -H 'Content-Type: application/json' \
      -d "{\"email\":\"${TEST_EMAIL}\",\"password\":\"${TEST_PASSWORD}\"}"
    led_status
    ;;

  status)
    led_status
    ;;

  local)
    API="http://127.0.0.1:8080"
    restart_waf 127.0.0.1
    ;;

  *)
    sed -n '3,15p' "$0" | sed 's/^# \{0,1\}//'
    exit 1
    ;;
esac

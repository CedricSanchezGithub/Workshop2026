#!/usr/bin/env bash
#
# export-logs — WOR-65
#
# Exporte les journaux de la plateforme depuis Loki vers un dossier de PREUVES, pour
# l'investigation après un incident. Indispensable AVANT une remise à l'état sain
# (`reset-known-good.sh`), qui purge les volumes et efface les journaux de Loki.
#
# Produit, dans evidence/incident-<horodatage>/ :
#   - loki-raw.json : réponse Loki brute (fidélité maximale, horodatage à la nanoseconde)
#   - timeline.txt  : toutes les lignes triées par le temps, préfixées de l'heure et du service
#   - manifest.txt  : fenêtre, requête, nombre de lignes, empreinte SHA-256 des deux fichiers
#
# Usage (depuis la racine ou n'importe où) :
#   scripts/export-logs.sh [--since 1h] [--until now] [--containers waf,vault,postgres]
#                          [--filter '|~ "denied|403"'] [--out-dir <dir>]
#
#   --since      début de la fenêtre : 30m / 2h / 1d, ou une expression `date -d` ("1 hour ago")
#   --until      fin de la fenêtre (défaut : now)
#   --containers liste de services séparés par des virgules (défaut : tous)
#   --filter     pipeline LogQL ajouté au sélecteur (ex. '|~ "denied|sqli"')
#   --out-dir    dossier de sortie (défaut : <dépôt>/evidence)
#
set -euo pipefail

LOKI="${LOKI_ADDR:-http://127.0.0.1:3100}"
SINCE="1h"; UNTIL="now"; CONTAINERS=""; FILTER=""; OUT_DIR=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --since)      SINCE="$2"; shift 2 ;;
    --until)      UNTIL="$2"; shift 2 ;;
    --containers) CONTAINERS="$2"; shift 2 ;;
    --filter)     FILTER="$2"; shift 2 ;;
    --out-dir)    OUT_DIR="$2"; shift 2 ;;
    -h|--help)    grep -E '^#( |$)' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) echo "Argument inconnu : $1" >&2; exit 1 ;;
  esac
done

# Fenêtres : accepte 30m / 2h / 1d (relatif à maintenant) ou une expression date -d.
to_epoch() {
  local v="$1"
  if [[ "$v" == "now" ]]; then date +%s; return; fi
  if [[ "$v" =~ ^([0-9]+)([smhd])$ ]]; then
    local n="${BASH_REMATCH[1]}" u="${BASH_REMATCH[2]}"
    case "$u" in s) u=sec;; m) u=min;; h) u=hour;; d) u=day;; esac
    date -d "$n $u ago" +%s; return
  fi
  date -d "$v" +%s
}
START_NS="$(to_epoch "$SINCE")000000000"
END_NS="$(to_epoch "$UNTIL")000000000"

# Sélecteur LogQL
if [[ -n "$CONTAINERS" ]]; then
  SELECTOR="{container=~\"${CONTAINERS//,/|}\"}"
else
  SELECTOR='{container=~".+"}'
fi
QUERY="$SELECTOR${FILTER:+ $FILTER}"

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
[[ -z "$OUT_DIR" ]] && OUT_DIR="$REPO_ROOT/evidence"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
DEST="$OUT_DIR/incident-$STAMP"
mkdir -p "$DEST"

echo ">>> Export Loki"
echo "    Loki    : $LOKI"
echo "    Fenêtre : $SINCE -> $UNTIL"
echo "    Requête : $QUERY"

curl -sf -G "$LOKI/loki/api/v1/query_range" \
  --data-urlencode "query=$QUERY" \
  --data-urlencode "start=$START_NS" \
  --data-urlencode "end=$END_NS" \
  --data-urlencode "limit=5000" \
  --data-urlencode "direction=forward" \
  -o "$DEST/loki-raw.json" || { echo "Échec de la requête Loki (plateforme démarrée ?)" >&2; exit 2; }

# Aplatissement trié par le temps (horodatage de chaque ligne, pas d'ingestion)
python3 -I - "$DEST/loki-raw.json" "$DEST/timeline.txt" <<'PY'
import sys, json, datetime
raw, out = sys.argv[1], sys.argv[2]
with open(raw) as f:
    data = json.load(f)
rows = []
for s in data.get("data", {}).get("result", []):
    c = s["stream"].get("container", "?")
    for ts, line in s["values"]:
        rows.append((int(ts), c, line))
rows.sort()
with open(out, "w") as f:
    for ts, c, line in rows:
        t = datetime.datetime.fromtimestamp(ts / 1e9).isoformat(timespec="milliseconds")
        f.write(f"{t}  {c:<12}  {line}\n")
print(f"{len(rows)}")
PY
COUNT="$(tail -1 "$DEST/timeline.txt" >/dev/null 2>&1; wc -l < "$DEST/timeline.txt" | tr -d ' ')"

{
  echo "incident export $STAMP"
  echo "loki        : $LOKI"
  echo "fenetre     : $SINCE -> $UNTIL  (start_ns=$START_NS end_ns=$END_NS)"
  echo "requete     : $QUERY"
  echo "lignes      : $COUNT"
  echo "sha256:"
  (cd "$DEST" && sha256sum loki-raw.json timeline.txt)
} > "$DEST/manifest.txt"

echo ">>> $COUNT lignes exportées"
echo ">>> Preuves : $DEST"
echo "    (conserver AVANT tout reset-known-good : il efface les journaux de Loki)"

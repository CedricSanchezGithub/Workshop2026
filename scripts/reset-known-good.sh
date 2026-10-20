#!/usr/bin/env bash
#
# reset-known-good — WOR-90
#
# Remet la plateforme dans un état sain connu entre les répétitions et avant le
# jury. Idempotent : même résultat quel que soit l'état de départ (attaque A ou B
# jouée, conteneurs quarantainés, rate-limits/blocages WAF en place, dashboards
# pollués).
#
# Méthode : on réutilise le chemin Ansible déjà en place (idempotent par nature) :
#   1. teardown purge=true  -> arrêt + suppression des volumes
#        => BDD repartie du seed, effets d'attaque (rate-limit/WAF/quarantaine)
#           effacés, métriques Prometheus et journaux Loki remis à zéro.
#   2. [--rotate-secrets]    -> on supprime infra/.env avant le déploiement pour
#        que deploy.yml régénère des secrets aléatoires (réponse scénario B).
#   3. deploy.yml            -> redémarre la stack et attend les healthchecks,
#        puis importe verify.yml (santé réelle des services, cf WOR-77).
#
# Si Ansible n'est pas disponible (ex. PC de démo minimal), bascule sur un
# chemin docker compose équivalent.
#
# Usage (depuis la racine du dépôt ou n'importe où) :
#     scripts/reset-known-good.sh [--rotate-secrets] [--yes]
#
#   --rotate-secrets   régénère les mots de passe (à jouer après le scénario B)
#   --yes              ne pas demander de confirmation
#
set -euo pipefail

ROTATE=false
ASSUME_YES=false
for arg in "$@"; do
  case "$arg" in
    --rotate-secrets) ROTATE=true ;;
    --yes|-y)         ASSUME_YES=true ;;
    -h|--help)        grep -E '^#( |$)' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) echo "Argument inconnu : $arg" >&2; exit 1 ;;
  esac
done

# --- Localisation du dépôt --------------------------------------------------
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
INFRA_DIR="$REPO_ROOT/infra"
ANSIBLE_DIR="$REPO_ROOT/ansible"
ENV_FILE="$INFRA_DIR/.env"

# --- Confirmation -----------------------------------------------------------
echo "reset-known-good (WOR-90)"
echo "  Dépôt            : $REPO_ROOT"
echo "  Volumes purgés   : oui (BDD, métriques, journaux repartent du seed)"
echo "  Rotation secrets : $($ROTATE && echo oui || echo non)"
if ! $ASSUME_YES; then
  read -r -p "Tout remettre à l'état sain connu ? [oui/non] " ans
  [[ "$ans" == "oui" ]] || { echo "Annulé."; exit 0; }
fi

echo ">>> RESET START $(date -Is)"

# --- Rotation des secrets (optionnel) ---------------------------------------
# deploy.yml ne régénère les secrets que s'il crée infra/.env. On le supprime
# donc pour forcer la régénération. La purge des volumes (étape suivante) permet
# à Postgres de réinitialiser avec le nouveau mot de passe.
if $ROTATE && [[ -f "$ENV_FILE" ]]; then
  echo ">>> Rotation des secrets : suppression de infra/.env (sera régénéré)"
  rm -f "$ENV_FILE"
fi

# --- Chemin Ansible (préféré) -----------------------------------------------
if command -v ansible-playbook >/dev/null 2>&1; then
  echo ">>> Ansible détecté : teardown (purge) puis deploy + verify"
  cd "$ANSIBLE_DIR"
  ansible-playbook playbooks/teardown.yml -e purge=true
  ansible-playbook playbooks/deploy.yml     # deploy.yml importe verify.yml (WOR-77)
  echo ">>> RESET OK $(date -Is)"
  exit 0
fi

# --- Repli docker compose ---------------------------------------------------
echo ">>> Ansible absent : repli sur docker compose"
command -v docker >/dev/null 2>&1 || { echo "docker introuvable." >&2; exit 2; }

if [[ ! -f "$ENV_FILE" ]]; then
  echo "infra/.env absent. Créez-le depuis infra/.env.example (ou lancez le déploiement" >&2
  echo "Ansible) avant un reset avec rotation de secrets." >&2
  exit 2
fi

cd "$INFRA_DIR"
echo ">>> down -v (arrêt + purge des volumes)"
docker compose down -v --remove-orphans
echo ">>> up -d --wait (redémarrage + healthchecks)"
docker compose up -d --wait

# Vérif santé minimale (équivalent réduit de verify.yml / WOR-77)
echo ">>> Vérification santé"
fail=0
check() { # <nom> <url>
  if curl -fsS -m 5 "$2" >/dev/null 2>&1; then echo "  OK   $1"; else echo "  KO   $1 ($2)"; fail=1; fi
}
GRAFANA_BIND="$(grep -E '^GRAFANA_BIND=' "$ENV_FILE" | cut -d= -f2)"; GRAFANA_BIND="${GRAFANA_BIND:-127.0.0.1}"
check "Prometheus" "http://127.0.0.1:9090/-/ready"
check "Loki"       "http://127.0.0.1:3100/ready"
GRAFANA_PORT="$(grep -E '^GRAFANA_PORT=' "$ENV_FILE" | cut -d= -f2)"; GRAFANA_PORT="${GRAFANA_PORT:-3000}"
check "Grafana"    "http://${GRAFANA_BIND}:${GRAFANA_PORT}/api/health"
if docker compose exec -T postgres sh -c 'pg_isready -U "$POSTGRES_USER" -d "$POSTGRES_DB"' >/dev/null 2>&1; then
  echo "  OK   PostgreSQL"
else
  echo "  KO   PostgreSQL"; fail=1
fi

if [[ $fail -ne 0 ]]; then
  echo ">>> RESET INCOMPLET $(date -Is) : au moins un service n'est pas sain." >&2
  exit 3
fi
echo ">>> RESET OK $(date -Is)"

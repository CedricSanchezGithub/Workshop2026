#!/usr/bin/env bash
#
# deploy.sh — installe ou met à jour le site de la gouvernance sur une machine de diffusion
# (par exemple un Raspberry Pi), en ne récupérant que docs/gouvernance du dépôt.
#
# Premier lancement : clone partiel (sparse checkout) puis construction de l'image.
# Lancements suivants : ne reconstruit que si docs/gouvernance a changé sur la branche suivie.
# Idempotent : peut tourner en tâche planifiée.
#
# Usage :
#     curl -fsSL https://raw.githubusercontent.com/CedricSanchezGithub/Workshop2026/main/docs/gouvernance/site/deploy.sh | bash
#   ou, une fois installé :
#     ~/workshop2026/docs/gouvernance/site/deploy.sh [--force]
#
# Variables (facultatives) :
#   REPO_URL   dépôt à suivre        (défaut : https://github.com/CedricSanchezGithub/Workshop2026.git)
#   BRANCH     branche suivie        (défaut : main)
#   DEST       dossier local         (défaut : ~/workshop2026)
#
# Tâche planifiée (toutes les 30 min) :
#   */30 * * * * ~/workshop2026/docs/gouvernance/site/deploy.sh >> ~/gouvernance-site.log 2>&1

set -euo pipefail

REPO_URL="${REPO_URL:-https://github.com/CedricSanchezGithub/Workshop2026.git}"
BRANCH="${BRANCH:-main}"
DEST="${DEST:-$HOME/workshop2026}"
SUBDIR="docs/gouvernance"
COMPOSE="$DEST/$SUBDIR/site/docker-compose.yml"
FORCE=0
[[ "${1:-}" == "--force" ]] && FORCE=1

log() { echo "[$(date '+%F %T')] $*"; }

for cmd in git docker; do
  command -v "$cmd" >/dev/null || { log "Erreur : $cmd est introuvable." >&2; exit 1; }
done

if [[ ! -d "$DEST/.git" ]]; then
  log "Premier déploiement : clone partiel de $SUBDIR dans $DEST"
  git clone --quiet --filter=blob:none --no-checkout --branch "$BRANCH" "$REPO_URL" "$DEST"
  git -C "$DEST" sparse-checkout set "$SUBDIR"
  git -C "$DEST" checkout --quiet "$BRANCH"
  FORCE=1
else
  git -C "$DEST" fetch --quiet origin "$BRANCH"
  if git -C "$DEST" diff --quiet HEAD "origin/$BRANCH" -- "$SUBDIR" && [[ $FORCE -eq 0 ]]; then
    log "Aucun changement dans $SUBDIR : rien à faire."
    exit 0
  fi
  log "Changements détectés : mise à jour"
  git -C "$DEST" merge --quiet --ff-only "origin/$BRANCH"
fi

log "Construction et redémarrage du site"
docker compose -f "$COMPOSE" up --build --detach --quiet-pull
docker image prune --force --filter "label=com.docker.compose.project=gouvernance-site" >/dev/null || true

log "Site à jour : $(git -C "$DEST" log -1 --format='%h %s')"
log "Accès local : http://127.0.0.1:8095 — partage tailnet : sudo tailscale serve --bg 8095"

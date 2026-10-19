#!/usr/bin/env bash
# setup — installe et démarre toute la plateforme en une commande (WOR-49)
#
# Vérifie les prérequis, installe la collection Ansible si besoin, déploie la plateforme
# (Vault, secrets, PostgreSQL, Prometheus, Loki + Alloy, Grafana), vérifie qu'elle répond,
# puis propose de créer votre compte Vault.
#
# Usage : ./scripts/setup.sh [--no-account]
# Relançable sans risque : chaque étape est idempotente.
set -euo pipefail

cd "$(dirname "$0")/../ansible"

fail() { echo "✗ $1" >&2; exit 1; }
ok()   { echo "✓ $1"; }

command -v docker >/dev/null || fail "Docker introuvable : https://docs.docker.com/engine/install/"
docker compose version >/dev/null 2>&1 || fail "Plugin Docker Compose introuvable (paquet docker-compose-plugin)"
docker info >/dev/null 2>&1 || fail "Docker inaccessible sans sudo : sudo usermod -aG docker \$USER, puis se déconnecter/reconnecter"
ok "Docker $(docker version --format '{{.Server.Version}}'), Compose $(docker compose version --short)"

command -v ansible-playbook >/dev/null || fail "Ansible introuvable : sudo apt install ansible-core (≥ 2.17) ou pipx install ansible-core"
ok "$(ansible --version | head -1)"

if [ ! -d collections/ansible_collections/community/docker ]; then
  echo "→ Installation de la collection community.docker"
  ansible-galaxy collection install -r requirements.yml -p ./collections
fi
ok "Collection community.docker présente"

echo "→ Déploiement (2 à 3 minutes au premier lancement : téléchargement des images)"
ansible-playbook playbooks/deploy.yml

if [ "${1:-}" != "--no-account" ] && [ -t 0 ]; then
  read -rp "Créer (ou réinitialiser) votre compte Vault maintenant ? [O/n] " answer
  case "$answer" in
    n|N) ;;
    *) ansible-playbook playbooks/vault-user.yml ;;
  esac
fi

cat <<'EOF'

Plateforme prête :
  Grafana     http://127.0.0.1:3000      utilisateur admin, mot de passe :
              docker compose -f infra/docker-compose.yml exec grafana cat /run/secrets/grafana/admin_password
  Vault       http://127.0.0.1:8200/ui   méthode « Username » (partie de votre e-mail avant @)
  Prometheus  http://127.0.0.1:9090
  Loki        Grafana → Explore → Loki
EOF

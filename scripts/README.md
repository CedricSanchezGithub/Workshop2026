# scripts/ — Utilitaires d'exploitation

- `setup.sh` — installe et démarre toute la plateforme en une commande : prérequis, collection Ansible,
  déploiement + vérification, création du compte Vault (WOR-49). `--no-account` pour sauter ce dernier point.
- `reset-known-good.sh` — remise de la plateforme dans un état sain connu entre les
  répétitions et avant le jury (WOR-90). Idempotent, vérifie la santé en fin (cf WOR-77).

  Réutilise le chemin Ansible (`teardown purge=true` → `deploy.yml` → `verify.yml`) ;
  repli sur `docker compose down -v` + `up --wait` si Ansible est absent.

      scripts/reset-known-good.sh [--rotate-secrets] [--yes]

  - `--rotate-secrets` : régénère les mots de passe (à jouer après le scénario B)
  - `--yes` : pas de confirmation

- `export-logs.sh` — exporte les journaux depuis Loki vers `evidence/incident-<horodatage>/`
  (JSON brut + timeline triée + manifeste SHA-256) pour l'investigation (WOR-65). **À lancer
  AVANT `reset-known-good.sh`**, qui efface les journaux de Loki. Voir `docs/runbooks/investigation.md`.

      scripts/export-logs.sh [--since 1h] [--containers waf,vault] [--filter '|~ "denied"']

- `pdf/` — génère les PDF des dossiers à partir des .md de `docs/` (aujourd'hui le dossier de
  gouvernance), dans `livrables/`. Utilise le Chrome ou l'Edge installé (`CHROME_PATH` sinon).

      cd scripts/pdf && npm install && npm run build

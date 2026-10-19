# scripts/ — Utilitaires d'exploitation

- `reset-known-good.sh` — remise de la plateforme dans un état sain connu entre les
  répétitions et avant le jury (WOR-90). Idempotent, vérifie la santé en fin (cf WOR-77).

  Réutilise le chemin Ansible (`teardown purge=true` → `deploy.yml` → `verify.yml`) ;
  repli sur `docker compose down -v` + `up --wait` si Ansible est absent.

      scripts/reset-known-good.sh [--rotate-secrets] [--yes]

  - `--rotate-secrets` : régénère les mots de passe (à jouer après le scénario B)
  - `--yes` : pas de confirmation

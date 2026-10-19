# scripts/ — Utilitaires d'exploitation

- `setup.sh` — installe et démarre toute la plateforme en une commande : prérequis, collection Ansible,
  déploiement + vérification, création du compte Vault (WOR-49). `--no-account` pour sauter ce dernier point.
- `reset-known-good.sh` — remise de la plateforme dans un état sain connu entre les
  répétitions et avant le jury (WOR-90). Idempotent, vérifie la santé en fin (cf WOR-77).

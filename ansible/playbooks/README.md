# Playbooks (WOR-44)

| Playbook | Rôle | État |
|---|---|---|
| `deploy.yml` | Crée `infra/.env` depuis `infra/.env.example` si absent (mots de passe remplacés par des secrets aléatoires, refuse `change-me`), lance la stack, attend les healthchecks puis enchaîne sur `verify.yml` | ✅ |
| `verify.yml` | Vérifie que chaque service **répond** (Postgres, Prometheus, Loki, Grafana, cibles Prometheus UP) | ✅ |
| `teardown.yml` | Arrête la stack, conserve les données (`-e purge=true` pour tout supprimer) | ✅ |
| `restore.yml` | Restauration données / configuration | à faire |
| `remediate.yml` | Actions appelées par le moteur de remédiation (WOR-38) | à faire |

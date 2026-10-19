# Playbooks (WOR-44)

| Playbook | Rôle | État |
|---|---|---|
| `deploy.yml` | Crée `infra/.env` (config non secrète) si absent, initialise / descelle / configure Vault (`tasks/vault-bootstrap.yml`), lance la stack, attend les healthchecks puis enchaîne sur `verify.yml`. Relancé après un redémarrage, il redescelle Vault | ✅ |
| `verify.yml` | Vérifie que chaque service **répond** (Vault descellé, Postgres et Grafana acceptent les mots de passe de Vault, Prometheus, Loki, cibles UP) et qu'aucun secret n'est dans l'environnement des conteneurs | ✅ |
| `teardown.yml` | Arrête la stack, conserve les données (`-e purge=true` supprime aussi les volumes et les clés Vault locales) | ✅ |
| `restore.yml` | Restauration données / configuration | à faire |
| `remediate.yml` | Actions appelées par le moteur de remédiation (WOR-38) | à faire |

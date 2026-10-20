# Grafana provisioning — datasources + dashboards (WOR-47)

Tout en IaC, chargé au démarrage, non modifiable depuis l'UI (`editable: false`) pour qu'un
déploiement soit reproductible.

- `datasources/datasources.yml` — Prometheus (défaut) + Loki.
- `dashboards/dashboards.yml` — provider : charge les `*.json` de ce dossier dans le dossier
  Grafana « Sécurité ».
- `dashboards/soc-siem.json` — **dashboard SOC / SIEM** (WOR-61) : corrélation des événements
  de sécurité issus de Loki (blocages WAF 403, injections CRS `942xxx`, audit Vault) et flux
  corrélé multi-services. `deploy.yml` redémarre Grafana si un fichier change (`config_watch`).

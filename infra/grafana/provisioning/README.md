# Grafana provisioning — datasources + dashboards (WOR-47)

Tout en IaC, chargé au démarrage, non modifiable depuis l'UI (`editable: false`) pour qu'un
déploiement soit reproductible.

- `datasources/datasources.yml` — Prometheus (défaut) + Loki.
- `dashboards/dashboards.yml` — provider : charge les `*.json` de ce dossier dans le dossier
  Grafana « Sécurité ».
- `dashboards/soc-siem.json` — **dashboard SOC / SIEM** (WOR-61) : corrélation des événements
  de sécurité issus de Loki (blocages WAF 403, injections CRS `942xxx`, audit Vault) et flux
  corrélé multi-services. `deploy.yml` redémarre Grafana si un fichier change (`config_watch`).
- `dashboards/platform-overview.json` — **Plateforme — santé des services et paiements** :
  transaction de test du moteur, cibles Prometheus, API Pay&Go (débit par statut, latence p95/p99,
  paiements par issue, 5xx/429, routes), trafic au WAF par IP client et par statut (Loki),
  reconnaissance faciale, erreurs BDD, volume de journaux.
- `dashboards/detection-remediation.json` — **Détection ML et reprise autonome** : état des
  alertes par famille, transaction de test, incidents résolus / escalades, durée de reprise,
  chronologie avant/pendant/après, scores Isolation Forest et seuils, écart à l'enveloppe,
  alertes signées (envoyées / reçues), refus de la règle WAF 1001 (liste de blocage), annotations
  des alertes ML.

Les trois tableaux sont liés entre eux (tag `resilience-alpha`). Les métriques du moteur de
remédiation (sur l'hôte) sont collectées par le job Prometheus `remediation`
(`host.docker.internal:8090`).

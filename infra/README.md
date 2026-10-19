# infra/ — Infrastructure & Observabilité

Responsable Infrastructure : Reza. Déploiement reproductible (WOR-49).

| Élément | Rôle | Ticket |
|---|---|---|
| `docker-compose.yml` | Tous les microservices, réseaux segmentés, healthchecks, limites | WOR-43 |
| `prometheus/` | Scrape + règles d'alerte | WOR-45 |
| `loki/` | Centralisation des logs (+ agent Promtail/Alloy) | WOR-46 |
| `grafana/provisioning/` | Datasources + dashboards provisionnés (IaC) | WOR-47 |
| `waf/` | Filtrage applicatif devant front + API | WOR-60 |

> Elastic Stack non retenu (charge mémoire du PC Hôte) — cf sujet §3.2.

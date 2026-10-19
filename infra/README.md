# infra/ — Infrastructure & Observabilité

Responsable Infrastructure : Reza. Déploiement reproductible (WOR-49).

| Élément | Rôle | Ticket | État |
|---|---|---|---|
| `docker-compose.yml` | Tous les microservices, réseaux segmentés, healthchecks, limites | WOR-43 | socle en place (Postgres + observabilité), services métier à ajouter |
| `prometheus/` | Scrape + règles d'alerte | WOR-45 | scrape du socle ; exporters et alertes à faire |
| `loki/` | Centralisation des logs (+ agent Promtail/Alloy) | WOR-46 | Loki opérationnel ; agent de collecte à faire |
| `grafana/provisioning/` | Datasources + dashboards provisionnés (IaC) | WOR-47 | datasources provisionnées ; dashboards à faire |
| `waf/` | Filtrage applicatif devant front + API | WOR-60 | à faire |

> Elastic Stack non retenu (charge mémoire du PC Hôte) — cf sujet §3.2.

## Déployer

Prérequis (PC Hôte Linux) : Docker Engine + plugin Compose ≥ 2.20, Ansible ≥ 2.15, utilisateur dans le groupe `docker`.

```bash
cd ansible
ansible-galaxy collection install -r requirements.yml -p ./collections   # une seule fois
ansible-playbook playbooks/deploy.yml      # génère infra/.env si absent, lance, vérifie
ansible-playbook playbooks/verify.yml      # revérifier à tout moment
ansible-playbook playbooks/teardown.yml    # arrêter (données conservées ; -e purge=true pour tout supprimer)
```

Relancer `deploy.yml` est sans effet si tout est déjà en place (idempotent).
Sans Ansible (dépannage) : `cp .env.example .env`, changer les mots de passe, puis `docker compose up -d --wait` depuis `infra/`.

## Accès

| Service | URL | Exposition |
|---|---|---|
| Grafana | `http://<GRAFANA_BIND>:3000` | `127.0.0.1` par défaut, `192.168.137.1` le jour de la démo |
| Prometheus | `http://127.0.0.1:9090` | PC Hôte uniquement |
| Loki | `http://127.0.0.1:3100` | PC Hôte uniquement |
| PostgreSQL | — | Jamais publié (réseau `backend` interne) |

Identifiants Grafana : `GRAFANA_ADMIN_USER` / `GRAFANA_ADMIN_PASSWORD` dans `infra/.env`.

Console SQL : `docker compose exec postgres sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"'` (depuis `infra/`).

## Réseaux

| Réseau | Services | Particularité |
|---|---|---|
| `backend` | postgres (+ futurs services métier) | `internal: true` : aucun accès sortant, aucun port publiable |
| `monitoring` | prometheus, loki, grafana | Seul Grafana est publié |

## Choix techniques

- **Versions figées** (`postgres:18.6-alpine`, `prom/prometheus:v3.15.0`, `grafana/loki:3.7.8`,
  `grafana/grafana:13.2.4`) : un déploiement de jeudi doit être identique à celui de lundi.
- **Scrape toutes les 5 s** : la détection doit tenir dans les 60 s du Clip Chrono.
- **Durcissement de base** : `no-new-privileges`, `cap_drop: ALL` sur les services non-root,
  limites CPU et mémoire, rotation des journaux Docker (3 × 10 Mo).
- **Postgres 18** : le volume est monté sur `/var/lib/postgresql` (nouvelle disposition de l'image 18).
- **Loki** : image distroless sans shell, donc pas de healthcheck Docker ; sa disponibilité est
  contrôlée par `verify.yml` (`/ready`) et par Prometheus (`up{job="loki"}`).
- **Secrets** : aucun secret dans le dépôt ; `infra/.env` est créé par Ansible à partir de `.env.example`
  (mots de passe remplacés par des secrets aléatoires, droits `600`) et ignoré par Git ; le déploiement est
  refusé si un mot de passe vaut encore `change-me`.
  Passage à SOPS/Vault prévu (pilier Cyber).

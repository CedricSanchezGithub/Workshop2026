# infra/ — Infrastructure & Observabilité

Responsable Infrastructure : Reza. Déploiement reproductible (WOR-49).

| Élément | Rôle | Ticket | État |
|---|---|---|---|
| `docker-compose.yml` | Tous les microservices, réseaux segmentés, healthchecks, limites | WOR-43 | socle en place (Postgres + observabilité), services métier à ajouter |
| `prometheus/` | Scrape + règles d'alerte | WOR-45 | scrape du socle ; exporters et alertes à faire |
| `loki/` | Centralisation des logs (+ agent Promtail/Alloy) | WOR-46 | Loki opérationnel ; agent de collecte à faire |
| `grafana/provisioning/` | Datasources + dashboards provisionnés (IaC) | WOR-47 | datasources provisionnées ; dashboards à faire |
| `vault/` | Gestion des secrets : HashiCorp Vault + Vault Agent | WOR-62 | en place (Postgres, Grafana) |
| `waf/` | Filtrage applicatif devant front + API | WOR-60 | à faire |

> Elastic Stack non retenu (charge mémoire du PC Hôte) — cf sujet §3.2.

## Déployer

Prérequis (PC Hôte Linux) : Docker Engine + plugin Compose ≥ 2.20, Ansible ≥ 2.15, utilisateur dans le groupe `docker`.

```bash
cd ansible
ansible-galaxy collection install -r requirements.yml -p ./collections   # une seule fois
ansible-playbook playbooks/deploy.yml      # crée infra/.env si absent, initialise/descelle Vault, lance, vérifie
ansible-playbook playbooks/verify.yml      # revérifier à tout moment
ansible-playbook playbooks/teardown.yml    # arrêter (données conservées ; -e purge=true pour tout supprimer)
```

Relancer `deploy.yml` est sans effet si tout est déjà en place (idempotent).
Vault doit être initialisé et descellé avant le reste de la stack : passer par `deploy.yml`
(un `docker compose up` seul attendra indéfiniment que Vault soit descellé).

## Accès

| Service | URL | Exposition |
|---|---|---|
| Grafana | `http://<GRAFANA_BIND>:3000` | `127.0.0.1` par défaut, `192.168.137.1` le jour de la démo |
| Prometheus | `http://127.0.0.1:9090` | PC Hôte uniquement |
| Loki | `http://127.0.0.1:3100` | PC Hôte uniquement |
| PostgreSQL | — | Jamais publié (réseau `backend` interne) |
| Vault (UI + API) | `http://127.0.0.1:8200/ui` | PC Hôte uniquement |

Identifiants Grafana : utilisateur `GRAFANA_ADMIN_USER` (`infra/.env`), mot de passe dans Vault (`secret/platform/grafana`).

Jeton root Vault (UI, dépannage) : `root_token` dans `infra/secrets/vault-init.json`.

Console SQL : `docker compose exec postgres sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"'` (depuis `infra/`).

## Réseaux

| Réseau | Services | Particularité |
|---|---|---|
| `backend` | postgres (+ futurs services métier) | `internal: true` : aucun accès sortant, aucun port publiable |
| `monitoring` | prometheus, loki, grafana | Seul Grafana est publié |
| `secrets` | vault, vault-agent | Vault publié sur 127.0.0.1 uniquement |

## Choix techniques

- **Versions figées** (`postgres:18.6-alpine`, `prom/prometheus:v3.15.0`, `grafana/loki:3.7.8`,
  `grafana/grafana:13.2.4`, `hashicorp/vault:2.2.0`) : un déploiement de jeudi doit être identique à celui de lundi.
- **Scrape toutes les 5 s** : la détection doit tenir dans les 60 s du Clip Chrono.
- **Durcissement de base** : `no-new-privileges`, `cap_drop: ALL` sur les services non-root,
  limites CPU et mémoire, rotation des journaux Docker (3 × 10 Mo).
- **Postgres 18** : le volume est monté sur `/var/lib/postgresql` (nouvelle disposition de l'image 18).
- **Loki** : image distroless sans shell, donc pas de healthcheck Docker ; sa disponibilité est
  contrôlée par `verify.yml` (`/ready`) et par Prometheus (`up{job="loki"}`).

## Secrets — HashiCorp Vault (WOR-62)

```
Ansible ──(API, jeton root)──▶ Vault ◀──(AppRole, lecture seule)── vault-agent ──▶ tmpfs ──▶ postgres / grafana
   init, descellement, KV, politique         secret/platform/*          fichiers 0444    *_FILE
```

- **Source de vérité** : moteur KV v2 `secret/platform/{postgres,grafana}`. Les mots de passe sont générés
  aléatoirement à la première installation et jamais écrasés ensuite.
- **Livraison aux services** : `vault-agent` s'authentifie par AppRole (politique `platform-agent` : lecture
  seule sur `secret/data/platform/*`) et écrit chaque secret dans un fichier sur un volume **tmpfs** (jamais sur disque),
  un volume par service. Postgres et Grafana le lisent via `POSTGRES_PASSWORD_FILE` / `GF_SECURITY_ADMIN_PASSWORD__FILE`.
  → aucun mot de passe dans `.env`, dans le dépôt, ni dans `docker inspect` (vérifié par `verify.yml`).
- **Audit** : chaque requête à Vault est journalisée sur la sortie standard du conteneur (valeurs hachées),
  donc récupérable par Loki pour le SIEM.
- **Fichiers locaux** (`infra/secrets/`, ignoré par Git, dossier `700`) : clé de descellement + jeton root
  (`vault-init.json`, `600`), `role_id` / `secret_id` de l'agent. `teardown.yml -e purge=true` les supprime avec les volumes.

**Comportement en cas de redémarrage** : Vault redémarre **scellé**. Postgres et Grafana continuent de fonctionner
(leurs secrets sont déjà rendus) ; relancer `deploy.yml` descelle Vault et l'agent reprend.

**Limites assumées du prototype** (à présenter au jury) :
- une seule part de clé de descellement, stockée sur le PC Hôte à côté de Vault ; en production : plusieurs parts
  (Shamir) détenues par des personnes différentes, ou auto-unseal via KMS/HSM ;
- jeton root conservé pour l'administration ; en production : révoqué après l'installation ;
- TLS désactivé (Vault n'écoute que sur le réseau Docker `secrets` et 127.0.0.1) ;
- changer un mot de passe dans Vault ne le change pas dans Postgres/Grafana (lu à l'initialisation seulement).

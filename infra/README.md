# infra/ — Infrastructure & Observabilité

Responsable Infrastructure : Reza. Déploiement reproductible (WOR-49).

| Élément | Rôle | Ticket | État |
|---|---|---|---|
| `docker-compose.yml` | Tous les microservices, réseaux segmentés, healthchecks, limites | WOR-43 | socle en place (Postgres + observabilité), services métier à ajouter |
| `prometheus/` | Scrape + règles d'alerte | WOR-45 | scrape du socle ; exporters et alertes à faire |
| `loki/`, `alloy/` | Centralisation des logs : Loki + agent Alloy (via socket-proxy) | WOR-46 | en place : journaux de tous les conteneurs du projet |
| `grafana/provisioning/` | Datasources + dashboards provisionnés (IaC) | WOR-47 | datasources + dashboard SOC/SIEM (WOR-61) ; dashboards métier à faire |
| `vault/` | Gestion des secrets : HashiCorp Vault + Vault Agent | WOR-62 | en place (Postgres, Grafana) |
| `waf/` | Filtrage applicatif (ModSecurity + OWASP CRS) devant front + API | WOR-60 | en place : bloque les injections (403), audit JSON → Loki |

> Elastic Stack non retenu (charge mémoire du PC Hôte) — cf sujet §3.2.

## Déployer

Prérequis (PC Hôte Linux) : Docker Engine + plugin Compose ≥ 2.20, Ansible ≥ 2.17, utilisateur dans le groupe `docker`.

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
| WAF (entrée appli) | `http://<WAF_BIND>:8080` | `127.0.0.1` par défaut, `192.168.137.1` le jour de la démo |
| Grafana | `http://<GRAFANA_BIND>:3000` | `127.0.0.1` par défaut, `192.168.137.1` le jour de la démo |
| Prometheus | `http://127.0.0.1:9090` | PC Hôte uniquement |
| Loki | `http://127.0.0.1:3100` | PC Hôte uniquement |
| PostgreSQL | — | Jamais publié (réseau `backend` interne) |
| Vault (UI + API) | `http://127.0.0.1:8200/ui` | PC Hôte uniquement |

Identifiants Grafana : utilisateur `GRAFANA_ADMIN_USER` (`infra/.env`), mot de passe dans Vault (`secret/platform/grafana`).

Connexion à Vault (UI) : méthode **Username**, identifiant = partie de votre e-mail avant `@`, mot de passe choisi
à la création du compte :

```bash
cd ansible && ansible-playbook playbooks/vault-user.yml   # demande l'e-mail et le mot de passe
```

Le jeton root (`infra/secrets/vault-init.json`) reste réservé à l'automatisation et au dépannage.

Console SQL : `docker compose exec postgres sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"'` (depuis `infra/`).

## Réseaux

| Réseau | Services | Particularité |
|---|---|---|
| `backend` | postgres, waf (+ futurs services métier) | `internal: true` : aucun accès sortant, aucun port publiable |
| `edge` | waf | Périmètre exposé : seul le WAF y publie un port (entrée de l'application) |
| `monitoring` | prometheus, loki, grafana | Seul Grafana est publié |
| `secrets` | vault, vault-agent | Vault publié sur 127.0.0.1 uniquement |
| `docker-api` | socket-proxy, alloy | `internal: true` : seul Alloy peut interroger le proxy du socket Docker |

## Choix techniques

- **Versions figées** (`postgres:18.6-alpine`, `prom/prometheus:v3.15.0`, `grafana/loki:3.7.8`,
  `grafana/grafana:13.2.4`, `hashicorp/vault:2.2.0`, `grafana/alloy:v1.21.0`, `wollomatic/socket-proxy:1.13.1`) : un déploiement de jeudi doit être identique à celui de lundi.
- **Scrape toutes les 5 s** : la détection doit tenir dans les 60 s du Clip Chrono.
- **Durcissement de base** : `no-new-privileges`, `cap_drop: ALL` sur les services non-root,
  limites CPU et mémoire, rotation des journaux Docker (3 × 10 Mo).
- **Postgres 18** : le volume est monté sur `/var/lib/postgresql` (nouvelle disposition de l'image 18).
- **Loki** : image distroless sans shell, donc pas de healthcheck Docker ; sa disponibilité est
  contrôlée par `verify.yml` (`/ready`) et par Prometheus (`up{job="loki"}`).

## Journaux — Loki + Alloy (WOR-46)

```
conteneurs ──▶ socket Docker ──▶ socket-proxy ──(lecture seule)──▶ alloy ──▶ loki ──▶ grafana (Explore)
```

- **Alloy** découvre automatiquement **tous les conteneurs du projet compose** `resilience-alpha` (les futurs
  services, WAF compris, sont collectés sans configuration supplémentaire) et envoie leurs journaux à Loki.
- **Labels** : `container` = nom du service compose (même convention que le labo IA WOR-91, pour que les requêtes
  LogQL du ML restent valables), `platform="resilience-alpha"`. Audit Vault : `audit_type=request|response` (SIEM).
- **Socket Docker protégé** : Alloy n'y accède pas directement (ce serait un accès root à l'hôte). `socket-proxy`
  n'autorise que `GET` sur la liste des conteneurs, leurs journaux, et la liste des réseaux, uniquement pour Alloy ;
  tout le reste (création, arrêt, exec…) est refusé (403). Il tourne en `nobody` + groupe du socket (`DOCKER_GID`,
  détecté par `deploy.yml`), en lecture seule, sans capacité.
- **Positions de lecture persistées** (volume `alloy-data`) : un redémarrage d'Alloy ne renvoie pas l'historique.
- Exemples LogQL (Grafana → Explore → Loki) : `{container="postgres"}`, `{container="vault", audit_type="request"}`,
  `sum by (container) (count_over_time({platform="resilience-alpha"}[5m]))`.

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
- **Comptes humains** : méthode `userpass` (identifiant = partie de l'e-mail avant `@`, car Vault refuse `@`
  dans un identifiant ; l'adresse complète est enregistrée sur l'entité Vault). Politique `admin`
  (`vault/policies/admin.hcl`) : secrets, comptes, politiques, moteurs — mais pas de scellement, de régénération
  du jeton root ni d'accès brut au stockage. Sessions de 8 h (24 h max), verrouillage après échecs répétés.
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

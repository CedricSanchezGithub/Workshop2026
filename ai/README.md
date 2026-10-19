# Pilier IA / Data

Détection d'anomalies (Isolation Forest par famille de signaux : trafic, injection) et assistant RAG local pour les opérateurs.

## Labo de données (`ai/lab/`)

Plateforme de paiement **fictive** qui sert uniquement à produire des métriques et des journaux réalistes pour entraîner le détecteur, en attendant la vraie plateforme des piliers Dev/Infra.

| Service | Rôle | Exposition |
|---|---|---|
| `mock-api` | API de paiement FastAPI + SQLite, métriques Prometheus, journaux JSON | réseau interne uniquement |
| `waf` | ModSecurity + OWASP CRS (nginx) devant l'API | `WAF_BIND:WAF_PORT` (seul service joignable depuis le PC attaquant) |
| `prometheus` | métriques (scrape 5 s) | `127.0.0.1:PROMETHEUS_PORT` |
| `loki` + `alloy` | journaux de tous les conteneurs (label `container`) | `127.0.0.1:LOKI_PORT` |
| `grafana` | tableau de bord « Labo IA — Vue d'ensemble » | `127.0.0.1:GRAFANA_PORT` |

### Démarrer

```bash
cd ai
cp .env.example .env          # puis définir GRAFANA_ADMIN_PASSWORD (et les ports si déjà pris)
docker compose -f lab/docker-compose.lab.yml --env-file .env up -d --build
```

### Générer du trafic normal

```bash
uv sync
uv run python -m traffic.normal --target http://localhost:${WAF_PORT:-8080} --clients 20 --duration 2700
```

### Noter les fenêtres d'incident (vérité terrain)

Les scénarios offensifs sont joués par le pilier Cybersécurité depuis le PC attaquant. Pendant chaque scénario :

```bash
uv run python -m traffic.label start dos   # ou sqli
uv run python -m traffic.label stop
```

Les fenêtres sont écrites dans `ai/data/labels.csv` (non versionné) et servent uniquement à **évaluer** le détecteur : les modèles s'entraînent sur le trafic normal.

### Sécurité du labo

- Aucune donnée bancaire réelle ; comptes `clientNN` fictifs.
- Conteneur API en lecture seule, non-root, sans capabilities.
- `WAF_TRUSTED_PROXIES` autorise les passerelles Docker à fixer `X-Forwarded-For` pour simuler plusieurs clients légitimes. C'est une simplification de labo, à ne pas reprendre sur la plateforme finale.
- Alloy lit le socket Docker en lecture seule (labo uniquement).

## Features et dataset (`ai/detector/`)

`features.py` calcule, pour chaque fenêtre glissante de 60 s (pas de 10 s), deux familles de features :

| Famille → type | Features |
|---|---|
| `traffic` → `dos` | `req_rate`, `p95_latency_s`, `p99_latency_s`, `err5xx_ratio`, `r429_ratio`, `bytes_out_rate`, `payments_ok_rate`, `waf_req_rate`, `distinct_ips`, `top_ip_share` |
| `injection` → `sqli` | `waf_block_rate`, `crs_sqli_hits`, `crs_anomaly_score`, `suspicious_char_ratio`, `mean_req_bytes`, `client_err_ratio`, `db_error_rate` |

Le même code sert à la collecte et à l'inférence en direct.

```bash
uv run python -m detector.collect --since 50m --out normal_01   # -> ai/data/normal_01.parquet
uv run pytest
```

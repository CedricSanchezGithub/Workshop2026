# ml/lab — Labo de données

Plateforme de paiement **fictive** qui sert uniquement à produire des métriques et des journaux réalistes pour entraîner le détecteur, en attendant la vraie plateforme (`services/`, `infra/`). Elle expose les mêmes noms de métriques et de champs de journaux que ceux exigés de la plateforme par [`docs/architecture/contrat-observabilite-ia.md`](../../docs/architecture/contrat-observabilite-ia.md), pour qu'un modèle entraîné ici fonctionne là-bas.

| Service | Rôle | Exposition |
|---|---|---|
| `payment-api` | API de paiement fictive FastAPI (dossier `mock_api/`) + SQLite, métriques Prometheus, journaux JSON | réseau interne uniquement |
| `waf` | ModSecurity + OWASP CRS (nginx) devant l'API | `WAF_BIND:WAF_PORT` (seul service joignable depuis le PC attaquant) |
| `prometheus` | métriques (scrape 5 s) | `127.0.0.1:PROMETHEUS_PORT` |
| `loki` + `alloy` | journaux de tous les conteneurs (label `container`) | `127.0.0.1:LOKI_PORT` |
| `grafana` | tableau de bord « Labo IA — Vue d'ensemble » | `127.0.0.1:GRAFANA_PORT` |

Prometheus, Loki et Grafana utilisent les mêmes versions que `infra/docker-compose.yml`.

## Démarrer

```bash
cp ml/lab/.env.example ml/lab/.env      # puis définir GRAFANA_ADMIN_PASSWORD (et les ports si déjà pris)
docker compose -f ml/lab/docker-compose.lab.yml --env-file ml/lab/.env up -d --build
```

## Générer du trafic normal

```bash
cd ml && uv sync
uv run python -m lab.traffic.normal --target http://localhost:${WAF_PORT:-8080} --clients 20 --duration 2700
```

## Noter les fenêtres d'incident (vérité terrain)

Les scénarios offensifs (attaques A et B de [`docs/attack-scenarios.md`](../../docs/attack-scenarios.md)) sont joués par le pilier Cybersécurité depuis le PC attaquant. Pendant chaque scénario :

```bash
uv run python -m lab.traffic.label start dos   # attaque A ; `sqli` pour l'attaque B
uv run python -m lab.traffic.label stop
```

Les fenêtres sont écrites dans `ml/data/labels.csv` et servent uniquement à **évaluer** le détecteur : les modèles s'entraînent sur le trafic normal.

## Sécurité du labo

- Aucune donnée bancaire réelle ; comptes `clientNN` fictifs.
- Conteneur API en lecture seule, non-root, sans capabilities.
- `WAF_TRUSTED_PROXIES` autorise les passerelles Docker à fixer `X-Forwarded-For` pour simuler plusieurs clients légitimes. C'est une simplification de labo, à ne pas reprendre sur la plateforme finale.
- Alloy lit le socket Docker en lecture seule (labo uniquement).

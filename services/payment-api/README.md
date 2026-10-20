# payment-api (WOR-35)

API métier de paiement fictive. **Scaffold fonctionnel** destiné à débloquer la chaîne
attaque → détection → remédiation → reprise : les autres piliers (WAF, ML, remédiation,
recette) ont désormais une cible réelle.

> Stack : **Python / FastAPI** (cohérent avec `ml/` et `rag/`). Choix à entériner dans l'ADR
> WOR-26 ; `auth`, `frontend`, `dashboard`, `remediation` restent à implémenter.

## Endpoints

| Méthode | Chemin | Rôle |
|---|---|---|
| GET  | `/` | ping simple |
| GET  | `/health` | healthcheck **métier réel** (vérifie la base) — 200 si OK, 503 sinon |
| POST | `/pay` | `{"src","dst","amount"}` : débite/crédite dans une transaction (422 si solde insuffisant) |
| GET  | `/integrity` | somme des soldes vs invariant (preuve de reprise du scénario B) |
| GET  | `/metrics` | métriques Prometheus |

## Signaux produits (contrat WOR-29 / WOR-37)

- **Prometheus** (`job="payment-api"`) : `http_requests_total{method,path,status}`,
  `http_request_duration_seconds` (histogramme), `payments_total{status}`,
  `accounts_balance_sum`. → signaux du scénario A (débit, latence, 5xx) et de l'intégrité (B).
- **Loki** (`{container="payment-api"}`) : un log JSON par requête — `method`, `path`, `status`,
  `duration_ms`, `client_ip` (lu depuis `X-Forwarded-For` posé par le WAF), `request_id`.

## Accès

Jamais publié : joignable uniquement via le **WAF** (`http://<WAF_BIND>:8080`), sur le réseau
`backend` interne. Lit le mot de passe Postgres rendu par Vault (`POSTGRES_PASSWORD_FILE`),
jamais en clair. Conteneur non-root, `cap_drop: ALL` (durcissement WOR-63).

## Base de données

Au démarrage (idempotent) : tables `accounts` (comptes fictifs `alice`/`bob`/`carol`, 1000
chacun) et `payments`. Schéma minimal — à étoffer avec WOR-33.

## Lancer / reconstruire

```bash
cd infra && docker compose up -d --build payment-api
```

## Vérifié (2026-10-20)

Via le WAF : `GET /` → 200, `/health` → db up, `POST /pay` alice→bob accepté, `/integrity`
intact (3000), SQLi → 403 (bloqué par le WAF). Prometheus scrape `up=1` ; attaque A →
signal de débit mesurable ; logs présents dans Loki.

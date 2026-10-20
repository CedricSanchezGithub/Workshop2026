# services/payment-api — voir `app/`

L'API métier de paiement (WOR-35) est implémentée dans **`app/`** (application
« Pay&Go » de Michael : Express/TypeScript + worker + frontend React, architecture
hexagonale). Ce dossier `services/payment-api/` ne contient volontairement **pas** de
code dupliqué.

## Intégration plateforme

Le service **`payment-api`** de `infra/docker-compose.yml` construit l'API depuis
`app/` (`app/infra/docker/Dockerfile.api`) et la place :

- **derrière le WAF** (ModSecurity/CRS, WOR-60) — point d'entrée unique ;
- **dans l'observabilité** : `/metrics` scrapé par Prometheus (`job="payment-api"`),
  logs JSON (avec `client_ip`) collectés par Alloy → Loki (`{container="payment-api"}`) ;
- **durcie** : non-root (`user: node`), `cap_drop: ALL`, sur les réseaux `backend` + `monitoring`.

Mode **in-memory** pour l'instant (pas de dépendance BDD côté plateforme). Suivi :
câbler la persistance Postgres + Vault (WOR-33) et intégrer le frontend/worker de `app/`.

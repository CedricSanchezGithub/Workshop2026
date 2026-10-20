# services/payment-api — Pay&Go

Application de réservation de transport avec paiement factice, API Express/TypeScript, worker asynchrone et PostgreSQL.

API métier de paiement (WOR-35), anciennement à la racine dans `app/` (déplacée par WOR-102). Toutes les commandes ci-dessous se lancent depuis `services/payment-api/`.

## Intégration plateforme

Le service **`payment-api`** de `infra/docker-compose.yml` (racine du dépôt) construit l'API depuis ce dossier
(`infra/docker/Dockerfile.api`) et la place :

- **derrière le WAF** (ModSecurity/CRS, WOR-60) — point d'entrée unique ;
- **dans l'observabilité** : `/metrics` scrapé par Prometheus (`job="payment-api"`),
  logs JSON (avec `client_ip`) collectés par Alloy → Loki (`{container="payment-api"}`) ;
- **durcie** : non-root (`user: node`), `cap_drop: ALL`, sur les réseaux `backend` + `monitoring`.

Mode **in-memory** pour l'instant (pas de dépendance BDD côté plateforme). Suivi :
câbler la persistance Postgres + Vault (WOR-33) et intégrer le frontend/worker de Pay&Go.

## Organisation

```text
node_modules/                  # dépendances du workspace (installées par npm ci)
front/                         # application React + Vite
  tests/                       # tests métier et structurels
  dist/                        # build frontend généré
backend/
  api/                         # composition root HTTP Express
  shared/                      # domaine, cas d'usage, ports et adaptateurs
  services/payment-worker/     # traitement asynchrone des paiements
infra/
  docker-compose.yml           # PostgreSQL, API, worker et Nginx
  database/init/               # schéma SQL initial
  docker/                      # Dockerfiles et configuration Nginx
  scripts/                     # scripts d'initialisation
docs/                          # architecture, auth, paiements et audit
```

Les fichiers `package.json` et `package-lock.json` restent à la racine de `services/payment-api/` pour piloter le workspace et garantir une installation reproductible.

La clé du chatbot n'est jamais stockée dans le frontend. Définir `OPENAI_API_KEY` dans l'environnement du serveur ; l'API applique une limite de taille et de débit avant d'appeler le fournisseur.

## Démarrage local

```bash
npm install
npm run dev
npm run api:dev
```

L'interface est disponible sur `http://localhost:5173` et l'API sur `http://localhost:4000`.

Le worker de paiement exige une file PostgreSQL : sans `QUEUE_DRIVER=postgres`, `npm run worker:start` s'arrête immédiatement. Avec le PostgreSQL de la stack Docker (port `55432`) :

```bash
QUEUE_DRIVER=postgres DATABASE_URL=postgres://payandgo:payandgo@127.0.0.1:55432/payandgo npm run worker:start
```

## Démarrage Docker

```bash
docker compose -f infra/docker-compose.yml up --build
```

La stack expose le front sur `http://localhost:5500`, l'API sur `http://localhost:4400`, sa documentation OpenAPI sur `/docs/` et PostgreSQL sur le port `55432`.


## Vérifications

```bash
npm run api:check
npm test
npm run build
docker compose -f infra/docker-compose.yml config --quiet
```

Les choix d'architecture, le paiement factice et le verrou du chatbot sont détaillés dans [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md), [`docs/PAYMENT_ARCHITECTURE.md`](docs/PAYMENT_ARCHITECTURE.md) et [`docs/CHATBOT_ARCHITECTURE.md`](docs/CHATBOT_ARCHITECTURE.md).

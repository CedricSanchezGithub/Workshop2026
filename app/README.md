# Pay&Go

Application de réservation de transport avec paiement factice, API Express/TypeScript, worker asynchrone et PostgreSQL.

## Organisation

```text
front/                         # application React + Vite
  node_modules/                # dépendances frontend et outils du workspace
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

Les fichiers `package.json` et `package-lock.json` restent à la racine pour piloter le workspace et garantir une installation reproductible.

La clé du chatbot n'est jamais stockée dans le frontend. Définir `OPENAI_API_KEY` dans l'environnement du serveur ; l'API applique une limite de taille et de débit avant d'appeler le fournisseur.

## Démarrage local

```bash
npm install
npm run dev
npm run api:dev
```

L'interface est disponible sur `http://localhost:5173` et l'API sur `http://localhost:4000`.

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

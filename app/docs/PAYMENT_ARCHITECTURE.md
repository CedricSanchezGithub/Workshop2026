# Pay&Go — architecture de paiement factice

Ce document décrit le système de paiement de démonstration ajouté au projet. Il est volontairement autonome du frontend React afin de montrer un vrai flux métier : une requête authentifiée crée une intention de paiement, l'intention est placée dans une queue, puis un worker appelle un acquéreur factice et met à jour l'état.

> Cette implémentation ne traite aucune carte réelle. Elle ne stocke ni numéro de carte, ni CVV, ni cryptogramme. Elle illustre les contrôles attendus autour d'un paiement, mais ne constitue pas une certification PCI DSS ni un système bancaire prêt pour la production.

## Périmètre technique

- API : Express + TypeScript.
- Organisation : clean architecture, avec domaine, cas d'usage, ports et adaptateurs.
- Queue : `InMemoryPaymentQueue` pour les tests ou `PostgresPaymentQueue` pour le worker séparé ; le port permet ensuite Redis Streams, RabbitMQ, SQS ou Kafka.
- Worker : traitement asynchrone `payment.process`.
- Persistance : `PostgresPaymentRepository` en mode Docker, avec `InMemoryPaymentRepository` conservé pour les tests rapides.
- Acquéreur : `MockPaymentGateway`, qui simule l'autorisation et renvoie une référence non sensible.
- Validation : Zod côté API.
- Protection HTTP : Helmet, CORS à origine contrôlée, limitation de débit, taille maximale du JSON et suppression de `X-Powered-By`.
- Audit : événements structurés sans données de carte.

## Organisation des fichiers

```text
backend/
  shared/src/
    domain/payment/PaymentIntent.ts       # modèle métier et états
    application/ports/                    # contrats vers l'infrastructure
    application/use-cases/                # règles métier
      CreatePaymentIntent.ts
      GetPaymentIntent.ts
      ProcessPaymentJob.ts
    infrastructure/
      gateways/MockPaymentGateway.ts      # adaptateur acquéreur factice
      logging/ConsoleAuditLogger.ts
      queue/InMemoryPaymentQueue.ts
      repositories/InMemoryPaymentRepository.ts
  api/src/main.ts                          # composition root et HTTP
  services/payment-worker/src/main.ts      # worker paiement séparé
infra/
  docker-compose.yml
  database/init/001_schema.sql
```

La règle de dépendance est dirigée vers l'intérieur : le domaine ne connaît ni Express, ni Redis, ni PostgreSQL. Les cas d'usage dépendent de ports abstraits et `main.ts` assemble les adaptateurs concrets.

## Flux d'un paiement

```text
Client authentifié
      |
      | POST /v1/payments/intents
      | Authorization + Idempotency-Key
      v
Payment API
      | validation + contrôle d'idempotence
      v
PaymentIntent: awaiting_verification
      |
      | code SMTP validé → payment.process
      v
Queue ------> Payment Worker ------> MockPaymentGateway
                                      |
                                      v
                         succeeded ou failed
                                      |
                                      v
                             GET /v1/payments/:id
```

L'appel de création renvoie `202 Accepted` lorsque l'intention est créée et qu'un code SMTP fictif est envoyé. Après validation du code, la job est mise en file. Le client consulte ensuite l'état. Un replay avec la même clé et la même requête renvoie le même paiement sans recréer de débit.

## Intégration frontend

Le bouton `Réserver` d'une carte ouvre le détail du trajet. Le bouton `Payer et confirmer` appelle `front/src/features/payment/paymentClient.js`, crée ou rejoue l'intention avec une clé conservée dans `sessionStorage`, puis interroge le statut jusqu'à `succeeded`. La réservation locale n'est ajoutée qu'après ce statut final. Si l'API est arrêtée, aucun billet n'est confirmé et l'interface affiche une erreur explicite.

Le parcours est découpé en trois étapes visibles : trajet, paiement, validation. Le backend recalcule le devis depuis le `bookingId` côté serveur et refuse tout montant différent avant de créer l'intention.

Le formulaire bancaire est fictif mais applique les contrôles usuels : numéro Luhn, date `MM/AA` non expirée, CVC de 3 ou 4 chiffres, titulaire obligatoire et email valide. Le navigateur ne transmet jamais le numéro complet, le CVC, l'expiration ou le titulaire : il transmet seulement un token `pm_mock_...`, la marque, les quatre derniers chiffres et l'email. En production, cette étape doit être remplacée par un composant hébergé par un PSP certifié.

Après la création, l'API utilise `FakeSmtpMailer` pour produire un code à six chiffres. Le code de démo est `123456` par défaut et est affiché dans la réponse uniquement pour rendre le scénario testable localement. La vérification du code fait passer le paiement en queue, puis le worker l'autorise.

Depuis « Mes réservations », l'utilisateur peut annuler un billet payé. L'API passe alors le paiement en `refund_pending`, place une job `payment.refund` dans la queue et le worker appelle l'adaptateur de remboursement factice. L'état final devient `refunded` et la carte de réservation affiche « Remboursement effectué ».

## Idempotence et prévention des doubles débits

Chaque création exige l'en-tête :

```http
Idempotency-Key: une-cle-aleatoire-d-au-moins-16-caracteres
```

La clé est associée à l'utilisateur authentifié. Le serveur conserve aussi une empreinte SHA-256 des champs métier (`bookingId`, `amountCents`, `currency`).

- même utilisateur + même clé + même contenu : replay sûr, réponse `200` avec `idempotentReplay: true` ;
- même utilisateur + même clé + contenu différent : `409 IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_REQUEST` ;
- utilisateurs différents : la clé ne peut pas réutiliser l'intention d'un autre compte ;
- le worker ne recharge pas un paiement déjà `succeeded`.

En production, la contrainte doit aussi être portée par la base : index unique `(user_id, idempotency_key)`, transaction d'insertion et verrouillage/advisory lock. La clé doit être conservée au moins pendant la fenêtre de retry définie par le métier.

## API de démonstration

L'API écoute par défaut sur `http://127.0.0.1:4000`.

### Santé du service

```http
GET /health
```

### Créer une intention de paiement

```http
POST /v1/payments/intents
Authorization: Bearer <session-token>
Idempotency-Key: demo-payment-key-20261026
Content-Type: application/json

{
  "bookingId": "booking_1",
  "amountCents": 3900,
  "currency": "EUR",
  "paymentMethod": {
    "token": "pm_mock_demo-1234567",
    "last4": "4242",
    "brand": "visa",
    "email": "demo@example.test"
  }
}
```

Réponse initiale :

```json
{
  "data": {
    "id": "pi_...",
    "status": "awaiting_verification",
    "amountCents": 3900,
    "currency": "EUR"
  },
  "idempotentReplay": false
}
```

Le worker traite ensuite la job et l'état devient `succeeded` ou `failed`.

### Vérifier le code SMTP fictif

```http
POST /v1/payments/pi_.../verify
Authorization: Bearer <session-token>
Content-Type: application/json

{"code":"123456"}
```

### Demander un remboursement

```http
POST /v1/payments/pi_.../refund
Authorization: Bearer <session-token>
```

La demande est asynchrone et retourne d'abord `refund_pending`. Le client consulte ensuite l'intention jusqu'à l'état `refunded`.

### Consulter le paiement

```http
GET /v1/payments/pi_...
Authorization: Bearer <session-token>
```

Le token de session est généré après inscription/connexion. En production, il doit être remplacé par une session persistée ou un mécanisme OIDC/OAuth2 correctement configuré.

## Mesures de sécurité ajoutées

### Réduction du périmètre carte

Le frontend ne doit jamais envoyer de PAN ou de CVV à Pay&Go. En production, il faut utiliser une page ou un composant hébergé par un PSP certifié, récupérer un token de paiement à usage unique, puis ne transmettre à Pay&Go que ce token. Les réponses et logs ne doivent jamais contenir de données carte.

### Authentification et autorisation

La route de paiement exige une identité authentifiée et le paiement est toujours rattaché à l'identité issue du token. Le `userId` n'est pas accepté dans le corps de la requête. Pour une vraie installation : OIDC/OAuth2, JWT signé avec rotation des clés, audience et issuer vérifiés, scopes dédiés (`payments:create`, `payments:read`) et contrôle d'accès objet sur chaque paiement.

### Validation et limites

- montant entier en centimes, positif et plafonné ;
- devise limitée à `EUR` dans cette démo ;
- `bookingId` validé contre le devis serveur ;
- JSON limité à 32 KB ;
- rate limit global et limite dédiée à l'authentification ;
- champs inconnus refusés par les schémas stricts ;
- réponses de paiement en `no-store` et projection sans token sensible ;
- CORS limité à l'origine frontend configurée par `WEB_ORIGIN` ;
- Helmet pour les en-têtes de sécurité courants.

### Transport et secrets

En production, l'API doit être servie uniquement en TLS 1.2+ derrière un reverse proxy, avec HSTS, certificats renouvelés automatiquement et secrets fournis par un secret manager. Les clés d'API, secrets JWT et credentials de queue ne doivent jamais être commités ni placés dans le frontend.

### Journalisation et conformité

Les événements d'audit conservent l'identifiant de paiement, l'utilisateur, l'état et le motif technique, jamais les données sensibles. Pour la production, il faut ajouter une rétention définie, une immutabilité ou un stockage append-only, une corrélation de requête, la détection d'accès anormaux et une procédure d'accès aux journaux.

### Queue et reprise

La queue réelle devra fournir durabilité, acknowledgement, retry borné avec backoff, dead-letter queue et métriques de lag. Le handler doit rester idempotent, car une livraison au moins une fois peut redélivrer le même message. Pour un paiement réel, les retries doivent distinguer une erreur transitoire d'un refus définitif afin d'éviter un nouveau débit non maîtrisé.

### Webhooks d'acquéreur

Avec un PSP réel, les webhooks doivent être vérifiés par signature, anti-rejeu (`event_id` unique), horodatage et fenêtre de tolérance. Le statut final doit être piloté par un événement vérifié, pas seulement par le retour synchrone d'une requête client.

## Démarrage local

Installer les dépendances puis lancer l'API :

```bash
npm install
npm run api:dev
```

Le frontend reste lancé séparément avec :

```bash
npm run dev
```

Contrôle TypeScript de l'API :

```bash
npm run api:check
```

Tests métier et de structure :

```bash
npm test
```

Le chatbot frontend appelle `POST /v1/chat`. La clé `OPENAI_API_KEY` reste dans l’environnement de l’API ; elle n’est jamais incluse dans le bundle React. Sans clé configurée, l’interface utilise son aide locale de secours.

Exemple PowerShell :

```powershell
$headers = @{
  Authorization = "Bearer <session-token>"
  "Idempotency-Key" = "demo-payment-key-20261026"
  "Content-Type" = "application/json"
}
$body = '{"bookingId":"booking_1","amountCents":3900,"currency":"EUR"}'
Invoke-RestMethod -Method Post -Uri http://127.0.0.1:4000/v1/payments/intents -Headers $headers -Body $body
```

## Évolutions nécessaires avant production

1. Remplacer le token de démonstration par OIDC/OAuth2 et une gestion de sessions robuste.
2. Ajouter un broker externe dédié avec DLQ et retry policy si PostgreSQL ne suffit plus à la charge cible.
3. Brancher un PSP certifié via tokenisation hébergée, sans faire transiter les données carte par Pay&Go.
4. Ajouter secrets manager, TLS, observabilité, alerting, tests d'intrusion et revue PCI DSS.
5. Ajouter une table d'outbox transactionnelle pour publier les événements après commit.
6. Ajouter des tests unitaires, d'intégration, de concurrence sur l'idempotence et de contrat entre API et worker.

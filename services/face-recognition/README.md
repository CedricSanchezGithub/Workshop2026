# face-recognition (WOR-95)

IA légère de reconnaissance faciale, appelée par le back-office pour la **MFA** de la
consigne additionnelle 1 : après la saisie de l'identifiant, confirmer l'identité via la
caméra USB du PC Hôte avant d'autoriser le mot de passe.

- **Modèle** : InsightFace `buffalo_s` (embeddings 512-d), CPU, **hors ligne** (modèle
  embarqué dans l'image). Détection + reconnaissance.
- **Décision** : similarité cosinus au prototype enrôlé ; `>= FACE_THRESHOLD` (défaut 0.40)
  ⇒ reconnu. Séparation nette vérifiée (même personne ≈ 0.7, autre personne ≈ 0).
- **Interne** : jamais publié. Appelé par le back-office sur le réseau `backend`.
- **Durci** (WOR-63) : non-root (`faceuser`), `cap_drop: ALL`. `/metrics` → Prometheus
  (`job=face-recognition`), logs JSON → Loki (`{container="face-recognition"}`).

## Minimisation / RGPD (WOR-101)

On ne stocke **que des embeddings** (`/data/embeddings/<user>.npy`), **jamais** les images
brutes de la caméra. `DELETE /users/{user}` supprime les embeddings (droit à l'effacement).

## API

| Méthode | Chemin | Corps | Réponse |
|---|---|---|---|
| POST | `/enroll` | form `user`, fichier `image` | `{status, user, samples}` (422 si aucun visage) |
| POST | `/verify` | form `user`, fichier `image` | `{match, user, score, threshold}` |
| GET  | `/users` | — | `{users: [...]}` |
| DELETE | `/users/{user}` | — | `{status: deleted}` |
| GET  | `/health`, `/metrics` | — | santé / métriques Prometheus |

Plusieurs `/enroll` par utilisateur améliorent la robustesse (prototype = moyenne des
embeddings).

## Construire / lancer

```bash
cd infra && docker compose up -d --build face-recognition
```

## Vérifié (2026-10-20)

Enrôlement d'une photo, puis vérification d'une **autre** photo de la même personne →
`match=true` (score 0.72) ; d'une autre personne → `match=false` (score ≈ 0).
Intégré à la plateforme : healthcheck OK, durci (gate WOR-63), scrapé par Prometheus,
logs dans Loki. `verify.yml` vert.

## Reste à faire (autres tickets du projet)

Enrôlement/habilitations côté back-office (WOR-97), appel depuis le flux d'auth (WOR-96),
capture caméra navigateur sur le PC Hôte.

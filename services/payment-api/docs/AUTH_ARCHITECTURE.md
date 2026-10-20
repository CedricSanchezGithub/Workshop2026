# Authentification Pay&Go

## Flux

Le frontend React appelle l’API Express avec un jeton de session Bearer :

1. `POST /v1/auth/register` valide le nom, l’email et un mot de passe d’au moins 8 caractères.
2. Le backend normalise l’email, hache le mot de passe avec `scrypt` et crée une session de 7 jours.
3. `POST /v1/auth/login` vérifie le hash sans jamais renvoyer le mot de passe.
4. `GET /v1/auth/me` hydrate le profil au rechargement et `POST /v1/auth/logout` révoque la session.
5. Les endpoints de paiement utilisent l’identifiant issu de la session, ce qui empêche un compte de consulter ou rembourser le paiement d’un autre.

## Logo utilisateur

Chaque compte reçoit un SVG déterministe généré côté serveur par [Jdenticon](https://github.com/dmester/jdenticon), à partir de l’email et du nom. Le même compte retrouve donc toujours le même identicon, sans upload ni stockage d’image. Le SVG est envoyé dans le profil public et rendu dans le dashboard avec une data URI.

## Architecture clean

- `backend/shared/src/domain/auth/User.ts` : modèle métier et projection publique.
- `backend/shared/src/application/ports/*` : contrats des repositories, sessions, hash et avatars.
- `backend/shared/src/application/use-cases/*` : inscription, connexion et récupération de l’utilisateur courant.
- `backend/shared/src/infrastructure/repositories/InMemory*` : adaptateurs rapides pour les tests ; les `Postgres*Repository` assurent la persistance du mode Docker.
- `backend/shared/src/infrastructure/security/ScryptPasswordHasher.ts` : adaptateur de hash.
- `backend/shared/src/infrastructure/avatars/JdenticonAvatarGenerator.ts` : adaptateur Jdenticon.
- `front/src/features/auth/*` : formulaires et client API frontend.

## Limites de la démonstration

Le mode mémoire est utilisé par défaut pour les tests unitaires. Le mode Docker active PostgreSQL pour les utilisateurs, sessions, devis, paiements et jobs. Pour une version de production, placer le token dans un cookie `HttpOnly` sécurisé, ajouter rotation/révocation persistée, vérification email, récupération de compte, CSRF et un fournisseur SMTP réel. Les réservations frontend restent encore locales au navigateur.

## Tests

La suite se lance avec `npm test` et utilise le runner natif `node:test` via `tsx` :

- `front/tests/auth.test.ts` vérifie le hash, l’inscription, la connexion, la session et l’identicon.
- `front/tests/payment.test.ts` vérifie l’idempotence, la validation SMTP, la queue et le remboursement.
- `front/tests/structure.test.ts` vérifie les fichiers structurants et l’indépendance du domaine vis-à-vis de l’infrastructure.

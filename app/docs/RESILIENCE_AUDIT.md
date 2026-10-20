# Audit de recette — Pay&Go / Resilience-Alpha

Date de la recette : 19 octobre 2026  
Périmètre : environnement local uniquement (`127.0.0.1`), données fictives et gateway de paiement simulée.

Référence fonctionnelle : sujet `Workshop 2026-27 M2 - Sujet PROJECT RESILIENCE-ALPHA`.

## Résultat exécutif

Le prototype Pay&Go fonctionne sur le périmètre métier actuellement implémenté : authentification, réservation côté frontend, intention de paiement, vérification SMTP fictive, idempotence, traitement asynchrone, remboursement, Swagger et supervision administrative de la queue. L’architecture vient d’être étendue avec PostgreSQL, un worker paiement séparé, une queue PostgreSQL interchangeable avec l’adaptateur mémoire et un déploiement Docker Compose.

Il ne satisfait pas encore le scénario central de résilience du workshop. Le dépôt ne contient pas de chaîne d’incident démontrable de bout en bout : attaque contrôlée, détection ML alimentée par les métriques/journaux, décision de remédiation, action autonome sur les services, restauration vérifiée et nouvelle transaction réussie. Il manque également les artefacts d’infrastructure et de gouvernance exigés par le sujet.

## Tests exécutés

| Vérification | Résultat |
| --- | --- |
| `npm run api:check` | PASS |
| `npm test` | PASS — 8 tests, 0 échec |
| `npm run build` | PASS — build Vite produit |
| `docker compose config` et build des images | PASS |
| Stack Docker PostgreSQL/API/worker/frontend | PASS |
| Paiement API → PostgreSQL → worker → remboursement | PASS |
| Frontend `http://127.0.0.1:5173/` | PASS — HTTP 200 |
| API `/health` | PASS — HTTP 200 |
| `/openapi.json` et `/docs/` | PASS — HTTP 200 |
| Paiement sans session | PASS — HTTP 401 |
| Inscription et `/v1/auth/me` | PASS — HTTP 201 puis 200 |
| Paiement avec montant incohérent | PASS — HTTP 400 |
| Création d’intention + SMTP fictif | PASS — HTTP 202 |
| Rejeu avec la même clé d’idempotence | PASS — HTTP 200, même intention réutilisée |
| Même clé avec une requête différente | PASS — HTTP 409 |
| Code SMTP invalide puis valide | PASS — HTTP 409 puis 202 |
| Traitement asynchrone et statut final | PASS — HTTP 200 |
| Demande de remboursement et statut final | PASS — HTTP 202 puis 200 |
| Admin overview et scaling de la queue | PASS — HTTP 200 |
| Utilisateur normal sur une route admin | PASS — HTTP 403 |
| Déconnexion puis réutilisation du token | PASS — HTTP 200 puis 401 |

## Matrice par rapport au sujet

### Développement

| Attendu | État | Observation |
| --- | --- | --- |
| Interface React/Tailwind | Partiel | Interface de réservation, paiement, auth et admin présente ; tests automatisés de parcours navigateur à ajouter. |
| API métier Node.js | Présent | Express TypeScript, routes versionnées et validation Zod. |
| Authentification et contrôle d’accès | Présent | Session Bearer, rôle admin, rate limit auth, hash scrypt, helmet. |
| Transaction fictive complète | Présent | Intent → SMTP → queue → gateway mock → succès. |
| Remboursement | Présent | Queue dédiée et statut `refunded`. |
| Microservices conteneurisés | Partiel | `payment-api`, `payment-worker`, PostgreSQL et frontend sont séparés dans Docker Compose ; l’authentification et les réservations restent dans l’API principale. |
| Moteur de remédiation | Manquant | La queue de paiement traite des jobs métier, mais ne reçoit pas d’incident et ne pilote pas la restauration de services. |

### Infrastructure et observabilité

| Attendu | État |
| --- | --- |
| Docker Compose reproductible | Présent | `infra/docker-compose.yml`, `infra/docker/Dockerfile.api`, `infra/docker/Dockerfile.web` et script PostgreSQL présents. |
| Playbooks Ansible | Manquant |
| Prometheus | Manquant |
| Grafana | Manquant |
| Loki | Manquant |
| État avant / pendant / après incident | Manquant |

### IA et analyse

| Attendu | État |
| --- | --- |
| Détection d’anomalies ML sur métriques ou logs | Manquant |
| Raccordement du modèle à la remédiation | Manquant |
| Assistant conversationnel sécurisé | Présent | Endpoint `/v1/chat` avec clé fournisseur côté API, limite de débit et historique borné ; pas d’action sensible exposée à l’assistant. |
| Assistant local Ollama + LangChain + RAG | Manquant | Le prototype utilise un fournisseur compatible Chat Completions, sans RAG ni exécution locale. |
| Contrôle des privilèges de l’assistant | Présent | L’assistant ne reçoit aucun outil d’administration, de paiement ou de remboursement. |

### Cybersécurité

| Attendu | État |
| --- | --- |
| Scénario d’attaque local reproductible depuis un PC distinct | Manquant |
| WAF | Manquant |
| SIEM ou fonction SOC intégrée | Manquant |
| Durcissement et journalisation d’investigation | Partiel | Helmet, CORS, rate limit et audit métier existent ; pas de chaîne centralisée de logs. |
| Vault ou SOPS | Manquant |
| Séparation des accès de remédiation | Non démontrable |

### Gouvernance et transformation

| Attendu | État |
| --- | --- |
| Analyse EBIOS RM reliée à l’architecture | Manquant |
| PCA/PRA relié aux scénarios testés | Manquant |
| Analyse NIS2/DORA contextualisée | Manquant |
| Arbitrages, limites et risques résiduels | Partiel | Les limites du prototype sont décrites dans la documentation technique, mais pas dans un dossier de gouvernance complet. |

## Conclusion de recette

Le système est validé pour une démonstration de paiement fictif et pour les contrôles applicatifs présents. Il n’est pas validé pour la démonstration Resilience-Alpha : sans remédiation automatique après un incident observable, l’axe « démonstration en direct et remédiation autonome » ne peut pas être considéré comme acquis.

## Priorités avant présentation

1. Ajouter Prometheus/Grafana/Loki à l’environnement Docker Compose et exposer les métriques utiles.
2. Ajouter un endpoint ou agent d’incident strictement local, un scénario d’attaque contrôlé et une chaîne détection → décision → remédiation.
3. Brancher Prometheus/Loki sur un détecteur ML documenté et afficher l’état avant, pendant et après incident dans l’interface admin.
4. Ajouter WAF, SIEM/SOC, gestion de secrets Vault/SOPS et permissions minimales du moteur de remédiation.
5. Produire les dossiers EBIOS RM, PCA/PRA, NIS2/DORA, scripts de test, README de déploiement et un Clip Chrono continu de 60 secondes.

Les tests réalisés restent volontairement limités au laboratoire local et aux données fictives, conformément aux contraintes de sécurité du sujet.

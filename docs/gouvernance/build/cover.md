# Organisation de l'équipe

## Répartition des domaines (WOR-18)

Chaque pilier a un responsable. Les décisions d'architecture restent prises ensemble.

| Domaine | Responsable | Projet Linear | Tickets assignés |
|---|---|---|---|
| Développement | Michael | Développement — SI de paiement & remédiation | WOR-33 à WOR-42 (10) |
| Infrastructure | Reza | Infrastructure & Observabilité | WOR-43 à WOR-49 (7) |
| IA / Data | Léa | IA / Data — Détection ML & Assistant RAG | WOR-50 à WOR-57 (8) |
| Cybersécurité | Axel | Cybersécurité — Red Team & Défense | WOR-58 à WOR-66 (9) |
| Gouvernance / Transformation | Cédric | Gouvernance & Transformation | WOR-67 à WOR-73 (7) |

Les 35 tickets communs (Pilotage, Cadrage, Intégration, Livrables) n'ont pas encore de responsable.

## Avancement du pilier Gouvernance au 19/10/2026

| Ticket | Sujet | Statut | Livrable |
|---|---|---|---|
| WOR-31 | Matrice de risques EBIOS RM, version initiale | En cours, à valider par les coachs | Partie « EBIOS RM » |
| WOR-68 | Services critiques et coût d'un arrêt de paiement | En cours | Partie « Services critiques » |
| WOR-69 | Analyse NIS2 / DORA | En cours, version 0.1 | Partie « Analyse NIS2 / DORA » |
| WOR-70 | Objectifs RTO / RPO | En cours, version 0.1 | Partie « Objectifs RTO / RPO » ; temps mesurés attendus des essais (WOR-79) |
| WOR-71 | PCA / PRA | En cours, version 0.1 | Partie « PCA / PRA » ; à confirmer par les essais (WOR-75, WOR-76, WOR-78) |
| WOR-72 | Recommandations et arbitrages pour une direction | En cours, version 0.1 | Partie « Recommandations à la direction » |
| WOR-67 | EBIOS RM complet (ateliers 3 à 5) | À faire | Attend l'architecture (WOR-27) |
| WOR-73 | Relier EBIOS et PCA/PRA à l'architecture et aux essais | À faire | Après les essais de mercredi et jeudi |

## Décisions en attente avec les autres piliers

- **Restauration de la base après une injection** : un snapshot seul fait perdre des transactions confirmées, alors que l'objectif est zéro. Proposition : snapshot puis rejeu des transactions légitimes (Michael, Reza).
- **Délai de détection compatible avec le Clip Chrono de 60 s** : collecte des métriques toutes les 5 s environ et fenêtre d'analyse ML courte (Reza, Léa).
- **Règles de l'automate** : deux signaux concordants avant une action destructrice, au plus 3 remédiations en 10 minutes (Michael).

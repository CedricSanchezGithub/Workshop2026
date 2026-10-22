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

## Avancement du pilier Gouvernance au 22/10/2026

| Ticket | Sujet | Statut | Livrable |
|---|---|---|---|
| WOR-31 | Matrice de risques EBIOS RM, version initiale | Terminé, validé par les coachs | Partie « EBIOS RM » |
| WOR-68 | Services critiques et coût d'un arrêt de paiement | Terminé | Partie « Services critiques » |
| WOR-69 | Analyse NIS2 / DORA | Terminé, version 0.3 | Partie « Analyse NIS2 / DORA » |
| WOR-70 | Objectifs RTO / RPO | En cours, version 0.3 | Partie « Objectifs RTO / RPO » ; temps mesurés attendus des essais (WOR-79) |
| WOR-71 | PCA / PRA | En cours, version 0.3 | Partie « PCA / PRA » ; à confirmer par les essais (WOR-75, WOR-76, WOR-78) |
| WOR-72 | Recommandations et arbitrages pour une direction | En cours, version 0.3 | Partie « Recommandations à la direction » |
| WOR-67 | EBIOS RM complet (ateliers 3 à 5) | Rédigé, à faire valider par les coachs | Partie « EBIOS RM », ateliers 3 à 5 |
| WOR-73 | Relier EBIOS et PCA/PRA à l'architecture et aux essais | En cours | Partie « État d'implémentation » (v0.5) ; résultats des essais à ajouter |

## Décisions en attente avec les autres piliers

La gouvernance décrit le code tel qu'il est au 21/10. Les écarts à trancher avec l'équipe :

- **API du socle en mémoire** : un redémarrage ou une restauration efface les transactions. La brancher sur PostgreSQL avant les essais (Reza, Michael).
- **Restauration automatique après une injection**, sans validation humaine ni second signal, déclenchée même quand le WAF a bloqué l'injection : à garder pour la démo, ou à encadrer (équipe).
- **Modèle de détection** : délai de détection des attaques A et B à mesurer (Léa).
- **Visages enrôlés** : consentement écrit et effacement après la démo (Axel, Cédric).
- **Attaque B** à diriger vers une route `/v1/…` existante (Axel).

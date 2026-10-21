---
titre: Procédure générale de reprise et d'escalade
statut: brouillon (pilier IA), à compléter avec le PCA/PRA du pilier Gouvernance
---

# Procédure générale de reprise

## Principe : reprise sans intervention corrective humaine

La plateforme RESILIENCE-ALPHA vise une reprise automatique (*zero-touch recovery*) :

1. **Collecte** : Prometheus (métriques) et Loki (journaux) collectent en continu.
2. **Détection** : le détecteur IA calcule toutes les 10 s des features sur une fenêtre glissante de 60 s et les soumet à une Isolation Forest par famille (trafic, injection).
3. **Décision** : quand une famille est anormale sur trois fenêtres consécutives, le détecteur envoie une alerte signée au moteur de remédiation.
4. **Action** : le moteur exécute la réponse prévue pour le type d'incident (playbooks Ansible, actions sur conteneurs, règles WAF).
5. **Vérification** : santé métier + transaction de test réussie + données cohérentes.

## Critères de service rétabli

Le service est considéré comme rétabli **uniquement** si :

- l'API répond sur `/health` avec `status: ok` ;
- une nouvelle transaction fictive est acceptée de bout en bout (front → auth → API → base) ;
- les soldes sont cohérents (aucune perte ni création de fonds) ;
- les scores d'anomalie du détecteur sont revenus à la normale (événement `resolved`).

## Escalade

| Situation | Action |
|---|---|
| Reprise automatique réussie | Documenter l'incident, aucune action corrective |
| Échec de la reprise après 2 tentatives | Escalader au responsable Infrastructure |
| Suspicion de compromission ou de fuite | Prévenir les responsables Cybersécurité et Gouvernance |
| Moteur de remédiation indisponible | Escalader au responsable Développement ; appliquer le PRA manuel |

## Ce que l'assistant IA ne fait pas

L'assistant opérateur (RAG) **aide à comprendre** l'incident et à retrouver les procédures. Il n'a aucun accès au système, ne lance aucune action et ne remplace pas le moteur de remédiation.

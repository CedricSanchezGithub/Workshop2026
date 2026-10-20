# Qu'est-ce qu'un PCA et un PRA ?

> **Statut : notion.** Page d'explication générale, indépendante du projet. Notre plan est dans `cible/pca-pra.md`.

## En une phrase

Le **PCA** (plan de continuité d'activité) dit comment l'activité **continue** pendant un incident. Le **PRA** (plan de reprise d'activité) dit comment on **revient** à la normale après l'incident.

## La différence, avec un exemple

Une panne touche le serveur qui traite les paiements :

- **PCA** : on bascule sur un mode dégradé pour continuer à accepter des paiements, même moins nombreux. L'activité ne s'arrête pas complètement.
- **PRA** : une fois la panne passée, on restaure les données, on vérifie qu'aucune transaction n'a été perdue et on revient au fonctionnement normal.

Les deux sont souvent réunis dans un seul document, comme dans notre projet.

## Ce que contient un bon plan

| Élément | Question à laquelle il répond |
|---|---|
| Périmètre | Quels services, quels incidents sont couverts ? |
| Rôles | Qui décide, qui agit, qui prévient qui ? |
| Déclenchement et escalade | À partir de quand passe-t-on d'un niveau de réponse au suivant ? |
| Scénarios | Pour chaque type d'incident : signaux, actions, critère de retour à la normale |
| Restauration | Où sont les copies saines, comment les restaurer, en combien de temps ? |
| Communication | Qui informer (clients, autorité), dans quel délai ? |
| Tests | Comment s'assure-t-on que le plan fonctionne vraiment ? |

## Les erreurs classiques

- **Un plan jamais testé** : il échoue le jour où on en a besoin.
- **Un plan générique**, copié d'un modèle, qui ne correspond pas aux vrais systèmes.
- **Des sauvegardes au même endroit que les données** : elles disparaissent avec elles.
- **Confondre redémarrer et reprendre** : un service relancé n'est pas un service qui fonctionne. Il faut vérifier qu'une opération métier réussit.

## Ce qu'il faut retenir

Un PCA/PRA n'a de valeur que s'il est **adapté aux vrais systèmes** et **testé**. Ses objectifs se mesurent avec le RTO et le RPO (voir `notions/rto-rpo.md`).

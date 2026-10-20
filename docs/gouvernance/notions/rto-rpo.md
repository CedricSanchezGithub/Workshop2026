# Qu'est-ce que le RTO et le RPO ?

> **Statut : notion.** Page d'explication générale, indépendante du projet. Nos objectifs sont dans `cible/rto-rpo.md`.

## En une phrase

Le **RTO** est la durée maximale pendant laquelle un service peut rester arrêté. Le **RPO** est la quantité maximale de données qu'on accepte de perdre.

## Le schéma

```
  dernière copie          incident          service rétabli
        │                    │                     │
────────┼────────────────────┼─────────────────────┼──► temps
        │◄────── RPO ───────►│◄─────── RTO ───────►│
          données perdues        service arrêté
```

- **RTO** (*Recovery Time Objective*, durée maximale d'interruption) : du début de l'incident jusqu'au retour d'un service **vérifié**.
- **RPO** (*Recovery Point Objective*, perte de données maximale admissible) : de la dernière copie saine des données jusqu'à l'incident. Tout ce qui a été enregistré entre les deux est perdu.

## Des exemples

| Service | RTO | RPO | Ce que ça implique |
|---|---|---|---|
| Paiement en ligne | Quelques minutes | 0 | Reprise automatique et aucune transaction perdue : réplication ou journalisation continue |
| Messagerie interne | Quelques heures | Une heure | Une sauvegarde par heure et une reprise manuelle suffisent |
| Archives | Plusieurs jours | Une journée | Une sauvegarde quotidienne suffit |

## Comment on les fixe

On part du **coût d'un arrêt** pour l'activité : plus un arrêt coûte cher vite, plus le RTO doit être court. On part aussi de la **valeur des données** : plus une perte est grave, plus le RPO doit être proche de zéro.

Plus les objectifs sont exigeants, plus les moyens coûtent cher. Fixer un RTO et un RPO, c'est donc un **arbitrage** entre le coût d'un incident et le coût de sa prévention.

## Ce qu'il faut retenir

Un RTO ou un RPO n'est crédible que s'il est **mesuré** lors d'essais. On retient le pire résultat, pas la moyenne : un objectif de reprise se garantit, il ne s'espère pas.

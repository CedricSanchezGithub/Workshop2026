# Qu'est-ce qu'EBIOS Risk Manager ?

> **Statut : notion.** Page d'explication générale, indépendante du projet. Notre analyse est dans `cible/ebios-rm.md`.

## En une phrase

EBIOS Risk Manager (EBIOS RM) est la méthode française d'analyse des risques numériques, publiée par l'ANSSI en 2018. Elle aide une organisation à identifier ce qu'elle doit protéger, contre qui, et quelles mesures prendre en priorité.

## Pourquoi on l'utilise

- **Elle part du métier, pas de la technique** : on commence par ce qui a de la valeur pour l'entreprise (traiter un paiement, protéger des données), puis on descend vers les serveurs et les logiciels.
- **Elle raisonne comme un attaquant** : on se demande qui pourrait vouloir nuire, pourquoi et comment, au lieu de lister toutes les failles possibles.
- **C'est la référence attendue** en France pour justifier des choix de sécurité devant une direction, un auditeur ou un régulateur.

## Les cinq ateliers

| Atelier | Question posée | Ce qu'on produit |
|---|---|---|
| 1. Cadrage et socle de sécurité | Que protège-t-on, et quelles règles s'appliquent déjà ? | Valeurs métier, biens supports, événements redoutés, référentiels applicables |
| 2. Sources de risque | Qui pourrait nous attaquer, et pour obtenir quoi ? | Couples « source de risque / objectif visé » retenus |
| 3. Scénarios stratégiques | Par quel chemin, y compris via nos partenaires, l'attaquant atteindrait-il son objectif ? | Chemins d'attaque de haut niveau, parties prenantes à risque |
| 4. Scénarios opérationnels | Concrètement, quelles actions techniques mènerait-il ? | Modes opératoires détaillés, avec leur vraisemblance |
| 5. Traitement du risque | Que fait-on de chaque risque ? | Mesures de sécurité, risques résiduels acceptés |

## Le vocabulaire à connaître

- **Valeur métier** : ce qui a de la valeur pour l'entreprise (un processus ou une information). Exemple : traiter un paiement.
- **Bien support** : ce sur quoi repose une valeur métier (serveur, logiciel, réseau, personne). Exemple : la base de données.
- **Événement redouté** : ce qui arrive à une valeur métier si le risque se réalise. Exemple : les paiements sont indisponibles.
- **Source de risque** : qui ou quoi pourrait provoquer l'attaque. Exemple : un cybercriminel.
- **Gravité** : l'importance des conséquences. **Vraisemblance** : la probabilité que le scénario se produise. Les deux ensemble donnent le **niveau de risque**.

## Ce qu'il faut retenir

EBIOS RM ne produit pas une liste exhaustive de failles, mais une **priorisation argumentée** : quels risques traiter d'abord, et pourquoi.

# Documents de gouvernance

Ce dossier contient les documents du pilier Gouvernance au format Markdown, rangés en quatre dossiers :

| Dossier | Contenu | Évolue quand |
|---|---|---|
| `cible/` | Ce que l'équipe **vise et a décidé** : risques, objectifs de reprise, PCA/PRA, exigences réglementaires, recommandations | Une décision change |
| `constat/` | Ce qui est **vérifié** dans le code et, après les essais, mesuré | À chaque fusion importante et à chaque essai |
| `notions/` | Explications générales, indépendantes du projet : qu'est-ce qu'EBIOS RM, DORA, NIS2, un PCA/PRA, le RTO et le RPO | Rarement |
| `autre/` | Le fonctionnement de cette documentation : règles d'écriture pour le RAG, génération des PDF, site | Quand l'outillage change |

Un document ne passe jamais d'un dossier à l'autre : quand le code avance, on met à jour `constat/`. Chaque document commence par une ligne « Statut : cible », « Statut : constat », « Statut : notion » ou « Statut : autre », pour que l'assistant sache s'il cite un plan ou un fait.

Ces documents ont trois usages :

1. **Base de connaissances de l'assistant RAG** (WOR-56) : l'assistant les indexe pour répondre aux questions des opérateurs pendant un incident.
2. **Source des PDF** : le dossier de gouvernance et ses parties sont générés à partir d'eux (voir `autre/generer-les-pdf.md`).
3. **Source du site de documentation** : `site/` en fait un site lisible, avec recherche (voir `autre/site.md`).

Ces .md sont la **version de référence**. Les PDF sont des copies générées, à ne jamais modifier à la main. Avant d'écrire un document, lire `autre/rediger-pour-le-rag.md`.

## À quoi sert l'assistant RAG

Le sujet (§3.3) demande un assistant local pour les **opérateurs confrontés à l'incident**, construit avec Ollama et LangChain, avec un modèle de 8 milliards de paramètres au plus. Il doit retrouver des informations utiles dans les procédures, les descriptions d'architecture et les documents de l'équipe.

Il **aide l'humain à comprendre et à trouver la bonne procédure**. Il ne répare rien : la reprise est faite par le moteur de remédiation, sans intervention humaine. L'assistant n'a aucun accès privilégié au système (WOR-57).

```
Attaque ──► Supervision ──► Détection ML ──► Moteur de remédiation ──► Service rétabli
                                  │                (automatique)
                                  ▼
                           Opérateur humain ◄──► Assistant RAG ◄── ces documents
```

## Ce que chaque document apporte à l'assistant

| Fichier | Contenu | Questions auxquelles il permet de répondre |
|---|---|---|
| `cible/pca-pra.md` | Rôles, niveaux d'escalade, **fiches scénarios S1 à S7**, mode dégradé, restauration, notification | « L'API ne répond plus, que faire ? » · « Qui prévenir après une injection ? » · « Peut-on contourner le WAF ? » |
| `cible/rto-rpo.md` | Objectifs de reprise, budget de temps par étape, protocole de mesure | « En combien de temps le service doit-il revenir ? » · « Combien de transactions peut-on perdre ? » |
| `cible/services-critiques.md` | Services classés par priorité, coût d'un arrêt selon sa durée | « Quel service rétablir en premier ? » · « Combien coûte une heure d'arrêt ? » |
| `cible/ebios-rm.md` | Valeurs métier, biens supports, événements redoutés, matrice de risques | « Quels risques avons-nous retenus ? » · « Pourquoi le moteur de remédiation est-il sensible ? » |
| `cible/nis2-dora.md` | Exigences DORA, classification des incidents majeurs, limites du prototype | « Cet incident est-il à notifier à l'ACPR ? » · « Sous quel délai ? » |
| `cible/recommandations.md` | Arbitrages, recommandations à la direction | « Pourquoi une validation humaine pour les incidents d'intégrité ? » |
| `notions/*.md` | Qu'est-ce qu'EBIOS RM, DORA, NIS2, un PCA/PRA, le RTO et le RPO | « C'est quoi un RPO ? » · « Que demande DORA ? » |
| `constat/etat-implementation.md` | Ce que le code confirme, contredit ou n'implémente pas encore ; vulnérabilités relevées | « La restauration de la base existe-t-elle ? » · « Quels écarts reste-t-il avant les essais ? » |

`cible/pca-pra.md` est le document le plus utile en cours d'incident, mais il décrit des actions qui ne sont pas toutes codées : `constat/etat-implementation.md` dit lesquelles existent. Les autres documents servent surtout à expliquer les décisions.

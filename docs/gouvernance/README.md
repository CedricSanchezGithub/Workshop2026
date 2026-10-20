# Documents de gouvernance

Ce dossier contient les documents du pilier Gouvernance au format Markdown, rangés en deux dossiers :

| Dossier | Contenu | Évolue quand |
|---|---|---|
| `cible/` | Ce que l'équipe **vise et a décidé** : risques, objectifs de reprise, PCA/PRA, exigences réglementaires, recommandations | Une décision change |
| `constat/` | Ce qui est **vérifié** dans le code et, après les essais, mesuré | À chaque fusion importante et à chaque essai |

Un document ne passe jamais d'un dossier à l'autre : quand le code avance, on met à jour `constat/`. Chaque document commence par une ligne « Statut : cible » ou « Statut : constat », pour que l'assistant sache s'il cite un plan ou un fait.

Ces documents ont deux usages :

1. **Base de connaissances de l'assistant RAG** (WOR-56) : l'assistant les indexe pour répondre aux questions des opérateurs pendant un incident.
2. **Source des PDF** : le dossier de gouvernance et ses parties sont générés à partir d'eux (voir « Générer les PDF »).

Ces .md sont la **version de référence**. Les PDF sont des copies générées, à ne jamais modifier à la main.

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
| `constat/etat-implementation.md` | Ce que le code confirme, contredit ou n'implémente pas encore ; vulnérabilités relevées | « La restauration de la base existe-t-elle ? » · « Quels écarts reste-t-il avant les essais ? » |

`cible/pca-pra.md` est le document le plus utile en cours d'incident, mais il décrit des actions qui ne sont pas toutes codées : `constat/etat-implementation.md` dit lesquelles existent. Les autres documents servent surtout à expliquer les décisions.

## Règles d'écriture pour un bon résultat avec le RAG

L'assistant ne lit pas un document en entier : il récupère des **morceaux**, découpés en général au niveau des titres, et répond à partir de ceux-là. D'où ces règles :

- **Une section doit se comprendre seule.** Éviter « voir plus haut » ou « comme indiqué précédemment » : le morceau voisin ne sera peut-être pas récupéré. Les fiches scénarios du PCA/PRA répètent volontairement le risque, les signaux et l'objectif.
- **Des titres explicites.** « Fiche S2 — Injection applicative et altération de données » se retrouve mieux que « Cas 2 ».
- **Nommer les choses de la même façon partout** : « moteur de remédiation », « attaque A », « R1 », « WOR-71 ». L'assistant fait le lien grâce aux mots.
- **Garder des tableaux simples** : une idée par ligne, sans cellules fusionnées.
- **Ranger chaque information au bon endroit** : un plan ou un objectif dans `cible/`, un fait vérifié ou une mesure dans `constat/`. L'assistant ne doit pas présenter un plan comme une réalité.
- **Ne jamais écrire de secret** (mot de passe, clé, jeton) **ni de donnée réelle** dans ces fichiers : tout ce qui est indexé peut ressortir dans une réponse (WOR-21, WOR-62).

## Pour l'indexation (pilier IA / Data)

- **Indexer** : les documents de `cible/` et de `constat/`.
- **Ne pas indexer** : ce README, qui décrit le dossier et non la plateforme.
- **Garder le chemin dans la source citée** (`cible/…` ou `constat/…`) : c'est ce qui permet de distinguer un plan d'un fait. L'en-tête `---` des fichiers est supprimé à l'indexation, d'où la ligne de statut dans le texte.
- **Découpage conseillé** : par titre de niveau 2 ou 3, en gardant le titre du document et le titre de la section dans chaque morceau, pour que l'assistant puisse citer sa source (« d'après `cible/pca-pra.md`, fiche S1 »).
- **Réindexer** après chaque modification de ces fichiers.

## Générer les PDF

```
cd scripts/pdf
npm install
npm run build
```

Le générateur utilise le Chrome ou l'Edge déjà installé (sinon, indiquer son chemin dans `CHROME_PATH`). Il produit, dans `livrables/gouvernance/` :

- `Workshop2026-G6-Gouvernance.pdf` : le dossier complet ;
- `0X-<Partie>.pdf` : une partie par fichier (`01-EBIOS-RM.pdf`, `05-PCA-PRA.pdf`, `07-Etat-implementation.pdf`…).

Les PDF sont rangés hors de `docs/` exprès : l'assistant indexe aussi les PDF de `docs/`, ils feraient doublon avec ces .md.

Pour ajouter un document : créer le .md dans `cible/` ou `constat/`, puis l'inscrire dans `parts` de `scripts/pdf/src/config.js`.

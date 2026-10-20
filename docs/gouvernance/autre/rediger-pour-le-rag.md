# Rédiger pour le RAG

> **Statut : autre.** Page sur le fonctionnement de cette documentation, pas sur la plateforme.

## Règles d'écriture

L'assistant ne lit pas un document en entier : il récupère des **morceaux**, découpés en général au niveau des titres, et répond à partir de ceux-là. D'où ces règles :

- **Une section doit se comprendre seule.** Éviter « voir plus haut » ou « comme indiqué précédemment » : le morceau voisin ne sera peut-être pas récupéré. Les fiches scénarios du PCA/PRA répètent volontairement le risque, les signaux et l'objectif.
- **Des titres explicites.** « Fiche S2 — Injection applicative et altération de données » se retrouve mieux que « Cas 2 ».
- **Nommer les choses de la même façon partout** : « moteur de remédiation », « attaque A », « R1 », « WOR-71 ». L'assistant fait le lien grâce aux mots.
- **Garder des tableaux simples** : une idée par ligne, sans cellules fusionnées.
- **Ranger chaque information au bon endroit** : un plan ou un objectif dans `cible/`, un fait vérifié ou une mesure dans `constat/`. L'assistant ne doit pas présenter un plan comme une réalité.
- **Ne jamais écrire de secret** (mot de passe, clé, jeton) **ni de donnée réelle** dans ces fichiers : tout ce qui est indexé peut ressortir dans une réponse (WOR-21, WOR-62).

## Consignes d'indexation (pilier IA / Data)

- **Indexer** : les documents de `notions/`, `cible/` et `constat/`.
- **Ne pas indexer** : le README du dossier et les pages de `autre/`, qui décrivent la documentation et non la plateforme.
- **Garder le chemin dans la source citée** (`cible/…` ou `constat/…`) : c'est ce qui permet de distinguer un plan d'un fait. L'en-tête `---` des fichiers est supprimé à l'indexation, d'où la ligne de statut dans le texte.
- **Découpage conseillé** : par titre de niveau 2 ou 3, en gardant le titre du document et le titre de la section dans chaque morceau, pour que l'assistant puisse citer sa source (« d'après `cible/pca-pra.md`, fiche S1 »).
- **Réindexer** après chaque modification de ces fichiers.

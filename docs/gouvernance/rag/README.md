# Documents de gouvernance indexés par l'assistant RAG

Ce dossier contient les documents du pilier Gouvernance au format Markdown. Ils ont deux usages :

1. **Base de connaissances de l'assistant RAG** (WOR-56) : l'assistant les indexe pour répondre aux questions des opérateurs pendant un incident.
2. **Source des fichiers Word** : le dossier de gouvernance et ses parties sont générés à partir d'eux (voir « Générer les .docx »).

Ces .md sont la **version de référence**. Les .docx sont des copies générées : une modification faite dans un .docx est écrasée à la génération suivante.

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
| `pca-pra.md` | Rôles, niveaux d'escalade, **fiches scénarios S1 à S7**, mode dégradé, restauration, notification | « L'API ne répond plus, que faire ? » · « Qui prévenir après une injection ? » · « Peut-on contourner le WAF ? » |
| `rto-rpo.md` | Objectifs de reprise, budget de temps par étape, protocole de mesure | « En combien de temps le service doit-il revenir ? » · « Combien de transactions peut-on perdre ? » |
| `services-critiques.md` | Services classés par priorité, coût d'un arrêt selon sa durée | « Quel service rétablir en premier ? » · « Combien coûte une heure d'arrêt ? » |
| `ebios-rm.md` | Valeurs métier, biens supports, événements redoutés, matrice de risques | « Quels risques avons-nous retenus ? » · « Pourquoi le moteur de remédiation est-il sensible ? » |
| `nis2-dora.md` | Exigences DORA, classification des incidents majeurs, limites du prototype | « Cet incident est-il à notifier à l'ACPR ? » · « Sous quel délai ? » |
| `recommandations.md` | Arbitrages, recommandations à la direction | « Pourquoi une validation humaine pour les incidents d'intégrité ? » |

`pca-pra.md` est le document le plus utile en cours d'incident. Les autres servent surtout à expliquer les décisions.

## Règles d'écriture pour un bon résultat avec le RAG

L'assistant ne lit pas un document en entier : il récupère des **morceaux**, découpés en général au niveau des titres, et répond à partir de ceux-là. D'où ces règles :

- **Une section doit se comprendre seule.** Éviter « voir plus haut » ou « comme indiqué précédemment » : le morceau voisin ne sera peut-être pas récupéré. Les fiches scénarios du PCA/PRA répètent volontairement le risque, les signaux et l'objectif.
- **Des titres explicites.** « Fiche S2 — Injection applicative et altération de données » se retrouve mieux que « Cas 2 ».
- **Nommer les choses de la même façon partout** : « moteur de remédiation », « attaque A », « R1 », « WOR-71 ». L'assistant fait le lien grâce aux mots.
- **Garder des tableaux simples** : une idée par ligne, sans cellules fusionnées.
- **Indiquer ce qui est prévu et ce qui est mesuré.** Tant que les essais n'ont pas eu lieu, les mécanismes sont marqués *prévus*. L'assistant ne doit pas présenter une hypothèse comme un résultat.
- **Ne jamais écrire de secret** (mot de passe, clé, jeton) **ni de donnée réelle** dans ces fichiers : tout ce qui est indexé peut ressortir dans une réponse (WOR-21, WOR-62).

## Pour l'indexation (pilier IA / Data)

- **Indexer** : les six documents listés ci-dessus.
- **Ne pas indexer** : ce README, qui décrit le dossier et non la plateforme.
- **Découpage conseillé** : par titre de niveau 2 ou 3, en gardant le titre du document et le titre de la section dans chaque morceau, pour que l'assistant puisse citer sa source (« d'après `pca-pra.md`, fiche S1 »).
- **Réindexer** après chaque modification de ces fichiers.

## Générer les .docx

```
cd docs/gouvernance/build
npm install
npm run build
```

Cela produit :

- `docs/gouvernance/Workshop2026-G6-Gouvernance.docx` : le dossier complet ;
- `docs/gouvernance/docx/0X-<Partie>.docx` : une partie par fichier (`01-EBIOS-RM.docx`, `05-PCA-PRA.docx`…).

Pour ajouter un document : créer le .md dans ce dossier, puis l'inscrire dans `parts` de `build/src/config.js`.

# Générer les PDF

> **Statut : autre.** Page sur le fonctionnement de cette documentation, pas sur la plateforme.

```
cd scripts/pdf
npm install
npm run build
```

Le générateur utilise le Chrome ou l'Edge déjà installé (sinon, indiquer son chemin dans `CHROME_PATH`). Il produit, dans `livrables/gouvernance/` :

- `Workshop2026-G6-Gouvernance.pdf` : le dossier complet ;
- `0X-<Partie>.pdf` : une partie par fichier (`01-EBIOS-RM.pdf`, `05-PCA-PRA.pdf`, `07-Etat-implementation.pdf`…).

Les PDF sont rangés hors de `docs/` exprès : l'assistant indexe aussi les PDF de `docs/`, ils feraient doublon avec les .md.

Pour ajouter un document : créer le .md dans `cible/` ou `constat/`, puis l'inscrire dans `parts` de `scripts/pdf/src/config.js`.

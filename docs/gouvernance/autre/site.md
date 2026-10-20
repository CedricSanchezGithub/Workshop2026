# Le site de documentation

> **Statut : autre.** Page sur le fonctionnement de cette documentation, pas sur la plateforme.

`site/` est un site Astro + Starlight qui lit directement les .md de `docs/gouvernance/`, sans les copier ni les modifier : le titre `#` de chaque document devient le titre de la page. Pour chaque thème, le menu présente d'abord la notion générale, puis le document du projet.

## Lancer le site en local

```
docker compose -f docs/gouvernance/site/docker-compose.yml up --build -d
```

Puis ouvrir http://127.0.0.1:8095. Le conteneur n'écoute que sur la machine locale ; pour le rendre accessible ailleurs, passer par Tailscale (voir « Déployer le site sur une autre machine »).

**Ne pas lancer `npm install` dans `site/`.** L'assistant RAG indexe tous les .md de `docs/`, y compris ceux de `site/node_modules/` s'il existe : des milliers de fichiers sans rapport viendraient polluer ses réponses. Le site se construit dans Docker, où ce dossier n'apparaît pas.

## Ajouter une page au site

Le site publie les dossiers `notions/`, `cible/`, `constat/` et `autre/` (liste dans `site/src/loader.ts`). Pour qu'une nouvelle page apparaisse dans le menu, l'ajouter à `sidebar` dans `site/astro.config.mjs`.

## Déployer le site sur une autre machine (Raspberry Pi…)

`site/deploy.sh` ne récupère que `docs/gouvernance/` du dépôt (clone partiel), construit l'image et lance le site. Relancé, il ne reconstruit que si un fichier de la gouvernance a changé.

```
curl -fsSL https://raw.githubusercontent.com/CedricSanchezGithub/Workshop2026/main/docs/gouvernance/site/deploy.sh | bash
sudo tailscale funnel --bg 8095
```

`tailscale funnel` publie le site sur Internet en HTTPS, à l'adresse affichée par `tailscale funnel status` : il suffit d'envoyer ce lien. Le site est public, sans mot de passe, comme le dépôt GitHub dont il reprend le contenu. Funnel doit être autorisé une fois dans la console Tailscale.

Mise à jour automatique toutes les 30 minutes :

```
*/30 * * * * ~/workshop2026/docs/gouvernance/site/deploy.sh >> ~/gouvernance-site.log 2>&1
```

# Données biométriques — conformité RGPD & EBIOS (WOR-101)

La MFA par reconnaissance faciale (consigne additionnelle 1) traite des **données biométriques
à des fins d'identification** — une **catégorie particulière** au sens de l'article 9 du RGPD.
Ce document cadre le traitement et complète l'analyse EBIOS RM.

## Traitement

| Élément | Valeur |
|---|---|
| Finalité | Renforcer l'authentification du **back-office** (facteur « ce que je suis ») |
| Catégorie de données | Gabarit facial (**embedding** 512-d), jamais d'image brute |
| Personnes concernées | Les **membres du groupe** (comptes opérateurs), à titre pédagogique |
| Base légale | **Consentement** explicite des membres (art. 9.2.a) ; données volontaires en contexte de formation |
| Destinataires | Aucun — traitement **100 % local** sur le PC Hôte |
| Transfert hors UE | Aucun (pas d'appel cloud, modèle embarqué) |
| Durée de conservation | Le temps du workshop ; **suppression à la désinscription** et au démontage |

## Mesures de minimisation et de sécurité (déjà en place)

- **Minimisation** : le service `face-recognition` (WOR-95) ne stocke **que des embeddings**
  (`/data/embeddings/<id>.npy`), **jamais** les images de la caméra. L'embedding n'est pas
  réversible en photo exploitable.
- **Droit à l'effacement** : `POST /v1/admin/faces/revoke` (WOR-97) supprime les gabarits d'un
  utilisateur ; `reset-known-good.sh --rotate-secrets` et `teardown -e purge=true` effacent tout.
- **Traitement local** : reconnaissance hors ligne sur le PC Hôte (modèle dans l'image), le flux
  vidéo ne quitte pas le poste ; la capture navigateur envoie une image ponctuelle, pas un flux.
- **Accès restreint** : enrôlement **réservé aux admins** ; service interne non publié (réseau
  `backend`), atteint seulement via le WAF.
- **Secrets & durcissement** : aucun secret en clair (Vault, WOR-62), conteneurs durcis (WOR-63),
  WAF (WOR-60), anti-bruteforce (WOR-98).
- **Journalisation** : les événements `face.recognized` / `face.rejected` sont tracés (sans image)
  pour le SIEM (Loki), utiles à l'investigation (WOR-65).

## EBIOS RM — scénario de risque ajouté

- **Événement redouté** : compromission de l'authentification du back-office / **fuite de
  gabarits biométriques**.
- **Source de risque** : attaquant externe sur le réseau du groupe, vol du PC Hôte.
- **Impact** : usurpation d'un opérateur ; atteinte à des données sensibles (gravité **élevée**
  car biométrie).
- **Vraisemblance** : réduite par les mesures ci-dessus (local, embeddings, WAF, verrou,
  périmètre WOR-66).
- **Mesures de traitement** : minimisation (embeddings), chiffrement au repos du volume si
  exigé, MFA + verrou, suppression à la désinscription, sensibilisation au consentement.

## Limites assumées (prototype)

- Pas d'**anti-spoofing** (une photo pourrait tromper la reconnaissance) : acceptable en démo,
  à mentionner au jury ; en production, ajouter une détection de vivacité.
- Volume d'embeddings non chiffré au repos dans ce prototype (atténué par le périmètre local et
  le durcissement) ; en production, chiffrer le volume ou conserver les gabarits dans un coffre.

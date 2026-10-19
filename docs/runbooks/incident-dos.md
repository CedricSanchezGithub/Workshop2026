---
titre: Runbook — Saturation du service de paiement (déni de service applicatif)
statut: brouillon (pilier IA), à valider par les piliers Cyber, Infra et Gouvernance
---

# Runbook — Saturation du service de paiement (DoS applicatif)

## 1. Symptômes

- Le détecteur IA émet une alerte `type: dos` (famille `traffic`).
- Hausse brutale du nombre de requêtes par seconde (`req_rate`, `waf_req_rate`).
- Latence p95/p99 qui dépasse largement son niveau habituel (habituellement < 100 ms dans le labo).
- Apparition de réponses 5xx ou 429, baisse des transactions acceptées (`payments_ok_rate`).
- Concentration du trafic sur une ou quelques adresses IP (`top_ip_share` élevé), visible dans Grafana et dans le champ `offenders` de l'alerte.

## 2. Ce que fait la remédiation automatique

1. Le moteur de remédiation reçoit l'alerte signée (HMAC) du détecteur et vérifie la signature.
2. Il applique la réponse prévue pour `dos` : limitation de débit ou blocage temporaire des IP listées dans `offenders` au niveau du WAF, puis redémarrage propre du service de paiement si sa santé métier est dégradée.
3. Il vérifie le retour à la normale : `/health` répond `ok`, **une transaction de test est acceptée**, la latence repasse sous son niveau habituel.
4. Le détecteur envoie un événement `resolved` quand les scores d'anomalie redeviennent normaux.

Un conteneur redémarré ne suffit pas comme preuve de reprise : seule une transaction de test réussie valide le rétablissement.

## 3. Rôle de l'opérateur

L'opérateur **n'intervient pas** pour corriger pendant la reprise automatique. Il surveille et documente :

- Suivre l'avancement de la reprise dans le dashboard de supervision.
- Vérifier dans Grafana que le débit et la latence reviennent à leur niveau habituel.
- Noter l'heure de détection, l'heure de fin de reprise et les IP bloquées pour le rapport d'incident.
- Si la reprise échoue après deux tentatives, escalader au responsable Infrastructure (voir `reprise.md`).

## 4. Après l'incident

- Lever les blocages temporaires d'IP après la période prévue, sauf décision contraire.
- Comparer le temps de reprise mesuré à l'objectif RTO du PCA/PRA.
- Ajouter l'incident au journal et, si besoin, ajuster les seuils de limitation de débit.

## 5. Ce que ce runbook ne couvre pas

Une saturation est un incident de **disponibilité**. Si l'analyse montre une compromission (accès non autorisé, données modifiées), appliquer `incident-sqli.md` : la réponse n'est pas la même.

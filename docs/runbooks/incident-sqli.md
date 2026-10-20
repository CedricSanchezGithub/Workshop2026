---
titre: Runbook — Tentative d'injection SQL sur l'API de paiement
statut: brouillon (pilier IA), à valider par les piliers Cyber, Infra et Gouvernance
---

# Runbook — Tentative d'injection SQL / injection web

## 1. Symptômes

- Le détecteur IA émet une alerte `type: sqli` (famille `injection`).
- Hausse des blocages du WAF (`waf_block_rate`) et des règles OWASP CRS de la série 942xxx (`crs_sqli_hits`).
- Score d'anomalie CRS cumulé élevé (`crs_anomaly_score`).
- Requêtes contenant des caractères de syntaxe SQL dans l'URL (`suspicious_char_ratio`), requêtes mal formées (400/422), éventuellement erreurs base de données.

## 2. Différence avec un DoS

Une injection vise la **confidentialité et l'intégrité** des données, pas seulement la disponibilité. Redémarrer le service ne corrige rien si des données ont été lues ou modifiées. La réponse doit :

1. couper la source de l'attaque ;
2. vérifier l'intégrité des données ;
3. traiter une éventuelle fuite (secrets, données de comptes fictifs).

## 3. Ce que fait la remédiation automatique

1. Vérification de la signature HMAC de l'alerte.
2. Blocage au WAF des IP listées dans `offenders` (playbook `waf-block-ip`).
3. Constat de l'état de l'API avant restauration (journalisé).
4. Restauration systématique de payment-api depuis son image (playbook `restore-service`) : l'API du démonstrateur est en mémoire, la recréer la remet dans son état sain connu, sans aucune donnée altérée.
5. Vérification finale : **une transaction de test complète est acceptée** après la restauration.

Limites du démonstrateur : pas encore de base persistante à restaurer depuis une sauvegarde, ni de rotation automatique des secrets applicatifs. La rotation est possible manuellement (`scripts/reset-known-good.sh --rotate-secrets`).

## 4. Rôle de l'opérateur

- Suivre la reprise dans le dashboard, sans intervenir manuellement pendant la remédiation.
- Consulter les audits ModSecurity dans Loki (`{container="waf"}`, lignes JSON `transaction`) pour identifier les règles déclenchées et les paramètres visés.
- Si une fuite est suspectée, prévenir immédiatement le responsable Cybersécurité et le responsable Gouvernance : selon NIS2 et DORA, un incident majeur affectant des données doit être qualifié et peut devoir être notifié.

## 5. Après l'incident

- Conserver les journaux WAF et API (preuves pour l'investigation).
- Analyser si une requête a contourné le WAF ; renforcer la règle ou le niveau de paranoïa CRS si besoin.
- Mettre à jour l'analyse de risques EBIOS RM avec le scénario observé.

---
titre: Runbook — Investigation : reconstituer une attaque à partir des journaux
statut: pilier Cyber (WOR-65)
---

# Runbook — Investigation après incident

Objectif : **reconstituer une attaque après coup** à partir des seuls journaux. Complète les
runbooks de réponse (`incident-dos.md`, `incident-sqli.md`) par l'angle forensique.

## Ce qui rend les journaux exploitables

- **Horodatage fidèle** : chaque ligne garde son horodatage d'origine (précision nanoseconde),
  pas l'heure d'ingestion — Alloy collecte avec le timestamp du conteneur (WOR-46).
- **Corrélation** : tous les services sont étiquetés `container=<service>` (+ `audit_type` pour
  l'audit Vault, + `platform="resilience-alpha"`), donc requêtables et croisables dans un seul
  index Loki.
- **Conservation** : Loki conserve 7 jours (`retention_period: 168h`, compaction activée).
- **Pas de secret en clair** : l'audit Vault hache les valeurs sensibles (hmac-sha256) — les
  preuves exportées ne contiennent aucun mot de passe.

## Étape 0 — Préserver les preuves (AVANT tout reset)

`reset-known-good.sh` purge les volumes et **efface les journaux de Loki**. Exporter d'abord :

```bash
scripts/export-logs.sh --since 1h --filter '|~ "denied|403|sqli|fatal|panic"'
# -> evidence/incident-<horodatage>/{loki-raw.json, timeline.txt, manifest.txt}
```

`manifest.txt` contient l'empreinte SHA-256 des fichiers (intégrité de la preuve).

## Étape 1 — Situer l'incident dans le temps

```logql
# Pic de blocages WAF (403) par minute — borne de début/fin de l'attaque
sum(count_over_time({container="waf"} |= "denied" [1m]))
```
Croiser avec le dashboard SOC/SIEM (dossier Grafana « Sécurité », WOR-61).

## Étape 2 — Scénario A (DoS) : qui, combien, quand

```logql
# Débit de requêtes vu par le WAF
sum(count_over_time({container="waf"} != "ModSecurity" [1m]))
# IP sources les plus actives sur la fenêtre (via les logs d'accès nginx)
topk(5, sum by (remote_addr) (count_over_time({container="waf"} | pattern `<remote_addr> - <_>` [5m])))
```
Recouper avec l'alerte ML `type: dos` (champ `offenders`) et la remédiation (rate-limit, restart).

## Étape 3 — Scénario B (injection) : vecteur, règles, cible

```logql
# Blocages, avec l'IP source
{container="waf"} |= "denied"
# Détail par transaction : règles CRS déclenchées (942xxx = SQLi) et score d'anomalie
{container="waf"} |= "transaction" |~ "942[0-9]{3}"
# L'attaque a-t-elle atteint la base ? (erreurs / requêtes anormales)
{container="postgres"} |~ "(?i)error|fatal|syntax"
```
Puis vérifier l'intégrité (cf `incident-sqli.md`) et, si une fuite est suspectée, l'audit Vault :
```logql
{container="vault", audit_type="request"} |= "secret/data/platform"
```

## Étape 4 — Corrélation

Aligner les trois sources sur l'axe du temps (même horloge) et l'IP source :
`timeline.txt` (export) est déjà trié par le temps, tous services confondus — lecture directe de
la chronologie WAF → base → Vault.

## Étape 5 — Après l'investigation

- Conserver le dossier `evidence/incident-*` (hors dépôt) comme pièce.
- Reporter le scénario observé dans l'analyse EBIOS RM (gouvernance).
- Ajuster les règles / le niveau de paranoïa CRS si une requête a contourné le WAF.

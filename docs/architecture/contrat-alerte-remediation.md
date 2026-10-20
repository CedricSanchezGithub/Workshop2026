# Contrat d'alerte — détecteur ML → moteur de remédiation

> Contrat d'interface (WOR-28) entre la détection ML (`ml/inference`, WOR-53) et le moteur de remédiation (`services/remediation`, WOR-38).
> Responsable IA / Data : Léa. Ne pas modifier sans mettre à jour les deux côtés et leurs tests.

## Transport

`POST {REMEDIATION_URL}/alerts` — corps JSON, en-tête :

```
Content-Type: application/json
X-Signature: sha256=<HMAC-SHA256(clé, corps brut) en hexadécimal>
```

La clé est `infra/secrets/remediation/hmac_key` (générée par `ansible deploy.yml`, hors Git, jamais en variable d'environnement). Le moteur refuse :

| Cas | Réponse |
|---|---|
| Signature absente ou fausse | `401` (journalisé `alert_rejected`) |
| Corps non conforme au schéma | `422` |
| `ts` à plus de 60 s de l'heure du moteur | `409` |
| `id` déjà reçu (rejeu) | `409` |
| Alerte valide | `202 {"accepted": true, "incident": "<id>"}` |

Seule cette route déclenche une action : le moteur dispose de droits élevés sur la plateforme et ne doit obéir qu'au détecteur (sujet §3.4).

## Corps

```json
{
  "id": "9f1c2d3e4b5a",
  "ts": "2026-10-21T09:12:31.204Z",
  "event": "alert",
  "type": "dos",
  "family": "traffic",
  "score": -0.214,
  "threshold": -0.087,
  "target": "payment-api",
  "offenders": ["192.168.137.42"],
  "top_features": {"req_rate": 412.5, "p95_latency_s": 1.84, "top_ip_share": 0.97},
  "window_s": 60
}
```

| Champ | Contenu |
|---|---|
| `id` | identifiant unique (8–64 caractères) |
| `ts` | horodatage ISO 8601 de l'émission |
| `event` | `alert` (anomalie confirmée) ou `resolved` (scores revenus à la normale) |
| `type` | `dos` (attaque A, disponibilité) ou `sqli` (attaque B, intégrité) |
| `family` | famille ML qui a déclenché : `traffic` → `dos`, `injection` → `sqli` |
| `score`, `threshold` | score Isolation Forest de la fenêtre et seuil de décision (plus bas = plus anormal) |
| `offenders` | IP sources dominantes sur la fenêtre (max 20) ; le moteur ne bloque jamais les IP de l'hôte, la loopback ni les passerelles Docker |
| `top_features` | features les plus éloignées de la normale (explication, affichée au dashboard) |
| `window_s` | taille de la fenêtre glissante (60 s) |

## Comportement du moteur

| `type` | Actions (playbooks de la liste fermée `ansible/playbooks/remediation/`) |
|---|---|
| `dos` | `waf-block-ip` (offenders) → transaction de test ; si échec : `restart-service payment-api` → vérification |
| `sqli` | `waf-block-ip` (offenders) → constat d'intégrité → `restore-service payment-api` (état sain connu) → vérification |

Un incident est `resolved` uniquement après une **transaction de test réussie** à travers le WAF (connexion → intention de paiement → code de vérification → paiement `succeeded`). Après 2 tentatives infructueuses : `failed` + événement `escalation` (intervention humaine, `docs/runbooks/reprise.md`).

Une seconde alerte du même type pendant un incident en cours est fusionnée : seules les nouvelles IP sont bloquées.

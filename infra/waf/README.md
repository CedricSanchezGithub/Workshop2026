# WAF — ModSecurity + OWASP CRS (WOR-60)

Reverse-proxy de filtrage applicatif devant l'API/le front. Point d'entrée **publié unique**
de l'application : il bloque les injections **avant** qu'elles n'atteignent le backend et
journalise chaque blocage, collecté par Alloy → Loki → SIEM (WOR-61).

```
PC Attaquant ──▶ WAF (ModSecurity + CRS) ──(réseau backend)──▶ payment-api
                     │
                     └─▶ stdout (nginx error_log + audit JSON) ──▶ Alloy ──▶ Loki
```

- **Image** : `owasp/modsecurity-crs:4.30.0-nginx-alpine-202610180210` (version figée).
- **Mode** : règles CRS actives et **bloquantes** (`MODSEC_RULE_ENGINE=On`, paranoia 1,
  seuil d'anomalie entrant 5). Une injection SQL renvoie `403` (règles CRS `942xxx`).
- **Publication** : `${WAF_BIND}:8080` (`127.0.0.1` en dev, `192.168.137.1` le jour de la démo).
- **Backend différé** : l'upstream `payment-api` est résolu à la requête (resolver Docker +
  variable, cf `templates/includes/proxy_backend.conf.template`). Le WAF démarre donc **même
  si l'API n'existe pas encore** — trafic légitime en `502`, injections déjà bloquées en `403`.

## Signaux produits (contrat `docs/attack-scenarios.md`, famille `injection`)

Journaux `{container="waf"}` dans Loki :

- **nginx error_log** — une ligne par blocage : `Access denied with code 403`, avec l'IP source.
  → `sum by () (count_over_time({container="waf"} |= "denied" [1m]))` = blocages/minute.
- **audit ModSecurity JSON** (`SecAuditLogFormat JSON`, `RelevantOnly`, sur stdout) — détail
  par transaction : règles déclenchées (`942xxx` pour SQLi, `949110` pour le seuil d'anomalie),
  score d'anomalie, URI, IP. → `{container="waf"} |= "transaction" |~ "942"`.

## Vérifié (2026-10-20)

`attack/scenario-b-injection/attack-b.sh --target 127.0.0.1 --port 8080` → 9/10 vecteurs
bloqués en `403` ; audit JSON présent dans Loki avec les règles `942100` + `949110`.

## Réglage

Les règles/exclusions locales se mettent dans `templates/` (traité par l'image au démarrage).
`deploy.yml` redémarre le WAF si un fichier de `waf/templates/` change (`config_watch`).

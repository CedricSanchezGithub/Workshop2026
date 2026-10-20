# Contrat d'observabilité — ce que la plateforme fournit au détecteur IA

> Contrat d'interface (WOR-28) entre la plateforme — API métier (WOR-35, WOR-37), socle infra (WOR-43, WOR-45, WOR-46), WAF (WOR-60) — et la détection ML (WOR-51, WOR-53).
> Responsable IA / Data : Léa. **Statut : proposition, à valider** par Michael (API), Reza (infra) et Axel (WAF).
> Ne pas renommer une métrique, un champ ou un label sans prévenir IA/Data : le modèle est entraîné sur ces noms.

Le labo `ml/lab/` respecte déjà ce contrat ; un modèle entraîné sur le labo fonctionne donc sur la plateforme si elle le respecte aussi. La référence d'implémentation est `ml/lab/mock_api/app.py`.

## 1. Métriques Prometheus de l'API métier (`payment-api`)

Exposées sur `GET /metrics` (format Prometheus, client officiel du langage choisi), scrapées toutes les **5 s** par le job `payment-api` de `infra/prometheus/prometheus.yml`. Les requêtes vers `/metrics` lui-même ne sont pas comptées.

| Métrique | Type | Labels | Contenu |
|---|---|---|---|
| `http_requests_total` | counter | `method`, `route`, `status` | une incrémentation par requête HTTP terminée |
| `http_request_duration_seconds` | histogram | `route` | durée de traitement ; buckets `.005, .01, .025, .05, .1, .25, .5, 1, 2.5, 5, 10` |
| `http_response_bytes_total` | counter | `route` | octets du corps de réponse |
| `http_request_bytes` | histogram | `route` | longueur de l'URL complète + du corps de requête ; buckets `64, 128, 256, 512, 1024, 2048, 4096, 16384` |
| `payments_total` | counter | `status` = `accepted` \| `rejected` \| `error` | transactions traitées |
| `db_errors_total` | counter | — | erreurs d'accès à la base |
| `login_failures_total` | counter | — | échecs d'authentification (facultatif, non utilisé par le modèle à ce jour) |

Règles :
- `route` = **gabarit** de route (`/payments/{pid}`), jamais le chemin brut : sinon une attaque crée des milliers de séries et sature Prometheus. Requête sans route reconnue → `route="unmatched"`.
- `status` = code HTTP en texte (`"200"`, `"429"`, `"503"`…).

## 2. Journaux de l'API métier

Une ligne **JSON** par requête sur la sortie standard du conteneur :

```json
{"ts": 1792405807.61, "event": "http", "client_ip": "10.20.0.7", "method": "POST", "route": "/login",
 "path": "/login", "query_len": 0, "body_len": 44, "status": 200, "latency_ms": 3.44, "resp_bytes": 61, "ua": "Mozilla/5.0 …"}
```

| Champ | Obligatoire | Contenu |
|---|---|---|
| `event` | oui | `"http"` pour les requêtes ; autres valeurs libres (`"login_failed"`…) |
| `client_ip` | oui | IP du **client réel**, lue dans l'en-tête `X-Real-IP` posé par le WAF (l'API n'est joignable que par le WAF) |
| `ts`, `method`, `route`, `path`, `status`, `latency_ms`, `resp_bytes`, `query_len`, `body_len`, `ua` | recommandé | contexte d'investigation, utile au SOC et au RAG |

Les healthchecks internes (`client_ip` = `127.0.0.1` ou `::1`) sont ignorés par le détecteur.

## 3. WAF (`waf`)

ModSecurity + OWASP CRS (image `owasp/modsecurity-crs:nginx`), seul point d'entrée de l'API :

| Réglage | Valeur | Pourquoi |
|---|---|---|
| `MODSEC_AUDIT_LOG_FORMAT` / `MODSEC_AUDIT_LOG` | `JSON` / `/dev/stdout` | audits lisibles par Loki (lignes `{"transaction": …}`) |
| `MODSEC_AUDIT_ENGINE` | `RelevantOnly` | un audit par requête suspecte ou bloquée |
| `ACCESSLOG` | `/dev/stdout` | lignes d'accès nginx (débit vu par le WAF, URL des requêtes) |
| `REAL_IP_PROXY_HEADER` | `X-Real-IP` (défaut de l'image) | transmet l'IP client à l'API |
| `BLOCKING_PARANOIA` / `ANOMALY_INBOUND` | `1` / `5` (valeurs du labo) | à ajuster par Cyber ; prévenir IA/Data car cela change la distribution des blocages |

Le détecteur utilise dans les audits : `"http_code":403`, les `ruleId` `942xxx` (SQLi) et le message `Total Score: N` (score d'anomalie CRS entrant).

## 4. Collecte des journaux (Loki)

- Tous les conteneurs de la plateforme sont envoyés à Loki (Alloy ou Promtail, à ajouter au socle infra).
- Label **`container`** = **nom du service compose** (`payment-api`, `waf`, …). C'est le seul label sur lequel s'appuient les requêtes du détecteur.
- Les positions de lecture du collecteur doivent être **persistées** (volume) : sinon un redémarrage renvoie tout l'historique à Loki et double les comptages (constaté sur le labo).
- Configuration de référence : `ml/lab/alloy/config.alloy`.

## 5. Accès du détecteur

| Ressource | Accès |
|---|---|
| Prometheus `:9090`, Loki `:3100` | lecture seule (API de requête), réseau `monitoring` |
| Moteur de remédiation | uniquement `POST /alerts`, alertes signées HMAC (contrat à publier avec WOR-53) |
| Base de données, secrets, socket Docker | **aucun** |

## 6. Responsabilités

| Élément | Responsable |
|---|---|
| Métriques et journaux de `payment-api` (§1, §2) | Développement (Michael) |
| Job de scrape `payment-api`, collecteur Loki et label `container` (§4) | Infrastructure (Reza) |
| Configuration du WAF (§3) | Cybersécurité (Axel) |
| Requêtes et features du détecteur (`ml/features/extract.py`) | IA / Data (Léa) |

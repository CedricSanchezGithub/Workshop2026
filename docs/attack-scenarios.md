# Scénarios d'attaque — spécification figée (WOR-29)

> Contrat d'interface entre l'attaque (WOR-58/59), la détection ML (WOR-53) et la remédiation (WOR-38).
> Responsable Cybersécurité : Axel. À figer le lundi — ne plus modifier sans prévenir IA/Data et Infra.

## Attaque A — DoS / épuisement de ressources (PRINCIPALE)
Réponse attendue = **restauration de la disponibilité**.

| Champ | Valeur (à compléter et figer) |
|---|---|
| Vecteur | flood / slow-drain de l'API métier depuis le PC Attaquant |
| Effet observable | latence + taux d'erreur explosent, API indisponible |
| Signaux Prometheus | *Proposition IA/Data, à valider (Axel)* — famille ML `traffic` : débit `sum(rate(http_requests_total[1m]))`, latence p95/p99 sur `http_request_duration_seconds_bucket`, part de 5xx et de 429 (`http_requests_total{status=…}`), octets renvoyés `http_response_bytes_total`, transactions acceptées `payments_total{status="accepted"}` |
| Signaux Loki | *Proposition IA/Data, à valider (Axel)* — journaux JSON de l'API (`{container="payment-api"}`, champ `client_ip`) : nombre d'IP distinctes et part de l'IP la plus active par fenêtre ; lignes d'accès du WAF (`{container="waf"}`) : débit vu par le WAF, requêtes bloquées comprises |
| Détection ML | Isolation Forest de la famille `traffic`, fenêtre glissante 60 s évaluée toutes les 10 s → alerte `type: dos` avec les IP sources (`offenders`) |
| Décision de remédiation | rate-limit WAF + redémarrage/scale + playbook Ansible |
| Preuve de reprise | nouvelle transaction OK, latence revenue au niveau de base |

## Attaque B — injection applicative (SECONDAIRE)
Réponse attendue = **correction d'une compromission / intégrité** (≠ A).

| Champ | Valeur |
|---|---|
| Vecteur | entrée malformée abusée contre l'API |
| Effet observable | erreurs applicatives, corruption de données de test, tentative de contournement d'auth |
| Signaux | règle WAF déclenchée + motif anormal dans Loki |
| Signaux détaillés | *Proposition IA/Data, à valider (Axel)* — famille ML `injection`. Loki, audits ModSecurity du WAF (lignes JSON `{"transaction"…}`) : blocages 403 par seconde, audits déclenchant une règle CRS SQLi (`ruleId` 942xxx), somme des scores d'anomalie CRS (`Total Score`) ; lignes d'accès du WAF : part des URL contenant des caractères de syntaxe SQL (quote, `;`, `--`, `/*`, parenthèses). Prometheus : taille moyenne des requêtes (`http_request_bytes`), part de requêtes 400/422, erreurs base `db_errors_total` |
| Détection ML | Isolation Forest de la famille `injection` → alerte `type: sqli` avec les IP sources (`offenders`) |
| Décision | blocage source WAF + rollback snapshot BDD propre + rotation secret |
| Preuve de reprise | transaction OK **ET** intégrité des données vérifiée |

**Rappel sujet §2** : ne pas confondre restauration de disponibilité (A) et traitement d'une compromission/fuite (B).

Noms exacts des métriques, champs de journaux et labels que la plateforme doit fournir au détecteur : [`architecture/contrat-observabilite-ia.md`](architecture/contrat-observabilite-ia.md).

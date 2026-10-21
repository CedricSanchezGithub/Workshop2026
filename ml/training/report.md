# Rapport d'entraînement du détecteur (WOR-52)

Généré le 2026-10-21 12:30 — `uv run python -m training.train platform_normal_02.parquet`

## Données

- Fenêtres de 60 s au pas de 10 s : 2622 ({'normal': 2622})
- Entraînement : 1836 fenêtres normales (premiers 70 %) ; validation : 786 fenêtres normales + toutes les fenêtres d'attaque
- Alerte confirmée après 3 fenêtres anormales consécutives (comme en production)

## Résultats par famille

### `traffic` → `dos`

| Indicateur | Valeur |
|---|---|
| Incidents `dos` détectés | 0 / 0 |
| Délai de détection (s, depuis le début réel de l'attaque) | [] |
| Rappel par fenêtre (son type) | None |
| … Isolation Forest seule / enveloppe seule | None / None |
| Fenêtres normales jugées anormales (validation) | 0.0 |
| Fausses alertes confirmées sur le normal (validation) | 0 |
| Déclenchement sur l'autre type d'attaque | None |
| Features | `req_rate`, `p95_latency_s`, `p99_latency_s`, `err5xx_ratio`, `r429_ratio`, `bytes_out_rate`, `payments_ok_rate`, `waf_req_rate`, `distinct_ips`, `top_ip_share` |

### `injection` → `sqli`

| Indicateur | Valeur |
|---|---|
| Incidents `sqli` détectés | 0 / 0 |
| Délai de détection (s, depuis le début réel de l'attaque) | [] |
| Rappel par fenêtre (son type) | None |
| … Isolation Forest seule / enveloppe seule | None / None |
| Fenêtres normales jugées anormales (validation) | 0.0013 |
| Fausses alertes confirmées sur le normal (validation) | 0 |
| Déclenchement sur l'autre type d'attaque | None |
| Features | `waf_block_rate`, `crs_sqli_hits`, `crs_anomaly_score`, `suspicious_char_ratio`, `mean_req_bytes`, `client_err_ratio`, `db_error_rate` |

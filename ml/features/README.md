# ml/features — Features du détecteur (WOR-51)

`extract.py` calcule, pour chaque fenêtre glissante de 60 s (pas de 10 s), deux familles de features depuis Prometheus et Loki. Chaque famille alimente sa propre Isolation Forest ; la famille qui déclenche donne le type d'incident.

| Famille → attaque | Features |
|---|---|
| `traffic` → A (`dos`) | `req_rate`, `p95_latency_s`, `p99_latency_s`, `err5xx_ratio`, `r429_ratio`, `bytes_out_rate`, `payments_ok_rate`, `waf_req_rate`, `distinct_ips`, `top_ip_share` |
| `injection` → B (`sqli`) | `waf_block_rate`, `crs_sqli_hits`, `crs_anomaly_score`, `suspicious_char_ratio`, `mean_req_bytes`, `client_err_ratio`, `db_error_rate` |

Le même code sert à la collecte du dataset et à l'inférence en direct. Les noms de métriques et de champs de journaux attendus sont définis dans [`docs/architecture/contrat-observabilite-ia.md`](../../docs/architecture/contrat-observabilite-ia.md).

```bash
cd ml
uv run python -m features.collect --since 50m --out normal_01   # -> ml/data/normal_01.parquet
uv run pytest
```

`PROMETHEUS_URL` et `LOKI_URL` (par défaut `http://localhost:9090` et `http://localhost:3100`) pointent vers le labo ou vers le socle `infra/`.

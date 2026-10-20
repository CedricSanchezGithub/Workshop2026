# ml/inference — Service de détection (WOR-53)

Toutes les 10 s : features de la fenêtre glissante de 60 s (`features/extract.py`, même code que l'entraînement) → score de chaque famille avec le modèle `models/detector.joblib` → alerte signée vers le moteur de remédiation.

| Règle | Valeur |
|---|---|
| Alerte | après **2 fenêtres anormales consécutives** (évite les déclenchements sur un pic isolé) |
| Fin d'incident | événement `resolved` après 3 fenêtres normales |
| Sources (`offenders`) | IP pesant ≥ 20 % du trafic de la fenêtre : journaux de l'API pour `dos`, audits WAF (règles 93x/94x) pour `sqli` |
| Explication | 4 features les plus éloignées de la normale (`top_features`) |
| Transport | `POST {REMEDIATION_URL}/alerts`, signature HMAC-SHA256 — [contrat](../../docs/architecture/contrat-alerte-remediation.md) |

| Route | Contenu |
|---|---|
| `GET /status` | Score, seuil, écart à l'enveloppe, état et historique (90 points) par famille — lu par le dashboard |
| `GET /metrics` | `anomaly_score{family}`, `anomaly_threshold`, `anomaly_envelope_ratio`, `anomaly_active`, `alerts_sent_total` (scrapé par Prometheus, job `ml-inference`) |

En conteneur : service `ml-inference` de `infra/docker-compose.yml` (lecture seule, non-root, `cap_drop: ALL`, publié sur 127.0.0.1:8095). En local :

```bash
cd ml && uv run uvicorn inference.service:app --port 8095
```

Le service n'a accès qu'à Prometheus et Loki (lecture) et à la route `/alerts` du moteur ; il ne peut agir sur rien lui-même.

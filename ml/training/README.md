# ml/training — Entraînement et évaluation (WOR-52)

```bash
cd ml
uv run python -m features.collect --start <ts> --end <ts> --out platform_01   # export depuis Prometheus/Loki
uv run python -m training.train data/platform_*.parquet                       # -> inference/models/detector.joblib + report.md
```

## Modèle (`model.py`)

Par famille de signaux (`traffic` → attaque A `dos`, `injection` → attaque B `sqli`), deux composantes **non supervisées**, apprises uniquement sur le trafic normal :

1. **Isolation Forest** (300 arbres) sur les features transformées (`log1p` puis mise à l'échelle robuste médiane / MAD) : repère les combinaisons inhabituelles. Seuil = quantile des scores du normal : 0,2 % pour `traffic`, 0,1 % pour `injection`.
2. **Enveloppe statistique** par feature : z-score robuste, seuil = 1,5 × l'écart maximal observé en normal (au moins 6). Nécessaire parce qu'une Isolation Forest ne découpe qu'à l'intérieur de la plage vue à l'entraînement : une feature toujours nulle en normal (règles CRS SQLi, caractères SQL dans les URL) ne pèse pas dans ses arbres.

La famille `injection` est **unilatérale** : toutes ses features augmentent pendant une injection, donc les z-scores sont ramenés à 0 sous la médiane du normal (pour les deux composantes). `traffic` reste bilatérale, car une chute des transactions acceptées est elle-même un signe de DoS.

Une fenêtre est anormale si l'une des deux composantes la juge anormale ; l'alerte est confirmée après 3 fenêtres consécutives (comme en production). Aucun seuil écrit à la main : tous sont mesurés sur les données normales.

## Évaluation (`train.py`)

- Entraînement sur les 70 % les plus anciens du normal ; validation sur le reste du normal (faux positifs) et sur les fenêtres d'attaque étiquetées (`lab.traffic.label`).
- Indicateurs par famille : incidents détectés, **délai de détection** depuis le début réel de l'attaque, rappel par fenêtre (et contribution de chaque composante), faux positifs, déclenchement sur l'autre type d'attaque.
- Le modèle livré est réentraîné sur tout le normal disponible ; `report.md` / `report.json` alimentent le dossier.

## Réglages retenus (plateforme, 21/10)

Validation croisée par plage horaire (entraînement sur 3 plages de trafic légitime, test sur la 4ᵉ, 7,3 h au total, `data/platform_normal_02.parquet`) :

| Seuil IF (quantile du normal) | Fenêtres consécutives | Fausses alertes (trafic / injection) |
|---|---|---|
| 0,5 % | 2 | 3 / 2 |
| 0,2 % | 2 | 1 / 0 |
| **0,2 %** | **3** | **1 / 0** |
| 0,1 % | 3 | 1 / 0 |

Retenu : **0,2 % et 3 fenêtres** (environ une fausse alerte toutes les 7 h, contre une toutes les 1 h 30 avant). Coût : environ 10 s de détection en plus. La fausse alerte de trafic restante vient de la plage où la sonde du moteur ajoutait une 5ᵉ IP cliente (`distinct_ips`) ; plus il y a de trafic normal avec le moteur démarré, plus elle s'estompe. Rappel et délai de détection restent à mesurer sur les sessions d'attaque A et B.

**Injection, après une heure de veille sur le trafic légitime (21/10, 12 h 36 – 13 h 34)** : 2 fausses alertes `sqli` (12 h 39, 12 h 51), chacune suivie d'une restauration de payment-api. Aucun signal WAF/CRS : seule `mean_req_bytes` était basse (≈ 51 octets ; médiane du normal 75). Une Isolation Forest isole les deux extrémités, alors qu'une injection ne fait qu'allonger les requêtes. Rendre la famille unilatérale supprime ces alertes mais fait sortir l'extrémité haute (95 – 99 octets, sans autre signal) au seuil 0,2 %. Le seuil passe donc à 0,1 % pour cette famille :

| Injection | Validation croisée 7,3 h | Heure de veille (alertes / fenêtres anormales) | 1 requête SQLi bloquée par le WAF dans la fenêtre |
|---|---|---|---|
| Bilatérale, 0,2 % | 0 | 2 / 11 | détectée |
| Unilatérale, 0,2 % | 1 | 0 / 0 | détectée |
| **Unilatérale, 0,1 %** | **0** | **0 / 0** | **détectée** |

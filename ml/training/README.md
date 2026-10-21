# ml/training — Entraînement et évaluation (WOR-52)

```bash
cd ml
uv run python -m features.collect --start <ts> --end <ts> --out platform_01   # export depuis Prometheus/Loki
uv run python -m training.train data/platform_*.parquet                       # -> inference/models/detector.joblib + report.md
```

## Modèle (`model.py`)

Par famille de signaux (`traffic` → attaque A `dos`, `injection` → attaque B `sqli`), deux composantes **non supervisées**, apprises uniquement sur le trafic normal :

1. **Isolation Forest** (300 arbres) sur les features transformées (`log1p` puis mise à l'échelle robuste médiane / MAD) : repère les combinaisons inhabituelles. Seuil = quantile 0,2 % des scores du normal.
2. **Enveloppe statistique** par feature : z-score robuste, seuil = 1,5 × l'écart maximal observé en normal (au moins 6). Nécessaire parce qu'une Isolation Forest ne découpe qu'à l'intérieur de la plage vue à l'entraînement : une feature toujours nulle en normal (règles CRS SQLi, caractères SQL dans les URL) ne pèse pas dans ses arbres.

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

Retenu : **0,2 % et 3 fenêtres** (environ une fausse alerte toutes les 7 h, contre une toutes les 1 h 30 avant). Coût : environ 10 s de détection en plus. La fausse alerte restante vient de la plage où la sonde du moteur ajoutait une 5ᵉ IP cliente (`distinct_ips`) ; plus il y a de trafic normal avec le moteur démarré, plus elle s'estompe. Rappel et délai de détection restent à mesurer sur les sessions d'attaque A et B.

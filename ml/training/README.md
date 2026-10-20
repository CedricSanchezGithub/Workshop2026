# ml/training — Entraînement et évaluation (WOR-52)

```bash
cd ml
uv run python -m features.collect --start <ts> --end <ts> --out platform_01   # export depuis Prometheus/Loki
uv run python -m training.train data/platform_*.parquet                       # -> inference/models/detector.joblib + report.md
```

## Modèle (`model.py`)

Par famille de signaux (`traffic` → attaque A `dos`, `injection` → attaque B `sqli`), deux composantes **non supervisées**, apprises uniquement sur le trafic normal :

1. **Isolation Forest** (300 arbres) sur les features transformées (`log1p` puis mise à l'échelle robuste médiane / MAD) : repère les combinaisons inhabituelles. Seuil = quantile 0,5 % des scores du normal.
2. **Enveloppe statistique** par feature : z-score robuste, seuil = 1,5 × l'écart maximal observé en normal (au moins 6). Nécessaire parce qu'une Isolation Forest ne découpe qu'à l'intérieur de la plage vue à l'entraînement : une feature toujours nulle en normal (règles CRS SQLi, caractères SQL dans les URL) ne pèse pas dans ses arbres.

Une fenêtre est anormale si l'une des deux composantes la juge anormale ; l'alerte est confirmée après 2 fenêtres consécutives (comme en production). Aucun seuil écrit à la main : tous sont mesurés sur les données normales.

## Évaluation (`train.py`)

- Entraînement sur les 70 % les plus anciens du normal ; validation sur le reste du normal (faux positifs) et sur les fenêtres d'attaque étiquetées (`lab.traffic.label`).
- Indicateurs par famille : incidents détectés, **délai de détection** depuis le début réel de l'attaque, rappel par fenêtre (et contribution de chaque composante), faux positifs, déclenchement sur l'autre type d'attaque.
- Le modèle livré est réentraîné sur tout le normal disponible ; `report.md` / `report.json` alimentent le dossier.

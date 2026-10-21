"""Entraînement et évaluation du détecteur (WOR-52).

    uv run python -m training.train ml/data/platform_*.parquet
    uv run python -m training.train data/platform_normal_01.parquet data/platform_attacks_01.parquet

- Entraînement : fenêtres `normal` uniquement (premiers 70 % dans le temps) ; validation sur le
  reste du normal (faux positifs) et sur les fenêtres d'attaque (rappel, délai de détection).
- Décision en ligne simulée comme à l'inférence : alerte après CONSECUTIVE fenêtres anormales.
- Sorties : ml/inference/models/detector.joblib + ml/training/report.md (+ report.json).
"""

import json
import sys
import time
from pathlib import Path

import joblib
import numpy as np
import pandas as pd

from features.extract import FAMILIES, STEP_S, family_columns
from training.model import FamilyModel

ML = Path(__file__).resolve().parents[1]
MODEL_PATH = ML / "inference" / "models" / "detector.joblib"
REPORT = ML / "training" / "report.md"
CONSECUTIVE = 3
TRAIN_SHARE = 0.7


def load(paths: list[str]) -> pd.DataFrame:
    frames = [pd.read_parquet(p).assign(source=Path(p).stem) for p in paths]
    df = pd.concat(frames).sort_index()
    return df[~df.index.duplicated(keep="last")]


def alerts(anomaly: pd.Series) -> pd.Series:
    """Règle de confirmation de l'inférence : CONSECUTIVE fenêtres anormales d'affilée."""
    run = anomaly.astype(int).groupby((~anomaly).cumsum()).cumsum()
    return run >= CONSECUTIVE


def incidents(labels: pd.Series) -> list[tuple[str, int, int]]:
    """Plages contiguës d'une même attaque : (type, premier ts, dernier ts)."""
    out, cur = [], None
    for ts, lab in labels.items():
        if lab in FAMILIES.values():
            if cur and cur[0] == lab and ts - cur[2] <= 3 * STEP_S:
                cur = (lab, cur[1], ts)
            else:
                if cur:
                    out.append(cur)
                cur = (lab, ts, ts)
        elif cur and lab != "transition":
            out.append(cur)
            cur = None
    if cur:
        out.append(cur)
    return out


def evaluate(models: dict[str, FamilyModel], df: pd.DataFrame, valid_normal_idx) -> dict:
    res = {"families": {}}
    scores = {fam: m.score(df) for fam, m in models.items()}
    for fam, m in models.items():
        s, kind = scores[fam], m.incident_type
        fired = alerts(s["anomaly"])
        vn = s.loc[valid_normal_idx]
        own = df["label"] == kind
        res["families"][fam] = {
            "type": kind,
            "features": m.features,
            "trained_on_windows": m.trained_on,
            "if_threshold": round(m.if_threshold, 4),
            "false_positive_rate_window": round(float(vn["anomaly"].mean()), 4) if len(vn) else None,
            "false_alerts_on_normal": int(alerts(vn["anomaly"]).sum()) if len(vn) else None,
            "window_recall_own_type": round(float(s.loc[own, "anomaly"].mean()), 4) if own.any() else None,
            "window_recall_if_only": round(float(s.loc[own, "if_anomaly"].mean()), 4) if own.any() else None,
            "window_recall_envelope_only": round(float(s.loc[own, "z_anomaly"].mean()), 4) if own.any() else None,
            "fires_on_other_type": round(float(s.loc[df["label"].isin(set(FAMILIES.values()) - {kind}), "anomaly"].mean()), 4)
            if df["label"].isin(set(FAMILIES.values()) - {kind}).any() else None,
        }
        delays = []
        for t, start, end in incidents(df["label"]):
            if t != kind:
                continue
            # Le label démarre 30 s après le début réel (recouvrement minimal) : on mesure depuis
            # le début réel de l'attaque, soit le premier ts de la plage - 30 s.
            hit = fired.loc[start - 30: end + 60]
            first = hit[hit].index.min() if hit.any() else None
            delays.append(None if first is None else int(first - (start - 30)))
        res["families"][fam]["incidents"] = len(delays)
        res["families"][fam]["detected"] = sum(d is not None for d in delays)
        res["families"][fam]["detection_delay_s"] = delays
    return res


def report_md(res: dict, data: dict) -> str:
    lines = ["# Rapport d'entraînement du détecteur (WOR-52)", "",
             f"Généré le {time.strftime('%Y-%m-%d %H:%M')} — `uv run python -m training.train {' '.join(data['files'])}`", "",
             "## Données", "",
             f"- Fenêtres de 60 s au pas de {STEP_S} s : {data['windows']} ({data['counts']})",
             f"- Entraînement : {data['train']} fenêtres normales (premiers {int(TRAIN_SHARE * 100)} %) ; "
             f"validation : {data['valid_normal']} fenêtres normales + toutes les fenêtres d'attaque",
             f"- Alerte confirmée après {CONSECUTIVE} fenêtres anormales consécutives (comme en production)", "",
             "## Résultats par famille", ""]
    for fam, r in res["families"].items():
        lines += [f"### `{fam}` → `{r['type']}`", "",
                  "| Indicateur | Valeur |", "|---|---|",
                  f"| Incidents `{r['type']}` détectés | {r['detected']} / {r['incidents']} |",
                  f"| Délai de détection (s, depuis le début réel de l'attaque) | {r['detection_delay_s']} |",
                  f"| Rappel par fenêtre (son type) | {r['window_recall_own_type']} |",
                  f"| … Isolation Forest seule / enveloppe seule | {r['window_recall_if_only']} / {r['window_recall_envelope_only']} |",
                  f"| Fenêtres normales jugées anormales (validation) | {r['false_positive_rate_window']} |",
                  f"| Fausses alertes confirmées sur le normal (validation) | {r['false_alerts_on_normal']} |",
                  f"| Déclenchement sur l'autre type d'attaque | {r['fires_on_other_type']} |",
                  f"| Features | {', '.join(f'`{f}`' for f in r['features'])} |", ""]
    return "\n".join(lines)


def main(paths: list[str]) -> None:
    df = load(paths)
    normal = df[df["label"] == "normal"]
    cut = normal.index[int(len(normal) * TRAIN_SHARE)]
    train, valid_normal = normal.loc[:cut], normal.loc[cut + 1:]

    models = {fam: FamilyModel(fam, kind, family_columns(fam)).fit(train) for fam, kind in FAMILIES.items()}
    res = evaluate(models, df, valid_normal.index)

    # Modèle final : réentraîné sur TOUT le normal disponible.
    final = {fam: FamilyModel(fam, kind, family_columns(fam)).fit(normal) for fam, kind in FAMILIES.items()}
    MODEL_PATH.parent.mkdir(parents=True, exist_ok=True)
    joblib.dump({"models": final, "consecutive": CONSECUTIVE, "step_s": STEP_S, "trained_at": time.time(),
                 "files": [Path(p).name for p in paths]}, MODEL_PATH)

    data = {"files": [str(Path(p).name) for p in paths], "windows": len(df),
            "counts": df["label"].value_counts().to_dict(), "train": len(train), "valid_normal": len(valid_normal)}
    REPORT.write_text(report_md(res, data))
    (REPORT.with_suffix(".json")).write_text(json.dumps({"data": data, **res}, indent=2, default=str))
    print(REPORT.read_text())
    print(f"modèle -> {MODEL_PATH}")


if __name__ == "__main__":
    if len(sys.argv) < 2:
        raise SystemExit("usage : python -m training.train <fichiers parquet>")
    main(sys.argv[1:])

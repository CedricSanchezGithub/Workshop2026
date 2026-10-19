"""Exporte les features d'une période vers ai/data/*.parquet, avec la vérité terrain.

    uv run python -m detector.collect --since 50m
    uv run python -m detector.collect --start 1792405800 --end 1792408500 --out normal_01

Colonne `label` (évaluation uniquement, jamais utilisée pour l'entraînement) :
- `normal`     : la fenêtre de 60 s ne recoupe aucun incident noté dans labels.csv
- `dos`/`sqli` : la fenêtre recoupe un incident sur au moins MIN_OVERLAP_S secondes
- `transition` : recouvrement partiel (début/fin d'incident), exclu de l'évaluation
"""

import argparse
import re
import time
from pathlib import Path

import pandas as pd

from detector.features import WINDOW_S, fetch_range

DATA = Path(__file__).resolve().parents[1] / "data"
MIN_OVERLAP_S = 30


def parse_since(s: str) -> float:
    m = re.fullmatch(r"(\d+)([smhd])", s)
    if not m:
        raise SystemExit("--since attend par exemple 45m, 2h, 1d")
    return int(m.group(1)) * {"s": 1, "m": 60, "h": 3600, "d": 86400}[m.group(2)]


def label_windows(ts: pd.Index, labels: pd.DataFrame) -> pd.Series:
    out = pd.Series("normal", index=ts, dtype=object)
    for _, inc in labels.iterrows():
        w_start = ts.to_numpy() - WINDOW_S
        overlap = (pd.Series(ts, index=ts).clip(upper=inc["end"]) - pd.Series(w_start, index=ts).clip(lower=inc["start"]))
        out[(overlap > 0) & (out == "normal")] = "transition"
        out[overlap >= MIN_OVERLAP_S] = inc["type"]
    return out


def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument("--since", help="ex. 45m (relatif à maintenant)")
    p.add_argument("--start", type=float)
    p.add_argument("--end", type=float)
    p.add_argument("--out", help="nom du fichier (sans extension)")
    args = p.parse_args()

    end = args.end or time.time() - 10
    start = args.start or (end - parse_since(args.since) if args.since else None)
    if start is None:
        raise SystemExit("préciser --since ou --start")

    df = fetch_range(start, end)
    labels_path = DATA / "labels.csv"
    labels = pd.read_csv(labels_path) if labels_path.exists() else pd.DataFrame(columns=["start", "end", "type"])
    df["label"] = label_windows(df.index, labels)

    DATA.mkdir(exist_ok=True)
    name = args.out or f"features_{int(start)}_{int(end)}"
    path = DATA / f"{name}.parquet"
    df.to_parquet(path)
    print(f"{len(df)} fenêtres -> {path}")
    print(df["label"].value_counts().to_string())


if __name__ == "__main__":
    main()

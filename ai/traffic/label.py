"""Note les fenêtres d'incident (vérité terrain) dans ai/data/labels.csv.

À lancer au début et à la fin de chaque scénario joué par l'équipe cyber :

    uv run python -m traffic.label start dos  --note "scénario 1"
    uv run python -m traffic.label stop

Le CSV sert uniquement à évaluer le détecteur (les Isolation Forest s'entraînent
sur le trafic normal, sans étiquettes).
"""

import argparse
import csv
import json
import time
from pathlib import Path

DATA = Path(__file__).resolve().parents[1] / "data"
LABELS = DATA / "labels.csv"
OPEN = DATA / ".label_open.json"
TYPES = ("dos", "sqli")


def main() -> None:
    p = argparse.ArgumentParser()
    sub = p.add_subparsers(dest="cmd", required=True)
    s = sub.add_parser("start")
    s.add_argument("type", choices=TYPES)
    s.add_argument("--note", default="")
    sub.add_parser("stop")
    args = p.parse_args()
    DATA.mkdir(exist_ok=True)

    if args.cmd == "start":
        if OPEN.exists():
            raise SystemExit(f"une fenêtre est déjà ouverte : {OPEN.read_text()}")
        OPEN.write_text(json.dumps({"type": args.type, "start": time.time(), "note": args.note}))
        print(f"début {args.type} à {time.strftime('%H:%M:%S')}")
        return

    if not OPEN.exists():
        raise SystemExit("aucune fenêtre ouverte")
    w = json.loads(OPEN.read_text())
    new = not LABELS.exists()
    with LABELS.open("a", newline="") as f:
        out = csv.writer(f)
        if new:
            out.writerow(["start", "end", "type", "note"])
        out.writerow([round(w["start"], 3), round(time.time(), 3), w["type"], w["note"]])
    OPEN.unlink()
    print(f"fin {w['type']} — {time.time() - w['start']:.0f}s enregistrées dans {LABELS}")


if __name__ == "__main__":
    main()

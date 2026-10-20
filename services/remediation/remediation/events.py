"""Journal des événements de remédiation : stdout (JSON, collectable par Loki), fichier JSONL,
historique en mémoire et diffusion en direct (SSE) vers le dashboard."""

import asyncio
import json
import sys
import time
from collections import deque
from pathlib import Path


class EventBus:
    def __init__(self, path: Path | None = None, history: int = 500):
        self.path = path
        self.history: deque[dict] = deque(maxlen=history)
        self._subscribers: set[asyncio.Queue] = set()
        self.listeners: list = []  # fonctions appelées pour chaque événement (métriques...)
        if path:
            path.parent.mkdir(parents=True, exist_ok=True)

    def emit(self, kind: str, **data) -> dict:
        event = {"ts": time.time(), "service": "remediation", "event": kind, **data}
        line = json.dumps(event, ensure_ascii=False, default=str)
        print(line, file=sys.stdout, flush=True)
        if self.path:
            with self.path.open("a", encoding="utf-8") as f:
                f.write(line + "\n")
        self.history.append(event)
        for listener in self.listeners:
            listener(event)
        for q in list(self._subscribers):
            if q.full():
                q.get_nowait()
            q.put_nowait(event)
        return event

    def subscribe(self) -> asyncio.Queue:
        q: asyncio.Queue = asyncio.Queue(maxsize=200)
        self._subscribers.add(q)
        return q

    def unsubscribe(self, q: asyncio.Queue) -> None:
        self._subscribers.discard(q)

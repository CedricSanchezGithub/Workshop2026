"""Rapports d'incident du moteur de remédiation → collection Chroma `incident-reports`.

Indexation incrémentale : à chaque passage, seuls les rapports nouveaux ou modifiés (mtime) sont
(ré)indexés ; un rapport supprimé est retiré. Un rapport = un extrait : il est court, et l'incident
doit arriver entier au modèle (heures, symptômes, actions). Le dossier est en lecture seule.
"""

import re
import time
from pathlib import Path

from langchain_core.documents import Document

from assistant import config

FRONT_MATTER = re.compile(r"\A---\n(.*?)\n---\n", re.S)
NUMERIC = ("detected_at", "resolved_at")


def source_of(path: Path) -> str:
    return f"rapports/{path.name}"


def load(path: Path) -> Document:
    text = path.read_text(encoding="utf-8")
    meta: dict = {}
    m = FRONT_MATTER.match(text)
    if m:
        for line in m.group(1).splitlines():
            key, _, value = line.partition(":")
            if key.strip():
                meta[key.strip()] = value.strip()
        text = text[m.end():]
    for key in NUMERIC:
        if key in meta:
            meta[key] = float(meta[key])
    title = next((line[2:].strip() for line in text.splitlines() if line.startswith("# ")), path.stem)
    return Document(page_content=text.strip(), metadata={**meta, "source": source_of(path), "section": title})


class ReportIndex:
    def __init__(self, store_factory):
        self.store_factory = store_factory
        self.seen: dict[str, float] = {}  # nom du fichier -> mtime indexé

    def sync(self) -> int:
        """Retourne le nombre de rapports (ré)indexés."""
        if not config.REPORTS_DIR.is_dir():
            return 0
        current = {p.name: p.stat().st_mtime for p in config.REPORTS_DIR.glob("*.md") if not p.name.startswith(".")}
        changed = [n for n, mtime in current.items() if self.seen.get(n) != mtime]
        removed = [n for n in self.seen if n not in current]
        if not changed and not removed:
            return 0
        store = self.store_factory()
        for name in changed + removed:
            store.delete(where={"source": source_of(config.REPORTS_DIR / name)})
        docs = [load(config.REPORTS_DIR / n) for n in changed]
        if docs:
            store.add_documents(docs, ids=[d.metadata["source"] for d in docs])
        self.seen = current
        return len(docs)


def recent(store, now: float | None = None) -> list[Document]:
    """Rapports de la fenêtre RECENT_WINDOW_S, les plus récents d'abord (sélection par date)."""
    since = (now or time.time()) - config.RECENT_WINDOW_S
    got = store.get(where={"detected_at": {"$gte": since}}, include=["documents", "metadatas"])
    docs = [Document(page_content=text, metadata=meta) for text, meta in zip(got["documents"], got["metadatas"])]
    docs.sort(key=lambda d: d.metadata.get("detected_at", 0), reverse=True)
    return docs[:config.RECENT_MAX]

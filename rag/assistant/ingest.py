"""Indexe la documentation de l'équipe (docs/**/*.md, *.pdf) dans Chroma.

    uv run python -m assistant.ingest

À relancer après chaque ajout ou modification de document (PCA/PRA, EBIOS, ADR, runbooks).
L'index est reconstruit entièrement à chaque fois.
"""

import re
import shutil

from langchain_chroma import Chroma
from langchain_core.documents import Document
from langchain_text_splitters import MarkdownHeaderTextSplitter, RecursiveCharacterTextSplitter
from pypdf import PdfReader

from assistant import config

HEADERS = [("#", "h1"), ("##", "h2"), ("###", "h3")]
FRONT_MATTER = re.compile(r"\A---\n.*?\n---\n", re.S)


def load_markdown(path) -> list[Document]:
    text = FRONT_MATTER.sub("", path.read_text(encoding="utf-8"))
    sections = MarkdownHeaderTextSplitter(HEADERS, strip_headers=False).split_text(text)
    for d in sections:
        d.metadata["section"] = " > ".join(d.metadata.pop(k) for k in ("h1", "h2", "h3") if k in d.metadata)
    return sections


def load_pdf(path) -> list[Document]:
    return [Document(page_content=page.extract_text() or "", metadata={"section": f"page {i}"})
            for i, page in enumerate(PdfReader(path).pages, start=1)]


def load_docs() -> list[Document]:
    docs = []
    for path in sorted(config.DOCS_DIR.rglob("*")):
        if path.suffix.lower() not in (".md", ".pdf") or not path.is_file():
            continue
        parts = load_markdown(path) if path.suffix.lower() == ".md" else load_pdf(path)
        for d in parts:
            d.metadata["source"] = str(path.relative_to(config.DOCS_DIR))
        docs += [d for d in parts if d.page_content.strip()]
    return docs


def main() -> None:
    docs = load_docs()
    if not docs:
        raise SystemExit(f"aucun document dans {config.DOCS_DIR}")
    chunks = RecursiveCharacterTextSplitter(chunk_size=900, chunk_overlap=120).split_documents(docs)

    shutil.rmtree(config.CHROMA_DIR, ignore_errors=True)
    Chroma.from_documents(
        chunks,
        config.embeddings(),
        collection_name=config.COLLECTION,
        persist_directory=str(config.CHROMA_DIR),
        collection_metadata={"hnsw:space": "cosine"},
    )
    sources = sorted({c.metadata["source"] for c in chunks})
    print(f"{len(chunks)} extraits indexés depuis {len(sources)} documents :")
    for s in sources:
        print(f"  - {s}")


if __name__ == "__main__":
    main()

import pytest
from fastapi.testclient import TestClient
from langchain_core.messages import AIMessage

from assistant import app as rag
from assistant import config, ingest


def test_load_docs_splits_markdown_by_section(tmp_path, monkeypatch):
    (tmp_path / "runbooks").mkdir()
    (tmp_path / "runbooks" / "x.md").write_text(
        "---\nstatut: brouillon\n---\n# Titre\nintro\n## Étape 1\nfaire A\n## Étape 2\nfaire B\n", encoding="utf-8")
    (tmp_path / "ignore.txt").write_text("pas indexé")
    monkeypatch.setattr(config, "DOCS_DIR", tmp_path)

    docs = ingest.load_docs()

    assert {d.metadata["source"] for d in docs} == {"runbooks/x.md"}
    assert [d.metadata["section"] for d in docs] == ["Titre", "Titre > Étape 1", "Titre > Étape 2"]
    assert all("statut" not in d.page_content for d in docs)  # front matter retiré


class FakeLLM:
    def __init__(self):
        self.messages = None

    def invoke(self, messages):
        self.messages = messages
        return AIMessage("Bloquer les IP sources [1].")


def test_ask_cites_sources(monkeypatch):
    fake = FakeLLM()
    monkeypatch.setattr(rag, "llm", lambda: fake)
    monkeypatch.setattr(rag, "retrieve", lambda q: [rag.Source(
        ref=1, source="runbooks/incident-dos.md", section="Runbook > Symptômes", excerpt="...", relevance=0.8)])

    r = TestClient(rag.app).post("/ask", json={"question": "Que faire en cas de DoS ?"})

    assert r.status_code == 200
    assert r.json()["sources"][0]["source"] == "runbooks/incident-dos.md"
    assert "[1] runbooks/incident-dos.md" in fake.messages[1].content


def test_ask_without_context_does_not_call_llm(monkeypatch):
    monkeypatch.setattr(rag, "retrieve", lambda q: [])
    monkeypatch.setattr(rag, "llm", lambda: (_ for _ in ()).throw(AssertionError("LLM appelé sans contexte")))

    r = TestClient(rag.app).post("/ask", json={"question": "Quelle est la météo ?"})

    assert r.status_code == 200
    assert r.json() == {"answer": rag.NO_CONTEXT, "sources": []}


def test_ask_returns_clear_503_when_llm_unavailable(monkeypatch):
    class Down:
        def invoke(self, messages):
            raise ConnectionError("model 'qwen2.5:7b' not found")

    monkeypatch.setattr(rag, "llm", lambda: Down())
    monkeypatch.setattr(rag, "retrieve", lambda q: [rag.Source(
        ref=1, source="runbooks/incident-dos.md", section="", excerpt="...", relevance=0.8)])

    r = TestClient(rag.app).post("/ask", json={"question": "Que faire en cas de DoS ?"})

    assert r.status_code == 503
    assert "modèle de langage indisponible" in r.json()["detail"]


def test_ask_rejects_oversized_question():
    r = TestClient(rag.app).post("/ask", json={"question": "x" * 1001})
    assert r.status_code == 422


# --- Rapports d'incident du moteur de remédiation -------------------------------------------
import os
from datetime import datetime
from zoneinfo import ZoneInfo

from langchain_chroma import Chroma
from langchain_core.documents import Document
from langchain_core.embeddings import DeterministicFakeEmbedding

from assistant import reports

NOW = 1792665900.0  # 22/10/2026 12:45:00 (Europe/Paris)


def write_report(directory, name, detected_at, body="# Rapport d'incident inc-1 — Attaque A\n\nSite lent.\n"):
    path = directory / name
    path.write_text(f"---\nincident: inc-1\ntype: dos\nkind: incident\nstate: resolved\n"
                    f"detected_at: {detected_at}\n---\n{body}", encoding="utf-8")
    return path


@pytest.fixture
def report_dir(tmp_path, monkeypatch):
    d = tmp_path / "reports"
    d.mkdir()
    monkeypatch.setattr(config, "REPORTS_DIR", d)
    return d


@pytest.fixture
def chroma(tmp_path):
    return Chroma(collection_name="incident-reports", persist_directory=str(tmp_path / "chroma"),
                  embedding_function=DeterministicFakeEmbedding(size=32), collection_metadata={"hnsw:space": "cosine"})


def test_report_front_matter_becomes_metadata(report_dir):
    d = reports.load(write_report(report_dir, "a.md", 1792665618.2))
    assert d.metadata["detected_at"] == 1792665618.2 and d.metadata["type"] == "dos"
    assert d.metadata["source"] == "rapports/a.md" and d.metadata["section"].startswith("Rapport d'incident inc-1")
    assert not d.page_content.startswith("---")


def test_sync_indexes_new_modified_and_removed_reports(report_dir, chroma):
    index = reports.ReportIndex(lambda: chroma)
    a = write_report(report_dir, "a.md", NOW - 300)
    write_report(report_dir, "b.md", NOW - 600)
    (report_dir / ".tmp-x.md").write_text("partiel")
    assert index.sync() == 2 and index.sync() == 0

    write_report(report_dir, "a.md", NOW - 300, body="# Rapport\n\nRetour à la normale.\n")
    os.utime(a, (NOW, NOW))
    assert index.sync() == 1
    docs = chroma.get(where={"source": "rapports/a.md"})["documents"]
    assert docs == ["# Rapport\n\nRetour à la normale."]

    (report_dir / "b.md").unlink()
    index.sync()
    assert chroma.get(where={"source": "rapports/b.md"})["ids"] == []


def test_recent_selects_by_date_newest_first(report_dir, chroma, monkeypatch):
    monkeypatch.setattr(config, "RECENT_WINDOW_S", 3600)
    write_report(report_dir, "old.md", NOW - 7200)
    write_report(report_dir, "r1.md", NOW - 1800)
    write_report(report_dir, "r2.md", NOW - 300)
    reports.ReportIndex(lambda: chroma).sync()
    assert [d.metadata["source"] for d in reports.recent(chroma, now=NOW)] == ["rapports/r2.md", "rapports/r1.md"]


class NoHits:
    def similarity_search_with_relevance_scores(self, q, k):
        return []

    def get(self, **kw):
        return {"documents": [], "metadatas": []}


def test_event_question_without_recent_report_gets_engine_journal(report_dir, monkeypatch):
    monkeypatch.setattr(rag, "store", lambda: NoHits())
    monkeypatch.setattr(rag, "reports_store", lambda: NoHits())
    monkeypatch.setattr(rag, "now_local", lambda: datetime.fromtimestamp(NOW, ZoneInfo("Europe/Paris")))

    (src,) = rag.retrieve("Le site était lent il y a 5 minutes, tu sais quelque chose ?")
    assert src.source == "journal du moteur de remédiation" and src.relevance is None
    assert "Aucun incident ni alerte" in src.excerpt and "entre 10:45 et 12:45 le 22/10/2026" in src.excerpt

    assert rag.retrieve("Que contient le PCA ?") == []  # question de procédure : pas de journal


def test_event_question_puts_recent_reports_first(report_dir, chroma, monkeypatch):
    write_report(report_dir, "r.md", NOW - 300)
    reports.ReportIndex(lambda: chroma).sync()
    monkeypatch.setattr(rag, "store", lambda: NoHits())
    monkeypatch.setattr(rag, "reports_store", lambda: chroma)
    monkeypatch.setattr(reports.time, "time", lambda: NOW)
    monkeypatch.setattr(config, "REPORT_MIN_RELEVANCE", 2.0)  # isole la sélection par date

    (src,) = rag.retrieve("the website was slow 5 minutes ago")
    assert src.source == "rapports/r.md" and src.relevance is None


def test_prompt_contains_current_time(monkeypatch):
    fake = FakeLLM()
    monkeypatch.setattr(rag, "llm", lambda: fake)
    monkeypatch.setattr(rag, "now_local", lambda: datetime.fromtimestamp(NOW, ZoneInfo("Europe/Paris")))
    monkeypatch.setattr(rag, "retrieve", lambda q: [rag.Source(
        ref=1, source="rapports/r.md", section="Rapport", excerpt="...", relevance=None)])

    r = TestClient(rag.app).post("/ask", json={"question": "Le site était lent tout à l'heure ?"})

    assert r.status_code == 200 and r.json()["sources"][0]["relevance"] is None
    assert "Date et heure actuelles : 22/10/2026 12:45" in fake.messages[1].content


def test_context_gives_report_age_in_minutes(monkeypatch):
    fake = FakeLLM()
    monkeypatch.setattr(rag, "llm", lambda: fake)
    monkeypatch.setattr(rag, "now_local", lambda: datetime.fromtimestamp(NOW, ZoneInfo("Europe/Paris")))
    monkeypatch.setattr(rag, "retrieve", lambda q: [rag.Source(
        ref=1, source="rapports/r.md", section="Rapport", excerpt="...", relevance=None, detected_at=NOW - 290)])

    TestClient(rag.app).post("/ask", json={"question": "Le site était lent il y a 5 minutes ?"})

    assert "[1] rapports/r.md — Rapport (détecté à 12:40:10, il y a 5 min)" in fake.messages[1].content

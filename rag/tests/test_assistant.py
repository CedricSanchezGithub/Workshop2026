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

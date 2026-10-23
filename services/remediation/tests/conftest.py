import pytest

from remediation import config


@pytest.fixture(autouse=True)
def reports_dir(tmp_path, monkeypatch):
    """Les tests n'écrivent jamais dans le vrai dossier de rapports lu par l'assistant."""
    path = tmp_path / "reports"
    monkeypatch.setattr(config, "REPORTS_DIR", path)
    return path

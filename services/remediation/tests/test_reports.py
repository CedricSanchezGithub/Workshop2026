import time

from remediation import app as api
from remediation import reports
from remediation.engine import Incident, Step

T0 = time.mktime((2026, 10, 22, 12, 40, 18, 0, 0, -1))


def dos_incident(**kw) -> Incident:
    inc = Incident("dos", "a-1", -0.23, -0.17, ["192.168.137.42", "172.30.0.1"],
                   {"p99_latency_s": 1.8, "r429_ratio": 0.42, "top_ip_share": 0.95}, id="inc-test0001",
                   detected_at=T0)
    inc.blocked = ["192.168.137.42"]
    inc.steps = [
        Step("decide", "Décision", "ok", T0, T0, "dos: blocage IP + redémarrage si dégradé"),
        Step("guard", "Garde-fous", "skipped", T0, T0, "IP non bloquées (protégées ou invalides) : 172.30.0.1"),
        Step("waf_block", "Blocage au WAF de 192.168.137.42", "ok", T0 + 1, T0 + 4, "3.1 s"),
        Step("verify", "Vérification : transaction de test", "ok", T0 + 5, T0 + 6, "paiement pi_x accepté"),
    ]
    inc.state, inc.resolved_at = "resolved", T0 + 6
    for k, v in kw.items():
        setattr(inc, k, v)
    return inc


def test_dos_report_speaks_plainly_with_absolute_times(reports_dir):
    path = reports.write_incident(dos_incident().to_dict())
    text = path.read_text(encoding="utf-8")

    assert path.name == "2026-10-22T12-40-18_inc-test0001_dos.md"
    assert "detected_at: " in text and "kind: incident" in text
    assert "déni de service (lenteur" in text and "site lent" in text
    assert "42 % des requêtes refusées" in text and "95 % des requêtes venant d'une seule adresse IP" in text
    assert "22/10/2026 à 12:40:18" in text and "en 6.0 s" in text
    assert "Adresses bloquées au WAF : 192.168.137.42" in text
    assert "Garde-fous : IP non bloquées (protégées ou invalides) : 172.30.0.1" in text
    assert "12:40:19 — Blocage au WAF de 192.168.137.42 : réussi (3.1 s)" in text
    assert "pas encore signalé le retour à la normale" in text


def test_failed_sqli_report_asks_for_human(reports_dir):
    inc = dos_incident(type="sqli", state="failed", top_features={"crs_sqli_hits": 3.0})
    text = reports.write_incident(inc.to_dict()).read_text(encoding="utf-8")
    assert "injection SQL" in text and "escalade humaine" in text and "docs/runbooks/reprise.md" in text
    assert "3 requête(s) déclenchant une règle anti-injection SQL" in text


def test_suppressed_alert_report(reports_dir):
    event = {"ts": T0, "event": "alert_suppressed", "type": "dos", "alert_id": "96e725ed24004eaabdded8ea",
             "offenders": ["172.30.0.1"], "remaining_s": 147.8,
             "reason": "stabilisation après redémarrage / restauration de payment-api"}
    path = reports.write_suppressed(event)
    text = path.read_text(encoding="utf-8")
    assert path.name == "2026-10-22T12-40-18_96e725ed2400_dos-ignoree.md"
    assert "kind: alerte_ignoree" in text and "ne l'a pas traitée" in text and "148 s" in text


def test_write_is_atomic_and_leaves_no_temp_file(reports_dir):
    reports.write("x.md", "v1", reports_dir)
    reports.write("x.md", "v2", reports_dir)
    assert (reports_dir / "x.md").read_text() == "v2"
    assert [p.name for p in reports_dir.iterdir()] == ["x.md"]


def test_listener_writes_on_close_and_rewrites_on_detector_resolved(reports_dir, monkeypatch):
    inc = dos_incident()
    monkeypatch.setattr(api.engine, "incidents", [inc])

    api._write_report({"event": "incident_resolved", "incident": inc.id})
    (path,) = reports_dir.iterdir()
    assert "pas encore signalé" in path.read_text(encoding="utf-8")

    inc.detector_resolved_at = T0 + 120
    api._write_report({"event": "detector_resolved", "incident": inc.id})
    assert "revenu à la normale le 22/10/2026 à 12:42:18" in path.read_text(encoding="utf-8")
    assert len(list(reports_dir.iterdir())) == 1


def test_listener_ignores_open_incidents_and_never_raises(reports_dir, monkeypatch):
    inc = dos_incident(state="acting", resolved_at=None)
    monkeypatch.setattr(api.engine, "incidents", [inc])
    api._write_report({"event": "detector_resolved", "incident": inc.id})
    assert not reports_dir.exists() or not any(reports_dir.iterdir())

    monkeypatch.setattr(api.reports, "write_suppressed", lambda e: 1 / 0)
    api._write_report({"event": "alert_suppressed", "type": "dos"})  # ne lève pas

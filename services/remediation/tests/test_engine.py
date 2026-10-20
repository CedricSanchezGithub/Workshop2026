import asyncio
import ipaddress
from datetime import datetime, timedelta, timezone

import pytest

from remediation import config, guards, playbooks, signing
from remediation.engine import Engine
from remediation.events import EventBus
from remediation.models import Alert
from remediation.playbooks import PlaybookResult
from remediation.probe import ProbeResult


@pytest.fixture(autouse=True)
def fast(monkeypatch):
    monkeypatch.setattr(config, "VERIFY_ATTEMPTS", 2)
    monkeypatch.setattr(config, "VERIFY_INTERVAL_S", 0)


def alert(kind="dos", **kw) -> Alert:
    base = dict(id=f"a-{kind}-{kw.pop('n', 1):04d}", ts=datetime.now(timezone.utc), type=kind,
                family="traffic" if kind == "dos" else "injection", score=-0.3, threshold=-0.1,
                offenders=["192.168.137.42"])
    return Alert(**{**base, **kw})


class FakeProbe:
    def __init__(self, results):
        self.results = list(results)

    async def transaction(self):
        ok = self.results.pop(0) if self.results else True
        return ProbeResult(ok, "done" if ok else "intent", 10, 202 if ok else 503, "pi_test" if ok else None)

    async def health(self):
        return ProbeResult(True, "health", 5, 200)


class FakePlaybooks:
    def __init__(self, fail=()):
        self.calls, self.fail = [], set(fail)

    async def __call__(self, action, params):
        playbooks.build_argv(action, params)  # mêmes validations que le vrai runner
        self.calls.append((action, params))
        return PlaybookResult(action, action not in self.fail, 0.1, "")


def run(engine, *alerts):
    async def go():
        incs = [engine.handle(a) for a in alerts]
        while engine._tasks:
            await asyncio.gather(*list(engine._tasks))
        return incs
    return asyncio.run(go())


def make(probe_results=(), fail=(), protected=frozenset()):
    pb = FakePlaybooks(fail)
    return Engine(EventBus(), FakeProbe(probe_results), run_playbook=pb, protected=set(protected)), pb


# --- Signature et anti-rejeu ----------------------------------------------------------------

def test_hmac_signature():
    sig = signing.sign(b"k", b'{"a":1}')
    assert signing.verify_signature(b"k", b'{"a":1}', sig)
    assert not signing.verify_signature(b"k", b'{"a":2}', sig)
    assert not signing.verify_signature(b"other", b'{"a":1}', sig)
    assert not signing.verify_signature(b"k", b'{"a":1}', None)


def test_freshness_and_replay():
    now = datetime.now(timezone.utc)
    assert signing.is_fresh(now - timedelta(seconds=30), 60)
    assert not signing.is_fresh(now - timedelta(seconds=90), 60)
    guard = signing.ReplayGuard()
    assert guard.check_and_add("x") and not guard.check_and_add("x")


# --- Garde-fous et liste fermée -------------------------------------------------------------

def test_guards_never_block_host_or_loopback():
    host = {ipaddress.ip_address("172.30.0.1"), ipaddress.ip_address("192.168.137.1")}
    ok, refused = guards.blockable(["192.168.137.42", "172.30.0.1", "127.0.0.1", "192.168.137.1", "nope",
                                    "::1", "192.168.137.42"], host)
    assert ok == ["192.168.137.42"]
    assert refused == ["172.30.0.1", "127.0.0.1", "192.168.137.1", "nope", "::1"]


def test_playbook_closed_list():
    assert playbooks.build_argv("waf_block", {"ips": ["10.0.0.5"]})[-2:] == ["-e", '{"ips": ["10.0.0.5"]}']
    with pytest.raises(ValueError):
        playbooks.build_argv("rm_rf", {})
    with pytest.raises(ValueError):
        playbooks.build_argv("restart_service", {"service": "vault"})
    with pytest.raises(ValueError):
        playbooks.build_argv("waf_block", {"ips": "10.0.0.5"})


# --- Table de décision ----------------------------------------------------------------------

def test_dos_block_is_enough():
    engine, pb = make(probe_results=[True, True])
    [inc] = run(engine, alert("dos"))
    assert inc.state == "resolved"
    assert [c[0] for c in pb.calls] == ["waf_block"]
    assert inc.blocked == ["192.168.137.42"]


def test_dos_restarts_when_still_degraded():
    engine, pb = make(probe_results=[False, True])
    [inc] = run(engine, alert("dos"))
    assert inc.state == "resolved"
    assert [c[0] for c in pb.calls] == ["waf_block", "restart_service"]
    assert pb.calls[1][1] == {"service": "payment-api"}


def test_sqli_always_restores():
    engine, pb = make(probe_results=[True])
    [inc] = run(engine, alert("sqli"))
    assert inc.state == "resolved"
    assert [c[0] for c in pb.calls] == ["waf_block", "restore_service"]
    assert pb.calls[1][1] == {"service": "payment-api"}
    assert any(s.name == "integrity" for s in inc.steps)


def test_escalates_after_max_rounds():
    engine, pb = make(probe_results=[False] * 20)
    [inc] = run(engine, alert("dos"))
    assert inc.state == "failed"
    assert [c[0] for c in pb.calls].count("restart_service") == config.MAX_ACTION_ROUNDS
    assert any(e["event"] == "escalation" for e in engine.bus.history)


def test_protected_offender_is_not_blocked():
    engine, pb = make(probe_results=[True, True], protected={ipaddress.ip_address("172.30.0.1")})
    [inc] = run(engine, alert("dos", offenders=["172.30.0.1"]))
    assert inc.state == "resolved" and pb.calls == []
    assert any(s.name == "guard" for s in inc.steps)


def test_second_alert_merges_into_active_incident():
    engine, pb = make(probe_results=[True, True])

    async def go():
        first = engine.handle(alert("dos", n=1))
        second = engine.handle(alert("dos", n=2, offenders=["192.168.137.43"]))
        while engine._tasks:
            await asyncio.gather(*list(engine._tasks))
        return first, second

    first, second = asyncio.run(go())
    assert first is second and first.offenders == ["192.168.137.42", "192.168.137.43"]
    assert len(engine.incidents) == 1


def test_resolved_event_marks_detector_side():
    engine, _ = make(probe_results=[True, True])
    [inc] = run(engine, alert("dos"))
    engine.handle(alert("dos", n=9, event="resolved"))
    assert inc.detector_resolved_at is not None

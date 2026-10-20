import json
from datetime import datetime, timedelta, timezone

import pytest
from fastapi.testclient import TestClient

from remediation import app as api
from remediation import signing

KEY = b"cle-de-test"


@pytest.fixture
def client(monkeypatch):
    monkeypatch.setattr(api, "_hmac_key", KEY)
    handled = []
    monkeypatch.setattr(api.engine, "handle", lambda alert: handled.append(alert) or None)
    with TestClient(api.app) as c:
        c.handled = handled
        yield c


def body(**kw) -> bytes:
    data = {"id": "alert-0001", "ts": datetime.now(timezone.utc).isoformat(), "type": "dos", "family": "traffic",
            "score": -0.3, "threshold": -0.1, "offenders": ["192.168.137.42"]}
    return json.dumps({**data, **kw}).encode()


def post(client, raw: bytes, key: bytes = KEY):
    return client.post("/alerts", content=raw, headers={"Content-Type": "application/json",
                                                        "X-Signature": signing.sign(key, raw)})


def test_signed_alert_is_accepted(client):
    r = post(client, body())
    assert r.status_code == 202 and len(client.handled) == 1


def test_unsigned_or_forged_alert_is_rejected(client):
    raw = body(id="alert-0002")
    assert client.post("/alerts", content=raw).status_code == 401
    assert post(client, raw, key=b"autre-cle").status_code == 401
    assert client.handled == []


def test_replayed_alert_is_rejected(client):
    raw = body(id="alert-0003")
    assert post(client, raw).status_code == 202
    assert post(client, raw).status_code == 409
    assert len(client.handled) == 1


def test_stale_alert_is_rejected(client):
    old = (datetime.now(timezone.utc) - timedelta(minutes=5)).isoformat()
    assert post(client, body(id="alert-0004", ts=old)).status_code == 409


def test_invalid_alert_is_rejected(client):
    assert post(client, body(id="alert-0005", type="rm -rf")).status_code == 422


def test_state_endpoint(client):
    r = client.get("/api/state")
    assert r.status_code == 200 and r.json()["banner"]["state"] in ("normal", "degraded")

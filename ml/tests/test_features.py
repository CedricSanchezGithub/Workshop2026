import httpx
import pandas as pd

from features import extract as features
from features.collect import label_windows


def _transport(request: httpx.Request) -> httpx.Response:
    """Faux Prometheus/Loki : chaque requête renvoie une série constante, sauf la requête par IP."""
    q = request.url.params["query"]
    if request.url.path.endswith("/api/v1/query_range") and "loki" not in str(request.url.host):
        start, end, step = (int(float(request.url.params[k])) for k in ("start", "end", "step"))
        values = [[t, "2"] for t in range(start, end + 1, step)]
        return httpx.Response(200, json={"data": {"result": [{"metric": {}, "values": values}]}})
    start, end = (int(request.url.params[k]) // 10**9 for k in ("start", "end"))
    if "client_ip" in q:
        result = [{"metric": {"client_ip": ip}, "values": [[t, str(n)] for t in range(start, end + 1, 10)]}
                  for ip, n in (("10.0.0.1", 6), ("10.0.0.2", 2), ("10.0.0.3", 2))]
    else:
        result = [{"metric": {}, "values": [[t, "4"] for t in range(start, end + 1, 10)]}]
    return httpx.Response(200, json={"data": {"result": result}})


def test_fetch_range_shape_and_ip_features(monkeypatch):
    monkeypatch.setattr(features, "PROMETHEUS_URL", "http://prom")
    monkeypatch.setattr(features, "LOKI_URL", "http://loki")
    with httpx.Client(transport=httpx.MockTransport(_transport)) as http:
        df = features.fetch_range(1000, 1100, 10, http=http)

    assert list(df.index) == list(range(1000, 1101, 10))
    expected = {f.name for f in features.FEATURES} | set(features.IP_FEATURES)
    assert set(df.columns) == expected
    assert (df["req_rate"] == 2).all()
    assert (df["suspicious_char_ratio"] == 1).all()  # 4 / 4 (numérateur / dénominateur Loki)
    assert (df["distinct_ips"] == 3).all()
    assert (df["top_ip_share"] == 0.6).all()
    assert not df.isna().any().any()


def test_families_cover_all_features():
    cols = features.family_columns("traffic") + features.family_columns("injection")
    assert sorted(cols) == sorted([f.name for f in features.FEATURES] + list(features.IP_FEATURES))


def test_label_windows():
    ts = pd.Index(range(0, 301, 10))
    labels = pd.DataFrame([{"start": 100, "end": 200, "type": "dos"}])
    lab = label_windows(ts, labels)
    assert lab[50] == "normal"          # fenêtre [-10, 50] : aucun recouvrement
    assert lab[120] == "transition"     # [60, 120] : 20 s de recouvrement
    assert lab[160] == "dos"            # [100, 160] : 60 s
    assert lab[230] == "dos"            # [170, 230] : 30 s (170 → 200)
    assert lab[240] == "transition"     # [180, 240] : 20 s
    assert lab[270] == "normal"         # [210, 270] : incident terminé

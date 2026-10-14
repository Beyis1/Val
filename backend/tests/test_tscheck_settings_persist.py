"""Criterion: Settings autosave via PUT /api/settings and persisted on GET."""

import uuid


def test_settings_put_persists(client):
    marker = f"tscheck-sens-{uuid.uuid4().hex[:8]}"
    get_resp = client.get("/settings")
    assert get_resp.status_code == 200, get_resp.text
    data = get_resp.json().get("data", {})

    data["_tscheck_marker"] = marker
    data["sensitivity"] = 0.42

    put_resp = client.put("/settings", json={"data": data})
    assert put_resp.status_code == 200, put_resp.text

    verify_resp = client.get("/settings")
    assert verify_resp.status_code == 200
    verified = verify_resp.json()["data"]
    assert verified.get("_tscheck_marker") == marker
    assert verified.get("sensitivity") == 0.42

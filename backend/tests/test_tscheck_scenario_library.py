"""Criterion: Workshop library lists built-in scenarios grouped by map; favorite toggles via API."""

import uuid


def test_scenarios_list_has_40_builtin(client):
    resp = client.get("/scenarios")
    assert resp.status_code == 200, resp.text
    data = resp.json()
    builtin = [s for s in data if s.get("builtin")]
    # briefing (seed_facts): "40 built-in scenarios incl. b-range-strafe and b-sandbox-arena"
    assert len(builtin) == 40, f"expected 40 builtin scenarios, got {len(builtin)}"
    ids = {s["id"] for s in builtin}
    for expected_id in ["b-range-gridshot", "b-range-flick", "b-range-tracking", "b-range-strafe", "b-sandbox-arena"]:
        assert expected_id in ids

    maps = {s["map_id"] for s in builtin}
    assert "range" in maps
    assert "ascent" in maps
    assert "sandbox" in maps


def test_scenario_favorite_toggle_persists():
    import httpx

    BASE = "http://localhost:8001/api"
    with httpx.Client(base_url=BASE, timeout=30.0) as c:
        # create our own scenario fixture to toggle favorite on (never touch seeded rows)
        name = f"tscheck-fav-{uuid.uuid4().hex[:8]}"
        create_resp = c.post(
            "/scenarios",
            json={
                "name": name,
                "name_en": name,
                "description": "fixture",
                "description_en": "fixture",
                "map_id": "range",
                "type": "gridshot",
                "difficulty": "easy",
                "duration": 30,
            },
        )
        assert create_resp.status_code == 200, create_resp.text
        scenario = create_resp.json()
        sid = scenario["id"]
        assert scenario["favorite"] is False

        fav_resp = c.post(f"/scenarios/{sid}/favorite", json={"favorite": True})
        assert fav_resp.status_code == 200, fav_resp.text
        assert fav_resp.json()["favorite"] is True

        get_resp = c.get(f"/scenarios/{sid}")
        assert get_resp.status_code == 200
        assert get_resp.json()["favorite"] is True

        # cleanup
        c.delete(f"/scenarios/{sid}")

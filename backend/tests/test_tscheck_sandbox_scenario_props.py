"""Criterion: Sandbox map + editable props.

Verifies (1) the built-in b-sandbox-arena scenario has 9 props and 5 bots, and
(2) a freshly-created Sandbox scenario persists arbitrary prop entries (size/yaw/color)
via POST /api/scenarios, matching what the editor's "add prop" (B key) flow writes.
"""
import uuid


def test_builtin_sandbox_arena_has_9_props_and_5_bots(client):
    resp = client.get("/scenarios/b-sandbox-arena")
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert data["map_id"] == "sandbox"
    assert len(data["props"]) == 9, f"expected 9 props, got {len(data['props'])}"
    assert len(data["bots"]) == 5, f"expected 5 bots, got {len(data['bots'])}"
    # sanity check prop shape matches editor's inspector fields (size/yaw/color)
    prop = data["props"][0]
    for key in ("id", "pos", "size", "yaw", "color"):
        assert key in prop, f"prop missing {key}: {prop}"


def test_create_sandbox_scenario_persists_custom_props(client):
    unique = f"tscheck-sandbox-{uuid.uuid4().hex[:8]}"
    payload = {
        "id": unique,
        "name": unique,
        "name_en": unique,
        "description": "testing props persistence",
        "description_en": "testing props persistence",
        "map_id": "sandbox",
        "type": "preaim",
        "difficulty": "medium",
        "duration": 60,
        "bots_shoot": False,
        "spawn": [0.0, 0.0, 10.0],
        "spawn_yaw": 0.0,
        "site": None,
        "bots": [],
        "allowed_weapons": [],
        "props": [
            {
                "id": str(uuid.uuid4()),
                "pos": [1.0, 0.0, -5.0],
                "size": [2.0, 3.0, 1.5],
                "yaw": 0.75,
                "color": "#FF00AA",
            }
        ],
    }
    created = client.post("/scenarios", json=payload)
    assert created.status_code == 200, created.text
    created_id = created.json()["id"]

    try:
        fetched = client.get(f"/scenarios/{created_id}")
        assert fetched.status_code == 200, fetched.text
        fetched_data = fetched.json()
        assert len(fetched_data["props"]) == 1
        prop = fetched_data["props"][0]
        assert prop["size"] == [2.0, 3.0, 1.5]
        assert prop["yaw"] == 0.75
        assert prop["color"] == "#FF00AA"
    finally:
        client.delete(f"/scenarios/{created_id}")

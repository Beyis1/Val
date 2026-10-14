"""Criterion: Scenario flow results -> record is POSTed and appears on /records."""

import uuid


def test_record_create_and_appears_in_list(client):
    scenario_id = "b-range-gridshot"  # seeded builtin, read-only use (no mutation)
    payload = {
        "scenario_id": scenario_id,
        "score": 12345,
        "shots": 20,
        "hits": 18,
        "headshots": 5,
        "kills": 18,
        "accuracy": 90.0,
        "headshot_rate": 27.5,
        "avg_reaction_ms": 210.5,
        "duration_sec": 15.2,
        "died": False,
        "completed": True,
        "weapon": "vandal",
    }
    create_resp = client.post("/records", json=payload)
    assert create_resp.status_code == 200, create_resp.text
    record = create_resp.json()
    assert record["scenario_id"] == scenario_id
    assert record["score"] == 12345
    record_id = record["id"]

    list_resp = client.get("/records")
    assert list_resp.status_code == 200, list_resp.text
    records = list_resp.json()
    ids = {r["id"] for r in records}
    assert record_id in ids, "created record not found in /api/records list"

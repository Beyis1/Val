from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, HTTPException

from lib.db import db
from models.record import Record, RecordCreate, RecordsSummary, ScenarioBest

router = APIRouter()


def _aware(v):
    if isinstance(v, datetime) and v.tzinfo is None:
        return v.replace(tzinfo=timezone.utc)
    return v


@router.post("/records", response_model=Record)
async def create_record(body: RecordCreate):
    sc = await db.scenarios.find_one({"id": body.scenario_id}, {"_id": 0})
    if not sc:
        raise HTTPException(status_code=404, detail="scenario not found")
    prev_best = sc.get("best_score")
    new_best = prev_best is None or body.score > prev_best
    rec = Record(
        **body.model_dump(),
        scenario_name=sc.get("name", ""),
        map_id=sc.get("map_id", ""),
        type=sc.get("type", ""),
        new_best=new_best,
    )
    await db.records.insert_one(rec.model_dump())
    upd: dict = {"$inc": {"play_count": 1}}
    if new_best:
        upd["$set"] = {"best_score": body.score}
    await db.scenarios.update_one({"id": body.scenario_id}, upd)
    return rec


@router.get("/records", response_model=list[Record])
async def list_records(scenario_id: Optional[str] = None, limit: int = 300):
    q = {"scenario_id": scenario_id} if scenario_id else {}
    docs = await db.records.find(q, {"_id": 0}).sort("created_at", -1).to_list(max(1, min(limit, 2000)))
    for d in docs:
        d["created_at"] = _aware(d.get("created_at"))
    return [Record(**d) for d in docs]


@router.get("/records/summary", response_model=RecordsSummary)
async def records_summary():
    tot = await db.records.aggregate([
        {"$group": {
            "_id": None,
            "rounds": {"$sum": 1}, "kills": {"$sum": "$kills"}, "shots": {"$sum": "$shots"},
            "hits": {"$sum": "$hits"}, "hs": {"$sum": "$headshots"},
            "acc": {"$avg": "$accuracy"}, "hsr": {"$avg": "$headshot_rate"},
            "react": {"$avg": "$avg_reaction_ms"}, "time": {"$sum": "$duration_sec"},
        }}
    ]).to_list(1)
    best_rows = await db.records.aggregate([
        {"$sort": {"created_at": -1}},
        {"$group": {
            "_id": "$scenario_id", "name": {"$first": "$scenario_name"}, "map_id": {"$first": "$map_id"},
            "type": {"$first": "$type"}, "best": {"$max": "$score"}, "plays": {"$sum": 1},
            "acc": {"$avg": "$accuracy"}, "last": {"$first": "$created_at"},
        }},
        {"$sort": {"last": -1}},
    ]).to_list(500)
    s = RecordsSummary()
    if tot:
        t = tot[0]
        s = RecordsSummary(
            total_rounds=t["rounds"], total_kills=t["kills"], total_shots=t["shots"], total_hits=t["hits"],
            total_headshots=t["hs"], avg_accuracy=round(t["acc"] or 0, 2), avg_headshot_rate=round(t["hsr"] or 0, 2),
            avg_reaction_ms=round(t["react"], 1) if t["react"] is not None else None, total_time_sec=round(t["time"] or 0, 1),
        )
    s.best = [
        ScenarioBest(
            scenario_id=r["_id"], scenario_name=r["name"] or "", map_id=r["map_id"] or "", type=r["type"] or "",
            best_score=r["best"], plays=r["plays"], avg_accuracy=round(r["acc"] or 0, 2), last_played=_aware(r["last"]),
        )
        for r in best_rows
    ]
    return s

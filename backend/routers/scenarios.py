import json
import logging
from datetime import datetime, timezone
from pathlib import Path

from fastapi import APIRouter, HTTPException

from lib.db import db
from models.scenario import FavoriteUpdate, Scenario, ScenarioBase

router = APIRouter()
logger = logging.getLogger(__name__)
SEED_FILE = Path(__file__).parent.parent / "seed_data" / "builtin_scenarios.json"


def _norm(doc: dict) -> Scenario:
    doc.pop("_id", None)
    for k in ("created_at", "updated_at"):
        v = doc.get(k)
        if isinstance(v, datetime) and v.tzinfo is None:
            doc[k] = v.replace(tzinfo=timezone.utc)
    return Scenario(**doc)


async def seed_builtin_scenarios() -> None:
    """Insert bundled scenarios that are missing (never overwrites user edits)."""
    if not SEED_FILE.exists():
        return
    items = json.loads(SEED_FILE.read_text(encoding="utf-8"))
    for item in items:
        sc = Scenario(**item, builtin=True)
        await db.scenarios.update_one({"id": sc.id}, {"$setOnInsert": sc.model_dump()}, upsert=True)
    logger.info("builtin scenarios ensured: %d", len(items))


@router.get("/scenarios", response_model=list[Scenario])
async def list_scenarios():
    docs = await db.scenarios.find({}, {"_id": 0}).sort("created_at", -1).to_list(2000)
    return [_norm(d) for d in docs]


@router.get("/scenarios/{id}", response_model=Scenario)
async def get_scenario(id: str):
    doc = await db.scenarios.find_one({"id": id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="scenario not found")
    return _norm(doc)


@router.post("/scenarios", response_model=Scenario)
async def create_scenario(body: ScenarioBase):
    sc = Scenario(**body.model_dump())
    await db.scenarios.insert_one(sc.model_dump())
    return sc


@router.put("/scenarios/{id}", response_model=Scenario)
async def update_scenario(id: str, body: ScenarioBase):
    upd = body.model_dump()
    upd["updated_at"] = datetime.now(timezone.utc)
    res = await db.scenarios.find_one_and_update({"id": id}, {"$set": upd}, projection={"_id": 0}, return_document=True)
    if not res:
        raise HTTPException(status_code=404, detail="scenario not found")
    return _norm(res)


@router.post("/scenarios/{id}/favorite", response_model=Scenario)
async def set_favorite(id: str, body: FavoriteUpdate):
    res = await db.scenarios.find_one_and_update(
        {"id": id}, {"$set": {"favorite": body.favorite}}, projection={"_id": 0}, return_document=True
    )
    if not res:
        raise HTTPException(status_code=404, detail="scenario not found")
    return _norm(res)


@router.delete("/scenarios/{id}")
async def delete_scenario(id: str):
    doc = await db.scenarios.find_one({"id": id}, {"_id": 0, "builtin": 1})
    if not doc:
        raise HTTPException(status_code=404, detail="scenario not found")
    if doc.get("builtin"):
        raise HTTPException(status_code=400, detail="built-in scenarios cannot be deleted")
    await db.scenarios.delete_one({"id": id})
    return {"ok": True}

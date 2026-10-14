import re
from datetime import datetime, timezone

from fastapi import APIRouter, File, HTTPException, UploadFile
from fastapi.responses import Response
from motor.motor_asyncio import AsyncIOMotorGridFSBucket

from lib.db import db
from models.settings import SettingsDoc, SettingsUpdate, WeaponModelInfo

router = APIRouter()
SETTINGS_ID = "default"
MAX_GLB = 150 * 1024 * 1024
WEAPON_ID = re.compile(r"^[a-z0-9_-]{2,24}$")


def _bucket() -> AsyncIOMotorGridFSBucket:
    return AsyncIOMotorGridFSBucket(db, bucket_name="weapon_models")


@router.get("/settings", response_model=SettingsDoc)
async def get_settings():
    doc = await db.settings.find_one({"id": SETTINGS_ID}, {"_id": 0})
    if not doc:
        return SettingsDoc(data={})
    ua = doc.get("updated_at")
    if isinstance(ua, datetime) and ua.tzinfo is None:
        ua = ua.replace(tzinfo=timezone.utc)
    return SettingsDoc(data=doc.get("data", {}), updated_at=ua or datetime.now(timezone.utc))


@router.put("/settings", response_model=SettingsDoc)
async def put_settings(body: SettingsUpdate):
    doc = SettingsDoc(data=body.data)
    await db.settings.update_one({"id": SETTINGS_ID}, {"$set": {"id": SETTINGS_ID, **doc.model_dump()}}, upsert=True)
    return doc


# ---- weapon viewmodel GLB uploads (GridFS, one file per weapon id) ----
@router.get("/weapon-models", response_model=list[WeaponModelInfo])
async def list_weapon_models():
    docs = await db.weapon_models_meta.find({}, {"_id": 0}).to_list(100)
    for d in docs:
        if isinstance(d.get("uploaded_at"), datetime) and d["uploaded_at"].tzinfo is None:
            d["uploaded_at"] = d["uploaded_at"].replace(tzinfo=timezone.utc)
    return [WeaponModelInfo(**d) for d in docs]


@router.post("/weapon-models/{weapon_id}", response_model=WeaponModelInfo)
async def upload_weapon_model(weapon_id: str, file: UploadFile = File(...)):
    if not WEAPON_ID.match(weapon_id):
        raise HTTPException(status_code=400, detail="invalid weapon id")
    data = await file.read()
    if len(data) < 20 or data[:4] != b"glTF":
        raise HTTPException(status_code=400, detail="file is not a binary glTF (.glb)")
    if len(data) > MAX_GLB:
        raise HTTPException(status_code=413, detail="file too large")
    bucket = _bucket()
    old = await db.weapon_models_meta.find_one({"weapon_id": weapon_id})
    if old and old.get("file_id") is not None:
        try:
            await bucket.delete(old["file_id"])
        except Exception:
            pass
    file_id = await bucket.upload_from_stream(f"{weapon_id}.glb", data)
    info = WeaponModelInfo(weapon_id=weapon_id, filename=file.filename or f"{weapon_id}.glb", size=len(data),
                           uploaded_at=datetime.now(timezone.utc))
    await db.weapon_models_meta.update_one(
        {"weapon_id": weapon_id}, {"$set": {**info.model_dump(), "file_id": file_id}}, upsert=True
    )
    return info


@router.get("/weapon-models/{weapon_id}/file")
async def get_weapon_model_file(weapon_id: str):
    meta = await db.weapon_models_meta.find_one({"weapon_id": weapon_id})
    if not meta:
        raise HTTPException(status_code=404, detail="no model uploaded")
    stream = await _bucket().open_download_stream(meta["file_id"])
    data = await stream.read()
    return Response(content=data, media_type="model/gltf-binary", headers={"Cache-Control": "no-cache"})


@router.delete("/weapon-models/{weapon_id}")
async def delete_weapon_model(weapon_id: str):
    meta = await db.weapon_models_meta.find_one({"weapon_id": weapon_id})
    if not meta:
        raise HTTPException(status_code=404, detail="no model uploaded")
    try:
        await _bucket().delete(meta["file_id"])
    except Exception:
        pass
    await db.weapon_models_meta.delete_one({"weapon_id": weapon_id})
    return {"ok": True}

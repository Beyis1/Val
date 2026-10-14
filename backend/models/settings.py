from datetime import datetime, timezone
from typing import Any

from pydantic import BaseModel, Field


class SettingsUpdate(BaseModel):
    # free-form client settings blob (sensitivity, crosshair, keybinds, video, audio, ...)
    data: dict[str, Any]


class SettingsDoc(SettingsUpdate):
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class WeaponModelInfo(BaseModel):
    weapon_id: str
    filename: str
    size: int
    uploaded_at: datetime

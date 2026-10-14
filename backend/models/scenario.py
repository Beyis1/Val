import uuid
from datetime import datetime, timezone
from typing import Literal, Optional

from pydantic import BaseModel, Field

ScenarioType = Literal["preaim", "hold", "spike", "gridshot", "flick", "tracking", "strafe"]
Difficulty = Literal["easy", "medium", "hard"]


def _uid() -> str:
    return str(uuid.uuid4())


def _now() -> datetime:
    return datetime.now(timezone.utc)


class BotSpec(BaseModel):
    id: str = Field(default_factory=_uid)
    pos: list[float] = Field(min_length=3, max_length=3)
    yaw: float = 0.0
    stance: Literal["stand", "crouch"] = "stand"
    movement: Literal["static", "strafe", "peek"] = "static"
    move_range: float = Field(default=2.0, ge=0, le=12)
    health: int = Field(default=150, ge=1, le=1000)
    shoots: bool = False


class Prop(BaseModel):
    """Editable map object: axis-aligned box (rotated by yaw), pos = bottom-centre. Rendered and collidable."""
    id: str = Field(default_factory=_uid)
    pos: list[float] = Field(min_length=3, max_length=3)
    size: list[float] = Field(default_factory=lambda: [1.0, 1.0, 1.0], min_length=3, max_length=3)
    yaw: float = 0.0
    color: str = Field(default="#3A4556", pattern=r"^#[0-9A-Fa-f]{6}$")


class ScenarioBase(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    description: str = Field(default="", max_length=600)
    name_en: Optional[str] = None
    description_en: Optional[str] = None
    map_id: str
    type: ScenarioType
    difficulty: Difficulty = "medium"
    duration: int = Field(default=60, ge=5, le=900)
    bots_shoot: bool = False
    spawn: list[float] = Field(default_factory=lambda: [0.0, 0.0, 0.0], min_length=3, max_length=3)
    spawn_yaw: float = 0.0
    site: Optional[list[float]] = None
    bots: list[BotSpec] = Field(default_factory=list, max_length=60)
    allowed_weapons: list[str] = Field(default_factory=list)
    props: list[Prop] = Field(default_factory=list, max_length=300)


class Scenario(ScenarioBase):
    id: str = Field(default_factory=_uid)
    builtin: bool = False
    favorite: bool = False
    play_count: int = 0
    best_score: Optional[int] = None
    created_at: datetime = Field(default_factory=_now)
    updated_at: datetime = Field(default_factory=_now)


class FavoriteUpdate(BaseModel):
    favorite: bool

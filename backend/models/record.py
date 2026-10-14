import uuid
from datetime import datetime, timezone
from typing import Optional

from pydantic import BaseModel, Field


class RecordCreate(BaseModel):
    scenario_id: str
    score: int = Field(ge=0)
    shots: int = Field(default=0, ge=0)
    hits: int = Field(default=0, ge=0)
    headshots: int = Field(default=0, ge=0)
    kills: int = Field(default=0, ge=0)
    accuracy: float = Field(default=0, ge=0, le=100)
    headshot_rate: float = Field(default=0, ge=0, le=100)
    avg_reaction_ms: Optional[float] = Field(default=None, ge=0)
    duration_sec: float = Field(default=0, ge=0)
    died: bool = False
    completed: bool = False
    weapon: str = "vandal"


class Record(RecordCreate):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    scenario_name: str = ""
    map_id: str = ""
    type: str = ""
    new_best: bool = False
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class ScenarioBest(BaseModel):
    scenario_id: str
    scenario_name: str
    map_id: str
    type: str
    best_score: int
    plays: int
    avg_accuracy: float
    last_played: datetime


class RecordsSummary(BaseModel):
    total_rounds: int = 0
    total_kills: int = 0
    total_shots: int = 0
    total_hits: int = 0
    total_headshots: int = 0
    avg_accuracy: float = 0
    avg_headshot_rate: float = 0
    avg_reaction_ms: Optional[float] = None
    total_time_sec: float = 0
    best: list[ScenarioBest] = Field(default_factory=list)

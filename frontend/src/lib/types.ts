// Hand-written mirrors of the backend Pydantic models (backend/models/*.py). Keep in sync.

export type ScenarioType = "preaim" | "hold" | "spike" | "gridshot" | "flick" | "tracking" | "strafe";
export type Difficulty = "easy" | "medium" | "hard";

export interface BotSpec {
  id: string;
  pos: number[];
  yaw: number;
  stance: "stand" | "crouch";
  movement: "static" | "strafe" | "peek";
  move_range: number;
  health: number;
  shoots: boolean;
}

export interface ScenarioBase {
  name: string;
  description: string;
  name_en?: string | null;
  description_en?: string | null;
  map_id: string;
  type: ScenarioType;
  difficulty: Difficulty;
  duration: number;
  bots_shoot: boolean;
  spawn: number[];
  spawn_yaw: number;
  site: number[] | null;
  bots: BotSpec[];
  allowed_weapons: string[];
}

export interface Scenario extends ScenarioBase {
  id: string;
  builtin: boolean;
  favorite: boolean;
  play_count: number;
  best_score: number | null;
  created_at: string;
  updated_at: string;
}

export interface RecordCreate {
  scenario_id: string;
  score: number;
  shots: number;
  hits: number;
  headshots: number;
  kills: number;
  accuracy: number;
  headshot_rate: number;
  avg_reaction_ms: number | null;
  duration_sec: number;
  died: boolean;
  completed: boolean;
  weapon: string;
}

export interface GameRecord extends RecordCreate {
  id: string;
  scenario_name: string;
  map_id: string;
  type: string;
  new_best: boolean;
  created_at: string;
}

export interface ScenarioBest {
  scenario_id: string;
  scenario_name: string;
  map_id: string;
  type: string;
  best_score: number;
  plays: number;
  avg_accuracy: number;
  last_played: string;
}

export interface RecordsSummary {
  total_rounds: number;
  total_kills: number;
  total_shots: number;
  total_hits: number;
  total_headshots: number;
  avg_accuracy: number;
  avg_headshot_rate: number;
  avg_reaction_ms: number | null;
  total_time_sec: number;
  best: ScenarioBest[];
}

export interface SettingsDoc {
  data: Record<string, unknown>;
  updated_at: string;
}

export interface WeaponModelInfo {
  weapon_id: string;
  filename: string;
  size: number;
  uploaded_at: string;
}

// ---- static map assets (frontend/public/maps) ----
export interface MinimapBounds {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

export interface MapIndexEntry {
  id: string;
  name: string;
  thumb: boolean;
  minimap: MinimapBounds | null;
}

export interface MapIndex {
  maps: MapIndexEntry[];
}

export interface MapMeta {
  id: string;
  cell: number;
  minimap: MinimapBounds | null;
  walk: number[][];
  zRange: [number, number];
}

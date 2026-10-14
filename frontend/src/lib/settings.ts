import { useSyncExternalStore } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiGet, apiPut } from "@/lib/api";
import type { SettingsDoc } from "@/lib/types";
import { DEFAULT_CROSSHAIR, type CrosshairSettings } from "@/game/crosshair";
import type { ShieldId } from "@/game/weapons";

export type ActionId =
  | "forward" | "back" | "left" | "right" | "jump" | "crouch" | "walk" | "use" | "reload"
  | "primary" | "secondary" | "melee" | "buy" | "scoreboard" | "fire" | "ads" | "inspect";

export const ACTIONS: ActionId[] = [
  "forward", "back", "left", "right", "jump", "crouch", "walk", "use", "reload",
  "primary", "secondary", "melee", "buy", "scoreboard", "fire", "ads", "inspect",
];

/** Per-weapon first-person tweak: weapon offset (m) / rotation (deg) / scale, left-hand offset (m, camera space), left-hand IK on/off, viewmodel FOV. */
export interface ViewmodelAdjust { rx: number; ry: number; rz: number; scale: number; px: number; py: number; pz: number; lx: number; ly: number; lz: number; ik: number; fov: number }
export const DEFAULT_VM: ViewmodelAdjust = { rx: 0, ry: 0, rz: 0, scale: 1, px: 0, py: 0, pz: 0, lx: 0, ly: 0, lz: 0, ik: 1, fov: 56 };

export interface AppSettings {
  language: "tr" | "en";
  sensitivity: number;
  dpi: number;
  adsMultiplier: number;
  scopeMultiplier: number;
  adsMode: "toggle" | "hold";
  invertY: boolean;
  minimap: { size: number; zoom: number; rotate: boolean; showBots: boolean };
  textScale: number;
  highContrast: boolean;
  keybinds: Record<ActionId, [string, string]>;
  crosshair: CrosshairSettings;
  video: { fov: number; quality: "low" | "medium" | "high"; fpsCap: number; showFps: boolean; displayMode: DisplayMode; resolution: string; autoScale: boolean; renderScale: number; effects: boolean };
  audio: { master: number; sfx: number; fireSound: "classic" | "soft" | "off"; hitSound: "tick" | "dink" | "pop" | "off"; killSound: "chime" | "pulse" | "off"; headshotDink: boolean };
  range: { targetColor: string; targetSize: number; botHealth: number; botSpeed: number; gridTargets: number; trackingSpeed: number; respawnBots: boolean };
  loadout: { primary: string | null; secondary: string; shield: ShieldId };
  viewmodel: Record<string, ViewmodelAdjust>;
  showViewmodel: boolean;
  fpAgent: string;
  skins: Record<string, string>;
  defaultsVersion: number;
}

export type DisplayMode = "fullscreen" | "borderless" | "windowed";

export const DEFAULT_KEYBINDS: Record<ActionId, [string, string]> = {
  forward: ["KeyW", ""], back: ["KeyS", ""], left: ["KeyA", ""], right: ["KeyD", ""],
  jump: ["Space", "WheelDown"], crouch: ["ControlLeft", "KeyC"], walk: ["ShiftLeft", ""], use: ["KeyF", ""],
  reload: ["KeyR", ""], primary: ["Digit1", ""], secondary: ["Digit2", ""], melee: ["Digit3", ""],
  buy: ["KeyB", ""], scoreboard: ["Tab", ""], fire: ["Mouse0", ""], ads: ["Mouse2", ""], inspect: ["KeyY", ""],
};

export const DEFAULT_LOADOUT = { primary: "vandal" as string | null, secondary: "classic", shield: "heavy" as ShieldId };

export const DEFAULT_SETTINGS: AppSettings = {
  language: "tr",
  sensitivity: 0.1,
  dpi: 1600,
  adsMultiplier: 1,
  scopeMultiplier: 1,
  adsMode: "toggle",
  invertY: false,
  minimap: { size: 220, zoom: 1, rotate: true, showBots: true },
  textScale: 1,
  highContrast: false,
  keybinds: DEFAULT_KEYBINDS,
  crosshair: DEFAULT_CROSSHAIR,
  video: { fov: 103, quality: "high", fpsCap: 0, showFps: true, displayMode: "fullscreen", resolution: "native", autoScale: true, renderScale: 1, effects: true },
  audio: { master: 0.7, sfx: 0.8, fireSound: "classic", hitSound: "tick", killSound: "chime", headshotDink: true },
  range: { targetColor: "#FF4655", targetSize: 1, botHealth: 150, botSpeed: 3.6, gridTargets: 3, trackingSpeed: 1, respawnBots: false },
  loadout: DEFAULT_LOADOUT,
  viewmodel: {},
  showViewmodel: true,
  fpAgent: "jett",
  skins: {},
  defaultsVersion: 3,
};

/** One-time moves of older saved profiles: v2 = sens 0.1 @ 1600 DPI + dot crosshair, v3 = viewmodel visible. */
function migrate(raw: unknown, merged: AppSettings): AppSettings {
  const v = isObj(raw) && typeof raw.defaultsVersion === "number" ? raw.defaultsVersion : 1;
  if (v < 2) {
    merged.sensitivity = DEFAULT_SETTINGS.sensitivity; merged.dpi = DEFAULT_SETTINGS.dpi;
    merged.crosshair = structuredClone(DEFAULT_CROSSHAIR);
  }
  // v3: saved profiles had the first-person viewmodel switched off (arms + weapon invisible) — turn it back on once
  if (v < 3) { merged.showViewmodel = true; merged.defaultsVersion = 3; }
  return merged;
}

const LS_KEY = "valaim.settings.v1";

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

function deepMerge<T>(base: T, over: unknown): T {
  if (!isObj(base) || !isObj(over)) return (over === undefined ? base : (over as T));
  const out: Record<string, unknown> = { ...(base as Record<string, unknown>) };
  for (const [k, v] of Object.entries(over)) {
    const b = (base as Record<string, unknown>)[k];
    if ((k === "viewmodel" || k === "skins") && isObj(v)) out[k] = v;
    else if (isObj(b) && isObj(v)) out[k] = deepMerge(b, v);
    else if (v !== undefined && (b === undefined || typeof b === typeof v || b === null || v === null)) out[k] = v;
  }
  return out as T;
}

function loadLocal(): AppSettings {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) { const parsed: unknown = JSON.parse(raw); return migrate(parsed, deepMerge(structuredClone(DEFAULT_SETTINGS), parsed)); }
  } catch {
    /* ignore */
  }
  return structuredClone(DEFAULT_SETTINGS);
}

let state: AppSettings = loadLocal();
const listeners = new Set<() => void>();
let saveTimer: ReturnType<typeof setTimeout> | null = null;
let hydrated = false;

export type SaveStatus = "idle" | "saving" | "saved" | "error";
let saveStatus: SaveStatus = "idle";
const statusListeners = new Set<() => void>();
const setStatus = (s: SaveStatus) => { saveStatus = s; statusListeners.forEach((l) => l()); };

function emit() {
  listeners.forEach((l) => l());
}

export function getSettings(): AppSettings {
  return state;
}

export function subscribeSettings(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

function scheduleSave() {
  try { localStorage.setItem(LS_KEY, JSON.stringify(state)); } catch { /* ignore */ }
  if (saveTimer) clearTimeout(saveTimer);
  setStatus("saving");
  saveTimer = setTimeout(() => {
    apiPut<SettingsDoc>("/settings", { data: state })
      .then(() => setStatus("saved"))
      .catch(() => setStatus("error"));
  }, 600);
}

/** Immutable update: mutate the draft, it gets stored, broadcast and auto-saved. */
export function updateSettings(mutator: (draft: AppSettings) => void) {
  const draft = structuredClone(state);
  mutator(draft);
  state = draft;
  emit();
  scheduleSave();
}

export function resetSettings(part?: keyof AppSettings) {
  updateSettings((d) => {
    if (!part) Object.assign(d, structuredClone(DEFAULT_SETTINGS));
    else (d as unknown as Record<string, unknown>)[part] = structuredClone(DEFAULT_SETTINGS[part]);
  });
}

export function useSettings(): AppSettings {
  return useSyncExternalStore(subscribeSettings, getSettings);
}

export function useSaveStatus(): SaveStatus {
  return useSyncExternalStore((l) => { statusListeners.add(l); return () => statusListeners.delete(l); }, () => saveStatus);
}

/** Pulls the server copy once per page load and merges it over defaults. */
export function useSettingsBootstrap() {
  const q = useQuery({ queryKey: ["settings"], queryFn: () => apiGet<SettingsDoc>("/settings"), staleTime: Infinity, retry: 1 });
  if (q.data && !hydrated) {
    hydrated = true;
    if (Object.keys(q.data.data).length > 0) {
      state = migrate(q.data.data, deepMerge(structuredClone(DEFAULT_SETTINGS), q.data.data));
      try { localStorage.setItem(LS_KEY, JSON.stringify(state)); } catch { /* ignore */ }
      queueMicrotask(emit);
    }
  }
  return q;
}

// ---- helpers ----
export const cmPer360 = (sens: number, dpi: number) => (360 / (0.07 * sens) / dpi) * 2.54;

export function keyLabel(code: string): string {
  if (!code) return "—";
  if (code.startsWith("Key")) return code.slice(3);
  if (code.startsWith("Digit")) return code.slice(5);
  const map: Record<string, string> = {
    Mouse0: "LMB", Mouse1: "MMB", Mouse2: "RMB", Mouse3: "M4", Mouse4: "M5", WheelUp: "Wheel ▲", WheelDown: "Wheel ▼",
    Space: "Space", ShiftLeft: "L-Shift", ShiftRight: "R-Shift", ControlLeft: "L-Ctrl", ControlRight: "R-Ctrl",
    AltLeft: "L-Alt", Tab: "Tab", CapsLock: "Caps", Escape: "Esc", Backquote: "`",
  };
  return map[code] ?? code;
}

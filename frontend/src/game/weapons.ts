// Valorant-like weapon data (approximate public values). Distances in metres, spread in degrees.
export type WeaponCategory = "sidearm" | "smg" | "shotgun" | "rifle" | "sniper" | "heavy" | "melee";

export interface DamageBand {
  max: number;
  head: number;
  body: number;
  leg: number;
}

export interface WeaponDef {
  id: string;
  name: string;
  category: WeaponCategory;
  price: number;
  fireRate: number; // rounds / sec
  mag: number;
  reload: number; // seconds
  runSpeed: number; // m/s
  equip: number; // seconds
  auto: boolean;
  pellets?: number;
  zoom?: number[]; // ADS / scope zoom levels
  scoped?: boolean;
  damage: DamageBand[];
  spread: { stand: number; move: number; air: number; ads: number };
  recoil: { up: number; side: number; max: number };
  pen: "low" | "medium" | "high";
}

const D = (max: number, head: number, body: number, leg: number): DamageBand => ({ max, head, body, leg });

export const WEAPONS: WeaponDef[] = [
  // Sidearms
  { id: "classic", name: "Classic", category: "sidearm", price: 0, fireRate: 6.75, mag: 12, reload: 1.75, runSpeed: 5.73, equip: 0.75, auto: false,
    damage: [D(30, 78, 26, 22), D(50, 66, 22, 18)], spread: { stand: 0.4, move: 1.6, air: 4, ads: 0.4 }, recoil: { up: 0.35, side: 0.15, max: 3 }, pen: "low" },
  { id: "shorty", name: "Shorty", category: "sidearm", price: 300, fireRate: 3.33, mag: 2, reload: 1.75, runSpeed: 5.4, equip: 0.75, auto: false, pellets: 15,
    damage: [D(9, 36, 12, 10), D(15, 24, 8, 6), D(50, 9, 3, 2)], spread: { stand: 4, move: 4, air: 5, ads: 4 }, recoil: { up: 1.2, side: 0.3, max: 3 }, pen: "low" },
  { id: "frenzy", name: "Frenzy", category: "sidearm", price: 450, fireRate: 10, mag: 13, reload: 1.5, runSpeed: 5.73, equip: 1, auto: true,
    damage: [D(20, 78, 26, 22), D(50, 63, 21, 17)], spread: { stand: 0.65, move: 1.8, air: 4, ads: 0.65 }, recoil: { up: 0.45, side: 0.25, max: 5 }, pen: "low" },
  { id: "ghost", name: "Ghost", category: "sidearm", price: 500, fireRate: 6.75, mag: 15, reload: 1.5, runSpeed: 5.73, equip: 0.75, auto: false,
    damage: [D(30, 105, 30, 25), D(50, 87, 25, 21)], spread: { stand: 0.3, move: 1.5, air: 4, ads: 0.3 }, recoil: { up: 0.4, side: 0.15, max: 3 }, pen: "medium" },
  { id: "sheriff", name: "Sheriff", category: "sidearm", price: 800, fireRate: 4, mag: 6, reload: 2.25, runSpeed: 5.4, equip: 1, auto: false,
    damage: [D(30, 159, 55, 46), D(50, 145, 50, 42)], spread: { stand: 0.25, move: 2.2, air: 5, ads: 0.25 }, recoil: { up: 1.1, side: 0.3, max: 5 }, pen: "high" },
  // SMGs
  { id: "stinger", name: "Stinger", category: "smg", price: 1100, fireRate: 16, mag: 20, reload: 2.25, runSpeed: 5.73, equip: 0.75, auto: true, zoom: [1.15],
    damage: [D(15, 67, 27, 22), D(50, 62, 25, 21)], spread: { stand: 0.65, move: 1.4, air: 4, ads: 0.35 }, recoil: { up: 0.32, side: 0.3, max: 6 }, pen: "low" },
  { id: "spectre", name: "Spectre", category: "smg", price: 1600, fireRate: 13.33, mag: 30, reload: 2.25, runSpeed: 5.73, equip: 0.75, auto: true, zoom: [1.15],
    damage: [D(20, 78, 26, 22), D(50, 66, 22, 18)], spread: { stand: 0.4, move: 1.3, air: 4, ads: 0.25 }, recoil: { up: 0.26, side: 0.22, max: 5 }, pen: "medium" },
  // Shotguns
  { id: "bucky", name: "Bucky", category: "shotgun", price: 850, fireRate: 1.1, mag: 5, reload: 2.5, runSpeed: 5.06, equip: 1, auto: false, pellets: 15,
    damage: [D(8, 44, 22, 19), D(12, 34, 17, 14), D(50, 18, 9, 8)], spread: { stand: 2.6, move: 2.6, air: 4, ads: 2.6 }, recoil: { up: 2, side: 0.4, max: 4 }, pen: "low" },
  { id: "judge", name: "Judge", category: "shotgun", price: 1850, fireRate: 3.5, mag: 7, reload: 2.2, runSpeed: 5.06, equip: 1, auto: true, pellets: 12,
    damage: [D(10, 34, 17, 14), D(15, 26, 13, 11), D(50, 20, 10, 9)], spread: { stand: 2.25, move: 2.25, air: 4, ads: 2.25 }, recoil: { up: 1.4, side: 0.4, max: 6 }, pen: "medium" },
  // Rifles
  { id: "bulldog", name: "Bulldog", category: "rifle", price: 2050, fireRate: 9.15, mag: 24, reload: 2.5, runSpeed: 5.4, equip: 1, auto: true, zoom: [1.25],
    damage: [D(50, 116, 35, 29)], spread: { stand: 0.3, move: 2.4, air: 5, ads: 0.15 }, recoil: { up: 0.42, side: 0.25, max: 6 }, pen: "medium" },
  { id: "guardian", name: "Guardian", category: "rifle", price: 2250, fireRate: 5.25, mag: 12, reload: 2.5, runSpeed: 5.4, equip: 1, auto: false, zoom: [1.5],
    damage: [D(50, 195, 65, 49)], spread: { stand: 0.1, move: 2.6, air: 5, ads: 0.05 }, recoil: { up: 0.75, side: 0.12, max: 4 }, pen: "high" },
  { id: "phantom", name: "Phantom", category: "rifle", price: 2900, fireRate: 11, mag: 30, reload: 2.5, runSpeed: 5.4, equip: 1, auto: true, zoom: [1.25],
    damage: [D(15, 156, 39, 33), D(30, 140, 35, 29), D(50, 124, 31, 26)], spread: { stand: 0.2, move: 2.4, air: 5, ads: 0.11 }, recoil: { up: 0.4, side: 0.3, max: 7 }, pen: "medium" },
  { id: "vandal", name: "Vandal", category: "rifle", price: 2900, fireRate: 9.75, mag: 25, reload: 2.5, runSpeed: 5.4, equip: 1, auto: true, zoom: [1.25],
    damage: [D(50, 160, 40, 34)], spread: { stand: 0.25, move: 2.4, air: 5, ads: 0.157 }, recoil: { up: 0.46, side: 0.32, max: 7.5 }, pen: "medium" },
  // Snipers
  { id: "marshal", name: "Marshal", category: "sniper", price: 950, fireRate: 1.5, mag: 5, reload: 2.5, runSpeed: 5.4, equip: 1.25, auto: false, zoom: [3.5], scoped: true,
    damage: [D(50, 202, 101, 85)], spread: { stand: 1, move: 4, air: 6, ads: 0 }, recoil: { up: 1.5, side: 0.2, max: 3 }, pen: "medium" },
  { id: "outlaw", name: "Outlaw", category: "sniper", price: 2400, fireRate: 2.75, mag: 2, reload: 2.85, runSpeed: 5.4, equip: 1.25, auto: false, zoom: [3.5], scoped: true,
    damage: [D(50, 238, 140, 119)], spread: { stand: 1.2, move: 5, air: 7, ads: 0 }, recoil: { up: 1.8, side: 0.2, max: 3 }, pen: "high" },
  { id: "operator", name: "Operator", category: "sniper", price: 4700, fireRate: 0.6, mag: 5, reload: 3.7, runSpeed: 5.13, equip: 1.5, auto: false, zoom: [2.5, 5], scoped: true,
    damage: [D(50, 255, 150, 127)], spread: { stand: 2, move: 6, air: 8, ads: 0 }, recoil: { up: 2.4, side: 0.2, max: 3 }, pen: "high" },
  // Heavy
  { id: "ares", name: "Ares", category: "heavy", price: 1600, fireRate: 13, mag: 50, reload: 3.25, runSpeed: 5.13, equip: 1.25, auto: true, zoom: [1.25],
    damage: [D(30, 72, 30, 25), D(50, 67, 28, 23)], spread: { stand: 1, move: 2.6, air: 5, ads: 0.6 }, recoil: { up: 0.22, side: 0.3, max: 5 }, pen: "high" },
  { id: "odin", name: "Odin", category: "heavy", price: 3200, fireRate: 15.6, mag: 100, reload: 5, runSpeed: 5.13, equip: 1.25, auto: true, zoom: [1.15],
    damage: [D(30, 95, 38, 32), D(50, 77, 31, 26)], spread: { stand: 0.8, move: 2.6, air: 5, ads: 0.5 }, recoil: { up: 0.24, side: 0.34, max: 6 }, pen: "high" },
];

export const KNIFE: WeaponDef = {
  id: "knife", name: "Tactical Knife", category: "melee", price: 0, fireRate: 2.2, mag: 0, reload: 0, runSpeed: 6.75, equip: 0.5, auto: true,
  damage: [D(2.4, 50, 50, 50)], spread: { stand: 0, move: 0, air: 0, ads: 0 }, recoil: { up: 0, side: 0, max: 0 }, pen: "low",
};

export const WEAPON_BY_ID: Record<string, WeaponDef> = Object.fromEntries([...WEAPONS, KNIFE].map((w) => [w.id, w]));

export const BUY_COLUMNS: { key: WeaponCategory | "shields"; ids: string[] }[] = [
  { key: "sidearm", ids: ["classic", "shorty", "frenzy", "ghost", "sheriff"] },
  { key: "smg", ids: ["stinger", "spectre"] },
  { key: "shotgun", ids: ["bucky", "judge"] },
  { key: "rifle", ids: ["bulldog", "guardian", "phantom", "vandal"] },
  { key: "sniper", ids: ["marshal", "outlaw", "operator"] },
  { key: "heavy", ids: ["ares", "odin"] },
];

export type ShieldId = "none" | "light" | "regen" | "heavy";
export interface ShieldDef {
  id: ShieldId;
  armor: number;
  price: number;
  regenPool: number;
}
export const SHIELDS: ShieldDef[] = [
  { id: "light", armor: 25, price: 400, regenPool: 0 },
  { id: "regen", armor: 25, price: 650, regenPool: 50 },
  { id: "heavy", armor: 50, price: 1000, regenPool: 0 },
];
export const SHIELD_BY_ID: Record<ShieldId, ShieldDef> = {
  none: { id: "none", armor: 0, price: 0, regenPool: 0 },
  light: SHIELDS[0],
  regen: SHIELDS[1],
  heavy: SHIELDS[2],
};

/** Weapons the user is expected to upload their own GLB viewmodels for. */
export const GLB_SLOTS = ["vandal", "phantom", "sheriff", "guardian", "operator"];

export const isSidearm = (id: string) => WEAPON_BY_ID[id]?.category === "sidearm";

export function damageAt(w: WeaponDef, dist: number): DamageBand {
  return w.damage.find((b) => dist <= b.max) ?? w.damage[w.damage.length - 1];
}

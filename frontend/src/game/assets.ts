import * as THREE from "three";
import { GLTFLoader, type GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";

/** tier: bp = Battle Pass reward, upgrade = premium skin with upgrade levels (from valorant-api.com data). levels = original in-game level names. */
export interface SkinEntry { id: string; name: string; thumb: string; tier?: "bp" | "upgrade"; levels?: string[] }
export interface KAManifest { weapons: Record<string, SkinEntry[]>; agents: string[]; fp: string[]; spike: boolean }

const loader = new GLTFLoader();
loader.setMeshoptDecoder(MeshoptDecoder);
const cache = new Map<string, Promise<GLTF>>();

export function loadGLTF(url: string, onProgress?: (p: number) => void): Promise<GLTF> {
  const hit = cache.get(url);
  if (hit) { onProgress?.(1); return hit; }
  const p = new Promise<GLTF>((res, rej) =>
    loader.load(url, res, (e) => { if (e.total) onProgress?.(e.loaded / e.total); }, rej));
  cache.set(url, p);
  p.catch(() => cache.delete(url));
  return p;
}

let manifestP: Promise<KAManifest> | null = null;
export function getManifest(): Promise<KAManifest> {
  if (!manifestP) {
    manifestP = fetch("/ka/manifest.json").then((r) => (r.ok ? r.json() : { weapons: {}, agents: [], fp: [], spike: false }))
      .catch(() => ({ weapons: {}, agents: [], fp: [], spike: false }));
  }
  return manifestP;
}

export const weaponModelUrl = (weaponId: string, skin: string) => `/ka/weapons/${weaponId === "knife" ? "melee" : weaponId}/${skin || "default"}.glb`;
export const agentUrl = (a: string) => `/ka/agents/${a}.glb`;
export const fpUrl = (a: string) => `/ka/fp/${a}.glb`;

export const AGENT_NAMES: Record<string, string> = {
  astra: "Astra", breach: "Breach", brimstone: "Brimstone", chamber: "Chamber", clove: "Clove", cypher: "Cypher", deadlock: "Deadlock",
  fade: "Fade", gekko: "Gekko", harbor: "Harbor", iso: "Iso", jett: "Jett", kayo: "KAY/O", killjoy: "Killjoy", miks: "Miks", neon: "Neon",
  omen: "Omen", phoenix: "Phoenix", raze: "Raze", reyna: "Reyna", sage: "Sage", skye: "Skye", sova: "Sova", tejo: "Tejo", veto: "Veto",
  viper: "Viper", vyse: "Vyse", waylay: "Waylay", yoru: "Yoru",
};

/** Bounding box of renderable meshes only (ignores bones / empties). */
export function meshBounds(root: THREE.Object3D): THREE.Box3 {
  root.updateMatrixWorld(true);
  const box = new THREE.Box3();
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh && m.geometry) {
      m.geometry.computeBoundingBox();
      const b = m.geometry.boundingBox!.clone().applyMatrix4(m.matrixWorld);
      box.union(b);
    }
  });
  return box;
}

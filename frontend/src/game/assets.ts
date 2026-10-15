import * as THREE from "three";
import { GLTFLoader, type GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";

/** tier: bp = Battle Pass reward, upgrade = premium skin with upgrade levels (from valorant-api.com data). levels = original in-game level names. */
export interface SkinEntry { id: string; name: string; thumb: string; tier?: "bp" | "upgrade"; levels?: string[] }
export interface KAManifest { weapons: Record<string, SkinEntry[]>; agents: string[]; fp: string[]; spike: boolean }

const loader = new GLTFLoader();
loader.setMeshoptDecoder(MeshoptDecoder);
const cache = new Map<string, Promise<GLTF>>();
const archiveFallbacks: Record<string, string> = {
  "/ka/fp/jett.glb": "https://kingdomarchives.com/uploads/models/agents_fp/jett_fp/jett_fp.glb",
  "/ka/weapons/vandal/default.glb": "https://kingdomarchives.com/uploads/models/weapons/vandal/standard/vandal.glb",
};

function reportProgress(callback: ((p: number) => void) | undefined, value: number) {
  try { callback?.(value); } catch (error) { console.warn("Model progress callback failed:", error); }
}

export function loadGLTF(url: string, onProgress?: (p: number) => void): Promise<GLTF> {
  const hit = cache.get(url);
  if (hit) {
    if (onProgress) void hit.then(() => reportProgress(onProgress, 1), () => undefined);
    return hit;
  }
  const attempt = (source: string): Promise<GLTF> => new Promise((resolve, reject) => {
    loader.load(source, resolve, (event) => {
      if (event.total) reportProgress(onProgress, Math.min(0.99, event.loaded / event.total));
    }, reject);
  });
  reportProgress(onProgress, 0);
  const p = attempt(url).catch((primaryError: unknown) => {
    const fallback = archiveFallbacks[url];
    if (!fallback) throw primaryError;
    console.warn("Local model failed; trying Kingdom Archives:", url, primaryError);
    reportProgress(onProgress, 0);
    return attempt(fallback).catch((fallbackError: unknown) => {
      console.error("Archive model also failed:", fallback, fallbackError);
      throw new Error(`Model could not be loaded from either ${url} or ${fallback}. Check network/CORS and GLB compatibility.`);
    });
  }).then((gltf) => {
    reportProgress(onProgress, 1);
    return gltf;
  });
  cache.set(url, p);
  void p.catch(() => { if (cache.get(url) === p) cache.delete(url); });
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

import * as THREE from "three";
import { STLLoader } from "three/examples/jsm/loaders/STLLoader.js";

/**
 * User-supplied training bot mesh (public/models/trainingbot.stl — binary STL, Z-up, no UVs / materials).
 * Converted once at runtime: Y-up, feet on y=0, scaled to Valorant agent height, box-projected UVs and a
 * procedural range-bot panel texture (light shell, dark seams, darker legs) since the file carries no textures.
 */
export const BOT_HEIGHT = 1.85;
let tplP: Promise<THREE.BufferGeometry | null> | null = null;
let tex: THREE.CanvasTexture | null = null;

function panelTexture(): THREE.CanvasTexture {
  if (tex) return tex;
  const S = 512; const c = document.createElement("canvas"); c.width = c.height = S; const g = c.getContext("2d")!;
  g.fillStyle = "#d4d8de"; g.fillRect(0, 0, S, S);
  // fine grain so the shell doesn't read as flat plastic
  const img = g.getImageData(0, 0, S, S);
  for (let i = 0; i < img.data.length; i += 4) { const n = (Math.random() - 0.5) * 14; img.data[i] += n; img.data[i + 1] += n; img.data[i + 2] += n; }
  g.putImageData(img, 0, 0);
  g.strokeStyle = "rgba(40,46,56,0.55)"; g.lineWidth = 3;
  for (let i = 0; i <= S; i += 128) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i, S); g.moveTo(0, i); g.lineTo(S, i); g.stroke(); }
  g.strokeStyle = "rgba(40,46,56,0.25)"; g.lineWidth = 1.5;
  for (let i = 64; i < S; i += 128) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i, S); g.stroke(); }
  g.fillStyle = "rgba(255,70,85,0.9)"; for (let i = 0; i < 4; i++) g.fillRect(20 + i * 128, 20, 18, 6); // small red range markers
  tex = new THREE.CanvasTexture(c); tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  return tex;
}

/** Split along the axis the two figures are lined up on (largest gap in triangle centroids) and keep one. */
function keepOneFigure(geo: THREE.BufferGeometry): THREE.BufferGeometry {
  const pos = geo.getAttribute("position") as THREE.BufferAttribute, nrm = geo.getAttribute("normal") as THREE.BufferAttribute;
  const tris = pos.count / 3; let best = { axis: 0, cut: 0, gap: 0 };
  for (const axis of [0, 2]) {
    const cs: number[] = [];
    for (let t = 0; t < tris; t++) cs.push((pos.getComponent(t * 3, axis) + pos.getComponent(t * 3 + 1, axis) + pos.getComponent(t * 3 + 2, axis)) / 3);
    cs.sort((a, b) => a - b);
    for (let i = Math.floor(tris * 0.2); i < tris * 0.8; i++) { const g = cs[i + 1] - cs[i]; if (g > best.gap) best = { axis, cut: (cs[i] + cs[i + 1]) / 2, gap: g }; }
  }
  if (best.gap < 0.05) return geo;
  const P: number[] = [], N: number[] = [];
  for (let t = 0; t < tris; t++) {
    const c = (pos.getComponent(t * 3, best.axis) + pos.getComponent(t * 3 + 1, best.axis) + pos.getComponent(t * 3 + 2, best.axis)) / 3;
    if (c > best.cut) continue;
    for (let k = 0; k < 3; k++) { const i = t * 3 + k; P.push(pos.getX(i), pos.getY(i), pos.getZ(i)); N.push(nrm.getX(i), nrm.getY(i), nrm.getZ(i)); }
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute("position", new THREE.Float32BufferAttribute(P, 3)); out.setAttribute("normal", new THREE.Float32BufferAttribute(N, 3));
  return out;
}

export function loadBotTemplate(): Promise<THREE.BufferGeometry | null> {
  if (tplP) return tplP;
  tplP = new Promise<THREE.BufferGeometry | null>((res) => {
    new STLLoader().load("/models/trainingbot.stl", (loaded) => {
      let geo = loaded;
      geo.rotateX(-Math.PI / 2); // Z-up (Blender) -> Y-up
      geo = keepOneFigure(geo); // the file holds two bots side by side — use a single one
      geo.computeBoundingBox(); const b = geo.boundingBox!;
      const pos = geo.getAttribute("position") as THREE.BufferAttribute;
      // centre on the feet (lowest 25 cm), so the capsule / hitboxes stand where the model stands
      let fx = 0, fz = 0, fn = 0;
      for (let i = 0; i < pos.count; i++) if (pos.getY(i) < b.min.y + 0.25) { fx += pos.getX(i); fz += pos.getZ(i); fn++; }
      geo.translate(-(fn ? fx / fn : 0), -b.min.y, -(fn ? fz / fn : 0));
      const s = BOT_HEIGHT / (b.max.y - b.min.y); geo.scale(s, s, s);
      // box-projected UVs + height-zone vertex colours
      const nrm = geo.getAttribute("normal") as THREE.BufferAttribute;
      const uv = new Float32Array(pos.count * 2); const col = new Float32Array(pos.count * 3);
      for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
        const ax = Math.abs(nrm.getX(i)), ay = Math.abs(nrm.getY(i)), az = Math.abs(nrm.getZ(i));
        const [u, v] = ax >= ay && ax >= az ? [z, y] : ay >= az ? [x, z] : [x, y];
        uv[i * 2] = u * 1.6; uv[i * 2 + 1] = v * 1.6;
        // robot paint: gunmetal shell, darker legs, glowing red visor on the face (model faces -X)
        let r = 0.55, g = 0.6, bl = 0.66;
        if (y < 0.9) { r = 0.36; g = 0.39; bl = 0.44; }
        if (y > 1.6 && nrm.getX(i) < -0.55 && y < 1.76) { r = 1.6; g = 0.25; bl = 0.3; }
        col[i * 3] = r; col[i * 3 + 1] = g; col[i * 3 + 2] = bl;
      }
      geo.setAttribute("uv", new THREE.BufferAttribute(uv, 2)); geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
      geo.computeBoundingSphere();
      res(geo);
    }, undefined, () => res(null));
  });
  return tplP;
}

export function botMaterial(): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ map: panelTexture(), vertexColors: true, roughness: 0.38, metalness: 0.55, emissive: 0x000000 });
}

export interface ZoneBox { zone: "head" | "body" | "leg"; size: [number, number, number]; center: [number, number, number] }
const zoneCache = new Map<number, ZoneBox[]>();
/** Hitboxes fitted to the model itself (per height band, after the facing rotation) so visuals == hit area. */
export function zoneBoxes(geo: THREE.BufferGeometry, facing: number): ZoneBox[] {
  const hit = zoneCache.get(facing); if (hit) return hit;
  const pos = geo.getAttribute("position") as THREE.BufferAttribute; const c = Math.cos(facing), s = Math.sin(facing);
  const bands: [ZoneBox["zone"], number, number][] = [["head", 1.6, 9], ["body", 0.92, 1.6], ["leg", -1, 0.92]];
  // width caps: shoulder pads poke into the head band, hanging hands into the leg band (arms count as body)
  const cap: Record<ZoneBox["zone"], [number, number]> = { head: [0.27, 0.27], body: [0.9, 0.4], leg: [0.42, 0.32] };
  const out = bands.map(([zone, lo, hi]) => {
    const b = new THREE.Box3(); const v = new THREE.Vector3();
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i); if (y < lo || y >= hi) continue;
      const x = pos.getX(i), z = pos.getZ(i); v.set(x * c + z * s, y, -x * s + z * c); b.expandByPoint(v);
    }
    const sz = b.getSize(new THREE.Vector3()), ct = b.getCenter(new THREE.Vector3());
    if (zone === "head") { b.min.y = Math.max(b.min.y, 1.6); b.getSize(sz); b.getCenter(ct); }
    const [cx, cz] = cap[zone];
    return { zone, size: [Math.min(cx, Math.max(0.12, sz.x)), Math.max(0.12, sz.y), Math.min(cz, Math.max(0.12, sz.z))], center: [zone === "body" ? ct.x : 0, ct.y, 0] } as ZoneBox;
  });
  zoneCache.set(facing, out); return out;
}

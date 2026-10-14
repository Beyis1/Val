import { useEffect, useRef } from "react";
import * as THREE from "three";
import * as SkeletonUtils from "three/examples/jsm/utils/SkeletonUtils.js";
import { loadGLTF, weaponModelUrl, meshBounds } from "@/game/assets";
import { fixMaterials } from "@/game/viewmodel";

/** Large rotating 3D weapon preview (selected skin). One small renderer, created while the menu is open only. */
export function WeaponPreview({ weaponId, skin, className = "" }: { weaponId: string; skin: string; className?: string }) {
  const host = useRef<HTMLDivElement>(null);
  const state = useRef<{ r: THREE.WebGLRenderer; scene: THREE.Scene; cam: THREE.PerspectiveCamera; pivot: THREE.Group; raf: number; drag: number | null; yaw: number; vel: number } | null>(null);

  useEffect(() => {
    const el = host.current!; const r = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
    r.setPixelRatio(Math.min(2, window.devicePixelRatio)); r.outputColorSpace = THREE.SRGBColorSpace; r.toneMapping = THREE.ACESFilmicToneMapping; r.toneMappingExposure = 1.1;
    el.appendChild(r.domElement); r.domElement.style.width = "100%"; r.domElement.style.height = "100%";
    const scene = new THREE.Scene(); const cam = new THREE.PerspectiveCamera(28, 1, 0.01, 50);
    scene.add(new THREE.HemisphereLight(0xdfe8ff, 0x1a1f28, 1.4));
    const key = new THREE.DirectionalLight(0xffffff, 2.4); key.position.set(2, 3, 4); scene.add(key);
    const rim = new THREE.DirectionalLight(0xff4655, 1.2); rim.position.set(-3, 1, -3); scene.add(rim);
    const pivot = new THREE.Group(); scene.add(pivot);
    const s = { r, scene, cam, pivot, raf: 0, drag: null as number | null, yaw: 0.6, vel: 0 }; state.current = s;
    const size = () => { const w = el.clientWidth || 300, h = el.clientHeight || 170; r.setSize(w, h, false); cam.aspect = w / h; cam.updateProjectionMatrix(); };
    size(); const ro = new ResizeObserver(size); ro.observe(el);
    let last = performance.now();
    const loop = (t: number) => {
      const dt = Math.min(0.05, (t - last) / 1000); last = t;
      if (s.drag === null) { s.vel *= Math.exp(-dt * 3); s.yaw += (0.35 + s.vel) * dt; }
      pivot.rotation.y = s.yaw; r.render(scene, cam); s.raf = requestAnimationFrame(loop);
    };
    s.raf = requestAnimationFrame(loop);
    const down = (e: PointerEvent) => { s.drag = e.clientX; el.setPointerCapture(e.pointerId); };
    const move = (e: PointerEvent) => { if (s.drag === null) return; const dx = e.clientX - s.drag; s.drag = e.clientX; s.yaw += dx * 0.01; s.vel = dx * 0.05; };
    const up = () => { s.drag = null; };
    el.addEventListener("pointerdown", down); el.addEventListener("pointermove", move); el.addEventListener("pointerup", up);
    return () => {
      cancelAnimationFrame(s.raf); ro.disconnect(); el.removeEventListener("pointerdown", down); el.removeEventListener("pointermove", move); el.removeEventListener("pointerup", up);
      r.dispose(); r.domElement.remove(); state.current = null;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    void loadGLTF(weaponModelUrl(weaponId, skin)).catch(() => loadGLTF(weaponModelUrl(weaponId, "default"))).then((g) => {
      const s = state.current; if (cancelled || !s) return;
      const m = SkeletonUtils.clone(g.scene); fixMaterials(m);
      // skinned archive meshes report quantised bounds, so size the shot from the barrel (root -> Muzzle socket)
      m.updateMatrixWorld(true);
      const mz = m.getObjectByName("Muzzle"); let c: THREE.Vector3; let r: number;
      if (mz) { const tip = mz.getWorldPosition(new THREE.Vector3()); c = tip.clone().multiplyScalar(0.42); r = Math.max(0.12, tip.length() * 0.62); }
      else { const b = meshBounds(m); c = b.getCenter(new THREE.Vector3()); const sz = b.getSize(new THREE.Vector3()); r = Math.min(0.5, Math.max(sz.x, sz.y, sz.z) * 0.5); }
      m.position.sub(c); s.pivot.clear(); s.pivot.add(m);
      s.cam.position.set(0, r * 0.35, r / Math.tan((s.cam.fov * Math.PI) / 360) * 1.05); s.cam.lookAt(0, 0, 0);
    }).catch(() => undefined);
    return () => { cancelled = true; };
  }, [weaponId, skin]);

  return <div ref={host} className={`cursor-grab active:cursor-grabbing ${className}`} data-testid="weapon-preview-3d" />;
}

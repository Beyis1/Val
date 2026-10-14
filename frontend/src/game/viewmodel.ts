import * as THREE from "three";
import * as SkeletonUtils from "three/examples/jsm/utils/SkeletonUtils.js";
import { loadGLTF, fpUrl, weaponModelUrl } from "@/game/assets";

interface RigSkin { constraints: { bone: string; src: string; rot: number[]; off: number[] }[]; exclusive: string[] }
interface RigInfo { anims: { fp?: Record<string, string>; gn?: Record<string, string> }; skins: Record<string, RigSkin> }
let rigP: Promise<Record<string, RigInfo>> | null = null;
const rigJson = (): Promise<Record<string, RigInfo>> => (rigP ??= fetch("/ka/rig.json").then((r) => (r.ok ? (r.json() as Promise<Record<string, RigInfo>>) : {})).catch(() => ({})));

/** Valorant textures pack masks into EM / vertex colours — neutralise so the DF shows true colours. */
export function fixMaterials(o: THREE.Object3D) {
  o.traverse((n) => {
    const m = n as THREE.Mesh;
    if (!m.isMesh) return;
    for (const mt of Array.isArray(m.material) ? m.material : [m.material]) {
      const s = mt as THREE.MeshStandardMaterial;
      s.vertexColors = false;
      if (s.emissive) { s.emissive.setRGB(0, 0, 0); s.emissiveMap = null; }
      if (s.map) s.map.anisotropy = 8;
      s.needsUpdate = true;
    }
    m.frustumCulled = false;
  });
}

export type Clip = "Fire" | "Reload" | "Equip" | "Inspect";
type Pose = { p: [number, number, number]; aim: [number, number, number]; roll: number; fwd: [number, number, number]; up: [number, number, number] };
/**
 * Canonical on-screen weapon pose (viewmodel-camera space, camera looks down -Z).
 * p = weapon root (grip) position, aim = point the barrel points at, fwd/up = barrel/top axes in weapon-model space.
 * The arms rig is placed so that, in its rest pose, the weapon held by R_WeaponPoint lands exactly on this pose;
 * archive FP animations then move hands + weapon together relative to it.
 */
const POSES: Record<"long" | "sidearm" | "melee", Pose> = {
  long: { p: [0.18, -0.215, -0.43], aim: [0.08, -0.175, -2.2], roll: -0.12, fwd: [-1, 0, 0], up: [0, 1, 0] },
  sidearm: { p: [0.12, -0.09, -0.38], aim: [0.04, -0.03, -1.5], roll: -0.04, fwd: [-1, 0, 0], up: [0, 1, 0] },
  melee: { p: [0.13, -0.17, -0.42], aim: [-0.25, 0.15, -1.3], roll: -0.4, fwd: [0, 1, 0], up: [0, 0, 1] },
};

const v1 = new THREE.Vector3(), v2 = new THREE.Vector3(), v3 = new THREE.Vector3(), q1 = new THREE.Quaternion(), q2 = new THREE.Quaternion();

/** First-person rig: agent arms + weapon on R_WeaponPoint, driven by archive FP / GN animations. */
export class FPRig {
  holder = new THREE.Group(); arms!: THREE.Object3D; weapon!: THREE.Object3D; muzzle: THREE.Object3D | null = null;
  armsMix!: THREE.AnimationMixer; gunMix: THREE.AnimationMixer | null = null;
  idle: THREE.AnimationAction | null = null; fp: Partial<Record<Clip, THREE.AnimationAction>> = {}; gn: Partial<Record<Clip, THREE.AnimationAction>> = {};
  /** rest transform (arms space -> viewmodel camera), user tweak applied on top */
  rest = new THREE.Matrix4(); extra = new THREE.Matrix4();
  private lTarget: THREE.Object3D | null = null; private lChain: THREE.Object3D[] = []; private lHand: THREE.Object3D | null = null;
  /** 0..1 — engine lowers it while reload / inspect take the left hand off the gun */
  ikTarget = 1; private busy: THREE.AnimationAction | null = null; private hideLeft = false; private ikW = 1;

  static async build(agent: string, weaponId: string, category: string, skin: string, customUrl: string | null): Promise<FPRig> {
    const r = new FPRig(); r.holder.matrixAutoUpdate = false;
    const melee = weaponId === "knife";
    const [armsG, rig] = await Promise.all([loadGLTF(fpUrl(agent)), rigJson()]);
    // Arm pose source: the archive FP clips only line up with the agent rig for the AK (rifles) and BasePistol (sidearms),
    // so every long gun shares the AK hold and every sidearm the pistol hold; the weapon itself sits on R_WeaponPoint
    // and the left hand is IK-solved onto that weapon's own Left_Hand_Target socket.
    const kind: "long" | "sidearm" | "melee" = melee ? "melee" : category === "sidearm" ? "sidearm" : "long";
    // the archive has no melee FP clips (the "_X_" clips inside the arm files are ultimate abilities), so the knife uses
    // the pistol grip pose for the right hand; the slash itself is procedural in the engine
    const animG = await loadGLTF(`/ka/fpanim/${kind === "long" ? "vandal" : "classic"}_fp.glb`);
    const gunG = await loadGLTF(customUrl ?? weaponModelUrl(weaponId, skin)).catch(() => loadGLTF(weaponModelUrl(weaponId, "default")));
    r.arms = SkeletonUtils.clone(armsG.scene); r.weapon = SkeletonUtils.clone(gunG.scene);
    fixMaterials(r.arms); fixMaterials(r.weapon);
    r.holder.add(r.arms);
    const wp = r.arms.getObjectByName("R_WeaponPoint");
    (wp ?? r.arms).add(r.weapon);
    const info = rig[weaponId];
    const sk = info?.skins[customUrl ? "default" : skin] ?? info?.skins.default;
    for (const c of sk?.constraints ?? []) {
      const src = r.weapon.getObjectByName(c.src); const bone = r.weapon.getObjectByName(c.bone);
      if (src && bone) { bone.add(src); src.position.set(c.off[0], c.off[1], c.off[2]); src.rotation.set(...(c.rot.map((d) => (d * Math.PI) / 180) as [number, number, number])); }
    }
    for (const ex of sk?.exclusive ?? []) { const o = r.weapon.getObjectByName(ex); if (o) o.visible = false; }
    r.muzzle = r.weapon.getObjectByName("Muzzle") ?? null;
    r.armsMix = new THREE.AnimationMixer(r.arms);
    const find = (clips: THREE.AnimationClip[], name?: string, re?: RegExp) => clips.find((c) => (name && c.name === name) || (re && re.test(c.name)));
    let idle: THREE.AnimationClip | undefined;
    if (kind === "long") idle = find(animG.animations, undefined, /IdlePose$/);
    else { const fire = find(animG.animations, undefined, /_Fire$/); if (fire) idle = THREE.AnimationUtils.subclip(fire, "hold", 0, 1, 30); }
    if (idle) { r.idle = r.armsMix.clipAction(idle); r.idle.play(); }
    if (!melee && !customUrl) {
      try {
        const gnG = await loadGLTF(`/ka/fpanim/${weaponId}_gn.glb`);
        r.gunMix = new THREE.AnimationMixer(r.weapon);
        const gnNames = info?.anims.gn ?? {};
        (["Fire", "Reload"] as Clip[]).forEach((k) => {
          const clip = find(gnG.animations, gnNames[k]);
          if (clip) { const a = r.gunMix!.clipAction(clip); a.setLoop(THREE.LoopOnce, 1); r.gn[k] = a; }
        });
      } catch { r.gunMix = null; }
    }
    r.armsMix.addEventListener("finished", (e) => { if ((e as unknown as { action: THREE.AnimationAction }).action === r.busy) r.busy = null; if (r.idle) { r.idle.enabled = true; r.idle.reset().fadeIn(0.08).play(); } });
    // left hand: two-link CCD onto the weapon's Left_Hand_Target socket (the original game IK-drives it)
    const el = r.arms.getObjectByName("L_Elbow"), sh = r.arms.getObjectByName("L_Shoulder");
    r.lHand = r.arms.getObjectByName("L_Hand") ?? null; r.lTarget = melee ? null : (r.weapon.getObjectByName("Left_Hand_Target") ?? null);
    if (el && sh) r.lChain = [el, sh];
    // knife is one-handed in first person: tuck the left arm away
    if (melee) { const lc = r.arms.getObjectByName("L_Clavicle"); if (lc) lc.scale.setScalar(0.0001); r.hideLeft = true; }
    r.computeRest(kind);
    return r;
  }

  /** Solve rest transform from the idle pose so the weapon lands on the canonical screen pose. */
  private computeRest(kind: keyof typeof POSES) {
    let P = POSES[kind];
    try { const o = localStorage.getItem("vmPose"); if (o) P = { ...P, ...(JSON.parse(o) as Partial<Pose>) }; } catch { /* debug override only */ }
    this.armsMix.update(0); this.gunMix?.update(0);
    this.holder.matrix.identity(); this.holder.matrixWorld.identity(); this.arms.updateMatrixWorld(true);
    const W = this.weapon.matrixWorld.clone();
    // weapon-space basis (right, up, fwd) and its camera-space target
    const fw = new THREE.Vector3(...P.fwd);
    if (this.muzzle) {
      // barrel axis straight from the model: weapon root -> Muzzle socket, flattened onto the model's horizontal plane
      const inv = this.weapon.matrixWorld.clone().invert();
      const mp = this.muzzle.getWorldPosition(new THREE.Vector3()).applyMatrix4(inv); mp.y = 0;
      if (mp.lengthSq() > 1e-4) fw.copy(mp.normalize());
    }
    const uw = new THREE.Vector3(...P.up), rw = new THREE.Vector3().crossVectors(uw, fw);
    const fc = new THREE.Vector3(...P.aim).sub(new THREE.Vector3(...P.p)).normalize();
    const uc = new THREE.Vector3(Math.sin(P.roll), Math.cos(P.roll), 0); uc.addScaledVector(fc, -uc.dot(fc)).normalize();
    const rc = new THREE.Vector3().crossVectors(uc, fc);
    const A = new THREE.Matrix4().makeBasis(rc, uc, fc), B = new THREE.Matrix4().makeBasis(rw, uw, fw);
    const C = A.multiply(B.transpose()).setPosition(...P.p);
    // strip scale from the weapon matrix so the rig keeps its native metre scale
    const pos = new THREE.Vector3(), rot = new THREE.Quaternion(), scl = new THREE.Vector3();
    W.decompose(pos, rot, scl); const Wn = new THREE.Matrix4().compose(pos, rot, new THREE.Vector3(1, 1, 1));
    this.rest.copy(C).multiply(Wn.invert());
  }

  isBusy(): boolean { return !!this.busy && this.busy.isRunning(); }

  play(k: Clip, duration?: number) {
    for (const [mix, set] of [[this.armsMix, this.fp], [this.gunMix, this.gn]] as const) {
      const a = set[k]; if (!a || !mix) continue;
      const len = a.getClip().duration;
      a.timeScale = duration && len > 0 ? len / duration : 1;
      if (set === this.fp) {
        if (this.idle) this.idle.fadeOut(0.05);
        if (this.busy && this.busy !== a && k !== "Fire") this.busy.stop();
        if (k !== "Fire") this.busy = a;
      }
      a.reset().fadeIn(0.04).play();
    }
  }
  stopInspect() { const a = this.fp.Inspect; if (a && this.busy === a) { a.fadeOut(0.1); this.busy = null; this.idle?.reset().fadeIn(0.1).play(); } }

  update(dt: number) {
    this.armsMix.update(dt); this.gunMix?.update(dt);
    if (this.hideLeft) this.arms.getObjectByName("L_Clavicle")?.scale.setScalar(0.0001);
    this.holder.matrix.copy(this.extra).multiply(this.rest);
    this.holder.matrixWorldNeedsUpdate = true;
    this.holder.updateMatrixWorld(true);
    // left-hand IK fades out while reload / equip / inspect clips own the left arm
    this.ikW += ((this.isBusy() ? 0 : this.ikTarget) - this.ikW) * Math.min(1, dt * 14);
    if (this.lTarget && this.lHand && this.lChain.length && this.ikW > 0.01) {
      const tgt = this.lTarget.getWorldPosition(v1);
      for (let it = 0; it < 4; it++) {
        for (const link of this.lChain) {
          const eff = this.lHand.getWorldPosition(v2); const lp = link.getWorldPosition(v3);
          const a = eff.sub(lp).normalize(); const b = new THREE.Vector3().subVectors(tgt, lp).normalize();
          const dq = q1.setFromUnitVectors(a, b); q1.slerp(new THREE.Quaternion(), 1 - this.ikW);
          link.getWorldQuaternion(q2);
          const pq = link.parent!.getWorldQuaternion(new THREE.Quaternion()).invert();
          link.quaternion.copy(pq.multiply(dq.multiply(q2)));
          link.updateMatrixWorld(true);
        }
      }
    }
  }

  /** Muzzle position in viewmodel-camera space (for flash / tracer origin). */
  muzzlePos(out: THREE.Vector3, camInv: THREE.Matrix4): THREE.Vector3 {
    if (!this.muzzle) return out.set(0.06, -0.08, -0.7);
    return this.muzzle.getWorldPosition(out).applyMatrix4(camInv);
  }
}

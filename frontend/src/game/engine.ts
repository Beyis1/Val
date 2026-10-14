import * as THREE from "three";
import { MeshBVH, acceleratedRaycast } from "three-mesh-bvh";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import * as SkeletonUtils from "three/examples/jsm/utils/SkeletonUtils.js";
import { loadGLTF, getManifest, weaponModelUrl, meshBounds } from "@/game/assets";
import { sfx, preloadWeapon, decodedSamples, preloadFeedback, resetKillStreak } from "@/game/audio";
import { FPRig, fixMaterials } from "@/game/viewmodel";
import { WEAPON_BY_ID, KNIFE, SHIELD_BY_ID, damageAt, type WeaponDef } from "@/game/weapons";
import { getSettings, subscribeSettings, updateSettings, DEFAULT_VM, type ActionId } from "@/lib/settings";
import type { BotSpec, MapMeta, Prop, ScenarioBase } from "@/lib/types";
import { parseResolution } from "@/lib/display";
import { loadBotTemplate, botMaterial, zoneBoxes } from "@/game/trainingBot";

THREE.Mesh.prototype.raycast = acceleratedRaycast;

export type EngineStatus = "loading" | "ready" | "running" | "paused" | "buy" | "ended";
export interface HudState {
  score: number; timeLeft: number; kills: number; botsLeft: number; shots: number; hits: number;
  ammo: number; mag: number; weaponId: string; weaponName: string; reloading: number; hp: number; armor: number;
  zoom: number; scoped: boolean; defuse: number; spikeArmed: boolean; fps: number; scale: number; slot: number; bloom: number;
  message: string; onTarget: number; dmgFlash: number;
}
export interface RoundResult {
  score: number; shots: number; hits: number; headshots: number; kills: number; accuracy: number; headshot_rate: number;
  avg_reaction_ms: number | null; duration_sec: number; died: boolean; completed: boolean; weapon: string;
}
export interface EditorPick { action: "place" | "select" | "move" | "spawn" | "site" | "delete" | "prop" | "selectProp"; point: number[]; yaw: number; botId?: string; propId?: string }
export interface EngineCallbacks {
  onHud?: (h: HudState) => void; onStatus?: (s: EngineStatus) => void; onEnd?: (r: RoundResult) => void;
  onHit?: (kind: "body" | "head" | "kill", dmg?: number, hpLeft?: number) => void; onProgress?: (p: number) => void; onBuy?: () => void;
  onScoreboard?: (open: boolean) => void; onEditorPick?: (e: EditorPick) => void; onError?: (m: string) => void;
}
type Zone = "head" | "body" | "leg" | "target";
const AIM_TYPES = ["gridshot", "flick", "tracking", "strafe"];
const DIFF = {
  easy: { react: 900, interval: 0.55, hit: 0.22, window: 2.4, life: 2.2 },
  medium: { react: 560, interval: 0.38, hit: 0.38, window: 1.6, life: 1.6 },
  hard: { react: 320, interval: 0.26, hit: 0.55, window: 1.0, life: 1.1 },
};

interface Target {
  kind: "bot" | "sphere"; root: THREE.Object3D; hit: THREE.Mesh[]; hp: number; maxHp: number; alive: boolean; active: boolean;
  spec?: BotSpec; base: THREE.Vector3; lateral: THREE.Vector3; phase: number; dir: number; nextTurn: number; speed: number;
  seenAt: number | null; spawnAt: number; firstHit: number | null; los: boolean; losCheck: number; acquired: number | null; lastShot: number;
  mixer?: THREE.AnimationMixer; deathT: number; hideAt: number; vel?: THREE.Vector3; hitFlash?: number;
}

export class Engine {
  canvas: HTMLCanvasElement; sc: ScenarioBase; cb: EngineCallbacks; editor: boolean;
  renderer!: THREE.WebGLRenderer; scene = new THREE.Scene(); camera = new THREE.PerspectiveCamera(70, 1, 0.05, 2500);
  vmScene = new THREE.Scene(); vmCam = new THREE.PerspectiveCamera(56, 1, 0.01, 10); vmRoot = new THREE.Group();
  collider: THREE.Mesh | null = null; mapGeo: THREE.BufferGeometry | null = null; propGroup = new THREE.Group(); propsKey = ""; meta: MapMeta | null = null; world = new THREE.Group();
  status: EngineStatus = "loading"; raf = 0; last = 0; lastFrame = 0; disposed = false;
  // player
  pos = new THREE.Vector3(); vel = new THREE.Vector3(); yaw = 0; pitch = 0; onGround = false; crouch = 0;
  keys = new Set<string>(); hp = 100; armor = 0; regenPool = 0; lastDamage = 0;
  // weapons
  loadout = { primary: "vandal" as string | null, secondary: "classic" }; slot = 1; weapon: WeaponDef = KNIFE;
  ammo: Record<string, number> = {}; reloadEnd = 0; nextFire = 0; recoil = 0; lastShotT = 0; firing = false; zoomIdx = -1; adsHeld = false;
  rig: FPRig | null = null; vmKick = 0; vmLoaded = ""; vmModel: THREE.Object3D | null = null;
  flash!: THREE.Mesh; impacts: THREE.Mesh[] = []; impactIdx = 0; tracers: THREE.Line[] = []; tracerIdx = 0;
  botFacing = Number(localStorage.getItem("botFacing") ?? String(Math.PI / 2)); // model yaw offset (debug-tunable)
  equipT = -9; inspectT = -9; slashT = -9; mdx = 0; mdy = 0; swayX = 0; swayY = 0; bobT = 0; reloadTimers: number[] = [];
  // round
  targets: Target[] = []; t = 0; score = 0; kills = 0; shots = 0; hits = 0; heads = 0; reactions: number[] = []; onTarget = 0;
  spikePos: THREE.Vector3 | null = null; spikeObj: THREE.Object3D | null = null; defuse = 0; defused = false; beepT = 0; lastEnemyAnn = false;
  limit: { x: number; z: number; r: number } | null = null; boundT = -9;
  ended = false; died = false; message = ""; nextSpawn = 0; dmgFlash = 0;
  agents: string[] = []; hudT = 0; fpsAcc = 0; fpsN = 0; fps = 0; scale = 1; scaleT = 0;
  ray = new THREE.Raycaster(); unsub: (() => void) | null = null;
  // editor
  editorBots: THREE.Object3D[] = []; spawnMarker: THREE.Object3D | null = null; siteMarker: THREE.Object3D | null = null; selected = "";

  constructor(canvas: HTMLCanvasElement, sc: ScenarioBase, cb: EngineCallbacks, editor = false) {
    this.canvas = canvas; this.sc = sc; this.cb = cb; this.editor = editor;
  }

  // ---------------- setup ----------------
  async init() {
    const st = getSettings();
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: st.video.quality !== "low", powerPreference: "high-performance", stencil: false });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping; this.renderer.toneMappingExposure = 1.05;
    this.renderer.autoClear = false;
    this.scale = st.video.autoScale ? 1 : st.video.renderScale;
    this.resize();
    this.scene.background = new THREE.Color(0x8fb4d9);
    this.scene.fog = new THREE.Fog(0x9fbfdf, 120, 900);
    this.scene.add(new THREE.HemisphereLight(0xeaf2ff, 0x4a4f58, 2.1));
    const sun = new THREE.DirectionalLight(0xfff1dc, 2.2); sun.position.set(60, 120, 40); this.scene.add(sun);
    this.vmScene.add(new THREE.HemisphereLight(0xffffff, 0x445566, 2.4));
    const vs = new THREE.DirectionalLight(0xffffff, 1.6); vs.position.set(1, 2, 1); this.vmScene.add(vs);
    this.vmScene.add(this.vmCam); this.vmCam.add(this.vmRoot);
    this.flash = new THREE.Mesh(new THREE.PlaneGeometry(0.12, 0.12), new THREE.MeshBasicMaterial({ color: 0xffd28a, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
    this.vmCam.add(this.flash);
    this.scene.add(this.world);
    const man = await getManifest();
    this.agents = man.agents.length ? man.agents : [];
    try {
      if (this.sc.map_id === "range" || this.sc.map_id === "sandbox") this.buildRange(this.sc.map_id === "sandbox");
      else await this.loadMap(this.sc.map_id);
    } catch (e) {
      this.cb.onError?.("map"); console.error(e); this.buildRange();
    }
    for (let i = 0; i < 16; i++) {
      const m = new THREE.Mesh(new THREE.CircleGeometry(0.035, 8), new THREE.MeshBasicMaterial({ color: 0x111111, transparent: true, opacity: 0.8, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4 }));
      m.visible = false; this.scene.add(m); this.impacts.push(m);
    }
    for (let i = 0; i < 10; i++) {
      const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(6), 3));
      const l = new THREE.Line(g, new THREE.LineBasicMaterial({ color: 0xffe2a8, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
      l.frustumCulled = false; l.visible = false; this.scene.add(l); this.tracers.push(l);
    }
    // static world: freeze matrices (cpu win)
    this.world.traverse((o) => { o.updateMatrix(); o.matrixAutoUpdate = false; });
    this.world.updateMatrixWorld(true);
    this.scene.add(this.propGroup); this.setProps(this.sc.props ?? []);
    const lo = getSettings().loadout;
    this.loadout = { primary: lo.primary, secondary: lo.secondary };
    this.applyAllowed();
    this.bind();
    this.unsub = subscribeSettings(() => { this.applyVm(); this.resize(); });
    if (this.editor) this.setupEditor();
    this.resetRound();
    await this.equip(this.loadout.primary ? 1 : 2, true);
    // debug hooks for automated checks (same module instance as the app)
    if (!this.disposed) Object.assign(window, { __engine: this, __updateSettings: updateSettings, __decodedSamples: decodedSamples });
    this.setStatus("ready");
    this.last = performance.now();
    this.loop();
  }

  async loadMap(id: string) {
    let pv = 0, pc = 0; const rep = () => this.cb.onProgress?.(pv * 0.8 + pc * 0.2);
    const [vis, col, meta] = await Promise.all([
      loadGLTF(`/maps/${id}/visual.glb`, (p) => { pv = p; rep(); }),
      loadGLTF(`/maps/${id}/collision.glb`, (p) => { pc = p; rep(); }),
      fetch(`/maps/${id}/meta.json`).then((r) => r.json() as Promise<MapMeta>),
    ]);
    this.meta = meta;
    const q = getSettings().video.quality;
    vis.scene.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) {
        const mats = Array.isArray(m.material) ? m.material : [m.material];
        for (const mt of mats) {
          const s = mt as THREE.MeshStandardMaterial;
          if (s.map) s.map.anisotropy = q === "high" ? 8 : 4;
          s.side = THREE.DoubleSide;
        }
      }
    });
    this.world.add(vis.scene);
    col.scene.updateMatrixWorld(true);
    const geos: THREE.BufferGeometry[] = [];
    col.scene.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      const src = m.geometry.getAttribute("position");
      const arr = new Float32Array(src.count * 3);
      for (let i = 0; i < src.count; i++) { arr[i * 3] = src.getX(i); arr[i * 3 + 1] = src.getY(i); arr[i * 3 + 2] = src.getZ(i); }
      const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.BufferAttribute(arr, 3));
      if (m.geometry.index) g.setIndex(Array.from(m.geometry.index.array));
      g.applyMatrix4(m.matrixWorld);
      geos.push(g.index ? g.toNonIndexed() : g);
    });
    this.mapGeo = mergeGeometries(geos)!;
    this.rebuildCollider();
  }
  /** Map collision + editable props share one BVH so player, bots, bullets and LOS all respect props. */
  rebuildCollider(extra: THREE.BufferGeometry[] = []) {
    if (!this.mapGeo) return;
    const merged = extra.length ? mergeGeometries([this.mapGeo, ...extra])! : this.mapGeo.clone();
    (merged as THREE.BufferGeometry & { boundsTree?: MeshBVH }).boundsTree = new MeshBVH(merged);
    this.collider = new THREE.Mesh(merged, new THREE.MeshBasicMaterial({ visible: false }));
  }
  setProps(props: Prop[], selected = "") {
    const key = JSON.stringify(props) + selected; if (key === this.propsKey) return; this.propsKey = key;
    for (const c of this.propGroup.children) { const m = c as THREE.Mesh; m.geometry.dispose(); (m.material as THREE.Material).dispose(); }
    this.propGroup.clear();
    const geos: THREE.BufferGeometry[] = [];
    for (const p of props) {
      const [w, h, d] = p.size;
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshStandardMaterial({ color: p.color, roughness: 0.85, emissive: p.id === selected ? 0x0c3a55 : 0x000000 }));
      m.position.set(p.pos[0], p.pos[1] + h / 2, p.pos[2]); m.rotation.y = p.yaw; m.userData.propId = p.id;
      this.propGroup.add(m); m.updateMatrixWorld(true);
      const g = m.geometry.toNonIndexed(); const pos = new THREE.BufferGeometry(); pos.setAttribute("position", g.getAttribute("position")); pos.applyMatrix4(m.matrixWorld); geos.push(pos);
    }
    this.rebuildCollider(geos);
  }

  buildRange(sandbox = false) {
    const geos: THREE.BufferGeometry[] = [];
    const cvs = document.createElement("canvas"); cvs.width = cvs.height = 256; const g = cvs.getContext("2d")!;
    g.fillStyle = "#1d2530"; g.fillRect(0, 0, 256, 256); g.strokeStyle = "#2f3d4d"; g.lineWidth = 2;
    for (let i = 0; i <= 256; i += 64) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i, 256); g.moveTo(0, i); g.lineTo(256, i); g.stroke(); }
    const tex = new THREE.CanvasTexture(cvs); tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(30, 30); tex.colorSpace = THREE.SRGBColorSpace;
    const add = (w: number, h: number, d: number, x: number, y: number, z: number, mat: THREE.Material) => {
      const geo = new THREE.BoxGeometry(w, h, d); geo.translate(x, y, z);
      this.world.add(new THREE.Mesh(geo, mat)); geos.push(geo);
    };
    const floor = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9 });
    const wall = new THREE.MeshStandardMaterial({ color: 0x232c38, roughness: 0.8 });
    const accent = new THREE.MeshStandardMaterial({ color: 0xff4655, emissive: 0xff4655, emissiveIntensity: 0.8 });
    if (sandbox) {
      // empty editable ground: build the map from props in the editor (B = place box)
      add(120, 0.2, 120, 0, -0.1, 0, floor); tex.repeat.set(60, 60);
      add(120, 1.2, 1, 0, 0.6, -60, wall); add(120, 1.2, 1, 0, 0.6, 60, wall); add(1, 1.2, 120, -60, 0.6, 0, wall); add(1, 1.2, 120, 60, 0.6, 0, wall);
    } else {
      add(60, 0.2, 60, 0, -0.1, 0, floor);
      add(60, 14, 1, 0, 7, -24, wall); add(60, 14, 1, 0, 7, 24, wall); add(1, 14, 60, -24, 7, 0, wall); add(1, 14, 60, 24, 7, 0, wall);
      add(60, 0.15, 0.1, 0, 0.6, -23.45, accent); add(60, 0.15, 0.1, 0, 4.2, -23.45, accent);
      add(3, 1.2, 1, -8, 0.6, -6, wall); add(3, 1.2, 1, 8, 0.6, -6, wall);
    }
    this.scene.background = new THREE.Color(0x0e141c); this.scene.fog = null;
    this.mapGeo = mergeGeometries(geos.map((x) => x.toNonIndexed()).map((x) => { const n = new THREE.BufferGeometry(); n.setAttribute("position", x.getAttribute("position")); return n; }))!;
    this.rebuildCollider();
  }

  // ---------------- input ----------------
  binds(): Record<ActionId, [string, string]> { return getSettings().keybinds; }
  is(action: ActionId, code: string) { const b = this.binds()[action]; return b[0] === code || b[1] === code; }
  down(action: ActionId) { const b = this.binds()[action]; return this.keys.has(b[0]) || (!!b[1] && this.keys.has(b[1])); }
  h = {
    key: (e: KeyboardEvent) => {
      if (this.status !== "running") return;
      if (e.code === "Tab" || e.ctrlKey || e.code.startsWith("Key") || e.code === "Space") e.preventDefault();
      if (e.code === "Escape") { document.exitPointerLock(); return; }
      if (e.repeat) return;
      this.press(e.code);
    },
    keyup: (e: KeyboardEvent) => { this.release(e.code); },
    mdown: (e: MouseEvent) => { if (this.status === "running" && document.pointerLockElement === this.canvas) this.press("Mouse" + e.button); },
    mup: (e: MouseEvent) => this.release("Mouse" + e.button),
    wheel: (e: WheelEvent) => { if (this.status !== "running") return; const c = e.deltaY > 0 ? "WheelDown" : "WheelUp"; this.press(c); setTimeout(() => this.release(c), 60); },
    move: (e: MouseEvent) => {
      if (this.status !== "running" || document.pointerLockElement !== this.canvas) return;
      const s = getSettings(); let k = s.sensitivity * 0.07 * (Math.PI / 180);
      const z = this.zoom();
      if (z > 1) k *= (z >= 2 ? s.scopeMultiplier : s.adsMultiplier) / z;
      this.mdx += e.movementX; this.mdy += e.movementY;
      this.yaw -= e.movementX * k; this.pitch -= e.movementY * k * (s.invertY ? -1 : 1);
      this.pitch = Math.max(-1.55, Math.min(1.55, this.pitch));
    },
    lock: () => {
      if (document.pointerLockElement !== this.canvas && this.status === "running") { this.keys.clear(); this.setStatus("paused"); }
    },
    resize: () => this.resize(),
    ctx: (e: Event) => e.preventDefault(),
  };
  bind() {
    window.addEventListener("keydown", this.h.key); window.addEventListener("keyup", this.h.keyup);
    document.addEventListener("mousedown", this.h.mdown); document.addEventListener("mouseup", this.h.mup);
    document.addEventListener("mousemove", this.h.move); document.addEventListener("wheel", this.h.wheel, { passive: true });
    document.addEventListener("pointerlockchange", this.h.lock); window.addEventListener("resize", this.h.resize);
    this.canvas.addEventListener("contextmenu", this.h.ctx);
  }
  press(code: string) {
    this.keys.add(code);
    if (this.editor) { this.editorKey(code); return; }
    if (this.is("fire", code)) { this.firing = true; this.tryFire(true); }
    if (this.is("ads", code)) this.adsPress();
    if (this.is("reload", code)) this.reload();
    if (this.is("inspect", code) && this.reloadEnd <= this.t && !this.firing) this.inspectT = this.t;
    if (this.is("primary", code) && this.loadout.primary) void this.equip(1);
    if (this.is("secondary", code)) void this.equip(2);
    if (this.is("melee", code)) void this.equip(3);
    if (this.is("jump", code) && this.onGround) { this.vel.y = 5.4; this.onGround = false; }
    if (this.is("buy", code)) { this.setStatus("buy"); document.exitPointerLock(); this.cb.onBuy?.(); }
    if (this.is("scoreboard", code)) this.cb.onScoreboard?.(true);
  }
  release(code: string) {
    this.keys.delete(code);
    if (this.is("fire", code)) this.firing = false;
    if (this.is("ads", code) && getSettings().adsMode === "hold") this.zoomIdx = -1;
    if (this.is("scoreboard", code)) this.cb.onScoreboard?.(false);
  }

  // ---------------- lifecycle ----------------
  setStatus(s: EngineStatus) { this.status = s; this.cb.onStatus?.(s); }
  requestLock() {
    const p = this.canvas.requestPointerLock({ unadjustedMovement: true }) as unknown as Promise<void> | undefined;
    p?.catch?.(() => undefined);
    // browsers refuse a re-lock right after Esc; never leave the game "running" without mouse capture
    setTimeout(() => { if (this.status === "running" && !this.editor && document.pointerLockElement !== this.canvas && !localStorage.getItem("valaim.noLockCheck")) { this.keys.clear(); this.firing = false; this.setStatus("paused"); } }, 450);
  }
  start() {
    preloadFeedback(); for (const id of ["vandal", "phantom", "guardian", "operator", "knife", this.weapon.id]) preloadWeapon(id); if (this.status === "ended") this.resetRound(); this.setStatus("running"); this.requestLock(); this.last = performance.now(); }
  resume() { this.setStatus("running"); this.requestLock(); this.last = performance.now(); }
  restart() { this.resetRound(); this.start(); }
  resize() {
    if (!this.renderer) return;
    const w = this.canvas.clientWidth || window.innerWidth, h = this.canvas.clientHeight || window.innerHeight;
    // chosen render resolution drives the backbuffer; CSS keeps the canvas full-window so HUD / crosshair stay put
    const res = parseResolution(getSettings().video.resolution);
    const base = res ? res[0] / w : Math.min(window.devicePixelRatio, 2);
    this.renderer.setPixelRatio(Math.max(0.25, base) * this.scale);
    this.renderer.setSize(w, h, false);
    this.camera.aspect = this.vmCam.aspect = w / h; this.updateFov(); this.vmCam.updateProjectionMatrix();
  }
  updateFov() {
    const hf = (getSettings().video.fov * Math.PI) / 180; const z = this.zoom();
    this.camera.fov = (2 * Math.atan(Math.tan(hf / 2) / z / this.camera.aspect) * 180) / Math.PI;
    this.camera.updateProjectionMatrix();
  }
  dispose() {
    this.disposed = true; cancelAnimationFrame(this.raf); this.unsub?.();
    window.removeEventListener("keydown", this.h.key); window.removeEventListener("keyup", this.h.keyup);
    document.removeEventListener("mousedown", this.h.mdown); document.removeEventListener("mouseup", this.h.mup);
    document.removeEventListener("mousemove", this.h.move); document.removeEventListener("wheel", this.h.wheel);
    document.removeEventListener("pointerlockchange", this.h.lock); window.removeEventListener("resize", this.h.resize);
    this.canvas.removeEventListener("contextmenu", this.h.ctx);
    if (document.pointerLockElement === this.canvas) document.exitPointerLock();
    this.renderer?.dispose();
  }

  resetRound() {
    for (const tg of this.targets) this.scene.remove(tg.root);
    resetKillStreak();
    this.targets = []; this.t = 0; this.score = 0; this.kills = 0; this.shots = 0; this.hits = 0; this.heads = 0; this.reactions = [];
    this.onTarget = 0; this.defuse = 0; this.defused = false; this.ended = false; this.died = false; this.message = ""; this.lastEnemyAnn = false;
    const sh = SHIELD_BY_ID[getSettings().loadout.shield] ?? SHIELD_BY_ID.none;
    this.hp = 100; this.armor = sh.armor; this.regenPool = sh.regenPool; this.nextSpawn = 0.6;
    this.pos.fromArray(this.sc.spawn.length === 3 ? this.sc.spawn : [0, 0, 8]); this.vel.set(0, 0, 0);
    this.yaw = this.sc.spawn_yaw; this.pitch = 0; this.zoomIdx = -1;
    if (AIM_TYPES.includes(this.sc.type)) this.pos.set(0, 0, 8), (this.yaw = 0);
    this.nudgeOut(this.pos); this.pos.y = this.groundY(this.pos.x, this.pos.y, this.pos.z); this.onGround = true;
    for (const k of Object.keys(this.ammo)) delete this.ammo[k];
    if (this.spikeObj) { this.scene.remove(this.spikeObj); this.spikeObj = null; }
    this.spikePos = null;
    this.limit = null;
    const ty = this.sc.type; const sp = this.sc.spawn;
    if (!this.editor && sp.length === 3 && !AIM_TYPES.includes(ty)) {
      if (ty === "hold") this.limit = { x: sp[0], z: sp[2], r: 2.5 };
      else if (ty === "spike" && this.sc.site) { const st = this.sc.site; this.limit = { x: (sp[0] + st[0]) / 2, z: (sp[2] + st[2]) / 2, r: Math.hypot(st[0] - sp[0], st[2] - sp[2]) / 2 + 22 }; }
      else if (this.sc.bots.length) {
        const pts = [sp, ...this.sc.bots.map((b) => b.pos)]; const cx = pts.reduce((a, p) => a + p[0], 0) / pts.length, cz = pts.reduce((a, p) => a + p[2], 0) / pts.length;
        this.limit = { x: cx, z: cz, r: Math.max(...pts.map((p) => Math.hypot(p[0] - cx, p[2] - cz))) + 10 };
      }
    }
    if (!this.editor) void this.spawnScenario();
  }

  // ---------------- weapons / viewmodel ----------------
  applyAllowed() {
    const al = this.sc.allowed_weapons;
    if (!al.length) return;
    if (this.loadout.primary && !al.includes(this.loadout.primary)) this.loadout.primary = al.find((w) => WEAPON_BY_ID[w]?.category !== "sidearm") ?? null;
    if (!al.includes(this.loadout.secondary)) this.loadout.secondary = al.find((w) => WEAPON_BY_ID[w]?.category === "sidearm") ?? this.loadout.secondary;
  }
  setLoadout(primary: string | null, secondary: string) { this.loadout = { primary, secondary }; void this.equip(primary ? 1 : 2, true); }
  zoom(): number { const z = this.weapon.zoom; return z && this.zoomIdx >= 0 && this.reloadEnd <= this.t ? z[Math.min(this.zoomIdx, z.length - 1)] : 1; }
  adsPress() {
    const z = this.weapon.zoom; if (!z) return;
    if (getSettings().adsMode === "hold") this.zoomIdx = 0;
    else this.zoomIdx = this.zoomIdx + 1 >= z.length ? -1 : this.zoomIdx + 1;
    this.updateFov();
  }
  async equip(slot: number, force = false) {
    if (!force && slot === this.slot) return;
    this.slot = slot; this.zoomIdx = -1; this.reloadEnd = 0;
    const id = slot === 1 ? this.loadout.primary : slot === 2 ? this.loadout.secondary : "knife";
    this.weapon = (id && WEAPON_BY_ID[id]) || KNIFE;
    if (this.ammo[this.weapon.id] === undefined) this.ammo[this.weapon.id] = this.weapon.mag;
    this.nextFire = this.t + this.weapon.equip; this.updateFov();
    this.equipT = this.t; this.inspectT = -9; this.clearReloadTimers(); sfx.stopReload(); preloadWeapon(this.weapon.id); sfx.equip(this.weapon.category, this.weapon.id);
    await this.buildViewmodel();
    this.equipT = this.t; // restart the raise once the model is actually on screen
  }
  async buildViewmodel() {
    const st = getSettings(); const wid = this.weapon.id;
    // only skins still in the curated collection (Battle Pass / upgradeable) may load; anything else falls back to default
    const man = await getManifest(); const want = st.skins[wid] ?? "default";
    const skin = want === "default" || (man.weapons[wid === "knife" ? "melee" : wid] ?? []).some((x) => x.id === want) ? want : "default";
    const key = `${st.fpAgent}|${wid}|${skin}`; if (key === this.vmLoaded) return; this.vmLoaded = key;
    const customList = await fetch("/api/weapon-models").then((r) => (r.ok ? r.json() : [])).catch(() => []) as { weapon_id: string }[];
    const custom = customList.some((m) => m.weapon_id === wid);
    try {
      const rig = await FPRig.build(st.fpAgent, wid, this.weapon.category, skin, custom ? `/api/weapon-models/${wid}/file` : null);
      if (this.vmLoaded !== key) return;
      this.rig = rig; this.vmRoot.clear(); this.vmRoot.add(rig.holder); this.vmModel = rig.holder;
      rig.play("Equip", this.weapon.equip); this.applyVm(); return;
    } catch (e) { console.warn("fp rig failed", e); this.rig = null; }
    // fallback: bare weapon model (custom GLB without rig compatibility / missing archive files)
    let model: THREE.Object3D | null = null;
    try {
      const g = await loadGLTF(custom ? `/api/weapon-models/${wid}/file` : weaponModelUrl(wid, skin)).catch(() => loadGLTF(weaponModelUrl(wid, "default")));
      model = SkeletonUtils.clone(g.scene); fixMaterials(model);
    } catch { model = null; }
    if (this.vmLoaded !== key) return;
    if (!model) model = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.08, 0.5), new THREE.MeshStandardMaterial({ color: 0x2a313b }));
    const b = meshBounds(model); const size = b.getSize(new THREE.Vector3()); const c = b.getCenter(new THREE.Vector3());
    const holder = new THREE.Group(); const inner = new THREE.Group(); inner.add(model); model.position.sub(c);
    if (size.x >= size.z) inner.rotation.y = Math.PI / 2;
    const len = this.weapon.category === "melee" ? 0.3 : this.weapon.category === "sidearm" ? 0.32 : this.weapon.category === "sniper" ? 0.95 : 0.75;
    inner.scale.setScalar(len / Math.max(size.x, size.z, 0.01));
    holder.add(inner); holder.traverse((o) => { o.frustumCulled = false; });
    this.vmModel = holder; this.vmRoot.clear(); this.vmRoot.add(holder);
    this.applyVm();
  }
  applyVm() {
    if (!this.vmModel) return;
    const a = { ...DEFAULT_VM, ...(getSettings().viewmodel[this.weapon.id] ?? {}) };
    if (this.rig) {
      this.rig.lOffset.set(a.lx, a.ly, -a.lz); this.rig.ikEnabled = a.ik !== 0;
      if (this.vmCam.fov !== a.fov) { this.vmCam.fov = a.fov; this.vmCam.updateProjectionMatrix(); }
      this.rig.extra.compose(new THREE.Vector3(a.px, a.py, a.pz), new THREE.Quaternion().setFromEuler(new THREE.Euler((a.rx * Math.PI) / 180, (a.ry * Math.PI) / 180, (a.rz * Math.PI) / 180)), new THREE.Vector3(a.scale, a.scale, a.scale));
      this.vmRoot.visible = getSettings().showViewmodel; return;
    }
    const base = this.weapon.category === "melee" ? [0.16, -0.17, -0.32] : this.weapon.category === "sidearm" ? [0.15, -0.16, -0.36] : [0.17, -0.19, -0.42];
    this.vmModel.position.set(base[0] + a.px, base[1] + a.py, base[2] + a.pz);
    this.vmModel.rotation.set((a.rx * Math.PI) / 180, (a.ry * Math.PI) / 180 + 0.04, (a.rz * Math.PI) / 180);
    this.vmModel.scale.setScalar(a.scale);
    this.vmRoot.visible = getSettings().showViewmodel;
  }
  reload() {
    const w = this.weapon; if (w.mag === 0 || this.reloadEnd > this.t || this.ammo[w.id] >= w.mag) return;
    this.reloadEnd = this.t + w.reload; this.zoomIdx = -1; this.inspectT = -9; this.updateFov(); this.rig?.play("Reload", w.reload);
    // sound cues land on the procedural reload curve: mag out (~22%), mag in (~68%), charge / slide (~88%)
    this.clearReloadTimers();
    if (sfx.reloadSample(w.id)) return;
    const id = w.id; const cue = (f: number, kind: "out" | "in" | "charge") => this.reloadTimers.push(window.setTimeout(() => { if (this.weapon.id === id && this.reloadEnd > this.t) sfx.reload(kind, w.category); }, w.reload * f * 1000));
    cue(0.22, "out"); cue(0.68, "in"); if (w.category !== "shotgun") cue(0.88, "charge");
  }
  clearReloadTimers() { for (const t of this.reloadTimers) clearTimeout(t); this.reloadTimers = []; }
  tryFire(pressed: boolean) {
    const w = this.weapon;
    if (this.status !== "running" || this.ended) return;
    if (!pressed && !w.auto) return;
    if (this.t < this.nextFire || this.reloadEnd > this.t) return;
    if (w.mag > 0 && this.ammo[w.id] <= 0) { if (pressed) sfx.empty(); this.reload(); return; }
    this.nextFire = this.t + 1 / w.fireRate;
    if (w.mag > 0) this.ammo[w.id] -= 1;
    if (this.t - this.lastShotT > 0.42) this.recoil = 0; else if (this.t - this.lastShotT > 0.2) this.recoil = Math.max(0, this.recoil - 2);
    this.lastShotT = this.t; this.vmKick = w.category === "melee" ? 0 : 1; this.inspectT = -9; this.rig?.play("Fire");
    if (w.category === "melee") { this.slashT = this.t; sfx.knife(this.shoot(w, 0, 2.4)); return; }
    sfx.fire(w.id, getSettings().skins[w.id] ?? "default"); this.shots += 1;
    (this.flash.material as THREE.MeshBasicMaterial).opacity = 1; this.flash.rotation.z = Math.random() * Math.PI; this.flash.scale.setScalar(0.7 + Math.random() * 0.6);
    const speed = Math.hypot(this.vel.x, this.vel.z);
    const sp = w.spread; const pellets = w.pellets ?? 1;
    // standing / walking slowly: no random error, bullets follow the fixed spray pattern (Valorant-like)
    let spread = 0;
    if (!this.onGround) spread = sp.air; else if (speed > 3.2) spread = sp.move; else if (speed > 1.8) spread = sp.move * 0.35;
    if (w.scoped && this.zoom() === 1) spread = Math.max(spread, 3);
    if (pellets > 1) spread = Math.max(spread, sp.stand);
    const i = this.recoil; // shot index in current spray
    const climb = Math.min(w.recoil.max, i * w.recoil.up * 1.6);
    const sway = i < 5 ? 0 : -Math.sin((i - 5) * 0.55) * w.recoil.side * 5;
    for (let k = 0; k < pellets; k++) this.shoot(w, spread, 200, climb, sway, pellets > 1 ? k / pellets : -1, k < 3);
    this.recoil += 1;
    if (this.ammo[w.id] === 0) this.reload();
  }
  shoot(w: WeaponDef, spreadDeg: number, range: number, upDeg = 0, sideDeg = 0, pellet = -1, tracer = false): boolean {
    const dir = new THREE.Vector3(); const D2R = Math.PI / 180;
    let r = 0, a = 0;
    if (pellet >= 0) { a = pellet * Math.PI * 2 * 2.618; r = spreadDeg * D2R * (pellet < 0.34 ? 0.35 : pellet < 0.67 ? 0.7 : 1); }
    else if (spreadDeg > 0) { r = Math.sqrt(Math.random()) * spreadDeg * D2R; a = Math.random() * Math.PI * 2; }
    const e = new THREE.Euler(this.pitch + upDeg * D2R + Math.sin(a) * r, this.yaw + sideDeg * D2R + Math.cos(a) * r, 0, "YXZ");
    dir.set(0, 0, -1).applyEuler(e);
    const origin = this.eye();
    this.ray.set(origin, dir); this.ray.far = range; this.ray.firstHitOnly = true;
    const wall = this.collider ? this.ray.intersectObject(this.collider, false)[0] : undefined;
    this.ray.firstHitOnly = false;
    const meshes = this.targets.filter((t) => t.alive && t.active).flatMap((t) => t.hit);
    const hit = this.ray.intersectObjects(meshes, false)[0];
    if (tracer && getSettings().video.effects) {
      const end = hit && (!wall || hit.distance < wall.distance) ? hit.point : wall ? wall.point : origin.clone().addScaledVector(dir, range);
      this.spawnTracer(end);
    }
    if (hit && (!wall || hit.distance < wall.distance)) {
      const tg = this.targets.find((t) => t.hit.includes(hit.object as THREE.Mesh))!;
      const zone = (hit.object.userData.zone as Zone) ?? "body";
      this.damageTarget(tg, zone, w, hit.distance);
      return true;
    }
    if (wall && wall.face) {
      const m = this.impacts[this.impactIdx++ % this.impacts.length];
      m.visible = true; m.position.copy(wall.point); m.lookAt(wall.point.clone().add(wall.face.normal)); m.position.addScaledVector(wall.face.normal, 0.01);
    }
    return false;
  }
  /** Tracer from the on-screen muzzle to the real impact point (bullets always travel along the crosshair ray). */
  spawnTracer(end: THREE.Vector3) {
    this.vmCam.updateMatrixWorld(true); this.camera.updateMatrixWorld(true);
    const local = this.rig ? this.rig.muzzlePos(new THREE.Vector3(), this.vmCam.matrixWorld.clone().invert()) : new THREE.Vector3(0.12, -0.12, -0.8);
    const start = this.camera.localToWorld(local.clone());
    const l = this.tracers[this.tracerIdx++ % this.tracers.length];
    const a = l.geometry.getAttribute("position") as THREE.BufferAttribute;
    a.setXYZ(0, start.x, start.y, start.z); a.setXYZ(1, end.x, end.y, end.z); a.needsUpdate = true;
    (l.material as THREE.LineBasicMaterial).opacity = 0.85; l.visible = true;
  }
  damageTarget(tg: Target, zone: Zone, w: WeaponDef, dist: number) {
    const tNow = this.t;
    if (tg.firstHit === null) tg.firstHit = tNow;
    if (w.category !== "melee") this.hits += 1;
    if (tg.kind === "sphere") { this.killTarget(tg, false); return; }
    const d = damageAt(w, dist); const dmg = zone === "head" ? d.head : zone === "leg" ? d.leg : d.body;
    if (zone === "head") this.heads += 1;
    tg.hp -= dmg;
    sfx.hit(zone === "head" ? "head" : "body"); this.cb.onHit?.(zone === "head" ? "head" : "body", dmg, Math.max(0, tg.hp) / tg.maxHp);
    if (tg.hp <= 0) this.killTarget(tg, zone === "head");
    else if (tg.kind === "bot") this.flashBot(tg);
  }
  killTarget(tg: Target, head: boolean) {
    if (!tg.alive) return; // a target can only die once (no double kill sound / score)
    tg.alive = false; tg.deathT = this.t; this.kills += 1; sfx.kill(head); this.cb.onHit?.("kill");
    const ref = tg.seenAt ?? tg.spawnAt; const react = (this.t - ref) * 1000;
    if (react > 60 && react < 5000) this.reactions.push(react);
    const ty = this.sc.type; const life = DIFF[this.sc.difficulty].window;
    let pts = 100 + (head ? 50 : 0);
    if (ty === "hold" || ty === "flick" || ty === "strafe") pts += Math.max(0, Math.round((1 - react / 1000 / life) * 100));
    this.score += pts;
    if (tg.kind === "sphere") { tg.active = false; tg.root.visible = false; }
    const left = this.targets.filter((t) => t.kind === "bot" && t.alive).length;
  }

  // ---------------- targets ----------------
  /**
   * Lightweight target body with Valorant-like proportions. Every visible part IS its hitbox
   * (head / body incl. arms / legs), so what you see is exactly what registers.
   */
  async makeBot(spec: BotSpec): Promise<Target> {
    const root = new THREE.Group(); const body = new THREE.Group(); root.add(body);
    const mHead = new THREE.MeshStandardMaterial({ color: 0xff4655, roughness: 0.55, emissive: 0x000000 });
    const mBody = new THREE.MeshStandardMaterial({ color: 0x323c4b, roughness: 0.7, emissive: 0x000000 });
    const mLeg = new THREE.MeshStandardMaterial({ color: 0x232a35, roughness: 0.8, emissive: 0x000000 });
    const hit: THREE.Mesh[] = [];
    // user training-bot model when available: boxes become invisible hitboxes fitted to the same proportions
    const tpl = await loadBotTemplate();
    const hidden = new THREE.MeshBasicMaterial({ visible: false });
    const flash: THREE.MeshStandardMaterial[] = [];
    if (tpl) { const mat = botMaterial(); flash.push(mat); const m = new THREE.Mesh(tpl, mat); m.rotation.y = this.botFacing; body.add(m); }
    else flash.push(mHead, mBody, mLeg);
    const part = (w: number, h: number, d: number, x: number, y: number, zone: Zone, mat: THREE.Material, z = 0) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), tpl ? hidden : mat); m.position.set(x, y, z); m.userData.zone = zone; body.add(m); hit.push(m); return m;
    };
    if (tpl) for (const zb of zoneBoxes(tpl, this.botFacing)) part(zb.size[0], zb.size[1], zb.size[2], zb.center[0], zb.center[1], zb.zone, hidden, zb.center[2]);
    else {
    part(0.16, 0.9, 0.2, -0.11, 0.45, "leg", mLeg); part(0.16, 0.9, 0.2, 0.11, 0.45, "leg", mLeg);
    part(0.46, 0.58, 0.28, 0, 1.2, "body", mBody);
    part(0.11, 0.56, 0.13, -0.3, 1.2, "body", mBody); part(0.11, 0.56, 0.13, 0.3, 1.2, "body", mBody);
    part(0.1, 0.08, 0.1, 0, 1.53, "body", mBody); // neck
    part(0.24, 0.26, 0.25, 0, 1.69, "head", mHead);
    }
    // visor stripe so facing direction reads at a glance (not a hitbox)
    if (!tpl) { const visor = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.05, 0.02), new THREE.MeshBasicMaterial({ color: 0x0b1015 })); visor.position.set(0, 1.71, 0.13); body.add(visor); }
    root.userData.flash = flash;
    if (spec.stance === "crouch") body.scale.y = 0.72;
    const base = this.nudgeOut(new THREE.Vector3().fromArray(spec.pos)); base.y = this.groundY(base.x, base.y, base.z);
    root.position.copy(base);
    const toP = new THREE.Vector3().subVectors(this.pos, base); toP.y = 0;
    root.rotation.y = Math.atan2(toP.x, toP.z);
    const lateral = new THREE.Vector3(toP.z, 0, -toP.x).normalize();
    this.scene.add(root);
    return { kind: "bot", root, hit, hp: spec.health, maxHp: spec.health, alive: true, active: true, spec, base, lateral, phase: Math.random() * 6, dir: 1,
      nextTurn: 0, speed: getSettings().range.botSpeed, seenAt: null, spawnAt: this.t, firstHit: null, los: false, losCheck: 0, acquired: null, lastShot: 0, deathT: 0, hideAt: 0 };
  }
  /** Push a spawn point out of nearby walls (8 horizontal probes at knee + chest height) so bots never start inside geometry. */
  nudgeOut(p: THREE.Vector3): THREE.Vector3 {
    if (!this.collider) return p;
    const R = 0.4; this.ray.firstHitOnly = true;
    for (let pass = 0; pass < 2; pass++) for (const h of [0.5, 1.2]) for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2; const dir = new THREE.Vector3(Math.sin(a), 0, Math.cos(a));
      this.ray.set(new THREE.Vector3(p.x, p.y + h, p.z), dir); this.ray.far = R;
      const hit = this.ray.intersectObject(this.collider, false)[0];
      if (hit) p.addScaledVector(dir, -(R - hit.distance) - 0.02);
    }
    this.ray.firstHitOnly = false; return p;
  }
  /** Is the strafe path clear for a step (chest-height probe), so moving bots never walk into walls. */
  pathClear(from: THREE.Vector3, dir: THREE.Vector3, dist: number): boolean {
    if (!this.collider) return true;
    this.ray.set(new THREE.Vector3(from.x, from.y + 0.9, from.z), dir); this.ray.far = dist + 0.35; this.ray.firstHitOnly = true;
    const h = this.ray.intersectObject(this.collider, false)[0]; this.ray.firstHitOnly = false; return !h;
  }
  /** Floor height under a point (feet snap) — same collider the player capsule walks on. */
  groundY(x: number, y: number, z: number): number {
    if (!this.collider) return y;
    this.ray.set(new THREE.Vector3(x, y + 1.4, z), new THREE.Vector3(0, -1, 0)); this.ray.far = 6; this.ray.firstHitOnly = true;
    const h = this.ray.intersectObject(this.collider, false)[0]; this.ray.firstHitOnly = false;
    return h ? h.point.y : y;
  }
  flashBot(tg: Target) {
    for (const mt of tg.root.userData.flash as THREE.MeshStandardMaterial[]) mt.emissive.setRGB(0.5, 0.5, 0.5);
    tg.hitFlash = 1;
  }
  botShotSound(p: THREE.Vector3) {
    const d = p.distanceTo(this.pos); const right = new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
    const dir = new THREE.Vector3().subVectors(p, this.pos).setY(0).normalize();
    sfx.botShot(d, right.dot(dir));
  }
  makeSphere(pos: THREE.Vector3, r: number): Target {
    const s = getSettings().range;
    const m = new THREE.Mesh(new THREE.SphereGeometry(r, 20, 14), new THREE.MeshStandardMaterial({ color: s.targetColor, emissive: s.targetColor, emissiveIntensity: 0.35 }));
    m.userData.zone = "target"; m.position.copy(pos); this.scene.add(m);
    return { kind: "sphere", root: m, hit: [m], hp: 1, maxHp: 1, alive: true, active: true, base: pos.clone(), lateral: new THREE.Vector3(1, 0, 0), phase: Math.random() * 6, dir: 1,
      nextTurn: 0, speed: 0, seenAt: null, spawnAt: this.t, firstHit: null, los: true, losCheck: 0, acquired: null, lastShot: 0, deathT: 0, hideAt: 0 };
  }
  async spawnScenario() {
    const ty = this.sc.type;
    if (ty === "gridshot") { for (let i = 0; i < getSettings().range.gridTargets; i++) this.spawnGrid(); return; }
    if (ty === "flick" || ty === "tracking") { this.spawnSingle(); return; }
    if (ty === "strafe") { await this.spawnStrafe(); return; }
    let bots: BotSpec[] = this.sc.bots;
    if (!bots.length && this.meta) {
      const near = this.meta.walk.filter((p) => { const d = Math.hypot(p[0] - this.pos.x, p[2] - this.pos.z); return d > 8 && d < 30; });
      bots = near.sort(() => Math.random() - 0.5).slice(0, 8).map((p, i) => ({ id: `r${i}`, pos: p, yaw: 0, stance: "stand", movement: "static", move_range: 2, health: 150, shoots: false }));
    }
    if (ty === "hold" && this.collider) {
      const eye = this.eye(); const head = (p: number[]) => new THREE.Vector3(p[0], p[1] + 1.5, p[2]);
      const vis = bots.filter((b) => this.hasLos(eye, head(b.pos)));
      if (vis.length < 5 && this.meta) {
        const extra = this.meta.walk.filter((p) => { const d = Math.hypot(p[0] - this.pos.x, p[2] - this.pos.z); return d > 10 && d < 38 && Math.abs(p[1] - this.pos.y) < 5; })
          .sort(() => Math.random() - 0.5).filter((p) => this.hasLos(eye, head(p))).slice(0, 8 - vis.length);
        vis.push(...extra.map((p, i) => ({ id: `v${i}`, pos: p, yaw: 0, stance: "stand" as const, movement: "peek" as const, move_range: 1.6, health: 150, shoots: false })));
      }
      if (vis.length) bots = vis;
    }
    const made = await Promise.all(bots.map((b) => this.makeBot(b)));
    if (this.disposed) return;
    this.targets = made;
    if (ty === "hold") for (const b of made) { b.active = false; b.root.visible = false; }
    if (ty === "spike") {
      const sp = this.sc.site ?? [this.pos.x, this.pos.y, this.pos.z - 10];
      this.spikePos = new THREE.Vector3().fromArray(sp);
      try {
        const g = await loadGLTF("/ka/misc/spike.glb"); const s = SkeletonUtils.clone(g.scene); fixMaterials(s); const b = meshBounds(s);
        s.scale.setScalar(0.6 / Math.max(0.01, b.max.y - b.min.y)); s.position.copy(this.spikePos); this.spikeObj = s; this.scene.add(s);
      } catch { /* ignore */ }
    }
  }
  wallPoint(): THREE.Vector3 { return new THREE.Vector3((Math.random() - 0.5) * 7, 1.2 + Math.random() * 3.6, -4); }
  spawnGrid() {
    const r = 0.3 * getSettings().range.targetSize * (this.sc.difficulty === "hard" ? 0.7 : 1);
    let p = this.wallPoint();
    for (let i = 0; i < 10 && this.targets.some((t) => t.active && t.root.position.distanceTo(p) < r * 3); i++) p = this.wallPoint();
    this.targets.push(this.makeSphere(p, r));
  }
  spawnSingle() {
    const tr = this.sc.type === "tracking";
    const r = (tr ? 0.42 : 0.3) * getSettings().range.targetSize;
    const p = tr ? new THREE.Vector3(0, 2.5, -6) : new THREE.Vector3((Math.random() - 0.5) * 22, 1 + Math.random() * 5, -6 - Math.random() * 10);
    this.targets.push(this.makeSphere(p, r));
  }
  async spawnStrafe() {
    const p = [(Math.random() - 0.5) * 16, 0, -6 - Math.random() * 10];
    const b = await this.makeBot({ id: "s", pos: p, yaw: 0, stance: "stand", movement: "strafe", move_range: 3, health: getSettings().range.botHealth, shoots: this.sc.bots_shoot });
    if (!this.disposed) this.targets.push(b);
  }

  // ---------------- simulation ----------------
  eye(): THREE.Vector3 { return new THREE.Vector3(this.pos.x, this.pos.y + 1.62 - this.crouch * 0.48, this.pos.z); }
  hasLos(a: THREE.Vector3, b: THREE.Vector3): boolean {
    if (!this.collider) return true;
    const d = new THREE.Vector3().subVectors(b, a); const L = d.length();
    this.ray.set(a, d.normalize()); this.ray.far = L - 0.1; this.ray.firstHitOnly = true;
    const h = this.ray.intersectObject(this.collider, false); this.ray.firstHitOnly = false;
    return h.length === 0;
  }
  physics(dt: number) {
    const st = getSettings();
    const fwd = (this.down("forward") ? 1 : 0) - (this.down("back") ? 1 : 0);
    const str = (this.down("right") ? 1 : 0) - (this.down("left") ? 1 : 0);
    this.crouch += ((this.down("crouch") ? 1 : 0) - this.crouch) * Math.min(1, dt * 12);
    const wish = new THREE.Vector3(str, 0, -fwd); if (wish.lengthSq() > 0) wish.normalize();
    wish.applyAxisAngle(new THREE.Vector3(0, 1, 0), this.yaw);
    if (this.editor) {
      const sp = this.down("walk") ? 20 : 9;
      const f = new THREE.Vector3(0, 0, -1).applyEuler(new THREE.Euler(this.pitch, this.yaw, 0, "YXZ"));
      const r = new THREE.Vector3(1, 0, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), this.yaw);
      this.pos.addScaledVector(f, fwd * sp * dt).addScaledVector(r, str * sp * dt);
      if (this.keys.has("Space")) this.pos.y += sp * dt; if (this.keys.has("KeyC")) this.pos.y -= sp * dt;
      return;
    }
    let speed = this.weapon.runSpeed; if (this.down("walk")) speed *= 0.52; if (this.crouch > 0.5) speed *= 0.42;
    if (this.zoom() > 1) speed *= 0.76;
    const k = this.onGround ? 14 : 2.2;
    this.vel.x += (wish.x * speed - this.vel.x) * Math.min(1, dt * k);
    this.vel.z += (wish.z * speed - this.vel.z) * Math.min(1, dt * k);
    if (!this.collider) return;
    // step-up: foot blocked but knee free -> lift onto stairs / curbs (max ~0.45m)
    if (this.onGround && wish.lengthSq() > 0) {
      const foot = new THREE.Vector3(this.pos.x, this.pos.y + 0.12, this.pos.z), knee = foot.clone(); knee.y += 0.38;
      this.ray.set(foot, wish); this.ray.far = 0.55; this.ray.firstHitOnly = true;
      const fb = this.ray.intersectObject(this.collider, false).length > 0;
      this.ray.set(knee, wish); const kb = fb && this.ray.intersectObject(this.collider, false).length > 0; this.ray.firstHitOnly = false;
      if (fb && !kb) this.pos.y += Math.min(0.45, dt * 4.5);
    }
    const steps = 4, h = dt / steps, R = 0.32, H = 1.8 - this.crouch * 0.5;
    const seg = new THREE.Line3(); const box = new THREE.Box3(); const tp = new THREE.Vector3(), cp = new THREE.Vector3();
    const bvh = (this.collider.geometry as THREE.BufferGeometry & { boundsTree: MeshBVH }).boundsTree;
    for (let i = 0; i < steps; i++) {
      this.vel.y -= 18 * h;
      this.pos.addScaledVector(this.vel, h);
      seg.start.set(this.pos.x, this.pos.y + R, this.pos.z); seg.end.set(this.pos.x, this.pos.y + H - R, this.pos.z);
      box.makeEmpty(); box.expandByPoint(seg.start); box.expandByPoint(seg.end); box.min.addScalar(-R); box.max.addScalar(R);
      bvh.shapecast({
        intersectsBounds: (b) => b.intersectsBox(box),
        intersectsTriangle: (tri) => {
          const dist = tri.closestPointToSegment(seg, tp, cp);
          if (dist < R) { const dir = cp.sub(tp).normalize(); const d = R - dist; seg.start.addScaledVector(dir, d); seg.end.addScaledVector(dir, d); }
        },
      });
      const np = new THREE.Vector3(seg.start.x, seg.start.y - R, seg.start.z);
      const delta = np.sub(this.pos);
      this.onGround = delta.y > Math.abs(h * this.vel.y * 0.25);
      const off = Math.max(0, delta.length() - 1e-5); delta.normalize().multiplyScalar(off); this.pos.add(delta);
      if (this.onGround) this.vel.y = Math.max(0, this.vel.y);
      else { const n = delta.clone().normalize(); this.vel.addScaledVector(n, -n.dot(this.vel)); }
    }
    if (!this.editor) {
      const L = this.limit;
      if (L) { const dx = this.pos.x - L.x, dz = this.pos.z - L.z, d = Math.hypot(dx, dz); if (d > L.r) { this.pos.x = L.x + (dx / d) * L.r; this.pos.z = L.z + (dz / d) * L.r; this.vel.x = this.vel.z = 0; this.boundT = this.t; } }
      const b = this.meta?.minimap;
      if (b) { const cx = Math.min(b.maxX - 1, Math.max(b.minX + 1, this.pos.x)), cz = Math.min(b.maxZ - 1, Math.max(b.minZ + 1, this.pos.z)); if (cx !== this.pos.x || cz !== this.pos.z) { this.pos.x = cx; this.pos.z = cz; this.boundT = this.t; } }
    }
    const zmin = this.meta ? this.meta.zRange[0] - 15 : -20;
    if (this.pos.y < zmin) { this.pos.fromArray(this.sc.spawn); this.vel.set(0, 0, 0); }
    void st;
  }
  hurtPlayer(dmg: number) {
    const absorbed = Math.min(this.armor, dmg * 0.66); this.armor -= absorbed; this.hp -= dmg - absorbed;
    this.lastDamage = this.t; this.dmgFlash = 1; sfx.hurt();
    if (this.hp <= 0) { this.hp = 0; this.died = true; this.finish(false); }
  }
  updateTargets(dt: number) {
    const ty = this.sc.type; const D = DIFF[this.sc.difficulty]; const eye = this.eye();
    for (const tg of this.targets) {
      if (tg.hitFlash && tg.hitFlash > 0) { tg.hitFlash -= dt * 6; const k = Math.max(0, tg.hitFlash) * 0.5; for (const mt of tg.root.userData.flash as THREE.MeshStandardMaterial[]) mt.emissive.setRGB(k, k, k); }
      if (!tg.alive && tg.kind === "bot" && this.respawns() && this.t - tg.deathT > 1.6) {
        tg.alive = true; tg.active = true; tg.root.visible = true; tg.hp = tg.maxHp; tg.root.children[0].rotation.x = 0;
        tg.root.position.copy(tg.base); tg.root.rotation.y = Math.atan2(this.pos.x - tg.base.x, this.pos.z - tg.base.z); tg.spawnAt = this.t; tg.seenAt = null; tg.firstHit = null; tg.acquired = null;
        continue;
      }
      if (!tg.alive) {
        if (tg.kind === "bot") { const k = Math.min(1, (this.t - tg.deathT) / 0.35); tg.root.children[0].rotation.x = -k * 1.45; if (this.t - tg.deathT > 1.4) tg.root.visible = false; }
        continue;
      }
      if (!tg.active) continue;
      if (tg.kind === "sphere") {
        if (ty === "tracking") {
          const s = getSettings().range.trackingSpeed * (this.sc.difficulty === "hard" ? 1.5 : this.sc.difficulty === "easy" ? 0.7 : 1);
          tg.phase += dt * s;
          tg.root.position.set(Math.sin(tg.phase * 0.9) * 6 + Math.sin(tg.phase * 2.3) * 1.5, 2.6 + Math.sin(tg.phase * 1.3) * 1.2, -6);
        } else if (ty === "flick" && this.t - tg.spawnAt > D.life) { tg.active = false; tg.root.visible = false; tg.alive = false; }
        continue;
      }
      const sp = tg.spec!;
      // movement
      if (sp.movement === "strafe" || ty === "strafe") {
        if (this.t > tg.nextTurn) { tg.dir = Math.random() < 0.5 ? -1 : 1; tg.nextTurn = this.t + 0.25 + Math.random() * 0.65; }
        const off = tg.root.position.clone().sub(tg.base).dot(tg.lateral);
        if (Math.abs(off) > sp.move_range) tg.dir = -Math.sign(off);
        const step = tg.speed * dt; const mv = tg.lateral.clone().multiplyScalar(tg.dir);
        if (!this.pathClear(tg.root.position, mv, step)) { tg.dir = -tg.dir; mv.negate(); }
        if (this.pathClear(tg.root.position, mv, step)) {
          tg.root.position.addScaledVector(mv, step);
          tg.root.position.y = this.groundY(tg.root.position.x, tg.root.position.y, tg.root.position.z); // follow ramps / steps
        }
      } else if (sp.movement === "peek" && ty !== "hold") {
        tg.phase += dt; const k = (Math.sin(tg.phase * 1.4) + 1) / 2;
        tg.root.position.copy(tg.base).addScaledVector(tg.lateral, (1 - k) * sp.move_range);
      }
      // visibility + reaction reference
      if (this.t > tg.losCheck) {
        tg.losCheck = this.t + 0.1;
        const head = tg.root.position.clone(); head.y += 1.6 * tg.root.children[0].scale.y;
        tg.los = this.hasLos(eye, head);
        if (tg.los && tg.seenAt === null) tg.seenAt = this.t;
      }
      // shooting back
      if ((this.sc.bots_shoot || sp.shoots) && !this.editor) {
        if (tg.los) {
          if (tg.acquired === null) tg.acquired = this.t;
          if (this.t - tg.acquired > D.react / 1000 && this.t - tg.lastShot > D.interval) {
            tg.lastShot = this.t; this.botShotSound(tg.root.position);
            const moving = Math.hypot(this.vel.x, this.vel.z) > 2.5 ? 0.6 : 1;
            if (Math.random() < D.hit * moving) this.hurtPlayer(Math.random() < 0.15 ? 160 : 40);
          }
        } else tg.acquired = null;
      }
      // body, head and aim all turn together toward the player (their only target), with a human turn rate
      const want = Math.atan2(this.pos.x - tg.root.position.x, this.pos.z - tg.root.position.z);
      let dy = want - tg.root.rotation.y; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
      tg.root.rotation.y += dy * Math.min(1, dt * 9);
      if (ty === "hold" && this.t > tg.hideAt) { tg.active = false; tg.root.visible = false; }
    }
    // mode spawners
    if (ty === "gridshot") { const act = this.targets.filter((t) => t.active).length; for (let i = act; i < getSettings().range.gridTargets; i++) this.spawnGrid(); this.targets = this.targets.filter((t) => t.active); }
    if (ty === "flick" && !this.targets.some((t) => t.active)) { if (this.nextSpawn <= 0) { this.targets = []; this.spawnSingle(); this.nextSpawn = 0.25; } else this.nextSpawn -= dt; }
    if (ty === "tracking") {
      const tg = this.targets[0];
      if (tg) {
        this.ray.set(eye, new THREE.Vector3(0, 0, -1).applyEuler(new THREE.Euler(this.pitch, this.yaw, 0, "YXZ"))); this.ray.far = 100;
        const on = this.ray.intersectObject(tg.root, false).length > 0;
        if (on) { this.onTarget += dt; this.score = Math.round(this.onTarget * 100); }
        (tg.root as THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>).material.emissiveIntensity = on ? 1 : 0.3;
      }
    }
    if (ty === "strafe" && !this.targets.some((t) => t.alive)) { if (this.nextSpawn <= 0) { this.nextSpawn = 999; void this.spawnStrafe().then(() => { this.nextSpawn = 0.4; }); this.targets = this.targets.filter((t) => t.root.visible); } else this.nextSpawn -= dt; }
    if (ty === "hold") {
      const maxAct = this.sc.difficulty === "hard" ? 2 : 1;
      const act = this.targets.filter((t) => t.active && t.alive).length;
      if (act < maxAct) {
        this.nextSpawn -= dt;
        if (this.nextSpawn <= 0) {
          const pool = this.targets.filter((t) => !t.active || !t.alive);
          const tg = pool[Math.floor(Math.random() * pool.length)];
          if (tg) {
            tg.alive = true; tg.active = true; tg.root.visible = true; tg.hp = tg.maxHp; tg.root.children[0].rotation.x = 0;
            tg.spawnAt = this.t; tg.seenAt = null; tg.hideAt = this.t + D.window; tg.acquired = null; tg.root.position.copy(tg.base);
          }
          this.nextSpawn = 0.4 + Math.random() * 1.0;
        }
      }
    }
    if (ty === "preaim" && !this.respawns() && this.targets.length && this.targets.every((t) => !t.alive)) { this.score += Math.round(Math.max(0, this.sc.duration - this.t) * 10); this.finish(true); }
    if (ty === "spike" && this.spikePos) {
      const allDead = this.targets.length > 0 && this.targets.every((t) => !t.alive);
      const near = this.pos.distanceTo(this.spikePos) < 2.2;
      this.message = allDead ? (near ? "defuse" : "goto_spike") : "";
      if (allDead && near && this.down("use")) {
        this.defuse += dt / 4;
        if (this.defuse >= 1) { this.defused = true; this.score += 500 + Math.round(Math.max(0, this.sc.duration - this.t) * 20); this.finish(true); }
      } else if (this.defuse > 0.5) this.defuse = 0.5; else if (this.defuse < 0.5) this.defuse = 0;
    }
  }
  /** Respawning dead bots (training setting) — modes with their own spawn logic manage themselves. */
  respawns(): boolean { return getSettings().range.respawnBots && this.sc.type === "preaim"; }
  finish(completed: boolean) {
    if (this.ended) return;
    this.ended = true; this.setStatus("ended");
    if (document.pointerLockElement === this.canvas) document.exitPointerLock();
    const ty = this.sc.type;
    const acc = ty === "tracking" ? (this.t > 0 ? (this.onTarget / this.t) * 100 : 0) : this.shots ? (this.hits / this.shots) * 100 : 0;
    let score = this.score;
    if (ty === "gridshot") score = Math.round(score * (0.6 + 0.4 * acc / 100));
    const r = this.reactions;
    this.cb.onEnd?.({
      score, shots: this.shots, hits: this.hits, headshots: this.heads, kills: this.kills, accuracy: Math.round(acc * 10) / 10,
      headshot_rate: this.hits ? Math.round((this.heads / this.hits) * 1000) / 10 : 0,
      avg_reaction_ms: r.length ? Math.round(r.reduce((a, b) => a + b, 0) / r.length) : null,
      duration_sec: Math.round(this.t * 10) / 10, died: this.died, completed, weapon: this.weapon.id,
    });
  }

  // ---------------- loop ----------------
  loop = () => {
    if (this.disposed) return;
    this.raf = requestAnimationFrame(this.loop);
    const now = performance.now(); const cap = getSettings().video.fpsCap;
    if (cap > 0 && now - this.lastFrame < 1000 / cap - 0.3) return;
    const dt = Math.min(0.05, (now - this.last) / 1000); this.last = now; this.lastFrame = now;
    this.fpsAcc += dt; this.fpsN += 1;
    if (this.fpsAcc >= 0.5) { this.fps = Math.round(this.fpsN / this.fpsAcc); this.fpsAcc = 0; this.fpsN = 0; this.adaptScale(); }
    if (this.status === "running" && !this.ended) {
      this.t += dt;
      this.physics(dt);
      if (this.firing && !this.editor) this.tryFire(false);
      if (this.reloadEnd > 0 && this.t >= this.reloadEnd) { this.ammo[this.weapon.id] = this.weapon.mag; this.reloadEnd = 0; }
      if (!this.editor) this.updateTargets(dt);
      if (this.regenPool > 0 && this.t - this.lastDamage > 3 && this.armor < 25) { const g = Math.min(dt * 5, this.regenPool, 25 - this.armor); this.armor += g; this.regenPool -= g; }
      if (!this.editor && this.t >= this.sc.duration) this.finish(this.sc.type !== "spike");
    } else if (this.status !== "running") for (const tg of this.targets) tg.mixer?.update(dt);
    this.camera.position.copy(this.eye());
    this.camera.rotation.set(this.pitch, this.yaw, 0, "YXZ");
    // viewmodel motion — procedural layer driven by real state (equip timer, reload progress, recoil, mouse, movement)
    this.vmKick *= Math.exp(-dt * 12); this.dmgFlash *= Math.exp(-dt * 4);
    const ease = (x: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, x)), 3);
    const w = this.weapon;
    const eq = 1 - ease((this.t - this.equipT) / Math.max(0.25, w.equip * 0.75));
    const rp = this.reloadEnd > this.t ? 1 - (this.reloadEnd - this.t) / w.reload : -1;
    const rel = rp >= 0 ? Math.sin(Math.min(1, rp) * Math.PI) : 0;
    const ip = this.t - this.inspectT; const insp = ip >= 0 && ip < 2.6 ? Math.sin((ip / 2.6) * Math.PI) : 0;
    const sp = this.t - this.slashT; const slash = sp >= 0 && sp < 0.38 ? Math.sin((sp / 0.38) * Math.PI) : 0;
    const clampM = (v: number) => Math.max(-40, Math.min(40, v));
    this.swayX += (clampM(this.mdx) * 0.0011 - this.swayX) * Math.min(1, dt * 9);
    this.swayY += (clampM(this.mdy) * 0.0011 - this.swayY) * Math.min(1, dt * 9); this.mdx = 0; this.mdy = 0;
    const spd = Math.hypot(this.vel.x, this.vel.z); const moving = spd > 1 && this.onGround;
    this.bobT += dt * (moving ? spd * 1.7 : 0); const bobA = moving ? Math.min(1, spd / 5.4) : 0;
    const kick = this.vmKick * (0.35 + Math.min(1.2, w.recoil.up * 0.8));
    this.vmRoot.position.set(Math.sin(this.bobT) * 0.007 * bobA - this.swayX * 0.05, -Math.abs(Math.cos(this.bobT)) * 0.006 * bobA - eq * 0.24 - rel * 0.045 + this.swayY * 0.04, kick * 0.035);
    this.vmRoot.rotation.set(kick * 0.045 - eq * 0.55 - rel * 0.32 + this.swayY * 0.5 - slash * 0.35, this.swayX * 0.6 + insp * 0.85 + slash * 0.9, rel * 0.5 + insp * 0.45 + slash * 0.6, "YXZ");
    if (this.rig) this.rig.ikTarget = rel > 0.12 || insp > 0.3 ? 0 : 1;
    const scoped = !!w.scoped && this.zoom() > 1;
    this.vmRoot.visible = getSettings().showViewmodel && !scoped;
    this.vmCam.updateMatrixWorld(true);
    this.rig?.update(dt);
    const fm = this.flash.material as THREE.MeshBasicMaterial; fm.opacity *= Math.exp(-dt * 45);
    if (this.rig) this.rig.muzzlePos(this.flash.position, this.vmCam.matrixWorld.clone().invert()); else this.flash.position.set(0.17, -0.12, -0.85);
    this.flash.visible = fm.opacity > 0.05 && !scoped && w.category !== "melee" && getSettings().video.effects;
    for (const l of this.tracers) { if (!l.visible) continue; const m = l.material as THREE.LineBasicMaterial; m.opacity *= Math.exp(-dt * 22); if (m.opacity < 0.03) l.visible = false; }
    this.renderer.clear();
    this.renderer.render(this.scene, this.camera);
    this.renderer.clearDepth();
    this.renderer.render(this.vmScene, this.vmCam);
    this.hudT -= dt;
    if (this.hudT <= 0) { this.hudT = 0.066; this.emitHud(); }
  };
  adaptScale() {
    const v = getSettings().video;
    const target = v.autoScale ? this.scale : Math.max(0.9, Math.min(1, v.renderScale));
    let s = target;
    if (v.autoScale && this.status === "running") {
      if (this.fps < 118 && s > 0.9) s = Math.max(0.9, s - 0.02);
      else if (this.fps > 135 && s < 1) s = Math.min(1, s + 0.02);
    }
    if (Math.abs(s - this.scale) > 0.001 || (!v.autoScale && s !== this.scale)) { this.scale = s; this.resize(); }
  }
  emitHud() {
    const w = this.weapon;
    const bloom = Math.min(1, Math.hypot(this.vel.x, this.vel.z) / 5 + (this.onGround ? 0 : 0.6) + (this.t - this.lastShotT < 0.3 ? Math.min(this.recoil, 6) / 10 : 0));
    this.cb.onHud?.({
      score: this.score, timeLeft: Math.max(0, this.sc.duration - this.t), kills: this.kills,
      botsLeft: this.targets.filter((t) => t.kind === "bot" && t.alive).length, shots: this.shots, hits: this.hits,
      ammo: this.ammo[w.id] ?? w.mag, mag: w.mag, weaponId: w.id, weaponName: w.name,
      reloading: this.reloadEnd > this.t ? 1 - (this.reloadEnd - this.t) / w.reload : -1, hp: Math.round(this.hp), armor: Math.round(this.armor),
      zoom: this.zoom(), scoped: !!w.scoped && this.zoom() > 1, defuse: this.defuse, spikeArmed: !!this.spikePos && !this.defused,
      fps: this.fps, scale: this.scale, slot: this.slot, bloom, message: this.t - this.boundT < 1.2 ? "bounds" : this.message, onTarget: this.onTarget, dmgFlash: this.dmgFlash,
    });
  }
  radar() {
    return {
      x: this.pos.x, z: this.pos.z, yaw: this.yaw,
      bots: this.targets.filter((t) => t.kind === "bot" && t.alive && t.active).map((t) => ({ x: t.root.position.x, z: t.root.position.z })),
      site: this.spikePos ? { x: this.spikePos.x, z: this.spikePos.z } : null, meta: this.meta, limit: this.limit,
    };
  }

  // ---------------- editor ----------------
  setupEditor() { this.setEditorData(this.sc); }
  async setEditorData(sc: ScenarioBase, selected = "") {
    this.sc = sc; this.selected = selected; this.setProps(sc.props ?? [], selected);
    for (const o of this.editorBots) this.scene.remove(o);
    this.editorBots = [];
    for (const b of sc.bots) {
      const tg = await this.makeBot(b); tg.root.userData.botId = b.id;
      if (b.id === selected) { const ring = new THREE.Mesh(new THREE.RingGeometry(0.45, 0.55, 24), new THREE.MeshBasicMaterial({ color: 0x38bdf8, side: THREE.DoubleSide })); ring.rotation.x = -Math.PI / 2; ring.position.y = 0.05; tg.root.add(ring); }
      this.editorBots.push(tg.root);
    }
    if (!this.spawnMarker) {
      const g = new THREE.Group(); const cone = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.8, 12), new THREE.MeshBasicMaterial({ color: 0x22c55e })); cone.rotation.x = -Math.PI / 2; cone.position.y = 0.4; g.add(cone);
      this.spawnMarker = g; this.scene.add(g);
    }
    this.spawnMarker.position.fromArray(sc.spawn); this.spawnMarker.rotation.y = sc.spawn_yaw;
    if (sc.site) {
      if (!this.siteMarker) { this.siteMarker = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.4, 16), new THREE.MeshBasicMaterial({ color: 0xff4655 })); this.scene.add(this.siteMarker); }
      this.siteMarker.position.fromArray(sc.site); this.siteMarker.position.y += 0.2;
    }
  }
  crosshairPoint(): THREE.Vector3 | null {
    if (!this.collider) return null;
    this.ray.set(this.eye(), new THREE.Vector3(0, 0, -1).applyEuler(new THREE.Euler(this.pitch, this.yaw, 0, "YXZ"))); this.ray.far = 400; this.ray.firstHitOnly = true;
    const h = this.ray.intersectObject(this.collider, false)[0]; this.ray.firstHitOnly = false;
    return h ? h.point : null;
  }
  editorKey(code: string) {
    const p = this.crosshairPoint(); const arr = p ? [p.x, p.y, p.z].map((v) => Math.round(v * 100) / 100) : null;
    const yaw = this.yaw;
    if (code === "Mouse0" && arr) this.cb.onEditorPick?.({ action: "place", point: arr, yaw });
    if (code === "KeyG" && arr) this.cb.onEditorPick?.({ action: "move", point: arr, yaw });
    if (code === "KeyK" && arr) this.cb.onEditorPick?.({ action: "site", point: arr, yaw });
    if (code === "KeyB" && arr) this.cb.onEditorPick?.({ action: "prop", point: arr, yaw: Math.round(yaw / (Math.PI / 4)) * (Math.PI / 4) });
    if (code === "Mouse2" && p) {
      // props: the box under the crosshair wins
      this.ray.set(this.eye(), new THREE.Vector3(0, 0, -1).applyEuler(new THREE.Euler(this.pitch, this.yaw, 0, "YXZ"))); this.ray.far = 400;
      const ph = this.ray.intersectObjects(this.propGroup.children, false)[0];
      if (ph && ph.distance <= p.distanceTo(this.eye()) + 0.05) { this.cb.onEditorPick?.({ action: "selectProp", point: arr!, yaw, propId: ph.object.userData.propId as string }); return; }
      let best = ""; let bd = 1.6;
      for (const o of this.editorBots) { const d = o.position.distanceTo(p); if (d < bd) { bd = d; best = o.userData.botId as string; } }
      if (best) this.cb.onEditorPick?.({ action: "select", point: arr!, yaw, botId: best });
    }
    if (code === "KeyX" || code === "Delete") this.cb.onEditorPick?.({ action: "delete", point: [0, 0, 0], yaw });
    if (code === "KeyP") {
      this.ray.set(this.eye(), new THREE.Vector3(0, -1, 0)); this.ray.far = 50; this.ray.firstHitOnly = true;
      const h = this.collider ? this.ray.intersectObject(this.collider, false)[0] : undefined; this.ray.firstHitOnly = false;
      const g = h ? h.point : this.pos;
      this.cb.onEditorPick?.({ action: "spawn", point: [g.x, g.y, g.z].map((v) => Math.round(v * 100) / 100), yaw });
    }
  }
}

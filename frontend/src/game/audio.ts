// Weapon / hit / kill / reload feedback (procedural Web Audio) + gameplay announcer clips.
// Weapons with user-supplied recordings (SAMPLES, public/sounds/<weapon>/) play those; every other gun keeps its own
// synthesized signature: body (low thump), crack (filtered noise) and tail, tuned per weapon character.
import { getSettings } from "@/lib/settings";

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let sfxBus: GainNode | null = null;
let noise: AudioBuffer | null = null;

function ac(): AudioContext {
  if (!ctx) {
    ctx = new AudioContext({ latencyHint: "interactive" });
    master = ctx.createGain(); master.connect(ctx.destination);
    sfxBus = ctx.createGain();
    const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -10; comp.ratio.value = 4;
    sfxBus.connect(comp).connect(master);
    noise = ctx.createBuffer(1, ctx.sampleRate * 0.6, ctx.sampleRate);
    const d = noise.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  const a = getSettings().audio;
  master!.gain.value = a.master; sfxBus!.gain.value = a.sfx;
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

function out(c: AudioContext, gain: number, pan = 0): GainNode {
  const g = c.createGain(); g.gain.value = gain;
  if (pan) { const p = c.createStereoPanner(); p.pan.value = Math.max(-1, Math.min(1, pan)); g.connect(p).connect(sfxBus!); }
  else g.connect(sfxBus!);
  return g;
}

function burst(c: AudioContext, dest: AudioNode, dur: number, freq: number, gain: number, type: BiquadFilterType = "lowpass", q = 0.7, delay = 0) {
  const t = c.currentTime + delay;
  const src = c.createBufferSource(); src.buffer = noise; src.playbackRate.value = 0.9 + Math.random() * 0.2;
  const f = c.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
  const g = c.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(gain, t + 0.003); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f).connect(g).connect(dest); src.start(t); src.stop(t + dur + 0.02);
}

function tone(c: AudioContext, dest: AudioNode, freq: number, dur: number, gain: number, type: OscillatorType = "sine", endFreq?: number, delay = 0) {
  const t = c.currentTime + delay;
  const o = c.createOscillator(); o.type = type; o.frequency.setValueAtTime(freq, t);
  if (endFreq) o.frequency.exponentialRampToValueAtTime(endFreq, t + dur);
  const g = c.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(gain, t + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(dest); o.start(t); o.stop(t + dur + 0.02);
}

/** body: thump Hz / length, crack: noise centre Hz, tail: noise length, level */
interface GunVoice { body: number; bodyLen: number; crack: number; crackLen: number; tail: number; level: number; mech?: number }
const VOICE: Record<string, GunVoice> = {
  classic: { body: 190, bodyLen: 0.06, crack: 3600, crackLen: 0.06, tail: 0.12, level: 0.55 },
  shorty: { body: 85, bodyLen: 0.16, crack: 1500, crackLen: 0.14, tail: 0.3, level: 0.9 },
  frenzy: { body: 210, bodyLen: 0.05, crack: 4200, crackLen: 0.05, tail: 0.1, level: 0.5 },
  ghost: { body: 160, bodyLen: 0.05, crack: 2400, crackLen: 0.04, tail: 0.08, level: 0.38, mech: 2600 },
  sheriff: { body: 95, bodyLen: 0.14, crack: 2200, crackLen: 0.1, tail: 0.32, level: 1 },
  stinger: { body: 230, bodyLen: 0.045, crack: 4600, crackLen: 0.045, tail: 0.09, level: 0.45 },
  spectre: { body: 170, bodyLen: 0.05, crack: 2600, crackLen: 0.05, tail: 0.1, level: 0.4, mech: 3000 },
  bucky: { body: 70, bodyLen: 0.2, crack: 1300, crackLen: 0.16, tail: 0.38, level: 1, mech: 900 },
  judge: { body: 80, bodyLen: 0.16, crack: 1500, crackLen: 0.14, tail: 0.3, level: 0.9 },
  bulldog: { body: 135, bodyLen: 0.08, crack: 3000, crackLen: 0.07, tail: 0.18, level: 0.75 },
  guardian: { body: 110, bodyLen: 0.11, crack: 2700, crackLen: 0.09, tail: 0.28, level: 0.9 },
  phantom: { body: 150, bodyLen: 0.06, crack: 2200, crackLen: 0.05, tail: 0.12, level: 0.55, mech: 3400 },
  vandal: { body: 120, bodyLen: 0.09, crack: 3200, crackLen: 0.08, tail: 0.22, level: 0.85 },
  marshal: { body: 100, bodyLen: 0.13, crack: 3400, crackLen: 0.1, tail: 0.35, level: 0.95, mech: 1200 },
  outlaw: { body: 80, bodyLen: 0.16, crack: 3000, crackLen: 0.12, tail: 0.42, level: 1 },
  operator: { body: 60, bodyLen: 0.24, crack: 2600, crackLen: 0.16, tail: 0.6, level: 1.15, mech: 800 },
  ares: { body: 125, bodyLen: 0.07, crack: 2600, crackLen: 0.06, tail: 0.15, level: 0.6 },
  odin: { body: 105, bodyLen: 0.08, crack: 2300, crackLen: 0.07, tail: 0.17, level: 0.7 },
};

/**
 * Sound event categories (one entry point each, independent of any match / round announcer):
 *  WeaponFire · WeaponReload · WeaponEquip · HitConfirm · Headshot · KillConfirm · WeaponSkinAudio
 * WeaponSkinAudio: per-skin fire voice overrides. The archive ships no skin sound files, so this table is empty and
 * every skin falls back to its weapon's default voice — nothing is faked.
 */
export type SoundEvent = "WeaponFire" | "WeaponReload" | "WeaponEquip" | "HitConfirm" | "Headshot" | "KillConfirm" | "WeaponSkinAudio";
const SKIN_VOICE: Record<string, Partial<GunVoice>> = {};
export const skinHasAudio = (skinId: string) => skinId in SKIN_VOICE;

// ---- recorded samples (user-supplied files in public/sounds/<weapon>/) — preferred over the procedural voices ----
interface SampleSet { fire?: string; reload?: string; equip?: string; hit?: string }
const SAMPLES: Record<string, SampleSet> = {
  vandal: { fire: "/sounds/vandal/tap.mp3", reload: "/sounds/vandal/reload.mp3" },
  phantom: { fire: "/sounds/phantom/tap.mp3", reload: "/sounds/phantom/reload.mp3" },
  guardian: { fire: "/sounds/guardian/tap.mp3" },
  operator: { fire: "/sounds/operator/tap.mp3", reload: "/sounds/operator/reload.mp3" },
  knife: { fire: "/sounds/knife/swing.mp3", hit: "/sounds/knife/stab.mp3", equip: "/sounds/knife/equip.mp3" },
};
type Decoded = { buf: AudioBuffer; norm: number };
const decoded = new Map<string, Promise<Decoded | null>>();
const ready = new Map<string, Decoded>();
function sample(url: string): Promise<Decoded | null> {
  let p = decoded.get(url);
  if (!p) {
    p = fetch(url).then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(String(r.status))))).then((a) => ac().decodeAudioData(a)).then((buf) => {
      let peak = 0; for (let c = 0; c < buf.numberOfChannels; c++) { const d = buf.getChannelData(c); for (let i = 0; i < d.length; i += 4) peak = Math.max(peak, Math.abs(d[i])); }
      const v = { buf, norm: peak > 0 ? Math.min(12, 0.32 / peak) : 1 }; ready.set(url, v); return v; // loudness-match quiet files
    }).catch(() => null);
    decoded.set(url, p);
  }
  return p;
}
/** Decode a weapon's samples ahead of time (called on equip) so the first shot has no latency. */
// Kill banner sequence (always on, every weapon): 1st, 2nd, 3rd, 4th kill, then ACE — restarts after the ace / on restart.
const KILL_FILES = ["/sounds/kill/1.mp3", "/sounds/kill/2.mp3", "/sounds/kill/3.mp3", "/sounds/kill/4.mp3", "/sounds/kill/5.mp3"];
const HEADSHOT_FILE = "/sounds/hit/headshot.mp3";
let killStreak = 0;
export function resetKillStreak() { killStreak = 0; }
/** Decode the always-used feedback sounds up front (first shot / first kill without latency). */
export function preloadFeedback() { for (const f of [...KILL_FILES, HEADSHOT_FILE]) void sample(f); }
/** debug: which sample URLs are decoded */
export const decodedSamples = () => [...ready.keys()];
export function preloadWeapon(id: string) { const s = SAMPLES[id]; if (!s) return; for (const u of [s.fire, s.reload, s.equip, s.hit]) if (u) void sample(u); }
let fireVoice: { src: AudioBufferSourceNode; g: GainNode } | null = null;
let reloadVoice: { src: AudioBufferSourceNode; g: GainNode } | null = null;
function playBuf(d: Decoded, gain: number, rate = 1): { src: AudioBufferSourceNode; g: GainNode } {
  const c = ac(); const src = c.createBufferSource(); src.buffer = d.buf; src.playbackRate.value = rate;
  const g = c.createGain(); g.gain.value = gain * d.norm; src.connect(g).connect(sfxBus!); src.start(); return { src, g };
}
function fadeStop(v: { src: AudioBufferSourceNode; g: GainNode } | null, t = 0.03) {
  if (!v || !ctx) return; const n = ctx.currentTime;
  v.g.gain.cancelScheduledValues(n); v.g.gain.setValueAtTime(v.g.gain.value, n); v.g.gain.linearRampToValueAtTime(0, n + t);
  try { v.src.stop(n + t + 0.01); } catch { /* already stopped */ }
}

// one voice per frame per weapon: auto-fire can never stack duplicate shots in the same tick
let lastFire = 0;

export const sfx = {
  /** WeaponFire (+ WeaponSkinAudio override when the selected skin has its own voice) */
  fire(weaponId: string, skinId = "default") {
    const s = getSettings().audio.fireSound; if (s === "off") return;
    const c = ac(); if (c.currentTime - lastFire < 0.012) return; lastFire = c.currentTime;
    const smp = SAMPLES[weaponId]?.fire; const d = smp ? ready.get(smp) : undefined;
    if (smp && !d) void sample(smp);
    if (d && !SKIN_VOICE[skinId]) {
      // each shot = full recorded shot; the previous shot's tail is cut short so auto-fire stays tight, the last tail rings out
      fadeStop(fireVoice, 0.045);
      fireVoice = playBuf(d, s === "soft" ? 0.45 : 1, 0.985 + Math.random() * 0.03);
      return;
    }
    const v = { ...(VOICE[weaponId] ?? VOICE.classic), ...(SKIN_VOICE[skinId] ?? {}) }; const lv = v.level * (s === "soft" ? 0.45 : 1);
    const dst = out(c, 0.9);
    tone(c, dst, v.body * (0.97 + Math.random() * 0.06), v.bodyLen, 0.5 * lv, "triangle", v.body * 0.4);
    burst(c, dst, v.crackLen, v.crack, 0.55 * lv, "bandpass", 0.9);
    burst(c, dst, v.tail, v.crack * 0.35, 0.22 * lv, "lowpass", 0.5, 0.01);
    if (v.mech) burst(c, dst, 0.03, v.mech, 0.12 * lv, "highpass", 1, 0.035);
  },
  /** knife: swing on a miss, stab when the blade connects */
  knife(hit = false) {
    const u = hit ? SAMPLES.knife.hit! : SAMPLES.knife.fire!; const d0 = ready.get(u);
    if (d0) { playBuf(d0, 0.9, 0.98 + Math.random() * 0.04); return; }
    void sample(u); const c = ac(); const d = out(c, 0.8); burst(c, d, 0.12, 5200, 0.22, "bandpass", 2);
  },
  equip(category: string, weaponId = "") {
    const eqf = SAMPLES[weaponId]?.equip; const e = eqf ? ready.get(eqf) : undefined;
    if (e) { playBuf(e, 0.8); return; }
    const c = ac(); const d = out(c, 0.6);
    if (category === "melee") { burst(c, d, 0.18, 6500, 0.12, "highpass", 1); return; }
    burst(c, d, 0.05, 2400, 0.16, "bandpass", 3); burst(c, d, 0.04, 1500, 0.14, "bandpass", 3, 0.16);
  },
  /** Recorded full reload for the weapon (stretched only by start offset, never pitch-shifted). false = no file -> use cues. */
  reloadSample(weaponId: string): boolean {
    const smp = SAMPLES[weaponId]?.reload; if (!smp) return false;
    const d = ready.get(smp); if (!d) { void sample(smp); return false; }
    fadeStop(reloadVoice); reloadVoice = playBuf(d, 0.9); return true;
  },
  stopReload() { fadeStop(reloadVoice, 0.06); reloadVoice = null; },
  reload(kind: "out" | "in" | "charge", category: string) {
    const c = ac(); const d = out(c, 0.7);
    if (kind === "out") { burst(c, d, 0.06, 1800, 0.18, "bandpass", 4); tone(c, d, 420, 0.05, 0.06, "square"); }
    else if (kind === "in") { burst(c, d, 0.05, 1200, 0.26, "bandpass", 5); tone(c, d, 260, 0.06, 0.1, "square", 180); }
    else { const hi = category === "sidearm" ? 2600 : 2000; burst(c, d, 0.035, hi, 0.2, "bandpass", 6); burst(c, d, 0.04, hi * 0.8, 0.2, "bandpass", 6, 0.09); }
  },
  empty() { const c = ac(); tone(c, out(c, 0.6), 1600, 0.025, 0.12, "square"); },
  /** body hit: short tick · head: bright two-tone "dink" (always distinct from body) */
  hit(zone: "head" | "body") {
    const a = getSettings().audio; const c = ac(); const d = out(c, 0.75);
    if (zone === "head") { const h = ready.get(HEADSHOT_FILE); if (h) playBuf(h, 0.8); else { void sample(HEADSHOT_FILE); tone(c, d, 2500, 0.16, 0.24); tone(c, d, 3700, 0.1, 0.12); } return; }
    if (a.hitSound === "off") return;
    if (a.hitSound === "dink") tone(c, d, 1800, 0.08, 0.18);
    else if (a.hitSound === "pop") tone(c, d, 620, 0.06, 0.28, "square", 300);
    else tone(c, d, 1150, 0.035, 0.16, "square");
  },
  /** KillConfirm — kill banner sequence 1st..4th, ACE (fixed, not a setting). Called exactly once per death. */
  kill(_head = false) {
    const f = KILL_FILES[killStreak % KILL_FILES.length]; killStreak += 1;
    const d = ready.get(f);
    if (d) { playBuf(d, 0.85); return; }
    void sample(f); const c = ac(); const o = out(c, 0.8); tone(c, o, 880, 0.1, 0.2); tone(c, o, 1320, 0.16, 0.2, "sine", undefined, 0.07);
  },
  /** enemy fire: distance attenuation + stereo pan from the bot's direction */
  botShot(dist: number, pan: number) {
    const c = ac(); const g = Math.max(0.05, Math.min(0.6, 6 / (dist + 4)));
    const d = out(c, g, pan * 0.85);
    burst(c, d, 0.1 + Math.min(0.2, dist / 120), Math.max(900, 3000 - dist * 35), 0.5, "lowpass");
    tone(c, d, 120, 0.07, 0.25, "triangle", 60);
  },
  hurt() { const c = ac(); tone(c, out(c, 0.8), 160, 0.15, 0.3, "sawtooth", 80); },
  ui() { const c = ac(); tone(c, out(c, 0.5), 1000, 0.03, 0.08); },
};

// Match / round announcer lines (victory, defeat, spike planted / defuse, round start) are intentionally not part of
// this trainer: there is no trigger for them anywhere and the clip files were removed from public/ka/announcer.

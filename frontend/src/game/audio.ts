// Weapon / hit / kill / reload feedback (procedural Web Audio) + gameplay announcer clips.
// The project ships no weapon sound files (the archive only provided announcer lines), so every gun gets its
// own synthesized signature: body (low thump), crack (filtered noise) and tail, tuned per weapon character.
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

// one voice per frame per weapon: auto-fire can never stack duplicate shots in the same tick
let lastFire = 0;

export const sfx = {
  /** WeaponFire (+ WeaponSkinAudio override when the selected skin has its own voice) */
  fire(weaponId: string, skinId = "default") {
    const s = getSettings().audio.fireSound; if (s === "off") return;
    const c = ac(); if (c.currentTime - lastFire < 0.012) return; lastFire = c.currentTime;
    const v = { ...(VOICE[weaponId] ?? VOICE.classic), ...(SKIN_VOICE[skinId] ?? {}) }; const lv = v.level * (s === "soft" ? 0.45 : 1);
    const dst = out(c, 0.9);
    tone(c, dst, v.body * (0.97 + Math.random() * 0.06), v.bodyLen, 0.5 * lv, "triangle", v.body * 0.4);
    burst(c, dst, v.crackLen, v.crack, 0.55 * lv, "bandpass", 0.9);
    burst(c, dst, v.tail, v.crack * 0.35, 0.22 * lv, "lowpass", 0.5, 0.01);
    if (v.mech) burst(c, dst, 0.03, v.mech, 0.12 * lv, "highpass", 1, 0.035);
  },
  knife() { const c = ac(); const d = out(c, 0.8); burst(c, d, 0.12, 5200, 0.22, "bandpass", 2); },
  equip(category: string) {
    const c = ac(); const d = out(c, 0.6);
    if (category === "melee") { burst(c, d, 0.18, 6500, 0.12, "highpass", 1); return; }
    burst(c, d, 0.05, 2400, 0.16, "bandpass", 3); burst(c, d, 0.04, 1500, 0.14, "bandpass", 3, 0.16);
  },
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
    if (zone === "head") { if (!a.headshotDink && a.hitSound === "off") return; tone(c, d, 2500, 0.16, 0.24); tone(c, d, 3700, 0.1, 0.12); return; }
    if (a.hitSound === "off") return;
    if (a.hitSound === "dink") tone(c, d, 1800, 0.08, 0.18);
    else if (a.hitSound === "pop") tone(c, d, 620, 0.06, 0.28, "square", 300);
    else tone(c, d, 1150, 0.035, 0.16, "square");
  },
  /** kill confirm — separate from hits; headshot kills get a higher final note */
  kill(head = false) {
    const k = getSettings().audio.killSound; if (k === "off") return; const c = ac(); const d = out(c, 0.8);
    if (k === "pulse") { tone(c, d, 220, 0.22, 0.3, "sawtooth", 110); return; }
    tone(c, d, 880, 0.1, 0.2); tone(c, d, head ? 1760 : 1320, 0.16, 0.2, "sine", undefined, 0.07);
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

// Crosshair model + Valorant crosshair profile code import/export.
export interface CrosshairLines {
  show: boolean;
  opacity: number;
  length: number;
  thickness: number;
  offset: number;
  movementError: boolean;
  firingError: boolean;
}

export interface CrosshairStyle {
  color: string; // #RRGGBB
  outlines: boolean;
  outlineThickness: number;
  outlineOpacity: number;
  centerDot: boolean;
  dotThickness: number;
  dotOpacity: number;
  inner: CrosshairLines;
  outer: CrosshairLines;
}

export interface SniperStyle {
  centerDot: boolean;
  color: string;
  thickness: number;
  opacity: number;
}

export interface CrosshairSettings {
  primary: CrosshairStyle;
  adsUsePrimary: boolean;
  ads: CrosshairStyle;
  sniper: SniperStyle;
}

export const VAL_COLORS = ["#FFFFFF", "#00FF00", "#7FFF00", "#DFFF00", "#FFFF00", "#00FFFF", "#FF00FF", "#FF0000"];

export const DEFAULT_STYLE: CrosshairStyle = {
  color: "#FFFFFF", outlines: true, outlineThickness: 1, outlineOpacity: 0.5, centerDot: false, dotThickness: 2, dotOpacity: 1,
  inner: { show: true, opacity: 0.8, length: 6, thickness: 2, offset: 3, movementError: true, firingError: true },
  outer: { show: true, opacity: 0.35, length: 2, thickness: 2, offset: 10, movementError: true, firingError: true },
};

export const DEFAULT_SNIPER: SniperStyle = { centerDot: true, color: "#FFFFFF", thickness: 1, opacity: 0.75 };

export const DEFAULT_CROSSHAIR: CrosshairSettings = {
  primary: structuredClone(DEFAULT_STYLE),
  adsUsePrimary: true,
  ads: structuredClone(DEFAULT_STYLE),
  sniper: structuredClone(DEFAULT_SNIPER),
};

const style = (p: Partial<CrosshairStyle> & { inner?: Partial<CrosshairLines>; outer?: Partial<CrosshairLines> }): CrosshairStyle => ({
  ...structuredClone(DEFAULT_STYLE), ...p,
  inner: { ...DEFAULT_STYLE.inner, ...(p.inner ?? {}) },
  outer: { ...DEFAULT_STYLE.outer, ...(p.outer ?? {}) },
});

export const PRESETS: { id: string; name: string; style: CrosshairStyle }[] = [
  { id: "default", name: "Valorant Default", style: style({}) },
  { id: "cyan-small", name: "Cyan Small", style: style({ color: "#00FFFF", outlines: false, inner: { length: 4, offset: 2, opacity: 1, firingError: false }, outer: { show: false } }) },
  { id: "dot", name: "Dot", style: style({ color: "#FFFF00", centerDot: true, dotThickness: 3, inner: { show: false }, outer: { show: false } }) },
  { id: "plus", name: "Pro Plus", style: style({ color: "#00FF00", outlines: true, outlineOpacity: 1, inner: { length: 3, thickness: 2, offset: 2, opacity: 1, movementError: false, firingError: false }, outer: { show: false } }) },
  { id: "red-gap", name: "Red Gap", style: style({ color: "#FF4655", outlines: true, outlineOpacity: 0.8, centerDot: true, dotThickness: 2, inner: { length: 5, thickness: 1, offset: 4, opacity: 1 }, outer: { show: false } }) },
  { id: "tiny", name: "Tiny Cross", style: style({ color: "#FFFFFF", outlines: true, outlineOpacity: 1, inner: { length: 2, thickness: 1, offset: 1, opacity: 1, firingError: false, movementError: false }, outer: { show: false } }) },
];

// ---------------- Valorant code ----------------
const fmt = (n: number) => String(Math.round(n * 1000) / 1000);
const hex8 = (c: string, alpha = 1) => c.replace("#", "").toUpperCase().padEnd(6, "F").slice(0, 6) + Math.round(alpha * 255).toString(16).padStart(2, "0").toUpperCase();

function encodeStyle(s: CrosshairStyle): string[] {
  const d = DEFAULT_STYLE; const out: string[] = [];
  const push = (k: string, v: string) => out.push(k, v);
  const idx = VAL_COLORS.indexOf(s.color.toUpperCase());
  if (idx > 0) push("c", String(idx));
  else if (idx < 0) { push("c", "8"); push("u", hex8(s.color)); }
  if (s.outlines !== d.outlines) push("h", s.outlines ? "1" : "0");
  if (s.outlineThickness !== d.outlineThickness) push("t", fmt(s.outlineThickness));
  if (s.outlineOpacity !== d.outlineOpacity) push("o", fmt(s.outlineOpacity));
  if (s.centerDot !== d.centerDot) push("d", s.centerDot ? "1" : "0");
  if (s.dotThickness !== d.dotThickness) push("z", fmt(s.dotThickness));
  if (s.dotOpacity !== d.dotOpacity) push("a", fmt(s.dotOpacity));
  (["inner", "outer"] as const).forEach((key, i) => {
    const L = s[key]; const DL = d[key]; const p = String(i);
    if (L.show !== DL.show) push(p + "b", L.show ? "1" : "0");
    if (L.thickness !== DL.thickness) push(p + "t", fmt(L.thickness));
    if (L.length !== DL.length) push(p + "l", fmt(L.length));
    if (L.offset !== DL.offset) push(p + "o", fmt(L.offset));
    if (L.opacity !== DL.opacity) push(p + "a", fmt(L.opacity));
    if (L.movementError !== DL.movementError) push(p + "m", L.movementError ? "1" : "0");
    if (L.firingError !== DL.firingError) push(p + "f", L.firingError ? "1" : "0");
  });
  return out;
}

export function encodeCrosshair(c: CrosshairSettings): string {
  const parts: string[] = ["0", "P", ...encodeStyle(c.primary)];
  if (!c.adsUsePrimary) parts.push("A", ...encodeStyle(c.ads));
  const sn = c.sniper; const ds = DEFAULT_SNIPER; const s: string[] = [];
  const sIdx = VAL_COLORS.indexOf(sn.color.toUpperCase());
  if (sIdx > 0) s.push("c", String(sIdx));
  else if (sIdx < 0) s.push("c", "8", "t", hex8(sn.color));
  if (sn.centerDot !== ds.centerDot) s.push("d", sn.centerDot ? "1" : "0");
  if (sn.thickness !== ds.thickness) s.push("s", fmt(sn.thickness));
  if (sn.opacity !== ds.opacity) s.push("o", fmt(sn.opacity));
  if (s.length) parts.push("S", ...s);
  return parts.join(";");
}

function applyKV(s: CrosshairStyle, k: string, v: string, customColor: { c?: string }) {
  const num = Number(v); const on = v !== "0";
  const lineKey = k[0] === "0" ? "inner" : k[0] === "1" ? "outer" : null;
  if (lineKey && k.length === 2) {
    const L = s[lineKey];
    switch (k[1]) {
      case "b": L.show = on; break;
      case "t": L.thickness = num; break;
      case "l": L.length = num; break;
      case "o": L.offset = num; break;
      case "a": L.opacity = num; break;
      case "m": L.movementError = on; break;
      case "f": L.firingError = on; break;
    }
    return;
  }
  switch (k) {
    case "c": if (num >= 0 && num < 8) s.color = VAL_COLORS[num]; break;
    case "u": customColor.c = "#" + v.slice(0, 6); break;
    case "h": s.outlines = on; break;
    case "t": s.outlineThickness = num; break;
    case "o": s.outlineOpacity = num; break;
    case "d": s.centerDot = on; break;
    case "z": s.dotThickness = num; break;
    case "a": s.dotOpacity = num; break;
  }
}

/** Parse a Valorant crosshair profile code. Throws on obviously invalid input. */
export function decodeCrosshair(code: string): CrosshairSettings {
  const tokens = code.trim().split(";").map((t) => t.trim()).filter((t) => t.length > 0);
  if (tokens.length < 2 || tokens[0] !== "0") throw new Error("invalid code");
  const res: CrosshairSettings = structuredClone(DEFAULT_CROSSHAIR);
  let section: "P" | "A" | "S" | null = null; let sawA = false;
  const cc: Record<string, { c?: string }> = { P: {}, A: {}, S: {} };
  let i = 1;
  while (i < tokens.length) {
    const t = tokens[i];
    if (t === "P" || t === "A" || t === "S") { section = t; if (t === "A") sawA = true; i += 1; continue; }
    const v = tokens[i + 1];
    if (v === undefined) break;
    if (section === "P") applyKV(res.primary, t, v, cc.P);
    else if (section === "A") applyKV(res.ads, t, v, cc.A);
    else if (section === "S") {
      if (t === "c" && Number(v) < 8) res.sniper.color = VAL_COLORS[Number(v)];
      else if (t === "t") cc.S.c = "#" + v.slice(0, 6);
      else if (t === "d") res.sniper.centerDot = v !== "0";
      else if (t === "s") res.sniper.thickness = Number(v);
      else if (t === "o") res.sniper.opacity = Number(v);
    }
    i += 2;
  }
  if (cc.P.c) res.primary.color = cc.P.c;
  if (cc.A.c) res.ads.color = cc.A.c;
  if (cc.S.c) res.sniper.color = cc.S.c;
  res.adsUsePrimary = !sawA;
  if (!sawA) res.ads = structuredClone(res.primary);
  return res;
}

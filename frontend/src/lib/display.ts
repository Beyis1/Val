import type { DisplayMode } from "@/lib/settings";

const COMMON: [number, number][] = [[3840, 2160], [2560, 1440], [2560, 1080], [1920, 1080], [1680, 1050], [1600, 900], [1440, 900], [1366, 768], [1280, 1024], [1280, 720], [1024, 768]];

/** Physical screen size in device pixels (what the monitor actually supports right now). */
export function screenPixels(): [number, number] {
  const dpr = window.devicePixelRatio || 1;
  return [Math.round(window.screen.width * dpr), Math.round(window.screen.height * dpr)];
}

/** Render resolutions this screen can show: native + common modes that fit inside it. */
export function listResolutions(): string[] {
  const [w, h] = screenPixels();
  const list = COMMON.filter(([a, b]) => a <= w && b <= h).map(([a, b]) => `${a}x${b}`);
  const native = `${w}x${h}`;
  return ["native", ...(list.includes(native) ? list : [native, ...list])];
}

/** Safe parse: unknown / unsupported / oversized values fall back to native (null). */
export function parseResolution(r: string): [number, number] | null {
  const m = /^(\d{3,5})x(\d{3,5})$/.exec(r);
  if (!m) return null;
  const [w, h] = [Number(m[1]), Number(m[2])]; const [sw, sh] = screenPixels();
  if (w < 640 || h < 360 || w > sw * 1.01 || h > sh * 1.01) return null;
  return [w, h];
}

/**
 * Browsers cannot change the monitor mode. "Fullscreen" = Fullscreen API + keyboard lock (Esc/Ctrl+W captured),
 * "borderless" = Fullscreen API without keyboard lock, "windowed" = stays in the browser window.
 */
export async function enterDisplayMode(el: HTMLElement | null, mode: DisplayMode) {
  if (!el || mode === "windowed") { if (document.fullscreenElement) await document.exitFullscreen().catch(() => undefined); return; }
  if (!document.fullscreenElement) await el.requestFullscreen({ navigationUI: "hide" }).catch(() => undefined);
  const kb = (navigator as Navigator & { keyboard?: { lock: (k?: string[]) => Promise<void>; unlock: () => void } }).keyboard;
  if (mode === "fullscreen") await kb?.lock().catch(() => undefined); else kb?.unlock();
}

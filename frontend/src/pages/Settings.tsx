import { useEffect, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { ACTIONS, DEFAULT_KEYBINDS, cmPer360, keyLabel, resetSettings, updateSettings, useSettings, type ActionId, type AppSettings } from "@/lib/settings";
import { PRESETS, VAL_COLORS, decodeCrosshair, encodeCrosshair, type CrosshairStyle } from "@/game/crosshair";
import { CrosshairView } from "@/components/CrosshairView";
import { useL } from "@/lib/i18n";
import { sfx } from "@/game/audio";
import { listResolutions, screenPixels } from "@/lib/display";

type Tab = "general" | "controls" | "crosshair" | "video" | "audio" | "range";
const ACTION_LABEL: Record<ActionId, [string, string]> = {
  forward: ["İleri", "Forward"], back: ["Geri", "Back"], left: ["Sol", "Left"], right: ["Sağ", "Right"], jump: ["Zıpla", "Jump"], crouch: ["Eğil", "Crouch"],
  walk: ["Yürü", "Walk"], use: ["Kullan / İmha", "Use / Defuse"], reload: ["Şarjör değiştir", "Reload"], primary: ["Ana silah", "Primary"], secondary: ["Tabanca", "Sidearm"],
  melee: ["Bıçak", "Melee"], buy: ["Market", "Buy menu"], scoreboard: ["TAB menü", "Scoreboard"], fire: ["Ateş", "Fire"], ads: ["Nişan al", "Aim down sights"], inspect: ["Silahı incele", "Inspect weapon"],
};

function Num({ v, set, min, max, step, tid }: { v: number; set: (n: number) => void; min: number; max: number; step: number; tid: string }) {
  return (
    <div className="flex items-center gap-3">
      <input data-testid={`${tid}-slider`} type="range" min={min} max={max} step={step} value={v} onChange={(e) => set(Number(e.target.value))} className="w-48 accent-[#FF4655]" />
      <input data-testid={`${tid}-input`} type="number" min={min} max={max} step={step} value={v} onChange={(e) => set(Math.min(max, Math.max(min, Number(e.target.value) || 0)))} className="num w-24 border border-line bg-panel2 px-2 py-1 text-sky" />
    </div>
  );
}
function Toggle({ v, set, tid }: { v: boolean; set: (b: boolean) => void; tid: string }) {
  return <button data-testid={tid} onClick={() => set(!v)} className={`h-6 w-11 border transition-colors ${v ? "border-val bg-val/70" : "border-line bg-panel2"}`}><span className={`block h-4 w-4 bg-white transition-transform ${v ? "translate-x-6" : "translate-x-1"}`} /></button>;
}
function Choice<T extends string | number>({ v, set, opts, tid }: { v: T; set: (x: T) => void; opts: [T, string][]; tid: string }) {
  return <div className="flex flex-wrap gap-1">{opts.map(([o, l]) => <button key={String(o)} data-testid={`${tid}-${o}`} onClick={() => set(o)} className={`border px-3 py-1 text-xs uppercase ${v === o ? "border-val bg-val/20" : "border-line text-dim hover:text-white"}`}>{l}</button>)}</div>;
}

export default function Settings() {
  const L = useL(); const st = useSettings();
  const [tab, setTab] = useState<Tab>("general"); const [q, setQ] = useState(""); const [chTarget, setChTarget] = useState<"primary" | "ads">("primary");
  const [listen, setListen] = useState<{ a: ActionId; i: 0 | 1 } | null>(null); const [code, setCode] = useState(""); const [zoom, setZoom] = useState(3);
  const up = (f: (d: AppSettings) => void) => updateSettings(f);
  useEffect(() => {
    if (!listen) return;
    const set = (c: string) => { up((d) => { d.keybinds[listen.a][listen.i] = c === "Escape" ? "" : c; }); setListen(null); };
    const k = (e: KeyboardEvent) => { e.preventDefault(); set(e.code); };
    const m = (e: MouseEvent) => { e.preventDefault(); set("Mouse" + e.button); };
    const w = (e: WheelEvent) => set(e.deltaY > 0 ? "WheelDown" : "WheelUp");
    window.addEventListener("keydown", k); window.addEventListener("mousedown", m); window.addEventListener("wheel", w);
    return () => { window.removeEventListener("keydown", k); window.removeEventListener("mousedown", m); window.removeEventListener("wheel", w); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listen]);
  const chKey = chTarget === "ads" && !st.crosshair.adsUsePrimary ? "ads" : "primary";
  const cs: CrosshairStyle = st.crosshair[chKey];
  const setCs = (f: (s: CrosshairStyle) => void) => up((d) => { f(d.crosshair[chKey]); if (chKey === "primary" && d.crosshair.adsUsePrimary) d.crosshair.ads = structuredClone(d.crosshair.primary); });

  const rows: { tab: Tab; label: string; node: ReactNode }[] = [
    { tab: "general", label: L("Hassasiyet (Valorant ile aynı)", "Sensitivity (same as Valorant)"), node: <Num tid="set-sens" v={st.sensitivity} set={(n) => up((d) => { d.sensitivity = n; })} min={0.01} max={5} step={0.001} /> },
    { tab: "general", label: L("Fare DPI (referans — DPI farenin kendi ayarıdır, oyun değiştiremez)", "Mouse DPI (reference only — set on the mouse itself)"), node: <Num tid="set-dpi" v={st.dpi} set={(n) => up((d) => { d.dpi = n; })} min={100} max={6400} step={50} /> },
    { tab: "general", label: L("Nişan hassasiyet çarpanı", "ADS sensitivity multiplier"), node: <Num tid="set-ads-mult" v={st.adsMultiplier} set={(n) => up((d) => { d.adsMultiplier = n; })} min={0.1} max={3} step={0.01} /> },
    { tab: "general", label: L("Dürbün hassasiyet çarpanı", "Scoped sensitivity multiplier"), node: <Num tid="set-scope-mult" v={st.scopeMultiplier} set={(n) => up((d) => { d.scopeMultiplier = n; })} min={0.1} max={3} step={0.01} /> },
    { tab: "general", label: L("Nişan alma şekli", "ADS mode"), node: <Choice tid="set-ads-mode" v={st.adsMode} set={(x) => up((d) => { d.adsMode = x; })} opts={[["toggle", L("Bas-bırak", "Toggle")], ["hold", L("Basılı tut", "Hold")]]} /> },
    { tab: "general", label: L("Y eksenini ters çevir", "Invert Y"), node: <Toggle tid="set-invert" v={st.invertY} set={(b) => up((d) => { d.invertY = b; })} /> },
    { tab: "general", label: L("Mini harita boyutu", "Minimap size"), node: <Num tid="set-mm-size" v={st.minimap.size} set={(n) => up((d) => { d.minimap.size = n; })} min={140} max={380} step={10} /> },
    { tab: "general", label: L("Mini harita yakınlığı", "Minimap zoom"), node: <Num tid="set-mm-zoom" v={st.minimap.zoom} set={(n) => up((d) => { d.minimap.zoom = n; })} min={0.4} max={3} step={0.1} /> },
    { tab: "general", label: L("Mini harita yönle dönsün", "Rotate minimap"), node: <Toggle tid="set-mm-rotate" v={st.minimap.rotate} set={(b) => up((d) => { d.minimap.rotate = b; })} /> },
    { tab: "general", label: L("Mini haritada botlar", "Show bots on minimap"), node: <Toggle tid="set-mm-bots" v={st.minimap.showBots} set={(b) => up((d) => { d.minimap.showBots = b; })} /> },
    { tab: "general", label: L("Yazı boyutu", "Text size"), node: <Num tid="set-text" v={st.textScale} set={(n) => up((d) => { d.textScale = n; })} min={0.85} max={1.3} step={0.05} /> },
    { tab: "general", label: L("Yüksek kontrast yazı", "High-contrast text"), node: <Toggle tid="set-hc" v={st.highContrast} set={(b) => up((d) => { d.highContrast = b; })} /> },
    { tab: "general", label: L("Dil", "Language"), node: <Choice tid="set-lang" v={st.language} set={(x) => up((d) => { d.language = x; })} opts={[["tr", "Türkçe"], ["en", "English"]]} /> },
    { tab: "video", label: L("Görüş açısı (yatay FOV)", "Field of view (horizontal)"), node: <Num tid="set-fov" v={st.video.fov} set={(n) => up((d) => { d.video.fov = n; })} min={70} max={120} step={1} /> },
    { tab: "video", label: L("Grafik kalitesi", "Graphics quality"), node: <Choice tid="set-quality" v={st.video.quality} set={(x) => up((d) => { d.video.quality = x; })} opts={[["low", L("Düşük", "Low")], ["medium", L("Orta", "Medium")], ["high", L("Yüksek", "High")]]} /> },
    { tab: "video", label: L("Kare hızı sınırı", "FPS cap"), node: <Choice tid="set-fpscap" v={st.video.fpsCap} set={(x) => up((d) => { d.video.fpsCap = x; })} opts={[[0, L("Sınırsız", "Unlimited")], [144, "144"], [165, "165"], [240, "240"]]} /> },
    { tab: "video", label: L("Otomatik çözünürlük ölçeği (120 FPS, en az %90)", "Auto render scale (120 FPS, min 90%)"), node: <Toggle tid="set-autoscale" v={st.video.autoScale} set={(b) => up((d) => { d.video.autoScale = b; })} /> },
    { tab: "video", label: L("Sabit çözünürlük ölçeği", "Fixed render scale"), node: <Num tid="set-scale" v={st.video.renderScale} set={(n) => up((d) => { d.video.renderScale = n; })} min={0.9} max={1} step={0.01} /> },
    { tab: "video", label: L("FPS sayacı", "FPS counter"), node: <Toggle tid="set-showfps" v={st.video.showFps} set={(b) => up((d) => { d.video.showFps = b; })} /> },
    { tab: "video", label: L("Görüntü modu", "Display mode"), node: <Choice tid="set-display" v={st.video.displayMode} set={(x) => up((d) => { d.video.displayMode = x; })} opts={[["fullscreen", L("Tam ekran", "Fullscreen")], ["borderless", L("Kenarlıksız", "Borderless")], ["windowed", L("Pencereli", "Windowed")]]} /> },
    { tab: "video", label: L("Çözünürlük (ekranının desteklediği)", "Resolution (supported by your screen)"), node: (
      <select data-testid="set-resolution" value={listResolutions().includes(st.video.resolution) ? st.video.resolution : "native"} onChange={(e) => up((d) => { d.video.resolution = e.target.value; })} className="num border border-line bg-panel2 px-3 py-1.5 text-sm text-sky">
        {listResolutions().map((r) => <option key={r} value={r}>{r === "native" ? `${L("Yerel", "Native")} (${screenPixels().join("x")})` : r}</option>)}
      </select>) },
    { tab: "video", label: L("Efektler (namlu parlaması, mermi izi)", "Effects (muzzle flash, tracers)"), node: <Toggle tid="set-effects" v={st.video.effects} set={(b) => up((d) => { d.video.effects = b; })} /> },
    { tab: "video", label: L("Silah modelini göster", "Show viewmodel"), node: <Toggle tid="set-viewmodel" v={st.showViewmodel} set={(b) => up((d) => { d.showViewmodel = b; })} /> },
    { tab: "audio", label: L("Ana ses", "Master volume"), node: <Num tid="set-volume" v={st.audio.master} set={(n) => up((d) => { d.audio.master = n; })} min={0} max={1} step={0.05} /> },
    { tab: "audio", label: L("Efekt sesleri", "Effects volume"), node: <Num tid="set-sfx-volume" v={st.audio.sfx} set={(n) => up((d) => { d.audio.sfx = n; })} min={0} max={1} step={0.05} /> },
    { tab: "audio", label: L("Ateş sesi", "Fire sound"), node: <Choice tid="set-fire-snd" v={st.audio.fireSound} set={(x) => { up((d) => { d.audio.fireSound = x; }); setTimeout(() => sfx.fire("vandal"), 50); }} opts={[["classic", "Classic"], ["soft", L("Yumuşak", "Soft")], ["off", L("Kapalı", "Off")]]} /> },
    { tab: "audio", label: L("İsabet sesi", "Hit sound"), node: <Choice tid="set-hit-snd" v={st.audio.hitSound} set={(x) => { up((d) => { d.audio.hitSound = x; }); setTimeout(() => sfx.hit("body"), 50); }} opts={[["tick", "Tick"], ["dink", "Dink"], ["pop", "Pop"], ["off", L("Kapalı", "Off")]]} /> },
    { tab: "audio", label: L("Öldürme sesi", "Kill sound"), node: <Choice tid="set-kill-snd" v={st.audio.killSound} set={(x) => { up((d) => { d.audio.killSound = x; }); setTimeout(() => sfx.kill(), 50); }} opts={[["chime", "Chime"], ["pulse", "Pulse"], ["off", L("Kapalı", "Off")]]} /> },
    { tab: "audio", label: L("Kafa vuruşu 'dink'", "Headshot dink"), node: <Toggle tid="set-dink" v={st.audio.headshotDink} set={(b) => up((d) => { d.audio.headshotDink = b; })} /> },
    { tab: "range", label: L("Hedef rengi", "Target color"), node: <input data-testid="set-target-color" type="color" value={st.range.targetColor} onChange={(e) => up((d) => { d.range.targetColor = e.target.value; })} className="h-8 w-16 bg-transparent" /> },
    { tab: "range", label: L("Hedef boyutu", "Target size"), node: <Num tid="set-target-size" v={st.range.targetSize} set={(n) => up((d) => { d.range.targetSize = n; })} min={0.4} max={2} step={0.05} /> },
    { tab: "range", label: L("Gridshot hedef sayısı", "Gridshot targets"), node: <Num tid="set-grid-n" v={st.range.gridTargets} set={(n) => up((d) => { d.range.gridTargets = Math.round(n); })} min={1} max={6} step={1} /> },
    { tab: "range", label: L("Bot canı", "Bot health"), node: <Num tid="set-bot-hp" v={st.range.botHealth} set={(n) => up((d) => { d.range.botHealth = n; })} min={1} max={300} step={1} /> },
    { tab: "range", label: L("Strafe bot hızı (m/s)", "Strafe bot speed (m/s)"), node: <Num tid="set-bot-speed" v={st.range.botSpeed} set={(n) => up((d) => { d.range.botSpeed = n; })} min={0.5} max={6.75} step={0.05} /> },
    { tab: "range", label: L("Ön-nişanda ölen botlar yeniden doğsun", "Respawn bots in pre-aim"), node: <Toggle tid="set-respawn" v={st.range.respawnBots} set={(b) => up((d) => { d.range.respawnBots = b; })} /> },
    { tab: "range", label: L("Takip hedefi hızı", "Tracking target speed"), node: <Num tid="set-track-speed" v={st.range.trackingSpeed} set={(n) => up((d) => { d.range.trackingSpeed = n; })} min={0.3} max={3} step={0.05} /> },
  ];
  const TABS: [Tab, string][] = [["general", L("Genel", "General")], ["controls", L("Kontrol", "Controls")], ["crosshair", L("Nişangah", "Crosshair")], ["video", L("Görüntü", "Video")], ["audio", L("Ses", "Audio")], ["range", L("Antrenman alanı", "Range")]];
  const shown = q ? rows.filter((r) => r.label.toLowerCase().includes(q.toLowerCase())) : rows.filter((r) => r.tab === tab);
  const lineEditor = (k: "inner" | "outer", title: string) => (
    <div className="tac-panel p-4" key={k}>
      <div className="mb-2 flex items-center justify-between"><span className="overline">{title}</span><Toggle tid={`ch-${k}-show`} v={cs[k].show} set={(b) => setCs((s) => { s[k].show = b; })} /></div>
      {([["opacity", L("Opaklık", "Opacity"), 0, 1, 0.05], ["length", L("Uzunluk", "Length"), 0, 20, 1], ["thickness", L("Kalınlık", "Thickness"), 0, 10, 1], ["offset", L("Boşluk", "Offset"), 0, 40, 1]] as const).map(([f, l, a, b, s]) => (
        <div key={f} className="flex items-center justify-between py-1 text-sm"><span className="text-dim">{l}</span><Num tid={`ch-${k}-${f}`} v={cs[k][f]} set={(n) => setCs((x) => { x[k][f] = n; })} min={a} max={b} step={s} /></div>
      ))}
      <div className="mt-1 flex gap-6 text-xs text-dim">
        <label className="flex items-center gap-2">{L("Hareket hatası", "Movement error")}<Toggle tid={`ch-${k}-move`} v={cs[k].movementError} set={(b) => setCs((x) => { x[k].movementError = b; })} /></label>
        <label className="flex items-center gap-2">{L("Atış hatası", "Firing error")}<Toggle tid={`ch-${k}-fire`} v={cs[k].firingError} set={(b) => setCs((x) => { x[k].firingError = b; })} /></label>
      </div>
    </div>
  );
  return (
    <div className="px-8 py-8">
      <div className="flex items-end gap-6">
        <div><div className="overline">{L("Otomatik kaydedilir", "Auto-saved")}</div><h1 className="font-heading text-5xl font-black uppercase">{L("Ayarlar", "Settings")}</h1></div>
        <input data-testid="settings-search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={L("Ayar ara…", "Search settings…")} className="ml-auto w-72 border border-line bg-panel px-3 py-2 text-sm outline-none focus:border-val" />
      </div>
      <div className="mt-6 flex border-b border-line">
        {TABS.map(([t, l]) => <button key={t} data-testid={`settings-tab-${t}`} onClick={() => { setTab(t); setQ(""); }} className={`relative px-5 py-3 text-sm font-bold uppercase tracking-wider ${tab === t && !q ? "text-white after:absolute after:inset-x-2 after:bottom-0 after:h-[3px] after:bg-val" : "text-dim hover:text-white"}`}>{l}</button>)}
      </div>
      <div className="mt-6 grid gap-8 xl:grid-cols-[1fr_380px]">
        <div className="min-w-0 space-y-4">
          {(q || !["controls", "crosshair"].includes(tab)) && (
            <div className="tac-panel divide-y divide-white/5" data-testid="settings-rows">
              {shown.map((r) => <div key={r.label} className="flex items-center justify-between gap-6 px-5 py-3"><span className="text-sm">{r.label}</span>{r.node}</div>)}
              {!shown.length && <p className="p-5 text-dim">{L("Sonuç yok", "No results")}</p>}
            </div>
          )}
          {!q && tab === "controls" && (
            <div className="tac-panel p-5" data-testid="keybind-table">
              <div className="mb-3 flex items-center justify-between"><span className="overline">{L("Tuş atamaları", "Key bindings")}</span>
                <button data-testid="keybind-reset" onClick={() => up((d) => { d.keybinds = structuredClone(DEFAULT_KEYBINDS); })} className="text-xs uppercase text-dim hover:text-white">{L("Varsayılana döndür", "Reset to default")}</button></div>
              <div className="grid grid-cols-[1fr_140px_140px] gap-y-1 text-sm">
                <span className="text-xs uppercase text-dim">{L("Eylem", "Action")}</span><span className="text-xs uppercase text-dim">{L("Ana", "Primary")}</span><span className="text-xs uppercase text-dim">{L("Yedek", "Secondary")}</span>
                {ACTIONS.map((a) => [
                  <span key={a} className="py-1">{L(...ACTION_LABEL[a])}</span>,
                  ...([0, 1] as const).map((i) => <button key={a + i} data-testid={`bind-${a}-${i}`} onClick={() => setListen({ a, i })} className={`mr-2 border px-2 py-1 text-xs ${listen?.a === a && listen.i === i ? "border-val text-val" : "border-line"}`}>{listen?.a === a && listen.i === i ? L("Tuşa bas…", "Press key…") : keyLabel(st.keybinds[a][i])}</button>),
                ])}
              </div>
              <p className="mt-3 text-xs text-dim">{L("Esc ile atamayı temizle. Ctrl+W, oyun tam ekranda tuşları yakaladığı için sekmeyi kapatmaz.", "Esc clears a binding. Ctrl+W is captured in fullscreen.")}</p>
            </div>
          )}
          {!q && tab === "crosshair" && (
            <div className="space-y-4" data-testid="crosshair-editor">
              <div className="flex flex-wrap items-center gap-2">
                <Choice tid="ch-target" v={chTarget} set={setChTarget} opts={[["primary", L("Ana", "Primary")], ["ads", L("Nişanlı", "ADS")]]} />
                {chTarget === "ads" && <label className="ml-2 flex items-center gap-2 text-xs text-dim">{L("Ana nişangahı kullan", "Use primary")}<Toggle tid="ch-ads-primary" v={st.crosshair.adsUsePrimary} set={(b) => up((d) => { d.crosshair.adsUsePrimary = b; if (b) d.crosshair.ads = structuredClone(d.crosshair.primary); })} /></label>}
              </div>
              <div className="tac-panel p-4">
                <div className="overline mb-2">{L("Hazır nişangahlar", "Presets")}</div>
                <div className="flex flex-wrap gap-2">{PRESETS.map((p) => <button key={p.id} data-testid={`ch-preset-${p.id}`} onClick={() => setCs((s) => Object.assign(s, structuredClone(p.style)))} className="flex items-center gap-2 border border-line bg-panel2 px-2 py-1 text-xs hover:border-white/40"><CrosshairView s={p.style} scale={0.4} />{p.name}</button>)}</div>
              </div>
              <div className="tac-panel space-y-2 p-4">
                <div className="flex items-center justify-between text-sm"><span className="text-dim">{L("Renk", "Color")}</span>
                  <div className="flex items-center gap-1">{VAL_COLORS.map((c) => <button key={c} data-testid={`ch-color-${c.slice(1)}`} onClick={() => setCs((s) => { s.color = c; })} className={`h-6 w-6 border ${cs.color.toUpperCase() === c ? "border-white" : "border-transparent"}`} style={{ background: c }} />)}
                    <input data-testid="ch-color-custom" type="color" value={cs.color} onChange={(e) => setCs((s) => { s.color = e.target.value; })} className="h-6 w-10 bg-transparent" /></div></div>
                <div className="flex items-center justify-between text-sm"><span className="text-dim">{L("Dış çizgi", "Outlines")}</span><Toggle tid="ch-outlines" v={cs.outlines} set={(b) => setCs((s) => { s.outlines = b; })} /></div>
                <div className="flex items-center justify-between text-sm"><span className="text-dim">{L("Dış çizgi opaklığı", "Outline opacity")}</span><Num tid="ch-outline-op" v={cs.outlineOpacity} set={(n) => setCs((s) => { s.outlineOpacity = n; })} min={0} max={1} step={0.05} /></div>
                <div className="flex items-center justify-between text-sm"><span className="text-dim">{L("Merkez nokta", "Center dot")}</span><Toggle tid="ch-dot" v={cs.centerDot} set={(b) => setCs((s) => { s.centerDot = b; })} /></div>
                <div className="flex items-center justify-between text-sm"><span className="text-dim">{L("Nokta kalınlığı", "Dot thickness")}</span><Num tid="ch-dot-th" v={cs.dotThickness} set={(n) => setCs((s) => { s.dotThickness = n; })} min={1} max={6} step={1} /></div>
              </div>
              <div className="grid gap-4 lg:grid-cols-2">{lineEditor("inner", L("İç çizgiler", "Inner lines"))}{lineEditor("outer", L("Dış çizgiler", "Outer lines"))}</div>
              <div className="tac-panel space-y-2 p-4">
                <div className="overline">{L("Dürbün nişangahı", "Sniper scope")}</div>
                <div className="flex items-center justify-between text-sm"><span className="text-dim">{L("Merkez nokta", "Center dot")}</span><Toggle tid="ch-sniper-dot" v={st.crosshair.sniper.centerDot} set={(b) => up((d) => { d.crosshair.sniper.centerDot = b; })} /></div>
                <div className="flex items-center justify-between text-sm"><span className="text-dim">{L("Renk", "Color")}</span><input data-testid="ch-sniper-color" type="color" value={st.crosshair.sniper.color} onChange={(e) => up((d) => { d.crosshair.sniper.color = e.target.value; })} className="h-6 w-10 bg-transparent" /></div>
              </div>
              <div className="tac-panel p-4">
                <div className="overline mb-2">{L("Valorant nişangah kodu", "Valorant crosshair code")}</div>
                <div className="flex gap-2">
                  <input data-testid="ch-code-input" value={code} onChange={(e) => setCode(e.target.value)} placeholder="0;P;c;5;h;0;..." className="num flex-1 border border-line bg-panel2 px-3 py-2 text-xs" />
                  <button data-testid="ch-code-import" onClick={() => { try { const c = decodeCrosshair(code); up((d) => { d.crosshair = c; }); toast.success(L("Nişangah içe aktarıldı", "Crosshair imported")); } catch { toast.error(L("Geçersiz kod", "Invalid code")); } }} className="bg-val px-4 text-xs font-bold uppercase">{L("İçe aktar", "Import")}</button>
                  <button data-testid="ch-code-export" onClick={() => { const c = encodeCrosshair(st.crosshair); setCode(c); void navigator.clipboard?.writeText(c); toast.success(L("Kod kopyalandı", "Code copied")); }} className="border border-line px-4 text-xs uppercase">{L("Dışa aktar", "Export")}</button>
                </div>
              </div>
            </div>
          )}
          <button data-testid="settings-reset-all" onClick={() => resetSettings()} className="text-xs uppercase text-dim hover:text-val">{L("Tüm ayarları sıfırla", "Reset all settings")}</button>
        </div>
        <aside className="sticky top-24 h-fit tac-panel p-5" data-testid="settings-preview">
          <div className="overline mb-3">{L("Canlı önizleme", "Live preview")}</div>
          {tab === "crosshair" && !q ? (
            <>
              <div className="relative grid h-64 place-items-center overflow-hidden bg-[linear-gradient(135deg,#5a6b7d,#c8d3dc_45%,#2a3440)]"><CrosshairView s={cs} scale={zoom} /></div>
              <div className="mt-3 flex items-center gap-2 text-xs text-dim">{L("Yakınlaştır", "Zoom")}<input data-testid="ch-preview-zoom" type="range" min={1} max={6} step={0.5} value={zoom} onChange={(e) => setZoom(Number(e.target.value))} className="accent-[#FF4655]" /></div>
            </>
          ) : (
            <div className="space-y-3 text-sm">
              <div className="grid h-36 place-items-center bg-[#1d2530]"><CrosshairView s={st.crosshair.primary} scale={1.5} /></div>
              <div className="flex justify-between"><span className="text-dim">eDPI</span><b className="num text-sky">{Math.round(st.sensitivity * st.dpi)}</b></div>
              <div className="flex justify-between"><span className="text-dim">cm/360</span><b className="num text-sky">{cmPer360(st.sensitivity, st.dpi).toFixed(1)}</b></div>
              <div className="flex justify-between"><span className="text-dim">{L("Çözünürlük", "Resolution")}</span><b className="num text-sky" data-testid="preview-resolution">{st.video.resolution === "native" ? screenPixels().join("x") : st.video.resolution}</b></div>
              <div className="flex justify-between"><span className="text-dim">{L("Mod", "Mode")}</span><b className="text-sky" data-testid="preview-display-mode">{st.video.displayMode}</b></div>
              <div className="flex justify-between"><span className="text-dim">FOV</span><b className="num text-sky">{st.video.fov}°</b></div>
              <div className="flex justify-between"><span className="text-dim">{L("Ölçek", "Scale")}</span><b className="num text-sky">{st.video.autoScale ? L("Oto 90–100%", "Auto 90–100%") : `${Math.round(st.video.renderScale * 100)}%`}</b></div>
              <div className="flex justify-between"><span className="text-dim">{L("Mini harita", "Minimap")}</span><b className="num text-sky">{st.minimap.size}px · x{st.minimap.zoom}</b></div>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

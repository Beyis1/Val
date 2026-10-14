import { useState, type ReactNode } from "react";
import { Play, Settings2, Keyboard, Crosshair, Home, LogOut, RotateCcw, Swords, Palette } from "lucide-react";
import { ACTIONS, keyLabel, updateSettings, useSettings, type ActionId, type AppSettings } from "@/lib/settings";
import { useL, TYPE_LABEL, DIFF_LABEL, MAP_NAMES } from "@/lib/i18n";
import type { Scenario } from "@/lib/types";

type Pane = "settings" | "controls" | "training";
const ACTION_TR: Record<ActionId, [string, string]> = {
  forward: ["İleri", "Forward"], back: ["Geri", "Back"], left: ["Sol", "Left"], right: ["Sağ", "Right"], jump: ["Zıpla", "Jump"], crouch: ["Eğil", "Crouch"],
  walk: ["Yürü", "Walk"], use: ["Kullan / İmha", "Use / Defuse"], reload: ["Şarjör", "Reload"], primary: ["Ana silah", "Primary"], secondary: ["Tabanca", "Sidearm"],
  melee: ["Bıçak", "Melee"], buy: ["Silahlar", "Weapons"], scoreboard: ["Skor", "Scoreboard"], fire: ["Ateş", "Fire"], ads: ["Nişan al", "ADS"], inspect: ["İncele", "Inspect"],
};

function Row({ label, children }: { label: string; children: ReactNode }) {
  return <div className="flex items-center justify-between gap-4 border-b border-white/5 py-2.5 text-sm"><span className="text-dim">{label}</span>{children}</div>;
}
function Slider({ v, min, max, step, set, tid, fmt }: { v: number; min: number; max: number; step: number; set: (n: number) => void; tid: string; fmt?: (n: number) => string }) {
  return (
    <div className="flex items-center gap-3">
      <input data-testid={tid} type="range" min={min} max={max} step={step} value={v} onChange={(e) => set(Number(e.target.value))} className="w-40 accent-[#FF4655]" />
      <span className="num w-14 text-right text-sky">{fmt ? fmt(v) : v}</span>
    </div>
  );
}
function Switch({ v, set, tid }: { v: boolean; set: (b: boolean) => void; tid: string }) {
  return <button data-testid={tid} onClick={() => set(!v)} className={`h-6 w-11 border transition-colors duration-150 ${v ? "border-val bg-val/70" : "border-white/15 bg-white/5"}`}><span className={`block h-4 w-4 bg-white transition-transform duration-150 ${v ? "translate-x-6" : "translate-x-1"}`} /></button>;
}

/** Esc menu: resume · settings · controls · training · main menu · quit. Every entry is wired to real state. */
export function PauseMenu({ scenario, fps, onResume, onRestart, onWeapons, onSkins, onMenu, onQuit }: {
  scenario: Scenario; fps: number; onResume: () => void; onRestart: () => void; onWeapons: () => void; onSkins: () => void; onMenu: () => void; onQuit: () => void;
}) {
  const L = useL(); const st = useSettings(); const [pane, setPane] = useState<Pane>("settings");
  const up = (f: (d: AppSettings) => void) => updateSettings(f);
  const item = (id: string, icon: ReactNode, label: string, on: () => void, active = false, danger = false) => (
    <button key={id} data-testid={`pause-${id}-btn`} onClick={on}
      className={`group flex w-full items-center gap-3 px-4 py-3 text-left font-heading text-sm font-bold uppercase tracking-[0.14em] transition-[background-color,color,transform] duration-150 hover:translate-x-1 ${active ? "bg-white/10 text-white" : danger ? "text-dim hover:bg-val/15 hover:text-val" : "text-dim hover:bg-white/5 hover:text-white"}`}>
      <span className={active ? "text-val" : ""}>{icon}</span>{label}
    </button>
  );
  return (
    <div className="absolute inset-0 z-30 flex bg-[#05080c]/70 backdrop-blur-sm anim-fade-up" data-testid="pause-menu">
      <aside className="flex w-[300px] flex-col border-r border-white/10 bg-[#0B1015]/90 py-8">
        <div className="px-6">
          <div className="overline">{MAP_NAMES[scenario.map_id]} · {L(...TYPE_LABEL[scenario.type])}</div>
          <h2 className="mt-1 font-heading text-3xl font-black uppercase leading-none">{L("Duraklatıldı", "Paused")}</h2>
        </div>
        <button data-testid="resume-btn" onClick={onResume} className="mx-6 mt-6 flex items-center justify-center gap-2 bg-val py-3.5 font-heading text-base font-black uppercase tracking-wider transition-transform duration-150 hover:scale-[1.02]"><Play size={16} />{L("Oyuna dön", "Resume")}</button>
        <nav className="mt-4 flex-1">
          {item("settings", <Settings2 size={16} />, L("Ayarlar", "Settings"), () => setPane("settings"), pane === "settings")}
          {item("controls", <Keyboard size={16} />, L("Kontroller", "Controls"), () => setPane("controls"), pane === "controls")}
          {item("training", <Crosshair size={16} />, L("Antrenman ayarları", "Training"), () => setPane("training"), pane === "training")}
          <div className="mx-6 my-3 h-px bg-white/10" />
          {item("menu", <Home size={16} />, L("Ana menüye dön", "Main menu"), onMenu)}
          {item("quit", <LogOut size={16} />, L("Oyundan çık", "Quit game"), onQuit, false, true)}
        </nav>
        {fps > 0 && fps < 60 && <p className="px-6 text-xs text-amber-400">{L("Düşük FPS: tarayıcıda donanım hızlandırmayı aç, grafik kalitesini düşür.", "Low FPS: enable hardware acceleration, lower quality.")}</p>}
      </aside>
      <section className="max-w-2xl flex-1 overflow-auto p-10 scrollbar-thin" data-testid={`pause-pane-${pane}`}>
        {pane === "settings" && (
          <>
            <h3 className="font-heading text-2xl font-black uppercase">{L("Ayarlar", "Settings")}</h3>
            <div className="mt-4">
              <Row label={L("Hassasiyet", "Sensitivity")}>
                <div className="flex items-center gap-2">
                  <input data-testid="pause-sens-input" type="number" step="0.001" min="0.01" value={st.sensitivity} onChange={(e) => up((d) => { d.sensitivity = Math.max(0.01, Number(e.target.value) || 0.01); })} className="num w-24 border border-white/15 bg-white/5 px-2 py-1 text-sky" />
                  <span className="text-xs text-dim">@ {st.dpi} DPI · eDPI <b className="num text-white">{Math.round(st.sensitivity * st.dpi)}</b></span>
                </div>
              </Row>
              <Row label={L("Nişan çarpanı", "ADS multiplier")}><Slider tid="pause-ads-mult" v={st.adsMultiplier} min={0.1} max={3} step={0.01} set={(n) => up((d) => { d.adsMultiplier = n; })} fmt={(n) => n.toFixed(2)} /></Row>
              <Row label="FOV"><Slider tid="pause-fov" v={st.video.fov} min={70} max={120} step={1} set={(n) => up((d) => { d.video.fov = n; })} fmt={(n) => `${n}°`} /></Row>
              <Row label={L("Ana ses", "Master volume")}><Slider tid="pause-volume" v={st.audio.master} min={0} max={1} step={0.05} set={(n) => up((d) => { d.audio.master = n; })} fmt={(n) => `${Math.round(n * 100)}%`} /></Row>
              <Row label={L("Efekt sesleri", "Effects volume")}><Slider tid="pause-sfx" v={st.audio.sfx} min={0} max={1} step={0.05} set={(n) => up((d) => { d.audio.sfx = n; })} fmt={(n) => `${Math.round(n * 100)}%`} /></Row>
              <Row label={L("Namlu parlaması / mermi izi", "Muzzle flash / tracers")}><Switch tid="pause-effects" v={st.video.effects} set={(b) => up((d) => { d.video.effects = b; })} /></Row>
              <Row label={L("Silah modeli", "Viewmodel")}><Switch tid="pause-viewmodel" v={st.showViewmodel} set={(b) => up((d) => { d.showViewmodel = b; })} /></Row>
              <Row label={L("FPS sayacı", "FPS counter")}><Switch tid="pause-showfps" v={st.video.showFps} set={(b) => up((d) => { d.video.showFps = b; })} /></Row>
            </div>
            <p className="mt-4 text-xs text-dim">{L("Çözünürlük, görüntü modu ve nişangâh: Ana menü › Ayarlar.", "Resolution, display mode and crosshair: Main menu › Settings.")}</p>
          </>
        )}
        {pane === "controls" && (
          <>
            <h3 className="font-heading text-2xl font-black uppercase">{L("Kontroller", "Controls")}</h3>
            <div className="mt-4 grid grid-cols-2 gap-x-8" data-testid="pause-keybinds">
              {ACTIONS.map((a) => (
                <div key={a} className="flex items-center justify-between border-b border-white/5 py-2 text-sm">
                  <span className="text-dim">{L(...ACTION_TR[a])}</span>
                  <span className="num border border-white/15 px-2 py-0.5 text-xs">{keyLabel(st.keybinds[a][0])}{st.keybinds[a][1] ? ` / ${keyLabel(st.keybinds[a][1])}` : ""}</span>
                </div>
              ))}
            </div>
            <p className="mt-4 text-xs text-dim">{L("Tuşları değiştirmek için: Ana menü › Ayarlar › Kontrol.", "Rebind keys in Main menu › Settings › Controls.")}</p>
          </>
        )}
        {pane === "training" && (
          <>
            <h3 className="font-heading text-2xl font-black uppercase">{L("Antrenman", "Training")}</h3>
            <div className="mt-2 text-sm text-dim">{L(...DIFF_LABEL[scenario.difficulty])} · {scenario.duration}s · {L("Botlar ateş eder", "Bots shoot")}: {scenario.bots_shoot ? L("Evet", "Yes") : L("Hayır", "No")}</div>
            <div className="mt-4">
              <Row label={L("Ölen botlar yeniden doğsun (ön-nişan)", "Respawn dead bots (pre-aim)")}><Switch tid="pause-respawn" v={st.range.respawnBots} set={(b) => up((d) => { d.range.respawnBots = b; })} /></Row>
              <Row label={L("Strafe bot hızı", "Strafe bot speed")}><Slider tid="pause-bot-speed" v={st.range.botSpeed} min={0.5} max={6.75} step={0.05} set={(n) => up((d) => { d.range.botSpeed = n; })} fmt={(n) => `${n.toFixed(1)} m/s`} /></Row>
              <Row label={L("Hedef boyutu (range)", "Target size (range)")}><Slider tid="pause-target-size" v={st.range.targetSize} min={0.4} max={2} step={0.05} set={(n) => up((d) => { d.range.targetSize = n; })} fmt={(n) => `x${n.toFixed(2)}`} /></Row>
              <Row label={L("Mini harita bot noktaları", "Bots on minimap")}><Switch tid="pause-mm-bots" v={st.minimap.showBots} set={(b) => up((d) => { d.minimap.showBots = b; })} /></Row>
            </div>
            <div className="mt-6 grid grid-cols-3 gap-2">
              <button data-testid="pause-weapons-btn" onClick={onWeapons} className="flex items-center justify-center gap-2 border border-white/15 py-3 text-xs font-bold uppercase transition-colors duration-150 hover:bg-white/10"><Swords size={14} />{L("Silahlar", "Weapons")}</button>
              <button data-testid="pause-skin-btn" onClick={onSkins} className="flex items-center justify-center gap-2 border border-white/15 py-3 text-xs font-bold uppercase transition-colors duration-150 hover:bg-white/10"><Palette size={14} />{L("Kaplamalar", "Skins")}</button>
              <button data-testid="pause-restart-btn" onClick={onRestart} className="flex items-center justify-center gap-2 border border-white/15 py-3 text-xs font-bold uppercase transition-colors duration-150 hover:bg-white/10"><RotateCcw size={14} />{L("Yeniden başlat", "Restart")}</button>
            </div>
          </>
        )}
      </section>
    </div>
  );
}

import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPost } from "@/lib/api";
import type { GameRecord, RecordCreate, Scenario } from "@/lib/types";
import { Engine, type EngineStatus, type HudState, type RoundResult } from "@/game/engine";
import { useSettings, useSettingsBootstrap, updateSettings } from "@/lib/settings";
import { useL, TYPE_LABEL, DIFF_LABEL, MAP_NAMES, mapThumb } from "@/lib/i18n";
import { CrosshairView } from "@/components/CrosshairView";
import { BuyMenu } from "@/components/BuyMenu";
import { SkinWindow } from "@/components/SkinWindow";
import { WEAPON_BY_ID } from "@/game/weapons";
import { enterDisplayMode } from "@/lib/display";
import { PauseMenu } from "@/components/PauseMenu";
import { RangeArt } from "@/components/RangeArt";

function Minimap({ engine, mapId }: { engine: Engine; mapId: string }) {
  const ref = useRef<HTMLCanvasElement>(null); const st = useSettings(); const img = useRef<HTMLImageElement | null>(null);
  useEffect(() => { if (mapId !== "range" && mapId !== "sandbox") { const i = new Image(); i.src = `/maps/${mapId}/minimap.png`; img.current = i; } }, [mapId]);
  useEffect(() => {
    let raf = 0;
    const draw = () => {
      raf = requestAnimationFrame(draw);
      const c = ref.current; if (!c) return; const g = c.getContext("2d")!; const S = c.width; const r = engine.radar(); const mm = st.minimap;
      const ppm = (S / 60) * mm.zoom;
      g.clearRect(0, 0, S, S); g.fillStyle = "rgba(11,16,21,0.75)"; g.fillRect(0, 0, S, S);
      g.save(); g.translate(S / 2, S / 2); if (mm.rotate) g.rotate(r.yaw);
      const b = r.meta?.minimap;
      if (b && img.current?.complete) g.drawImage(img.current, (b.minX - r.x) * ppm, (b.minZ - r.z) * ppm, (b.maxX - b.minX) * ppm, (b.maxZ - b.minZ) * ppm);
      if (mm.showBots) { g.fillStyle = "#FF4655"; for (const bt of r.bots) { g.beginPath(); g.arc((bt.x - r.x) * ppm, (bt.z - r.z) * ppm, 3.5, 0, 7); g.fill(); } }
      if (r.limit) { g.strokeStyle = "rgba(255,70,85,0.7)"; g.lineWidth = 2; g.beginPath(); g.arc((r.limit.x - r.x) * ppm, (r.limit.z - r.z) * ppm, r.limit.r * ppm, 0, 7); g.stroke(); }
      if (r.site) { g.fillStyle = "#F59E0B"; g.fillRect((r.site.x - r.x) * ppm - 4, (r.site.z - r.z) * ppm - 4, 8, 8); }
      g.restore();
      g.save(); g.translate(S / 2, S / 2); if (!mm.rotate) g.rotate(-r.yaw);
      g.fillStyle = "#38BDF8"; g.beginPath(); g.moveTo(0, -7); g.lineTo(5, 5); g.lineTo(-5, 5); g.closePath(); g.fill(); g.restore();
    };
    draw(); return () => cancelAnimationFrame(raf);
  }, [engine, st.minimap]);
  return <canvas ref={ref} width={st.minimap.size} height={st.minimap.size} className="absolute left-4 top-4 border border-white/15" data-testid="hud-minimap" />;
}

export default function Play() {
  useSettingsBootstrap();
  const { id = "" } = useParams(); const nav = useNavigate(); const L = useL(); const st = useSettings(); const qc = useQueryClient();
  const sq = useQuery({ queryKey: ["scenario", id], queryFn: () => apiGet<Scenario>(`/scenarios/${id}`) });
  const canvas = useRef<HTMLCanvasElement>(null); const wrap = useRef<HTMLDivElement>(null);
  const [engine, setEngine] = useState<Engine | null>(null);
  const [phase, setPhase] = useState<"intro" | "game">("intro");
  const [status, setStatus] = useState<EngineStatus>("loading"); const [progress, setProgress] = useState(0);
  const [hud, setHud] = useState<HudState | null>(null); const [hit, setHit] = useState<{ k: string; n: number; dmg?: number; hp?: number } | null>(null);
  const [result, setResult] = useState<(RoundResult & { new_best?: boolean }) | null>(null);
  const [overlay, setOverlay] = useState<"" | "buy" | "skin">(""); const [board, setBoard] = useState(false);
  const save = useMutation({
    mutationFn: (r: RecordCreate) => apiPost<GameRecord>("/records", r),
    onSuccess: (rec) => { setResult((p) => (p ? { ...p, new_best: rec.new_best } : p)); void qc.invalidateQueries({ queryKey: ["scenarios"] }); void qc.invalidateQueries({ queryKey: ["records"] }); },
  });
  const sc = sq.data;
  useEffect(() => {
    if (phase !== "game" || !sc || !canvas.current) return;
    const e = new Engine(canvas.current, sc, {
      onHud: setHud, onStatus: setStatus, onProgress: setProgress,
      onHit: (k, dmg, hp) => setHit((p) => ({ k, n: Math.random(), dmg: dmg ?? p?.dmg, hp: k === "kill" ? 0 : hp })),
      onEnd: (r) => { setResult(r); save.mutate({ ...r, scenario_id: sc.id }); },
      onBuy: () => setOverlay("buy"), onScoreboard: setBoard,
    });
    setEngine(e); void e.init();
    return () => e.dispose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, sc?.id]);
  useEffect(() => { document.documentElement.style.fontSize = `${16 * st.textScale}px`; }, [st.textScale]);
  if (!sc) return <div className="grid h-screen place-items-center bg-tactical text-dim" data-testid="play-loading">{sq.isError ? L("Senaryo bulunamadı", "Scenario not found") : "…"}</div>;
  const name = st.language === "en" && sc.name_en ? sc.name_en : sc.name;
  const desc = st.language === "en" && sc.description_en ? sc.description_en : sc.description;
  const begin = () => { void enterDisplayMode(wrap.current, st.video.displayMode); engine?.start(); };
  const toMenu = () => { if (document.fullscreenElement) void document.exitFullscreen(); nav("/"); };
  const quitGame = () => { if (document.fullscreenElement) void document.exitFullscreen(); window.close(); setTimeout(() => nav("/"), 150); };
  const closeOverlay = () => { setOverlay(""); if (engine?.status === "buy") engine.resume(); };
  const ch = hud?.zoom && hud.zoom > 1 && !st.crosshair.adsUsePrimary ? st.crosshair.ads : st.crosshair.primary;
  const wName = WEAPON_BY_ID[st.loadout.primary ?? st.loadout.secondary]?.name ?? "Classic";
  const mm = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

  if (phase === "intro") return (
    <div className="relative min-h-screen bg-tactical" data-testid="scenario-intro">
      {sc.map_id === "range" || sc.map_id === "sandbox" ? <RangeArt type={sc.type} className="absolute inset-0 h-full w-full opacity-40" /> :
        <img src={mapThumb(sc.map_id, sc.type)} alt="" className="absolute inset-0 h-full w-full object-cover opacity-35" onError={(e) => { e.currentTarget.style.display = "none"; }} />}
      <div className="absolute inset-0 bg-gradient-to-r from-[#0B1015] via-[#0B1015]/85 to-transparent" />
      <div className="relative flex min-h-screen items-center gap-12 px-16">
        <div className="max-w-xl anim-fade-up">
          <div className="overline">{MAP_NAMES[sc.map_id]} · {L(...TYPE_LABEL[sc.type])}</div>
          <h1 className="mt-2 font-heading text-6xl font-black uppercase leading-none" data-testid="intro-title">{name}</h1>
          <p className="mt-5 text-lg text-dim" data-testid="intro-description">{desc}</p>
          <div className="mt-6 flex gap-6 text-sm">
            <div><div className="text-dim">{L("Süre", "Duration")}</div><div className="num text-2xl text-sky">{sc.duration}s</div></div>
            <div><div className="text-dim">{L("Zorluk", "Difficulty")}</div><div className="text-2xl font-bold">{L(...DIFF_LABEL[sc.difficulty])}</div></div>
            <div><div className="text-dim">{L("Botlar ateş eder", "Bots shoot")}</div><div className="text-2xl font-bold">{sc.bots_shoot ? L("Evet", "Yes") : L("Hayır", "No")}</div></div>
            <div><div className="text-dim">{L("En iyi", "Best")}</div><div className="num text-2xl text-sky">{sc.best_score ?? "—"}</div></div>
          </div>
          <div className="mt-10 flex gap-3">
            <button data-testid="intro-play-btn" onClick={() => setPhase("game")} className="chamfer-sm bg-val px-10 py-4 font-heading text-lg font-black uppercase tracking-wider anim-pulse-red">{L("Hazır", "Ready")}</button>
            <button data-testid="intro-back-btn" onClick={() => nav("/")} className="border border-white/20 px-6 py-4 font-semibold uppercase">{L("Geri", "Back")}</button>
          </div>
        </div>
        {sc.map_id !== "range" && sc.map_id !== "sandbox" && <img src={`/maps/${sc.map_id}/minimap.png`} alt="minimap" className="ml-auto max-h-[70vh] max-w-[38vw] object-contain opacity-90" data-testid="intro-minimap" />}
      </div>
    </div>
  );

  return (
    <div ref={wrap} className="fixed inset-0 select-none bg-black" data-testid="game-root">
      <canvas ref={canvas} className="h-full w-full" data-testid="game-canvas" />
      {engine && status !== "loading" && <Minimap engine={engine} mapId={sc.map_id} />}
      {hud && status !== "loading" && (
        <>
          <div className="pointer-events-none absolute left-1/2 top-4 flex -translate-x-1/2 items-center gap-6 border border-white/10 bg-black/45 px-6 py-2" data-testid="hud-top">
            <div className="text-center"><div className="text-[10px] uppercase text-dim">{L("Skor", "Score")}</div><div className="num text-2xl font-bold" data-testid="hud-score">{hud.score}</div></div>
            <div className="text-center"><div className="text-[10px] uppercase text-dim">{L("Süre", "Time")}</div><div className={`num text-2xl font-bold ${hud.spikeArmed && hud.timeLeft < 10 ? "text-val" : ""}`} data-testid="hud-timer">{mm(hud.timeLeft)}</div></div>
            <div className="text-center"><div className="text-[10px] uppercase text-dim">{L("Öldürme", "Kills")}</div><div className="num text-2xl font-bold" data-testid="hud-kills">{hud.kills}{["preaim", "spike"].includes(sc.type) ? ` / ${hud.kills + hud.botsLeft}` : ""}</div></div>
          </div>
          {st.video.showFps && <div className="pointer-events-none absolute right-3 top-3 num text-xs text-sky" data-testid="hud-fps">{hud.fps} FPS · {Math.round(hud.scale * 100)}%</div>}
          {hud.scoped ? (
            <div className="pointer-events-none absolute inset-0" style={{ background: "radial-gradient(circle at center, transparent 0 38vh, #000 38.2vh)" }} data-testid="hud-scope">
              <div className="absolute left-1/2 top-0 h-full w-px -translate-x-1/2 bg-black/80" /><div className="absolute left-0 top-1/2 h-px w-full -translate-y-1/2 bg-black/80" />
              {st.crosshair.sniper.centerDot && <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full" style={{ width: st.crosshair.sniper.thickness * 3, height: st.crosshair.sniper.thickness * 3, background: st.crosshair.sniper.color, opacity: st.crosshair.sniper.opacity }} />}
            </div>
          ) : (
            <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"><CrosshairView s={ch} bloom={hud.bloom} /></div>
          )}
          {hit && <div key={hit.n} className={`pointer-events-none absolute left-1/2 top-1/2 anim-hitmarker text-2xl font-black ${hit.k === "head" ? "text-val" : "text-white"}`} data-testid="hud-hitmarker">✕</div>}
          {hit && hit.dmg !== undefined && hit.k !== "kill" && (
            <div key={"d" + hit.n} className="pointer-events-none absolute left-1/2 top-[54%] -translate-x-1/2 text-center anim-kill" data-testid="hud-damage">
              <div className={`num text-lg font-black ${hit.k === "head" ? "text-val" : "text-white"}`}>-{hit.dmg}</div>
              {hit.hp !== undefined && <div className="mx-auto mt-1 h-1 w-24 bg-white/20"><div className="h-full bg-val" style={{ width: `${hit.hp * 100}%` }} /></div>}
            </div>
          )}
          {hit?.k === "kill" && <div key={"k" + hit.n} className="pointer-events-none absolute left-1/2 top-[62%] anim-kill font-heading text-xl font-black uppercase text-val">{L("Öldürüldü", "Eliminated")}</div>}
          {hud.dmgFlash > 0.05 && <div className="pointer-events-none absolute inset-0" style={{ boxShadow: `inset 0 0 160px rgba(255,70,85,${hud.dmgFlash * 0.8})` }} />}
          {hud.message && <div className="pointer-events-none absolute left-1/2 top-[58%] -translate-x-1/2 bg-black/60 px-4 py-2 text-sm font-semibold uppercase" data-testid="hud-message">{hud.message === "bounds" ? L("Bu modda alan dışına çıkamazsın", "Out of bounds for this mode") : hud.message === "defuse" ? L("F basılı tut: Spike imha", "Hold F to defuse") : L("Spike'a git", "Go to the Spike")}</div>}
          {hud.defuse > 0 && <div className="pointer-events-none absolute left-1/2 top-[64%] h-2 w-64 -translate-x-1/2 bg-white/10"><div className="h-full bg-sky" style={{ width: `${hud.defuse * 100}%` }} /></div>}
          <div className="pointer-events-none absolute bottom-6 left-6 flex items-end gap-4" data-testid="hud-health">
            <div><div className="text-[10px] uppercase text-dim">HP</div><div className="num text-4xl font-black">{hud.hp}</div></div>
            <div><div className="text-[10px] uppercase text-dim">{L("Zırh", "Armor")}</div><div className="num text-2xl font-bold text-sky">{hud.armor}</div></div>
          </div>
          <div className="pointer-events-none absolute bottom-6 right-8 text-right" data-testid="hud-ammo">
            <div className="text-xs uppercase tracking-widest text-dim">{hud.weaponName}</div>
            <div className="num text-5xl font-black">{hud.mag ? hud.ammo : "—"}<span className="ml-2 text-xl text-dim">/ ∞</span></div>
            {hud.reloading >= 0 && <div className="ml-auto mt-1 h-1 w-32 bg-white/10"><div className="h-full bg-val" style={{ width: `${hud.reloading * 100}%` }} /></div>}
          </div>
          {board && (
            <div className="absolute left-1/2 top-1/2 w-[520px] -translate-x-1/2 -translate-y-1/2 tac-panel p-6" data-testid="tab-menu">
              <div className="overline">{name}</div>
              <div className="mt-3 grid grid-cols-3 gap-4 num text-sm">
                <div>{L("İsabet", "Accuracy")}<div className="text-2xl text-sky">{hud.shots ? Math.round((hud.hits / hud.shots) * 100) : 0}%</div></div>
                <div>{L("Atış", "Shots")}<div className="text-2xl">{hud.shots}</div></div><div>{L("Kalan bot", "Bots left")}<div className="text-2xl">{hud.botsLeft}</div></div>
              </div>
              <button data-testid="tab-skin-btn" className="pointer-events-auto mt-4 border border-white/20 px-4 py-2 text-xs uppercase" onClick={() => { document.exitPointerLock(); setOverlay("skin"); }}>{L("Kaplamalar", "Skins")}</button>
            </div>
          )}
        </>
      )}
      {status === "loading" && (
        <div className="absolute inset-0 grid place-items-center bg-tactical" data-testid="game-loading">
          <div className="w-80"><div className="overline mb-2">{L("Harita yükleniyor", "Loading map")} · {MAP_NAMES[sc.map_id]}</div>
            <div className="h-1.5 bg-white/10"><div className="h-full bg-val transition-[width]" style={{ width: `${Math.round(progress * 100)}%` }} /></div>
            <div className="num mt-2 text-sm text-sky">{Math.round(progress * 100)}%</div></div>
        </div>
      )}
      {status === "ready" && !result && (
        <div className="absolute inset-0 grid place-items-center bg-black/60 backdrop-blur-[2px]" data-testid="click-to-start">
          <div className="tac-panel w-[440px] p-8 text-center">
            <div className="overline">{name}</div>
            <button data-testid="start-btn" onClick={begin} className="mt-4 w-full bg-val py-4 font-heading text-xl font-black uppercase">{L("Başlamak için tıkla", "Click to start")}</button>
            <div className="mt-4 flex justify-center gap-6 text-sm text-dim">
              <span>{L("Süre", "Time")}: <b className="num text-sky">{sc.duration}s</b></span><span>{L("Silah", "Weapon")}: <b className="text-white">{wName}</b></span>
            </div>
            <p className="mt-3 text-xs text-dim">{L("Esc: oyun menüsü · B: silahlar · Y: silahı incele", "Esc: game menu · B: weapons · Y: inspect")}</p>
          </div>
        </div>
      )}
      {status === "paused" && !result && !overlay && (
        <PauseMenu scenario={sc} fps={hud?.fps ?? 0} onResume={() => engine?.resume()} onRestart={() => engine?.restart()}
          onWeapons={() => setOverlay("buy")} onSkins={() => setOverlay("skin")} onMenu={toMenu} onQuit={quitGame}
          weaponId={engine?.weapon.id ?? "vandal"} onSlot={async (n) => { await engine?.equip(n, true); return engine?.weapon.id ?? "vandal"; }} />
      )}
      {overlay === "buy" && <BuyMenu allowed={sc.allowed_weapons} onClose={closeOverlay} onEquip={(p, s) => engine?.setLoadout(p, s)} onSkin={() => setOverlay("skin")} />}
      {overlay === "skin" && <SkinWindow initial={hud?.weaponId} onClose={() => { closeOverlay(); engine?.buildViewmodel(); }} />}
      {result && (
        <div className="absolute inset-0 grid place-items-center bg-black/70 backdrop-blur-sm" data-testid="results-panel">
          <div className="tac-panel w-[560px] p-8 anim-fade-up">
            <div className="overline">{result.died ? L("Öldün", "You died") : result.completed ? L("Tamamlandı", "Completed") : L("Süre doldu", "Time up")}</div>
            <div className="mt-2 flex items-end gap-4"><div className="num text-7xl font-black" data-testid="result-score">{result.score}</div>{result.new_best && <span className="mb-3 bg-val px-2 py-1 text-xs font-bold uppercase" data-testid="result-new-best">{L("Yeni rekor", "New best")}</span>}</div>
            <div className="mt-6 grid grid-cols-3 gap-4 num">
              {[[L("İsabet", "Accuracy"), `${result.accuracy}%`], [L("Kafa", "Headshot"), `${result.headshot_rate}%`], [L("Tepki", "Reaction"), result.avg_reaction_ms ? `${result.avg_reaction_ms}ms` : "—"],
                [L("Öldürme", "Kills"), result.kills], [L("Atış", "Shots"), result.shots], [L("Süre", "Time"), `${result.duration_sec}s`]].map(([k, v]) => (
                <div key={String(k)} className="border border-white/10 p-3"><div className="text-xs text-dim">{k}</div><div className="text-2xl text-sky">{v}</div></div>))}
            </div>
            <div className="mt-6 flex gap-3">
              <button data-testid="result-retry-btn" onClick={() => { setResult(null); engine?.restart(); }} className="flex-1 bg-val py-3 font-bold uppercase">{L("Tekrar", "Retry")}</button>
              <button data-testid="result-exit-btn" onClick={toMenu} className="flex-1 border border-white/20 py-3 font-semibold uppercase">{L("Atölye", "Workshop")}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { apiDelete, apiGet, apiPost, apiPut } from "@/lib/api";
import type { BotSpec, MapIndex, Prop, Scenario, ScenarioBase, ScenarioType } from "@/lib/types";
import { Engine, type EditorPick, type EngineStatus } from "@/game/engine";
import { WEAPONS } from "@/game/weapons";
import { useSettingsBootstrap } from "@/lib/settings";
import { useL, TYPE_LABEL, DIFF_LABEL, MAP_NAMES } from "@/lib/i18n";

const MAP_TYPES: ScenarioType[] = ["preaim", "hold", "spike"];
const AIM_TYPES: ScenarioType[] = ["gridshot", "flick", "tracking", "strafe"];
const blank = (map: string): ScenarioBase => ({
  name: "", description: "", map_id: map, type: map === "range" ? "gridshot" : "preaim", difficulty: "medium", duration: 60, bots_shoot: false,
  spawn: [0, 0, 0], spawn_yaw: 0, site: null, bots: [], allowed_weapons: [], props: [],
});

export default function Editor() {
  useSettingsBootstrap();
  const { id } = useParams(); const nav = useNavigate(); const L = useL(); const qc = useQueryClient();
  const maps = useQuery({ queryKey: ["map-index"], queryFn: () => fetch("/maps/index.json").then((r) => r.json() as Promise<MapIndex>) });
  const existing = useQuery({ queryKey: ["scenario", id], queryFn: () => apiGet<Scenario>(`/scenarios/${id}`), enabled: !!id });
  const [draft, setDraft] = useState<ScenarioBase | null>(null); const [sel, setSel] = useState("");
  const [status, setStatus] = useState<EngineStatus>("loading"); const [progress, setProgress] = useState(0);
  const canvas = useRef<HTMLCanvasElement>(null); const eng = useRef<Engine | null>(null); const draftRef = useRef(draft);
  draftRef.current = draft;
  useEffect(() => { if (!id && !draft && maps.data) setDraft(blank(maps.data.maps[0]?.id ?? "range")); }, [id, draft, maps.data]);
  useEffect(() => { if (existing.data && !draft) setDraft(existing.data); }, [existing.data, draft]);
  const mapId = draft?.map_id;
  useEffect(() => {
    if (!mapId || !canvas.current) return;
    const start = draftRef.current!;
    const e = new Engine(canvas.current, start, { onStatus: setStatus, onProgress: setProgress, onEditorPick: (p) => pick(p) }, true);
    eng.current = e; void e.init().then(() => { if (start.spawn.every((v) => v === 0) && e.meta?.walk.length) { const w = e.meta.walk[Math.floor(e.meta.walk.length / 2)]; setDraft((d) => d && { ...d, spawn: w }); } });
    return () => { e.dispose(); eng.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapId]);
  useEffect(() => { if (draft && eng.current && status !== "loading") void eng.current.setEditorData(draft, sel); }, [draft, sel, status]);
  const pick = (p: EditorPick) => {
    setDraft((d) => {
      if (!d) return d;
      if (p.action === "prop") { const pr: Prop = { id: crypto.randomUUID(), pos: p.point, size: [2, 1.2, 1], yaw: p.yaw, color: "#3A4556" }; setSel(pr.id); return { ...d, props: [...(d.props ?? []), pr] }; }
      if (p.action === "selectProp") { setSel(p.propId ?? ""); return d; }
      if (p.action === "place") { const b: BotSpec = { id: crypto.randomUUID(), pos: p.point, yaw: 0, stance: "stand", movement: d.type === "hold" ? "peek" : "static", move_range: 2, health: 150, shoots: false }; setSel(b.id); return { ...d, bots: [...d.bots, b] }; }
      if (p.action === "select") { setSel(p.botId ?? ""); return d; }
      if (p.action === "spawn") return { ...d, spawn: p.point, spawn_yaw: p.yaw };
      if (p.action === "site") return { ...d, site: p.point };
      const cur = selRef.current;
      if (p.action === "move" && cur) return { ...d, bots: d.bots.map((b) => (b.id === cur ? { ...b, pos: p.point } : b)), props: (d.props ?? []).map((x) => (x.id === cur ? { ...x, pos: p.point } : x)) };
      if (p.action === "delete" && cur) { setSel(""); return { ...d, bots: d.bots.filter((b) => b.id !== cur), props: (d.props ?? []).filter((x) => x.id !== cur) }; }
      return d;
    });
  };
  const selRef = useRef(sel); selRef.current = sel;
  const saveM = useMutation({
    mutationFn: (d: ScenarioBase) => (id ? apiPut<Scenario>(`/scenarios/${id}`, d) : apiPost<Scenario>("/scenarios", d)),
    onSuccess: (s) => { toast.success(L("Senaryo kaydedildi", "Scenario saved")); void qc.invalidateQueries({ queryKey: ["scenarios"] }); void qc.invalidateQueries({ queryKey: ["scenario", s.id] }); if (!id) nav(`/editor/${s.id}`, { replace: true }); },
    onError: () => toast.error(L("Kaydedilemedi: adı ve alanları kontrol et", "Save failed: check the fields")),
  });
  const delM = useMutation({ mutationFn: () => apiDelete(`/scenarios/${id}`), onSuccess: () => { void qc.invalidateQueries({ queryKey: ["scenarios"] }); nav("/"); } });
  if (!draft) return <div className="grid h-screen place-items-center bg-tactical text-dim">…</div>;
  const set = (p: Partial<ScenarioBase>) => setDraft({ ...draft, ...p });
  const bot = draft.bots.find((b) => b.id === sel);
  const prop = (draft.props ?? []).find((x) => x.id === sel);
  const setProp = (p: Partial<Prop>) => set({ props: (draft.props ?? []).map((x) => (x.id === sel ? { ...x, ...p } : x)) });
  const setBot = (p: Partial<BotSpec>) => set({ bots: draft.bots.map((b) => (b.id === sel ? { ...b, ...p } : b)) });
  const isAim = AIM_TYPES.includes(draft.type);
  const field = "w-full border border-line bg-panel2 px-3 py-2 text-sm outline-none focus:border-val";
  return (
    <div className="flex h-screen bg-black">
      <div className="relative flex-1">
        <canvas ref={canvas} className="h-full w-full" data-testid="editor-canvas" />
        {status === "loading" && <div className="absolute inset-0 grid place-items-center bg-tactical"><div className="num text-sky">{L("Harita yükleniyor", "Loading map")} {Math.round(progress * 100)}%</div></div>}
        {status !== "running" && status !== "loading" && (
          <button data-testid="editor-enter-btn" onClick={() => eng.current?.start()} className="absolute inset-0 grid place-items-center bg-black/40">
            <div className="tac-panel max-w-md p-6 text-left">
              <div className="overline">{L("Editör kontrolleri", "Editor controls")}</div>
              <ul className="mt-2 space-y-1 text-sm text-dim">
                <li><b className="text-white">WASD</b> {L("uç", "fly")} · <b className="text-white">Space / C</b> {L("yukarı/aşağı", "up/down")} · <b className="text-white">Shift</b> {L("hızlı", "fast")}</li>
                <li><b className="text-white">{L("Sol tık", "LMB")}</b> {L("bot yerleştir", "place bot")} · <b className="text-white">{L("Sağ tık", "RMB")}</b> {L("bot seç", "select bot")}</li>
                <li><b className="text-white">B</b> {L("kutu / duvar nesnesi koy", "place box / wall object")} · {L("Sağ tık nesneyi seçer", "RMB selects it")}</li>
                <li><b className="text-white">G</b> {L("seçili botu / nesneyi taşı", "move selected")} · <b className="text-white">X</b> {L("sil", "delete")}</li>
                <li><b className="text-white">P</b> {L("başlangıç noktası", "set spawn")} · <b className="text-white">K</b> {L("Spike yeri", "set Spike site")} · <b className="text-white">Esc</b> {L("panele dön", "back to panel")}</li>
              </ul>
              <div className="mt-4 bg-val py-2 text-center font-bold uppercase">{L("Haritaya gir", "Enter map")}</div>
            </div>
          </button>
        )}
        {status === "running" && <div className="pointer-events-none absolute left-1/2 top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 bg-sky" />}
      </div>
      <aside className="w-[380px] overflow-auto border-l border-line bg-panel p-5 scrollbar-thin" data-testid="editor-panel">
        <button onClick={() => nav("/")} className="text-xs uppercase text-dim hover:text-white" data-testid="editor-back-btn">← {L("Atölye", "Workshop")}</button>
        <h1 className="mt-2 font-heading text-3xl font-black uppercase">{L("Atölye Editörü", "Workshop Editor")}</h1>
        <div className="mt-4 space-y-3">
          <input data-testid="editor-name-input" value={draft.name} onChange={(e) => set({ name: e.target.value })} placeholder={L("Senaryo adı", "Scenario name")} className={field} />
          <textarea data-testid="editor-desc-input" value={draft.description} onChange={(e) => set({ description: e.target.value })} placeholder={L("Açıklama", "Description")} className={field + " h-20"} />
          <div className="grid grid-cols-2 gap-2">
            <select data-testid="editor-map-select" value={draft.map_id} onChange={(e) => { const m = e.target.value; setSel(""); setDraft({ ...draft, map_id: m, bots: [], site: null, spawn: [0, 0, 0], type: m === "range" ? "gridshot" : (MAP_TYPES.includes(draft.type) ? draft.type : "preaim") }); }} className={field}>
              <option value="range">Range</option><option value="sandbox">{L("Sandbox (boş, kendi haritan)", "Sandbox (empty, build your own)")}</option>{maps.data?.maps.map((m) => <option key={m.id} value={m.id}>{MAP_NAMES[m.id] ?? m.name}</option>)}
            </select>
            <select data-testid="editor-type-select" value={draft.type} onChange={(e) => set({ type: e.target.value as ScenarioType })} className={field}>
              {(draft.map_id === "range" ? AIM_TYPES : MAP_TYPES).map((t) => <option key={t} value={t}>{L(...TYPE_LABEL[t])}</option>)}
            </select>
            <select data-testid="editor-diff-select" value={draft.difficulty} onChange={(e) => set({ difficulty: e.target.value as ScenarioBase["difficulty"] })} className={field}>
              {(["easy", "medium", "hard"] as const).map((d) => <option key={d} value={d}>{L(...DIFF_LABEL[d])}</option>)}
            </select>
            <label className="flex items-center gap-2 text-xs text-dim">{L("Süre (sn)", "Duration (s)")}<input data-testid="editor-duration-input" type="number" min={5} max={900} value={draft.duration} onChange={(e) => set({ duration: Math.max(5, Number(e.target.value) || 5) })} className={field + " num"} /></label>
          </div>
          <label className="flex items-center justify-between text-sm"><span>{L("Tüm botlar ateş etsin", "All bots shoot")}</span><input data-testid="editor-bots-shoot" type="checkbox" checked={draft.bots_shoot} onChange={(e) => set({ bots_shoot: e.target.checked })} className="h-4 w-4 accent-[#FF4655]" /></label>
          <div>
            <div className="overline mb-1">{L("İzin verilen silahlar (boş = hepsi)", "Allowed weapons (empty = all)")}</div>
            <div className="flex flex-wrap gap-1">{WEAPONS.map((w) => { const on = draft.allowed_weapons.includes(w.id); return (
              <button key={w.id} data-testid={`editor-weapon-${w.id}`} onClick={() => set({ allowed_weapons: on ? draft.allowed_weapons.filter((x) => x !== w.id) : [...draft.allowed_weapons, w.id] })} className={`border px-2 py-0.5 text-[11px] ${on ? "border-val bg-val/20" : "border-line text-dim"}`}>{w.name}</button>); })}</div>
          </div>
          {!isAim && (
            <div className="border-t border-line pt-3">
              <div className="flex items-center justify-between"><span className="overline">{L("Botlar", "Bots")} ({draft.bots.length})</span><span className="num text-[10px] text-dim">spawn {draft.spawn.map((v) => v.toFixed(1)).join(", ")}</span></div>
              <div className="mt-2 max-h-40 space-y-1 overflow-auto scrollbar-thin" data-testid="editor-bot-list">
                {draft.bots.map((b, i) => <button key={b.id} data-testid={`editor-bot-${i}`} onClick={() => setSel(b.id)} className={`flex w-full justify-between px-2 py-1 text-xs ${sel === b.id ? "bg-sky/20 text-white" : "text-dim hover:bg-white/5"}`}><span>Bot {i + 1} · {b.movement}</span><span className="num">{b.health}HP</span></button>)}
                {!draft.bots.length && <p className="text-xs text-dim">{L("Haritaya gir ve sol tıkla bot yerleştir.", "Enter the map and left-click to place bots.")}</p>}
              </div>
              {bot && (
                <div className="mt-3 space-y-2 border border-sky/30 p-3" data-testid="editor-bot-inspector">
                  <div className="grid grid-cols-2 gap-2">
                    <select data-testid="bot-stance-select" value={bot.stance} onChange={(e) => setBot({ stance: e.target.value as BotSpec["stance"] })} className={field}><option value="stand">{L("Ayakta", "Standing")}</option><option value="crouch">{L("Eğilmiş", "Crouched")}</option></select>
                    <select data-testid="bot-movement-select" value={bot.movement} onChange={(e) => setBot({ movement: e.target.value as BotSpec["movement"] })} className={field}><option value="static">{L("Sabit", "Static")}</option><option value="strafe">Strafe</option><option value="peek">Peek</option></select>
                    <label className="text-xs text-dim">{L("Can", "Health")}<input data-testid="bot-health-input" type="number" min={1} max={1000} value={bot.health} onChange={(e) => setBot({ health: Math.max(1, Number(e.target.value) || 1) })} className={field + " num"} /></label>
                    <label className="text-xs text-dim">{L("Hareket (m)", "Range (m)")}<input data-testid="bot-range-input" type="number" min={0} max={12} step={0.5} value={bot.move_range} onChange={(e) => setBot({ move_range: Number(e.target.value) })} className={field + " num"} /></label>
                  </div>
                  <label className="flex items-center justify-between text-sm">{L("Ateş eder", "Shoots")}<input data-testid="bot-shoots-check" type="checkbox" checked={bot.shoots} onChange={(e) => setBot({ shoots: e.target.checked })} className="h-4 w-4 accent-[#FF4655]" /></label>
                  <button data-testid="bot-delete-btn" onClick={() => { set({ bots: draft.bots.filter((b) => b.id !== sel) }); setSel(""); }} className="text-xs uppercase text-val">{L("Botu sil", "Delete bot")}</button>
                </div>
              )}
            </div>
          )}
          {!isAim && (
            <div className="border-t border-line pt-3" data-testid="editor-props">
              <div className="flex items-center justify-between"><span className="overline">{L("Harita nesneleri", "Map objects")} ({draft.props?.length ?? 0})</span><span className="text-[10px] text-dim">{L("Haritada B ile ekle", "Press B in the map")}</span></div>
              <div className="mt-2 max-h-32 space-y-1 overflow-auto scrollbar-thin">
                {(draft.props ?? []).map((x, i) => <button key={x.id} data-testid={`editor-prop-${i}`} onClick={() => setSel(x.id)} className={`flex w-full justify-between px-2 py-1 text-xs ${sel === x.id ? "bg-sky/20 text-white" : "text-dim hover:bg-white/5"}`}><span>{L("Nesne", "Object")} {i + 1}</span><span className="num">{x.size.map((v) => v.toFixed(1)).join("×")}</span></button>)}
              </div>
              {prop && (
                <div className="mt-3 space-y-2 border border-sky/30 p-3" data-testid="editor-prop-inspector">
                  <div className="grid grid-cols-3 gap-2">
                    {(["W", "H", "D"] as const).map((k, i) => <label key={k} className="text-xs text-dim">{k}<input data-testid={`prop-size-${k.toLowerCase()}`} type="number" min={0.1} max={60} step={0.1} value={prop.size[i]} onChange={(e) => { const sz = [...prop.size]; sz[i] = Math.min(60, Math.max(0.1, Number(e.target.value) || 0.1)); setProp({ size: sz }); }} className={field + " num"} /></label>)}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <label className="text-xs text-dim">{L("Yön (°)", "Yaw (°)")}<input data-testid="prop-yaw" type="number" step={15} value={Math.round((prop.yaw * 180) / Math.PI)} onChange={(e) => setProp({ yaw: ((Number(e.target.value) || 0) * Math.PI) / 180 })} className={field + " num"} /></label>
                    <label className="text-xs text-dim">{L("Renk", "Color")}<input data-testid="prop-color" type="color" value={prop.color} onChange={(e) => setProp({ color: e.target.value })} className="h-9 w-full bg-transparent" /></label>
                  </div>
                  <button data-testid="prop-delete-btn" onClick={() => { set({ props: (draft.props ?? []).filter((x) => x.id !== sel) }); setSel(""); }} className="text-xs uppercase text-val">{L("Nesneyi sil", "Delete object")}</button>
                </div>
              )}
            </div>
          )}
          <div className="flex gap-2 border-t border-line pt-4">
            <button data-testid="editor-save-btn" disabled={!draft.name.trim() || saveM.isPending} onClick={() => saveM.mutate(draft)} className="flex-1 bg-val py-2.5 font-bold uppercase disabled:opacity-40">{L("Kaydet", "Save")}</button>
            <button data-testid="editor-try-btn" disabled={!id} onClick={() => nav(`/play/${id}`)} className="flex-1 border border-white/20 py-2.5 font-semibold uppercase disabled:opacity-30">{L("Dene", "Try")}</button>
            {id && existing.data && !existing.data.builtin && <button data-testid="editor-delete-btn" onClick={() => delM.mutate()} className="border border-val/50 px-3 text-xs uppercase text-val">{L("Sil", "Delete")}</button>}
          </div>
        </div>
      </aside>
    </div>
  );
}

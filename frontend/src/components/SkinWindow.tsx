import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { getManifest, AGENT_NAMES } from "@/game/assets";
import { WEAPONS, WEAPON_BY_ID, GLB_SLOTS } from "@/game/weapons";
import { DEFAULT_VM, updateSettings, useSettings, type ViewmodelAdjust } from "@/lib/settings";
import { apiDelete, apiGet, apiUpload } from "@/lib/api";
import type { WeaponModelInfo } from "@/lib/types";
import { useL } from "@/lib/i18n";

/** Skin window: per-weapon skin, viewmodel transform, GLB override, FP agent. */
export function SkinWindow({ onClose, initial }: { onClose: () => void; initial?: string }) {
  const L = useL(); const st = useSettings(); const qc = useQueryClient();
  const [wid, setWid] = useState(initial && initial !== "knife" ? initial : "vandal");
  const man = useQuery({ queryKey: ["ka-manifest"], queryFn: getManifest, staleTime: Infinity });
  const models = useQuery({ queryKey: ["weapon-models"], queryFn: () => apiGet<WeaponModelInfo[]>("/weapon-models") });
  const skins = man.data?.weapons[wid === "knife" ? "melee" : wid] ?? [];
  const cur = st.skins[wid] ?? "default";
  const vm: ViewmodelAdjust = { ...DEFAULT_VM, ...(st.viewmodel[wid] ?? {}) };
  const setVm = (k: keyof ViewmodelAdjust, v: number) => updateSettings((d) => { d.viewmodel[wid] = { ...DEFAULT_VM, ...(d.viewmodel[wid] ?? {}), [k]: v }; });
  const custom = models.data?.find((m) => m.weapon_id === wid);
  const upload = async (f: File) => {
    const fd = new FormData(); fd.append("file", f);
    try { await apiUpload<WeaponModelInfo>(`/weapon-models/${wid}`, fd); toast.success(L("Model yüklendi", "Model uploaded")); void qc.invalidateQueries({ queryKey: ["weapon-models"] }); }
    catch { toast.error(L("Geçersiz GLB dosyası", "Invalid GLB file")); }
  };
  const slider = (k: keyof ViewmodelAdjust, label: string, min: number, max: number, step: number) => (
    <label key={k} className="grid grid-cols-[90px_1fr_52px] items-center gap-2 text-xs">
      <span className="text-dim">{label}</span>
      <input data-testid={`vm-${k}-slider`} type="range" min={min} max={max} step={step} value={vm[k]} onChange={(e) => setVm(k, Number(e.target.value))} className="accent-[#FF4655]" />
      <span className="num text-right text-sky">{vm[k].toFixed(2)}</span>
    </label>
  );
  const list = [...WEAPONS.map((w) => w.id), "knife"];
  return (
    <div className="fixed inset-0 z-40 flex bg-[#0B1015]/85 backdrop-blur-sm anim-fade-up" data-testid="skin-window">
      <nav className="w-48 overflow-auto border-r border-white/10 p-3 scrollbar-thin">
        {list.map((id) => (
          <button key={id} data-testid={`skin-weapon-${id}`} onClick={() => setWid(id)} className={`block w-full px-3 py-1.5 text-left text-sm uppercase tracking-wide ${wid === id ? "bg-val/20 text-white" : "text-dim hover:text-white"}`}>
            {id === "knife" ? L("Bıçak", "Melee") : WEAPON_BY_ID[id].name}
          </button>
        ))}
      </nav>
      <div className="flex-1 overflow-auto p-8 scrollbar-thin">
        <div className="mb-6 flex items-end justify-between">
          <div><div className="overline">{L("Kaplamalar", "Skins")}</div><h2 className="font-heading text-4xl font-black uppercase">{wid === "knife" ? L("Bıçak", "Melee") : WEAPON_BY_ID[wid].name}</h2></div>
          <button data-testid="skin-close-btn" onClick={onClose} className="bg-val px-5 py-2 text-sm font-bold uppercase">{L("Kapat", "Close")}</button>
        </div>
        <div className="grid grid-cols-4 gap-3">
          {skins.map((s) => (
            <button key={s.id} data-testid={`skin-option-${s.id}`} onClick={() => updateSettings((d) => { d.skins[wid] = s.id; })}
              className={`chamfer-sm border p-3 text-left lift ${cur === s.id ? "border-val bg-val/15" : "border-white/10 bg-white/[0.04] hover:border-white/40"}`}>
              {s.thumb && <img src={s.thumb} alt="" className="mx-auto h-20 object-contain" loading="lazy" />}
              <div className="mt-2 font-heading text-sm font-bold uppercase">{s.id === "default" ? L("Varsayılan", "Default") : s.name}</div>
              {s.tier && <span data-testid={`skin-tier-${s.id}`} className={`mt-1 inline-block px-1.5 py-0.5 text-[10px] font-bold uppercase ${s.tier === "bp" ? "bg-sky/20 text-sky" : "bg-amber-400/15 text-amber-300"}`}>{s.tier === "bp" ? "Battle Pass" : L(`Yükseltilebilir · ${s.levels?.length ?? 0} seviye`, `Upgradeable · ${s.levels?.length ?? 0} levels`)}</span>}
            </button>
          ))}
          {!skins.length && <p className="text-dim">{L("Bu silah için kaplama bulunamadı.", "No skins for this weapon.")}</p>}
        </div>
        {(() => { const sel = skins.find((x) => x.id === cur); return sel?.levels?.length ? (
          <div className="mt-4 tac-panel p-4 text-sm" data-testid="skin-levels">
            <div className="overline mb-2">{L("Orijinal oyundaki yükseltme seviyeleri", "Upgrade levels in the original game")}</div>
            <div className="flex flex-wrap gap-2">{sel.levels.map((lv, i) => <span key={i} className={`border px-2 py-1 text-xs ${i === 0 ? "border-val text-white" : "border-white/10 text-dim"}`}>{L("Seviye", "Level")} {i + 1} · {lv}</span>)}</div>
            <p className="mt-2 text-xs text-dim">{L("Bu projede yalnızca Seviye 1 (temel model + kaplama) mevcut; VFX / animasyon / özel ses seviyelerinin dosyaları arşivde yok, bu yüzden açılmış gibi gösterilmez.", "Only level 1 (base model + textures) exists in this project; VFX / animation / sound level files are not in the archive, so they are not shown as unlocked.")}</p>
          </div>) : null; })()}
        <div className="mt-8 grid grid-cols-2 gap-8">
          <section className="tac-panel p-5">
            <div className="overline mb-3">{L("Ekrandaki konum", "Viewmodel")}</div>
            <div className="space-y-2">
              {slider("px", L("Sağ/Sol", "X"), -0.2, 0.2, 0.005)}{slider("py", L("Yukarı/Aşağı", "Y"), -0.2, 0.2, 0.005)}{slider("pz", L("İleri/Geri", "Z"), -0.3, 0.3, 0.005)}
              {slider("rx", L("Eğim", "Pitch"), -45, 45, 1)}{slider("ry", L("Yön", "Yaw"), -90, 90, 1)}{slider("rz", L("Yatış", "Roll"), -45, 45, 1)}{slider("scale", L("Boyut", "Scale"), 0.5, 1.8, 0.01)}
            </div>
            <button data-testid="vm-reset-btn" onClick={() => updateSettings((d) => { delete d.viewmodel[wid]; })} className="mt-3 text-xs uppercase text-dim hover:text-white">{L("Sıfırla", "Reset")}</button>
          </section>
          <section className="tac-panel p-5">
            <div className="overline mb-3">{L("Kendi modelin (GLB)", "Custom model (GLB)")}</div>
            <p className="text-xs text-dim">{GLB_SLOTS.includes(wid) ? L("Önerilen yükleme yuvası.", "Recommended upload slot.") : L("İsteğe bağlı.", "Optional.")} {L("Yüklenen model arşiv modelinin yerine geçer.", "Overrides the archive model.")}</p>
            {custom ? <p className="mt-2 text-sm" data-testid="custom-model-info">{custom.filename} · <span className="num text-sky">{(custom.size / 1e6).toFixed(1)} MB</span></p> : null}
            <div className="mt-3 flex gap-2">
              <label className="cursor-pointer border border-white/20 px-4 py-2 text-xs font-semibold uppercase hover:bg-white/10">
                {L("GLB yükle", "Upload GLB")}<input data-testid="glb-upload-input" type="file" accept=".glb" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void upload(f); }} />
              </label>
              {custom && <button data-testid="glb-delete-btn" onClick={async () => { await apiDelete(`/weapon-models/${wid}`); void qc.invalidateQueries({ queryKey: ["weapon-models"] }); }} className="border border-val/50 px-4 py-2 text-xs uppercase text-val">{L("Kaldır", "Remove")}</button>}
            </div>
            <div className="overline mb-2 mt-6">{L("Birinci şahıs ajanı", "First-person agent")}</div>
            <select data-testid="fp-agent-select" value={st.fpAgent} onChange={(e) => updateSettings((d) => { d.fpAgent = e.target.value; })} className="w-full border border-white/15 bg-panel2 px-3 py-2 text-sm">
              {(man.data?.fp ?? ["jett"]).map((a) => <option key={a} value={a}>{AGENT_NAMES[a] ?? a}</option>)}
            </select>
          </section>
        </div>
      </div>
    </div>
  );
}

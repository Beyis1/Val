import { useQuery } from "@tanstack/react-query";
import { BUY_COLUMNS, SHIELDS, WEAPON_BY_ID, damageAt, isSidearm, type ShieldId } from "@/game/weapons";
import { getManifest } from "@/game/assets";
import { DEFAULT_LOADOUT, updateSettings, useSettings } from "@/lib/settings";
import { useL } from "@/lib/i18n";
import { useState } from "react";
import { WeaponPreview } from "@/components/WeaponPreview";
import { Check, Palette } from "lucide-react";

const CAT: Record<string, [string, string]> = {
  sidearm: ["Tabancalar", "Sidearms"], smg: ["SMG", "SMGs"], shotgun: ["Pompalılar", "Shotguns"], rifle: ["Tüfekler", "Rifles"],
  sniper: ["Keskin Nişancı", "Snipers"], heavy: ["Makineli", "Heavy"],
};

/** Valorant-style buy menu: weapons + shields only (no credits). */
export function BuyMenu({ allowed, onClose, onEquip, onSkin }: { allowed?: string[]; onClose: () => void; onEquip?: (primary: string | null, secondary: string) => void; onSkin?: () => void }) {
  const L = useL(); const st = useSettings();
  const [sel, setSel] = useState<string>(st.loadout.primary ?? st.loadout.secondary);
  const man = useQuery({ queryKey: ["ka-manifest"], queryFn: getManifest, staleTime: Infinity });
  const w = WEAPON_BY_ID[sel];
  const ok = (id: string) => !allowed?.length || allowed.includes(id);
  const buy = (id: string) => {
    if (!ok(id)) return;
    setSel(id);
    updateSettings((d) => { if (isSidearm(id)) d.loadout.secondary = id; else d.loadout.primary = id; });
    const lo = { ...st.loadout, ...(isSidearm(id) ? { secondary: id } : { primary: id }) };
    onEquip?.(lo.primary, lo.secondary);
  };
  const shield = (id: ShieldId) => updateSettings((d) => { d.loadout.shield = d.loadout.shield === id ? "none" : id; });
  const thumb = (id: string) => man.data?.weapons[id]?.[0]?.thumb;
  const skinOf = (id: string) => st.skins[id] ?? "default";
  const skinName = (id: string) => { const k = skinOf(id); return k === "default" ? L("Standart", "Standard") : man.data?.weapons[id]?.find((x) => x.id === k)?.name ?? k; };
  const card = (id: string) => {
    const x = WEAPON_BY_ID[id]; const eq = st.loadout.primary === id || st.loadout.secondary === id; const on = sel === id;
    return (
      <button key={id} data-testid={`buy-weapon-${id}`} onClick={() => buy(id)} onMouseEnter={() => setSel(id)} disabled={!ok(id)}
        className={`group relative flex h-[92px] flex-col justify-between overflow-hidden border px-3 py-2 text-left transition-[border-color,background-color,transform] duration-150 hover:-translate-y-0.5 disabled:opacity-25 ${eq ? "border-val bg-val/[0.16]" : on ? "border-white/50 bg-white/[0.08]" : "border-white/[0.08] bg-[#121922]/80 hover:border-white/30"}`}>
        <div className="flex items-start justify-between">
          <span className="font-heading text-[13px] font-bold uppercase tracking-[0.12em]">{x.name}</span>
          {eq ? <Check size={14} className="text-val" /> : <span className="num text-[10px] text-dim">{x.mag}</span>}
        </div>
        {thumb(id) ? <img src={thumb(id)} alt="" className="mx-auto h-11 object-contain opacity-80 transition-[opacity,transform] duration-200 group-hover:scale-105 group-hover:opacity-100" loading="lazy" /> : <div className="h-11" />}
        {eq && <span className="absolute bottom-0 left-0 h-[3px] w-full bg-val" />}
      </button>
    );
  };
  return (
    <div className="fixed inset-0 z-40 flex bg-[#0B1015]/80 backdrop-blur-sm anim-fade-up" data-testid="buy-menu">
      <div className="flex-1 overflow-auto p-8 scrollbar-thin">
        <div className="mb-6 flex items-end justify-between">
          <div><div className="overline">{L("Kredisiz · B ile aç/kapat", "No credits · toggle with B")}</div><h2 className="font-heading text-4xl font-black uppercase">{L("Silahlar", "Weapons")}</h2></div>
          <div className="mx-6 flex flex-1 gap-2" data-testid="buy-loadout">
            {([["1", st.loadout.primary, L("Ana silah", "Primary")], ["2", st.loadout.secondary, L("Tabanca", "Sidearm")]] as const).map(([k, id, lbl]) => (
              <div key={k} className="flex min-w-[170px] items-center gap-3 border border-white/10 bg-white/[0.04] px-3 py-2">
                <span className="num grid h-7 w-7 place-items-center bg-white/10 text-sm font-bold">{k}</span>
                <div><div className="text-[10px] uppercase text-dim">{lbl}</div><div className="font-heading text-sm font-bold uppercase" data-testid={`buy-loadout-${k}`}>{id ? WEAPON_BY_ID[id]?.name : "—"}</div></div>
              </div>))}
          </div>
          <div className="flex gap-2">
            <button data-testid="buy-default-btn" onClick={() => { updateSettings((d) => { d.loadout = structuredClone(DEFAULT_LOADOUT); }); onEquip?.(DEFAULT_LOADOUT.primary, DEFAULT_LOADOUT.secondary); setSel("vandal"); }} className="border border-white/20 px-4 py-2 text-sm font-semibold uppercase hover:bg-white/10">{L("Varsayılan", "Default")}</button>
            <button data-testid="buy-close-btn" onClick={onClose} className="bg-val px-5 py-2 text-sm font-bold uppercase">{L("Kapat (B)", "Close (B)")}</button>
          </div>
        </div>
        <div className="grid grid-cols-6 gap-4">
          {BUY_COLUMNS.map((c) => (
            <div key={c.key} className="flex flex-col gap-2">
              <div className="overline !text-dim">{L(...CAT[c.key])}</div>
              {c.ids.map(card)}
            </div>
          ))}
        </div>
        <div className="mt-6 grid max-w-xl grid-cols-3 gap-3">
          {SHIELDS.map((s) => (
            <button key={s.id} data-testid={`buy-shield-${s.id}`} onClick={() => shield(s.id)} className={`chamfer-sm border px-3 py-3 text-left lift ${st.loadout.shield === s.id ? "border-val bg-val/20" : "border-white/10 bg-white/[0.04]"}`}>
              <div className="font-heading text-sm font-bold uppercase">{s.id === "light" ? L("Hafif Zırh", "Light Shields") : s.id === "regen" ? L("Yenilenen Zırh", "Regen Shield") : L("Ağır Zırh", "Heavy Shields")}</div>
              <div className="num text-xs text-sky">+{s.armor} {s.regenPool ? `(${s.regenPool} regen)` : ""}</div>
            </button>
          ))}
        </div>
      </div>
      {w && (
        <aside className="w-[420px] overflow-auto border-l border-white/10 bg-[#0d1319]/95 p-7 scrollbar-thin anim-fade-up" data-testid="buy-detail-panel">
          <div className="overline">{L(...CAT[w.category] ?? ["", ""])}</div>
          <h3 className="font-heading text-4xl font-black uppercase leading-none" data-testid="buy-detail-name">{w.name}</h3>
          <div className="relative my-4 h-52 border border-white/[0.06] bg-[radial-gradient(ellipse_at_center,rgba(255,255,255,0.07),transparent_70%)]">
            <WeaponPreview weaponId={w.id} skin={skinOf(w.id)} className="absolute inset-0" />
            <span className="pointer-events-none absolute bottom-2 left-3 text-[10px] uppercase tracking-widest text-dim">{L("Sürükle: döndür", "Drag to rotate")}</span>
          </div>
          <div className="mb-4 flex items-center justify-between border border-white/10 px-3 py-2">
            <div><div className="text-[10px] uppercase text-dim">{L("Kaplama", "Skin")}</div><div className="font-heading text-sm font-bold uppercase" data-testid="buy-detail-skin">{skinName(w.id)}</div></div>
            {onSkin && <button data-testid="buy-skin-btn" onClick={onSkin} className="flex items-center gap-1.5 border border-white/20 px-3 py-1.5 text-xs font-bold uppercase transition-colors duration-150 hover:bg-white/10"><Palette size={13} />{L("Değiştir", "Change")}</button>}
          </div>
          <button data-testid="buy-equip-btn" onClick={() => buy(w.id)} disabled={!ok(w.id)} className={`mb-5 w-full py-3 font-heading text-sm font-black uppercase tracking-wider transition-[background-color,transform] duration-150 hover:scale-[1.01] disabled:opacity-30 ${st.loadout.primary === w.id || st.loadout.secondary === w.id ? "border border-val text-val" : "bg-val"}`}>
            {st.loadout.primary === w.id || st.loadout.secondary === w.id ? L("Kuşanıldı", "Equipped") : L("Kuşan", "Equip")}
          </button>
          <div className="mb-4 space-y-2" data-testid="buy-stat-bars">
            {([[L("Atış hızı", "Fire rate"), w.fireRate / 16], [L("Gövde hasarı", "Body damage"), (damageAt(w, 0).body * (w.pellets ?? 1)) / 160], [L("Kafa hasarı", "Head damage"), damageAt(w, 0).head / 255], [L("Şarjör", "Magazine"), w.mag / 100], [L("Duvar delme", "Wall pen."), w.pen === "high" ? 1 : w.pen === "medium" ? 0.6 : 0.3]] as const).map(([k, v]) => (
              <div key={k} className="grid grid-cols-[96px_1fr] items-center gap-2 text-xs"><span className="text-dim">{k}</span><div className="h-1.5 bg-white/10"><div className="h-full bg-sky transition-[width] duration-300" style={{ width: `${Math.min(100, Math.max(6, v * 100))}%` }} /></div></div>))}
          </div>
          <dl className="grid grid-cols-2 gap-y-2 text-sm">
            <dt className="text-dim">{L("Atış hızı", "Fire rate")}</dt><dd className="num text-sky">{w.fireRate} /s</dd>
            <dt className="text-dim">{L("Şarjör", "Magazine")}</dt><dd className="num text-sky">{w.mag}</dd>
            <dt className="text-dim">{L("Koşu hızı", "Run speed")}</dt><dd className="num text-sky">{w.runSpeed} m/s</dd>
            <dt className="text-dim">{L("Şarjör değiştirme", "Reload")}</dt><dd className="num text-sky">{w.reload} s</dd>
            <dt className="text-dim">{L("Silah çekme", "Equip")}</dt><dd className="num text-sky">{w.equip} s</dd>
            <dt className="text-dim">{L("Ateş modu", "Fire mode")}</dt><dd className="text-sky">{w.auto ? L("Otomatik", "Auto") : L("Tekli", "Semi")}{w.pellets ? ` · ${w.pellets} ${L("saçma", "pellets")}` : ""}</dd>
          </dl>
          <table className="mt-5 w-full text-sm">
            <thead><tr className="text-dim"><th className="text-left font-normal">{L("Mesafe", "Range")}</th><th>{L("Kafa", "Head")}</th><th>{L("Gövde", "Body")}</th><th>{L("Bacak", "Leg")}</th></tr></thead>
            <tbody>{w.damage.map((b, i) => { const lo = i ? w.damage[i - 1].max : 0; const d = damageAt(w, b.max); return (
              <tr key={i} className="num border-t border-white/5"><td className="py-1">{lo}-{b.max}m</td><td className="text-center text-val">{d.head}</td><td className="text-center">{d.body}</td><td className="text-center">{d.leg}</td></tr>); })}</tbody>
          </table>
          {w.pellets && <p className="mt-2 text-xs text-dim">{L(`Saçma başına (${w.pellets} saçma)`, `Per pellet (${w.pellets} pellets)`)}</p>}
        </aside>
      )}
    </div>
  );
}

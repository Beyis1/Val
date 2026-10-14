import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { Star, PenTool, Megaphone, Palette } from "lucide-react";
import { useSettings, useSettingsBootstrap, updateSettings, cmPer360, useSaveStatus } from "@/lib/settings";
import { useL } from "@/lib/i18n";
import { SkinWindow } from "@/components/SkinWindow";

export default function AppShell() {
  useSettingsBootstrap();
  const st = useSettings(); const L = useL(); const nav = useNavigate(); const save = useSaveStatus();
  const [sensOpen, setSensOpen] = useState(false); const [overlay, setOverlay] = useState<"" | "skin">("");
  useEffect(() => {
    document.documentElement.style.fontSize = `${16 * st.textScale}px`;
    document.documentElement.classList.toggle("hc", st.highContrast);
    document.documentElement.lang = st.language;
  }, [st.textScale, st.highContrast, st.language]);
  const tab = ({ isActive }: { isActive: boolean }) =>
    `relative px-5 py-5 font-heading text-sm font-bold uppercase tracking-[0.18em] transition-colors ${isActive ? "text-white after:absolute after:inset-x-3 after:bottom-0 after:h-[3px] after:bg-val" : "text-dim hover:text-white"}`;
  const rail = ({ isActive }: { isActive: boolean }) =>
    `flex flex-col items-center gap-1 px-2 py-3 text-[10px] font-semibold uppercase tracking-wider transition-colors ${isActive ? "bg-val/15 text-white" : "text-dim hover:text-white"}`;
  return (
    <div className="flex min-h-screen bg-tactical">
      <aside className="sticky top-0 flex h-screen w-[84px] flex-col border-r border-line bg-[#0E141C]">
        <button data-testid="logo-btn" onClick={() => nav("/")} className="grid h-[68px] place-items-center border-b border-line font-heading text-lg font-black text-val">VA</button>
        <NavLink to="/favorites" className={rail} data-testid="rail-favorites"><Star size={18} />{L("Favoriler", "Favorites")}</NavLink>
        <NavLink to="/editor" className={rail} data-testid="rail-editor"><PenTool size={18} />{L("Editör", "Editor")}</NavLink>
        <button onClick={() => setOverlay("skin")} className={rail({ isActive: false })} data-testid="rail-skins"><Palette size={18} />{L("Kaplama", "Skins")}</button>
        <NavLink to="/updates" className={rail} data-testid="rail-updates"><Megaphone size={18} />{L("Güncel", "Updates")}</NavLink>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-[68px] items-center border-b border-line bg-[#0B1015]/90 px-6 backdrop-blur">
          <span className="mr-6 font-heading text-xl font-black tracking-tight">VAL<span className="text-val">AIM</span></span>
          <nav className="flex">
            <NavLink to="/" end className={tab} data-testid="nav-workshop">{L("Atölye", "Workshop")}</NavLink>
            <NavLink to="/records" className={tab} data-testid="nav-records">{L("Kayıtlar", "Records")}</NavLink>
            <NavLink to="/settings" className={tab} data-testid="nav-settings">{L("Ayarlar", "Settings")}</NavLink>
          </nav>
          <div className="ml-auto flex items-center gap-3">
            <span className="text-[10px] uppercase text-dim" data-testid="save-status">{save === "saving" ? L("Kaydediliyor…", "Saving…") : save === "saved" ? L("Kaydedildi", "Saved") : ""}</span>
            <button data-testid="lang-toggle" onClick={() => updateSettings((d) => { d.language = d.language === "tr" ? "en" : "tr"; })} className="border border-line px-3 py-2 text-xs font-bold uppercase hover:border-white/40">{st.language === "tr" ? "TR" : "EN"}</button>
            <div className="relative">
              <button data-testid="sens-quick-btn" onClick={() => setSensOpen((v) => !v)} className="flex items-center gap-2 border border-line bg-panel px-3 py-2 text-xs uppercase">
                {L("Hassasiyet", "Sens")} <span className="num text-base font-bold text-sky">{st.sensitivity.toFixed(3)}</span>
              </button>
              {sensOpen && (
                <div className="absolute right-0 top-12 w-72 tac-panel p-4 anim-fade-up" data-testid="sens-popover">
                  <input data-testid="sens-quick-input" type="number" step="0.001" min="0.01" value={st.sensitivity} onChange={(e) => updateSettings((d) => { d.sensitivity = Math.max(0.01, Number(e.target.value) || 0.01); })} className="num w-full border border-line bg-panel2 px-3 py-2 text-lg text-sky" />
                  <input type="range" min="0.05" max="2" step="0.005" value={st.sensitivity} onChange={(e) => updateSettings((d) => { d.sensitivity = Number(e.target.value); })} className="mt-3 w-full accent-[#FF4655]" />
                  <div className="mt-2 flex justify-between text-xs text-dim"><span>eDPI <b className="num text-sky">{Math.round(st.sensitivity * st.dpi)}</b></span><span>cm/360 <b className="num text-sky">{cmPer360(st.sensitivity, st.dpi).toFixed(1)}</b></span></div>
                </div>
              )}
            </div>
          </div>
        </header>
        <main className="min-w-0 flex-1"><Outlet /></main>
      </div>
      {overlay === "skin" && <SkinWindow onClose={() => setOverlay("")} />}
    </div>
  );
}

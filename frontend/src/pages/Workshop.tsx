import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Star, Pencil, Play } from "lucide-react";
import { apiGet, apiPost } from "@/lib/api";
import type { Scenario } from "@/lib/types";
import { useSettings } from "@/lib/settings";
import { RangeArt } from "@/components/RangeArt";
import { useL, TYPE_LABEL, DIFF_LABEL, MAP_NAMES, mapThumb } from "@/lib/i18n";

const DIFF_COLOR: Record<string, string> = { easy: "text-emerald-400 border-emerald-400/40", medium: "text-amber-400 border-amber-400/40", hard: "text-val border-val/50" };
const ORDER = ["range", "sandbox", "ascent", "bind", "haven", "split", "icebox", "breeze", "fracture", "pearl", "lotus", "sunset", "abyss"];

export default function Workshop({ favorites = false }: { favorites?: boolean }) {
  const L = useL(); const st = useSettings(); const nav = useNavigate(); const qc = useQueryClient();
  const q = useQuery({ queryKey: ["scenarios"], queryFn: () => apiGet<Scenario[]>("/scenarios") });
  const fav = useMutation({
    mutationFn: (s: Scenario) => apiPost<Scenario>(`/scenarios/${s.id}/favorite`, { favorite: !s.favorite }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["scenarios"] }),
  });
  const [map, setMap] = useState("all"); const [search, setSearch] = useState(""); const [unplayed, setUnplayed] = useState(false);
  const [onlyFav, setOnlyFav] = useState(favorites); const [sort, setSort] = useState<"rec" | "pop" | "new">("rec");
  const nm = (s: Scenario) => (st.language === "en" && s.name_en ? s.name_en : s.name);
  const maps = useMemo(() => ORDER.filter((m) => q.data?.some((s) => s.map_id === m)), [q.data]);
  const groups = useMemo(() => {
    let list = q.data ?? [];
    if (map !== "all") list = list.filter((s) => s.map_id === map);
    if (search) list = list.filter((s) => nm(s).toLowerCase().includes(search.toLowerCase()));
    if (unplayed) list = list.filter((s) => s.play_count === 0);
    if (onlyFav || favorites) list = list.filter((s) => s.favorite);
    const d = { easy: 0, medium: 1, hard: 2 };
    list = [...list].sort((a, b) => sort === "pop" ? b.play_count - a.play_count : sort === "new" ? b.created_at.localeCompare(a.created_at) : Number(a.builtin) === Number(b.builtin) ? d[a.difficulty] - d[b.difficulty] : Number(b.builtin) - Number(a.builtin));
    return ORDER.map((m) => [m, list.filter((s) => s.map_id === m)] as const).filter(([, l]) => l.length);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q.data, map, search, unplayed, onlyFav, favorites, sort, st.language]);
  const chip = (on: boolean) => `border px-3 py-1.5 text-xs font-semibold uppercase tracking-wider transition-colors ${on ? "border-val bg-val/15 text-white" : "border-line text-dim hover:text-white"}`;
  return (
    <div className="px-8 py-8">
      <div className="anim-fade-up">
        <div className="overline">{favorites ? L("Kaydedilenler", "Saved") : L("Senaryo kütüphanesi", "Scenario library")}</div>
        <h1 className="font-heading text-5xl font-black uppercase tracking-tight" data-testid="workshop-title">{favorites ? L("Favoriler", "Favorites") : L("Atölye", "Workshop")}</h1>
      </div>
      <div className="mt-6 flex flex-wrap items-center gap-2">
        <input data-testid="workshop-search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder={L("Senaryo ara…", "Search scenarios…")} className="w-64 border border-line bg-panel px-3 py-2 text-sm outline-none focus:border-val" />
        <button data-testid="filter-map-all" onClick={() => setMap("all")} className={chip(map === "all")}>{L("Tümü", "All")}</button>
        {maps.map((m) => <button key={m} data-testid={`filter-map-${m}`} onClick={() => setMap(m)} className={chip(map === m)}>{MAP_NAMES[m]}</button>)}
        <span className="mx-2 h-6 w-px bg-line" />
        <button data-testid="filter-unplayed" onClick={() => setUnplayed((v) => !v)} className={chip(unplayed)}>{L("Oynanmadı", "Unplayed")}</button>
        {!favorites && <button data-testid="filter-favorites" onClick={() => setOnlyFav((v) => !v)} className={chip(onlyFav)}>{L("Favoriler", "Favorites")}</button>}
        <select data-testid="workshop-sort" value={sort} onChange={(e) => setSort(e.target.value as "rec" | "pop" | "new")} className="ml-auto border border-line bg-panel px-3 py-2 text-xs uppercase">
          <option value="rec">{L("Önerilen", "Recommended")}</option><option value="pop">{L("Popüler", "Popular")}</option><option value="new">{L("En yeni", "Newest")}</option>
        </select>
      </div>
      {q.isLoading && <p className="mt-10 text-dim">…</p>}
      {!q.isLoading && !groups.length && <p className="mt-10 text-dim" data-testid="workshop-empty">{L("Eşleşen senaryo yok.", "No matching scenarios.")}</p>}
      {groups.map(([m, list]) => (
        <section key={m} className="mt-10" data-testid={`map-group-${m}`}>
          <div className="mb-3 flex items-baseline gap-3"><h2 className="font-heading text-2xl font-black uppercase">{MAP_NAMES[m]}</h2><span className="num text-xs text-dim">{list.length}</span></div>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(270px,1fr))] gap-4">
            {list.map((s, i) => (
              <article key={s.id} data-testid={`scenario-card-${s.id}`} className="group chamfer relative cursor-pointer overflow-hidden border border-line bg-panel lift hover:border-val/60 anim-fade-up" style={{ animationDelay: `${i * 30}ms` }} onClick={() => nav(`/play/${s.id}`)}>
                <div className="relative h-36 overflow-hidden bg-panel2">
                  {s.map_id === "range" || s.map_id === "sandbox" ? <RangeArt type={s.type} className="h-full w-full transition-transform duration-500 group-hover:scale-105" /> :
                    <img src={mapThumb(s.map_id, s.type)} alt="" loading="lazy" className="h-full w-full object-cover opacity-80 transition-transform duration-500 group-hover:scale-105" onError={(e) => { e.currentTarget.style.visibility = "hidden"; }} />}
                  <div className="absolute inset-0 bg-gradient-to-t from-panel via-transparent" />
                  <span className="absolute left-3 top-3 bg-black/60 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider">{L(...TYPE_LABEL[s.type])}</span>
                  <button data-testid={`fav-btn-${s.id}`} onClick={(e) => { e.stopPropagation(); fav.mutate(s); }} className="absolute right-3 top-3 grid h-8 w-8 place-items-center bg-black/60 hover:bg-black/80"><Star size={15} className={s.favorite ? "fill-val text-val" : "text-white"} /></button>
                  <div className="absolute bottom-2 right-3 grid h-10 w-10 place-items-center bg-val opacity-0 transition-opacity group-hover:opacity-100"><Play size={16} /></div>
                </div>
                <div className="p-4">
                  <h3 className="font-heading text-lg font-bold leading-tight" data-testid={`scenario-name-${s.id}`}>{nm(s)}</h3>
                  <div className="mt-3 flex items-center gap-3 text-xs">
                    <span className={`border px-2 py-0.5 font-semibold uppercase ${DIFF_COLOR[s.difficulty]}`}>{L(...DIFF_LABEL[s.difficulty])}</span>
                    <span className="text-dim">{L("En iyi", "Best")} <b className="num text-sky">{s.best_score ?? "—"}</b></span>
                    <span className="text-dim">{L("Oynanma", "Plays")} <b className="num text-white">{s.play_count}</b></span>
                    {!s.builtin && <button data-testid={`edit-btn-${s.id}`} onClick={(e) => { e.stopPropagation(); nav(`/editor/${s.id}`); }} className="ml-auto text-dim hover:text-white"><Pencil size={14} /></button>}
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

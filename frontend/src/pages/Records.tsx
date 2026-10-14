import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { apiGet } from "@/lib/api";
import type { GameRecord, RecordsSummary } from "@/lib/types";
import { useL, MAP_NAMES, TYPE_LABEL } from "@/lib/i18n";

export default function Records() {
  const L = useL();
  const sum = useQuery({ queryKey: ["records", "summary"], queryFn: () => apiGet<RecordsSummary>("/records/summary") });
  const recs = useQuery({ queryKey: ["records", "list"], queryFn: () => apiGet<GameRecord[]>("/records?limit=500") });
  const [sid, setSid] = useState("");
  const s = sum.data;
  const scen = sid || s?.best[0]?.scenario_id || "";
  const series = useMemo(() => (recs.data ?? []).filter((r) => r.scenario_id === scen).reverse().map((r, i) => ({ i: i + 1, score: r.score, acc: r.accuracy })), [recs.data, scen]);
  const stat = (k: string, v: string | number, tid: string) => (
    <div className="tac-panel p-5" data-testid={tid}><div className="text-xs uppercase text-dim">{k}</div><div className="num mt-1 text-3xl font-bold text-sky">{v}</div></div>
  );
  return (
    <div className="px-8 py-8">
      <div className="overline">{L("İlerleme", "Progress")}</div>
      <h1 className="font-heading text-5xl font-black uppercase">{L("Kayıtlar", "Records")}</h1>
      <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-6">
        {stat(L("Tur", "Rounds"), s?.total_rounds ?? 0, "stat-rounds")}
        {stat(L("Öldürme", "Kills"), s?.total_kills ?? 0, "stat-kills")}
        {stat(L("Ort. isabet", "Avg accuracy"), `${s?.avg_accuracy ?? 0}%`, "stat-accuracy")}
        {stat(L("Ort. kafa", "Avg headshot"), `${s?.avg_headshot_rate ?? 0}%`, "stat-headshot")}
        {stat(L("Ort. tepki", "Avg reaction"), s?.avg_reaction_ms ? `${Math.round(s.avg_reaction_ms)}ms` : "—", "stat-reaction")}
        {stat(L("Toplam süre", "Total time"), `${Math.round((s?.total_time_sec ?? 0) / 60)} dk`, "stat-time")}
      </div>
      <div className="mt-8 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <section className="tac-panel p-5">
          <div className="mb-3 flex items-center justify-between">
            <div className="overline">{L("Gelişim grafiği", "Progress chart")}</div>
            <select data-testid="records-scenario-select" value={scen} onChange={(e) => setSid(e.target.value)} className="border border-line bg-panel2 px-2 py-1 text-xs">
              {s?.best.map((b) => <option key={b.scenario_id} value={b.scenario_id}>{b.scenario_name}</option>)}
            </select>
          </div>
          <div className="h-64" data-testid="records-chart">
            {series.length ? (
              <ResponsiveContainer><LineChart data={series}><CartesianGrid stroke="#223142" /><XAxis dataKey="i" stroke="#8A99A8" /><YAxis stroke="#8A99A8" /><Tooltip contentStyle={{ background: "#121921", border: "1px solid #223142" }} /><Line type="monotone" dataKey="score" stroke="#FF4655" strokeWidth={2} dot={false} /><Line type="monotone" dataKey="acc" stroke="#38BDF8" dot={false} /></LineChart></ResponsiveContainer>
            ) : <p className="grid h-full place-items-center text-dim">{L("Henüz kayıt yok. Bir senaryo oyna!", "No records yet. Play a scenario!")}</p>}
          </div>
        </section>
        <section className="tac-panel p-5">
          <div className="overline mb-3">{L("En iyi skorlar", "Best scores")}</div>
          <div className="max-h-64 space-y-1 overflow-auto scrollbar-thin" data-testid="records-best-list">
            {s?.best.map((b) => (
              <div key={b.scenario_id} className="flex items-center justify-between border-b border-white/5 py-1.5 text-sm">
                <span>{b.scenario_name} <span className="text-xs text-dim">· {MAP_NAMES[b.map_id] ?? b.map_id}</span></span>
                <span className="num text-sky">{b.best_score} <span className="text-xs text-dim">×{b.plays}</span></span>
              </div>
            ))}
          </div>
        </section>
      </div>
      <section className="mt-8 tac-panel p-5">
        <div className="overline mb-3">{L("Son turlar", "Recent rounds")}</div>
        <table className="w-full text-sm" data-testid="records-table">
          <thead className="text-left text-xs uppercase text-dim"><tr><th className="py-2">{L("Senaryo", "Scenario")}</th><th>{L("Tür", "Type")}</th><th>{L("Skor", "Score")}</th><th>{L("İsabet", "Acc")}</th><th>{L("Kafa", "HS")}</th><th>{L("Tepki", "React")}</th><th>{L("Öldürme", "Kills")}</th><th>{L("Süre", "Time")}</th><th>{L("Tarih", "Date")}</th></tr></thead>
          <tbody className="num">
            {(recs.data ?? []).slice(0, 40).map((r) => (
              <tr key={r.id} className="border-t border-white/5"><td className="py-1.5 font-sans">{r.scenario_name}</td><td className="font-sans text-dim">{TYPE_LABEL[r.type] ? L(...TYPE_LABEL[r.type]) : r.type}</td>
                <td className="text-sky">{r.score}</td><td>{r.accuracy}%</td><td>{r.headshot_rate}%</td><td>{r.avg_reaction_ms ? `${Math.round(r.avg_reaction_ms)}ms` : "—"}</td><td>{r.kills}</td><td>{r.duration_sec}s</td>
                <td className="text-dim">{new Date(r.created_at).toLocaleString()}</td></tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}

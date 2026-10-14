import { useL } from "@/lib/i18n";

const ENTRIES: { v: string; date: string; tr: string[]; en: string[] }[] = [
  { v: "1.0", date: "2026-10-14", tr: ["11 Valorant haritası tarayıcıda oynanabilir", "Kingdom Archives ajan rakipleri ve birinci şahıs kollar", "Kredisiz market ve ayrı kaplama penceresi", "Ön-nişan, açı tutma, Spike; Gridshot, Flick, Tracking, Strafe Bot", "120 FPS hedefli otomatik çözünürlük ölçeği (%90 taban)"],
    en: ["11 Valorant maps playable in the browser", "Kingdom Archives agent opponents and first-person arms", "Credit-free buy menu and separate skin window", "Pre-aim, angle hold, Spike; Gridshot, Flick, Tracking, Strafe Bot", "120 FPS targeted automatic render scale (90% floor)"] },
];

export default function Updates() {
  const L = useL();
  return (
    <div className="max-w-3xl px-8 py-8">
      <div className="overline">{L("Sürüm notları", "Patch notes")}</div>
      <h1 className="font-heading text-5xl font-black uppercase">{L("Güncellemeler", "Updates")}</h1>
      {ENTRIES.map((e) => (
        <article key={e.v} className="mt-8 tac-panel p-6" data-testid={`update-${e.v}`}>
          <div className="flex items-baseline gap-3"><h2 className="font-heading text-2xl font-black">v{e.v}</h2><span className="num text-xs text-dim">{e.date}</span></div>
          <ul className="mt-3 list-disc space-y-1 pl-5 text-dim">{(L("tr", "en") === "tr" ? e.tr : e.en).map((x) => <li key={x}>{x}</li>)}</ul>
        </article>
      ))}
    </div>
  );
}

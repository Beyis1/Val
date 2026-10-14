import { useSettings } from "@/lib/settings";

/** Inline bilingual helper: L("Türkçe", "English"). */
export function useL() {
  const lang = useSettings().language;
  return (tr: string, en: string) => (lang === "en" ? en : tr);
}

export const TYPE_LABEL: Record<string, [string, string]> = {
  preaim: ["Ön-Nişan", "Pre-aim"], hold: ["Açı Tutma", "Angle Hold"], spike: ["Spike", "Spike"], gridshot: ["Gridshot", "Gridshot"],
  flick: ["Flick", "Flick"], tracking: ["Takip", "Tracking"], strafe: ["Strafe Bot", "Strafe Bot"],
};
export const DIFF_LABEL: Record<string, [string, string]> = { easy: ["Kolay", "Easy"], medium: ["Orta", "Medium"], hard: ["Zor", "Hard"] };
export const MAP_NAMES: Record<string, string> = {
  range: "Range", sandbox: "Sandbox", abyss: "Abyss", ascent: "Ascent", bind: "Bind", breeze: "Breeze", fracture: "Fracture", haven: "Haven",
  icebox: "Icebox", lotus: "Lotus", pearl: "Pearl", split: "Split", sunset: "Sunset",
};
export const mapThumb = (id: string, _type?: string) =>
  id === "range" || id === "sandbox" ? "" : `/maps/${id}/thumb.jpg`;

import type { CrosshairStyle } from "@/game/crosshair";

/** SVG render of a Valorant-style crosshair. bloom 0..1 widens lines with movement/firing error. */
export function CrosshairView({ s, scale = 1, bloom = 0 }: { s: CrosshairStyle; scale?: number; bloom?: number }) {
  const parts: React.ReactNode[] = [];
  const o = s.outlineThickness;
  const line = (key: string, L: CrosshairStyle["inner"], extra: number) => {
    if (!L.show) return;
    const off = L.offset + (L.movementError || L.firingError ? extra : 0);
    const t = L.thickness, len = L.length;
    const rects = [
      { x: -t / 2, y: -off - len, w: t, h: len }, { x: -t / 2, y: off, w: t, h: len },
      { x: -off - len, y: -t / 2, w: len, h: t }, { x: off, y: -t / 2, w: len, h: t },
    ];
    rects.forEach((r, i) => {
      if (s.outlines) parts.push(<rect key={`${key}o${i}`} x={r.x - o} y={r.y - o} width={r.w + o * 2} height={r.h + o * 2} fill="#000" opacity={s.outlineOpacity} />);
      parts.push(<rect key={`${key}${i}`} x={r.x} y={r.y} width={r.w} height={r.h} fill={s.color} opacity={L.opacity} />);
    });
  };
  line("i", s.inner, bloom * 6);
  line("u", s.outer, bloom * 10);
  if (s.centerDot) {
    const d = s.dotThickness;
    if (s.outlines) parts.push(<rect key="do" x={-d / 2 - o} y={-d / 2 - o} width={d + o * 2} height={d + o * 2} fill="#000" opacity={s.outlineOpacity} />);
    parts.push(<rect key="d" x={-d / 2} y={-d / 2} width={d} height={d} fill={s.color} opacity={s.dotOpacity} />);
  }
  const size = 80;
  return (
    <svg width={size * scale} height={size * scale} viewBox={`${-size / 2} ${-size / 2} ${size} ${size}`} shapeRendering="crispEdges" data-testid="crosshair-svg">
      {parts}
    </svg>
  );
}

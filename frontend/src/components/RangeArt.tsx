/** Flat, hand-drawn range mode art (dark plate + simple target glyphs) — replaces generated imagery. */
export function RangeArt({ type, className = "" }: { type: string; className?: string }) {
  const red = "#FF4655", line = "rgba(255,255,255,0.08)", dim = "rgba(255,255,255,0.35)";
  const grid = Array.from({ length: 11 }, (_, i) => i * 40);
  return (
    <svg viewBox="0 0 400 220" preserveAspectRatio="xMidYMid slice" className={className} data-testid={`range-art-${type}`} aria-hidden="true">
      <rect width="400" height="220" fill="#111821" />
      {grid.map((x) => <line key={"v" + x} x1={x} y1="0" x2={x} y2="220" stroke={line} />)}
      {grid.slice(0, 6).map((y) => <line key={"h" + y} x1="0" y1={y * 1.1} x2="400" y2={y * 1.1} stroke={line} />)}
      {type === "gridshot" && [[120, 80], [200, 120], [285, 70], [165, 160], [250, 165]].map(([x, y], i) => (
        <g key={i}><circle cx={x} cy={y} r="17" fill={i < 3 ? red : "none"} stroke={red} strokeWidth="3" opacity={i < 3 ? 1 : 0.35} /></g>
      ))}
      {type === "flick" && (
        <g>
          <circle cx="110" cy="150" r="5" fill="#fff" />
          <path d="M115 146 Q200 60 282 82" fill="none" stroke={dim} strokeWidth="2.5" strokeDasharray="6 7" />
          <circle cx="292" cy="80" r="20" fill={red} /><circle cx="292" cy="80" r="30" fill="none" stroke={red} strokeWidth="2" opacity="0.4" />
        </g>
      )}
      {type === "tracking" && (
        <g>
          <path d="M40 140 C110 60 170 170 230 100 S340 70 370 120" fill="none" stroke={dim} strokeWidth="2.5" strokeDasharray="4 6" />
          <circle cx="230" cy="100" r="22" fill={red} /><circle cx="230" cy="100" r="5" fill="#fff" />
        </g>
      )}
      {type === "strafe" && (
        <g>
          <path d="M140 196 H260" stroke={dim} strokeWidth="2" /><path d="M140 196 l10 -6 v12 z M260 196 l-10 -6 v12 z" fill={dim} />
          <rect x="186" y="66" width="28" height="30" fill={red} />
          <rect x="176" y="100" width="48" height="56" fill="#3A4556" />
          <rect x="180" y="156" width="17" height="38" fill="#2A3240" /><rect x="203" y="156" width="17" height="38" fill="#2A3240" />
        </g>
      )}
      {!["gridshot", "flick", "tracking", "strafe"].includes(type) && <circle cx="200" cy="110" r="26" fill="none" stroke={red} strokeWidth="3" />}
    </svg>
  );
}

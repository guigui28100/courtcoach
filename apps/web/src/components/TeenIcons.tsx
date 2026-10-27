import { COURT_M } from "./CourtLines";
// Icônes en traits fins pour le thème « ados » (tout est dessiné ici : aucune image extérieure)
const P: Record<string, string> = {
  "🏠": "M3 11l9-8 9 8M5 10v10h5v-6h4v6h5V10",
  "📍": "M12 21s-7-6.2-7-11a7 7 0 0114 0c0 4.8-7 11-7 11zM12 7.4a2.6 2.6 0 110 5.2 2.6 2.6 0 010-5.2z",
  "🚀": "M12 3c3.5 2 5 6 4 11l-4 3-4-3c-1-5 .5-9 4-11zM8 14l-3 3 1 3 3-2M16 14l3 3-1 3-3-2M12 7.7a1.8 1.8 0 110 3.6 1.8 1.8 0 010-3.6z",
  "⭐": "M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z",
  "📡": "M12 3a9 9 0 110 18 9 9 0 010-18zM12 7a5 5 0 110 10 5 5 0 010-10zM12 12l6-6",
  "🎬": "M6 5h12a3 3 0 013 3v8a3 3 0 01-3 3H6a3 3 0 01-3-3V8a3 3 0 013-3zM10 9l5 3-5 3z",
  "🏆": "M12 14a5 5 0 100-10 5 5 0 000 10zM9 13.5L7 21l5-3 5 3-2.5-7.5",
  "🏟️": "M8 4h8v5a4 4 0 01-8 0zM8 6H4v1a4 4 0 004 4M16 6h4v1a4 4 0 01-4 4M12 13v4M8 20h8M10 17h4",
  "📄": "M6 3h8l4 4v14H6zM14 3v4h4M9 12h6M9 16h6",
  "🔒": "M7 11h10a2 2 0 012 2v6a2 2 0 01-2 2H7a2 2 0 01-2-2v-6a2 2 0 012-2zM8 11V8a4 4 0 018 0v3",
};
const AXIS: Record<string, string> = {
  TECHNIQUE: "M14 2a6 7 0 110 14 6 7 0 010-14zM10 13l-6 7M14 4v10M9 9h10",
  TACTIQUE: "M12 3a9 9 0 110 18 9 9 0 010-18zM12 7a5 5 0 110 10 5 5 0 010-10zM12 11a1 1 0 110 2 1 1 0 010-2z",
  PHYSIQUE: "M13 2L5 14h6l-1 8 8-12h-6z",
  MENTAL: "M9 18h6M10 21h4M12 3a6 6 0 00-4 10c1 1 1 2 1 3h6c0-1 0-2 1-3a6 6 0 00-4-10z",
};
export function AxisIcon({ axis, size = 28 }: { axis: string; size?: number }) {
  return <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d={AXIS[axis] ?? AXIS.TECHNIQUE} /></svg>;
}
export const RulerIcon = ({ size = 18 }: { size?: number }) => <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M3 17L17 3l4 4L7 21zM8 12l2 2M11 9l2 2M14 6l2 2" /></svg>;
export function StarShape({ filled, color, size = 22 }: { filled: boolean; color: string; size?: number }) {
  const d = "M12 2.5l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.4l-5.9 3.1 1.2-6.5L2.5 9.4l6.6-.9z";
  return <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24"><path d={d} fill={filled ? color : "none"} stroke={filled ? "none" : "rgba(255,255,255,.3)"} strokeWidth="1.6" style={filled ? { filter: `drop-shadow(0 0 5px ${color})` } : undefined} /></svg>;
}
export function MissionRing({ pct, color, children }: { pct: number; color: string; children: React.ReactNode }) {
  const r = 34, C = 2 * Math.PI * r;
  return (
    <div className="mc-ring" aria-hidden="true">
      <svg width="92" height="92" viewBox="0 0 92 92"><circle cx="46" cy="46" r={r} fill="none" stroke="rgba(255,255,255,.14)" strokeWidth="8" /><circle cx="46" cy="46" r={r} fill="none" stroke={color} strokeWidth="8" strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C * (1 - Math.min(100, pct) / 100)} transform="rotate(-90 46 46)" style={{ filter: `drop-shadow(0 0 7px ${color})`, transition: "stroke-dashoffset .7s ease, stroke .7s ease" }} /></svg>
      <div className="mc-ring-in" style={{ color }}>{children}</div>
    </div>
  );
}
export function TeenIcon({ e, size = 20 }: { e: string; size?: number }) {
  const d = P[e];
  if (!d) return <>{e}</>;
  return <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d={d} /></svg>;
}

// Court en perspective : les lignes sont CALCULÉES à partir des vraies mesures (23,77 × 10,97 m, couloirs 1,37 m, service à 6,40 m du filet)
// pour le même contour que le dessin (bord proche : x 70 → 440 à y 300 ; bord lointain : x 170 → 520 à y 40).
const PERSPECTIVE = (() => {
  const L = COURT_M.length, W = COURT_M.width, D = 416; // D : recul de l'observateur (m) : perspective douce
  const f = (v: number) => (1 / D - 1 / (D + v)) / (1 / D - 1 / (D + L)); // 0 = bord proche, 1 = bord lointain
  const pt = (u: number, v: number): [number, number] => {
    const t = f(v), cx = 255 + (345 - 255) * t, half = (370 + (350 - 370) * t) / 2;
    return [Math.round((cx + ((u - W / 2) / W) * 2 * half) * 10) / 10, Math.round((300 - 260 * t) * 10) / 10];
  };
  const seg = (u1: number, v1: number, u2: number, v2: number) => { const a = pt(u1, v1), b = pt(u2, v2); return `M${a[0]} ${a[1]}L${b[0]} ${b[1]}`; };
  const a = COURT_M.alley, s1 = L / 2 - COURT_M.service, s2 = L / 2 + COURT_M.service;
  return {
    lines: [seg(a, 0, a, L), seg(W - a, 0, W - a, L), seg(a, s1, W - a, s1), seg(a, s2, W - a, s2), seg(W / 2, s1, W / 2, s2)],
    net: seg(-0.6, L / 2, W + 0.6, L / 2),
  };
})();
const PERSPECTIVE_LINES = PERSPECTIVE.lines, PERSPECTIVE_NET = PERSPECTIVE.net;

// Court en perspective avec la trajectoire d'une balle (décor du bandeau d'accueil)
export function CourtArt({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 560 360" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <defs>
        <linearGradient id="ta-fl" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#2f2b23" /><stop offset="1" stopColor="#161410" /></linearGradient>
        <linearGradient id="ta-tr" x1="0" x2="1"><stop offset="0" stopColor="#c9ad77" stopOpacity="0" /><stop offset="1" stopColor="#c9ad77" /></linearGradient>
        <radialGradient id="ta-bl" cx="35%" cy="30%"><stop offset="0" stopColor="#dfcb98" /><stop offset=".55" stopColor="#c9ad77" /><stop offset="1" stopColor="#b3925a" /></radialGradient>
        <radialGradient id="ta-gl"><stop offset="0" stopColor="#c9ad77" stopOpacity=".55" /><stop offset="1" stopColor="#c9ad77" stopOpacity="0" /></radialGradient>
        <filter id="ta-gw"><feGaussianBlur stdDeviation="3" /></filter>
      </defs>
      <g transform="translate(40 30)">
        <path d="M70 300L440 300L520 40L170 40Z" fill="url(#ta-fl)" stroke="#ffffff66" strokeWidth="2" />
        <g stroke="#ffffff55" strokeWidth="2" fill="none">{PERSPECTIVE_LINES.map((d, i) => <path key={i} d={d} />)}</g>
        <path d={PERSPECTIVE_NET} stroke="#ffffffcc" strokeWidth="3.5" fill="none" strokeLinecap="round" />
        <path d={PERSPECTIVE_NET} stroke="#c9ad77" strokeWidth="2.5" fill="none" filter="url(#ta-gw)" opacity=".7" />
        <path d="M140 270C230 -20 360 -10 440 120" fill="none" stroke="url(#ta-tr)" strokeWidth="3.5" strokeLinecap="round" />
        <path d="M140 270C230 -20 360 -10 440 120" fill="none" stroke="#c9ad77" strokeWidth="1.2" strokeDasharray="2 10" strokeLinecap="round" opacity=".8" />
        <ellipse cx="442" cy="158" rx="46" ry="12" fill="none" stroke="#c9ad77" strokeOpacity=".6" /><ellipse cx="442" cy="158" rx="24" ry="6" fill="none" stroke="#c9ad77" strokeOpacity=".9" />
        <circle cx="442" cy="150" r="46" fill="url(#ta-gl)" />
        <g transform="translate(405 62)"><circle r="26" fill="url(#ta-bl)" /><path d="M-17 -14C-1 -2 -1 12 -17 22M17 -14C1 -2 1 12 17 22" stroke="#fff" strokeWidth="2.4" fill="none" strokeLinecap="round" opacity=".92" /></g>
        <g transform="translate(110 262) rotate(-28)" opacity=".95"><ellipse cx="0" cy="-34" rx="22" ry="30" fill="none" stroke="#f2f0ec" strokeWidth="3" /><path d="M-14 -50H14M-20 -38H20M-18 -26H18M-8 -62V-6M0 -64V-4M8 -62V-6" stroke="#f2f0ec" strokeOpacity=".5" strokeWidth="1" /><path d="M0 -4V30" stroke="#f2f0ec" strokeWidth="5" strokeLinecap="round" /><path d="M0 14V30" stroke="#c9ad77" strokeWidth="5" strokeLinecap="round" /></g>
      </g>
    </svg>
  );
}

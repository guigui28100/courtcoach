import { EVAL_AXES } from "../types";

export interface RadarSeries { label: string; values: Record<string, number>; color: string; dashed?: boolean; }

// Toile d'araignée des 5 axes (moyennes sur 5). Dessinée en SVG : aucun service extérieur.
export function Radar({ series, size = 280 }: { series: RadarSeries[]; size?: number }) {
  const c = size / 2, r = size / 2 - 52, n = EVAL_AXES.length;
  const pt = (i: number, v: number): [number, number] => { const a = -Math.PI / 2 + (i * 2 * Math.PI) / n; return [c + Math.cos(a) * r * (v / 5), c + Math.sin(a) * r * (v / 5)]; };
  const poly = (f: (i: number) => number) => EVAL_AXES.map((_, i) => pt(i, f(i)).join(",")).join(" ");
  const summary = series.map((s) => `${s.label} : ${EVAL_AXES.map((a) => `${a.label} ${(s.values[a.key] || 0).toFixed(1)}`).join(", ")}`).join(". ");
  return (
    <figure className="m-0 grid justify-items-center gap-2">
      <svg viewBox={`0 0 ${size} ${size}`} width="100%" style={{ maxWidth: size }} role="img" aria-label={`Graphique en toile d'araignée. ${summary}`}>
        {[1, 2, 3, 4, 5].map((l) => <polygon key={l} points={poly(() => l)} fill="none" stroke="#e4d6c5" strokeWidth={l === 5 ? 1.5 : 1} />)}
        {EVAL_AXES.map((a, i) => { const [x, y] = pt(i, 5); const [lx, ly] = pt(i, 6.15); return (
          <g key={a.key}><line x1={c} y1={c} x2={x} y2={y} stroke="#e4d6c5" /><text x={lx} y={ly} textAnchor="middle" dominantBaseline="middle" fontSize="12" fontWeight="700" fill={a.color}>{a.label}</text></g>
        ); })}
        {series.map((s) => (
          <g key={s.label}>
            <polygon points={poly((i) => s.values[EVAL_AXES[i].key] || 0)} fill={s.dashed ? "none" : s.color} fillOpacity={0.18} stroke={s.color} strokeWidth={2.5} strokeDasharray={s.dashed ? "6 4" : undefined} />
            {!s.dashed && EVAL_AXES.map((a, i) => { const [x, y] = pt(i, s.values[a.key] || 0); return <circle key={a.key} cx={x} cy={y} r={3.5} fill={s.color} />; })}
          </g>
        ))}
      </svg>
      {series.length > 1 && (
        <figcaption className="flex flex-wrap justify-center gap-4 text-sm">
          {series.map((s) => <span key={s.label} className="flex items-center gap-2"><span aria-hidden className="inline-block h-0 w-6 border-t-[3px]" style={{ borderColor: s.color, borderStyle: s.dashed ? "dashed" : "solid" }} />{s.label}</span>)}
        </figcaption>
      )}
    </figure>
  );
}

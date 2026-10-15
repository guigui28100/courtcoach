import { useEffect, useState } from "react";
import { CourseStar, currentSeason, Goal, goalApplies, itemKey, MISSION_TOPICS, missionStars, START_ITEMS, STARS_PER_POINT, trimesterOf } from "../types";

// LA toile du joueur : une pointe par THÈME (coup droit, revers, service, jeu au filet, défendre, concentration, gainage…).
// Départ = le bilan du coach (fixe). Maintenant = le départ + les étoiles gagnées sur les missions de ce thème (12 étoiles = 1 point, 5 au maximum).
// Elle sert aussi, avec les notes d'une évaluation, à « l'Image du joueur » des bulletins.
const AXES = ["technique", "tactique", "physique", "mental", "attitude"] as const;
const AXIS_NAME: Record<string, string> = { technique: "Technique", tactique: "Tactique", physique: "Physique", mental: "Mental", attitude: "Attitude" };
const COLOR: Record<string, [string, string]> = { technique: ["#ff9b73", "#b8471f"], tactique: ["#7dbbff", "#2a6fb0"], physique: ["#6ee8aa", "#2f8f5b"], mental: ["#d3b2ff", "#7a4cc2"], attitude: ["#ffd84d", "#946b00"] }; // [fond sombre, fond clair]
// Un point à travailler d'une mission → le point du bilan correspondant
const TOPIC_ITEM: Record<string, string> = { "Coup droit": "coup_droit", "Revers": "revers", "Service": "service", "Volée": "volee", "Smash": "smash", "Jeu au filet": "jeu_filet", "Défendre": "defendre", "Attaquer": "attaquer", "Concentration": "concentration", "Gestion des émotions": "emotions", "Routines": "routines", "Combativité": "combativite", "Confiance": "confiance", "Endurance": "endurance", "Vitesse": "vitesse", "Explosivité": "explosivite", "Gainage": "gainage", "Coordination": "coordination" };
const SHORT: Record<string, string> = { "Gestion des émotions": "Émotions", "Retour de service": "Retour", "Construire le point": "Construire", "Lecture du jeu": "Lecture du jeu" };

export interface ThemeDef { id: string; axis: string; label: string; item?: string }
// Tous les thèmes possibles, dans l'ordre : domaine, puis points du bilan, puis les autres points à travailler des missions
export const THEME_CATALOG: ThemeDef[] = AXES.flatMap((axis) => {
  const items = (START_ITEMS[axis] ?? []).map(([k, label]) => ({ id: `${axis}:${k}`, axis, label, item: k }));
  const known = new Set(Object.values(TOPIC_ITEM));
  const topics = (MISSION_TOPICS[axis.toUpperCase()] ?? []).filter((t) => !TOPIC_ITEM[t] || !known.has(TOPIC_ITEM[t])).map((t) => ({ id: `${axis}:${t}`, axis, label: t }));
  return [...items, ...topics];
});
const defOfMission = (g: Goal): { id: string; axis: string; label: string } => {
  const axis = g.axis.toLowerCase(), k = g.title.indexOf(" : "), head = k > 0 ? g.title.slice(0, k) : "";
  if (head && (MISSION_TOPICS[g.axis] ?? []).includes(head)) { const it = TOPIC_ITEM[head]; return { id: it ? `${axis}:${it}` : `${axis}:${head}`, axis, label: head }; }
  return { id: `${axis}:`, axis, label: AXIS_NAME[axis] ?? axis }; // sans thème connu : le nom du domaine
};

export interface RadarSpoke { id: string; axis: string; label: string }
export interface RadarSerie { label: string; values: number[]; color: string; dashed?: boolean }

// Vrai sur téléphone (écran étroit) : sert à régler la taille du texte du dessin
function useNarrow() {
  const [n, setN] = useState(() => typeof window !== "undefined" && window.innerWidth < 640);
  useEffect(() => { const on = () => setN(window.innerWidth < 640); window.addEventListener("resize", on); return () => window.removeEventListener("resize", on); }, []);
  return n;
}

// Le dessin lui-même : pointes = thèmes, une ou plusieurs lignes (départ, maintenant…)
export function ThemeRadarSvg({ spokes, series, dark = false, summary }: { spokes: RadarSpoke[]; series: RadarSerie[]; dark?: boolean; summary: string }) {
  const narrow = useNarrow();
  const n = spokes.length, many = n > 16 ? 3 : n > 12 ? 2 : n > 8 ? 1 : 0;
  const fs = (narrow ? [26, 24, 22, 21] : [17, 15, 14, 14])[many];
  const C = 300, R = 215, W = narrow ? 860 : 800, H = 640;
  const pt = (i: number, v: number): [number, number] => { const a = -Math.PI / 2 + (i * 2 * Math.PI) / n; return [C + Math.cos(a) * R * (v / 5), C + Math.sin(a) * R * (v / 5)]; };
  const grid = dark ? "rgba(255,255,255,0.3)" : "#d8cbb8";
  const cut = (t: string) => { const s = SHORT[t] ?? t, m = many >= 2 ? 14 : 16; return s.length > m ? s.slice(0, m - 1).trimEnd() + "…" : s; };
  return (
    <svg viewBox={`${narrow ? -130 : -100} -25 ${W} ${H}`} width="100%" style={{ maxWidth: narrow ? 760 : 640 }} role="img" aria-label={summary}>
      {[1, 2, 3, 4, 5].map((l) => <polygon key={l} points={spokes.map((_, i) => pt(i, l).join(",")).join(" ")} fill="none" stroke={grid} strokeWidth={l === 5 ? 2 : 1} />)}
      {spokes.map((_, i) => { const [x, y] = pt(i, 5); return <line key={i} x1={C} y1={C} x2={x} y2={y} stroke={grid} />; })}
      {series.map((s) => (
        <g key={s.label}>
          <polygon points={s.values.map((v, i) => pt(i, v).join(",")).join(" ")} fill={s.dashed ? "none" : s.color} fillOpacity={0.22} stroke={s.color} strokeWidth={s.dashed ? 3 : 4} strokeDasharray={s.dashed ? "8 6" : undefined} strokeLinejoin="round" />
          {!s.dashed && s.values.map((v, i) => { const [x, y] = pt(i, v); return <circle key={i} cx={x} cy={y} r={6} fill={s.color} />; })}
        </g>
      ))}
      {spokes.map((sp, i) => {
        // Beaucoup de pointes : en haut et en bas, un nom sur deux est un peu plus loin pour ne pas toucher son voisin
        const a = -Math.PI / 2 + (i * 2 * Math.PI) / n, off = n > 12 && i % 2 === 1 && Math.abs(Math.cos(a)) < 0.6 ? 36 : 0, lx = C + Math.cos(a) * (R + 28 + off), ly = C + Math.sin(a) * (R + 28 + off);
        const anchor = Math.abs(Math.cos(a)) < 0.3 ? "middle" : Math.cos(a) > 0 ? "start" : "end";
        return <text key={sp.id} x={lx} y={ly + 5} textAnchor={anchor} fontSize={fs} fontWeight="800" fill={COLOR[sp.axis]?.[dark ? 0 : 1] ?? "#999"}>{cut(sp.label)}</text>;
      })}
    </svg>
  );
}

const Legend = ({ items, dark }: { items: { label: string; color: string; dashed?: boolean }[]; dark: boolean }) => (
  <figcaption className={"flex flex-wrap justify-center gap-4 text-sm font-bold " + (dark ? "text-white" : "text-[#10203a]")}>
    {items.map((s) => <span key={s.label} className="flex items-center gap-2"><span aria-hidden className="inline-block h-0 w-6 border-t-[3px]" style={{ borderColor: s.color, borderStyle: s.dashed ? "dashed" : "solid" }} />{s.label}</span>)}
  </figcaption>
);

// La toile de l'espace du jeune et de la fiche du coach (« Mon point de départ » / « Donner des étoiles »)
export function ThemeRadar({ ratings, goals, stars, dark = false, who = "jeune", season: seasonProp, t: tProp }: { ratings?: Record<string, number>; goals: Goal[]; stars: CourseStar[] | null; dark?: boolean; who?: "jeune" | "coach"; season?: string; t?: number }) {
  if (!stars) return <div className="skeleton h-24" role="status" aria-label="Chargement en cours" />;
  const season = seasonProp ?? currentSeason(), t = tProp ?? trimesterOf(), r = ratings ?? {};
  const here = goals.filter((g) => goalApplies(g, t));
  // Étoiles gagnées sur les missions de chaque thème (ce trimestre)
  const earned = new Map<string, { axis: string; label: string; stars: number }>();
  for (const g of here) { const d = defOfMission(g), cur = earned.get(d.id) ?? { axis: d.axis, label: d.label, stars: 0 }; cur.stars += missionStars(stars, g.id, season, t); earned.set(d.id, cur); }
  // Pointes : les points notés au bilan + les thèmes qui ont au moins une mission
  const spokes: (RadarSpoke & { start: number })[] = [];
  for (const d of THEME_CATALOG) { const v = d.item ? r[itemKey(d.axis, d.item)] ?? 0 : 0; if (v > 0 || earned.has(d.id)) spokes.push({ id: d.id, axis: d.axis, label: d.label, start: v }); }
  for (const [id, e] of earned) if (!spokes.some((s) => s.id === id)) spokes.push({ id, axis: e.axis, label: e.label, start: r[e.axis] ?? 0 });
  spokes.sort((a, b) => AXES.indexOf(a.axis as (typeof AXES)[number]) - AXES.indexOf(b.axis as (typeof AXES)[number]));
  const me = who === "jeune", n = spokes.length, sub = dark ? "text-white/80" : "text-muted";
  const start = spokes.map((s) => s.start), now = spokes.map((s) => Math.min(5, s.start + (earned.get(s.id)?.stars ?? 0) / STARS_PER_POINT));
  const summary = "Toile par thème. " + spokes.map((s, i) => `${s.label} : départ ${start[i]} sur 5, maintenant ${now[i].toFixed(1)}`).join(". ");
  const box = "m-0 rounded-2xl p-3 " + (dark ? "bg-white/10" : "bg-sand/60");
  const series: RadarSerie[] = [{ label: me ? "Mon départ" : "Départ", values: start, color: dark ? "#ffffff" : "#10203a", dashed: true }, { label: me ? "Mon niveau maintenant" : "Maintenant", values: now, color: dark ? "#dcf247" : "#e0b100" }];
  return (
    <section className={dark ? "glass grid gap-3" : "card grid gap-3"} aria-labelledby="theme-radar">
      <h2 id="theme-radar" className="m-0 text-2xl">📍 {me ? "Ma toile" : "La toile du joueur"} · trimestre {t}</h2>
      <p className={"m-0 " + sub}>Chaque pointe est un thème (coup droit, revers, service, jeu au filet…). Le trait en pointillés est {me ? "ton départ (le bilan de ton coach)" : "le départ (le bilan du coach)"} ; le trait plein est {me ? "ton niveau maintenant" : "le niveau maintenant"} : le départ, plus les étoiles gagnées sur les missions du thème. <strong>12 étoiles = 1 point de plus.</strong> Elle repart du bilan de départ à chaque trimestre.</p>
      {n < 3 ? <p className={box}>{me ? "La toile apparaît dès que ton coach a noté au moins 3 points dans ton bilan de départ, ou fixé des missions sur 3 thèmes." : "La toile apparaît dès que le bilan de départ note au moins 3 points, ou que des missions couvrent 3 thèmes."}</p> : (
        <figure className="m-0 grid justify-items-center gap-2">
          <ThemeRadarSvg spokes={spokes} series={series} dark={dark} summary={summary} />
          <Legend items={series} dark={dark} />
        </figure>
      )}
    </section>
  );
}

// « Image du joueur » des bulletins : les points notés dans une évaluation (départ, trimestre précédent, ce trimestre). Anciens bulletins (sans notes par point) : on affiche l'ancien dessin à 5 branches (`fallback`).
export function ThemeImage({ evals, fallback = null }: { evals: { label: string; ratings: Record<string, number> | undefined; color: string; dashed?: boolean }[]; fallback?: React.ReactNode }) {
  const has = (r?: Record<string, number>) => Object.keys(r ?? {}).some((k) => k.startsWith("d_"));
  if (!evals.some((e) => has(e.ratings))) return <>{fallback}</>;
  const spokes = THEME_CATALOG.filter((d) => d.item && evals.some((e) => (e.ratings?.[itemKey(d.axis, d.item!)] ?? 0) > 0));
  if (spokes.length < 3) return <>{fallback}</>;
  const series = evals.filter((e) => e.ratings).map((e) => ({ label: e.label, color: e.color, dashed: e.dashed, values: spokes.map((d) => e.ratings![itemKey(d.axis, d.item!)] ?? 0) }));
  const summary = "Image du joueur. " + spokes.map((d, i) => `${d.label} : ${series.map((s) => `${s.label} ${s.values[i]} sur 5`).join(", ")}`).join(". ");
  return (
    <figure className="m-0 grid w-full justify-items-center gap-2">
      <ThemeRadarSvg spokes={spokes} series={series} summary={summary} />
      <Legend items={series} dark={false} />
    </figure>
  );
}

import { useEffect, useState } from "react";
import { get } from "../api";
import { Radar } from "./Radar";
import { CourseStar, currentSeason, DOMAIN_EMOJI, EVAL_AXES, fmtDay, starReason, STAR_REASONS, starsByDomain, STARS_FOR_FULL, totalStars } from "../types";

// Chargement des étoiles d'un joueur (le coach, le joueur et sa famille y ont accès)
export function useStars(playerId: string | undefined, reload = 0) {
  const [stars, setStars] = useState<CourseStar[] | null>(null);
  useEffect(() => { if (!playerId) return; get<CourseStar[]>(`/players/${playerId}/stars`).then(setStars).catch(() => setStars([])); }, [playerId, reload]);
  return stars;
}

// Choix de 0 à 3 étoiles (0 = pas d'étoile ce jour-là)
export function StarPicker({ value, onChange, dark = false, label }: { value: number; onChange: (n: number) => void; dark?: boolean; label: string }) {
  return (
    <div className="flex gap-1" role="radiogroup" aria-label={label}>
      {[1, 2, 3].map((n) => (
        <button key={n} type="button" role="radio" aria-checked={value >= n} aria-label={`${n} étoile${n > 1 ? "s" : ""}`} onClick={() => onChange(value === n ? n - 1 : n)}
          className={"grid h-12 w-12 place-items-center rounded-xl border-2 text-2xl transition-transform active:scale-90 " + (value >= n ? "border-[#e0b100] bg-[#fff3b0]" : dark ? "border-white/40 bg-white/10 opacity-60" : "border-line bg-white opacity-50")}>
          <span aria-hidden="true">{value >= n ? "⭐" : "☆"}</span>
        </button>
      ))}
    </div>
  );
}

// Choix de la raison (une seule), avec une phrase d'aide
export function ReasonPicker({ value, onChange }: { value: string; onChange: (id: string) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Pourquoi ces étoiles ?">
      {STAR_REASONS.map((r) => (
        <button key={r.id} type="button" role="radio" aria-checked={value === r.id} title={r.hint} onClick={() => onChange(r.id)}
          className={"min-h-10 rounded-full border-2 px-3 text-sm font-bold " + (value === r.id ? "border-ink bg-ink text-white" : "border-line bg-white text-ink hover:bg-sand")}><span aria-hidden="true">{r.emoji} </span>{r.label}</button>
      ))}
    </div>
  );
}

// Choix du domaine du radar (un seul) : à quoi correspond cette étoile ?
export function DomainPicker({ value, onChange }: { value: string; onChange: (id: string) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Quel domaine du radar fait-elle grandir ?">
      {EVAL_AXES.map((a) => (
        <button key={a.key} type="button" role="radio" aria-checked={value === a.key} onClick={() => onChange(a.key)}
          className={"min-h-10 rounded-full border-2 px-3 text-sm font-bold " + (value === a.key ? "border-clay bg-clay text-white" : "border-line bg-white text-ink hover:bg-sand")}><span aria-hidden="true">{DOMAIN_EMOJI[a.key]} </span>{a.label}</button>
      ))}
    </div>
  );
}

// Radar « de tous les jours » : alimenté par les étoiles de la saison, mis à jour à chaque cours
export function StarsRadar({ stars, dark = false, who = "jeune" }: { stars: CourseStar[] | null; dark?: boolean; who?: "jeune" | "famille" | "coach" }) {
  if (!stars) return <div className="skeleton h-24" role="status" aria-label="Chargement en cours" />;
  const season = currentSeason();
  const by = starsByDomain(stars, season);
  const values = Object.fromEntries(EVAL_AXES.map((a) => [a.key, Math.min(5, (by[a.key] * 5) / STARS_FOR_FULL)]));
  const total = Object.values(by).reduce((n, v) => n + v, 0);
  const sub = dark ? "text-white/80" : "text-muted";
  const me = who === "jeune";
  return (
    <section className={dark ? "glass grid gap-4" : "card grid gap-4"} aria-labelledby="stars-radar">
      <h2 id="stars-radar" className="m-0 text-2xl">🌟 {me ? "Mon radar de tous les jours" : "Le radar de tous les jours"}</h2>
      <p className={"m-0 " + sub}>{me ? "Chaque étoile que ton coach te donne fait grandir un domaine. Plus tu en gagnes, plus ton radar se remplit : il se met à jour à chaque cours, toute la saison !" : "Chaque étoile fait grandir un domaine. Le radar se remplit au fil des cours de la saison et se met à jour à chaque cours."} Quand un domaine a {STARS_FOR_FULL} étoiles, il est plein.</p>
      {total === 0 ? <p className={"m-0 rounded-2xl p-3 " + (dark ? "bg-white/10" : "bg-sand/60")}>Pas encore d'étoile cette saison : le radar se remplira dès les premiers cours.</p> : (
        <div className="grid items-center gap-4 md:grid-cols-[300px_1fr]">
          <div className="grid justify-items-center"><Radar dark={dark} series={[{ label: `Étoiles ${season.replace("-", "/")}`, values, color: dark ? "#dcf247" : "#e0b100" }]} /></div>
          <ul className="m-0 grid list-none gap-2 p-0" aria-label="Étoiles par domaine">
            {EVAL_AXES.map((a) => (
              <li key={a.key} className={"flex items-center justify-between gap-3 rounded-xl px-3 py-2 " + (dark ? "bg-white/10" : "bg-sand/60")}>
                <span className="font-bold"><span aria-hidden="true">{DOMAIN_EMOJI[a.key]} </span>{a.label}</span>
                <strong>⭐ {by[a.key]}{by[a.key] >= STARS_FOR_FULL ? " · plein !" : ""}</strong>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

export const StarsLine = ({ n }: { n: number }) => <span aria-label={`${n} étoile${n > 1 ? "s" : ""}`}>{"⭐".repeat(n)}</span>;

// Carte « Mes étoiles » (lecture seule) pour le jeune (fond sombre) et pour sa famille
export function StarsCard({ stars, dark = false, who = "jeune" }: { stars: CourseStar[] | null; dark?: boolean; who?: "jeune" | "famille" }) {
  const sub = dark ? "text-white/80" : "text-muted";
  const row = dark ? "bg-white/10" : "bg-sand/60";
  if (!stars) return <div className="skeleton h-24" role="status" aria-label="Chargement en cours" />;
  const month = new Date().toISOString().slice(0, 7);
  const thisMonth = totalStars(stars.filter((s) => s.day.startsWith(month)));
  return (
    <section className={dark ? "glass grid gap-3" : "card grid gap-3"} aria-labelledby="stars-t">
      <h2 id="stars-t" className="m-0 text-2xl">⭐ {who === "jeune" ? "Mes étoiles" : "Les étoiles"}</h2>
      <p className={"m-0 " + sub}>{who === "jeune" ? "Ton coach te donne 1 à 3 étoiles à la fin d'un cours, pour ton effort, ton attitude ou un progrès. Ce n'est jamais une note, et personne d'autre que toi (et tes parents) ne les voit." : "Le coach donne 1 à 3 étoiles à la fin d'un cours, pour l'effort, l'attitude ou un progrès. Ce n'est jamais une note."}</p>
      {stars.length === 0 ? <p className={"m-0 rounded-2xl p-3 " + row}>Pas encore d'étoile : {who === "jeune" ? "ton coach en donne" : "le coach en donne"} à la fin des cours.</p> : (
        <>
          <p className="m-0 flex flex-wrap items-baseline gap-x-4 gap-y-1"><strong className="text-4xl font-black">⭐ {totalStars(stars)}</strong><span className={sub}>étoile{totalStars(stars) > 1 ? "s" : ""} en tout · {thisMonth} ce mois-ci</span></p>
          <ul className="m-0 grid list-none gap-2 p-0">
            {stars.slice(0, 12).map((s) => { const r = starReason(s.reason); return (
              <li key={s.id} className={"grid gap-0.5 rounded-2xl p-3 " + row}>
                <span className="flex flex-wrap items-center justify-between gap-2"><strong><StarsLine n={s.stars} /> {r ? `${r.emoji} ${r.label}` : ""}{s.domain ? ` · ${DOMAIN_EMOJI[s.domain] ?? ""} ${EVAL_AXES.find((a) => a.key === s.domain)?.label ?? ""}` : ""}</strong><small className={sub}>{fmtDay(s.day)}</small></span>
                {s.comment && <span className="text-sm">💬 {s.comment}</span>}
              </li>
            ); })}
          </ul>
          {stars.length > 12 && <small className={sub}>Les 12 derniers cours sont affichés.</small>}
        </>
      )}
    </section>
  );
}

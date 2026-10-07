import { useEffect, useState } from "react";
import { get } from "../api";
import { Radar } from "./Radar";
import { Goal, QUALITIES, qualityOfReason, CourseStar, currentSeason, DOMAIN_EMOJI, EVAL_AXES, fmtDay, isNegReason, starReason, STAR_NEG_REASONS, STAR_REASONS, starsByDomain, STARS_FOR_FULL, totalStars, trimesterOf } from "../types";

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
export function ReasonPicker({ value, onChange, negative = false }: { value: string; onChange: (id: string) => void; negative?: boolean }) {
  return (
    <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label={negative ? "Qu'est-ce qui n'a pas été ?" : "Pourquoi ces étoiles ?"}>
      {(negative ? STAR_NEG_REASONS : STAR_REASONS).map((r) => (
        <button key={r.id} type="button" role="radio" aria-checked={value === r.id} title={r.hint} onClick={() => onChange(r.id)}
          className={"min-h-10 rounded-full border-2 px-3 text-sm font-bold " + (value === r.id ? (negative ? "border-[#b3261e] bg-[#b3261e] text-white" : "border-ink bg-ink text-white") : "border-line bg-white text-ink hover:bg-sand")}><span aria-hidden="true">{r.emoji} </span>{r.label}</button>
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
export function StarsRadar({ stars, dark = false, who = "jeune", season: seasonProp, t: tProp, bulletin = false, onMinus }: { stars: CourseStar[] | null; dark?: boolean; who?: "jeune" | "famille" | "coach"; season?: string; t?: number; bulletin?: boolean; onMinus?: (domain: string) => void }) {
  if (!stars) return <div className="skeleton h-24" role="status" aria-label="Chargement en cours" />;
  const season = seasonProp ?? currentSeason(), t = tProp ?? trimesterOf();
  const by = starsByDomain(stars, season, t);
  const values = Object.fromEntries(EVAL_AXES.map((a) => [a.key, Math.min(5, (by[a.key] * 5) / STARS_FOR_FULL)]));
  const total = Object.values(by).reduce((n, v) => n + v, 0);
  const sub = dark ? "text-white/80" : "text-muted";
  const me = who === "jeune";
  return (
    <section className={dark ? "glass grid gap-4" : "card grid gap-4"} aria-labelledby="stars-radar">
      <h2 id="stars-radar" className={bulletin ? "m-0 text-2xl" : "m-0 text-2xl"}>🌟 {bulletin ? `Radar des étoiles du trimestre ${t}` : me ? `Mon radar de tous les jours · trimestre ${t}` : `Le radar de tous les jours · trimestre ${t}`}</h2>
      <p className={"m-0 " + sub}>{bulletin ? `Les étoiles données à ${who === "coach" ? "ce joueur" : "ce joueur"} pendant ce trimestre, par domaine.` : me ? "Chaque étoile que ton coach te donne fait grandir un domaine. Plus tu en gagnes, plus ton radar se remplit ; quand ton coach te dit « pas en progrès » dans un domaine, il perd des étoiles. Il repart de zéro à chaque trimestre : à toi de le remplir à nouveau !" : "Chaque étoile fait grandir un domaine. Le radar se remplit au fil des cours du trimestre, se met à jour à chaque cours et repart de zéro au trimestre suivant."} Un domaine est plein à {STARS_FOR_FULL} étoiles.</p>
      {total === 0 && !onMinus ? <p className={"m-0 rounded-2xl p-3 " + (dark ? "bg-white/10" : "bg-sand/60")}>Pas encore d'étoile ce trimestre : le radar se remplira dès les premiers cours.</p> : (
        <div className="grid items-center gap-4 md:grid-cols-[300px_1fr]">
          <div className="grid justify-items-center"><Radar dark={dark} series={[{ label: `Étoiles T${t}`, values, color: dark ? "#dcf247" : "#e0b100" }]} /></div>
          <ul className="m-0 grid list-none gap-2 p-0" aria-label="Étoiles par domaine">
            {EVAL_AXES.map((a) => (
              <li key={a.key} className={"flex items-center justify-between gap-3 rounded-xl px-3 py-2 " + (dark ? "bg-white/10" : "bg-sand/60")}>
                <span className="font-bold"><span aria-hidden="true">{DOMAIN_EMOJI[a.key]} </span>{a.label}</span>
                <span className="flex items-center gap-2"><strong>⭐ {by[a.key]}{by[a.key] >= STARS_FOR_FULL ? " · plein !" : ""}</strong>{onMinus && <button type="button" className="btn-outline btn-sm !min-h-9 !w-9 !px-0 text-lg" onClick={() => onMinus(a.key)} disabled={by[a.key] === 0} title={by[a.key] === 0 ? "Aucune étoile à retirer dans ce domaine ce trimestre" : `Retirer une étoile en ${a.label}`} aria-label={`Retirer une étoile en ${a.label}`}>−</button>}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

// Les étoiles d'un cours : une ou plusieurs lignes, chacune avec son nombre d'étoiles, sa raison et son domaine du radar
export type StarLine = { stars: number; reason: string; domain: string; comment: string; goalId?: string };
export const MAX_STAR_LINES = 20;
export const newStarLine = (): StarLine => ({ stars: 1, reason: "", domain: "", comment: "" });
// Message si une ligne est incomplète, sinon chaîne vide
// Une ligne à 0 n'est pas enregistrée : on ne garde que celles qui ajoutent ou retirent des étoiles
export const activeLines = (lines: StarLine[]) => lines.filter((l) => l.stars !== 0);
export const starLinesError = (all: StarLine[]) => {
  const lines = activeLines(all);
  if (lines.some((l) => !l.goalId && !l.reason)) return "Choisis la raison pour chaque ligne d'étoiles.";
  if (lines.some((l) => !l.goalId && !l.domain)) return "Choisis la mission (ou le domaine du radar) pour chaque ligne d'étoiles.";
  if (lines.some((l) => l.stars < 0 && l.comment.trim().length < 3)) return "Pour retirer des étoiles, explique en une phrase ce qui n'a pas été : le jeune la verra.";
  return "";
};
// Les lignes à envoyer au serveur
export const starItems = (lines: StarLine[]) => activeLines(lines).map((l) => ({ stars: l.stars, reason: l.goalId ? (l.stars < 0 ? "neg-objectifs" : "progres") : l.reason, comment: l.comment.trim() || undefined, ...(l.goalId ? { goalId: l.goalId } : { domain: l.domain }) }));
function OtherLinesEditor({ lines, onChange, who, goals = [] }: { lines: StarLine[]; onChange: (l: StarLine[]) => void; who: string; goals?: Goal[] }) {
  const set = (i: number, patch: Partial<StarLine>) => onChange(lines.map((l, j) => (j === i ? { ...l, ...patch } : l)));
  return (
    <div className="grid gap-3">
      {lines.map((l, i) => (
        <div key={i} className="grid gap-2 rounded-2xl border border-line bg-white p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2" role="radiogroup" aria-label={`Nombre d'étoiles n°${i + 1} pour ${who}`}>
              {[-3, -2, -1, 0, 1, 2, 3].map((n) => (
                <button key={n} type="button" role="radio" aria-checked={l.stars === n} aria-label={n < 0 ? `Retirer ${-n} étoile${n < -1 ? "s" : ""} (pas en progrès)` : n === 0 ? "Aucune étoile" : `${n} étoile${n > 1 ? "s" : ""}`}
                  onClick={() => set(i, { stars: n, ...(n !== 0 && (n < 0) !== (l.stars < 0) ? { reason: "" } : {}) })}
                  className={"min-h-11 min-w-12 rounded-xl border-2 px-2 text-lg font-bold " + (l.stars === n ? (n < 0 ? "border-[#b3261e] bg-[#fdecea] text-[#b3261e]" : "border-[#e0b100] bg-[#fff3b0]") : "border-line bg-white text-ink hover:bg-sand") + (n === 0 ? " mx-1" : "")}>{n < 0 ? `−${-n}` : n === 0 ? "0" : "⭐".repeat(n)}</button>
              ))}
              <span className={"text-sm font-bold " + (l.stars < 0 ? "text-[#b3261e]" : "")}>{l.stars === 0 ? "aucune étoile : cette ligne ne sera pas enregistrée" : l.stars < 0 ? `📉 pas en progrès : ${who} perd ${-l.stars} étoile${l.stars < -1 ? "s" : ""} dans ce domaine` : `${l.stars} étoile${l.stars > 1 ? "s" : ""}`}</span>
            </div>
            <button type="button" className="btn-danger btn-sm" onClick={() => onChange(lines.filter((_, j) => j !== i))}>✕ Retirer cette ligne</button>
          </div>
          {l.stars !== 0 && <>
          <p className="hint m-0">{l.stars < 0 ? "Qu'est-ce qui n'a pas été ?" : "Pourquoi ?"}</p>
          <ReasonPicker negative={l.stars < 0} value={l.reason} onChange={(id) => set(i, { reason: id })} />
          {goals.length > 0 && <>
            <p className="hint m-0">Sur quelle mission ?</p>
            <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Sur quelle mission ?">
              {goals.map((g) => (
                <button key={g.id} type="button" role="radio" aria-checked={l.goalId === g.id} onClick={() => set(i, { goalId: g.id, domain: g.axis.toLowerCase() })}
                  className={"min-h-10 rounded-full border-2 px-3 text-left text-sm font-bold " + (l.goalId === g.id ? "border-clay bg-clay text-white" : "border-line bg-white text-ink hover:bg-sand")}>{DOMAIN_EMOJI[g.axis.toLowerCase()]} {g.title}</button>
              ))}
              <button type="button" role="radio" aria-checked={!l.goalId} onClick={() => set(i, { goalId: undefined })}
                className={"min-h-10 rounded-full border-2 px-3 text-sm font-bold " + (!l.goalId ? "border-ink bg-ink text-white" : "border-line bg-white text-ink hover:bg-sand")}>Autre (sans mission)</button>
            </div>
          </>}
          {!l.goalId && <>
            <p className="hint m-0">{l.stars < 0 ? "Quel domaine du radar n'est pas en progrès ?" : "Quel domaine du radar fait-elle grandir ?"}</p>
            <DomainPicker value={l.domain} onChange={(id) => set(i, { domain: id })} />
          </>}
          <label className="grid gap-1 text-sm font-bold">{l.stars < 0 ? `Explique en une phrase (obligatoire : ${who} la verra)` : "Un petit mot (facultatif)"}
            <input className="input" maxLength={300} value={l.comment} onChange={(e) => set(i, { comment: e.target.value })} placeholder={l.stars < 0 ? "Ex. : Tu as discuté pendant l'exercice, on en reparle mardi." : "Ex. : Super service aujourd'hui !"} /></label>
          </>}
        </div>
      ))}
      {lines.length < MAX_STAR_LINES && <div><button type="button" className="btn-outline btn-sm" onClick={() => onChange([...lines, newStarLine()])}>{lines.length ? "➕ Ajouter une autre ligne (autre raison, autre domaine)" : "⭐ Donner ou retirer des étoiles"}</button></div>}
    </div>
  );
}

// Étoiles = évaluation jour après jour des missions : une rangée par mission (de −3 à 3), puis éventuellement une étoile « hors mission »
export function StarLinesEditor({ lines, onChange, who, goals = [] }: { lines: StarLine[]; onChange: (l: StarLine[]) => void; who: string; goals?: Goal[] }) {
  const ids = new Set(goals.map((g) => g.id));
  const isMission = (l: StarLine) => !!l.goalId && ids.has(l.goalId);
  const isQuality = (l: StarLine) => !isMission(l) && !!qualityOfReason(l.reason);
  const others = lines.filter((l) => !isMission(l) && !isQuality(l));
  const setMission = (g: Goal, patch: Partial<StarLine>) => {
    const cur = lines.find((l) => l.goalId === g.id);
    const next: StarLine = { stars: 0, reason: "", domain: g.axis.toLowerCase(), comment: "", ...cur, ...patch, goalId: g.id };
    onChange(cur ? lines.map((l) => (l === cur ? next : l)) : [...lines, next]);
  };
  const setQuality = (key: string, patch: Partial<StarLine>) => {
    const q = QUALITIES.find((x) => x.key === key)!;
    const cur = lines.find((l) => isQuality(l) && qualityOfReason(l.reason)!.key === key);
    const stars = patch.stars ?? cur?.stars ?? 0;
    const next: StarLine = { stars: 0, comment: "", ...cur, ...patch, domain: q.domain, reason: stars < 0 ? "neg-" + q.reason : q.reason, goalId: undefined };
    onChange(cur ? lines.map((l) => (l === cur ? next : l)) : [...lines, next]);
  };
  const row = (key: string, title: React.ReactNode, hint: string | null, l: StarLine | undefined, set: (p: Partial<StarLine>) => void) => { const n = l?.stars ?? 0; return (
    <div key={key} className="grid gap-2 rounded-2xl border border-line bg-white p-3">
      <strong title={hint ?? undefined}>{title}</strong>
      <div className="flex flex-wrap items-center gap-2" role="radiogroup" aria-label={`Étoiles de ${who} : ${key}`}>
        {[-3, -2, -1, 0, 1, 2, 3].map((k) => (
          <button key={k} type="button" role="radio" aria-checked={n === k} aria-label={k < 0 ? `Retirer ${-k} étoile${k < -1 ? "s" : ""}` : k === 0 ? "Aucune étoile" : `${k} étoile${k > 1 ? "s" : ""}`} onClick={() => set({ stars: k })}
            className={"min-h-11 min-w-12 rounded-xl border-2 px-2 text-lg font-bold " + (n === k ? (k < 0 ? "border-[#b3261e] bg-[#fdecea] text-[#b3261e]" : "border-[#e0b100] bg-[#fff3b0]") : "border-line bg-white text-ink hover:bg-sand") + (k === 0 ? " mx-1" : "")}>{k < 0 ? `−${-k}` : k === 0 ? "0" : "⭐".repeat(k)}</button>
        ))}
      </div>
      {n !== 0 && <label className="grid gap-1 text-sm font-bold">{n < 0 ? `Explique en une phrase (obligatoire : ${who} la verra)` : "Un petit mot (facultatif)"}
        <input className="input" maxLength={300} value={l?.comment ?? ""} onChange={(e) => set({ comment: e.target.value })} placeholder={n < 0 ? "Ex. : Peu concentré sur cet exercice, on en reparle." : "Ex. : Belle série de revers aujourd'hui !"} /></label>}
    </div>
  ); };
  return (
    <div className="grid gap-3">
      <p className="hint m-0">Les étoiles évaluent, cours après cours, {goals.length ? `les missions de ${who} et ses 4 qualités` : `les 4 qualités de ${who}`}. 0 = rien à signaler ; −1 à −3 = pas en progrès (le joueur voit toujours ton explication).</p>
      {goals.length > 0 && <h4 className="m-0">🎯 Les missions</h4>}
      {goals.map((g) => row("mission " + g.title, <>{DOMAIN_EMOJI[g.axis.toLowerCase()]} {g.title}</>, null, lines.find((x) => x.goalId === g.id), (p) => setMission(g, p)))}
      <h4 className="m-0">🌟 Les 4 qualités</h4>
      {QUALITIES.map((q) => row(q.label, <><span aria-hidden="true">{q.emoji} </span>{q.label}</>, q.hint, lines.find((l) => isQuality(l) && qualityOfReason(l.reason)!.key === q.key), (p) => setQuality(q.key, p)))}
      <details className="rounded-2xl border border-line bg-white p-3" open={others.length > 0}>
        <summary className="cursor-pointer font-bold">Autre étoile, hors mission et hors qualités</summary>
        <div className="mt-2"><OtherLinesEditor lines={others} who={who} onChange={(o) => onChange([...lines.filter((l) => !others.includes(l)), ...o])} /></div>
      </details>
    </div>
  );
}

export const StarsLine = ({ n }: { n: number }) => n < 0 ? <span className="font-black text-[#b3261e]" aria-label={`${-n} étoile${n < -1 ? "s" : ""} en moins`}>📉 −{-n} ⭐</span> : <span aria-label={`${n} étoile${n > 1 ? "s" : ""}`}>{"⭐".repeat(n)}</span>;

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
      <p className={"m-0 " + sub}>{who === "jeune" ? "Ton coach te donne 1 à 3 étoiles à la fin d'un cours, pour ton effort, ton attitude ou un progrès. Quand un domaine n'est pas en progrès, tu peux en perdre : il t'explique toujours pourquoi, pour t'aider à progresser. Ce n'est jamais une note, et personne d'autre que toi (et tes parents) ne les voit." : "Le coach donne 1 à 3 étoiles à la fin d'un cours, pour l'effort, l'attitude ou un progrès. Quand un domaine n'est pas en progrès, il peut en retirer, toujours avec une explication. Ce n'est jamais une note."}</p>
      {stars.length === 0 ? <p className={"m-0 rounded-2xl p-3 " + row}>Pas encore d'étoile : {who === "jeune" ? "ton coach en donne" : "le coach en donne"} à la fin des cours.</p> : (
        <>
          <p className="m-0 flex flex-wrap items-baseline gap-x-4 gap-y-1"><strong className="text-4xl font-black">⭐ {totalStars(stars)}</strong><span className={sub}>étoile{totalStars(stars) > 1 ? "s" : ""} en tout · {thisMonth} ce mois-ci</span></p>
          <ul className="m-0 grid list-none gap-2 p-0">
            {stars.slice(0, 12).map((s) => { const r = starReason(s.reason); const neg = s.stars < 0; return (
              <li key={s.id} className={"grid gap-0.5 rounded-2xl p-3 " + row + (neg ? " border-l-4 border-[#ff8a80]" : "")}>
                <span className="flex flex-wrap items-center justify-between gap-2"><strong><StarsLine n={s.stars} /> {r ? `${r.emoji} ${r.label}` : ""}{s.domain ? ` · ${DOMAIN_EMOJI[s.domain] ?? ""} ${EVAL_AXES.find((a) => a.key === s.domain)?.label ?? ""}` : ""}</strong><small className={sub}>{fmtDay(s.day)}</small></span>
                {neg && <small className={sub}>Pas en progrès cette fois : ce n'est pas grave, c'est pour t'aider à progresser.</small>}
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

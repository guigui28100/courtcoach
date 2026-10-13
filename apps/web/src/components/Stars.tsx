import { useEffect, useState } from "react";
import { get } from "../api";
import { Radar } from "./Radar";
import { Goal, QUALITIES, qualityOfReason, CourseStar, currentSeason, DOMAIN_EMOJI, EVAL_AXES, fmtDay, isNegReason, starReason, STAR_NEG_REASONS, STAR_REASONS, starsByDomain, STARS_FOR_FULL, STARS_PER_POINT, totalStars, trimesterOf } from "../types";

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

// Suivi des progrès cours après cours (ancien « radar de tous les jours ») : alimenté par les étoiles de la saison, mis à jour à chaque cours
export function StarsRadar({ stars, dark = false, who = "jeune", season: seasonProp, t: tProp, bulletin = false, start, hideDomains = false }: { stars: CourseStar[] | null; dark?: boolean; who?: "jeune" | "famille" | "coach"; season?: string; t?: number; bulletin?: boolean; hideDomains?: boolean; start?: Record<string, number> }) {
  if (!stars) return <div className="skeleton h-24" role="status" aria-label="Chargement en cours" />;
  const season = seasonProp ?? currentSeason(), t = tProp ?? trimesterOf();
  const by = starsByDomain(stars, season, t);
  const values = Object.fromEntries(EVAL_AXES.map((a) => [a.key, Math.min(5, (by[a.key] * 5) / STARS_FOR_FULL)]));
  const total = Object.values(by).reduce((n, v) => n + v, 0);
  // Avec un point de départ : le 2e radar part du MÊME dessin, puis chaque étoile le fait grandir (60 étoiles = +5 points, 12 étoiles = +1 point, sans dépasser 5)
  const now = start ? Object.fromEntries(EVAL_AXES.map((a) => [a.key, Math.min(5, (start[a.key] || 0) + (by[a.key] * 5) / STARS_FOR_FULL)])) : values;
  const sub = dark ? "text-white/80" : "text-muted";
  const me = who === "jeune";
  return (
    <section className={dark ? "glass grid gap-4" : "card grid gap-4"} aria-labelledby="stars-radar">
      <h2 id="stars-radar" className={bulletin ? "m-0 text-2xl" : "m-0 text-2xl"}>🌟 {bulletin ? `Suivi des progrès cours après cours · trimestre ${t}` : me ? `Mon suivi des progrès cours après cours · trimestre ${t}` : `Le suivi des progrès cours après cours · trimestre ${t}`}</h2>
      <p className={"m-0 " + sub}>{bulletin ? `Les étoiles données à ${who === "coach" ? "ce joueur" : "ce joueur"} pendant ce trimestre, par domaine.` : me ? "Chaque étoile que ton coach te donne fait grandir un domaine. Plus tu en gagnes, plus ton radar se remplit ; quand ton coach te dit « pas en progrès » dans un domaine, il perd des étoiles. Il repart de zéro à chaque trimestre : à toi de le remplir à nouveau !" : "Chaque étoile fait grandir un domaine. Le radar se remplit au fil des cours du trimestre, se met à jour à chaque cours et repart de zéro au trimestre suivant."} Un domaine est plein à {STARS_FOR_FULL} étoiles.</p>
      {start && <p className={"m-0 rounded-xl p-3 " + (dark ? "bg-white/10" : "bg-sand/60")}>📐 Le radar de droite <strong>part exactement de ton point de départ</strong>. Chaque étoile le fait grandir : <strong>{STARS_PER_POINT} étoiles dans un domaine = 1 point de plus</strong>.</p>}
      {start ? (
        // Deux radars côte à côte : le point de départ (fixe) et celui des étoiles (il grandit à chaque cours)
        <div className="grid gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid justify-items-center gap-1"><strong>📍 Mon point de départ <small className={"font-normal " + sub}>(il ne bouge pas)</small></strong><Radar dark={dark} series={[{ label: "Départ", values: start, color: dark ? "#ffffff" : "#10203a" }]} /></div>
            <div className="grid justify-items-center gap-1"><strong>🌟 Mon niveau maintenant <small className={"font-normal " + sub}>(il grandit avec tes étoiles)</small></strong><Radar dark={dark} series={[{ label: "Départ", values: start, color: dark ? "#ffffff" : "#10203a", dashed: true }, { label: `Maintenant T${t}`, values: now, color: dark ? "#dcf247" : "#e0b100" }]} /></div>
          </div>
          {total === 0 && <p className={"m-0 rounded-2xl p-3 " + (dark ? "bg-white/10" : "bg-sand/60")}>Pas encore d'étoile ce trimestre : les deux radars sont identiques. Dès les premiers cours, celui de droite grandit.</p>}
          {!hideDomains && (
          <ul className="m-0 grid list-none gap-2 p-0 sm:grid-cols-2" aria-label="Étoiles par domaine">
            {EVAL_AXES.map((a) => (
              <li key={a.key} className={"flex items-center justify-between gap-3 rounded-xl px-3 py-2 " + (dark ? "bg-white/10" : "bg-sand/60")}>
                <span className="font-bold"><span aria-hidden="true">{DOMAIN_EMOJI[a.key]} </span>{a.label}</span>
                <span className="flex items-center gap-2"><strong>⭐ {by[a.key]}{by[a.key] >= STARS_FOR_FULL ? " · plein !" : ""}</strong></span>
              </li>
            ))}
          </ul>
          )}
        </div>
      ) : total === 0 ? <p className={"m-0 rounded-2xl p-3 " + (dark ? "bg-white/10" : "bg-sand/60")}>Pas encore d'étoile ce trimestre : le suivi se remplira dès les premiers cours.</p> : (
        <div className={"grid items-center gap-4 " + (hideDomains ? "justify-items-center" : "md:grid-cols-[300px_1fr]")}>
          <div className="grid justify-items-center"><Radar dark={dark} series={[{ label: `Étoiles T${t}`, values, color: dark ? "#dcf247" : "#e0b100" }]} /></div>
          {!hideDomains && (
          <ul className="m-0 grid list-none gap-2 p-0" aria-label="Étoiles par domaine">
            {EVAL_AXES.map((a) => (
              <li key={a.key} className={"flex items-center justify-between gap-3 rounded-xl px-3 py-2 " + (dark ? "bg-white/10" : "bg-sand/60")}>
                <span className="font-bold"><span aria-hidden="true">{DOMAIN_EMOJI[a.key]} </span>{a.label}</span>
                <span className="flex items-center gap-2"><strong>⭐ {by[a.key]}{by[a.key] >= STARS_FOR_FULL ? " · plein !" : ""}</strong></span>
              </li>
            ))}
          </ul>
          )}
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

const QUICK = [{ n: -1, emoji: "⬇️", label: "Recul −1", color: "#8b1e3f" }, { n: 0, emoji: "😕", label: "Pas encore", color: "#d64545" }, { n: 1, emoji: "🙂", label: "Ça progresse", color: "#e8920c" }, { n: 2, emoji: "😃", label: "Réussi", color: "#2c9a5b" }];
const DOMAIN_COLOR: Record<string, string> = { technique: "#b8471f", tactique: "#2a6fb0", physique: "#2f8f5b", mental: "#7a4cc2" };
function QuickButtons({ value, onPick, who, name }: { value: number; onPick: (n: number) => void; who: string; name: string }) {
  return (
    <div className="grid grid-cols-4 gap-1.5" role="radiogroup" aria-label={`${name} pour ${who}`}>
      {QUICK.map((q) => (
        <button key={q.n} type="button" role="radio" aria-checked={value === q.n} onClick={() => onPick(q.n)}
          className={"flex min-h-14 flex-col items-center justify-center rounded-xl border-2 px-1 text-center leading-tight " + (value === q.n ? "text-white shadow-md" : "border-line bg-sand text-muted hover:bg-white")}
          style={value === q.n ? { background: q.color, borderColor: q.color } : undefined}>
          <span className="text-xl" aria-hidden="true">{q.emoji}</span><span className="text-xs font-bold">{q.label}</span>
        </button>
      ))}
    </div>
  );
}
// Étoiles = évaluation jour après jour des missions : une rangée par mission (de −3 à 3), puis éventuellement une étoile « hors mission »
export function StarLinesEditor({ lines, onChange, who, goals = [], allStars, day }: { lines: StarLine[]; onChange: (l: StarLine[]) => void; who: string; goals?: Goal[]; allStars?: CourseStar[]; day?: string }) {
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
  const noteField = (n: number, l: StarLine | undefined, set: (p: Partial<StarLine>) => void) => n !== 0 && (
    <label className="grid gap-1 text-sm font-bold">{n < 0 ? `✏️ Explique pourquoi (obligatoire : ${who} la verra)` : "Un petit mot (facultatif)"}
      <input className="input" maxLength={300} value={l?.comment ?? ""} onChange={(e) => set({ comment: e.target.value })} placeholder={n < 0 ? "Ex. : Beaucoup de balles dans le filet, on en reparle." : "Ex. : Belle série de revers aujourd'hui !"} /></label>
  );
  // Une carte par objectif : 4 gros boutons (recul −1, pas encore 0, ça progresse +1, réussi +2)
  const missionRow = (g: Goal) => {
    const l = lines.find((x) => x.goalId === g.id), n = l?.stars ?? 0, target = g.targetStars ?? 10;
    // Le total bouge tout de suite : étoiles des AUTRES jours + ce qui est choisi pour ce cours (le cours du jour remplace ce qui était déjà enregistré ce jour-là)
    const before = (allStars ?? []).filter((x) => x.goalId === g.id && (!day || x.day !== day)).reduce((a, x) => a + x.stars, 0);
    const got = Math.max(0, before + (day ? n : 0));
    const pct = Math.min(100, Math.round((got / Math.max(1, target)) * 100));
    const set = (p: Partial<StarLine>) => setMission(g, p);
    return (
      <div key={g.id} className="grid gap-2 rounded-2xl border-2 border-line bg-white p-3" style={{ borderLeftWidth: 7, borderLeftColor: DOMAIN_COLOR[g.axis.toLowerCase()] ?? "#999" }}>
        <strong>{DOMAIN_EMOJI[g.axis.toLowerCase()]} {g.title}</strong>
        {allStars && <div className="flex items-center gap-2"><div className="h-2.5 flex-1 overflow-hidden rounded-full bg-sand" role="img" aria-label={`${got} étoiles sur ${target}`}><div className="h-full" style={{ width: `${pct}%`, background: DOMAIN_COLOR[g.axis.toLowerCase()] ?? "#999" }} /></div><small className="whitespace-nowrap font-bold text-muted" aria-live="polite">{got} sur {target} ⭐{day && n !== 0 && <span className={n > 0 ? " text-ok" : " text-bad"}> ({n > 0 ? "+" : "−"}{Math.abs(n)} ce cours)</span>}</small></div>}
        <QuickButtons who={who} name={g.title} value={n} onPick={(k) => set({ stars: k })} />
        {n !== 0 && !QUICK.some((q) => q.n === n) && <small className="font-bold text-muted">Actuellement : {n} ⭐ (choisis un bouton pour changer)</small>}
        {noteField(n, l, set)}
      </div>
    );
  };
  // Les 2 qualités : un bouton « super » et un bouton « à revoir »
  const qualityRow = (q: (typeof QUALITIES)[number]) => {
    const l = lines.find((x) => isQuality(x) && qualityOfReason(x.reason)!.key === q.key), n = l?.stars ?? 0;
    const set = (p: Partial<StarLine>) => setQuality(q.key, p);
    return (
      <div key={q.key} className="grid gap-2">
        <div className="grid grid-cols-2 gap-2" role="group" aria-label={`${q.label} de ${who}`}>
          <button type="button" aria-pressed={n > 0} title={q.hint} onClick={() => set({ stars: n > 0 ? 0 : 1 })} className={"flex min-h-12 items-center justify-center gap-2 rounded-xl border-2 px-2 text-sm font-bold " + (n > 0 ? "border-[#e0a800] bg-[#f5c518] text-[#4a3800]" : "border-line bg-white text-ink hover:bg-sand")}>🌟 {q.key === "attitude" ? "Super attitude" : "Super concentration"}</button>
          <button type="button" aria-pressed={n < 0} onClick={() => set({ stars: n < 0 ? 0 : -1 })} className={"flex min-h-12 items-center justify-center gap-2 rounded-xl border-2 px-2 text-sm font-bold " + (n < 0 ? "border-[#8b1e3f] bg-[#8b1e3f] text-white" : "border-line bg-white text-ink hover:bg-sand")}>⬇️ {q.key === "attitude" ? "Attitude à revoir" : "Concentration à revoir"}</button>
        </div>
        {noteField(n, l, set)}
      </div>
    );
  };
  return (
    <div className="grid gap-3">
      {goals.length > 0 ? <h4 className="m-0 font-bold">🚀 Les objectifs de {who}</h4> : <p className="hint m-0">{who} n'a pas encore d'objectif pour ce trimestre.</p>}
      {goals.map(missionRow)}
      <h4 className="m-0 font-bold">🌟 Attitude et concentration</h4>
      {QUALITIES.map(qualityRow)}
      <details className="rounded-2xl border border-line bg-white p-3" open={others.length > 0}>
        <summary className="cursor-pointer font-bold">Autre étoile, hors mission et hors qualités</summary>
        <div className="mt-2"><OtherLinesEditor lines={others} who={who} onChange={(o) => onChange([...lines.filter((l) => !others.includes(l)), ...o])} /></div>
      </details>
    </div>
  );
}

// Nombre d'étoiles en chiffres (+2, 0, −1…), pour les listes : date d'abord, puis ce nombre, puis le domaine
export const StarCount = ({ n }: { n: number }) => <b className={"inline-block min-w-14 whitespace-nowrap rounded-full px-2.5 py-0.5 text-center " + (n < 0 ? "bg-[#fde8e6] text-[#b3261e]" : "bg-[#fff3b0] text-[#6b4e00]")} aria-label={n < 0 ? `${-n} étoile${n < -1 ? "s" : ""} en moins` : `${n} étoile${n > 1 ? "s" : ""}`}>{n > 0 ? `+${n}` : n < 0 ? `−${-n}` : "0"} ⭐</b>;
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
                <span className="flex flex-wrap items-center gap-x-3 gap-y-1"><strong className="min-w-28">{fmtDay(s.day)}</strong><StarCount n={s.stars} /><strong>{s.domain ? `${DOMAIN_EMOJI[s.domain] ?? ""} ${EVAL_AXES.find((a) => a.key === s.domain)?.label ?? ""}` : "—"}</strong>{r && <span className={sub}>{r.emoji} {r.label}</span>}</span>
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

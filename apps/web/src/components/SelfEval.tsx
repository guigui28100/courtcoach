import { useCallback, useEffect, useState } from "react";
import { get, post, put } from "../api";
import { AXES, currentSeason, EVAL_AXES, FEELINGS, fmtDate, Goal, goalApplies, GoalStatus, MOODS, pendingSelfEval, Player, presetLabel, SELF_EVAL_MONTH, SELF_PRESETS, SelfEvaluation, selfEvalIsOpen, selfEvalOpensOn, STATUS } from "../types";

const GOAL_CHOICES: GoalStatus[] = ["ACHIEVED", "IN_PROGRESS", "NOT_ACHIEVED"];
const SELF_STATUS: Record<GoalStatus, string> = { ACHIEVED: "✅ J'ai réussi", IN_PROGRESS: "🔄 Je progresse", NOT_ACHIEVED: "💪 Pas encore" };

const VIEW_STATUS: Record<GoalStatus, string> = { ACHIEVED: "✅ Réussi", IN_PROGRESS: "🔄 En progrès", NOT_ACHIEVED: "💪 Pas encore" };

// Lecture seule d'un bulletin d'auto-évaluation (envoyé) : pour le jeune, le coach et le bulletin.
export function SelfEvalView({ ev, goals, dark = false }: { ev: SelfEvaluation; goals: Goal[]; dark?: boolean }) {
  const box = dark ? "bg-white/10" : "bg-[#f3efff]";
  const mood = ev.mood ? MOODS[ev.mood - 1] : null;
  const w = (me: string, he: string) => (dark ? me : he); // « mes » pour le jeune, « ses » pour le coach
  const list = (title: string, items: string[], preset: keyof typeof SELF_PRESETS) => items.length > 0 && (
    <div className={`grid gap-1 rounded-xl p-3 ${box}`}><strong>{title}</strong><ul className="m-0 grid gap-0.5 pl-5">{items.map((id) => <li key={id}>{presetLabel(SELF_PRESETS[preset], id) ?? id}</li>)}</ul></div>
  );
  const mine = goals.filter((g) => ev.goals[g.id]);
  const rated = EVAL_AXES.filter((a) => ev.ratings[a.key]);
  return (
    <div className="grid gap-3">
      {mood && <p className="m-0 text-lg font-bold"><span aria-hidden="true">{mood[0]} </span>{w("Mon", "Son")} trimestre : {mood[1]}</p>}
      {mine.length > 0 && <div className={`grid gap-1 rounded-xl p-3 ${box}`}><strong>🚀 {w("Mes", "Ses")} missions</strong><ul className="m-0 grid list-none gap-0.5 p-0">{mine.map((g) => <li key={g.id}>{VIEW_STATUS[ev.goals[g.id]]} : {g.title}</li>)}</ul></div>}
      {rated.length > 0 && <div className={`grid gap-1 rounded-xl p-3 ${box}`}><strong>🎚️ {w("Ce que je ressens", "Ce qu'il ressent")}</strong><ul className="m-0 grid list-none gap-0.5 p-0">{rated.map((a) => <li key={a.key}>{FEELINGS[ev.ratings[a.key] - 1][0]} {a.label} : {FEELINGS[ev.ratings[a.key] - 1][1]}</li>)}</ul></div>}
      {list(w("⭐ Mes fiertés", "⭐ Ses fiertés"), ev.proud, "proud")}
      {list(w("🎯 Je veux progresser en", "🎯 Il veut progresser en"), ev.improve, "improve")}
      {list(w("🌟 J'aimerais", "🌟 Il aimerait"), ev.wish, "wish")}
      {ev.comment && <p className={`m-0 rounded-xl p-3 ${box}`}><strong>💬 {w("Mon mot", "Son mot")} : </strong>« {ev.comment} »</p>}
    </div>
  );
}

function Chips({ options, value, max, onChange }: { options: [string, string][]; value: string[]; max: number; onChange: (v: string[]) => void }) {
  return (
    <div className="flex flex-wrap gap-2" role="group">
      {options.map(([id, label]) => {
        const on = value.includes(id); const full = !on && value.length >= max;
        return <button key={id} type="button" aria-pressed={on} disabled={full} onClick={() => onChange(on ? value.filter((v) => v !== id) : [...value, id])}
          className={"min-h-11 rounded-full border-2 px-4 py-1.5 text-left font-bold transition-colors disabled:opacity-40 " + (on ? "border-[#dcf247] bg-[#dcf247] text-ink" : "border-white/40 bg-white/10 text-white hover:bg-white/20")}>{on ? "✓ " : ""}{label}</button>;
      })}
    </div>
  );
}

function Faces({ value, onChange, label, faces }: { value: number | null | undefined; onChange: (v: number) => void; label: string; faces: readonly (readonly [string, string])[] }) {
  return (
    <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={label}>
      {faces.map(([e, t], i) => <button key={t} type="button" role="radio" aria-checked={value === i + 1} onClick={() => onChange(i + 1)}
        className={"grid min-h-14 min-w-[4.5rem] justify-items-center rounded-2xl border-2 px-2 py-1 text-sm font-bold " + (value === i + 1 ? "border-[#dcf247] bg-[#dcf247] text-ink" : "border-white/40 bg-white/10 text-white hover:bg-white/20")}><span className="text-2xl" aria-hidden="true">{e}</span>{t}</button>)}
    </div>
  );
}

const AXIS_HINT: Record<string, string> = { technique: "mes coups : coup droit, revers, service, volée…", tactique: "comprendre le jeu et choisir les bons coups", physique: "courir, tenir longtemps, être souple", mental: "me concentrer, rester calme, y croire", attitude: "être à l'heure, sérieux, bon esprit d'équipe, fair-play" };

function Form({ p, goals, season, t, initial, onChanged, preview, locked }: { preview?: boolean; locked?: boolean; p: Player; goals: Goal[]; season: string; t: number; initial?: SelfEvaluation; onChanged: () => void }) {
  const [mood, setMood] = useState<number | null>(initial?.mood ?? null);
  const [ratings, setRatings] = useState<Record<string, number>>(initial?.ratings ?? {});
  const [gs, setGs] = useState<Record<string, GoalStatus>>(initial?.goals ?? {});
  const [proud, setProud] = useState<string[]>(initial?.proud ?? []);
  const [improve, setImprove] = useState<string[]>(initial?.improve ?? []);
  const [wish, setWish] = useState<string[]>(initial?.wish ?? []);
  const [comment, setComment] = useState(initial?.comment ?? "");
  const [msg, setMsg] = useState(""); const [busy, setBusy] = useState(false);
  const mine = goals.filter((g) => goalApplies(g, t));
  const base = `/players/${p.id}/self-evaluations/${season}/${t}`;
  const body = () => ({ mood: mood ?? undefined, ratings, goals: Object.fromEntries(Object.entries(gs).filter(([id]) => mine.some((g) => g.id === id))), proud, improve, wish, comment });
  const save = async () => { if (preview) { setMsg("👀 Aperçu : rien n'est enregistré (c'est le jeune qui remplit son bulletin)."); return false; } setBusy(true); setMsg(""); try { await put(base, body()); setMsg("💾 Brouillon enregistré. Tu peux continuer plus tard."); onChanged(); return true; } catch (e: any) { setMsg("⚠️ " + (e.message || "Impossible d'enregistrer")); return false; } finally { setBusy(false); } };
  const send = async () => {
    if (preview) { setMsg("👀 Aperçu : rien n'est envoyé."); return; }
    if (!confirm("Envoyer ton bulletin à ton coach ? Après l'envoi, tu ne pourras plus le modifier.")) return;
    if (!(await save())) return; setBusy(true);
    try { await post(`${base}/send`); setMsg("🚀 Envoyé à ton coach !"); onChanged(); } catch (e: any) { setMsg("⚠️ " + (e.message || "Envoi impossible")); } finally { setBusy(false); }
  };
  const step = (n: number, title: string, hint?: string) => <><h3 className="m-0 text-lg"><span className="mr-2 inline-grid h-7 w-7 place-items-center rounded-full bg-[#dcf247] text-sm font-black text-ink" aria-hidden="true">{n}</span>{title}</h3>{hint && <p className="m-0 text-sm text-white/80">{hint}</p>}</>;
  return (
    <form onSubmit={(e) => { e.preventDefault(); save(); }}>
      <fieldset disabled={locked} className={"m-0 grid min-w-0 gap-5 border-0 p-0 " + (locked ? "opacity-60" : "")}>
      <div className="grid gap-1 rounded-2xl bg-white/10 p-4">
        <strong className="text-lg">🧭 À quoi sert ce bulletin ?</strong>
        <p className="m-0 text-white/90">C'est <strong>ton</strong> bulletin. Il ne sert pas à te noter : c'est un moment pour <strong>réfléchir à ton jeu, à ce que tu as appris et à ton projet</strong> pour la suite. Il n'y a ni bonne ni mauvaise réponse : sois sincère. Ton coach le lira pour mieux t'accompagner.</p>
        <p className="m-0 text-sm text-[#dcf247]">📅 À remplir en décembre (trimestre 1), en mars (trimestre 2) et en juin (trimestre 3). Compte 10 minutes, tu peux enregistrer un brouillon et finir plus tard.</p>
      </div>
      <div className="grid gap-2">{step(1, "Mon trimestre, c'était…", "Comment as-tu vécu ce trimestre en général : plaisir, motivation, envie de venir t'entraîner ? Choisis le visage qui te ressemble le mieux.")}<Faces faces={MOODS} value={mood} onChange={setMood} label="Mon trimestre" /></div>
      {mine.length > 0 && (
        <div className="grid gap-2">{step(2, "Mes missions", "Pour chaque mission de ton coach, dis où tu en es. ✅ J'ai réussi : je sens que c'est acquis. 🔄 Je progresse : ça avance, mais ce n'est pas fini. 💪 Pas encore : je n'y suis pas encore, et c'est normal, on s'entraîne pour ça !")}
          {mine.map((g) => { const a = AXES.find((x) => x.key === g.axis); return (
            <div key={g.id} className="grid gap-2 rounded-2xl bg-white/10 p-3"><strong>{g.title}</strong>
              <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={`Mission : ${g.title}`}>
                {GOAL_CHOICES.map((s) => <button key={s} type="button" role="radio" aria-checked={gs[g.id] === s} onClick={() => setGs({ ...gs, [g.id]: s })}
                  className={"min-h-11 rounded-full border-2 px-4 py-1.5 font-bold " + (gs[g.id] === s ? "border-[#dcf247] bg-[#dcf247] text-ink" : "border-white/40 bg-white/10 text-white hover:bg-white/20")}>{SELF_STATUS[s]}</button>)}
              </div><small className="text-white/70">{a?.label}</small></div>
          ); })}
        </div>
      )}
      <div className="grid gap-3">{step(3, "Comment je me sens dans…", "Pour chaque domaine, choisis le visage qui dit comment tu te sens en ce moment, de 😟 Difficile à 🤩 Super. Pense à tes entraînements et à tes matchs.")}
        {EVAL_AXES.map((a) => <div key={a.key} className="grid gap-1"><strong>{a.label} <small className="font-normal text-white/70">· {AXIS_HINT[a.key]}</small></strong><Faces faces={FEELINGS} value={ratings[a.key]} onChange={(v) => setRatings({ ...ratings, [a.key]: v })} label={a.label} /></div>)}
      </div>
      <div className="grid gap-2">{step(4, "Ce dont je suis fier (3 au maximum)", "Un progrès, un match, un effort, un bon moment : qu'est-ce qui t'a rendu fier ce trimestre ?")}<Chips options={SELF_PRESETS.proud} value={proud} max={3} onChange={setProud} /></div>
      <div className="grid gap-2">{step(5, "Je veux progresser en… (3 au maximum)", "Ce que tu aimerais travailler en priorité au prochain trimestre. Ton coach s'en servira pour choisir tes prochaines missions avec toi.")}<Chips options={SELF_PRESETS.improve} value={improve} max={3} onChange={setImprove} /></div>
      <div className="grid gap-2">{step(6, "Mon projet : j'aimerais… (3 au maximum)", "Tes envies pour la suite : jouer des matchs, faire un tournoi, t'amuser avec des jeux… Cela aide ton coach à construire ton projet avec toi.")}<Chips options={SELF_PRESETS.wish} value={wish} max={3} onChange={setWish} /></div>
      <div className="grid gap-2">{step(7, "Un petit mot pour mon coach (facultatif)", "Une idée, une question, un merci, ce que tu veux lui dire.")}
        <label htmlFor="se-comment" className="sr-only">Un petit mot pour mon coach</label>
        <textarea id="se-comment" value={comment} maxLength={300} rows={3} onChange={(e) => setComment(e.target.value)} placeholder="Par exemple : merci pour les exercices au filet !" className="w-full rounded-2xl border-2 border-white/40 bg-white p-3 text-ink" />
        <small className="text-white/70">{comment.length} / 300 caractères · Pas de nom, de téléphone ni d'adresse, s'il te plaît.</small>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" className="btn btn-sm border-2 border-white/70 text-white hover:bg-white hover:text-ink" disabled={busy}>💾 Enregistrer mon brouillon</button>
        <button type="button" className="gal-btn" disabled={busy} onClick={send}>🚀 Envoyer à mon coach</button>
      </div>
      {msg && <p role="status" className="m-0 font-bold text-[#dcf247]">{msg}</p>}
          </fieldset>
    </form>
  );
}

// Section « Mon bulletin » de l'espace du jeune
export function SelfEvalSection({ p, goals, preview, onSaved }: { p: Player; goals: Goal[]; preview?: boolean; onSaved?: () => void }) {
  const season = currentSeason();
  const [t, setT] = useState<number | null>(null);
  const [list, setList] = useState<SelfEvaluation[] | null>(null);
  const load = useCallback(() => { get<SelfEvaluation[]>(`/players/${p.id}/self-evaluations`).then(setList).catch(() => setList([])); }, [p.id]);
  useEffect(load, [load]);
  // On ouvre d'abord le bulletin à remplir maintenant ; sinon le premier trimestre
  useEffect(() => { if (list && t === null) setT(pendingSelfEval(list, season) ?? 1); }, [list, t, season]);
  const lockedAt = (n: number) => !preview && !selfEvalIsOpen(season, n); // l'aperçu du coach laisse essayer le formulaire
  const cur = t === null ? undefined : list?.find((e) => e.season === season && e.trimester === t);
  const opens = t === null ? null : selfEvalOpensOn(season, t);
  return (
    <section className="glass gal-pop grid gap-4" aria-labelledby="gal-mon-bulletin">
      <h2 id="gal-mon-bulletin" className="m-0 text-2xl">✍️ Mon bulletin du trimestre</h2>
      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Choisir le trimestre">
        {[1, 2, 3].map((n) => { const e = list?.find((x) => x.season === season && x.trimester === n); return (
          <button key={n} type="button" role="tab" aria-selected={t === n} onClick={() => setT(n)} className={"min-h-11 rounded-full border-2 px-4 font-bold " + (t === n ? "border-[#dcf247] bg-[#dcf247] text-ink" : "border-white/40 bg-white/10 text-white")}>Trimestre {n} · {SELF_EVAL_MONTH[n]}{e?.sentAt ? " ✅" : lockedAt(n) ? " 🔒" : e ? " ✏️" : ""}</button>
        ); })}
      </div>
      {list === null || t === null ? <p className="m-0 text-white/80">Chargement…</p> : cur?.sentAt ? (
        <div className="grid gap-3">
          <p role="status" className="m-0 rounded-xl bg-[#dcf247] p-3 font-bold text-ink">🚀 Envoyé à ton coach le {fmtDate(cur.sentAt)}{preview ? "" : cur.readAt ? " · il l'a lu ✅" : " · il ne l'a pas encore lu"}</p>
          <SelfEvalView ev={cur} goals={goals} dark />
        </div>
      ) : (
        <>
          {lockedAt(t) && opens && <p role="status" className="m-0 rounded-xl border-2 border-[#dcf247] p-3 font-bold">🔒 Ce bulletin s'ouvrira le 1er {SELF_EVAL_MONTH[t]} {opens.getUTCFullYear()}. En attendant, lis ce qui t'attend et observe ton jeu : tu en auras besoin pour répondre.</p>}
          <Form key={`${season}-${t}`} preview={preview} locked={lockedAt(t)} p={p} goals={goals} season={season} t={t} initial={cur} onChanged={() => { load(); onSaved?.(); }} />
        </>
      )}
    </section>
  );
}

// Côté coach : ce que le jeune a envoyé (lecture seule). Ouvrir le bulletin le marque comme lu.
export function CoachSelfEval({ p, season, t, goals, onPick }: { p: Player; season: string; t: number; goals: Goal[]; onPick: (s: string, t: number) => void }) {
  const [list, setList] = useState<SelfEvaluation[] | null>(null);
  useEffect(() => { get<SelfEvaluation[]>(`/players/${p.id}/self-evaluations`).then(setList).catch(() => setList([])); }, [p.id]);
  const cur = list?.find((e) => e.season === season && e.trimester === t);
  useEffect(() => {
    if (cur && !cur.readAt) post(`/players/${p.id}/self-evaluations/${cur.season}/${cur.trimester}/read`).then(() => setList((l) => l && l.map((e) => (e.id === cur.id ? { ...e, readAt: new Date().toISOString() } : e)))).catch(() => {});
  }, [cur?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!list?.length) return null;
  const others = list.filter((e) => e !== cur);
  return (
    <section className="grid gap-3 rounded-2xl border-2 border-[#7a4cc2] bg-white p-4" aria-label="Auto-évaluation du joueur">
      <h3 className="m-0">💬 Le regard de {p.firstName} sur son trimestre</h3>
      {cur ? <><p className="m-0 text-sm text-muted">Envoyé le {fmtDate(cur.sentAt!)}. Lecture seule : c'est son avis, il ne change pas ton évaluation.</p><SelfEvalView ev={cur} goals={goals} /></> : <p className="m-0 text-muted">Pas d'auto-évaluation envoyée pour cette période.</p>}
      {others.length > 0 && <div className="flex flex-wrap items-center gap-2"><span className="text-sm font-bold">Autres bulletins reçus :</span>{others.map((e) => <button key={e.id} type="button" className="btn btn-outline btn-sm" onClick={() => onPick(e.season, e.trimester)}>{e.readAt ? "" : "🆕 "}T{e.trimester} · {e.season.replace("-", "/")}</button>)}</div>}
    </section>
  );
}

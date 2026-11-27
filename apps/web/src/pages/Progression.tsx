import { BaseHelp } from "../components/BaseHelp";
import { ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { get, put } from "../api";
import { Err, Page, PageHead } from "../components/ui";
import { buildPages, DocChoice } from "../components/ProgressionDoc";
import { Bilan } from "../components/ProgressionBilan";
import { Players } from "../components/ProgressionRoll";
import { Docs, PrintHost } from "../components/ProgressionViews";
import { Diag } from "../components/ProgressionDiag";
import { Goals } from "../components/ProgressionGoals";
import { Schedule } from "../components/ProgressionSchedule";
import { Plan, AdaptBanner } from "../components/ProgressionPlan";
import { Sheet } from "../components/ProgressionSheet";
import { Eval } from "../components/ProgressionEval";
import {
  nextSession, retheme, refreshExercises, applyGoals, sessionStatus, STATUS_LABEL, withDiag, diagCount, presentRate, compsOf, titleOptions, LevelDef, BLOCK_NAMES, defaultBlocks, freeSession, objCount, objectiveOptions, objOf, withObj,
  BILAN_LEVELS, cyclesOf, CourseDay, slotLabel, minutesBetween, sessionCount, phaseRange, DOMAINS, Domain, domainOf, generate, Group, LEVELS_FFT, levelDef, levelTech, newId, PHASES, phaseOf, sessionColor, sessionDomain, sessionFor, Session, THEMES, THEME_NAMES, themesInText, weights,
} from "../progression";

const KIND: Record<Session["kind"], string> = { bilan: "Bilan", etape: "Point d'étape", jeu: "Match", theme: "Thème" };

type Step = 1 | 2 | 3 | 4;
const STEPS: { n: Step; t: string; help: string }[] = [
  { n: 1, t: "Groupe", help: "Les élèves (prénoms), les jours et l'horaire du cours, et l'appel." },
  { n: 2, t: "Séances", help: "Tes séances sont déjà prêtes : thème, objectifs et déroulement complet. Ouvre-en une pour la lire, la modifier ou l'imprimer." },
  { n: 3, t: "Affiner", help: "Facultatif : décris le niveau de ton groupe et choisis tes objectifs, l'outil refait alors les séances sur mesure." },
  { n: 4, t: "Suivi", help: "Les bilans en cours et en fin d'année, et le cycle suivant." },
];
const stepDone = (g: Group, n: Step) => (n === 1 ? (g.players?.length || g.size) > 0 && !!g.days?.length : n === 2 ? g.sessions.some((s) => s.done) : n === 3 ? !!g.validated || diagCount(g) > 0 : Object.values(g.checks || {}).some((c) => c && Object.keys(c.scores).length > 0));
const firstTodo = (g: Group): Step => (g.sessions.length ? 2 : 1);

export default function Progression() {
  const [groups, setGroups] = useState<Group[] | null>(null);
  const [delId, setDelId] = useState("");
  const [sel, setSel] = useState(""); const [step, setStep] = useState<Step>(1);
  const [err, setErr] = useState(""); const [state, setState] = useState<"" | "saving" | "saved" | "error">("");
  const [adding, setAdding] = useState(false); const [printPages, setPrintPages] = useState<ReactNode[] | null>(null); const [docs, setDocs] = useState(false);
  const loaded = useRef(false); const sig = useRef("");

  useEffect(() => {
    get<{ groups: Group[] }>("/progressions").then((r) => {
      const gs = (r.groups || []).map((g) => ({ ...g, bilan: g.bilan || {}, players: g.players || [], appel: g.appel || {}, sessions: g.sessions || [], minutes: g.minutes || 60 }));
      sig.current = JSON.stringify(gs); setGroups(gs); loaded.current = true; if (!gs.length) setAdding(true);
    }).catch((e) => setErr(e.message));
  }, []);

  // Enregistrement automatique, un instant après la dernière modification
  useEffect(() => {
    if (!groups || !loaded.current) return;
    const now = JSON.stringify(groups); if (now === sig.current) return;
    setState("saving");
    const t = window.setTimeout(() => {
      put("/progressions", { data: { groups } }).then(() => { sig.current = now; setState("saved"); }).catch((e) => { setState("error"); setErr(e.message); });
    }, 1200);
    return () => window.clearTimeout(t);
  }, [groups]);

  const g = groups?.find((x) => x.id === sel) ?? null;
  const upd = (patch: Partial<Group>) => setGroups((gs) => gs!.map((x) => (x.id === sel ? { ...x, ...patch } : x)));
  const open = (x: Group, n?: Step) => { setSel(x.id); setStep(n ?? firstTodo(x)); setAdding(false); setDocs(false); window.scrollTo({ top: 0 }); };
  const go = (n: Step) => { setStep(n); setDocs(false); window.scrollTo({ top: 0 }); };
  const create = (n: Partial<Group>) => { const pl = n.players || []; const dy = n.days || []; const ng: Group = { id: newId(), name: n.name || "Nouveau groupe", level: n.level || LEVELS_FFT[2].key, size: pl.length || n.size || 0, players: pl, days: dy, slot: dy.length ? slotLabel({ days: dy } as Group) : "", appel: {}, minutes: dy.length ? minutesBetween(dy[0].from, dy[0].to) || 60 : n.minutes || 60, bilan: {}, notes: "", sessions: [] }; ng.sessions = generate(ng); setGroups((gs) => [...gs!, ng]); setSel(ng.id); setStep(2); setAdding(false); };
  const remove = () => { setGroups((gs) => gs!.filter((x) => x.id !== sel)); setSel(""); };
  const removeId = (id: string) => { setGroups((gs) => gs!.filter((x) => x.id !== id)); setDelId(""); };

  const transfer = (name: string, toId: string) => setGroups((gs) => gs!.map((x) => {
    if (x.id === sel) { const pl = (x.players || []).filter((n) => n !== name); return { ...x, players: pl, size: pl.length }; }
    if (x.id === toId) { const pl = (x.players || []).some((n) => n.toLowerCase() === name.toLowerCase()) ? x.players! : [...(x.players || []), name].slice(0, 40); return { ...x, players: pl, size: pl.length }; }
    return x;
  }));
  const nextCycle = () => {
    if (!g) return; const last = (["30", "20", "10"] as const).map((k) => g.checks?.[k]).find((c) => c && Object.keys(c.scores).length);
    const bump = (s?: string) => (s && /\d{4}\s*[-–/]\s*\d{4}/.test(s) ? s.replace(/(\d{4})(\s*[-–/]\s*)(\d{4})/, (_m, a, m, b) => `${+a + 1}${m}${+b + 1}`) : "");
    const ng: Group = { id: newId(), name: `${g.name} (cycle suivant)`, level: g.level, size: g.players?.length || g.size, players: g.players || [], appel: {}, minutes: g.minutes, bilan: {}, notes: "", sessions: [], teacher: g.teacher, age: g.age, slot: g.slot, days: g.days, season: bump(g.season), diag: { ...(g.diag || {}), ...(last?.scores || {}) }, diagObs: {}, playerObs: g.playerObs || {}, goals: [], validated: false, checks: {} }; ng.sessions = generate(withDiag(ng));
    setGroups((gs) => [...gs!, ng]); setSel(ng.id); setStep(2);
  };
  const doPrint = (c: DocChoice, a = 1, b = 30) => { if (g) setPrintPages(buildPages(g, c, a, b)); };
  // Créer les 30 séances d'après les objectifs validés, puis aller directement à l'étape Séances
  const createSessions = () => { if (!g) return; upd({ sessions: applyGoals(generate(withDiag(g)), g.goals || []) }); go(2); };
  const days = (d: CourseDay[]) => upd({ days: d, slot: slotLabel({ days: d } as Group), ...(d.length ? { minutes: minutesBetween(d[0].from, d[0].to) || g!.minutes } : {}) });

  if (err && !groups) return <Page><Err msg={err} /></Page>;
  if (!groups) return <Page><div className="skeleton h-40" /></Page>;
  const saving = state && <span role="status" className="text-xs text-muted">{state === "saving" ? "Enregistrement…" : state === "saved" ? "✔ Enregistré" : "Pas enregistré"}</span>;

  // ÉCRAN 1 : mes groupes
  if (!g || adding) {
    return (
      <>
        <PageHead eyebrow="Mon travail de prof" title="Mes cours" icon="🗓️">Crée ton groupe : tes séances sont prêtes tout de suite. Seul toi vois cette page.</PageHead>
        <Page>
          {err && <Err msg={err} />}
          {adding ? <NewGroup onCreate={create} onCancel={groups.length ? () => setAdding(false) : undefined} /> : (
            <div className="grid gap-4">
              <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="m-0 text-xl">Mes groupes</h2><div className="flex items-center gap-3">{saving}<button type="button" className="btn-clay" onClick={() => setAdding(true)}>＋ Nouveau groupe</button></div></div>
              <ul className="m-0 grid list-none gap-3 p-0 sm:grid-cols-2 lg:grid-cols-3">
                {groups.map((x) => {
                  const n = firstTodo(x); const done = x.sessions.filter((s) => s.done).length;
                  return (
                    <li key={x.id} className="grid gap-3 rounded-xl border-2 border-line bg-white p-4">
                      <div><b className="block text-lg [overflow-wrap:anywhere]">{x.name}</b><span className="text-sm text-muted">{x.level.split(" · ")[0]}{(x.players?.length || x.size) ? ` · ${x.players?.length || x.size} joueurs` : ""}</span>{slotLabel(x) && <span className="block text-xs text-muted">{slotLabel(x)}</span>}</div>
                      <ol className="m-0 flex list-none gap-1 p-0" aria-label="Avancement">{STEPS.map((s) => <li key={s.n} title={s.t} className={`h-2 flex-1 rounded ${stepDone(x, s.n) ? "bg-ok" : "bg-line"}`} />)}</ol>
                      <p className="m-0 text-sm">{x.sessions.length ? `${done} séance${done > 1 ? "s" : ""} faite${done > 1 ? "s" : ""} sur ${x.sessions.length}` : `Prochaine étape : ${STEPS[n - 1].t}`}</p>
                      <button type="button" className="btn-clay" onClick={() => open(x)}>Continuer</button>
                      {delId === x.id ? <div className="grid gap-2 rounded-lg border border-line bg-paper p-2 text-sm"><b>Supprimer « {x.name} » et toute sa programmation ?</b><div className="flex gap-2"><button type="button" className="btn-ink btn-sm" onClick={() => removeId(x.id)}>Oui, supprimer</button><button type="button" className="btn-outline btn-sm" onClick={() => setDelId("")}>Non</button></div></div>
                        : <button type="button" className="btn-outline btn-sm" onClick={() => setDelId(x.id)}>🗑️ Supprimer ce groupe</button>}
                    </li>);
                })}
              </ul>
            </div>)}
        </Page>
        <PrintHost pages={printPages} onDone={() => setPrintPages(null)} />
      </>
    );
  }

  // ÉCRAN 2 : un groupe, 5 étapes
  const info = STEPS[step - 1];
  return (
    <>
      <Page>
        {err && <Err msg={err} />}
        <div className="grid gap-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <button type="button" className="btn-outline btn-sm" onClick={() => setSel("")}>← Mes groupes</button>
            <div className="min-w-0 flex-1 text-center sm:text-left"><b className="font-serif text-xl [overflow-wrap:anywhere]">{g.name}</b> <span className="text-sm text-muted">· {g.level.split(" · ")[0]}</span></div>
            {saving}
          </div>

          <nav aria-label="Les étapes">
            <ol className="m-0 grid list-none grid-cols-4 gap-1 p-0">
              {STEPS.map((s) => { const cur = s.n === step, ok = stepDone(g, s.n); return (
                <li key={s.n}><button type="button" aria-current={cur ? "step" : undefined} onClick={() => go(s.n)} className={`grid w-full justify-items-center gap-1 rounded-lg border-2 px-1 py-2 text-center ${cur ? "border-ink bg-ink text-white" : "border-line bg-white hover:border-ink"}`}>
                  <span className={`grid size-7 place-items-center rounded-full text-sm font-bold ${cur ? "bg-white text-ink" : ok ? "bg-ok text-white" : "bg-line text-ink"}`}>{ok && !cur ? "✔" : s.n}</span>
                  <span className="text-xs font-bold sm:text-sm">{s.t}</span></button></li>); })}
            </ol>
          </nav>

          <div className="rounded-lg border-l-4 border-champagne bg-paper p-3"><b>{info.t}.</b> <span className="text-muted">{info.help}</span></div>

          {step === 1 && (
            <div className="grid gap-4">
              <div className="rounded-xl border border-line bg-white p-4"><Schedule days={g.days || []} onChange={days} /></div>
              <Players g={g} upd={upd} others={groups.filter((x) => x.id !== g.id).map((x) => ({ id: x.id, name: x.name }))} onTransfer={transfer} />
              <details className="rounded-xl border border-line bg-white p-4"><summary className="cursor-pointer font-bold">Informations du groupe (niveau, durée, horaire…)</summary><div className="mt-3"><GroupHead g={g} upd={upd} onDelete={remove} /></div></details>
            </div>)}
          {step === 2 && (
            <div className="grid gap-4">
              <Programme g={g} upd={upd} onPrint={doPrint} toPlan={() => go(3)} />
              {g.sessions.length > 0 && <div><button type="button" className="btn-outline" aria-expanded={docs} onClick={() => setDocs(!docs)}>Documents à imprimer</button></div>}
              {docs && <Docs g={g} onPrint={doPrint} />}
            </div>)}
          {step === 3 && (
            <div className="grid gap-4">
              <details open={diagCount(g) === 0} className="rounded-xl border border-line bg-white p-4">
                <summary className="cursor-pointer text-lg font-bold">A · Analyse de départ du groupe</summary>
                <div className="mt-4 grid gap-5">
                  <Diag g={g} upd={upd} next={() => undefined} />
                  <details className="rounded-xl border border-line p-4"><summary className="cursor-pointer font-bold">Facultatif : décrire le groupe par un texte libre</summary><div className="mt-4"><Bilan g={g} upd={upd} next={() => undefined} /></div></details>
                </div>
              </details>
              <details open={diagCount(g) > 0} className="rounded-xl border border-line bg-white p-4">
                <summary className="cursor-pointer text-lg font-bold">B · Objectifs de l'année</summary>
                <div className="mt-4"><Goals g={g} upd={upd} create={createSessions} /></div>
              </details>
            </div>)}
          {step === 4 && <Eval g={g} upd={upd} onNextCycle={nextCycle} />}

          <div className="flex items-center justify-between gap-3 border-t border-line pt-4">
            {step > 1 ? <button type="button" className="btn-outline" onClick={() => go((step - 1) as Step)}>← {STEPS[step - 2].t}</button> : <span />}
            {step < 4 && <button type="button" className="btn-clay" onClick={() => go((step + 1) as Step)}>{STEPS[step].t} →</button>}
          </div>
        </div>
      </Page>
      <PrintHost pages={printPages} onDone={() => setPrintPages(null)} />
    </>
  );
}

function NewGroup({ onCreate, onCancel }: { onCreate: (g: Partial<Group>) => void; onCancel?: () => void }) {
  const [name, setName] = useState(""); const [level, setLevel] = useState(LEVELS_FFT[2].key); const [minutes, setMinutes] = useState(60); const [first, setFirst] = useState(""); const [days, setDays] = useState<CourseDay[]>([]);
  return (
    <form className="grid max-w-xl gap-4 rounded-xl border border-line bg-white p-5" onSubmit={(e) => { e.preventDefault(); onCreate({ name: name.trim(), level, minutes, days, players: [...new Set(first.split(/[,;\n]/).map((t) => t.trim().slice(0, 30)).filter(Boolean))].slice(0, 40) }); }}>
      <h2 className="m-0 text-xl">Nouveau groupe</h2>
      <label className="grid gap-1"><span className="font-bold">Nom du groupe</span><input id="pg-name" className="input" value={name} maxLength={60} placeholder="Ex. Orange du mercredi 17 h" onChange={(e) => setName(e.target.value)} required /></label>
      <label className="grid gap-1"><span className="font-bold">Niveau (repères Galaxie Tennis et adultes)</span>
        <select id="pg-level" className="input" value={level} onChange={(e) => setLevel(e.target.value)}>{LEVELS_FFT.map((l) => <option key={l.key}>{l.key}</option>)}</select></label>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2"><Schedule days={days} onChange={setDays} /></div>
        <label className="grid gap-1 sm:col-span-2"><span className="font-bold">Prénoms des élèves (séparés par une virgule)</span><input id="pg-players" className="input" value={first} maxLength={400} placeholder="Ex. Léa, Tom, Inès" onChange={(e) => setFirst(e.target.value)} /></label>
        {!days.length && <label className="grid gap-1"><span className="font-bold">Durée d'une séance (minutes)</span><input id="pg-min" className="input" type="number" min={20} max={180} step={5} value={minutes} onChange={(e) => setMinutes(+e.target.value)} /></label>}
      </div>
      <div className="flex flex-wrap gap-3"><button className="btn-clay">Créer le groupe</button>{onCancel && <button type="button" className="btn-outline" onClick={onCancel}>Annuler</button>}</div>
    </form>
  );
}

function GroupHead({ g, upd, onDelete }: { g: Group; upd: (p: Partial<Group>) => void; onDelete: () => void }) {
  const L = levelDef(g.level); const [ask, setAsk] = useState(false);
  return (
    <section className="grid gap-4 rounded-xl border border-line bg-white p-4">
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_7rem_7rem]">
        <label className="grid gap-1"><span className="text-xs font-bold uppercase tracking-wide text-muted">Groupe</span><input id="g-name" className="input" value={g.name} maxLength={60} onChange={(e) => upd({ name: e.target.value })} /></label>
        <label className="grid gap-1"><span className="text-xs font-bold uppercase tracking-wide text-muted">Niveau</span>
          <select id="g-level" className="input" value={g.level} onChange={(e) => upd({ level: e.target.value })}>{LEVELS_FFT.map((l) => <option key={l.key}>{l.key}</option>)}</select></label>
        <label className="grid gap-1"><span className="text-xs font-bold uppercase tracking-wide text-muted">Joueurs</span><input id="g-size" className="input" type="number" min={0} max={60} value={g.players?.length || g.size} disabled={!!g.players?.length} onChange={(e) => upd({ size: Math.max(0, Math.min(60, +e.target.value || 0)) })} /></label>
        <label className="grid gap-1"><span className="text-xs font-bold uppercase tracking-wide text-muted">Séance (min)</span><input id="g-min" className="input" type="number" min={20} max={180} step={5} value={g.minutes} onChange={(e) => upd({ minutes: Math.max(20, Math.min(180, +e.target.value || 60)) })} /></label>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="grid gap-1"><span className="text-xs font-bold text-muted">Enseignant responsable</span><input id="g-teacher" className="input" maxLength={60} value={g.teacher || ""} onChange={(e) => upd({ teacher: e.target.value })} /></label>
        <label className="grid gap-1"><span className="text-xs font-bold text-muted">Catégorie d'âge</span><input id="g-age" className="input" maxLength={40} value={g.age || ""} placeholder="Ex. 8-9 ans" onChange={(e) => upd({ age: e.target.value })} /></label>
        <div className="grid gap-1"><span className="text-xs font-bold text-muted">Jours et horaires</span><span className="py-2 text-sm">{slotLabel(g) || "à indiquer ci-dessus"}</span></div>
        <label className="grid gap-1"><span className="text-xs font-bold text-muted">Saison sportive</span><input id="g-season" className="input" maxLength={20} value={g.season || ""} placeholder="Ex. 2026-2027" onChange={(e) => upd({ season: e.target.value })} /></label>
      </div>
      <div className="rounded-lg border-l-4 border-champagne bg-paper p-3 text-sm">
        <b>Attendu à ce niveau</b> <span className="text-muted">({L.age} · {L.terrain} · {L.ball})</span>
        <ul className="m-0 mt-1 list-disc pl-5">{L.att.map((a) => <li key={a}>{a}</li>)}</ul>
        <p className="hint m-0 mt-1">Repères indicatifs inspirés de la Galaxie Tennis : à confronter aux documents fédéraux.</p>
        {levelTech(g.level).length > 0 && <details className="mt-2"><summary className="cursor-pointer font-bold">Objectifs techniques de ce niveau ({levelTech(g.level).length})</summary>
          <ul className="m-0 mt-1 list-disc pl-5">{levelTech(g.level).map(([a, t]) => <li key={a + t}><b>{a}</b> : {t}</li>)}</ul>
          <p className="hint m-0 mt-1">Référentiel pédagogique indicatif (Tennis Club 360), pas la grille officielle FFT. Ils sont aussi proposés dans « Technique » quand tu construis une séance.</p></details>}
      </div>
      <div className="flex justify-end">
        {ask ? <span className="flex items-center gap-2 text-sm"><b>Supprimer ce groupe et sa programmation ?</b><button type="button" className="btn-ink btn-sm" onClick={onDelete}>Oui, supprimer</button><button type="button" className="btn-outline btn-sm" onClick={() => setAsk(false)}>Non</button></span>
          : <button type="button" className="btn-outline btn-sm" onClick={() => setAsk(true)}>🗑️ Supprimer le groupe</button>}
      </div>
    </section>
  );
}

function Programme({ g, upd, onPrint, toPlan }: { g: Group; upd: (p: Partial<Group>) => void; onPrint: (c: DocChoice, a?: number, b?: number) => void; toPlan: () => void }) {
  const [ask, setAsk] = useState(false); const [sheet, setSheet] = useState<number | null>(null); const [prep, setPrep] = useState(false); const [refreshAsk, setRefreshAsk] = useState(false);
  const L = levelDef(g.level); const S = g.sessions;
  const setS = (i: number, p: Partial<Session>) => upd({ sessions: S.map((s, k) => (k === i ? { ...s, ...p } : s)) });
  const gen = () => { upd({ sessions: applyGoals(generate(withDiag(g)), g.goals || []) }); setAsk(false); setSheet(null); };
  const move = (i: number, d: number) => { const j = i + d; if (j < 0 || j >= S.length) return; const c = S.slice(); [c[i], c[j]] = [c[j], c[i]]; upd({ sessions: c }); setSheet(j); };
  const changeTheme = (i: number, theme: string) => upd({ sessions: retheme(g, S, i, i, theme) });
  const done = S.filter((s) => s.done).length;
  const rate = presentRate(g);

  if (!S.length) {
    return (
      <section className="grid max-w-2xl gap-3 rounded-xl border border-line bg-white p-5">
        <h2 className="m-0 text-xl">Les séances</h2>
        <p className="m-0">Aucune séance pour l'instant.</p>
        <div className="flex flex-wrap gap-3"><button type="button" className="btn-clay" onClick={toPlan}>Affiner avec une analyse de départ</button><button type="button" className="btn-outline" onClick={() => { upd({ sessions: [freeSession(g.minutes)] }); setSheet(0); }}>Je crée mes séances moi-même</button></div>
      </section>
    );
  }
  if (sheet !== null && S[sheet]) {
    const i = sheet, s = S[i];
    const editor = s.kind === "theme" ? <ThemeEditor g={g} s={s} i={i} L={L} setS={setS} changeTheme={changeTheme} /> : (
      <>
        <label className="grid gap-1"><span className="text-sm font-bold">Titre</span><input id={`s-ti-${i}`} className="input" maxLength={120} value={s.title} onChange={(e) => setS(i, { title: e.target.value })} /></label>
        <label className="grid gap-1"><span className="text-sm font-bold">À faire</span><textarea id={`s-sk-${i}`} className="input min-h-20" maxLength={600} value={s.skills} onChange={(e) => setS(i, { skills: e.target.value })} /></label>
      </>);
    return <Sheet g={g} i={i} upd={upd} setS={setS} editor={editor} onClose={() => setSheet(null)} onGo={setSheet} onPrint={() => onPrint("une", i + 1, i + 1)} onMove={(d) => move(i, d)} onRemove={() => { upd({ sessions: S.filter((_, k) => k !== i) }); setSheet(null); }} />;
  }
  const nx = nextSession(g), cur = S[nx], allDone = done === S.length, col = sessionColor(cur);
  return (
    <section className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-48 flex-1"><b>{done} séance{done > 1 ? "s" : ""} réalisée{done > 1 ? "s" : ""} sur {S.length}</b>{rate !== null && <span className="text-sm text-muted"> · présence du groupe : {rate} %</span>}<div className="mt-1 h-2 overflow-hidden rounded bg-line"><div className="h-full bg-ok" style={{ width: `${(done / S.length) * 100}%` }} /></div></div>
        {ask ? <span className="flex items-center gap-2 text-sm"><b>Remplacer les séances par une nouvelle proposition ?</b><button type="button" className="btn-ink btn-sm" onClick={gen}>Oui</button><button type="button" className="btn-outline btn-sm" onClick={() => setAsk(false)}>Non</button></span>
          : g.validated ? <button type="button" className="btn-outline btn-sm" onClick={() => setAsk(true)}>↻ Proposer à nouveau d'après mes objectifs</button> : null}
      </div>
      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-line bg-white px-3 py-2 text-sm">
        <span className="min-w-48 flex-1">Les exercices ont été enrichis. Tes séances déjà créées gardent leurs anciens exercices tant que tu ne les mets pas à jour.</span>
        {refreshAsk ? <span className="flex items-center gap-2"><b>Remplacer les exercices des séances non faites ?</b><button type="button" className="btn-ink btn-sm" onClick={() => { upd({ sessions: refreshExercises(g) }); setRefreshAsk(false); }}>Oui</button><button type="button" className="btn-outline btn-sm" onClick={() => setRefreshAsk(false)}>Non</button></span>
          : <button type="button" className="btn-outline btn-sm" onClick={() => setRefreshAsk(true)}>↻ Mettre à jour les exercices</button>}
      </div>
      <AdaptBanner g={g} upd={upd} />
      {prep ? <Prepare g={g} s={cur} i={nx} L={L} setS={setS} changeTheme={changeTheme} onClose={() => setPrep(false)} /> : (
        <article className="grid gap-3 rounded-2xl p-5 text-white" style={{ background: "linear-gradient(135deg,#16140f 0%,#26231c 60%,#3a3220 100%)", borderTop: `6px solid ${col}` }}>
          <p className="m-0 text-xs font-extrabold uppercase tracking-[.2em] text-[#d8c18a]">{allDone ? "Saison terminée" : "Ta prochaine séance"}</p>
          <h2 className="m-0 font-serif text-2xl font-bold text-white [overflow-wrap:anywhere]">Séance {nx + 1} · {cur.title || "à préparer"}</h2>
          {objCount(objOf(cur)) > 0 ? <div className="grid gap-2 sm:grid-cols-2">{DOMAINS.filter((d) => objOf(cur)[d.key].length).map((d) => <p key={d.key} className="m-0 border-l-4 bg-white/10 px-3 py-2 text-sm" style={{ borderColor: d.color }}><b className="block" style={{ color: "#fff" }}>{d.label}</b>{objOf(cur)[d.key].join(" · ")}</p>)}</div> : <p className="m-0 text-sm text-white/70">Aucun objectif choisi pour l'instant.</p>}
          {cur.blocks?.length ? <p className="m-0 text-sm text-white/80">{cur.blocks.map((b) => `${b.n} ${b.m} min`).join(" · ")}</p> : null}
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn-clay" onClick={() => setSheet(nx)}>Ouvrir la fiche</button>
            <button type="button" className="rounded border border-white/40 bg-transparent px-4 py-2 font-bold text-white hover:bg-white/10" onClick={() => setPrep(true)}>Changer thème et objectifs</button>
            <button type="button" className="rounded border border-white/40 bg-transparent px-4 py-2 font-bold text-white hover:bg-white/10" onClick={() => onPrint("une", nx + 1, nx + 1)}>Imprimer</button>
          </div>
        </article>)}

      <div className="grid gap-2">
        {cyclesOf(S).map((c) => {
          const s0 = S[c.a]; const ph = phaseOf(c.a, S.length); const first = c.a === 0 || phaseOf(cyclesOf(S).find((x) => x.b === c.a - 1)?.a ?? 0, S.length) !== ph;
          const dom = sessionDomain(s0); const col = dom ? domainOf(dom).color : "#a8884a"; const count = c.b - c.a + 1; const nDone = S.slice(c.a, c.b + 1).filter((x) => x.done).length;
          const row = (i: number) => { const s = S[i]; const o = objOf(s); const st = sessionStatus(s); return (
            <button key={i} type="button" onClick={() => setSheet(i)} className={`grid w-full grid-cols-[2rem_minmax(0,1fr)_auto] items-center gap-2 border-b border-line px-1 py-2 text-left last:border-0 hover:bg-paper ${i === nx && !allDone ? "bg-paper font-bold" : ""}`}>
              <b className="font-serif text-lg" style={{ color: col }}>{i + 1}</b>
              <span className="min-w-0 text-sm [overflow-wrap:anywhere]">{c.single ? <b>{s.title || KIND[s.kind]}</b> : (DOMAINS.filter((d) => o[d.key].length).map((d) => o[d.key][0]).slice(0, 2).join(" · ") || "Objectifs à choisir")}{s.gl?.length ? <span className="text-ok"> · 🎯{s.gl.length}</span> : null}</span>
              <span className="rounded-full px-2 py-0.5 text-xs font-bold text-white" style={{ background: st === "realisee" ? "#2c9a5b" : st === "prete" ? "#2a6f97" : "#935500" }}>{STATUS_LABEL[st]}</span>
            </button>); };
          return (
            <div key={c.a} className="grid gap-2">
              {first && <h3 className="m-0 mt-2 rounded bg-ink px-3 py-1.5 text-sm font-bold text-white">{PHASES[ph]}</h3>}
              {c.single ? <div className="rounded-xl border border-line bg-white px-2" style={{ borderLeft: `5px solid ${col}` }}>{row(c.a)}</div> : (
                <details open={nx >= c.a && nx <= c.b} className="rounded-xl border border-line bg-white" style={{ borderLeft: `5px solid ${col}` }}>
                  <summary className="flex cursor-pointer flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2.5"><b className="min-w-0 flex-1 [overflow-wrap:anywhere]">{c.theme}</b><span className="text-sm text-muted">{count > 1 ? `séances ${c.a + 1} à ${c.b + 1}` : `séance ${c.a + 1}`} · {nDone}/{count} faite{nDone > 1 ? "s" : ""}</span></summary>
                  <div className="grid gap-1 px-3 pb-2"><label className="grid gap-1 text-sm"><span className="font-bold">Thème de cette série</span>
                    <select className="input" aria-label={`Thème : séances ${c.a + 1} à ${c.b + 1}`} value={THEMES[c.theme] ? c.theme : "__autre"} onChange={(e) => { if (e.target.value !== "__autre") upd({ sessions: retheme(g, S, c.a, c.b, e.target.value) }); }}>
                      {L.ok.map((t) => <option key={t}>{t}</option>)}{THEMES[c.theme] && !L.ok.includes(c.theme) && <option>{c.theme}</option>}{!THEMES[c.theme] && <option value="__autre">{c.theme}</option>}</select>
                    <span className="hint">Changer le thème refait aussitôt les séances de la série (déroulement compris).</span></label></div>
                  <div className="px-2 pb-1">{Array.from({ length: count }, (_, k) => row(c.a + k))}</div>
                </details>)}
            </div>); })}
      </div>
      <div><button type="button" className="btn-outline" disabled={S.length >= 100} onClick={() => { upd({ sessions: [...S, freeSession(g.minutes)] }); setSheet(S.length); }}>＋ Créer ma propre séance</button></div>
    </section>
  );
}

// Séance de thème : un thème, puis des objectifs de travail précis dans chacun des quatre domaines
const OTHER = "__autre";
function ThemeEditor({ g, s, i, L, setS, changeTheme }: { g: Group; s: Session; i: number; L: LevelDef; setS: (i: number, p: Partial<Session>) => void; changeTheme: (i: number, t: string) => void }) {
  void g;
  const free = !THEMES[s.theme];
  const titles = free ? [] : titleOptions(s.theme), titleSel = titles.includes(s.title) ? s.title : OTHER;
  const obj = objOf(s);
  const setObj = (d: Domain, list: string[]) => { const { skills, fil, obj: o } = withObj(s, { ...obj, [d]: list }); setS(i, { skills, fil, obj: o }); };
  const pickTitle = (v: string) => {
    if (v === OTHER) { setS(i, { title: "" }); return; }
    const c = v.slice(s.theme.length + 3); const d = THEMES[s.theme].d;
    setS(i, { title: v, ...(obj[d].includes(c) ? {} : (({ skills, fil, obj: o }) => ({ skills, fil, obj: o }))(withObj(s, { ...obj, [d]: [c, ...obj[d]] }))) });
  };
  return (
    <>
      <label className="grid gap-1"><span className="text-sm font-bold">1 · Thème de la séance</span>
        <select id={`s-th-${i}`} className="input" value={free ? OTHER : s.theme} onChange={(e) => (e.target.value === OTHER ? setS(i, { theme: s.theme && !THEMES[s.theme] ? s.theme : " " }) : changeTheme(i, e.target.value))}>{L.ok.map((n) => <option key={n}>{n}</option>)}{!free && !L.ok.includes(s.theme) && <option>{s.theme}</option>}<option value={OTHER}>✏️ Séance libre : j'écris mon thème</option></select>
        {free ? <input id={`s-th2-${i}`} className="input" maxLength={60} value={s.theme.trim() ? s.theme : ""} placeholder="Mon thème (facultatif)" onChange={(e) => setS(i, { theme: e.target.value || " " })} />
          : <span className="hint">Changer de thème remplace le titre et les objectifs par ceux du nouveau thème.</span>}</label>
      <label className="grid gap-1"><span className="text-sm font-bold">2 · Titre de la séance</span>
        {!free && <select id={`s-ti-${i}`} className="input" value={titleSel} onChange={(e) => pickTitle(e.target.value)}>{titles.map((t) => <option key={t}>{t}</option>)}<option value={OTHER}>✏️ Autre : je l'écris moi-même</option></select>}
        {(free || titleSel === OTHER) && <input id={`s-ti2-${i}`} className="input" maxLength={120} value={s.title} placeholder="Mon titre" onChange={(e) => setS(i, { title: e.target.value })} />}</label>
      <div className="grid gap-2">
        <span className="text-sm font-bold">3 · Objectifs de travail ({objCount(obj)}) : technique, tactique, physique, mental</span>
        <div className="grid gap-3 sm:grid-cols-2">{DOMAINS.map((d) => <DomainObjectives key={d.key} i={i} d={d} list={obj[d.key]} L={L} onChange={(l) => setObj(d.key, l)} />)}</div>
      </div>
    </>
  );
}

function DomainObjectives({ i, d, list, L, onChange }: { i: number; d: (typeof DOMAINS)[number]; list: string[]; L: LevelDef; onChange: (l: string[]) => void }) {
  const [add, setAdd] = useState(""); const short = (o: string) => (o.includes(" : ") ? o.split(" : ").slice(1).join(" : ") : o); const options = objectiveOptions(d.key, L).filter((o) => !list.includes(short(o)));
  const push = (t: string) => { const v = t.trim(); if (v && !list.includes(v)) onChange([...list, v]); };
  return (
    <div className="grid content-start gap-2 rounded-lg border-2 bg-white p-3" style={{ borderColor: list.length ? d.color : "#e2dbc9" }}>
      <div className="flex items-center justify-between"><b style={{ color: d.color }}>{d.label}</b><span className="text-xs text-muted">{list.length ? `${list.length} objectif${list.length > 1 ? "s" : ""}` : "aucun"}</span></div>
      {list.length > 0 && <ul className="m-0 flex list-none flex-wrap gap-1.5 p-0">{list.map((o) => <li key={o}><button type="button" className="rounded-full px-2.5 py-1 text-left text-xs font-semibold text-white" style={{ background: d.color }} onClick={() => onChange(list.filter((x) => x !== o))} aria-label={`Retirer : ${o}`}>{o} ✕</button></li>)}</ul>}
      {d.key === "tech" && list.map((o) => <BaseHelp key={o} text={o} />)}
      <select id={`s-ob-${i}-${d.key}`} className="input" value="" aria-label={`Ajouter un objectif ${d.label.toLowerCase()}`} onChange={(e) => { if (e.target.value) push(e.target.value.includes(" : ") ? e.target.value.split(" : ").slice(1).join(" : ") : e.target.value); }}>
        <option value="">＋ Ajouter un objectif {d.label.toLowerCase()}…</option>{options.map((o) => <option key={o} value={o}>{o}</option>)}</select>
      <div className="flex gap-2"><input id={`s-oi-${i}-${d.key}`} className="input" maxLength={100} value={add} placeholder={`Mon objectif ${d.label.toLowerCase()}`} onChange={(e) => setAdd(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); push(add); setAdd(""); } }} /><button type="button" className="btn-outline btn-sm" onClick={() => { push(add); setAdd(""); }}>Ajouter</button></div>
    </div>
  );
}

// Préparer une séance en 4 cartes : thème, objectifs, déroulement, récapitulatif (tout s'enregistre au fur et à mesure)
function Prepare({ g, s, i, L, setS, changeTheme, onClose }: { g: Group; s: Session; i: number; L: LevelDef; setS: (i: number, p: Partial<Session>) => void; changeTheme: (i: number, t: string) => void; onClose: () => void }) {
  const [step, setStep] = useState(0); const obj = objOf(s); const blocks = s.blocks ?? [];
  const setObj = (d: Domain, list: string[]) => { const { skills, fil, obj: o } = withObj(s, { ...obj, [d]: list }); setS(i, { skills, fil, obj: o }); };
  const shift = (x: number) => { const base = defaultBlocks(g.minutes); const k = Math.max(5, Math.round(g.minutes / 6 / 5) * 5) * x; const nb = base.map((b) => (b.n === "Situation" ? { ...b, m: Math.max(5, b.m - k) } : b.n === "Jeu" ? { ...b, m: Math.max(5, b.m + k) } : b)); const tot = nb.reduce((a, b) => a + b.m, 0); nb[2] = { ...nb[2], m: nb[2].m + (g.minutes - tot) }; setS(i, { blocks: nb.map((b) => ({ ...b, t: blocks.find((o) => o.n === b.n)?.t || "" })) }); };
  const TITLES = [`Quel est le thème de la séance ${i + 1} ?`, "Quels objectifs pour cette séance ?", "Comment se déroule la séance ?", "C'est prêt !"];
  const total = blocks.reduce((a, b) => a + (b.m || 0), 0);
  return (
    <article className="grid gap-4 rounded-2xl border-2 border-champagne bg-white p-5">
      <div><p className="m-0 text-xs font-bold uppercase tracking-widest text-muted">Carte {step + 1} sur 4</p><div className="mt-1 h-2 overflow-hidden rounded bg-line"><div className="h-full bg-ink" style={{ width: `${(step + 1) * 25}%` }} /></div></div>
      <h2 className="m-0 text-xl">{TITLES[step]}</h2>
      {step === 0 && <div className="flex flex-wrap gap-2">{L.ok.map((n) => <button key={n} type="button" aria-pressed={s.theme === n} onClick={() => changeTheme(i, n)} className={`rounded-full border-2 px-3 py-1.5 text-sm font-bold ${s.theme === n ? "border-ink bg-ink text-white" : "border-line bg-white hover:border-ink"}`}>{n}</button>)}</div>}
      {step === 1 && <div className="grid gap-3 sm:grid-cols-2">{DOMAINS.map((d) => <DomainObjectives key={d.key} i={i} d={d} list={obj[d.key]} L={L} onChange={(l) => setObj(d.key, l)} />)}</div>}
      {step === 2 && (
        <div className="grid gap-3">
          <div className="flex flex-wrap gap-2"><button type="button" className="btn-outline btn-sm" onClick={() => setS(i, { blocks: defaultBlocks(g.minutes).map((b) => ({ ...b, t: blocks.find((o) => o.n === b.n)?.t || "" })) })}>Classique</button><button type="button" className="btn-outline btn-sm" onClick={() => shift(1)}>Plus de jeu</button><button type="button" className="btn-outline btn-sm" onClick={() => shift(-1)}>Plus de travail technique</button></div>
          {blocks.length > 0 ? <ul className="m-0 grid list-none gap-1 p-0">{blocks.map((b, k) => <li key={k} className="border-b border-line py-1 text-sm"><b>{b.n}</b> · {b.m} min</li>)}</ul> : <p className="m-0 text-sm text-muted">Choisis un modèle, tu pourras écrire les consignes de chaque bloc ensuite (facultatif).</p>}
          {blocks.length > 0 && <p className="hint m-0">Total : {total} min sur {g.minutes}.</p>}
        </div>
      )}
      {step === 3 && (
        <div className="grid gap-3"><p className="m-0"><b>{s.title || s.theme || "Séance libre"}</b></p>
          {DOMAINS.filter((d) => obj[d.key].length).map((d) => <p key={d.key} className="m-0 border-l-4 pl-3 text-sm" style={{ borderColor: d.color }}><b style={{ color: d.color }}>{d.label}</b> : {obj[d.key].join(" · ")}</p>)}
          {blocks.length > 0 && <p className="m-0 text-sm text-muted">{blocks.map((b) => `${b.n} ${b.m} min`).join(" · ")}</p>}
          <p className="hint m-0">Tout est déjà enregistré. Les consignes de chaque bloc se précisent dans la liste des séances ci-dessous (« Déroulement »).</p></div>
      )}
      <div className="flex items-center justify-between gap-2"><button type="button" className="btn-outline" onClick={() => (step ? setStep(step - 1) : onClose())}>{step ? "← Retour" : "Fermer"}</button><button type="button" className="btn-clay" onClick={() => { if (step < 3) setStep(step + 1); else { setS(i, { ready: true }); onClose(); } }}>{step < 3 ? "Continuer →" : "Terminer"}</button></div>
    </article>
  );
}

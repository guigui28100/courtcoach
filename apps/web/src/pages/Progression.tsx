import { ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { get, put } from "../api";
import { Err, Page, PageHead, TabsBar } from "../components/ui";
import { buildPages, DocChoice } from "../components/ProgressionDoc";
import { Bilan } from "../components/ProgressionBilan";
import { Consult, Docs, PrintHost, QuickEval } from "../components/ProgressionViews";
import {
  compsOf, titleOptions, LevelDef, BLOCK_NAMES, defaultBlocks, freeSession, objCount, objectiveOptions, objOf, withObj,
  BILAN_LEVELS, DOMAINS, Domain, domainOf, generate, Group, LEVELS_FFT, levelDef, newId, PHASES, phaseOf, sessionDomain, sessionFor, Session, THEMES, THEME_NAMES, themesInText, weights,
} from "../progression";

type Tab = "bilan" | "programme" | "consulter" | "documents";
const TABS: [Tab, string][] = [["bilan", "📋 1 · Bilan de départ"], ["programme", "🗓️ 2 · Programmation"], ["consulter", "👁️ 3 · Consulter"], ["documents", "📄 4 · Documents"]];
const KIND: Record<Session["kind"], string> = { bilan: "Bilan", etape: "Point d'étape", jeu: "Match", theme: "Thème" };

export default function Progression() {
  const [groups, setGroups] = useState<Group[] | null>(null);
  const [sel, setSel] = useState(""); const [tab, setTab] = useState<Tab>("bilan");
  const [err, setErr] = useState(""); const [state, setState] = useState<"" | "saving" | "saved" | "error">("");
  const [adding, setAdding] = useState(false); const [printPages, setPrintPages] = useState<ReactNode[] | null>(null);
  const loaded = useRef(false); const sig = useRef("");

  useEffect(() => {
    get<{ groups: Group[] }>("/progressions").then((r) => {
      const gs = (r.groups || []).map((g) => ({ ...g, bilan: g.bilan || {}, sessions: g.sessions || [], minutes: g.minutes || 60 }));
      sig.current = JSON.stringify(gs); setGroups(gs); setSel(gs[0]?.id || ""); if (gs[0]?.sessions.length) setTab("consulter"); loaded.current = true; if (!gs.length) setAdding(true);
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
  const create = (n: Partial<Group>) => { const ng: Group = { id: newId(), name: n.name || "Nouveau groupe", level: n.level || LEVELS_FFT[2].key, size: n.size || 0, minutes: n.minutes || 60, bilan: {}, notes: "", sessions: [] }; setGroups((gs) => [...gs!, ng]); setSel(ng.id); setTab("bilan"); setAdding(false); };
  const remove = () => { setGroups((gs) => { const r = gs!.filter((x) => x.id !== sel); setSel(r[0]?.id || ""); return r; }); };

  const doPrint = (c: DocChoice, a = 1, b = 30) => { if (g) setPrintPages(buildPages(g, c, a, b)); };

  if (err && !groups) return <Page><Err msg={err} /></Page>;
  if (!groups) return <Page><div className="skeleton h-40" /></Page>;

  return (
    <>
      <PageHead eyebrow="Mon travail de prof" title="Progression des séances" icon="🗓️">
        Un groupe, son bilan de départ, puis 30 séances proposées d'après ce bilan et le niveau attendu. Tout est modifiable. Seul toi vois cette page.
      </PageHead>
      <Page>
        {err && <Err msg={err} />}
        <div className="grid gap-5 lg:grid-cols-[18rem_minmax(0,1fr)]">
          <aside className="grid content-start gap-3">
            <h2 className="m-0 text-lg">Mes groupes</h2>
            <ul className="m-0 grid list-none gap-2 p-0">
              {groups.map((x) => {
                const done = x.sessions.filter((s) => s.done).length;
                return (
                  <li key={x.id}>
                    <button type="button" aria-pressed={x.id === sel} onClick={() => { setSel(x.id); setAdding(false); }} className={`w-full rounded-xl border-2 p-3 text-left ${x.id === sel && !adding ? "border-ink bg-ink text-white" : "border-line bg-white text-ink hover:border-ink"}`}>
                      <b className="block">{x.name}</b>
                      <span className={`text-xs ${x.id === sel && !adding ? "text-white/80" : "text-muted"}`}>{x.level.split(" · ")[0]}{x.size ? ` · ${x.size} joueurs` : ""}</span>
                      <span className={`mt-1 block text-xs ${x.id === sel && !adding ? "text-white/80" : "text-muted"}`}>{x.sessions.length ? `${done} / ${x.sessions.length} séances faites` : "Programmation à créer"}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
            <button type="button" className="btn-outline" onClick={() => setAdding(true)}>＋ Nouveau groupe</button>
            {groups.length > 0 && <p className="hint m-0">Un groupe = un niveau et un nombre de joueurs. N'écris jamais de nom d'élève ici.</p>}
            {state && <p role="status" className="m-0 text-xs text-muted">{state === "saving" ? "Enregistrement…" : state === "saved" ? "✔ Enregistré" : "Pas enregistré"}</p>}
          </aside>

          <div className="min-w-0">
            {adding ? <NewGroup onCreate={create} onCancel={groups.length ? () => setAdding(false) : undefined} />
              : !g ? <p className="m-0 text-muted">Crée ton premier groupe pour commencer.</p>
              : (
                <div className="grid gap-4">
                  <GroupHead g={g} upd={upd} onDelete={remove} />
                  <TabsBar tabs={TABS} active={tab} onChange={(k) => setTab(k as Tab)} label="Étapes du groupe" side={false} />
                  {tab === "bilan" && <Bilan g={g} upd={upd} next={() => setTab("programme")} />}
                  {tab === "programme" && <Programme g={g} upd={upd} />}
                  {tab === "consulter" && <Consult g={g} onDone={(i, v) => upd({ sessions: g.sessions.map((x, k) => (k === i ? { ...x, done: v } : x)) })} onUpdate={(i, p) => upd({ sessions: g.sessions.map((x, k) => (k === i ? { ...x, ...p } : x)) })} onPrint={doPrint} onEdit={() => setTab("programme")} />}
                  {tab === "documents" && <Docs g={g} onPrint={doPrint} />}
                </div>
              )}
          </div>
        </div>
      </Page>
      <PrintHost pages={printPages} onDone={() => setPrintPages(null)} />
    </>
  );
}

function NewGroup({ onCreate, onCancel }: { onCreate: (g: Partial<Group>) => void; onCancel?: () => void }) {
  const [name, setName] = useState(""); const [level, setLevel] = useState(LEVELS_FFT[2].key); const [size, setSize] = useState(8); const [minutes, setMinutes] = useState(60);
  return (
    <form className="grid max-w-xl gap-4 rounded-xl border border-line bg-white p-5" onSubmit={(e) => { e.preventDefault(); onCreate({ name: name.trim(), level, size, minutes }); }}>
      <h2 className="m-0 text-xl">Nouveau groupe</h2>
      <label className="grid gap-1"><span className="font-bold">Nom du groupe</span><input id="pg-name" className="input" value={name} maxLength={60} placeholder="Ex. Orange du mercredi 17 h" onChange={(e) => setName(e.target.value)} required /></label>
      <label className="grid gap-1"><span className="font-bold">Niveau (repères Galaxie Tennis et adultes)</span>
        <select id="pg-level" className="input" value={level} onChange={(e) => setLevel(e.target.value)}>{LEVELS_FFT.map((l) => <option key={l.key}>{l.key}</option>)}</select></label>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="grid gap-1"><span className="font-bold">Nombre de joueurs</span><input id="pg-size" className="input" type="number" min={1} max={60} value={size} onChange={(e) => setSize(+e.target.value)} /></label>
        <label className="grid gap-1"><span className="font-bold">Durée d'une séance (minutes)</span><input id="pg-min" className="input" type="number" min={20} max={180} step={5} value={minutes} onChange={(e) => setMinutes(+e.target.value)} /></label>
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
        <label className="grid gap-1"><span className="text-xs font-bold uppercase tracking-wide text-muted">Joueurs</span><input id="g-size" className="input" type="number" min={0} max={60} value={g.size} onChange={(e) => upd({ size: Math.max(0, Math.min(60, +e.target.value || 0)) })} /></label>
        <label className="grid gap-1"><span className="text-xs font-bold uppercase tracking-wide text-muted">Séance (min)</span><input id="g-min" className="input" type="number" min={20} max={180} step={5} value={g.minutes} onChange={(e) => upd({ minutes: Math.max(20, Math.min(180, +e.target.value || 60)) })} /></label>
      </div>
      <div className="rounded-lg border-l-4 border-champagne bg-paper p-3 text-sm">
        <b>Attendu à ce niveau</b> <span className="text-muted">({L.age} · {L.terrain} · {L.ball})</span>
        <ul className="m-0 mt-1 list-disc pl-5">{L.att.map((a) => <li key={a}>{a}</li>)}</ul>
        <p className="hint m-0 mt-1">Repères indicatifs inspirés de la Galaxie Tennis : à confronter aux documents fédéraux.</p>
      </div>
      <div className="flex justify-end">
        {ask ? <span className="flex items-center gap-2 text-sm"><b>Supprimer ce groupe et sa programmation ?</b><button type="button" className="btn-ink btn-sm" onClick={onDelete}>Oui, supprimer</button><button type="button" className="btn-outline btn-sm" onClick={() => setAsk(false)}>Non</button></span>
          : <button type="button" className="btn-outline btn-sm" onClick={() => setAsk(true)}>🗑️ Supprimer le groupe</button>}
      </div>
    </section>
  );
}

function Programme({ g, upd }: { g: Group; upd: (p: Partial<Group>) => void }) {
  const [ask, setAsk] = useState(false); const [open, setOpen] = useState<number | null>(null);
  const L = levelDef(g.level); const S = g.sessions;
  const setS = (i: number, p: Partial<Session>) => upd({ sessions: S.map((s, k) => (k === i ? { ...s, ...p } : s)) });
  const gen = () => { upd({ sessions: generate(g) }); setAsk(false); setOpen(null); };
  const move = (i: number, d: number) => { const j = i + d; if (j < 0 || j >= S.length) return; const c = S.slice(); [c[i], c[j]] = [c[j], c[i]]; upd({ sessions: c }); setOpen(j); };
  const changeTheme = (i: number, theme: string) => { const s = S[i]; const fil = s.fil.split(" : ")[0]; setS(i, { ...sessionFor(g, theme, phaseOf(i), fil), done: s.done, note: s.note, blocks: s.blocks, mat: s.mat }); };
  const done = S.filter((s) => s.done).length;

  if (!S.length) {
    const nb = Object.keys(weights(g)).length;
    return (
      <section className="grid max-w-2xl gap-3 rounded-xl border border-line bg-white p-5">
        <h2 className="m-0 text-xl">Créer les 30 séances</h2>
        <p className="m-0">L'outil range les thèmes dans un ordre logique : d'abord ce que ton bilan montre comme à acquérir, la technique avant la tactique, puis la mise en jeu. Le physique et le mental sont un fil rouge dans chaque séance.</p>
        <p className="m-0 text-sm text-muted">{nb ? `${nb} thèmes pris en compte pour ${g.name} (${L.key}).` : "Le bilan est vide : la programmation partira des bases du niveau choisi."}</p>
        <div className="flex flex-wrap gap-3"><button type="button" className="btn-clay" onClick={gen}>Proposer les 30 séances d'après le bilan</button><button type="button" className="btn-outline" onClick={() => { upd({ sessions: [freeSession(g.minutes)] }); setOpen(0); }}>Je crée mes séances moi-même</button></div>
      </section>
    );
  }
  return (
    <section className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-48 flex-1"><b>{done} séance{done > 1 ? "s" : ""} faite{done > 1 ? "s" : ""} sur {S.length}</b><div className="mt-1 h-2 overflow-hidden rounded bg-line"><div className="h-full bg-ok" style={{ width: `${(done / S.length) * 100}%` }} /></div></div>
        {ask ? <span className="flex items-center gap-2 text-sm"><b>Remplacer les séances par une nouvelle proposition ?</b><button type="button" className="btn-ink btn-sm" onClick={gen}>Oui</button><button type="button" className="btn-outline btn-sm" onClick={() => setAsk(false)}>Non</button></span>
          : <button type="button" className="btn-outline btn-sm" onClick={() => setAsk(true)}>↻ Proposer à nouveau d'après le bilan</button>}
      </div>
      {S.map((s, i) => {
        const sd = sessionDomain(s); const dom = sd ? domainOf(sd) : null; const isOpen = open === i;
        return (
          <div key={i}>
            {(i % 10 === 0) && <h3 className="m-0 mb-2 mt-2 rounded bg-ink px-3 py-1.5 text-xs font-bold uppercase tracking-widest text-white">{PHASES[phaseOf(i)]} · séances {i + 1} à {Math.min(i + 10, S.length)}</h3>}
            <article className={`rounded-xl border bg-white ${s.done ? "border-ok/50 opacity-80" : "border-line"}`} style={{ borderLeft: `5px solid ${dom?.color ?? "#a8884a"}` }}>
              <div className="flex items-center gap-3 p-3">
                <input id={`s-done-${i}`} type="checkbox" className="size-6 accent-clay" checked={s.done} onChange={(e) => setS(i, { done: e.target.checked })} aria-label={`Séance ${i + 1} faite`} />
                <button type="button" aria-expanded={isOpen} className="grid min-w-0 flex-1 gap-0.5 text-left" onClick={() => setOpen(isOpen ? null : i)}>
                  <span className="flex flex-wrap items-center gap-2"><b className="font-serif text-xl">{i + 1}</b><span className="rounded px-1.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-white" style={{ background: dom?.color ?? "#a8884a" }}>{dom?.label ?? KIND[s.kind]}</span><b className="min-w-0 [overflow-wrap:anywhere]">{s.title || "Séance"}</b></span>
                  {s.why && <span className="text-xs text-muted">Pourquoi : {s.why}</span>}
                </button>
                <span aria-hidden="true" className="text-muted">{isOpen ? "▲" : "▼"}</span>
              </div>
              {isOpen && (
                <div className="grid gap-3 border-t border-line p-3">
                  {s.kind === "theme" ? <ThemeEditor g={g} s={s} i={i} L={L} setS={setS} changeTheme={changeTheme} /> : (
                    <>
                      <label className="grid gap-1"><span className="text-sm font-bold">Titre</span><input id={`s-ti-${i}`} className="input" maxLength={120} value={s.title} onChange={(e) => setS(i, { title: e.target.value })} /></label>
                      <label className="grid gap-1"><span className="text-sm font-bold">À faire</span><textarea id={`s-sk-${i}`} className="input min-h-20" maxLength={600} value={s.skills} onChange={(e) => setS(i, { skills: e.target.value })} /></label>
                    </>
                  )}
                  <Deroulement g={g} s={s} i={i} setS={setS} />
                  {s.done ? <QuickEval s={s} onChange={(p) => setS(i, p)} /> : <label className="grid gap-1"><span className="text-sm font-bold">Mes notes après la séance</span><textarea id={`s-no-${i}`} className="input min-h-16" maxLength={600} value={s.note} onChange={(e) => setS(i, { note: e.target.value })} placeholder="Ce qui a marché, ce qu'il faut refaire. Pas de nom d'élève." /></label>}
                  <div className="flex flex-wrap gap-2">
                    <button type="button" className="btn-outline btn-sm" disabled={i === 0} onClick={() => move(i, -1)}>↑ Monter</button>
                    <button type="button" className="btn-outline btn-sm" disabled={i === S.length - 1} onClick={() => move(i, 1)}>↓ Descendre</button>
                    <button type="button" className="btn-outline btn-sm" onClick={() => { upd({ sessions: S.filter((_, k) => k !== i) }); setOpen(null); }}>🗑️ Retirer cette séance</button>
                  </div>
                </div>
              )}
            </article>
          </div>
        );
      })}
      <div><button type="button" className="btn-outline" disabled={S.length >= 40} onClick={() => { upd({ sessions: [...S, freeSession(g.minutes)] }); setOpen(S.length); }}>＋ Créer ma propre séance</button></div>
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
      <select id={`s-ob-${i}-${d.key}`} className="input" value="" aria-label={`Ajouter un objectif ${d.label.toLowerCase()}`} onChange={(e) => { if (e.target.value) push(e.target.value.includes(" : ") ? e.target.value.split(" : ").slice(1).join(" : ") : e.target.value); }}>
        <option value="">＋ Ajouter un objectif {d.label.toLowerCase()}…</option>{options.map((o) => <option key={o} value={o}>{o}</option>)}</select>
      <div className="flex gap-2"><input id={`s-oi-${i}-${d.key}`} className="input" maxLength={100} value={add} placeholder={`Mon objectif ${d.label.toLowerCase()}`} onChange={(e) => setAdd(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); push(add); setAdd(""); } }} /><button type="button" className="btn-outline btn-sm" onClick={() => { push(add); setAdd(""); }}>Ajouter</button></div>
    </div>
  );
}

// Déroulement de la séance : blocs (échauffement, situation, jeu…) avec leur durée et leurs consignes
function Deroulement({ g, s, i, setS }: { g: Group; s: Session; i: number; setS: (i: number, p: Partial<Session>) => void }) {
  const blocks = s.blocks ?? []; const total = blocks.reduce((a, b) => a + (b.m || 0), 0); const diff = g.minutes - total;
  const set = (k: number, p: Partial<(typeof blocks)[number]>) => setS(i, { blocks: blocks.map((b, j) => (j === k ? { ...b, ...p } : b)) });
  return (
    <details className="rounded-lg border border-line bg-white" open={blocks.length > 0}>
      <summary className="cursor-pointer p-3 font-bold">Déroulement de la séance <span className="font-normal text-muted">{blocks.length ? `(${total} min sur ${g.minutes})` : "(facultatif)"}</span></summary>
      <div className="grid gap-3 border-t border-line p-3">
        {!blocks.length && <div><button type="button" className="btn-outline btn-sm" onClick={() => setS(i, { blocks: defaultBlocks(g.minutes) })}>Préparer les blocs de la séance</button></div>}
        {blocks.map((b, k) => (
          <div key={k} className="grid gap-2 rounded-lg bg-paper p-3">
            <div className="grid grid-cols-[minmax(0,1fr)_6rem_auto] items-end gap-2">
              <label className="grid gap-1"><span className="text-xs font-bold text-muted">Bloc</span><select id={`s-bn-${i}-${k}`} className="input" value={b.n} onChange={(e) => set(k, { n: e.target.value })}>{BLOCK_NAMES.map((n) => <option key={n}>{n}</option>)}</select></label>
              <label className="grid gap-1"><span className="text-xs font-bold text-muted">Minutes</span><input id={`s-bm-${i}-${k}`} className="input" type="number" min={0} max={180} value={b.m} onChange={(e) => set(k, { m: Math.max(0, Math.min(180, +e.target.value || 0)) })} /></label>
              <button type="button" className="btn-outline btn-sm" onClick={() => setS(i, { blocks: blocks.filter((_, j) => j !== k) })} aria-label="Retirer ce bloc">Retirer</button>
            </div>
            <label className="grid gap-1"><span className="text-xs font-bold text-muted">Déroulement et consignes</span><textarea id={`s-bt-${i}-${k}`} className="input min-h-16" maxLength={600} value={b.t} onChange={(e) => set(k, { t: e.target.value })} /></label>
          </div>
        ))}
        {blocks.length > 0 && (
          <>
            <p className="m-0 text-sm" style={{ color: diff === 0 ? "#2c9a5b" : "#8a5a1a" }}>{diff === 0 ? "Le temps est bien réparti." : diff > 0 ? `Il reste ${diff} minutes à placer.` : `Tu dépasses de ${-diff} minutes.`}</p>
            <div className="flex flex-wrap gap-2"><button type="button" className="btn-outline btn-sm" disabled={blocks.length >= 8} onClick={() => setS(i, { blocks: [...blocks, { n: "Situation", m: 10, t: "" }] })}>＋ Ajouter un bloc</button></div>
            <label className="grid gap-1"><span className="text-sm font-bold">Matériel</span><input id={`s-mat-${i}`} className="input" maxLength={200} value={s.mat ?? ""} placeholder="Paniers de balles, cerceaux, cibles…" onChange={(e) => setS(i, { mat: e.target.value })} /></label>
          </>
        )}
      </div>
    </details>
  );
}

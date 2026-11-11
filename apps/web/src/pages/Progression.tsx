import { createPortal } from "react-dom";
import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { get, put } from "../api";
import { Err, Page, PageHead, TabsBar } from "../components/ui";
import { ClubLogo } from "../components/ui";
import {
  BILAN_LEVELS, DOMAINS, domainOf, generate, Group, LEVELS_FFT, levelDef, newId, PHASES, phaseOf, sessionFor, Session, THEMES, THEME_NAMES, themesInText, weights,
} from "../progression";

type Tab = "bilan" | "programme" | "synthese";
const TABS: [Tab, string][] = [["bilan", "📋 1 · Bilan de départ"], ["programme", "🗓️ 2 · Programmation"], ["synthese", "📊 3 · Synthèse et impression"]];
const KIND: Record<Session["kind"], string> = { bilan: "Bilan", etape: "Point d'étape", jeu: "Match", theme: "Thème" };

export default function Progression() {
  const [groups, setGroups] = useState<Group[] | null>(null);
  const [sel, setSel] = useState(""); const [tab, setTab] = useState<Tab>("bilan");
  const [err, setErr] = useState(""); const [state, setState] = useState<"" | "saving" | "saved" | "error">("");
  const [adding, setAdding] = useState(false);
  const loaded = useRef(false); const sig = useRef("");

  useEffect(() => {
    get<{ groups: Group[] }>("/progressions").then((r) => {
      const gs = (r.groups || []).map((g) => ({ ...g, bilan: g.bilan || {}, sessions: g.sessions || [], minutes: g.minutes || 60 }));
      sig.current = JSON.stringify(gs); setGroups(gs); setSel(gs[0]?.id || ""); loaded.current = true; if (!gs.length) setAdding(true);
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
                  {tab === "synthese" && <Synthese g={g} />}
                </div>
              )}
          </div>
        </div>
      </Page>
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

function Bilan({ g, upd, next }: { g: Group; upd: (p: Partial<Group>) => void; next: () => void }) {
  const L = levelDef(g.level);
  const found = useMemo(() => Object.keys(themesInText(g.notes)).filter((n) => L.ok.includes(n) && g.bilan[n] === undefined), [g.notes, g.bilan, L]);
  const setLevel = (n: string, v: number) => { const b = { ...g.bilan }; if (b[n] === v) delete b[n]; else b[n] = v; upd({ bilan: b }); };
  const rated = Object.keys(g.bilan).filter((n) => L.ok.includes(n)).length;
  const applyFound = () => { const b = { ...g.bilan }; found.forEach((n) => { b[n] = 0; }); upd({ bilan: b }); };
  return (
    <section className="grid gap-5">
      <div className="grid gap-2">
        <label htmlFor="g-notes" className="font-bold">Ce qui n'est pas acquis, les défauts que tu as vus (écris comme tu parles)</label>
        <textarea id="g-notes" className="input min-h-28" maxLength={2000} value={g.notes} onChange={(e) => upd({ notes: e.target.value })} placeholder="Ex. Beaucoup de fautes en revers, le service est souvent raté à la 2e balle, ils bougent peu les jambes, ils s'énervent quand ils perdent." />
        <p className="hint m-0">Pas de nom d'élève. L'outil repère des mots comme « revers », « service », « jambes », « concentre », « volée ».</p>
        {found.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 rounded-lg bg-champagne-soft p-3 text-sm">
            <span>Cité dans ton texte et pas encore noté : <b>{found.join(", ")}</b></span>
            <button type="button" className="btn-clay btn-sm" onClick={applyFound}>Les mettre « à acquérir » dans le bilan</button>
          </div>
        )}
      </div>

      <div className="grid gap-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2"><h2 className="m-0 text-xl">Niveau du groupe sur chaque thème</h2><span className="text-sm text-muted">{rated} thème{rated > 1 ? "s" : ""} noté{rated > 1 ? "s" : ""} · touche à nouveau pour effacer</span></div>
        {DOMAINS.map((d) => {
          const names = THEME_NAMES.filter((n) => THEMES[n].d === d.key && L.ok.includes(n));
          if (!names.length) return null;
          return (
            <fieldset key={d.key} className="m-0 grid gap-2 rounded-xl border border-line bg-white p-3" style={{ borderTop: `4px solid ${d.color}` }}>
              <legend className="px-1 text-sm font-bold uppercase tracking-wide" style={{ color: d.color }}>{d.label}</legend>
              {names.map((n) => (
                <div key={n} className="grid items-center gap-2 sm:grid-cols-[13rem_minmax(0,1fr)]">
                  <span className="font-semibold">{n}</span>
                  <div className="flex flex-wrap gap-1.5" role="group" aria-label={`Niveau du groupe : ${n}`}>
                    {BILAN_LEVELS.map((b, i) => (
                      <button key={b.label} type="button" aria-pressed={g.bilan[n] === i} onClick={() => setLevel(n, i)} style={g.bilan[n] === i ? { background: b.color, borderColor: b.color, color: "#fff" } : undefined}
                        className={`min-h-10 rounded-lg border-2 px-2.5 py-1 text-sm font-bold ${g.bilan[n] === i ? "" : "border-line bg-white text-ink hover:border-ink"}`}>{b.short}</button>
                    ))}
                  </div>
                </div>
              ))}
            </fieldset>
          );
        })}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" className="btn-clay" onClick={next}>Voir la programmation →</button>
        <span className="text-sm text-muted">Les thèmes « à acquérir » viennent en premier et reviennent le plus souvent ; ceux déjà acquis sont seulement consolidés.</span>
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
  const changeTheme = (i: number, theme: string) => { const s = S[i]; const fil = s.fil.split(" : ")[0]; setS(i, { ...sessionFor(g, theme, phaseOf(i), fil), done: s.done, note: s.note }); };
  const done = S.filter((s) => s.done).length;

  if (!S.length) {
    const nb = Object.keys(weights(g)).length;
    return (
      <section className="grid max-w-2xl gap-3 rounded-xl border border-line bg-white p-5">
        <h2 className="m-0 text-xl">Créer les 30 séances</h2>
        <p className="m-0">L'outil range les thèmes dans un ordre logique : d'abord ce que ton bilan montre comme à acquérir, la technique avant la tactique, puis la mise en jeu. Le physique et le mental sont un fil rouge dans chaque séance.</p>
        <p className="m-0 text-sm text-muted">{nb ? `${nb} thèmes pris en compte pour ${g.name} (${L.key}).` : "Le bilan est vide : la programmation partira des bases du niveau choisi."}</p>
        <div><button type="button" className="btn-clay" onClick={gen}>Proposer les 30 séances</button></div>
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
        const dom = s.theme && THEMES[s.theme] ? domainOf(THEMES[s.theme].d) : null; const isOpen = open === i;
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
                  {s.kind === "theme" && (
                    <label className="grid gap-1"><span className="text-sm font-bold">Thème de la séance</span>
                      <select id={`s-th-${i}`} className="input" value={s.theme} onChange={(e) => changeTheme(i, e.target.value)}>{L.ok.map((n) => <option key={n}>{n}</option>)}{!L.ok.includes(s.theme) && <option>{s.theme}</option>}</select>
                      <span className="hint">Changer de thème remplace les compétences et l'exercice par ceux du nouveau thème.</span></label>
                  )}
                  <label className="grid gap-1"><span className="text-sm font-bold">Titre</span><input id={`s-ti-${i}`} className="input" maxLength={120} value={s.title} onChange={(e) => setS(i, { title: e.target.value })} /></label>
                  <label className="grid gap-1"><span className="text-sm font-bold">Compétences à travailler</span><textarea id={`s-sk-${i}`} className="input min-h-20" maxLength={600} value={s.skills} onChange={(e) => setS(i, { skills: e.target.value })} /></label>
                  <label className="grid gap-1"><span className="text-sm font-bold">Exercice (dispositif, critère de réussite, variables)</span><textarea id={`s-ex-${i}`} className="input min-h-40" maxLength={1200} value={s.exercise} onChange={(e) => setS(i, { exercise: e.target.value })} /></label>
                  <label className="grid gap-1"><span className="text-sm font-bold">Fil rouge (physique ou mental)</span><input id={`s-fil-${i}`} className="input" maxLength={160} value={s.fil} onChange={(e) => setS(i, { fil: e.target.value })} /></label>
                  <label className="grid gap-1"><span className="text-sm font-bold">Mes notes après la séance</span><textarea id={`s-no-${i}`} className="input min-h-16" maxLength={600} value={s.note} onChange={(e) => setS(i, { note: e.target.value })} placeholder="Ce qui a marché, ce qu'il faut refaire. Pas de nom d'élève." /></label>
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
      <div><button type="button" className="btn-outline" disabled={S.length >= 40} onClick={() => { upd({ sessions: [...S, { kind: "theme", theme: "", title: "Séance à écrire", skills: "", exercise: "", fil: "", why: "", note: "", done: false }] }); setOpen(S.length); }}>＋ Ajouter une séance à moi</button></div>
    </section>
  );
}

function Synthese({ g }: { g: Group }) {
  const L = levelDef(g.level); const S = g.sessions;
  const [pm, setPm] = useState<null | "prog" | "fiches">(null);
  const count: Record<string, number> = {}; S.forEach((s) => { if (s.theme) count[s.theme] = (count[s.theme] || 0) + 1; });
  const byDom = DOMAINS.map((d) => ({ d, n: Object.entries(count).filter(([t]) => THEMES[t]?.d === d.key).reduce((a, [, c]) => a + c, 0) }));
  const total = Math.max(1, byDom.reduce((a, x) => a + x.n, 0));
  const missing = Object.entries(g.bilan).filter(([n, v]) => v <= 1 && L.ok.includes(n) && !count[n]).map(([n]) => n);
  useEffect(() => {
    if (!pm) return;
    const st = document.createElement("style"); st.textContent = "@page{size:210mm 297mm;margin:12mm}";
    document.head.appendChild(st); document.body.classList.add("printing-affiche");
    const done = () => { document.body.classList.remove("printing-affiche"); st.remove(); window.removeEventListener("afterprint", done); setPm(null); };
    window.addEventListener("afterprint", done); const t = window.setTimeout(() => window.print(), 150);
    return () => { window.clearTimeout(t); window.removeEventListener("afterprint", done); document.body.classList.remove("printing-affiche"); st.remove(); };
  }, [pm]);
  if (!S.length) return <p className="m-0 text-muted">Crée d'abord la programmation (étape 2).</p>;
  return (
    <section className="grid gap-5">
      <div className="grid gap-3">
        <h2 className="m-0 text-xl">Ce que la saison couvre</h2>
        <div className="flex h-5 overflow-hidden rounded" role="img" aria-label="Répartition des séances par domaine">{byDom.map(({ d, n }) => <div key={d.key} style={{ width: `${(n / total) * 100}%`, background: d.color }} />)}</div>
        <div className="flex flex-wrap gap-3 text-sm">{byDom.map(({ d, n }) => <span key={d.key}><i className="mr-1 inline-block size-3 align-[-1px]" style={{ background: d.color }} />{d.label} : {n} séance{n > 1 ? "s" : ""}</span>)}</div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {Object.entries(count).sort((a, b) => b[1] - a[1]).map(([t, c]) => {
          const ph = [0, 1, 2].map((p) => S.filter((s, i) => s.theme === t && phaseOf(i) === p).length); const d = domainOf(THEMES[t]?.d ?? "tech");
          return <div key={t} className="rounded-xl border border-line bg-white p-3" style={{ borderTop: `4px solid ${d.color}` }}><b>{t}</b> <span className="text-muted">· {c} séance{c > 1 ? "s" : ""}</span><p className="m-0 mt-1 text-xs text-muted">Bases {ph[0]} · Consolidation {ph[1]} · Mise en jeu {ph[2]}</p>{g.bilan[t] !== undefined && <p className="m-0 mt-1 text-xs">Bilan de départ : {BILAN_LEVELS[g.bilan[t]].label}</p>}</div>;
        })}
      </div>
      {missing.length > 0 && <p className="m-0 rounded-lg border-l-4 border-clay bg-champagne-soft p-3 text-sm"><b>À regarder :</b> ces thèmes sont « à acquérir » au bilan mais n'ont aucune séance : {missing.join(", ")}.</p>}
      <div className="grid gap-2 rounded-xl border border-line bg-white p-4">
        <h2 className="m-0 text-xl">Imprimer</h2>
        <div className="flex flex-wrap gap-3"><button type="button" className="btn-clay" onClick={() => setPm("prog")}>📄 Le programme de l'année (A4)</button><button type="button" className="btn-outline" onClick={() => setPm("fiches")}>🗒️ Les fiches de séance (2 par page)</button></div>
        <p className="hint m-0">Dans la fenêtre d'impression, choisis « Enregistrer au format PDF » pour garder un fichier. Rien n'est envoyé sur Internet.</p>
      </div>
      {pm && createPortal(<div className="affiche-print" style={{ background: "#fff", color: "#16140f", fontSize: 12, lineHeight: 1.35 }}>{pm === "prog" ? <PrintProgramme g={g} /> : <PrintFiches g={g} />}</div>, document.body)}
    </section>
  );
}

const PHead = ({ g, sub }: { g: Group; sub: string }) => {
  const L = levelDef(g.level);
  return (
    <header style={{ display: "flex", alignItems: "center", gap: 12, borderBottom: "2px solid #a8884a", paddingBottom: 8, marginBottom: 10 }}>
      <ClubLogo className="size-12 text-[#16140f]" />
      <div style={{ flex: 1 }}><div style={{ fontFamily: "Cormorant Garamond, serif", fontSize: 22, fontWeight: 700 }}>{g.name}</div><div style={{ color: "#6a645a" }}>{sub} · {L.key}{g.size ? ` · ${g.size} joueurs` : ""} · séances de {g.minutes} min</div></div>
      <div style={{ textAlign: "right", fontSize: 10, color: "#6a645a" }}>Tennis Club Houdan<br />Programmation de la saison</div>
    </header>
  );
};
function PrintProgramme({ g }: { g: Group }) {
  const L = levelDef(g.level); const rated = Object.entries(g.bilan).filter(([n]) => L.ok.includes(n));
  return (
    <div>
      <PHead g={g} sub="Programme de l'année" />
      <p style={{ margin: "0 0 6px" }}><b>Attendu à ce niveau :</b> {L.att.join(" · ")}.</p>
      {rated.length > 0 && <p style={{ margin: "0 0 8px" }}><b>Bilan de départ :</b> {rated.map(([n, v]) => `${n} (${BILAN_LEVELS[v].short.toLowerCase()})`).join(", ")}.</p>}
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead><tr style={{ background: "#efe8d8", textAlign: "left" }}>{["N°", "Séance", "Compétences", "Fil rouge", "Fait"].map((h) => <th key={h} style={{ border: "1px solid #ccc", padding: 4, fontSize: 10 }}>{h}</th>)}</tr></thead>
        <tbody>{g.sessions.map((s, i) => (
          <Fragment key={i}>
            {i % 10 === 0 && <tr><td colSpan={5} style={{ background: "#16140f", color: "#fff", padding: "3px 6px", fontWeight: 700, fontSize: 10, textTransform: "uppercase", letterSpacing: 1 }}>{PHASES[phaseOf(i)]}</td></tr>}
            <tr style={{ breakInside: "avoid" }}>
              <td style={{ border: "1px solid #ccc", padding: 4, fontWeight: 700 }}>{i + 1}</td>
              <td style={{ border: "1px solid #ccc", padding: 4 }}><b>{s.title}</b></td>
              <td style={{ border: "1px solid #ccc", padding: 4, whiteSpace: "pre-line" }}>{s.skills.replace(/• /g, "").split("\n").filter(Boolean).join(" · ")}</td>
              <td style={{ border: "1px solid #ccc", padding: 4 }}>{s.fil}</td>
              <td style={{ border: "1px solid #ccc", padding: 4, width: 22 }}>{s.done ? "✔" : ""}</td>
            </tr>
          </Fragment>
        ))}</tbody>
      </table>
    </div>
  );
}
function PrintFiches({ g }: { g: Group }) {
  const pages: Session[][] = []; for (let i = 0; i < g.sessions.length; i += 2) pages.push(g.sessions.slice(i, i + 2));
  return (
    <div>
      {pages.map((p, k) => (
        <section key={k} style={{ breakAfter: k < pages.length - 1 ? "page" : "auto", minHeight: "270mm", display: "grid", gridTemplateRows: "auto 1fr 1fr", gap: 8 }}>
          <PHead g={g} sub="Fiches de séance" />
          {p.map((s, j) => { const i = k * 2 + j; const d = s.theme && THEMES[s.theme] ? domainOf(THEMES[s.theme].d) : null; return (
            <article key={i} style={{ border: "1px solid #bbb", borderLeft: `6px solid ${d?.color ?? "#a8884a"}`, padding: 8, overflow: "hidden" }}>
              <div style={{ fontFamily: "Cormorant Garamond, serif", fontSize: 18, fontWeight: 700 }}>Séance {i + 1} · {s.title} <span style={{ fontSize: 11, fontFamily: "inherit", color: "#6a645a" }}>({PHASES[phaseOf(i)].toLowerCase()})</span></div>
              {s.why && <div style={{ color: "#6a645a", fontSize: 10 }}>Pourquoi : {s.why}</div>}
              <div style={{ marginTop: 4 }}><b>Compétences</b><div style={{ whiteSpace: "pre-line" }}>{s.skills}</div></div>
              <div style={{ marginTop: 4 }}><b>Exercice</b><div style={{ whiteSpace: "pre-line" }}>{s.exercise}</div></div>
              {s.fil && <div style={{ marginTop: 4 }}><b>Fil rouge :</b> {s.fil}</div>}
              <div style={{ marginTop: 6, borderTop: "1px dashed #bbb", paddingTop: 4, color: "#6a645a" }}>Notes : {s.note || "………………………………………………………………………………………………………………"}</div>
            </article>
          ); })}
        </section>
      ))}
    </div>
  );
}

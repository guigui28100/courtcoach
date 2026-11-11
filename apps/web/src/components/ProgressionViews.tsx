import { createPortal } from "react-dom";
import { ReactNode, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { BILAN_LEVELS, DOMAINS, Group, KIND_LABEL, levelDef, nextSession, parseSkills, PHASES, phaseOf, Session, sessionColor, sessionDomain, THEMES } from "../progression";
import { buildPages, DOC_H, DOC_W, DocChoice } from "./ProgressionDoc";

// Impression : les pages A4 sont posées dans un bloc caché à l'écran, seul visible à l'impression (même mécanisme que les affiches)
export function PrintHost({ pages, onDone }: { pages: ReactNode[] | null; onDone: () => void }) {
  useEffect(() => {
    if (!pages) return;
    const st = document.createElement("style"); st.textContent = "@page{size:210mm 297mm;margin:0}";
    document.head.appendChild(st); document.body.classList.add("printing-affiche");
    const done = () => { document.body.classList.remove("printing-affiche"); st.remove(); window.removeEventListener("afterprint", done); onDone(); };
    window.addEventListener("afterprint", done); const t = window.setTimeout(() => window.print(), 250);
    return () => { window.clearTimeout(t); window.removeEventListener("afterprint", done); document.body.classList.remove("printing-affiche"); st.remove(); };
  }, [pages]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!pages) return null;
  return createPortal(<div className="affiche-print" style={{ background: "#fff" }}>{pages}</div>, document.body);
}

const colorOf = (s: Session) => sessionColor(s);
const labelOf = (s: Session) => { const d = sessionDomain(s); return d ? DOMAINS.find((x) => x.key === d)!.label : KIND_LABEL[s.kind]; };

function Ring({ done, total }: { done: number; total: number }) {
  const r = 46, c = 2 * Math.PI * r, k = total ? done / total : 0;
  return (
    <svg width="120" height="120" viewBox="0 0 120 120" role="img" aria-label={`${done} séances faites sur ${total}`}>
      <circle cx="60" cy="60" r={r} fill="none" stroke="rgba(255,255,255,.15)" strokeWidth="9" />
      <circle cx="60" cy="60" r={r} fill="none" stroke="#d8c18a" strokeWidth="9" strokeLinecap="round" strokeDasharray={`${c * k} ${c}`} transform="rotate(-90 60 60)" />
      <text x="60" y="58" textAnchor="middle" fontSize="30" fontWeight="700" fill="#fff" style={{ fontFamily: "'Cormorant Garamond', serif" }}>{done}</text>
      <text x="60" y="78" textAnchor="middle" fontSize="11" fill="#cfc7b4">sur {total}</text>
    </svg>
  );
}

// Fiche d'une séance en lecture (téléphone et ordinateur) : la même que sur le document imprimé
export function Reader({ g, i, onClose, onGo, onDone, onPrint }: { g: Group; i: number; onClose: () => void; onGo: (i: number) => void; onDone: (i: number, v: boolean) => void; onPrint: (i: number) => void }) {
  const s = g.sessions[i], col = colorOf(s), L = levelDef(g.level), skills = parseSkills(s.skills);
  useEffect(() => { const k = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); if (e.key === "ArrowRight" && i < g.sessions.length - 1) onGo(i + 1); if (e.key === "ArrowLeft" && i > 0) onGo(i - 1); }; window.addEventListener("keydown", k); document.body.style.overflow = "hidden"; return () => { window.removeEventListener("keydown", k); document.body.style.overflow = ""; }; }, [i]); // eslint-disable-line react-hooks/exhaustive-deps
  return createPortal(
    <div role="dialog" aria-modal="true" aria-label={`Séance ${i + 1}`} className="fixed inset-0 z-[80] grid place-items-center bg-black/70 p-0 sm:p-4" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="grid max-h-full w-full max-w-2xl grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden bg-[#fbf8f1] text-ink shadow-2xl sm:rounded-2xl">
        <div className="flex items-center gap-1 px-4 pt-4" aria-hidden="true">{g.sessions.map((x, k) => <i key={k} className="flex-1" style={{ height: k === i ? 12 : 6, background: k === i ? col : x.done ? "#16140f" : "#e2dbc9" }} />)}</div>
        <div className="overflow-y-auto px-5 pb-4 pt-4 sm:px-8">
          <div className="flex items-end gap-4"><span className="font-serif font-bold leading-[.8]" style={{ fontSize: 96, color: col }}>{i + 1}</span><div className="pb-1"><p className="m-0 text-xs font-extrabold uppercase tracking-[.2em]" style={{ color: col }}>Séance {i + 1} sur {g.sessions.length}</p><p className="m-0 text-sm text-muted">{PHASES[phaseOf(i)]} · {labelOf(s)}</p></div></div>
          <h2 className="m-0 mt-4 font-serif text-3xl font-bold leading-tight sm:text-4xl [overflow-wrap:anywhere]">{s.title}</h2>
          <div className="my-3 h-1 w-20" style={{ background: col }} />
          {s.why && <p className="m-0 font-serif text-lg italic text-muted">Pourquoi cette séance : {s.why}.</p>}
          <h3 className="m-0 mt-5 text-xs font-extrabold uppercase tracking-[.18em]" style={{ color: col }}>Compétences à travailler</h3>
          <ul className="m-0 mt-2 grid list-none gap-2 p-0">{skills.map((c) => <li key={c} className="flex items-start gap-3 text-lg"><span className="mt-1 size-5 shrink-0 border-2" style={{ borderColor: col }} />{c}</li>)}{!skills.length && <li className="text-muted">À compléter.</li>}</ul>
          {s.fil && <div className="mt-5 border-l-4 bg-[#f3ecdc] px-4 py-2" style={{ borderColor: "#a8884a" }}><p className="m-0 text-[11px] font-extrabold uppercase tracking-[.16em]" style={{ color: "#a8884a" }}>Fil rouge de la séance</p><p className="m-0 text-base">{s.fil}</p></div>}
          <p className="m-0 mt-4 text-sm text-muted">{g.size ? `${g.size} joueurs · ` : ""}{g.minutes} min · {L.ball} · {L.terrain}</p>
          {s.note.trim() && <><h3 className="m-0 mt-4 text-xs font-extrabold uppercase tracking-[.18em] text-muted">Mes notes</h3><p className="m-0 mt-1 whitespace-pre-line">{s.note}</p></>}
        </div>
        <div className="flex flex-wrap items-center gap-2 border-t border-line bg-white px-4 py-3">
          <button type="button" className="btn-outline btn-sm" disabled={i === 0} onClick={() => onGo(i - 1)} aria-label="Séance précédente">‹</button>
          <button type="button" className="btn-outline btn-sm" disabled={i === g.sessions.length - 1} onClick={() => onGo(i + 1)} aria-label="Séance suivante">›</button>
          <button type="button" className={s.done ? "btn-outline btn-sm" : "btn-clay btn-sm"} onClick={() => onDone(i, !s.done)}>{s.done ? "✔ Faite (annuler)" : "✔ Marquer comme faite"}</button>
          <button type="button" className="btn-outline btn-sm" onClick={() => onPrint(i)}>🖨️ Cette fiche</button>
          <button type="button" className="btn-ink btn-sm ml-auto" onClick={onClose}>Fermer</button>
        </div>
      </div>
    </div>, document.body);
}

// Consultation : la prochaine séance en grand, la frise des 30 séances, la fiche d'une séance en un toucher
export function Consult({ g, onDone, onPrint, onEdit }: { g: Group; onDone: (i: number, v: boolean) => void; onPrint: (c: DocChoice, a?: number, b?: number) => void; onEdit: (i: number) => void }) {
  const S = g.sessions, done = S.filter((s) => s.done).length, nx = nextSession(g), cur = S[nx];
  const [dom, setDom] = useState<string>("all"); const [st, setSt] = useState<"all" | "todo" | "done">("all"); const [read, setRead] = useState<number | null>(null);
  if (!S.length) return <p className="m-0 text-muted">Crée d'abord la programmation (étape 2).</p>;
  const col = colorOf(cur), allDone = done === S.length;
  const shown = (s: Session) => (dom === "all" || sessionDomain(s) === dom || (dom === "match" && !s.theme)) && (st === "all" || (st === "done") === s.done);
  const count: Record<string, number> = {}; S.forEach((s) => { if (s.theme) count[s.theme] = (count[s.theme] || 0) + 1; });
  const byDom = DOMAINS.map((d) => ({ d, n: S.filter((s) => sessionDomain(s) === d.key).length })), tot = Math.max(1, byDom.reduce((a, x) => a + x.n, 0));
  const phasePct = [0, 1, 2].map((p) => { const a = S.filter((_, i) => phaseOf(i) === p); return a.length ? Math.round((a.filter((s) => s.done).length / a.length) * 100) : 0; });
  return (
    <section className="grid gap-5">
      <article className="grid gap-5 overflow-hidden rounded-2xl p-5 text-white sm:grid-cols-[minmax(0,1fr)_auto] sm:p-7" style={{ background: "linear-gradient(135deg,#16140f 0%,#26231c 60%,#3a3220 100%)", borderTop: `6px solid ${col}` }}>
        <div className="min-w-0">
          <p className="m-0 text-xs font-extrabold uppercase tracking-[.22em] text-[#d8c18a]">{allDone ? "Saison terminée" : `Ta prochaine séance · ${PHASES[phaseOf(nx)]}`}</p>
          <div className="mt-2 flex items-end gap-4"><span className="font-serif font-bold leading-[.8]" style={{ fontSize: 88, color: col === "#a8884a" ? "#d8c18a" : col }}>{nx + 1}</span><span className="pb-1 text-sm text-white/70">séance {nx + 1} sur {S.length} · {labelOf(cur)}</span></div>
          <h2 className="m-0 mt-3 font-serif text-3xl font-bold leading-tight text-white [overflow-wrap:anywhere]">{cur.title}</h2>
          <ul className="m-0 mt-3 flex list-none flex-wrap gap-2 p-0">{parseSkills(cur.skills).slice(0, 4).map((c) => <li key={c} className="rounded-full border border-white/25 px-3 py-1 text-sm text-white/90">{c}</li>)}</ul>
          {cur.fil && <p className="m-0 mt-3 text-sm text-[#d8c18a]">Fil rouge : {cur.fil}</p>}
          <div className="mt-4 flex flex-wrap gap-2">
            <button type="button" className="btn-clay" onClick={() => setRead(nx)}>Ouvrir la fiche</button>
            {!cur.done && <button type="button" className="rounded border border-white/40 bg-transparent px-4 py-2 font-bold text-white hover:bg-white/10" onClick={() => onDone(nx, true)}>✔ Marquer comme faite</button>}
            <button type="button" className="rounded border border-white/40 bg-transparent px-4 py-2 font-bold text-white hover:bg-white/10" onClick={() => onPrint("une", nx + 1, nx + 1)}>🖨️ Imprimer cette fiche</button>
          </div>
        </div>
        <div className="grid content-center justify-items-center gap-3"><Ring done={done} total={S.length} />
          <div className="grid w-40 gap-1.5 text-xs text-white/75">{PHASES.map((ph, p) => <div key={ph}><div className="flex justify-between"><span>{ph}</span><b>{phasePct[p]} %</b></div><div className="h-1.5 bg-white/15"><div className="h-full bg-[#d8c18a]" style={{ width: `${phasePct[p]}%` }} /></div></div>)}</div></div>
      </article>

      <div className="flex flex-wrap items-center gap-2">
        {[["all", "Toutes"], ...DOMAINS.map((d) => [d.key, d.label]), ["match", "Matchs et bilans"]].map(([k, l]) => <button key={k} type="button" aria-pressed={dom === k} onClick={() => setDom(k)} className={`rounded-full border-2 px-3 py-1.5 text-sm font-bold ${dom === k ? "border-ink bg-ink text-white" : "border-line bg-white text-ink hover:border-ink"}`}>{l}</button>)}
        <span className="mx-1 hidden h-6 w-px bg-line sm:block" />
        {[["all", "Toutes"], ["todo", "À faire"], ["done", "Faites"]].map(([k, l]) => <button key={k} type="button" aria-pressed={st === k} onClick={() => setSt(k as typeof st)} className={`rounded-full border-2 px-3 py-1.5 text-sm font-bold ${st === k ? "border-clay bg-clay text-white" : "border-line bg-white text-ink hover:border-clay"}`}>{l}</button>)}
      </div>

      {PHASES.map((ph, p) => {
        const items = S.map((s, i) => ({ s, i })).filter(({ s, i }) => phaseOf(i) === p && shown(s));
        if (!items.length) return null;
        return (
          <div key={ph} className="grid gap-3">
            <h3 className="m-0 flex items-baseline justify-between bg-ink px-3 py-1.5 text-xs font-bold uppercase tracking-widest text-white"><span>{ph}</span><span className="text-white/60">séances {p * 10 + 1} à {p * 10 + 10}</span></h3>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {items.map(({ s, i }) => (
                <button key={i} type="button" onClick={() => setRead(i)} className={`grid gap-1.5 border border-line bg-white p-3 text-left transition hover:-translate-y-0.5 hover:shadow-md ${s.done ? "opacity-70" : ""} ${i === nx && !allDone ? "ring-2 ring-clay" : ""}`} style={{ borderTop: `5px solid ${colorOf(s)}` }}>
                  <span className="flex items-center gap-2"><b className="font-serif text-3xl leading-none" style={{ color: colorOf(s) }}>{i + 1}</b><span className="text-[11px] font-bold uppercase tracking-wide text-muted">{labelOf(s)}</span>{s.done && <span className="ml-auto rounded-full bg-ok px-2 py-0.5 text-xs font-bold text-white">✔ faite</span>}{!s.done && i === nx && <span className="ml-auto rounded-full bg-clay px-2 py-0.5 text-xs font-bold text-white">Prochaine</span>}</span>
                  <b className="leading-snug [overflow-wrap:anywhere]">{s.title}</b>
                  <span className="text-xs text-muted">{parseSkills(s.skills).slice(0, 2).join(" · ")}</span>
                </button>
              ))}
            </div>
          </div>
        );
      })}

      <details className="rounded-xl border border-line bg-white p-4"><summary className="cursor-pointer font-bold">Ce que la saison couvre</summary>
        <div className="mt-3 flex h-4 overflow-hidden rounded" role="img" aria-label="Répartition par domaine">{byDom.map(({ d, n }) => <div key={d.key} style={{ width: `${(n / tot) * 100}%`, background: d.color }} />)}</div>
        <p className="m-0 mt-2 flex flex-wrap gap-3 text-sm">{byDom.map(({ d, n }) => <span key={d.key}><i className="mr-1 inline-block size-3" style={{ background: d.color }} />{d.label} : {n}</span>)}</p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{Object.entries(count).sort((a, b) => b[1] - a[1]).map(([t, c]) => <p key={t} className="m-0 border border-line p-2 text-sm" style={{ borderTop: `4px solid ${DOMAINS.find((d) => d.key === THEMES[t]?.d)?.color}` }}><b>{t}</b> · {c} séance{c > 1 ? "s" : ""}{g.bilan[t] !== undefined && <span className="block text-xs text-muted">Bilan de départ : {BILAN_LEVELS[g.bilan[t]].label}</span>}</p>)}</div>
      </details>

      {read !== null && <Reader g={g} i={read} onClose={() => setRead(null)} onGo={setRead} onDone={onDone} onPrint={(i) => onPrint("une", i + 1, i + 1)} />}
      <p className="m-0 text-sm text-muted">Pour changer une séance : <button type="button" className="underline" onClick={() => onEdit(nx)}>ouvre l'étape 2 · Programmation</button>.</p>
    </section>
  );
}

// Documents : aperçu page par page et impression / PDF
export function Docs({ g, onPrint }: { g: Group; onPrint: (c: DocChoice, a?: number, b?: number) => void }) {
  const [choice, setChoice] = useState<DocChoice>("tout"); const [from, setFrom] = useState(1); const [to, setTo] = useState(10); const [n, setN] = useState(0);
  const pages = useMemo(() => buildPages(g, choice, from, to), [g, choice, from, to]);
  const box = useRef<HTMLDivElement>(null); const [w, setW] = useState(600);
  useLayoutEffect(() => { const el = box.current; if (!el) return; const f = () => setW(Math.min(el.clientWidth, 760)); f(); const ro = new ResizeObserver(f); ro.observe(el); return () => ro.disconnect(); }, []);
  useEffect(() => { if (n >= pages.length) setN(Math.max(0, pages.length - 1)); }, [pages.length, n]);
  if (!g.sessions.length) return <p className="m-0 text-muted">Crée d'abord la programmation (étape 2).</p>;
  const sc = w / DOC_W;
  const OPT: [DocChoice, string, string][] = [["tout", "Le dossier complet", `${3 + g.sessions.length} pages : couverture, bilan, vue d'ensemble et une fiche par séance`], ["programme", "Le programme seulement", "3 pages : couverture, bilan, vue d'ensemble"], ["fiches", "Toutes les fiches de séance", `${g.sessions.length} pages, une par séance`], ["plage", "Quelques séances", "De la séance … à la séance …"]];
  return (
    <section className="grid gap-5 lg:grid-cols-[19rem_minmax(0,1fr)]">
      <div className="grid content-start gap-3">
        <h2 className="m-0 text-xl">Quel document ?</h2>
        {OPT.map(([k, l, d]) => <button key={k} type="button" aria-pressed={choice === k} onClick={() => { setChoice(k); setN(0); }} className={`border-2 p-3 text-left ${choice === k ? "border-ink bg-ink text-white" : "border-line bg-white hover:border-ink"}`}><b className="block">{l}</b><span className={`text-xs ${choice === k ? "text-white/75" : "text-muted"}`}>{d}</span></button>)}
        {choice === "plage" && <div className="flex items-end gap-2"><label className="grid flex-1 gap-1 text-sm font-bold">De<input type="number" className="input" min={1} max={g.sessions.length} value={from} onChange={(e) => setFrom(Math.max(1, Math.min(g.sessions.length, +e.target.value || 1)))} /></label><label className="grid flex-1 gap-1 text-sm font-bold">à<input type="number" className="input" min={1} max={g.sessions.length} value={to} onChange={(e) => setTo(Math.max(1, Math.min(g.sessions.length, +e.target.value || 1)))} /></label></div>}
        <button type="button" className="btn-clay" onClick={() => onPrint(choice, from, to)}>🖨️ Imprimer ou enregistrer en PDF</button>
        <p className="hint m-0">{pages.length} page{pages.length > 1 ? "s" : ""}. Dans la fenêtre d'impression, choisis « Enregistrer au format PDF » : marges « Aucune », format A4. Le document est fabriqué sur ton ordinateur, rien n'est envoyé sur Internet.</p>
      </div>
      <div className="min-w-0" ref={box}>
        <div className="mx-auto overflow-hidden border border-line shadow-xl" style={{ width: DOC_W * sc, height: DOC_H * sc }}><div style={{ width: DOC_W, height: DOC_H, transform: `scale(${sc})`, transformOrigin: "top left" }}>{pages[n]}</div></div>
        <div className="mt-3 flex items-center justify-center gap-3"><button type="button" className="btn-outline" aria-label="Page précédente" disabled={n === 0} onClick={() => setN(n - 1)}>‹</button><b>Page {pages.length ? n + 1 : 0} / {pages.length}</b><button type="button" className="btn-outline" aria-label="Page suivante" disabled={n >= pages.length - 1} onClick={() => setN(n + 1)}>›</button></div>
      </div>
    </section>
  );
}

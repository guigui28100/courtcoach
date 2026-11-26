import { ReactNode, useState } from "react";
import { baseLabel, baseOfObjective, BASE_CONTEXTS } from "../techBase";
import { After, Block, DOMAINS, Domain, Group, objOf, PHASES, phaseOf, Reach, Session, sessionStatus, STATUS_LABEL, suggestFor } from "../progression";
import { QuickEval } from "./ProgressionViews";
import { Roll, todayParis } from "./ProgressionRoll";

// Déroulement : un échauffement, des situations d'apprentissage, des situations de jeu, puis le bilan
type Kind = "ech" | "app" | "jeu" | "bil";
const kindOf = (b: Block): Kind => (/chauff/i.test(b.n) ? "ech" : /jeu|match|opposition/i.test(b.n) ? "jeu" : /retour|bilan/i.test(b.n) ? "bil" : "app");
const RANK: Record<Kind, number> = { ech: 0, app: 1, jeu: 2, bil: 3 };
const SECTIONS: { k: Kind; title: string; n: string; help: string }[] = [
  { k: "ech", title: "1 · Échauffement", n: "Échauffement", help: "Un seul échauffement par séance." },
  { k: "app", title: "2 · Situations d'apprentissage", n: "Situation", help: "Autant de situations que nécessaire, facultatives et modifiables." },
  { k: "jeu", title: "3 · Situations de jeu et d'opposition", n: "Jeu", help: "Le réinvestissement en jeu, avec adversaire et score." },
  { k: "bil", title: "4 · Bilan de séance et évaluation des acquis", n: "Retour au calme", help: "Retour au calme, questions aux joueurs, évaluation des acquis." },
];
const sorted = (l: Block[]) => l.map((b, i) => ({ b, i })).sort((x, y) => RANK[kindOf(x.b)] - RANK[kindOf(y.b)] || x.i - y.i).map((x) => x.b);
const REACH: [Reach, string, string][] = [["oui", "Atteint", "#2c9a5b"], ["part", "En partie", "#e8920c"], ["non", "Pas atteint", "#d64545"]];
const frDate = (d: string) => new Date(d + "T12:00:00").toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });

export function Sheet({ g, i, upd, setS, editor, onClose, onGo, onPrint, onMove, onRemove }: {
  g: Group; i: number; upd: (p: Partial<Group>) => void; setS: (i: number, p: Partial<Session>) => void; editor: ReactNode;
  onClose: () => void; onGo: (i: number) => void; onPrint: () => void; onMove: (d: number) => void; onRemove: () => void;
}) {
  const s = g.sessions[i]; const blocks = s.blocks ?? []; const obj = objOf(s);
  const [roll, setRoll] = useState(false); const [bilanOpen, setBilanOpen] = useState(!!s.done || !!s.after); const [ask, setAsk] = useState(false);
  const total = blocks.reduce((a, b) => a + (b.m || 0), 0), diff = g.minutes - total;
  const status = sessionStatus(s); const date = s.date || todayParis(); const sug = suggestFor(g, i);
  const setBlocks = (l: Block[]) => setS(i, { blocks: sorted(l) });
  const patch = (b: Block, p: Partial<Block>) => setBlocks(blocks.map((x) => (x === b ? { ...x, ...p } : x)));
  const addBlock = (k: Kind, over: Partial<Block> = {}) => { const sec = SECTIONS.find((x) => x.k === k)!; setBlocks([...blocks, { n: sec.n, m: k === "ech" ? Math.round(g.minutes * 0.15 / 5) * 5 || 10 : k === "bil" ? 5 : 15, t: "", ...over }].slice(0, 8)); };
  const mats = Array.from(new Set([...(s.mat ? [s.mat] : []), ...blocks.map((b) => b.mat || "").filter(Boolean)]));
  const techObj = obj.tech.map((o) => ({ o, it: baseOfObjective(o) })).filter((x) => x.it);
  const after: After = s.after ?? {}; const setAfter = (p: Partial<After>) => setS(i, { after: { ...after, ...p } });
  const nEch = blocks.filter((b) => kindOf(b) === "ech").length;
  const input = "input";

  return (
    <article className="grid gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className="btn-outline btn-sm" onClick={onClose}>← Les séances</button>
        <button type="button" className="btn-outline btn-sm" disabled={i === 0} onClick={() => onGo(i - 1)} aria-label="Séance précédente">‹</button>
        <button type="button" className="btn-outline btn-sm" disabled={i === g.sessions.length - 1} onClick={() => onGo(i + 1)} aria-label="Séance suivante">›</button>
        <span className="ml-auto rounded-full px-3 py-1 text-sm font-bold text-white" style={{ background: status === "realisee" ? "#2c9a5b" : status === "prete" ? "#2a6f97" : "#935500" }}>{STATUS_LABEL[status]}</span>
      </div>

      <section className="grid gap-3 rounded-2xl p-5 text-white" style={{ background: "linear-gradient(135deg,#16140f 0%,#26231c 60%,#3a3220 100%)" }}>
        <p className="m-0 text-xs font-extrabold uppercase tracking-[.2em] text-[#d8c18a]">Séance {i + 1} sur {g.sessions.length} · {PHASES[phaseOf(i, g.sessions.length)]}</p>
        <h2 className="m-0 font-serif text-2xl font-bold text-white [overflow-wrap:anywhere]">{s.title || s.theme || "Séance à préparer"}</h2>
        <dl className="m-0 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
          <div><dt className="inline text-white/60">Groupe : </dt><dd className="inline">{g.name}{g.slot ? ` · ${g.slot}` : ""}</dd></div>
          <div><dt className="inline text-white/60">Enseignant : </dt><dd className="inline">{g.teacher || "à renseigner dans le groupe"}</dd></div>
          <div><dt className="inline text-white/60">Niveau : </dt><dd className="inline">{g.level.split(" · ")[0]}{g.age ? ` · ${g.age}` : ""}</dd></div>
          <div><dt className="inline text-white/60">Joueurs : </dt><dd className="inline">{g.players?.length || g.size || "?"}</dd></div>
          <div><dt className="inline text-white/60">Durée : </dt><dd className="inline">{g.minutes} min (déroulement : {total} min)</dd></div>
          <div><dt className="inline text-white/60">Thème : </dt><dd className="inline">{s.theme.trim() || "libre"}</dd></div>
        </dl>
        <label className="grid max-w-xs gap-1 text-sm"><span className="text-white/70">Date de la séance</span><input id="sh-date" type="date" className="input !text-ink" value={s.date || ""} onChange={(e) => setS(i, { date: e.target.value || undefined })} /></label>
        <div className="grid gap-2 sm:grid-cols-2">{DOMAINS.map((d) => <p key={d.key} className="m-0 border-l-4 bg-white/10 px-3 py-2 text-sm" style={{ borderColor: d.color }}><b className="block text-white">{d.label}</b>{obj[d.key].length ? obj[d.key].join(" · ") : <span className="text-white/60">aucun objectif</span>}</p>)}</div>
        <p className="m-0 text-sm"><b>Matériel nécessaire :</b> {mats.length ? mats.join(" · ") : "à compléter dans les situations"}</p>
      </section>

      {sug.length > 0 && !s.done && (
        <aside className="grid gap-1 rounded-xl border-l-4 border-champagne bg-paper p-3 text-sm">
          <b>Ajustements proposés d'après ta dernière séance</b>
          <ul className="m-0 list-disc pl-5">{sug.map((t) => <li key={t}>{t}</li>)}</ul>
          <span className="hint">Ce ne sont que des idées : la programmation validée n'est pas modifiée.</span>
        </aside>)}

      <details className="rounded-xl border border-line bg-white p-4"><summary className="cursor-pointer font-bold">Modifier le thème et les objectifs de la séance</summary><div className="mt-3 grid gap-3">{editor}</div></details>

      {SECTIONS.map((sec) => {
        const list = blocks.filter((b) => kindOf(b) === sec.k);
        return (
          <section key={sec.k} className="grid gap-3 rounded-xl border border-line bg-white p-4">
            <div className="flex flex-wrap items-center justify-between gap-2"><div><h3 className="m-0 text-lg">{sec.title}</h3><p className="hint m-0">{sec.help}</p></div>
              {(sec.k !== "ech" || list.length === 0) && (sec.k !== "bil" || list.length === 0) && <button type="button" className="btn-outline btn-sm" disabled={blocks.length >= 8} onClick={() => addBlock(sec.k)}>＋ {sec.k === "ech" ? "Ajouter l'échauffement" : sec.k === "app" ? "Situation d'apprentissage" : sec.k === "jeu" ? "Situation de jeu" : "Ajouter le bilan"}</button>}</div>
            {sec.k === "app" && techObj.length > 0 && (
              <label className="grid gap-1 text-sm"><span className="font-bold">Partir d'une situation du référentiel du club</span>
                <select id="sh-lib" className="input" value="" onChange={(e) => { const it = techObj.find((x) => x.o === e.target.value)?.it; if (it) addBlock("app", { goal: baseLabel(it), t: it.ex, vigil: it.def ? `À observer : ${it.obs}. Défaut possible : ${it.def}.` : "", ok: BASE_CONTEXTS.map((c) => `${c.label} : ${c.ok}`).join(" ; ") }); }}>
                  <option value="">Choisir un objectif technique de la séance…</option>{techObj.map((x) => <option key={x.o} value={x.o}>{x.o}</option>)}</select></label>)}
            {list.length === 0 && <p className="m-0 text-sm text-muted">{sec.k === "ech" ? "Pas encore d'échauffement." : "Rien pour l'instant."}</p>}
            {list.map((b) => (
              <div key={blocks.indexOf(b)} className="grid gap-2 rounded-lg bg-paper p-3">
                <div className="grid grid-cols-[minmax(0,1fr)_6rem_auto] items-end gap-2">
                  <label className="grid gap-1"><span className="text-xs font-bold text-muted">Objectif de la situation</span><input className={input} maxLength={400} value={b.goal || ""} onChange={(e) => patch(b, { goal: e.target.value })} /></label>
                  <label className="grid gap-1"><span className="text-xs font-bold text-muted">Durée (min)</span><input className={input} type="number" min={0} max={180} value={b.m} onChange={(e) => patch(b, { m: Math.max(0, Math.min(180, +e.target.value || 0)) })} /></label>
                  <button type="button" className="btn-outline btn-sm" onClick={() => setBlocks(blocks.filter((x) => x !== b))}>Retirer</button>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  <label className="grid gap-1"><span className="text-xs font-bold text-muted">Organisation du terrain</span><textarea className={`${input} min-h-16`} maxLength={400} value={b.org || ""} onChange={(e) => patch(b, { org: e.target.value })} /></label>
                  <label className="grid gap-1"><span className="text-xs font-bold text-muted">Consignes</span><textarea className={`${input} min-h-16`} maxLength={600} value={b.t} onChange={(e) => patch(b, { t: e.target.value })} /></label>
                  <label className="grid gap-1"><span className="text-xs font-bold text-muted">Critères de réussite</span><textarea className={`${input} min-h-16`} maxLength={400} value={b.ok || ""} onChange={(e) => patch(b, { ok: e.target.value })} /></label>
                  <label className="grid gap-1"><span className="text-xs font-bold text-muted">Variables : pour simplifier / pour complexifier</span><textarea className={`${input} min-h-16`} maxLength={400} value={b.vars || ""} onChange={(e) => patch(b, { vars: e.target.value })} placeholder="Simplifier : … Complexifier : …" /></label>
                  <label className="grid gap-1"><span className="text-xs font-bold text-muted">Matériel</span><input className={input} maxLength={200} value={b.mat || ""} onChange={(e) => patch(b, { mat: e.target.value })} /></label>
                  <label className="grid gap-1"><span className="text-xs font-bold text-muted">Points de vigilance de l'enseignant</span><input className={input} maxLength={400} value={b.vigil || ""} onChange={(e) => patch(b, { vigil: e.target.value })} /></label>
                </div>
              </div>))}
          </section>);
      })}

      <p role="status" className="m-0 text-sm font-bold" style={{ color: diff === 0 && nEch === 1 ? "#2c9a5b" : "#935500" }}>
        Temps total : {total} min sur {g.minutes}. {diff === 0 ? "Le temps est bien réparti." : diff > 0 ? `Il reste ${diff} min à placer.` : `Tu dépasses de ${-diff} min.`} {nEch === 0 ? "Pense à ajouter l'échauffement." : nEch > 1 ? "Il ne doit y avoir qu'un échauffement." : ""}
      </p>

      <section className="grid gap-3 rounded-xl border-2 border-ink bg-white p-4">
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn-clay" aria-expanded={roll} onClick={() => setRoll(!roll)}>Faire l'appel</button>
          {!s.done && <button type="button" className={s.ready ? "btn-outline" : "btn-ink"} onClick={() => setS(i, { ready: !s.ready })}>{s.ready ? "✔ Séance prête (annuler)" : "Marquer la séance comme prête"}</button>}
          <button type="button" className={s.done ? "btn-outline" : "btn-ink"} onClick={() => { setS(i, { done: !s.done, ...(s.done ? {} : { date: s.date || todayParis() }) }); if (!s.done) setBilanOpen(true); }}>{s.done ? "Séance réalisée (annuler)" : "✔ Séance réalisée"}</button>
          <button type="button" className="btn-outline" onClick={onPrint}>Imprimer cette fiche</button>
        </div>
        {roll && <div className="rounded-lg bg-paper p-3"><Roll g={g} upd={upd} date={date} onDate={(d) => setS(i, { date: d })} /><p className="hint m-0 mt-2">Appel du {frDate(date)} : il est rattaché à cette séance et à ce groupe.</p></div>}
      </section>

      <details className="rounded-xl border border-line bg-white p-4" open={bilanOpen} onToggle={(e) => setBilanOpen((e.currentTarget as HTMLDetailsElement).open)}>
        <summary className="cursor-pointer font-bold">Bilan après la séance</summary>
        <div className="mt-3 grid gap-3">
          <div className="grid gap-2"><b className="text-sm">Objectifs atteints ?</b>
            {DOMAINS.filter((d) => obj[d.key].length).map((d) => (
              <div key={d.key} className="grid gap-1 sm:grid-cols-[8rem_minmax(0,1fr)] sm:items-center"><span className="font-bold" style={{ color: d.color }}>{d.label}</span>
                <div role="group" aria-label={d.label} className="grid grid-cols-3 gap-1">{REACH.map(([k, l, c]) => <button key={k} type="button" aria-pressed={after.reach?.[d.key as Domain] === k} onClick={() => { const r = { ...after.reach }; if (r[d.key] === k) delete r[d.key]; else r[d.key] = k; setAfter({ reach: r }); }} className="min-h-10 rounded-md border border-line px-2 text-sm font-bold" style={after.reach?.[d.key] === k ? { background: c, color: "#fff", borderColor: c } : undefined}>{l}</button>)}</div></div>))}
            {!DOMAINS.some((d) => obj[d.key].length) && <p className="m-0 text-sm text-muted">Aucun objectif choisi pour cette séance.</p>}
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="grid gap-1"><span className="text-xs font-bold text-muted">Réussites du groupe</span><textarea className={`${input} min-h-16`} maxLength={600} value={after.wins || ""} onChange={(e) => setAfter({ wins: e.target.value })} /></label>
            <label className="grid gap-1"><span className="text-xs font-bold text-muted">Difficultés rencontrées</span><textarea className={`${input} min-h-16`} maxLength={600} value={after.hard || ""} onChange={(e) => setAfter({ hard: e.target.value })} /></label>
            <label className="grid gap-1"><span className="text-xs font-bold text-muted">Exercices particulièrement efficaces</span><textarea className={`${input} min-h-16`} maxLength={400} value={after.best || ""} onChange={(e) => setAfter({ best: e.target.value })} /></label>
            <label className="grid gap-1"><span className="text-xs font-bold text-muted">Points à retravailler</span><textarea className={`${input} min-h-16`} maxLength={600} value={after.rework || ""} onChange={(e) => setAfter({ rework: e.target.value })} /></label>
          </div>
          <label className="grid gap-1"><span className="text-xs font-bold text-muted">Observations individuelles (prénoms seulement)</span><textarea className={`${input} min-h-20`} maxLength={900} value={after.indiv || ""} onChange={(e) => setAfter({ indiv: e.target.value })} placeholder="Ex. Léa : très à l'aise au filet. Tom : à encourager sur le service." /></label>
          <QuickEval s={s} onChange={(p) => setS(i, p)} />
        </div>
      </details>

      <details className="rounded-xl border border-line bg-white p-4"><summary className="cursor-pointer font-bold">Plus : déplacer ou retirer cette séance</summary>
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" className="btn-outline btn-sm" disabled={i === 0} onClick={() => onMove(-1)}>↑ Monter</button>
          <button type="button" className="btn-outline btn-sm" disabled={i === g.sessions.length - 1} onClick={() => onMove(1)}>↓ Descendre</button>
          {ask ? <span className="flex items-center gap-2 text-sm"><b>Retirer cette séance ?</b><button type="button" className="btn-ink btn-sm" onClick={onRemove}>Oui</button><button type="button" className="btn-outline btn-sm" onClick={() => setAsk(false)}>Non</button></span> : <button type="button" className="btn-outline btn-sm" onClick={() => setAsk(true)}>🗑️ Retirer cette séance</button>}
        </div>
      </details>
    </article>
  );
}

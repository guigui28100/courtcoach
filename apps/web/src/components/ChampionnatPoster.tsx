import { AnecdoteBox, useAnec } from "./Anecdote";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { ClubEvent, colorOf, opponentOf, seasonOf, TEAM_CATS, teamCat, textOn, todayParis, venueOf } from "../clubPlan";
import { Backdrop } from "./PosterBackdrop";
import { CourtLines } from "./CourtLines";
import { SERIF } from "./posterFonts";
import { POSTER_H, POSTER_W } from "./ClubPoster";
import { PosterStudio, Sec } from "./PosterStudio";
import { teamParts, tidy } from "./posterCopy";
import { FmtStyle, Fmts, pickFmt, txt } from "./posterFmt";
import { FmtItem } from "./FmtPanel";

// Affiche de FIN DE CHAMPIONNAT : pour chaque équipe, son dernier match et son classement final.
// Les équipes et leur dernier match viennent du planning ; le coach écrit le score, le classement et, si besoin, montée / maintien / descente.
// Rien n'est enregistré. Aucun nom d'élève : seulement des équipes et des clubs.
export type Row = { id: string; team: string; club: string; h: string; a: string; rank: string; of: string; issue: string; home: "" | "home" | "away" };
const ISSUES = ["", "Champion", "Montée", "Maintien", "Descente"];
const ISSUE_C: Record<string, string> = { Champion: "#8a6a2c", Montée: "#2f6b4a", Maintien: "#4a6d8f", Descente: "#a3412a" };
const num = (v: string) => (/^\d{1,2}$/.test(v.trim()) ? +v.trim() : null);
const rankText = (r: number) => (r === 1 ? "1er" : `${r}e`);
const order = (t: string) => { const i = TEAM_CATS.findIndex((c) => c.key === t.split("#")[0]); return (i < 0 ? 99 : i) * 10 + (+(t.split("#")[1] ?? 1) || 1); };
const uid = () => Math.random().toString(36).slice(2, 9);
const safe = (s: string) => s.replace(/[^a-z0-9-]/gi, "-");

// équipes du planning pour la saison, avec leur DERNIER match
export function rowsFromPlan(events: ClubEvent[], season: number): Row[] {
  const last = new Map<string, ClubEvent>();
  for (const e of events.filter((x) => x.kind === "EQUIPES" && !x.tentative && seasonOf(x.startDate) === season).sort((a, b) => a.startDate.localeCompare(b.startDate)))
    for (const t of e.teams) last.set(t, e);
  return [...last.entries()].sort((x, y) => order(x[0]) - order(y[0])).map(([team, e]) => ({ id: uid(), team, club: opponentOf(e), h: "", a: "", rank: "", of: "", issue: "", home: venueOf(e) }));
}

const Logo = ({ size, style }: { size: number; style?: React.CSSProperties }) => (
  <span aria-hidden style={{ display: "inline-block", width: size, height: size, background: "#fff", WebkitMask: "url(/logo-tch.png) center / contain no-repeat", mask: "url(/logo-tch.png) center / contain no-repeat", ...style }} />
);
const shownOf = (rows: Row[]) => rows.filter((r) => r.team && (num(r.rank) !== null || (num(r.h) !== null && num(r.a) !== null)));

export function ChampionnatPoster({ rows, title, sub, bg = "", fmt, onPick }: { rows: Row[]; title: string; sub: string; bg?: string; fmt?: Fmts; onPick?: (key: string) => void }) {
  const shown = shownOf(rows), n = shown.length, HEAD = 230, FOOT = 96, avail = POSTER_H - HEAD - FOOT - 56;
  const anec = useAnec(); const box = useRef<HTMLDivElement>(null); const g = 1 + (fmt?.tout?.size ?? 0) * 0.08;
  const [k, setK] = useState(1); const [tick, setTick] = useState(0);
  useEffect(() => { let on = true; (document as any).fonts?.ready?.then(() => { if (on) setTick((x) => x + 1); }); return () => { on = false; }; }, []);
  const sig = anec.sig + JSON.stringify(shown) + JSON.stringify(fmt);
  useLayoutEffect(() => {
    const el = box.current; if (!el) return;
    el.style.zoom = "1"; el.setAttribute("data-measuring", "");
    const h = el.scrollHeight;
    let nk = h > 0 ? Math.max(0.4, Math.min(n < 6 ? 1.7 : 1.4, (avail * 0.97) / h)) : 1;
    el.style.zoom = String(nk);
    for (let i = 0; i < 14 && nk > 0.4 && el.getBoundingClientRect().height > avail * 0.97; i++) { nk *= 0.96; el.style.zoom = String(nk); }
    el.removeAttribute("data-measuring"); el.style.zoom = String(nk * g); setK(nk);
  }, [sig, avail, n, tick, g]);
  return (
    <div style={{ position: "relative", width: POSTER_W, height: POSTER_H, background: "#fbf8f1", overflow: "hidden", fontFamily: "Archivo, 'Atkinson Hyperlegible', system-ui, sans-serif", color: "#17140f", fontVariantNumeric: "lining-nums" }} onClick={(ev) => pickFmt(ev, onPick)}>
      <FmtStyle fmts={fmt} />
      <Backdrop bg={bg} w={POSTER_W} h={POSTER_H} veil="strong" />
      <div style={{ position: "relative", height: HEAD, background: "linear-gradient(135deg,#2b261d 0%,#17140f 60%)", color: "#fff", overflow: "hidden", clipPath: "polygon(0 0,100% 0,100% 90%,0 100%)" }}>
        <svg aria-hidden width={POSTER_W} height={HEAD} viewBox={`0 0 ${POSTER_W} ${HEAD}`} style={{ position: "absolute", inset: 0, opacity: 0.2 }} fill="none" stroke="#c9ad77" strokeWidth="4"><CourtLines cx={397} y={18} h={186} netWidth={6} /></svg>
        <Logo size={130} style={{ position: "absolute", right: 34, top: 22 }} />
        <div style={{ position: "absolute", left: 52, top: 30, right: 190 }}>
          <div data-fmt="entete" style={{ fontSize: 24, fontWeight: 800, letterSpacing: "0.22em" }}>{txt(fmt, "entete", "TENNIS CLUB HOUDAN")}</div>
          <div data-fmt="titre" style={{ fontFamily: SERIF, fontSize: 54, fontWeight: 900, lineHeight: 1, marginTop: 10, whiteSpace: "nowrap" }}>{txt(fmt, "titre", title)}</div>
          <div style={{ fontFamily: SERIF, fontSize: 32, fontWeight: 700, fontStyle: "italic", marginTop: 6, color: "#e8d9a8", whiteSpace: "nowrap" }}><span data-fmt="sous">{txt(fmt, "sous", sub)}</span></div>
        </div>
      </div>
      <div style={{ position: "absolute", left: 44, right: 44, top: HEAD + 20, bottom: FOOT + 12, display: "flex", flexDirection: "column", justifyContent: "center" }}><div ref={box} style={{ zoom: k * g }}>
        {n === 0 && <p data-fmt="vide" style={{ textAlign: "center", fontSize: 24, color: "#6b6558" }}>{txt(fmt, "vide", "Écris le classement et le dernier match de chaque équipe dans le menu de gauche.")}</p>}
        {shown.map((r) => {
          const kk = safe(r.id), c = teamCat(r.team)?.color ?? "#4a6d8f", [cat, nm] = teamParts(r.team), rk = num(r.rank), of = num(r.of), hh = num(r.h), aa = num(r.a);
          const res = hh !== null && aa !== null ? (hh > aa ? "W" : hh < aa ? "L" : "D") : null, club = tidy(r.club).replace(/^(TC|AS|US|CT|ASPTT|SC)\s/i, "$1 ");
          const verbe = res === "W" ? (club ? `bat ${club}` : "s'impose") : res === "L" ? (club ? `s'incline contre ${club}` : "s'incline") : res === "D" ? (club ? `fait match nul contre ${club}` : "match nul") : "";
          const sc = res ? `${hh}–${aa}` : "";
          return (
            <div key={r.id} style={{ display: "flex", alignItems: "stretch", gap: 14, padding: "8px 0", borderBottom: "1px solid #e4dccb" }}>
              <div data-fmt={`eq-${kk}`} style={{ flex: "0 0 auto", width: 230, background: c, color: textOn(c), borderRadius: 8, padding: "8px 12px", display: "flex", flexDirection: "column", justifyContent: "center", lineHeight: 1.1 }}>
                <div style={{ fontSize: 19, fontWeight: 900 }}>{cat}</div><div style={{ fontFamily: SERIF, fontSize: 24, fontWeight: 900 }}>{nm}</div>
              </div>
              <div style={{ minWidth: 0, flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", gap: 5 }}>
                {res ? <>
                  <div style={{ fontSize: 13, fontWeight: 900, letterSpacing: "0.1em", textTransform: "uppercase", color: "#6b6558" }}>Dernier match{r.home ? ` · ${r.home === "home" ? "à domicile" : "en déplacement"}` : ""}</div>
                  <div data-fmt={`ph-${kk}`} style={{ fontSize: 21, fontWeight: 900, lineHeight: 1.15 }}>{txt(fmt, `ph-${kk}`, `TC Houdan ${verbe}`)}</div>
                  <div><span data-fmt={`sc-${kk}`} style={{ display: "inline-block", background: res === "W" ? "#2f6b4a" : res === "L" ? "#a3412a" : "#6b6558", color: "#fff", fontFamily: SERIF, fontSize: 24, fontWeight: 900, padding: "1px 14px", borderRadius: 6 }}>{txt(fmt, `sc-${kk}`, sc)}</span></div>
                </> : <div style={{ fontSize: 18, color: "#6b6558" }}>Dernier match non renseigné</div>}
              </div>
              <div style={{ flex: "0 0 auto", width: 190, background: "#17140f", color: "#fff", borderRadius: 8, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "6px 8px" }}>
                <div style={{ fontSize: 12, fontWeight: 900, letterSpacing: "0.14em", color: "#e8d9a8" }}>CLASSEMENT FINAL</div>
                {rk !== null ? <div data-fmt={`rk-${kk}`} style={{ fontFamily: SERIF, fontSize: 46, fontWeight: 900, lineHeight: 1.05, color: rk === 1 ? "#f0d27a" : "#fff" }}>{txt(fmt, `rk-${kk}`, rankText(rk))}{of ? <span style={{ fontSize: 22, fontWeight: 700, color: "#cfc7b4" }}> sur {of}</span> : null}</div> : <div style={{ fontSize: 20, marginTop: 6, color: "#cfc7b4" }}>—</div>}
                {r.issue && <span data-fmt={`is-${kk}`} style={{ marginTop: 4, background: ISSUE_C[r.issue], color: "#fff", fontSize: 12, fontWeight: 900, letterSpacing: "0.08em", textTransform: "uppercase", padding: "2px 10px", borderRadius: 4 }}>{txt(fmt, `is-${kk}`, r.issue)}</span>}
              </div>
            </div>
          );
        })}
        {n > 0 && <AnecdoteBox fmt={fmt} />}
      </div></div>
      <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: FOOT, background: "#17140f", color: "#fff", padding: "14px 40px", display: "flex", alignItems: "center", gap: 14 }}>
        <Logo size={44} />
        <div style={{ whiteSpace: "nowrap" }}>
          <div data-fmt="club" style={{ fontWeight: 900, fontSize: 20, letterSpacing: "0.04em" }}>{txt(fmt, "club", "Tennis Club Houdan")}</div>
          <div data-fmt="mail" style={{ fontSize: 14, fontWeight: 800, color: "#dfcb98" }}>{txt(fmt, "mail", "✉️ tennisclubhoudan@gmail.com")}</div>
        </div>
        <div data-fmt="pied" style={{ marginLeft: "auto", fontFamily: SERIF, fontStyle: "italic", fontSize: 22, color: "#e8d9a8", whiteSpace: "nowrap" }}>{txt(fmt, "pied", "Merci et bravo à toutes nos équipes !")}</div>
      </div>
    </div>
  );
}

export function ChampionnatModal({ events, onClose }: { events: ClubEvent[]; onClose: () => void }) {
  const season = seasonOf(todayParis());
  const [rows, setRows] = useState<Row[]>(() => rowsFromPlan(events, season));
  const [bg, setBg] = useState(""); const [fmt, setFmt] = useState<Fmts>({}); const [sel, setSel] = useState("titre");
  const [add, setAdd] = useState(TEAM_CATS.find((c) => c.key.startsWith("sen-m"))?.key ?? TEAM_CATS[0].key); const [addN, setAddN] = useState(1);
  const title = "Fin de championnat", sub = `Saison ${season} – ${season + 1}`;
  const set = (id: string, p: Partial<Row>) => setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...p } : r)));
  const shown = shownOf(rows);
  const fmtItems: FmtItem[] = [
    { key: "entete", label: "Nom du club (bandeau du haut)", edit: true }, { key: "titre", label: "Titre", edit: true }, { key: "sous", label: "Sous-titre", edit: true },
    ...shown.flatMap((r) => { const kk = safe(r.id), nm = teamParts(r.team).join(" "); return [{ key: `eq-${kk}`, label: `${nm} · équipe`, edit: true }, { key: `ph-${kk}`, label: `${nm} · dernier match`, edit: true }, { key: `sc-${kk}`, label: `${nm} · score`, edit: true }, { key: `rk-${kk}`, label: `${nm} · classement`, edit: true }, { key: `is-${kk}`, label: `${nm} · montée / maintien`, edit: true }] as FmtItem[]; }),
    { key: "pied", label: "Message du bas", edit: true }, { key: "club", label: "Nom du club (bas)", edit: true }, { key: "mail", label: "E-mail (bas)", edit: true }, { key: "tout", label: "Tous les textes", sizeOnly: true },
  ];
  const inp = "w-14 rounded-md border-2 border-line bg-white px-2 py-2 text-center text-base font-extrabold text-ink";
  const selCls = "w-full rounded-md border-2 border-line bg-white px-2 py-2 text-sm font-bold text-ink";
  const addTeam = () => setRows((rs) => { const t = `${add}#${addN}`; return rs.some((r) => r.team === t) ? rs : [...rs, { id: uid(), team: t, club: "", h: "", a: "", rank: "", of: "", issue: "", home: "" as const }].sort((x, y) => order(x.team) - order(y.team)); });
  const ready = useMemo(() => shown.length, [shown.length]);
  return (
    <PosterStudio
      title="🏆 Affiche de fin de championnat" subtitle={`${sub} · ${ready} équipe${ready > 1 ? "s" : ""}`} onClose={onClose}
      formats={[{ id: "A4", label: "A4", w: POSTER_W, h: POSTER_H }]} format="A4" onFormat={() => {}}
      content={<>
        <Sec title="Mes équipes">
          <p className="mb-2 mt-0 text-xs text-muted">Les équipes du planning de la saison sont déjà là avec leur dernier match. Écris le score, puis le classement final. Une équipe sans classement ni score n'apparaît pas.</p>
          <div className="grid gap-2">
            {rows.length === 0 && <p className="m-0 rounded-md bg-[#fff3c4] p-2 text-xs font-bold text-ink">Aucun match par équipes dans le planning de cette saison : ajoute les équipes ci-dessous.</p>}
            {rows.map((r) => (
              <div key={r.id} className="rounded-md border-2 border-line bg-white p-2" style={{ borderLeftColor: teamCat(r.team)?.color ?? "#4a6d8f", borderLeftWidth: 6 }}>
                <div className="flex items-center justify-between gap-2 text-xs font-extrabold text-ink"><span>{teamParts(r.team).join(" · ")}</span><button type="button" className="font-bold text-muted underline" onClick={() => setRows((rs) => rs.filter((x) => x.id !== r.id))}>Retirer</button></div>
                <input className="mt-1 w-full rounded-md border-2 border-line bg-white px-2 py-1.5 text-sm text-ink" aria-label="Club du dernier match" placeholder="Club du dernier match (facultatif)" maxLength={60} value={r.club} onChange={(e) => set(r.id, { club: e.target.value })} />
                <div className="mt-1 flex items-center gap-2"><span className="text-xs font-bold text-muted">Houdan</span>
                  <input className={inp} inputMode="numeric" aria-label="Score de Houdan" maxLength={2} value={r.h} onChange={(e) => set(r.id, { h: e.target.value.replace(/\D/g, "") })} /><span className="font-extrabold">–</span>
                  <input className={inp} inputMode="numeric" aria-label="Score de l'adversaire" maxLength={2} value={r.a} onChange={(e) => set(r.id, { a: e.target.value.replace(/\D/g, "") })} /><span className="text-xs font-bold text-muted">Adversaire</span></div>
                <div className="mt-2 flex flex-wrap items-center gap-2"><span className="text-xs font-bold text-muted">Classé</span>
                  <input className={inp} inputMode="numeric" aria-label="Place au classement" maxLength={2} value={r.rank} onChange={(e) => set(r.id, { rank: e.target.value.replace(/\D/g, "") })} /><span className="text-xs font-bold text-muted">sur</span>
                  <input className={inp} inputMode="numeric" aria-label="Nombre d'équipes dans la poule" maxLength={2} value={r.of} onChange={(e) => set(r.id, { of: e.target.value.replace(/\D/g, "") })} />
                  <select className="min-w-28 flex-1 rounded-md border-2 border-line bg-white px-2 py-2 text-sm font-bold text-ink" aria-label="Issue de la saison" value={r.issue} onChange={(e) => set(r.id, { issue: e.target.value })}>{ISSUES.map((i) => <option key={i} value={i}>{i || "Montée, maintien… (facultatif)"}</option>)}</select></div>
              </div>
            ))}
          </div>
        </Sec>
        <Sec title="Ajouter une équipe">
          <div className="grid grid-cols-[minmax(0,1fr)_5rem] gap-2">
            <select className={selCls} aria-label="Catégorie" value={add} onChange={(e) => setAdd(e.target.value)}>{TEAM_CATS.map((c) => <option key={c.key} value={c.key}>{c.group.startsWith("Jeunes") ? c.label : `${c.group} · ${c.label}`}</option>)}</select>
            <select className={selCls} aria-label="Numéro d'équipe" value={addN} onChange={(e) => setAddN(+e.target.value)}>{[1, 2, 3, 4].map((n) => <option key={n} value={n}>Éq. {n}</option>)}</select>
          </div>
          <button type="button" className="mt-2 rounded-md border-2 border-line bg-white px-3 py-2 text-sm font-extrabold text-ink hover:border-ink" onClick={addTeam}>＋ Ajouter cette équipe</button>
        </Sec>
        {shown.length > 8 && <p className="rounded-md bg-[#fff3c4] p-2 text-xs font-bold text-ink">Il y a beaucoup d'équipes : le texte est petit.</p>}
      </>}
      bg={bg} onBg={setBg}
      fmt={{ items: fmtItems, value: fmt, onChange: setFmt, selected: sel, onSelect: setSel }}
      preview={({ pick }) => <ChampionnatPoster rows={rows} title={title} sub={sub} bg={bg} fmt={fmt} onPick={pick} />}
      printNode={<ChampionnatPoster rows={rows} title={title} sub={sub} bg={bg} fmt={fmt} />}
      fileBase={() => `affiche-fin-championnat-${season}`}
      save={{ kind: "local", text: "● Rien n'est enregistré : les résultats restent dans cette fenêtre" }}
    />
  );
}

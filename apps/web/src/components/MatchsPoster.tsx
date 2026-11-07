import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { addDays, ClubEvent, colorOf, DAYS, evOn, MONTHS, opponentOf, seasonOf, TEAM_CATS, teamCat, textOn, todayParis, venueOf, weekdayOf } from "../clubPlan";
import { Backdrop } from "./PosterBackdrop";
import { CourtLines } from "./CourtLines";
import { SERIF } from "./posterFonts";
import { POSTER_H, POSTER_W } from "./ClubPoster";
import { PosterStudio, Sec, Seg, Toggle } from "./PosterStudio";
import { teamParts, tidy } from "./posterCopy";
import { photoFromFile } from "./RecapPoster";

// Deux affiches de RÉSULTATS des matchs par équipes : celle du WEEK-END (toutes les équipes) et celle des JEUNES.
// Les rencontres viennent du planning (équipe, club rencontré, domicile ou déplacement) ; le coach écrit seulement les scores.
// Rien n'est enregistré. Aucun nom d'élève : seulement le club rencontré.
export type MatchMode = "weekend" | "jeunes";
type Item = { key: string; day: string; e: ClubEvent };
export type Score = { h: string; a: string; club: string; photo?: string }; // photo : photo de l'équipe (facultative), réduite dans le navigateur, jamais envoyée
const mLabel = (m: string) => `${MONTHS[+m.slice(5, 7) - 1]} ${m.slice(0, 4)}`;
const addMonth = (m: string, n: number) => { const t = +m.slice(0, 4) * 12 + (+m.slice(5, 7) - 1) + n; return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, "0")}`; };
const dn = (d: string) => (+d.slice(8, 10) === 1 ? "1er" : String(+d.slice(8, 10)));
const longDay = (d: string) => `${DAYS[weekdayOf(d)]} ${dn(d)} ${MONTHS[+d.slice(5, 7) - 1]}`;

export const isYouthMatch = (e: ClubEvent) => e.teams.length > 0 && e.teams.every((t) => (teamCat(t)?.group ?? "").startsWith("Jeunes"));
const order = (e: ClubEvent) => { const t = e.teams[0] ?? ""; const i = TEAM_CATS.findIndex((c) => c.key === t.split("#")[0]); return (i < 0 ? 99 : i) * 10 + (+(t.split("#")[1] ?? 1) || 1); };

export function matchesFor(events: ClubEvent[], opt: { mode: MatchMode; span: "weekend" | "mois"; sat: string; from: string; to: string; scope: "tous" | "jeunes" | "adultes"; withTentative: boolean }): Item[] {
  const base = events.filter((e) => e.kind === "EQUIPES" && (opt.withTentative || !e.tentative));
  let list: { day: string; e: ClubEvent }[] = [];
  if (opt.span === "weekend") {
    const sun = addDays(opt.sat, 1);
    for (const e of base) for (const d of [opt.sat, sun]) if (evOn(e, d)) list.push({ day: d, e });
  } else {
    const a = `${opt.from}-01`, b = `${opt.to}-31`;
    list = base.filter((e) => e.startDate <= b && e.endDate >= a).map((e) => ({ day: e.startDate < a ? a : e.startDate, e }));
  }
  if (opt.mode === "jeunes") list = list.filter((x) => isYouthMatch(x.e));
  else if (opt.scope === "jeunes") list = list.filter((x) => isYouthMatch(x.e));
  else if (opt.scope === "adultes") list = list.filter((x) => !isYouthMatch(x.e));
  return list.sort((x, y) => x.day.localeCompare(y.day) || order(x.e) - order(y.e)).map((x) => ({ key: x.e.id + "|" + x.day, day: x.day, e: x.e }));
}

const num = (v: string | undefined) => (v !== undefined && /^\d{1,2}$/.test(v.trim()) ? +v.trim() : null);
const resultOf = (s?: Score): "W" | "L" | "D" | null => { const h = num(s?.h), a = num(s?.a); if (h === null || a === null) return null; return h > a ? "W" : h < a ? "L" : "D"; };
const RES = { W: { c: "#2f6b4a", t: "VICTOIRE" }, L: { c: "#a3412a", t: "DÉFAITE" }, D: { c: "#6b6558", t: "MATCH NUL" } };

const Logo = ({ size, style }: { size: number; style?: React.CSSProperties }) => (
  <span aria-hidden style={{ display: "inline-block", width: size, height: size, background: "#fff", WebkitMask: "url(/logo-tch.png) center / contain no-repeat", mask: "url(/logo-tch.png) center / contain no-repeat", ...style }} />
);

export function MatchsPoster({ list, scores, mode, title, sub, bg = "" }: { list: Item[]; scores: Record<string, Score>; mode: MatchMode; title: string; sub: string; bg?: string }) {
  const shown = list.filter((x) => resultOf(scores[x.key]) !== null);
  const days: { d: string; items: Item[] }[] = [];
  for (const x of shown) { const g = days.find((y) => y.d === x.day); g ? g.items.push(x) : days.push({ d: x.day, items: [x] }); }
  const anyPhoto = shown.some((x) => !!scores[x.key].photo);
  const n = shown.length, HEAD = 230, FOOT = 96, avail = POSTER_H - HEAD - FOOT - 56;
  const wins = shown.filter((x) => resultOf(scores[x.key]) === "W").length, losses = shown.filter((x) => resultOf(scores[x.key]) === "L").length, draws = n - wins - losses;
  const sum = [wins && `${wins} victoire${wins > 1 ? "s" : ""}`, draws && `${draws} nul${draws > 1 ? "s" : ""}`, losses && `${losses} défaite${losses > 1 ? "s" : ""}`].filter(Boolean).join(" · ");
  const box = useRef<HTMLDivElement>(null);
  const [k, setK] = useState(1);
  const [tick, setTick] = useState(0);
  useEffect(() => { let on = true; (document as any).fonts?.ready?.then(() => { if (on) setTick((x) => x + 1); }); return () => { on = false; }; }, []);
  const sig = shown.map((x) => x.key + JSON.stringify({ ...scores[x.key], photo: scores[x.key].photo ? scores[x.key].photo!.length : 0 })).join("|");
  useLayoutEffect(() => {
    const el = box.current; if (!el) return;
    el.style.zoom = "1";
    const h = el.scrollHeight;
    let nk = h > 0 ? Math.max(0.4, Math.min(n < 6 ? 1.7 : 1.4, (avail * 0.97) / h)) : 1;
    el.style.zoom = String(nk); // posé tout de suite : une 2e mesure ne doit pas laisser le zoom à 1
    // agrandi, le texte peut passer à la ligne : on vérifie la vraie hauteur et on réduit un peu tant que ça dépasse
    for (let i = 0; i < 14 && nk > 0.4 && el.getBoundingClientRect().height > avail * 0.97; i++) { nk *= 0.96; el.style.zoom = String(nk); }
    setK(nk);
  }, [sig, avail, n, tick]);
  return (
    <div style={{ position: "relative", width: POSTER_W, height: POSTER_H, background: "#fbf8f1", overflow: "hidden", fontFamily: "Archivo, 'Atkinson Hyperlegible', system-ui, sans-serif", color: "#17140f", fontVariantNumeric: "lining-nums" }}>
      <Backdrop bg={bg} w={POSTER_W} h={POSTER_H} veil="strong" />
      <div style={{ position: "relative", height: HEAD, background: "linear-gradient(135deg,#2b261d 0%,#17140f 60%)", color: "#fff", overflow: "hidden", clipPath: "polygon(0 0,100% 0,100% 90%,0 100%)" }}>
        <svg aria-hidden width={POSTER_W} height={HEAD} viewBox={`0 0 ${POSTER_W} ${HEAD}`} style={{ position: "absolute", inset: 0, opacity: 0.2 }} fill="none" stroke="#c9ad77" strokeWidth="4"><CourtLines cx={397} y={18} h={186} netWidth={6} /></svg>
        <Logo size={130} style={{ position: "absolute", right: 34, top: 22 }} />
        <div style={{ position: "absolute", left: 52, top: 30, right: 190 }}>
          <div style={{ fontSize: 24, fontWeight: 800, letterSpacing: "0.22em" }}>TENNIS CLUB HOUDAN</div>
          <div style={{ fontFamily: SERIF, fontSize: 56, fontWeight: 900, lineHeight: 1, marginTop: 10, whiteSpace: "nowrap" }}>{title}</div>
          <div style={{ fontFamily: SERIF, fontSize: 32, fontWeight: 700, fontStyle: "italic", marginTop: 6, color: "#e8d9a8", whiteSpace: "nowrap" }}>{sub}</div>
        </div>
      </div>
      <div style={{ position: "absolute", left: 44, right: 44, top: HEAD + 20, bottom: FOOT + 12, display: "flex", flexDirection: "column", justifyContent: "center" }}><div ref={box} style={{ zoom: k }}>
        {sum && <div style={{ textAlign: "center", margin: "4px 0 2px" }}><span style={{ display: "inline-block", background: "#17140f", color: "#e8d9a8", fontSize: 18, fontWeight: 900, letterSpacing: "0.12em", textTransform: "uppercase", padding: "6px 18px" }}>{sum}</span></div>}
        {n === 0 && <p style={{ textAlign: "center", fontSize: 24, color: "#6b6558" }}>Écris les scores dans le menu de gauche : les résultats s'affichent ici.</p>}
        {days.map((g) => (
          <section key={g.d}>
            <div style={{ display: "flex", alignItems: "center", gap: 14, margin: "12px 0 6px" }}>
              <span style={{ fontFamily: SERIF, fontSize: 34, fontWeight: 900, letterSpacing: "0.04em", color: "#8a6a2c", whiteSpace: "nowrap" }}>{longDay(g.d).toUpperCase()}</span>
              <span style={{ flex: 1, height: 2, background: "#c9ad77" }} />
            </div>
            {g.items.map((x) => {
              const e = x.e, sc = scores[x.key], r = resultOf(sc)!, c = colorOf({ ...e, tentative: false }), club = tidy(sc.club).replace(/^(TC|AS|US|CT|ASPTT|SC)\s/i, "$1\u00a0"), v = venueOf(e);
              const parts = e.teams.map((t) => teamParts(t));
              const verbe = r === "W" ? (club ? `TC Houdan bat ${club}` : "TC Houdan s'impose") : r === "L" ? (club ? `TC Houdan perd contre ${club}` : "TC Houdan s'incline") : (club ? `TC Houdan fait match nul contre ${club}` : "Match nul");
              return (
                <div key={x.key} style={{ display: "flex", alignItems: "stretch", gap: 14, padding: "7px 0", borderBottom: "1px solid #e4dccb" }}>
                  <div style={{ flex: "0 0 auto", width: anyPhoto ? 185 : 225, background: c, color: textOn(c), borderRadius: 8, padding: "7px 12px", display: "flex", flexDirection: "column", justifyContent: "center" }}>
                    {parts.length ? parts.map(([cat, nm], i) => (
                      <div key={i} style={{ lineHeight: 1.1 }}>
                        <div style={{ fontSize: 19, fontWeight: 900 }}>{cat}</div>
                        <div style={{ fontFamily: SERIF, fontSize: 24, fontWeight: 900 }}>{nm}</div>
                      </div>
                    )) : <div style={{ fontSize: 19, fontWeight: 900 }}>{e.title || "Match par équipes"}</div>}
                  </div>
                  <div style={{ minWidth: 0, flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", gap: 5 }}>
                    <div style={{ fontSize: anyPhoto ? 20 : 22, fontWeight: 900, lineHeight: 1.15 }}>{verbe}</div>
                    {v && <div><span style={{ background: v === "home" ? "#2f6b4a" : "#4a6d8f", color: "#fff", fontSize: 12, fontWeight: 900, letterSpacing: "0.05em", textTransform: "uppercase", padding: "2px 8px", whiteSpace: "nowrap" }}>{v === "home" ? "À domicile" : "En déplacement"}</span></div>}
                  </div>
                  {sc.photo && <div style={{ flex: "0 0 auto", width: 118, minHeight: 78, borderRadius: 8, overflow: "hidden", background: `#e4dccb url(${sc.photo}) center / cover no-repeat` }} role="img" aria-label="Photo de l'équipe" />}
                  <div style={{ flex: "0 0 auto", width: anyPhoto ? 112 : 128, background: RES[r].c, color: "#fff", borderRadius: 8, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "4px 6px" }}>
                    <div style={{ fontFamily: SERIF, fontSize: anyPhoto ? 40 : 46, fontWeight: 900, lineHeight: 1, whiteSpace: "nowrap" }}>{num(sc.h)}–{num(sc.a)}</div>
                    <div style={{ fontSize: 12, fontWeight: 900, letterSpacing: "0.12em", marginTop: 3 }}>{RES[r].t}</div>
                  </div>
                </div>
              );
            })}
          </section>
        ))}
      </div></div>
      <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: FOOT, background: "#17140f", color: "#fff", padding: "14px 40px", display: "flex", alignItems: "center", gap: 14 }}>
        <Logo size={44} />
        <div style={{ whiteSpace: "nowrap" }}>
          <div style={{ fontWeight: 900, fontSize: 20, letterSpacing: "0.04em" }}>Tennis Club Houdan</div>
          <div style={{ fontSize: 14, fontWeight: 800, color: "#dfcb98" }}>✉️ tennisclubhoudan@gmail.com</div>
        </div>
        <div style={{ marginLeft: "auto", fontFamily: SERIF, fontStyle: "italic", fontSize: 22, color: "#e8d9a8", whiteSpace: "nowrap" }}>Bravo à tous nos joueurs !</div>
      </div>
    </div>
  );
}

// le week-end en cours ou celui qui vient de finir : c'est là qu'on a les résultats
const lastSaturday = () => { const t = todayParis(), w = weekdayOf(t); return w === 5 || w === 6 ? addDays(t, -(w - 5)) : addDays(t, -(w + 2)); };

export function MatchsModal({ events, mode, onClose }: { events: ClubEvent[]; mode: MatchMode; onClose: () => void }) {
  const s = seasonOf(todayParis());
  const [sat, setSat] = useState(lastSaturday());
  const [span, setSpan] = useState<"weekend" | "mois">("weekend");
  const [scope, setScope] = useState<"tous" | "jeunes" | "adultes">("tous");
  const cur = todayParis().slice(0, 7);
  const [from, setFrom] = useState(cur);
  const [to, setTo] = useState(cur);
  const [withTentative, setWithTentative] = useState(false);
  const [bg, setBg] = useState("");
  const [typed, setTyped] = useState<Record<string, Score>>({});
  const months = Array.from({ length: 12 }, (_, i) => addMonth(`${s}-09`, i));
  const list = useMemo(() => matchesFor(events, { mode, span: mode === "weekend" ? "weekend" : span, sat, from, to, scope, withTentative }), [events, mode, span, sat, from, to, scope, withTentative]);
  // scores saisis, avec le club du planning par défaut
  const scores = useMemo(() => Object.fromEntries(list.map((x) => [x.key, typed[x.key] ?? { h: "", a: "", club: opponentOf(x.e) }])) as Record<string, Score>, [list, typed]);
  const sun = addDays(sat, 1);
  const wkLabel = sat.slice(5, 7) === sun.slice(5, 7) ? `Week-end du ${dn(sat)} et ${dn(sun)} ${MONTHS[+sat.slice(5, 7) - 1].toLowerCase()}` : `Week-end du ${dn(sat)} ${MONTHS[+sat.slice(5, 7) - 1].toLowerCase()} et ${dn(sun)} ${MONTHS[+sun.slice(5, 7) - 1].toLowerCase()}`;
  const period = from === to ? mLabel(from) : `${MONTHS[+from.slice(5, 7) - 1]} – ${mLabel(to)}`;
  const byWeekend = mode === "weekend" || span === "weekend";
  const title = mode === "weekend" ? "Résultats du week-end" : "Résultats équipes jeunes";
  const sub = byWeekend ? wkLabel : period;
  const setS = (key: string, p: Partial<Score>) => setTyped((o) => ({ ...o, [key]: { ...scores[key], ...o[key], ...p } }));
  const [msg, setMsg] = useState("");
  const addPhoto = async (key: string, f: File) => { setMsg(""); try { setS(key, { photo: await photoFromFile(f) }); } catch (x) { setMsg((x as Error).message); } };
  const done = list.filter((x) => resultOf(scores[x.key]) !== null).length;
  const sel = "w-full rounded-md border-2 border-line bg-white px-2 py-2 text-sm font-bold text-ink";
  const arrow = "rounded-md border-2 border-line bg-white px-4 py-2 text-lg font-extrabold text-ink hover:border-ink";
  const inp = "w-16 rounded-md border-2 border-line bg-white px-2 py-2 text-center text-lg font-extrabold text-ink";
  return (
    <PosterStudio
      title={mode === "weekend" ? "🎾 Affiche des résultats du week-end" : "🧒 Affiche des résultats des équipes jeunes"}
      subtitle={`${sub} · ${done} résultat${done > 1 ? "s" : ""} sur ${list.length} match${list.length > 1 ? "s" : ""}`} onClose={onClose}
      formats={[{ id: "A4", label: "A4", w: POSTER_W, h: POSTER_H }]} format="A4" onFormat={() => {}}
      content={<>
        {mode === "jeunes" && (
          <Sec title="Quand ?">
            <Seg label="Période" value={span} options={[{ id: "weekend", label: "Un week-end" }, { id: "mois", label: "Un ou plusieurs mois" }]} onChange={setSpan} />
          </Sec>
        )}
        {byWeekend ? (
          <Sec title="Quel week-end ?">
            <div className="flex items-center gap-2">
              <button type="button" className={arrow} aria-label="Week-end précédent" onClick={() => setSat(addDays(sat, -7))}>‹</button>
              <div className="min-w-0 flex-1 text-center text-sm font-extrabold text-ink">{wkLabel}</div>
              <button type="button" className={arrow} aria-label="Week-end suivant" onClick={() => setSat(addDays(sat, 7))}>›</button>
            </div>
            <button type="button" className="mt-2 text-xs font-bold text-muted underline" onClick={() => setSat(lastSaturday())}>Revenir au dernier week-end</button>
          </Sec>
        ) : (
          <Sec title="Quelle période ?">
            <div className="grid grid-cols-2 gap-2">
              <label className="text-xs font-extrabold text-ink">Du mois de
                <select className={sel} value={from} onChange={(e) => { setFrom(e.target.value); if (e.target.value > to) setTo(e.target.value); }}>{months.map((m) => <option key={m} value={m}>{mLabel(m)}</option>)}</select></label>
              <label className="text-xs font-extrabold text-ink">Au mois de
                <select className={sel} value={to} onChange={(e) => { setTo(e.target.value); if (e.target.value < from) setFrom(e.target.value); }}>{months.map((m) => <option key={m} value={m}>{mLabel(m)}</option>)}</select></label>
            </div>
          </Sec>
        )}
        {mode === "weekend" && (
          <Sec title="Quelles équipes ?">
            <Seg label="Équipes" value={scope} options={[{ id: "tous", label: "Toutes" }, { id: "jeunes", label: "🧒 Jeunes" }, { id: "adultes", label: "🎾 Adultes" }]} onChange={setScope} />
          </Sec>
        )}
        <details className="rounded-md bg-[#fff4cc] p-3 text-sm text-[#6b4e00]">
          <summary role="note" className="cursor-pointer font-bold">⚠️ Photos d'équipes : seulement les enfants dont les parents ont donné le droit à l'image</summary>
          <p className="m-0 mt-2">Rubrique « Mes autorisations » de leur famille. Les photos restent dans cette fenêtre : elles ne sont ni envoyées ni enregistrées, il faudra les remettre si tu fermes.</p>
        </details>
        {msg && <p className="m-0 text-sm font-bold text-ink" role="status">{msg}</p>}
        <Sec title="Les scores">
          {list.length === 0 && <p className="m-0 rounded-md bg-[#fff3c4] p-2 text-xs font-bold text-ink">Aucun match par équipes sur cette période dans le planning. Vérifie les dates, ou ajoute les matchs au planning.</p>}
          <p className="mb-2 mt-0 text-xs text-muted">Écris le score de TC Houdan puis celui de l'adversaire. Un match sans score n'apparaît pas sur l'affiche.</p>
          <div className="grid gap-2">
            {list.map((x) => {
              const sc = scores[x.key], r = resultOf(sc), parts = x.e.teams.map((t) => teamParts(t).join(", "));
              return (
                <div key={x.key} className="rounded-md border-2 border-line bg-white p-2" style={{ borderLeftColor: colorOf({ ...x.e, tentative: false }), borderLeftWidth: 6 }}>
                  <div className="text-xs font-extrabold text-ink">{longDay(x.day)} · {parts.join(" + ") || x.e.title || "Match par équipes"}</div>
                  <input className="mt-1 w-full rounded-md border-2 border-line bg-white px-2 py-1.5 text-sm text-ink" aria-label="Club rencontré" placeholder="Club rencontré (facultatif)" maxLength={60} value={sc.club} onChange={(ev) => setS(x.key, { club: ev.target.value })} />
                  <div className="mt-1 flex items-center gap-2">
                    <span className="text-xs font-bold text-muted">Houdan</span>
                    <input className={inp} inputMode="numeric" aria-label="Score de Houdan" maxLength={2} value={sc.h} onChange={(ev) => setS(x.key, { h: ev.target.value.replace(/\D/g, "") })} />
                    <span className="font-extrabold">–</span>
                    <input className={inp} inputMode="numeric" aria-label="Score de l'adversaire" maxLength={2} value={sc.a} onChange={(ev) => setS(x.key, { a: ev.target.value.replace(/\D/g, "") })} />
                    <span className="text-xs font-bold text-muted">Adversaire</span>
                    {r && <span className="ml-auto text-[11px] font-black tracking-wider" style={{ color: RES[r].c }}>{RES[r].t}</span>}
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    {sc.photo && <img src={sc.photo} alt="Photo de l'équipe" className="h-12 w-16 rounded object-cover" />}
                    <label className="cursor-pointer rounded-md border-2 border-line bg-white px-3 py-2 text-xs font-extrabold text-ink hover:border-ink">
                      📷 {sc.photo ? "Changer la photo" : "Ajouter la photo de l'équipe"}
                      <input type="file" accept="image/*" className="sr-only" aria-label="Photo de l'équipe" onChange={(ev) => { const f = ev.target.files?.[0]; ev.target.value = ""; if (f) addPhoto(x.key, f); }} />
                    </label>
                    {sc.photo && <button type="button" className="text-xs font-bold text-muted underline" onClick={() => setS(x.key, { photo: "" })}>Retirer</button>}
                  </div>
                </div>
              );
            })}
          </div>
        </Sec>
        <Sec title="Matchs à confirmer"><Toggle on={withTentative} onChange={setWithTentative} label="⏳ Montrer aussi les matchs prévisionnels" hint="Ils apparaissent dans la liste des scores" /></Sec>
        {list.length > 10 && <p className="rounded-md bg-[#fff3c4] p-2 text-xs font-bold text-ink">Il y a beaucoup de matchs : le texte est petit. Choisis moins de matchs pour une affiche plus lisible.</p>}
      </>}
      bg={bg} onBg={setBg}
      preview={() => <MatchsPoster list={list} scores={scores} mode={mode} title={title} sub={sub} bg={bg} />}
      printNode={<MatchsPoster list={list} scores={scores} mode={mode} title={title} sub={sub} bg={bg} />}
      fileBase={() => (byWeekend ? `affiche-resultats-${mode === "jeunes" ? "jeunes-" : ""}weekend-${sat}` : `affiche-resultats-jeunes-${from}-${to}`)}
      save={{ kind: "local", text: "● Rien n'est enregistré : les scores restent dans cette fenêtre" }}
    />
  );
}

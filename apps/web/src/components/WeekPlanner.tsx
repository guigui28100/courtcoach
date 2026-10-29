import { useEffect, useMemo, useRef, useState } from "react";
import { get, put } from "../api";
import { adultName, Lesson, todayIso } from "../types";
import { ClubEvent, colorOf, kindOf as evKind, titleOf } from "../clubPlan";
import { check, clashing, CourseKind, DAY_END, DAY_START, DURATION, endOf, hm, hmFull, PlanBlock, snap, STEP, toMin, toTime } from "../weekPlan";

const DAYS = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];
const ROW = 28; // hauteur dessinée d'une demi-heure (en pixels) : 1 h 30 = 3 unités = 84 px
const ROWS = (DAY_END - DAY_START) / STEP;
const px = (minutes: number) => (minutes / STEP) * ROW;

// Les 3 types de cours du club qu'on glisse dans le planning (les cours particuliers apparaissent tout seuls dans l'agenda)
const KINDS: { k: CourseKind; label: string; bg: string }[] = [
  { k: "ADULTES", label: "Cours adultes", bg: "#2f5f9e" },
  { k: "COMPETITION", label: "Compétition jeunes", bg: "#6f4b9e" },
  { k: "ECOLE", label: "École de tennis", bg: "#c2561f" },
];
const kindOf = (k?: CourseKind) => KINDS.find((x) => x.k === k);
const dur = (k: CourseKind) => (DURATION[k] % 60 ? `${Math.floor(DURATION[k] / 60)} h ${DURATION[k] % 60}` : `${DURATION[k] / 60} h`);

interface Saved { weekday: number; start: string; end: string; label: string; kind?: string }
interface Drag { kind: CourseKind; id?: string; offY: number; x: number; y: number; sx: number; sy: number; moved: boolean }
const addD = (date: string, n: number) => new Date(new Date(`${date}T12:00:00Z`).getTime() + n * 86_400_000).toISOString().slice(0, 10);
const mondayOf = (date: string) => addD(date, -((new Date(`${date}T12:00:00Z`).getUTCDay() + 6) % 7));
const MONTHS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
const PRIV_MIN = 60; // un cours particulier dure 1 h (affichage seulement : il vient des réservations des adultes)
let uid = 0;
const newId = () => `b${++uid}`;

// Le coach (ou le président) glisse un type de cours dans la semaine d'un entraîneur : la durée, l'heure de fin et la hauteur se calculent toutes seules.
export function WeekPlanner({ id, name }: { id: string; name: string }) {
  const [blocks, setBlocks] = useState<PlanBlock[]>([]);
  const [ready, setReady] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [pick, setPick] = useState<CourseKind | null>(null); // type choisi par un simple toucher : on touche ensuite le planning
  const [drag, setDrag] = useState<Drag | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const dragRef = useRef<Drag | null>(null);
  const blocksRef = useRef<PlanBlock[]>([]);
  blocksRef.current = blocks;
  const cols = useRef<(HTMLDivElement | null)[]>([]);
  // Cours particuliers du prof (réservés ou confirmés) : on les VOIT dans la semaine choisie, sans pouvoir les modifier
  const [monday, setMonday] = useState(() => mondayOf(todayIso()));
  const [priv, setPriv] = useState<Lesson[]>([]);
  useEffect(() => { get<Lesson[]>("/lessons").then((all) => setPriv(all.filter((l) => l.profId === id && l.finalSlot && (l.status === "BOOKED" || l.status === "ACCEPTED")))).catch(() => setPriv([])); }, [id]);
  // Événements du planning du club où ce prof est affecté : montrés au-dessus de chaque jour concerné (lecture seule : ils se gèrent dans « Planning du club »)
  const [evs, setEvs] = useState<ClubEvent[]>([]);
  useEffect(() => { get<ClubEvent[]>(`/club/events-of/${id}`).then(setEvs).catch(() => setEvs([])); }, [id]);
  const weekDates = Array.from({ length: 7 }, (_, i) => addD(monday, i));
  const privBlocks = priv.filter((l) => weekDates.includes(l.finalSlot!.date)).map((l) => ({ l, weekday: weekDates.indexOf(l.finalSlot!.date), start: toMin(l.finalSlot!.time), end: toMin(l.finalSlot!.time) + PRIV_MIN }));
  const privClash = (b: PlanBlock) => privBlocks.find((p) => p.weekday === b.weekday && p.start < b.end && p.end > b.start);

  useEffect(() => {
    get<Saved[]>(`/club/schedule/${id}`).then((list) => {
      setBlocks(list.map((c) => ({ id: newId(), weekday: c.weekday, start: toMin(c.start), end: toMin(c.end), label: c.label, kind: kindOf(c.kind as CourseKind) ? (c.kind as CourseKind) : undefined })));
      setReady(true);
    }).catch((e) => setMsg({ ok: false, text: (e as Error).message }));
  }, [id]);

  // Où tombe le pointeur ? jour (colonne) et heure de début arrondie à la demi-heure ; pour un cours déjà posé, on garde l'endroit où on l'a attrapé
  function locate(x: number, y: number, offY: number): { weekday: number; start: number } | null {
    for (let i = 0; i < 7; i++) {
      const r = cols.current[i]?.getBoundingClientRect();
      if (r && x >= r.left && x < r.right) return { weekday: i, start: snap(DAY_START + ((y - offY - r.top) / ROW) * STEP) };
    }
    return null;
  }
  const verdict = (kind: CourseKind, at: { weekday: number; start: number }, ignoreId?: string) => check(blocksRef.current, at.weekday, at.start, endOf(at.start, kind), ignoreId);

  function place(kind: CourseKind, at: { weekday: number; start: number }, ignoreId?: string) {
    const v = verdict(kind, at, ignoreId);
    if (!v.ok) { setMsg({ ok: false, text: `${v.reason} Rien n'a changé.` }); return; }
    const end = endOf(at.start, kind);
    setBlocks((b) => (ignoreId ? b.map((x) => (x.id === ignoreId ? { ...x, weekday: at.weekday, start: at.start, end } : x)) : [...b, { id: newId(), weekday: at.weekday, start: at.start, end, kind, label: kindOf(kind)!.label }]));
    setDirty(true);
    setMsg({ ok: true, text: `${kindOf(kind)!.label} : ${DAYS[at.weekday].toLowerCase()} de ${hm(at.start)} à ${hm(end)}. Pense à enregistrer.` });
  }

  function begin(e: React.PointerEvent, kind: CourseKind, blockId?: string, offY = 0) {
    if (e.button !== 0) return;
    e.preventDefault();
    const d: Drag = { kind, id: blockId, offY, x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, moved: false };
    dragRef.current = d; setDrag(d); setMsg(null);
    const move = (ev: PointerEvent) => {
      const c = dragRef.current; if (!c) return;
      c.x = ev.clientX; c.y = ev.clientY;
      if (!c.moved && Math.hypot(c.x - c.sx, c.y - c.sy) > 5) c.moved = true;
      setDrag({ ...c });
      if (ev.clientY < 90) window.scrollBy(0, -14); else if (ev.clientY > window.innerHeight - 90) window.scrollBy(0, 14); // défilement de la page près du bord
    };
    const up = (ev: PointerEvent) => {
      window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); window.removeEventListener("pointercancel", cancel);
      const c = dragRef.current; dragRef.current = null; setDrag(null);
      if (!c) return;
      if (!c.moved) { if (!c.id) setPick((p) => (p === c.kind ? null : c.kind)); return; } // un simple toucher choisit le type
      const at = locate(ev.clientX, ev.clientY, c.offY);
      if (!at) { setMsg({ ok: false, text: "Dépose le cours dans une colonne de jour du planning. Rien n'a changé." }); return; }
      place(c.kind, at, c.id);
    };
    const cancel = () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); window.removeEventListener("pointercancel", cancel); dragRef.current = null; setDrag(null); };
    window.addEventListener("pointermove", move); window.addEventListener("pointerup", up); window.addEventListener("pointercancel", cancel);
  }

  // Aperçu pendant qu'on glisse : où ira le cours, jusqu'à quelle heure, et est-ce possible ?
  const preview = useMemo(() => {
    if (!drag?.moved) return null;
    const at = locate(drag.x, drag.y, drag.offY);
    if (!at) return null;
    const v = verdict(drag.kind, at, drag.id);
    return { ...at, end: endOf(at.start, drag.kind), ok: v.ok, reason: v.ok ? "" : v.reason };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drag]);

  function remove(b: PlanBlock) { setBlocks((x) => x.filter((y) => y.id !== b.id)); setDirty(true); setMsg({ ok: true, text: `« ${b.label || "Cours"} » retiré. Pense à enregistrer.` }); }

  async function save() {
    setMsg(null);
    const bad = clashing(blocks);
    if (bad.size) { setMsg({ ok: false, text: "Deux cours se chevauchent (cadre rouge) : déplace ou supprime l'un des deux avant d'enregistrer." }); return; }
    const items: Saved[] = blocks.map((b) => ({ weekday: b.weekday, start: toTime(b.start), end: toTime(b.end), label: b.label, ...(b.kind ? { kind: b.kind } : {}) }));
    try { await put(`/club/schedule/${id}`, { items }); setDirty(false); setMsg({ ok: true, text: "Enregistré ✓ Il le voit dans « Ton agenda »." }); } catch (x) { setMsg({ ok: false, text: (x as Error).message }); }
  }

  const bad = useMemo(() => clashing(blocks), [blocks]);
  const labels = Array.from({ length: ROWS }, (_, i) => DAY_START + i * STEP);

  return (
    <div className="grid gap-3 rounded border-2 border-line bg-[#faf7ef] p-3 sm:p-4">
      <div>
        <h3 className="m-0 text-lg">🗓️ Planning de {name}</h3>
        <p className="m-0 mt-1 text-sm text-muted">Attrape un type de cours ci-dessous et glisse-le dans la semaine : il commence à l'heure ou à la demi-heure où tu le lâches, et sa fin se calcule toute seule. Tu peux aussi déplacer un cours déjà posé. Plus de glisser ? Touche un type, puis touche le planning.</p>
      </div>

      <div className="flex flex-wrap items-stretch gap-2" role="group" aria-label="Types de cours à glisser">
        {KINDS.map((t) => (
          <div key={t.k} role="button" tabIndex={0} aria-pressed={pick === t.k} aria-label={`${t.label}, ${dur(t.k)} : glisse-le dans le planning ou touche-le puis touche le planning`}
            onPointerDown={(e) => begin(e, t.k)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setPick((p) => (p === t.k ? null : t.k)); } }}
            className="flex min-w-[9.5rem] cursor-grab select-none items-center gap-2 rounded border-2 px-3 py-2 font-bold text-white shadow-sm active:cursor-grabbing"
            style={{ background: t.bg, borderColor: pick === t.k ? "#17140f" : t.bg, outline: pick === t.k ? "3px solid #c9ad77" : "none", touchAction: "none" }}>
            <span aria-hidden="true">⠿</span><span className="grid leading-tight">{t.label}<small className="font-normal opacity-90">{dur(t.k)}</small></span>
          </div>
        ))}
        <p className="m-0 self-center text-sm text-muted">{pick ? <>👆 <b>{kindOf(pick)!.label}</b> choisi : touche l'endroit du planning où il commence.</> : "↓ Glisse un type dans la semaine."}</p>
      </div>

      <div className="flex flex-wrap items-center gap-2" aria-label="Semaine affichée">
        <button type="button" className="btn-outline btn-sm bg-white hover:bg-ink hover:text-white" aria-label="Semaine précédente" onClick={() => setMonday((m) => addD(m, -7))}>‹</button>
        <b className="min-w-[13rem] text-center text-sm">Semaine du {Number(weekDates[0].slice(8, 10))} au {Number(weekDates[6].slice(8, 10))} {MONTHS[Number(weekDates[6].slice(5, 7)) - 1]}</b>
        <button type="button" className="btn-outline btn-sm bg-white hover:bg-ink hover:text-white" aria-label="Semaine suivante" onClick={() => setMonday((m) => addD(m, 7))}>›</button>
        <button type="button" className="btn-outline btn-sm bg-white hover:bg-ink hover:text-white" onClick={() => setMonday(mondayOf(todayIso()))}>Cette semaine</button>
        <span className="text-xs text-muted">Les cours du club se répètent chaque semaine. Les cours particuliers (🎾 jaune / vert) sont à voir seulement : ils viennent des réservations.</span>
      </div>
      {!ready ? (msg ? <p role="alert" className="m-0 font-bold text-bad">{msg.text}</p> : <div className="skeleton h-24" role="status" aria-label="Chargement en cours" />) : (
        <div className="overflow-x-auto">
          <div className="min-w-[720px]" style={{ display: "grid", gridTemplateColumns: "3.6rem repeat(7, minmax(0, 1fr))", columnGap: 4 }}>
            <div />
            {DAYS.map((d, i) => <div key={d} className="rounded bg-ink px-1 py-1.5 text-center text-sm font-bold leading-tight text-white">{d.slice(0, 3)}<span className="max-sm:hidden">{d.slice(3)}</span><small className="block font-normal opacity-80">{Number(weekDates[i].slice(8, 10))} {MONTHS[Number(weekDates[i].slice(5, 7)) - 1].slice(0, 4)}.</small></div>)}
            <div className="self-center text-right text-[11px] font-bold leading-tight text-muted" title="Événements du club où ce prof est affecté" aria-hidden="true">🏆</div>
            {weekDates.map((dt, i) => {
              const here = evs.filter((e) => e.startDate <= dt && e.endDate >= dt);
              return (
                <div key={dt} className="grid min-h-8 content-start gap-0.5" aria-label={here.length ? `${DAYS[i]} : ${here.map((e) => titleOf(e)).join(", ")}` : undefined}>
                  {here.map((e) => <span key={e.id} title={`${titleOf(e)}${e.time ? ` · ${e.time}` : ""}${e.place ? ` · ${e.place}` : ""}`} className="truncate rounded px-1 py-0.5 text-[11px] font-bold leading-tight text-white" style={{ background: colorOf(e) }}>{evKind(e.kind).icon} {titleOf(e)}</span>)}
                </div>
              );
            })}
            {/* axe des heures : une graduation toutes les demi-heures, alignée sur les cours */}
            <div className="relative select-none" style={{ height: ROWS * ROW }} aria-hidden="true">
              {labels.map((m, i) => <span key={m} className={"absolute right-1 text-[11px] leading-none " + (m % 60 ? "text-muted" : "font-bold text-ink")} style={{ top: i * ROW - 5 }}>{hmFull(m)}</span>)}
            </div>
            {DAYS.map((d, wd) => (
              <div key={d} ref={(el) => { cols.current[wd] = el; }} role="group" aria-label={d}
                onClick={(e) => { if (pick && e.target === e.currentTarget) { const at = locate(e.clientX, e.clientY, 0); if (at) place(pick, at); } }}
                className={"relative overflow-hidden rounded border border-line bg-white " + (pick ? "cursor-copy" : "")}
                style={{ height: ROWS * ROW, backgroundImage: `repeating-linear-gradient(to bottom, #d8cfbb 0, #d8cfbb 1px, transparent 1px, transparent ${ROW * 2}px), repeating-linear-gradient(to bottom, #efe9da 0, #efe9da 1px, transparent 1px, transparent ${ROW}px)` }}>
                {blocks.filter((b) => b.weekday === wd).map((b) => {
                  const t = kindOf(b.kind); const moving = drag?.moved && drag.id === b.id;
                  return (
                    <div key={b.id} onPointerDown={t ? (e) => { const r = (e.currentTarget as HTMLElement).getBoundingClientRect(); begin(e, b.kind!, b.id, e.clientY - r.top); } : undefined}
                      className={"absolute inset-x-0.5 overflow-hidden rounded px-1.5 py-1 text-xs font-bold text-white shadow " + (t ? "cursor-grab active:cursor-grabbing" : "") + (moving ? " opacity-30" : "")}
                      style={{ top: px(b.start - DAY_START), height: px(b.end - b.start) - 2, background: t?.bg ?? "#6b6455", outline: bad.has(b.id) ? "3px solid #d92d20" : "none", outlineOffset: -1, touchAction: t ? "none" : "auto" }}
                      aria-label={`${b.label || "Cours"}, ${d}, de ${hm(b.start)} à ${hm(b.end)}`}>
                      <span className="block pr-4 leading-tight">{b.label || "Cours"}</span>
                      <span className="block font-normal opacity-95">{hm(b.start)} – {hm(b.end)}</span>
                      <button type="button" aria-label={`Supprimer ${b.label || "ce cours"} du ${d.toLowerCase()} à ${hm(b.start)}`} onPointerDown={(e) => e.stopPropagation()} onClick={(e) => { e.stopPropagation(); remove(b); }}
                        className="absolute right-0.5 top-0.5 grid size-5 place-items-center rounded bg-black/30 text-[11px] leading-none text-white hover:bg-black/60">✕</button>
                    </div>
                  );
                })}
                {privBlocks.filter((p) => p.weekday === wd).map((p) => (
                  <div key={p.l.id} aria-label={`Cours particulier${p.l.status === "BOOKED" ? " à confirmer" : ""}, ${d}, de ${hm(p.start)} à ${hm(p.end)}, ${adultName(p.l.member, "adhérent")}`} title="Cours particulier : à voir seulement"
                    className="pointer-events-none absolute inset-x-1 z-[5] overflow-hidden rounded border-2 px-1 py-0.5 text-[11px] font-bold leading-tight"
                    style={{ top: px(p.start - DAY_START), height: px(PRIV_MIN) - 2, background: p.l.status === "BOOKED" ? "#fff0a8" : "#d7f0df", borderColor: p.l.status === "BOOKED" ? "#c9ac00" : "#1f7a45", color: "#17140f" }}>
                    <span className="block truncate">🎾 Particulier{p.l.status === "BOOKED" ? " · à confirmer" : ""}</span>
                    <span className="block truncate font-normal">{hm(p.start)} – {hm(p.end)} · {adultName(p.l.member, "adhérent")}</span>
                  </div>))}
                {preview && preview.weekday === wd && drag && (
                  <div aria-hidden="true" className="pointer-events-none absolute inset-x-0.5 z-10 rounded border-2 border-dashed px-1.5 py-1 text-xs font-bold"
                    style={{ top: px(preview.start - DAY_START), height: px(preview.end - preview.start) - 2, background: preview.ok ? "rgba(31,122,69,.25)" : "rgba(217,45,32,.25)", borderColor: preview.ok ? "#1f7a45" : "#d92d20", color: preview.ok ? "#124d2b" : "#8a1c1c" }}>
                    {hm(preview.start)} – {hm(preview.end)}{preview.ok ? "" : " ✕"}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {blocks.some((b) => privClash(b)) && <p role="status" className="m-0 rounded border-2 border-[#c9ac00] bg-[#fff8d6] p-2 text-sm font-bold text-[#5c4300]">⚠ Cette semaine, un cours du club tombe en même temps qu'un cours particulier ({blocks.filter((b) => privClash(b)).map((b) => `${DAYS[b.weekday].toLowerCase()} ${hm(b.start)}`).join(", ")}). Rien n'est bloqué : à toi de voir.</p>}
      {preview && !preview.ok && <p role="alert" className="m-0 rounded border-2 border-bad bg-[#fdf0ee] p-2 text-sm font-bold text-bad">⚠ {preview.reason} Si tu lâches ici, rien ne sera placé.</p>}
      {drag && (
        <div aria-hidden="true" className="pointer-events-none fixed z-[200] rounded px-3 py-1.5 text-sm font-bold text-white shadow-lg" style={{ left: drag.x + 12, top: drag.y + 8, background: kindOf(drag.kind)!.bg, opacity: drag.moved ? 0.92 : 0 }}>
          {kindOf(drag.kind)!.label} · {dur(drag.kind)}{preview ? ` · ${hm(preview.start)} – ${hm(preview.end)}` : ""}
        </div>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <button className="btn-ink" disabled={!ready || !dirty} onClick={save}>🔄 Enregistrer le planning</button>
        {dirty && <span className="text-sm font-bold text-[#8a6200]">● Modifications pas encore enregistrées</span>}
        {msg && ready && <p role="status" className={"m-0 font-bold " + (msg.ok ? "text-ok" : "text-bad")}>{msg.text}</p>}
      </div>
    </div>
  );
}

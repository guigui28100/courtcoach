import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { ClubPoster, POSTER_H, POSTER_W, PosterModel } from "../components/ClubPoster";
import { del, get, post, put } from "../api";
import { useAuth } from "../auth";
import { BackLink, Err, Page, PageHead } from "../components/ui";
import {
  addDays, allClashes, BANDS, ClubEvent, clashesWith, colorOf, COURTS, CLAY_COURTS, DAYS, Draft, fmtDay, fmtRange, isVacation,
  Kind, KINDS, kindOf, MAX_TEAMS, MONTHS, mondayOf, proposedTitle, seasonOf, seasonStart, seasonWeeks, TEAM_CATS, textOn, titleOf, todayParis,
  vacationWeeks,
} from "../clubPlan";

const ABBR = ["Janv", "Févr", "Mars", "Avr", "Mai", "Juin", "Juil", "Août", "Sept", "Oct", "Nov", "Déc"];
type View = "annee" | "mois" | "jour" | "court";
const VIEWS: [View, string][] = [["annee", "📆 Année"], ["mois", "🗓️ Mois"], ["jour", "📍 Jour"], ["court", "🎾 Par court"]];
const diffDays = (a: string, b: string) => Math.round((Date.parse(`${b}T12:00:00Z`) - Date.parse(`${a}T12:00:00Z`)) / 86_400_000);
const covers = (e: ClubEvent, d: string) => e.startDate <= d && d <= e.endDate;
const fmtShort = (d: string) => `${+d.slice(8, 10)}/${+d.slice(5, 7)}`;

// Planning du club (coach seulement) : tout se fait en cliquant, rien à écrire
export function ClubPlan() {
  const { me } = useAuth();
  const [events, setEvents] = useState<ClubEvent[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [profs, setProfs] = useState<string[]>([]);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<View>("annee");
  const today = todayParis();
  const [season, setSeason] = useState(seasonOf(today));
  const [month, setMonth] = useState(today.slice(0, 7));
  const [day, setDay] = useState(today);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [teamsOpen, setTeamsOpen] = useState(false);
  const [menuDay, setMenuDay] = useState<string | null>(null);
  const [posterOpen, setPosterOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await get<{ events: ClubEvent[]; teamCounts: Record<string, number> }>("/club/plan");
      setEvents(r.events); setCounts(r.teamCounts); setErr("");
    } catch (e: any) { setErr(e.message || "Impossible de charger le planning."); }
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    get<any[]>("/profs/admin").then((l) => setProfs(l.map((p) => `${p.firstName ?? ""} ${p.lastName ?? ""}`.trim()).filter(Boolean))).catch(() => {});
  }, []);

  const names = useMemo(() => [...new Set([me?.firstName ? `${me.firstName} (moi)` : "", ...profs].filter(Boolean))], [me, profs]);
  const clashes = useMemo(() => allClashes(events), [events]);
  const openNew = (p: Partial<Draft> = {}) => setDraft({ kind: "TOURNOI", title: "", startDate: day, endDate: day, bands: [], courts: [], teams: [], who: [], note: "", ...p });
  const openEdit = (e: ClubEvent) => setDraft({ ...e });
  const goDay = (d: string) => { setDay(d); setView("jour"); };

  return (
    <Page>
      <div className="grid gap-3">
        <BackLink fallback="/coach" className="text-sm font-bold text-ink">← Retour</BackLink>
        <PageHead eyebrow="Réservé au coach" title="Planning du club" icon="📅">
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn-clay" onClick={() => setMenuDay(day)}>＋ Ajouter</button>
            <button type="button" className="btn-outline" onClick={() => setPosterOpen(true)}>🖨️ Affiche du mois</button>
            <button type="button" className="btn-outline" onClick={() => setTeamsOpen(true)}>⚙️ Mes équipes</button>
          </div>
        </PageHead>
      </div>
      <Err msg={err} />
      <div role="tablist" aria-label="Façon de voir le planning" className="flex flex-wrap gap-2">
        {VIEWS.map(([k, l]) => (
          <button key={k} role="tab" aria-selected={view === k} type="button" onClick={() => setView(k)}
            className={`rounded-xl border-2 px-4 py-2 font-bold ${view === k ? "border-ink bg-ink text-white" : "border-line bg-white text-ink hover:border-ink"}`}>{l}</button>
        ))}
      </div>
      {loading ? <p className="text-muted">Chargement…</p> : (
        <>
          {view === "annee" && <YearView season={season} setSeason={setSeason} events={events} clashes={clashes} onOpen={openEdit} onDay={goDay} />}
          {view === "mois" && <MonthView month={month} setMonth={setMonth} events={events} onDay={(d) => { setDay(d); setMenuDay(d); }} />}
          {view === "jour" && <DayView day={day} setDay={setDay} events={events} onOpen={openEdit} onNew={openNew} onMenu={() => setMenuDay(day)} />}
          {view === "court" && <CourtView season={season} setSeason={setSeason} events={events} onOpen={openEdit} />}
        </>
      )}
      {draft && <EventModal key={draft.id ?? "new"} initial={draft} events={events} counts={counts} names={names} onClose={() => setDraft(null)} onDone={() => { setDraft(null); load(); }} />}
      {menuDay && <DayMenu key={menuDay} day={menuDay} events={events} counts={counts} names={names} onClose={() => setMenuDay(null)} onDone={() => { setMenuDay(null); load(); }} onDetail={(e) => { setMenuDay(null); openEdit(e); }} />}
      {posterOpen && <PosterModal events={events} initialMonth={month} onClose={() => setPosterOpen(false)} />}
      {teamsOpen && <TeamsModal counts={counts} onClose={() => setTeamsOpen(false)} onDone={() => { setTeamsOpen(false); load(); }} />}
    </Page>
  );
}

const Nav = ({ label, onPrev, onNext, onToday, todayLabel = "Aujourd'hui" }: { label: string; onPrev: () => void; onNext: () => void; onToday?: () => void; todayLabel?: string }) => (
  <div className="flex flex-wrap items-center gap-2">
    <button type="button" className="btn-outline" aria-label="Précédent" onClick={onPrev}>‹</button>
    <b className="min-w-[10rem] text-center text-lg text-ink">{label}</b>
    <button type="button" className="btn-outline" aria-label="Suivant" onClick={onNext}>›</button>
    {onToday && <button type="button" className="btn-outline" onClick={onToday}>{todayLabel}</button>}
  </div>
);

function Chip({ e, onClick, small }: { e: ClubEvent; onClick?: () => void; small?: boolean }) {
  const bg = colorOf(e);
  return (
    <button type="button" onClick={onClick} title={titleOf(e)} style={{ background: bg, color: textOn(bg) }}
      className={`block w-full truncate rounded-md px-1.5 text-left font-bold ${small ? "py-0 text-[11px]" : "py-1 text-sm"}`}>{titleOf(e)}</button>
  );
}

// ───────────── Année : une frise par court, de septembre à août ─────────────
function YearView({ season, setSeason, events, clashes, onOpen, onDay }: { season: number; setSeason: (n: number) => void; events: ClubEvent[]; clashes: ReturnType<typeof allClashes>; onOpen: (e: ClubEvent) => void; onDay: (d: string) => void }) {
  const start = seasonStart(season); const n = seasonWeeks(season); const vac = vacationWeeks(season);
  const end = addDays(start, n * 7 - 1);
  const weekOf = (d: string) => Math.max(0, Math.min(n - 1, Math.floor(diffDays(start, d) / 7)));
  const inSeason = events.filter((e) => e.endDate >= start && e.startDate <= end);
  const monthStarts: { w: number; label: string }[] = [];
  for (let w = 0; w < n; w++) { const d = addDays(start, w * 7 + 3); const m = +d.slice(5, 7); if (w === 0 || m !== +addDays(start, (w - 1) * 7 + 3).slice(5, 7)) monthStarts.push({ w, label: ABBR[m - 1] }); }
  const bubleEnd = Math.min(n, Math.floor(diffDays(start, `${season + 1}-05-31`) / 7) + 1);
  const rows = [...COURTS.map((c) => ({ key: String(c.n), label: c.label, sub: c.surface, evs: inSeason.filter((e) => e.courts.includes(c.n)) })), { key: "none", label: "Sans court", sub: "animations…", evs: inSeason.filter((e) => e.courts.length === 0) }];
  const cols = `repeat(${n}, minmax(0, 1fr))`;
  return (
    <div className="grid gap-4">
      <Nav label={`Saison ${season} – ${season + 1}`} onPrev={() => setSeason(season - 1)} onNext={() => setSeason(season + 1)} onToday={() => setSeason(seasonOf(todayParis()))} todayLabel="Cette saison" />
      {clashes.length > 0 && (
        <div role="alert" className="rounded-2xl border-2 border-[#C0392B] bg-[#fdecea] p-4">
          <b className="text-[#922b21]">⚠️ {clashes.length} chose{clashes.length > 1 ? "s" : ""} à régler</b>
          <ul className="m-0 mt-2 grid list-none gap-2 p-0">
            {clashes.slice(0, 6).map((c, i) => (
              <li key={i} className="flex flex-wrap items-center gap-2 text-sm">
                <span>« {titleOf(c.a)} » ({fmtShort(c.a.startDate)}) et « {titleOf(c.b)} » ({fmtShort(c.b.startDate)}) : {c.why}.</span>
                <button type="button" className="btn-outline" onClick={() => onOpen(c.a)}>Régler</button>
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="overflow-x-auto rounded-2xl border-2 border-line bg-white p-3">
        <div className="min-w-[1000px]">
          <div className="ml-24 grid text-xs font-bold text-muted" style={{ gridTemplateColumns: cols }}>
            {monthStarts.map((m, i) => <span key={i} className="whitespace-nowrap" style={{ gridColumn: `${m.w + 1} / ${(monthStarts[i + 1]?.w ?? n) + 1}` }}>{m.label}</span>)}
          </div>
          <div className="ml-24 grid h-3 overflow-hidden rounded" style={{ gridTemplateColumns: cols }} aria-label="Vacances scolaires">
            {vac.map((v, i) => <span key={i} style={{ background: v ? "repeating-linear-gradient(45deg,#c9d6ea,#c9d6ea 3px,#e9eff8 3px,#e9eff8 6px)" : "#f4f1ea" }} />)}
          </div>
          {rows.map((r) => {
            // Un nom trop long pour sa barre s'écrit à droite de la barre : on réserve cette place dans la rangée
            const need = (e: ClubEvent) => { const w = weekOf(e.endDate) - weekOf(e.startDate) + 1; return w * 17 >= titleOf(e).length * 7 + 8 ? w : w + Math.ceil((titleOf(e).length * 7 + 8) / 17); };
            const lanes: ClubEvent[][] = [];
            for (const e of [...r.evs].sort((a, b) => a.startDate.localeCompare(b.startDate))) {
              const s = weekOf(e.startDate);
              const lane = lanes.findIndex((l) => l.every((x) => weekOf(x.startDate) + need(x) <= s));
              if (lane === -1) lanes.push([e]); else lanes[lane].push(e);
            }
            return (
              <div key={r.key} className="mt-2 flex items-stretch gap-2">
                <div className="w-22 shrink-0 pt-1 text-xs leading-tight" style={{ width: "5.5rem" }}><b className="block text-ink">{r.label}</b><span className="text-muted">{r.sub}</span></div>
                <div className="relative min-h-[34px] flex-1 rounded-lg bg-[#faf7f0]">
                  {r.key !== "none" && <div aria-hidden className="absolute inset-y-0 left-0 rounded-lg" style={{ width: `${(bubleEnd / n) * 100}%`, background: "repeating-linear-gradient(135deg,#fdf3c4,#fdf3c4 4px,#fff9e0 4px,#fff9e0 8px)", opacity: 0.8 }} />}
                  <div className="relative grid gap-y-1 p-1" style={{ gridTemplateColumns: cols }}>
                    {lanes.length === 0 && <span style={{ gridColumn: "1 / -1" }} className="h-6" />}
                    {lanes.flatMap((l, li) => l.map((e) => (
                      <button key={e.id + r.key} type="button" onClick={() => onOpen(e)} title={`${titleOf(e)} · ${fmtRange(e.startDate, e.endDate)}`}
                        style={{ gridColumn: `${weekOf(e.startDate) + 1} / ${weekOf(e.endDate) + 2}`, gridRow: li + 1, background: colorOf(e), color: textOn(colorOf(e)) }}
                        className="relative h-6 min-w-[8px] rounded px-1 text-left text-xs font-bold">
                        {need(e) === weekOf(e.endDate) - weekOf(e.startDate) + 1
                          ? <span className="block truncate">{titleOf(e)}</span>
                          : <span className="absolute left-full top-0 ml-1 whitespace-nowrap leading-6 text-ink">{titleOf(e)}</span>}
                      </button>
                    )))}
                  </div>
                </div>
              </div>
            );
          })}
          <p className="mb-0 ml-24 mt-3 text-xs text-muted">Fond jaune rayé : courts couverts par la bulle (septembre → mai). Rayures bleues : vacances scolaires (zone C). Touche une barre pour la modifier.</p>
        </div>
      </div>
      <Legend />
      <button type="button" className="btn-outline justify-self-start" onClick={() => onDay(todayParis())}>Voir aujourd'hui, jour par jour →</button>
    </div>
  );
}

function Legend() {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
      {KINDS.map((k) => <span key={k.key} className="inline-flex items-center gap-1.5"><i className="inline-block size-3 rounded" style={{ background: k.color }} />{k.label}</span>)}
    </div>
  );
}

// ───────────── Mois ─────────────
function MonthView({ month, setMonth, events, onDay }: { month: string; setMonth: (m: string) => void; events: ClubEvent[]; onDay: (d: string) => void }) {
  const first = `${month}-01`;
  const gridStart = mondayOf(first);
  const days = Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));
  const shift = (n: number) => setMonth(addDays(first, n < 0 ? -1 : 32).slice(0, 7));
  const today = todayParis();
  const rows = days.slice(35).every((d) => d.slice(0, 7) !== month) ? days.slice(0, 35) : days;
  return (
    <div className="grid gap-3">
      <Nav label={`${MONTHS[+month.slice(5, 7) - 1]} ${month.slice(0, 4)}`} onPrev={() => shift(-1)} onNext={() => shift(1)} onToday={() => setMonth(today.slice(0, 7))} todayLabel="Ce mois" />
      <div className="grid grid-cols-7 gap-1 text-center text-xs font-bold text-muted">{DAYS.map((d) => <span key={d}>{d.slice(0, 3)}</span>)}</div>
      <div className="grid grid-cols-7 gap-1">
        {rows.map((d) => {
          const evs = events.filter((e) => covers(e, d) && e.kind !== "BULLE").concat(events.filter((e) => covers(e, d) && e.kind === "BULLE"));
          const out = d.slice(0, 7) !== month;
          return (
            <button key={d} type="button" onClick={() => onDay(d)} aria-label={`${fmtDay(d)} : ${evs.length} événement${evs.length > 1 ? "s" : ""}`}
              className={`min-h-[74px] rounded-lg border p-1 text-left align-top ${out ? "opacity-40" : ""} ${d === today ? "border-2 border-ink bg-[#eef0ff]" : isVacation(d) ? "border-line bg-[#eef3fa]" : "border-line bg-white"} hover:border-ink`}>
              <span className="block text-xs font-bold text-ink">{+d.slice(8, 10)}</span>
              <span className="grid gap-0.5">
                {evs.slice(0, 3).map((e) => <span key={e.id} className="block truncate rounded px-1 text-[10px] font-bold" style={{ background: colorOf(e), color: textOn(colorOf(e)) }}>{titleOf(e)}</span>)}
                {evs.length > 3 && <span className="text-[10px] font-bold text-muted">+{evs.length - 3}</span>}
              </span>
            </button>
          );
        })}
      </div>
      <Legend />
    </div>
  );
}

// ───────────── Jour : 4 courts × 3 moments ─────────────
function DayView({ day, setDay, events, onOpen, onNew, onMenu }: { day: string; setDay: (d: string) => void; events: ClubEvent[]; onOpen: (e: ClubEvent) => void; onNew: (p: Partial<Draft>) => void; onMenu: () => void }) {
  const evs = events.filter((e) => covers(e, day));
  const bulles = evs.filter((e) => e.kind === "BULLE");
  const cell = (court: number, band: string) => evs.filter((e) => e.kind !== "BULLE" && e.courts.includes(court) && (e.bands.length === 0 || e.bands.includes(band)));
  return (
    <div className="grid gap-4">
      <Nav label={fmtDay(day)} onPrev={() => setDay(addDays(day, -1))} onNext={() => setDay(addDays(day, 1))} onToday={() => setDay(todayParis())} />
      {isVacation(day) && <p className="m-0 rounded-xl bg-[#eef3fa] px-3 py-2 text-sm font-bold text-ink">🏖️ Vacances scolaires (zone C)</p>}
      {bulles.map((b) => <p key={b.id} className="m-0 rounded-xl bg-[#fdf3c4] px-3 py-2 text-sm font-bold text-[#6b5a00]">🎈 {titleOf(b)} · courts {b.courts.join(", ")}</p>)}
      <div className="overflow-x-auto">
        <div className="grid min-w-[330px] gap-1" style={{ gridTemplateColumns: "4.2rem repeat(4, minmax(0, 1fr))" }}>
          <span />
          {COURTS.map((c) => <div key={c.n} className="rounded-lg bg-ink px-2 py-1 text-center text-sm font-bold text-white"><span className="sm:hidden">C{c.n}</span><span className="hidden sm:inline">{c.label}</span><small className="hidden font-normal opacity-80 sm:block">{c.surface}</small></div>)}
          {BANDS.map((b) => (
            <div key={b.key} className="contents">
              <div className="pt-2 text-sm font-bold text-ink">{b.label}<small className="block font-normal text-muted">{b.hours}</small></div>
              {COURTS.map((c) => {
                const here = cell(c.n, b.key);
                return (
                  <div key={c.n} className="grid min-h-[64px] content-start gap-1 rounded-lg border border-line bg-white p-1">
                    {here.map((e) => <Chip key={e.id} e={e} onClick={() => onOpen(e)} small />)}
                    {here.length === 0 && <button type="button" aria-label={`Ajouter sur le ${c.label}, ${b.label}`} onClick={() => onNew({ startDate: day, endDate: day, courts: [c.n], bands: [b.key] })}
                      className="h-full min-h-[48px] rounded-md border-2 border-dashed border-line text-xl font-bold text-muted hover:border-ink hover:text-ink">＋</button>}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
      <section className="rounded-2xl border-2 border-line bg-white p-4">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2"><h2 className="m-0 text-lg text-ink">Ce jour-là</h2><button type="button" className="btn-clay" onClick={onMenu}>☑️ Choisir ce qui se passe</button></div>
        {evs.length === 0 ? <p className="m-0 text-muted">Rien de prévu. Touche un « ＋ » ci-dessus.</p> : (
          <ul className="m-0 grid list-none gap-2 p-0">
            {evs.map((e) => (
              <li key={e.id} className="flex flex-wrap items-center gap-2">
                <i className="size-3 rounded" style={{ background: colorOf(e) }} />
                <button type="button" className="font-bold text-ink underline" onClick={() => onOpen(e)}>{titleOf(e)}</button>
                <span className="text-sm text-muted">{e.bands.length ? e.bands.map((b) => BANDS.find((x) => x.key === b)?.label).join(" + ") : "toute la journée"}{e.courts.length ? ` · court${e.courts.length > 1 ? "s" : ""} ${e.courts.join(", ")}` : ""}{e.who.length ? ` · ${e.who.join(", ")}` : ""}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

// ───────────── Par court ─────────────
function CourtView({ season, setSeason, events, onOpen }: { season: number; setSeason: (n: number) => void; events: ClubEvent[]; onOpen: (e: ClubEvent) => void }) {
  const start = seasonStart(season); const end = `${season + 1}-08-31`;
  const inSeason = events.filter((e) => e.endDate >= start && e.startDate <= end);
  return (
    <div className="grid gap-4">
      <Nav label={`Saison ${season} – ${season + 1}`} onPrev={() => setSeason(season - 1)} onNext={() => setSeason(season + 1)} onToday={() => setSeason(seasonOf(todayParis()))} todayLabel="Cette saison" />
      <div className="grid gap-4 md:grid-cols-2">
        {COURTS.map((c) => {
          const list = inSeason.filter((e) => e.courts.includes(c.n));
          return (
            <section key={c.n} className="rounded-2xl border-2 border-line bg-white p-4">
              <h2 className="m-0 text-lg text-ink">{c.label} <small className="font-normal text-muted">· {c.surface}</small></h2>
              {list.length === 0 ? <p className="mb-0 text-muted">Rien de prévu.</p> : (
                <ul className="m-0 mt-2 grid list-none gap-1.5 p-0">
                  {list.map((e) => (
                    <li key={e.id}>
                      <button type="button" onClick={() => onOpen(e)} className="flex w-full items-center gap-2 rounded-lg border border-line px-2 py-1.5 text-left hover:border-ink">
                        <i className="size-3 shrink-0 rounded" style={{ background: colorOf(e) }} />
                        <span className="min-w-0 flex-1"><b className="block truncate text-sm text-ink">{titleOf(e)}</b><span className="text-xs text-muted">{fmtRange(e.startDate, e.endDate)}{e.bands.length ? ` · ${e.bands.map((b) => BANDS.find((x) => x.key === b)?.label.toLowerCase()).join(" + ")}` : ""}{e.who.length ? ` · 👤 ${e.who.join(", ")}` : ""}</span></span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}

// ───────────── Fenêtres ─────────────
function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  useEffect(() => { const f = (e: KeyboardEvent) => e.key === "Escape" && onClose(); window.addEventListener("keydown", f); return () => window.removeEventListener("keydown", f); }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()} className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-t-3xl bg-[#fbf8f2] p-5 shadow-2xl sm:rounded-3xl">
        <div className="mb-3 flex items-center justify-between gap-2"><h2 className="m-0 text-xl text-ink">{title}</h2><button type="button" className="btn-outline" onClick={onClose}>✕ Fermer</button></div>
        {children}
      </div>
    </div>
  );
}
const Pill = ({ on, onClick, children, color, disabled, title }: { on: boolean; onClick: () => void; children: React.ReactNode; color?: string; disabled?: boolean; title?: string }) => (
  <button type="button" aria-pressed={on} disabled={disabled} title={title} onClick={onClick}
    style={on && color ? { background: color, color: textOn(color), borderColor: color } : undefined}
    className={`rounded-xl border-2 px-3 py-2 text-sm font-bold disabled:cursor-not-allowed disabled:opacity-40 ${on ? (color ? "" : "border-ink bg-ink text-white") : "border-line bg-white text-ink hover:border-ink"}`}>{children}</button>
);
const Step = ({ n, title, children }: { n: number; title: string; children: React.ReactNode }) => (
  <section className="mb-4"><h3 className="m-0 mb-2 text-base text-ink"><span className="mr-2 inline-grid size-6 place-items-center rounded-full bg-clay text-sm text-white">{n}</span>{title}</h3>{children}</section>
);
const toggle = <T,>(l: T[], v: T) => (l.includes(v) ? l.filter((x) => x !== v) : [...l, v]);

function MiniCalendar({ start, end, onPick }: { start: string; end: string; onPick: (d: string) => void }) {
  const [m, setM] = useState(start.slice(0, 7));
  const first = `${m}-01`; const gs = mondayOf(first);
  const days = Array.from({ length: 42 }, (_, i) => addDays(gs, i));
  const shift = (n: number) => setM(addDays(first, n < 0 ? -1 : 32).slice(0, 7));
  return (
    <div className="rounded-2xl border-2 border-line bg-white p-3">
      <div className="mb-2 flex items-center justify-between"><button type="button" className="btn-outline" aria-label="Mois précédent" onClick={() => shift(-1)}>‹</button><b>{MONTHS[+m.slice(5, 7) - 1]} {m.slice(0, 4)}</b><button type="button" className="btn-outline" aria-label="Mois suivant" onClick={() => shift(1)}>›</button></div>
      <div className="grid grid-cols-7 gap-1 text-center text-xs">
        {DAYS.map((d) => <b key={d} className="text-muted">{d[0]}</b>)}
        {days.map((d) => {
          const inR = d >= start && d <= end; const edge = d === start || d === end;
          return <button key={d} type="button" aria-label={fmtDay(d)} aria-pressed={inR} onClick={() => onPick(d)}
            className={`h-8 rounded-md font-bold ${edge ? "bg-clay text-white" : inR ? "bg-[#f6d9cc] text-ink" : d.slice(0, 7) === m ? (isVacation(d) ? "bg-[#eef3fa] text-ink" : "text-ink hover:bg-sand") : "text-muted opacity-40"}`}>{+d.slice(8, 10)}</button>;
        })}
      </div>
    </div>
  );
}

function EventModal({ initial, events, counts, names, onClose, onDone }: { initial: Draft; events: ClubEvent[]; counts: Record<string, number>; names: string[]; onClose: () => void; onDone: () => void }) {
  const [d, setD] = useState<Draft>(initial);
  const [pickEnd, setPickEnd] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [sure, setSure] = useState(false);
  const set = (p: Partial<Draft>) => setD((x) => ({ ...x, ...p }));
  const kind = kindOf(d.kind);
  const needsCourt = false; // les terrains sont facultatifs
  const clashes = useMemo(() => clashesWith(d, events), [d, events]);
  const busyCourt = (c: number) => clashesWith({ ...d, courts: [c] }, events).length > 0;
  const missing = d.kind === "EQUIPES" && d.teams.length === 0 ? "Choisis au moins une équipe." : needsCourt && d.courts.length === 0 ? "Choisis au moins un court." : "";
  const pickKind = (k: Kind) => set({ kind: k, teams: k === "EQUIPES" ? d.teams : [], courts: k === "TERRE_BATTUE" ? d.courts.filter((c) => CLAY_COURTS.includes(c)) : d.courts });
  const pickDate = (x: string) => {
    if (!pickEnd) { set({ startDate: x, endDate: x }); setPickEnd(true); }
    else { set(x < d.startDate ? { startDate: x, endDate: d.startDate } : { endDate: x }); setPickEnd(false); }
  };
  const save = async (allowConflict: boolean) => {
    setBusy(true); setErr("");
    const body = { kind: d.kind, title: d.title.trim() || undefined, startDate: d.startDate, endDate: d.endDate, bands: d.bands, courts: d.courts, teams: d.teams, who: d.who, note: d.note.trim() || undefined, allowConflict };
    try { await (d.id ? put(`/club/events/${d.id}`, body) : post("/club/events", body)); onDone(); }
    catch (e: any) { setErr(e.message || "Impossible d'enregistrer."); setBusy(false); }
  };
  const remove = async () => { setBusy(true); try { await del(`/club/events/${d.id}`); onDone(); } catch (e: any) { setErr(e.message); setBusy(false); } };
  const cats = TEAM_CATS.filter((c) => (counts[c.key] ?? c.def) > 0);
  const groups = [...new Set(cats.map((c) => c.group))];

  return (
    <Modal title={d.id ? "Modifier" : "Ajouter au planning"} onClose={onClose}>
      <Step n={1} title="Qu'est-ce que c'est ?">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {KINDS.map((k) => (
            <button key={k.key} type="button" aria-pressed={d.kind === k.key} onClick={() => pickKind(k.key)} style={{ borderColor: d.kind === k.key ? k.color : undefined, background: d.kind === k.key ? k.color : undefined, color: d.kind === k.key ? textOn(k.color) : undefined }}
              className="rounded-xl border-2 border-line bg-white p-2 text-sm font-bold text-ink hover:border-ink">{k.icon} {k.label}</button>
          ))}
        </div>
      </Step>
      {d.kind === "EQUIPES" && (
        <Step n={2} title="Quelles équipes jouent ?">
          {groups.map((g) => (
            <div key={g} className="mb-2"><b className="text-sm text-muted">{g}</b>
              {cats.filter((c) => c.group === g).map((c) => (
                <div key={c.key} className="mt-1 flex flex-wrap items-center gap-2"><span className="w-48 text-sm font-bold text-ink">{c.label}</span>
                  {Array.from({ length: counts[c.key] ?? c.def }, (_, i) => `${c.key}#${i + 1}`).map((t, i) => <Pill key={t} on={d.teams.includes(t)} color={c.color} onClick={() => set({ teams: toggle(d.teams, t) })}>Éq. {i + 1}</Pill>)}
                </div>
              ))}
            </div>
          ))}
        </Step>
      )}
      <Step n={d.kind === "EQUIPES" ? 3 : 2} title={pickEnd ? "Touche le dernier jour (ou le même jour)" : "Quel(s) jour(s) ?"}>
        <MiniCalendar start={d.startDate} end={d.endDate} onPick={pickDate} />
        <p className="mb-0 mt-2 font-bold text-ink">📅 {fmtRange(d.startDate, d.endDate)}</p>
        {!pickEnd && <p className="m-0 text-xs text-muted">Pour plusieurs jours : touche le premier, puis le dernier.</p>}
      </Step>
      <Step n={d.kind === "EQUIPES" ? 4 : 3} title="À quel moment ?">
        <div className="flex flex-wrap gap-2">
          <Pill on={d.bands.length === 0} onClick={() => set({ bands: [] })}>Toute la journée</Pill>
          {BANDS.map((b) => <Pill key={b.key} on={d.bands.includes(b.key)} onClick={() => set({ bands: toggle(d.bands, b.key) })}>{b.label} <small className="font-normal">{b.hours}</small></Pill>)}
        </div>
      </Step>
      <Step n={d.kind === "EQUIPES" ? 5 : 4} title="Sur quels courts ? (facultatif)">
        <div className="flex flex-wrap gap-2">
          {COURTS.map((c) => {
            const off = d.kind === "TERRE_BATTUE" && !CLAY_COURTS.includes(c.n);
            const taken = !off && busyCourt(c.n) && !d.courts.includes(c.n);
            return <Pill key={c.n} on={d.courts.includes(c.n)} disabled={off} title={off ? "La terre battue, c'est seulement les courts 1 et 2" : taken ? "Déjà pris à ce moment-là" : ""} onClick={() => set({ courts: toggle(d.courts, c.n).sort() })}>{c.label}{taken ? " · pris" : ""}<small className="block font-normal">{c.surface}</small></Pill>;
          })}
          <Pill on={false} onClick={() => set({ courts: d.kind === "TERRE_BATTUE" ? [...CLAY_COURTS] : COURTS.map((c) => c.n) })}>Tous</Pill>
        </div>
      </Step>
      <Step n={d.kind === "EQUIPES" ? 6 : 5} title="Quel(s) professeur(s) ? (facultatif)">
        {names.length === 0 ? <p className="m-0 text-sm text-muted">Aucun professeur pour le moment.</p> : <div className="flex flex-wrap gap-2">{names.map((n) => <Pill key={n} on={d.who.includes(n)} onClick={() => set({ who: toggle(d.who, n) })}>{n}</Pill>)}</div>}
      </Step>
      <details className="mb-4"><summary className="cursor-pointer font-bold text-ink">✏️ Changer le nom (facultatif)</summary>
        <input aria-label="Nom de l'événement" maxLength={80} className="mt-2 w-full rounded-xl border-2 border-line px-3 py-2" placeholder={proposedTitle(d)} value={d.title} onChange={(e) => set({ title: e.target.value })} />
        <input aria-label="Note" maxLength={300} className="mt-2 w-full rounded-xl border-2 border-line px-3 py-2" placeholder="Une note (facultatif)" value={d.note} onChange={(e) => set({ note: e.target.value })} />
      </details>
      {clashes.length > 0 && (
        <div role="alert" className="mb-3 rounded-xl border-2 border-[#C0392B] bg-[#fdecea] p-3 text-sm text-[#922b21]">
          <b>⚠️ Ça se chevauche :</b>
          <ul className="m-0 mt-1 pl-5">{clashes.map((c) => <li key={c.id}>« {c.title} » : {c.why}.</li>)}</ul>
        </div>
      )}
      <Err msg={err || missing} />
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {clashes.length > 0 && !sure
          ? <button type="button" className="btn-outline" disabled={busy || !!missing} onClick={() => setSure(true)}>Placer quand même…</button>
          : <button type="button" className="btn-clay" disabled={busy || !!missing} onClick={() => save(clashes.length > 0)} style={{ background: kind.color, color: textOn(kind.color) }}>{clashes.length > 0 ? "Oui, placer quand même" : d.id ? "Enregistrer" : "Placer dans le planning"}</button>}
        {d.id && <button type="button" className="btn-outline ml-auto text-[#922b21]" disabled={busy} onClick={() => { if (confirm("Supprimer cet événement ?")) remove(); }}>🗑️ Supprimer</button>}
      </div>
    </Modal>
  );
}

function TeamsModal({ counts, onClose, onDone }: { counts: Record<string, number>; onClose: () => void; onDone: () => void }) {
  const [c, setC] = useState<Record<string, number>>(() => Object.fromEntries(TEAM_CATS.map((t) => [t.key, counts[t.key] ?? t.def])));
  const [err, setErr] = useState(""); const [busy, setBusy] = useState(false);
  const groups = [...new Set(TEAM_CATS.map((t) => t.group))];
  const save = async () => { setBusy(true); try { await put("/club/teams", { counts: c }); onDone(); } catch (e: any) { setErr(e.message); setBusy(false); } };
  return (
    <Modal title="⚙️ Mes équipes" onClose={onClose}>
      <p className="mt-0 text-sm text-muted">Combien d'équipes le club engage dans chaque catégorie. Elles apparaissent ensuite à cocher quand tu ajoutes un match par équipes.</p>
      {groups.map((g) => (
        <section key={g} className="mb-3 rounded-2xl border-2 border-line bg-white p-3"><b className="text-ink">{g}</b>
          {TEAM_CATS.filter((t) => t.group === g).map((t) => (
            <div key={t.key} className="mt-2 flex items-center gap-2"><i className="size-3 rounded" style={{ background: t.color }} /><span className="flex-1 text-sm font-bold text-ink">{t.label}</span>
              <button type="button" className="btn-outline" aria-label={`Une équipe de moins : ${t.label}`} disabled={c[t.key] <= 0} onClick={() => setC({ ...c, [t.key]: c[t.key] - 1 })}>−</button>
              <b className="w-6 text-center" aria-live="polite">{c[t.key]}</b>
              <button type="button" className="btn-outline" aria-label={`Une équipe de plus : ${t.label}`} disabled={c[t.key] >= MAX_TEAMS} onClick={() => setC({ ...c, [t.key]: c[t.key] + 1 })}>＋</button>
            </div>
          ))}
        </section>
      ))}
      <Err msg={err} />
      <button type="button" className="btn-clay mt-2" disabled={busy} onClick={save}>Enregistrer</button>
    </Modal>
  );
}

// ───────────── Menu d'un jour : on coche ce qui s'y passe (plusieurs choix possibles) ─────────────
interface Sel { on: boolean; who: string[]; teams: string[]; id?: string }
function DayMenu({ day, events, counts, names, onClose, onDone, onDetail }: { day: string; events: ClubEvent[]; counts: Record<string, number>; names: string[]; onClose: () => void; onDone: () => void; onDetail: (e: ClubEvent) => void }) {
  const [end, setEnd] = useState(day);
  const [many, setMany] = useState(false);
  const [pickEnd, setPickEnd] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const exact = useMemo(() => events.filter((e) => e.startDate === day && e.endDate === end), [events, day, end]);
  const build = useCallback(() => {
    const m: Record<string, Sel> = {};
    for (const k of KINDS) { const e = exact.find((x) => x.kind === k.key); m[k.key] = e ? { on: true, who: e.who, teams: e.teams, id: e.id } : { on: false, who: [], teams: [] }; }
    return m;
  }, [exact]);
  const [sel, setSel] = useState<Record<string, Sel>>(build);
  useEffect(() => { setSel(build()); }, [build]);
  const others = events.filter((e) => e.startDate <= end && e.endDate >= day && !exact.includes(e));
  const patch = (k: string, p: Partial<Sel>) => setSel((x) => ({ ...x, [k]: { ...x[k], ...p } }));
  const cats = TEAM_CATS.filter((c) => (counts[c.key] ?? c.def) > 0);
  const missing = sel.EQUIPES?.on && sel.EQUIPES.teams.length === 0 ? "Choisis au moins une équipe pour le match par équipes." : "";
  const pickDate = (x: string) => {
    if (!pickEnd) { setEnd(x < day ? day : x); setPickEnd(true); } else { setEnd(x < day ? day : x); setPickEnd(false); }
  };
  const save = async () => {
    setBusy(true); setErr("");
    try {
      for (const k of KINDS) {
        const c = sel[k.key]; const old = exact.find((x) => x.kind === k.key);
        if (c.on && !old) await post("/club/events", { kind: k.key, startDate: day, endDate: end, bands: [], courts: [], teams: c.teams, who: c.who });
        else if (c.on && old && (c.who.join() !== old.who.join() || c.teams.join() !== old.teams.join())) await put(`/club/events/${old.id}`, { kind: old.kind, title: old.title || undefined, startDate: old.startDate, endDate: old.endDate, bands: old.bands, courts: old.courts, teams: c.teams, who: c.who, note: old.note || undefined, allowConflict: true });
        else if (!c.on && old) await del(`/club/events/${old.id}`);
      }
      onDone();
    } catch (e: any) { setErr(e.message || "Impossible d'enregistrer."); setBusy(false); }
  };
  const groups = [...new Set(KINDS.map((k) => k.group))];
  return (
    <Modal title={`📅 ${end === day ? fmtDay(day) : fmtRange(day, end)}`} onClose={onClose}>
      <p className="mt-0 text-sm text-muted">Coche ce qui se passe ce jour-là. Tu peux en cocher plusieurs.</p>
      {groups.map((g) => (
        <section key={g} className="mb-3">
          <h3 className="m-0 mb-1 text-xs font-extrabold uppercase tracking-wide text-muted">{g}</h3>
          {KINDS.filter((k) => k.group === g).map((k) => {
            const c = sel[k.key] ?? { on: false, who: [], teams: [] }; const old = exact.find((x) => x.kind === k.key);
            return (
              <div key={k.key} className="mb-1.5">
                <div className="flex items-center gap-2">
                  <button type="button" role="checkbox" aria-checked={c.on} onClick={() => patch(k.key, { on: !c.on })}
                    style={c.on ? { borderColor: k.color, background: `${k.color}1f` } : undefined}
                    className="flex flex-1 items-center gap-3 rounded-xl border-2 border-line bg-white px-3 py-2 text-left font-bold text-ink hover:border-ink">
                    <span aria-hidden className="grid size-5 shrink-0 place-items-center rounded-md border-2 text-xs text-white" style={{ background: c.on ? k.color : "#fff", borderColor: c.on ? k.color : "#aaa" }}>{c.on ? "✔" : ""}</span>
                    <span>{k.icon} {k.label}</span>
                  </button>
                  {old && <button type="button" className="btn-outline" title="Terrains, moment, note…" onClick={() => onDetail(old)}>⚙️ Préciser</button>}
                </div>
                {c.on && k.who && names.length > 0 && (
                  <div className="ml-8 mt-1.5 flex flex-wrap items-center gap-1.5 text-sm"><b className="text-ink">Professeur(s) :</b>
                    {names.map((n) => <Pill key={n} on={c.who.includes(n)} onClick={() => patch(k.key, { who: toggle(c.who, n) })}>{n}</Pill>)}</div>
                )}
                {c.on && k.key === "EQUIPES" && (
                  <details open className="ml-8 mt-1.5 rounded-xl border-2 border-line bg-white p-2"><summary className="cursor-pointer text-sm font-bold text-ink">Quelles équipes ? ({c.teams.length})</summary>
                    {cats.map((cat) => (
                      <div key={cat.key} className="mt-1.5 flex flex-wrap items-center gap-1.5"><span className="w-44 text-xs font-bold text-ink">{cat.label}</span>
                        {Array.from({ length: counts[cat.key] ?? cat.def }, (_, i) => `${cat.key}#${i + 1}`).map((t, i) => <Pill key={t} on={c.teams.includes(t)} color={cat.color} onClick={() => patch(k.key, { teams: toggle(c.teams, t) })}>Éq. {i + 1}</Pill>)}
                      </div>
                    ))}
                  </details>
                )}
              </div>
            );
          })}
        </section>
      ))}
      {others.length > 0 && (
        <section className="mb-3 rounded-xl bg-sand p-3 text-sm"><b className="text-ink">Aussi à ces dates (autre période) :</b>
          <ul className="m-0 mt-1 grid list-none gap-1 p-0">{others.map((e) => <li key={e.id}><button type="button" className="font-bold text-ink underline" onClick={() => onDetail(e)}>{kindOf(e.kind).icon} {titleOf(e)}</button> <span className="text-muted">· {fmtRange(e.startDate, e.endDate)}</span></li>)}</ul>
        </section>
      )}
      <details className="mb-3" open={many} onToggle={(e) => setMany((e.target as HTMLDetailsElement).open)}>
        <summary className="cursor-pointer font-bold text-ink">📆 Sur plusieurs jours ? (tournoi de 2 ou 3 jours, stage…)</summary>
        <div className="mt-2"><MiniCalendar start={day} end={end} onPick={pickDate} />
          <p className="mb-0 mt-1 text-xs text-muted">Le jour de départ reste {fmtDay(day)}. Touche le dernier jour : ce que tu coches s'applique à toute la période.</p></div>
      </details>
      <Err msg={err || missing} />
      <button type="button" className="btn-clay mt-2" disabled={busy || !!missing} onClick={save}>✔ Enregistrer</button>
    </Modal>
  );
}

// ───────────── Affiche du mois ─────────────
function PosterModal({ events, initialMonth, onClose }: { events: ClubEvent[]; initialMonth: string; onClose: () => void }) {
  const [month, setMonth] = useState(initialMonth);
  const [model, setModel] = useState<PosterModel>("liste");
  const [showWho, setShowWho] = useState(false);
  const [scale, setScale] = useState(0.5);
  useEffect(() => { const f = () => setScale(Math.min(0.75, (Math.min(window.innerWidth, 720) - 48) / POSTER_W)); f(); window.addEventListener("resize", f); return () => window.removeEventListener("resize", f); }, []);
  const shift = (n: number) => setMonth(addDays(`${month}-01`, n < 0 ? -1 : 32).slice(0, 7));
  const print = () => {
    const st = document.createElement("style"); st.textContent = "@page{size:A4;margin:0}";
    document.head.appendChild(st); document.body.classList.add("printing-affiche");
    const done = () => { document.body.classList.remove("printing-affiche"); st.remove(); window.removeEventListener("afterprint", done); };
    window.addEventListener("afterprint", done); window.print();
  };
  return (
    <Modal title="🖨️ Affiche du mois" onClose={onClose}>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <button type="button" className="btn-outline" aria-label="Mois précédent" onClick={() => shift(-1)}>‹</button>
        <b className="min-w-[9rem] text-center text-ink">{MONTHS[+month.slice(5, 7) - 1]} {month.slice(0, 4)}</b>
        <button type="button" className="btn-outline" aria-label="Mois suivant" onClick={() => shift(1)}>›</button>
      </div>
      <div className="mb-3 flex flex-wrap gap-2">
        <Pill on={model === "liste"} onClick={() => setModel("liste")}>📋 Modèle liste</Pill>
        <Pill on={model === "calendrier"} onClick={() => setModel("calendrier")}>🗓️ Modèle calendrier</Pill>
        <Pill on={showWho} onClick={() => setShowWho(!showWho)}>👤 Montrer les professeurs</Pill>
      </div>
      <div className="mx-auto overflow-hidden rounded-lg border border-line shadow-lg" style={{ width: POSTER_W * scale, height: POSTER_H * scale }}>
        <div style={{ width: POSTER_W, height: POSTER_H, transform: `scale(${scale})`, transformOrigin: "top left" }}><ClubPoster events={events} month={month} model={model} showWho={showWho} /></div>
      </div>
      <button type="button" className="btn-clay mt-3" onClick={print}>🖨️ Imprimer ou enregistrer en PDF</button>
      <p className="mb-0 mt-2 text-xs text-muted">Dans la fenêtre d'impression, choisis « Enregistrer au format PDF ». Rien n'est envoyé sur Internet. Aucun nom d'élève sur l'affiche.</p>
      {createPortal(<div className="affiche-print"><ClubPoster events={events} month={month} model={model} showWho={showWho} /></div>, document.body)}
    </Modal>
  );
}

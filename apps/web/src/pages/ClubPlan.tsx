import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { ClubPoster, monthEvents, POSTER_H, POSTER_W, PosterModel } from "../components/ClubPoster";
import { del, get, post, put } from "../api";
import { useAuth } from "../auth";
import { BackLink, Err, Page, PageHead } from "../components/ui";
import {
  addDays, allClashes, BANDS, ClubEvent, clashesWith, colorOf, COURTS, CLAY_COURTS, DAYS, Draft, fmtDay, fmtRange, isVacation,
  Kind, KINDS, kindOf, MAX_TEAMS, MONTHS, mondayOf, proposedTitle, seasonOf, seasonStart, seasonWeeks, TEAM_CATS, textOn, titleOf, todayParis,
  vacationWeeks, weekdayOf,
} from "../clubPlan";

const ABBR = ["Janv", "Févr", "Mars", "Avr", "Mai", "Juin", "Juil", "Août", "Sept", "Oct", "Nov", "Déc"];
type View = "annee" | "mois";
const VIEWS: [View, string][] = [["annee", "📆 Année complète"], ["mois", "🗓️ Mois"]];
const diffDays = (a: string, b: string) => Math.round((Date.parse(`${b}T12:00:00Z`) - Date.parse(`${a}T12:00:00Z`)) / 86_400_000);
const covers = (e: ClubEvent, d: string) => e.startDate <= d && d <= e.endDate;
const fmtShort = (d: string) => `${+d.slice(8, 10)}/${+d.slice(5, 7)}`;

// Planning du club (coach seulement) : tout se fait en cliquant, rien à écrire
export function ClubPlan() {
  const { me } = useAuth();
  const [events, setEvents] = useState<ClubEvent[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [people, setPeople] = useState<{ name: string; role: string }[]>([]);
  const [peopleOpen, setPeopleOpen] = useState(false);
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
  const [menuEnd, setMenuEnd] = useState<string | null>(null); // dernier jour quand on choisit une plage directement dans le mois
  const [posterOpen, setPosterOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await get<{ events: ClubEvent[]; teamCounts: Record<string, number>; people: { name: string; role: string }[] }>("/club/plan");
      setEvents(r.events); setCounts(r.teamCounts); setPeople(r.people ?? []); setErr("");
    } catch (e: any) { setErr(e.message || "Impossible de charger le planning."); }
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    get<any[]>("/profs/admin").then((l) => setProfs(l.map((p) => `${p.firstName ?? ""} ${p.lastName ?? ""}`.trim()).filter(Boolean))).catch(() => {});
  }, []);

  // Toutes les personnes à affecter : le coach, les professeurs du site, puis les bénévoles et membres du bureau saisis dans « Mes personnes »
  const crew = useMemo(() => {
    const out: { name: string; role: string }[] = [];
    for (const n of [me?.firstName ? `${me.firstName} (moi)` : "", ...profs]) if (n && !out.some((x) => x.name === n)) out.push({ name: n, role: "PROF" });
    for (const p of people) if (!out.some((x) => x.name === p.name)) out.push(p);
    return out;
  }, [me, profs, people]);
  const names = useMemo(() => crew.map((c) => c.name), [crew]);
  const clashes = useMemo(() => allClashes(events), [events]);
  const openEdit = (e: ClubEvent) => setDraft({ ...e });
  const removeEvent = async (e: ClubEvent) => {
    if (!confirm(`Supprimer « ${titleOf(e)} » (${fmtRange(e.startDate, e.endDate)}) ?`)) return;
    try { await del(`/club/events/${e.id}`); await load(); } catch (x: any) { setErr(x.message || "Impossible de supprimer."); }
  };

  const [actionEv, setActionEv] = useState<ClubEvent | null>(null);
  const toggleStar = async (e: ClubEvent) => {
    setErr("");
    if (!e.featured && events.filter((x) => x.featured && x.id !== e.id && x.startDate.slice(0, 7) === e.startDate.slice(0, 7)).length >= 3) { setErr("Il y a déjà 3 événements à mettre en avant ce mois-ci : retire une étoile avant d'en mettre une autre."); return; }
    try { await put(`/club/events/${e.id}`, { kind: e.kind, title: e.title || undefined, startDate: e.startDate, endDate: e.endDate, bands: e.bands, courts: e.courts, teams: e.teams, who: e.who, note: e.note || undefined, featured: !e.featured, allowConflict: true }); await load(); } catch (x: any) { setErr(x.message || "Impossible de changer l'étoile."); }
  };

  return (
    <Page>
      <div className="grid gap-3">
        <BackLink fallback="/coach" className="text-sm font-bold text-ink">← Retour</BackLink>
        <PageHead eyebrow="Réservé au coach" title="Planning du club" icon="📅">
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn-clay" onClick={() => { setMenuEnd(null); setMenuDay(day); }}>＋ Ajouter</button>
            <button type="button" className="btn-outline" onClick={() => setPosterOpen(true)}>🖨️ Affiche du mois</button>
            <button type="button" className="btn-outline" onClick={() => setTeamsOpen(true)}>⚙️ Mes équipes</button>
            <button type="button" className="btn-outline" onClick={() => setPeopleOpen(true)}>👥 Mes personnes</button>
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
          {view === "annee" && <YearView season={season} setSeason={setSeason} events={events} clashes={clashes} onOpen={openEdit} onMonth={(m) => { setMonth(m); setView("mois"); }} />}
          {view === "mois" && <MonthView month={month} setMonth={setMonth} events={events} onDay={(d) => { setDay(d); setMenuEnd(null); setMenuDay(d); }} onRange={(a, b) => { setDay(a); setMenuEnd(b); setMenuDay(a); }} onStar={toggleStar} onEvent={setActionEv} />}
        </>
      )}
      {draft && <EventModal key={draft.id ?? "new"} initial={draft} events={events} counts={counts} names={names} onClose={() => setDraft(null)} onDone={() => { setDraft(null); load(); }} />}
      {menuDay && <DayMenu key={`${menuDay}-${menuEnd}`} day={menuDay} endInit={menuEnd ?? undefined} events={events} counts={counts} crew={crew} onPeople={() => setPeopleOpen(true)} onClose={() => setMenuDay(null)} onDone={() => { setMenuDay(null); load(); }} onDetail={(e) => { setMenuDay(null); openEdit(e); }} onDelete={async (e) => { await removeEvent(e); setMenuDay(null); }} onStar={async (e) => { await toggleStar(e); setMenuDay(null); }} />}
      {actionEv && <EventActions e={events.find((x) => x.id === actionEv.id) ?? actionEv} onClose={() => setActionEv(null)} onStar={toggleStar} onEdit={(e) => { setActionEv(null); openEdit(e); }} onDelete={async (e) => { await removeEvent(e); setActionEv(null); }} />}
      {posterOpen && <PosterModal events={events} initialMonth={month} onClose={() => setPosterOpen(false)} />}
      {peopleOpen && <PeopleModal people={people} onClose={() => setPeopleOpen(false)} onDone={() => { setPeopleOpen(false); load(); }} />}
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

// ───────────── Année : une frise par court, de septembre à août ─────────────
function YearView({ season, setSeason, events, clashes, onOpen, onMonth }: { season: number; setSeason: (n: number) => void; events: ClubEvent[]; clashes: ReturnType<typeof allClashes>; onOpen: (e: ClubEvent) => void; onMonth: (m: string) => void }) {
  const months = Array.from({ length: 12 }, (_, i) => { const m = ((8 + i) % 12) + 1; return `${m >= 9 ? season : season + 1}-${String(m).padStart(2, "0")}`; });
  const today = todayParis();
  const dayLabel = (e: ClubEvent, m: string) => {
    const a = e.startDate < `${m}-01` ? "←" : String(+e.startDate.slice(8, 10)); const same = e.startDate.slice(0, 7) === e.endDate.slice(0, 7);
    if (e.startDate === e.endDate) return a;
    if (e.endDate.slice(0, 7) > m) return `${a} →`;
    return same ? `${a}–${+e.endDate.slice(8, 10)}` : `${a} → ${+e.endDate.slice(8, 10)}`;
  };
  return (
    <div className="grid gap-4">
      <Nav label={`Année ${season} / ${season + 1}`} onPrev={() => setSeason(season - 1)} onNext={() => setSeason(season + 1)} onToday={() => setSeason(seasonOf(todayParis()))} todayLabel="Année en cours" />
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
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {months.map((m) => {
          const list = monthEvents(events, m);
          const now = today.slice(0, 7) === m;
          return (
            <section key={m} className={`rounded-2xl bg-white p-3 shadow-sm ${now ? "border-4 border-clay" : "border-2 border-[#5b6680]"}`}>
              <div className="mb-2 flex items-center justify-between gap-2">
                <h3 className="m-0 text-lg font-black text-ink">{MONTHS[+m.slice(5, 7) - 1]} {m.slice(0, 4)}</h3>
                <button type="button" className="btn-outline" aria-label={`Ouvrir ${MONTHS[+m.slice(5, 7) - 1]}`} onClick={() => onMonth(m)}>Ouvrir ›</button>
              </div>
              {list.length === 0 ? <p className="m-0 rounded-lg bg-[#f4f1ea] px-3 py-2 text-sm text-muted">Rien de prévu</p> : (
                <ul className="m-0 grid list-none gap-1.5 p-0">
                  {list.map((e) => (
                    <li key={e.id}>
                      <button type="button" onClick={() => onOpen(e)} className="flex w-full items-start gap-2 rounded-lg border-2 border-[#d6dbe6] bg-white px-2 py-1.5 text-left hover:border-ink">
                        <span className="grid min-w-[3.4rem] shrink-0 place-items-center rounded-md px-1 py-0.5 text-xs font-black" style={{ background: colorOf(e), color: textOn(colorOf(e)) }}>{dayLabel(e, m)}</span>
                        <span className="min-w-0 flex-1 text-sm font-bold leading-tight text-ink [overflow-wrap:anywhere]">{e.featured ? "⭐ " : ""}{kindOf(e.kind).icon} {titleOf(e)}{e.who.length ? <small className="block font-normal text-muted">👤 {e.who.join(", ")}</small> : null}{e.note ? <small className="mt-0.5 block text-[13px] font-normal text-ink [overflow-wrap:anywhere]" style={{ display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }}>📝 {e.note}</small> : null}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          );
        })}
      </div>
      <Legend />
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
function MonthView({ month, setMonth, events, onDay, onRange, onStar, onEvent }: { onEvent: (e: ClubEvent) => void; onStar: (e: ClubEvent) => void; month: string; setMonth: (m: string) => void; events: ClubEvent[]; onDay: (d: string) => void; onRange: (a: string, b: string) => void }) {
  const [multi, setMulti] = useState(false);
  const [first, setFirst] = useState<string | null>(null);
  const click = (d: string) => {
    if (!multi) return onDay(d);
    if (!first) return setFirst(d);
    const [a, b] = d < first ? [d, first] : [first, d];
    setMulti(false); setFirst(null); onRange(a, b);
  };
  const first1 = `${month}-01`;
  const gridStart = mondayOf(first1);
  const days = Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));
  const shift = (n: number) => setMonth(addDays(first1, n < 0 ? -1 : 32).slice(0, 7));
  const today = todayParis();
  const rows = days.slice(35).every((d) => d.slice(0, 7) !== month) ? days.slice(0, 35) : days;
  return (
    <div className="grid gap-3">
      <Nav label={`${MONTHS[+month.slice(5, 7) - 1]} ${month.slice(0, 4)}`} onPrev={() => shift(-1)} onNext={() => shift(1)} onToday={() => setMonth(today.slice(0, 7))} todayLabel="Mois en cours" />
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" aria-pressed={multi} onClick={() => { setMulti(!multi); setFirst(null); }} className={`rounded-xl border-2 px-4 py-2 font-bold ${multi ? "border-clay bg-clay text-white" : "border-ink bg-white text-ink hover:bg-sand"}`}>📆 {multi ? "Annuler" : "Placer un événement sur plusieurs jours de suite"}</button>
        {multi && <b className="text-clay">{first ? `Premier jour : ${fmtDay(first)}. Touche maintenant le DERNIER jour.` : "Touche le PREMIER jour, puis le dernier."}</b>}
        {!multi && <span className="text-sm text-muted">Pour un seul jour, touche simplement le jour.</span>}
      </div>
      <div className="grid grid-cols-7 gap-1.5 text-center text-sm font-extrabold text-ink">{DAYS.map((d) => <span key={d} className="rounded-lg bg-ink py-1 text-white">{d.slice(0, 3)}</span>)}</div>
      <div className="grid grid-cols-7 gap-1.5">
        {rows.map((d) => {
          const evs = events.filter((e) => covers(e, d) && e.kind !== "BULLE").concat(events.filter((e) => covers(e, d) && e.kind === "BULLE"));
          const out = d.slice(0, 7) !== month;
          const weekend = weekdayOf(d) >= 5;
          const bg = d === first ? "border-4 border-clay bg-[#ffe0cc]" : d === today ? "border-4 border-clay bg-[#fff1c2]" : out ? "border-2 border-[#b6bdcc] bg-[#e4e8ef] opacity-70" : isVacation(d) ? "border-2 border-[#5f7fb0] bg-[#dbe7f8]" : weekend ? "border-2 border-[#5b6680] bg-[#eef1f7]" : "border-2 border-[#5b6680] bg-white";
          return (
            <div key={d} onClick={() => click(d)}
              className={`min-h-[104px] cursor-pointer rounded-xl p-1.5 text-left align-top shadow-sm hover:border-clay hover:shadow-md ${bg}`}>
              <button type="button" onClick={(ev) => { ev.stopPropagation(); click(d); }} aria-label={`${fmtDay(d)} : ${evs.length} événement${evs.length > 1 ? "s" : ""}`} className={`mb-1 block w-full text-left text-base font-black ${d === today ? "text-clay" : "text-ink"}`}>{+d.slice(8, 10)}</button>
              <span className="grid gap-1">
                {evs.slice(0, 3).map((e) => <button key={e.id} type="button" title="Toucher pour voir, modifier ou annuler" onClick={(ev) => { ev.stopPropagation(); onEvent(e); }} className="block w-full rounded-md px-1.5 py-0.5 text-left text-xs font-bold leading-tight underline-offset-2 hover:underline hover:brightness-95 [overflow-wrap:anywhere]" style={{ background: colorOf(e), color: textOn(colorOf(e)) }}>{e.featured ? "⭐" : ""}{kindOf(e.kind).icon} {titleOf(e)}{e.note ? " 📝" : ""}</button>)}
                {evs.length > 3 && <span className="text-xs font-extrabold text-ink">+{evs.length - 3} autres</span>}
              </span>
            </div>
          );
        })}
      </div>
      <section className="rounded-2xl border-2 border-[#5b6680] bg-white p-3">
        <h3 className="m-0 mb-2 text-base text-ink">📋 Programme de {MONTHS[+month.slice(5, 7) - 1].toLowerCase()} (avec les descriptions)</h3>
        {(() => {
          const list = events.filter((e) => e.startDate.slice(0, 7) <= month && e.endDate.slice(0, 7) >= month && !e.kind.startsWith("BULLE")).sort((a, b) => a.startDate.localeCompare(b.startDate));
          if (list.length === 0) return <p className="m-0 text-sm text-muted">Rien de prévu ce mois-ci. Touche un jour pour placer un événement.</p>;
          return (
            <ul className="m-0 grid list-none gap-2 p-0">{list.map((e) => (
              <li key={e.id} className="flex items-start gap-2">
                <button type="button" onClick={() => onDay(e.startDate.slice(0, 7) === month ? e.startDate : first1)} className="flex min-w-0 flex-1 items-start gap-3 rounded-xl border-2 border-line bg-white p-2 text-left hover:border-ink">
                  <span aria-hidden className="mt-1 size-3 shrink-0 rounded-full" style={{ background: colorOf(e) }} />
                  <span className="min-w-0 flex-1">
                    <b className="block text-ink [overflow-wrap:anywhere]">{e.featured ? "⭐ " : ""}{kindOf(e.kind).icon} {titleOf(e)} <span className="font-normal text-muted">· {fmtRange(e.startDate, e.endDate)}</span></b>
                    {e.who.length > 0 && <span className="block text-sm text-muted">👤 {e.who.join(", ")}</span>}
                    {e.note && <span className="mt-0.5 block text-sm text-ink [overflow-wrap:anywhere]">📝 {e.note}</span>}
                  </span>
                </button>
                <button type="button" aria-pressed={!!e.featured} aria-label={e.featured ? `Retirer l'étoile : ${titleOf(e)}` : `Mettre en avant sur l'affiche : ${titleOf(e)}`} title={e.featured ? "Mis en avant sur l'affiche (touche pour retirer)" : "Mettre en avant sur l'affiche"} onClick={() => onStar(e)}
                  className={`shrink-0 rounded-xl border-2 px-3 py-2 text-sm font-bold ${e.featured ? "border-[#d4a000] bg-[#fff3c4] text-[#5a4300]" : "border-line bg-white text-ink hover:border-ink"}`}>{e.featured ? "⭐ En avant" : "☆ Mettre en avant"}</button>
              </li>))}
            </ul>
          );
        })()}
      </section>
      <Legend />
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

const ROLES = [{ key: "PROF", label: "Professeurs" }, { key: "BENEVOLE", label: "Bénévoles" }, { key: "BUREAU", label: "Bureau" }];

// ───────────── Menu d'un jour : on coche ce qui s'y passe (plusieurs choix possibles) ─────────────
interface Sel { on: boolean; who: string[]; teams: string[]; note: string; star: boolean; id?: string }
function DayMenu({ onStar, endInit, day, events, counts, crew, onPeople, onClose, onDone, onDetail, onDelete }: { onStar: (e: ClubEvent) => void; endInit?: string; onDelete: (e: ClubEvent) => void; day: string; events: ClubEvent[]; counts: Record<string, number>; crew: { name: string; role: string }[]; onPeople: () => void; onClose: () => void; onDone: () => void; onDetail: (e: ClubEvent) => void }) {
  const [start, setStart] = useState(day);
  const [end, setEnd] = useState(endInit ?? day);
  const [pickEnd, setPickEnd] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  // Ce qui est coché au départ = les événements déjà placés exactement ce jour-là ; changer les dates NE touche PAS aux cases cochées
  const [sel, setSel] = useState<Record<string, Sel>>(() => {
    const m: Record<string, Sel> = {};
    for (const k of KINDS) { const e = events.find((x) => x.kind === k.key && x.startDate === day && x.endDate === (endInit ?? day)); m[k.key] = e ? { on: true, who: e.who, teams: e.teams, note: e.note ?? "", star: !!e.featured, id: e.id } : { on: false, who: [], teams: [], note: "", star: false }; }
    return m;
  });
  const placed = (k: string) => { const id = sel[k]?.id; return id ? events.find((x) => x.id === id) : undefined; };
  const already = events.filter((e) => e.startDate <= end && e.endDate >= start);
  const patch = (k: string, p: Partial<Sel>) => setSel((x) => ({ ...x, [k]: { ...x[k], ...p } }));
  const cats = TEAM_CATS.filter((c) => (counts[c.key] ?? c.def) > 0);
  const missing = sel.EQUIPES?.on && sel.EQUIPES.teams.length === 0 ? "Choisis au moins une équipe pour le match par équipes." : "";
  const nothing = !Object.values(sel).some((c) => c.on || c.id) ? "Coche au moins un choix." : "";
  // 1er toucher = premier jour, 2e toucher = dernier jour (dans n'importe quel ordre)
  const pickDate = (x: string) => {
    if (!pickEnd) { setStart(x); setEnd(x); setPickEnd(true); }
    else { if (x < start) { setEnd(start); setStart(x); } else setEnd(x); setPickEnd(false); }
  };
  const save = async () => {
    setBusy(true); setErr("");
    try {
      for (const k of KINDS) {
        const c = sel[k.key]; const old = placed(k.key);
        if (c.on && !old) await post("/club/events", { kind: k.key, startDate: start, endDate: end, bands: [], courts: k.courts ?? [], teams: c.teams, who: c.who, note: c.note.trim() || undefined, featured: c.star });
        else if (c.on && old && (c.star !== !!old.featured || c.note.trim() !== (old.note ?? "").trim() || c.who.join() !== old.who.join() || c.teams.join() !== old.teams.join() || old.startDate !== start || old.endDate !== end)) await put(`/club/events/${old.id}`, { kind: old.kind, title: old.title || undefined, startDate: start, endDate: end, bands: old.bands, courts: old.courts, teams: c.teams, who: c.who, note: c.note.trim() || undefined, featured: c.star, allowConflict: true });
        else if (!c.on && old) await del(`/club/events/${old.id}`);
      }
      onDone();
    } catch (e: any) { setErr(e.message || "Impossible d'enregistrer."); setBusy(false); }
  };
  const groups = [...new Set(KINDS.map((k) => k.group))];
  return (
    <Modal title={`📅 ${end === start ? fmtDay(start) : fmtRange(start, end)}`} onClose={onClose}>
      <section className="mb-3 rounded-2xl border-2 border-[#5b6680] bg-white p-3">
        <h3 className="m-0 mb-2 text-base text-ink">📆 Combien de jours ? (la durée que tu veux)</h3>
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-bold text-ink">Durée :</span>
          <button type="button" className="btn-outline" aria-label="Un jour de moins" disabled={end === start} onClick={() => setEnd(addDays(end, -1))}>−</button>
          <input aria-label="Nombre de jours" type="number" min={1} max={366} inputMode="numeric" value={diffDays(start, end) + 1}
            onChange={(e) => { const n = Math.max(1, Math.min(366, Math.floor(+e.target.value) || 1)); setEnd(addDays(start, n - 1)); setPickEnd(false); }}
            className="w-20 rounded-xl border-2 border-line px-2 py-2 text-center text-lg font-black text-ink" />
          <button type="button" className="btn-outline" aria-label="Un jour de plus" onClick={() => setEnd(addDays(end, 1))}>＋</button>
          <span className="font-bold text-ink">jour{end !== start ? "s" : ""}</span>
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
          {[1, 2, 3, 4, 5, 7, 14, 21, 30].map((n) => <Pill key={n} on={diffDays(start, end) === n - 1} onClick={() => { setEnd(addDays(start, n - 1)); setPickEnd(false); }}>{n === 1 ? "1 jour" : n === 7 ? "1 semaine" : n === 14 ? "2 semaines" : n === 21 ? "3 semaines" : n === 30 ? "1 mois" : `${n} jours`}</Pill>)}
        </div>
        <p className="mb-0 mt-2 text-sm font-bold text-ink">{end === start ? `Le ${fmtDay(start)}` : `Du ${fmtDay(start)} au ${fmtDay(end)} (${diffDays(start, end) + 1} jours)`}</p>
        <details className="mt-2"><summary className="cursor-pointer text-sm font-bold text-clay">Ou choisir le dernier jour (ou changer le premier) sur le calendrier</summary>
          <div className="mt-2"><MiniCalendar start={start} end={end} onPick={pickDate} />
            <p className="mb-0 mt-1 text-xs text-muted">{pickEnd ? "Touche maintenant le DERNIER jour (ou le même jour)." : "Touche le premier jour, puis le dernier."}</p></div>
        </details>
      </section>
      {already.length > 0 && (
        <section className="mb-3 rounded-2xl border-2 border-[#b8471f] bg-[#fff6f0] p-3">
          <h3 className="m-0 mb-2 text-base text-ink">📌 Déjà prévu à ces dates ({already.length})</h3>
          <ul className="m-0 grid list-none gap-2 p-0">{already.map((e) => (
            <li key={e.id} className="flex flex-wrap items-center gap-2 rounded-xl bg-white p-2">
              <span aria-hidden className="size-3 shrink-0 rounded-full" style={{ background: kindOf(e.kind).color }} />
              <span className="min-w-0 flex-1 font-bold text-ink [overflow-wrap:anywhere]">{kindOf(e.kind).icon} {titleOf(e)} <span className="font-normal text-muted">· {fmtRange(e.startDate, e.endDate)}</span>{e.note ? <span className="mt-0.5 block text-sm font-normal text-muted [overflow-wrap:anywhere]">📝 {e.note}</span> : null}</span>
              <button type="button" aria-pressed={!!e.featured} className={e.featured ? "btn-outline !border-[#d4a000] !bg-[#fff3c4]" : "btn-outline"} onClick={() => onStar(e)}>{e.featured ? "⭐ Mis en avant" : "☆ Mettre en avant"}</button>
              <button type="button" className="btn-outline" onClick={() => onDetail(e)}>⚙️ Modifier</button>
              <button type="button" className="btn-outline" aria-label={`Supprimer ${titleOf(e)}`} onClick={() => onDelete(e)}>🗑️ Supprimer</button>
            </li>))}
          </ul>
        </section>
      )}
      <p className="mt-0 text-sm text-muted">Coche ce qui se passe. Tu peux en cocher plusieurs.</p>
      {groups.map((g) => (
        <section key={g} className="mb-3">
          <h3 className="m-0 mb-1 text-xs font-extrabold uppercase tracking-wide text-muted">{g}</h3>
          {KINDS.filter((k) => k.group === g).map((k) => {
            const c = sel[k.key] ?? { on: false, who: [], teams: [], note: "", star: false };
            return (
              <div key={k.key} className="mb-1.5">
                <div className="flex items-center gap-2">
                  <button type="button" role="checkbox" aria-checked={c.on} onClick={() => patch(k.key, { on: !c.on })}
                    style={c.on ? { borderColor: k.color, background: `${k.color}1f` } : undefined}
                    className="flex flex-1 items-center gap-3 rounded-xl border-2 border-line bg-white px-3 py-2 text-left font-bold text-ink hover:border-ink">
                    <span aria-hidden className="grid size-5 shrink-0 place-items-center rounded-md border-2 text-xs text-white" style={{ background: c.on ? k.color : "#fff", borderColor: c.on ? k.color : "#aaa" }}>{c.on ? "✔" : ""}</span>
                    <span>{k.icon} {k.label}</span>
                  </button>
                </div>
                {c.on && (
                  <details open={c.who.length > 0} className="ml-8 mt-1.5 rounded-xl border-2 border-line bg-white p-2"><summary className="cursor-pointer text-sm font-bold text-ink">👥 Qui s'en occupe ? ({c.who.length})</summary>
                    {ROLES.map((r) => { const list = crew.filter((x) => x.role === r.key); return list.length === 0 ? null : (
                      <div key={r.key} className="mt-1.5 flex flex-wrap items-center gap-1.5"><span className="w-28 text-xs font-bold text-muted">{r.label}</span>
                        {list.map((n) => <Pill key={n.name} on={c.who.includes(n.name)} onClick={() => patch(k.key, { who: toggle(c.who, n.name) })}>{n.name}</Pill>)}</div>
                    ); })}
                    <button type="button" className="mt-2 text-xs font-bold text-ink underline" onClick={onPeople}>＋ Ajouter un bénévole ou un membre du bureau</button>
                  </details>
                )}
                {c.on && (
                  <button type="button" role="checkbox" aria-checked={c.star} onClick={() => patch(k.key, { star: !c.star })}
                    className={`ml-8 mt-1.5 flex items-center gap-2 rounded-xl border-2 px-3 py-1.5 text-sm font-bold ${c.star ? "border-[#d4a000] bg-[#fff3c4] text-[#5a4300]" : "border-line bg-white text-ink hover:border-ink"}`}>
                    <span aria-hidden className="text-lg">{c.star ? "⭐" : "☆"}</span> À mettre en avant sur l'affiche <small className="font-normal text-muted">(3 au maximum par mois)</small>
                  </button>
                )}
                {c.on && (
                  <label className="ml-8 mt-1.5 block text-sm font-bold text-ink">📝 Description (facultatif)
                    <textarea aria-label={`Description : ${k.label}`} rows={2} maxLength={600} value={c.note} onChange={(e) => patch(k.key, { note: e.target.value })}
                      placeholder={k.key === "TOURNOI" ? "Ex. Tournoi interne simple messieurs, inscriptions à l'accueil jusqu'au 10 novembre, goûter offert…" : "Quelques mots à ajouter sur l'affiche"}
                      className="mt-1 w-full rounded-xl border-2 border-line bg-white px-3 py-2 text-sm font-normal" />
                  </label>
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
      <Err msg={err || missing} />
      <button type="button" className="btn-clay mt-2" disabled={busy || !!missing || !!nothing} onClick={save}>✔ Enregistrer</button>
    </Modal>
  );
}

// ───────────── Un événement : voir, mettre en avant, modifier, annuler ─────────────
function EventActions({ e, onClose, onStar, onEdit, onDelete }: { e: ClubEvent; onClose: () => void; onStar: (e: ClubEvent) => void; onEdit: (e: ClubEvent) => void; onDelete: (e: ClubEvent) => void }) {
  const k = kindOf(e.kind);
  return (
    <Modal title={`${k.icon} ${titleOf(e)}`} onClose={onClose}>
      <p className="mt-0 font-bold text-ink">📅 {fmtRange(e.startDate, e.endDate)}</p>
      {e.who.length > 0 && <p className="text-sm text-ink">👤 {e.who.join(", ")}</p>}
      {e.note ? <p className="rounded-xl bg-sand p-3 text-sm text-ink [overflow-wrap:anywhere]">📝 {e.note}</p> : <p className="text-sm text-muted">Pas de description.</p>}
      <div className="mt-3 grid gap-2">
        <button type="button" aria-pressed={!!e.featured} className={e.featured ? "btn-outline !border-[#d4a000] !bg-[#fff3c4]" : "btn-outline"} onClick={() => onStar(e)}>{e.featured ? "⭐ Mis en avant sur l'affiche (toucher pour retirer)" : "☆ Mettre en avant sur l'affiche"}</button>
        <button type="button" className="btn-outline" onClick={() => onEdit(e)}>⚙️ Modifier</button>
        <button type="button" className="btn-outline !border-[#b42318] !text-[#b42318] hover:!bg-[#b42318] hover:!text-white" onClick={() => onDelete(e)}>🗑️ Annuler cet événement</button>
      </div>
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

// ───────────── Mes personnes : bénévoles, membres du bureau, professeurs sans compte ─────────────
function PeopleModal({ people, onClose, onDone }: { people: { name: string; role: string }[]; onClose: () => void; onDone: () => void }) {
  const [list, setList] = useState(people);
  const [name, setName] = useState(""); const [role, setRole] = useState("BENEVOLE");
  const [err, setErr] = useState(""); const [busy, setBusy] = useState(false);
  const add = () => {
    const n = name.trim().replace(/\s+/g, " ");
    if (!n) return;
    if (list.some((x) => x.name.toLowerCase() === n.toLowerCase())) { setErr(`« ${n} » est déjà dans la liste.`); return; }
    setList([...list, { name: n, role }]); setName(""); setErr("");
  };
  const save = async () => { setBusy(true); setErr(""); try { await put("/club/people", { people: list }); onDone(); } catch (e: any) { setErr(e.message || "Impossible d'enregistrer."); setBusy(false); } };
  return (
    <Modal title="👥 Mes personnes" onClose={onClose}>
      <p className="mt-0 text-sm text-muted">Les noms à pouvoir affecter à un événement. Tu les écris une seule fois ici, ensuite tu les coches. Les professeurs du site y sont déjà. N'indique que des adultes du club.</p>
      {ROLES.filter((r) => r.key !== "PROF" || list.some((x) => x.role === "PROF")).map((r) => (
        <section key={r.key} className="mb-3 rounded-2xl border-2 border-line bg-white p-3"><b className="text-ink">{r.label}</b>
          {list.filter((x) => x.role === r.key).length === 0 && <p className="m-0 mt-1 text-sm text-muted">Personne pour le moment.</p>}
          {list.filter((x) => x.role === r.key).map((x) => (
            <div key={x.name} className="mt-1.5 flex items-center gap-2"><span className="flex-1 font-bold text-ink">{x.name}</span>
              <button type="button" className="btn-outline" aria-label={`Retirer ${x.name}`} onClick={() => setList(list.filter((y) => y.name !== x.name))}>🗑️</button></div>
          ))}
        </section>
      ))}
      <section className="mb-3 rounded-2xl border-2 border-dashed border-line bg-white p-3">
        <b className="text-ink">＋ Ajouter une personne</b>
        <input aria-label="Nom et prénom" maxLength={60} className="mt-2 w-full rounded-xl border-2 border-line px-3 py-2" placeholder="Prénom Nom" value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }} />
        <div className="mt-2 flex flex-wrap gap-2">{ROLES.map((r) => <Pill key={r.key} on={role === r.key} onClick={() => setRole(r.key)}>{r.label.replace(/s$/, "")}</Pill>)}<button type="button" className="btn-outline" onClick={add}>Ajouter à la liste</button></div>
      </section>
      <Err msg={err} />
      <button type="button" className="btn-clay mt-2" disabled={busy} onClick={save}>✔ Enregistrer la liste</button>
    </Modal>
  );
}

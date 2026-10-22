import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ClubPoster, monthEvents, POSTER_H, POSTER_W, PosterModel } from "../components/ClubPoster";
import { del, get, post, put } from "../api";
import { useAuth } from "../auth";
import { homeFor } from "../components/Guard";
import { BackLink, ClubLogo, Err, Page } from "../components/ui";
import { AnimationForm, emptyInfo, EventPosterFields, hasSimpleForm, isStage, isTournoi, PosterInfo } from "../components/EventPosterFields";
import { EventPoster, PosterFormat, SIZES } from "../components/EventPoster";
import { posterToPng } from "../components/exportPoster";
import {
  addDays, allClashes, BANDS, ClubEvent, clashesWith, colorOf, COURTS, CLAY_COURTS, DAYS, Draft, fmtDay, fmtRange, isVacation,
  Kind, KINDS, kindOf, MAX_TEAMS, MONTHS, mondayOf, proposedTitle, seasonOf, seasonStart, seasonWeeks, TEAM_CATS, textOn, titleOf, todayParis,
  vacationWeeks, weekdayOf,
} from "../clubPlan";

const ABBR = ["Janv", "Févr", "Mars", "Avr", "Mai", "Juin", "Juil", "Août", "Sept", "Oct", "Nov", "Déc"];
type View = "annee" | "mois";
const VIEWS: [View, string][] = [["annee", "📆 Vue année entière"], ["mois", "🗓️ Vue mois par mois"]];
const diffDays = (a: string, b: string) => Math.round((Date.parse(`${b}T12:00:00Z`) - Date.parse(`${a}T12:00:00Z`)) / 86_400_000);
const covers = (e: ClubEvent, d: string) => e.startDate <= d && d <= e.endDate;
const fmtShort = (d: string) => `${+d.slice(8, 10)}/${+d.slice(5, 7)}`;

// Planning du club (coach et président : gestion ; bureau : LECTURE SEULE) : tout se fait en cliquant, rien à écrire
export function ClubPlan() {
  const { me } = useAuth();
  const readOnly = me?.role === "BUREAU";
  const [events, setEvents] = useState<ClubEvent[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [people, setPeople] = useState<{ name: string; role: string }[]>([]);
  const [peopleOpen, setPeopleOpen] = useState(false);
  const [profs, setProfs] = useState<string[]>([]);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<View>("annee");
  const [multi, setMulti] = useState(false);
  const today = todayParis();
  const [season, setSeason] = useState(seasonOf(today));
  const [month, setMonth] = useState(today.slice(0, 7));
  const [day, setDay] = useState(today);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [teamsOpen, setTeamsOpen] = useState(false);
  const [menuDay, setMenuDay] = useState<string | null>(null);
  const [askNew, setAskNew] = useState(false); // « Ajouter un événement » : on demande d'abord la date
  const [menuEnd, setMenuEnd] = useState<string | null>(null); // dernier jour quand on choisit une plage directement dans le mois
  const [posterOpen, setPosterOpen] = useState(false);
  const shiftMonth = (m: string, n: number) => addDays(`${m}-01`, n < 0 ? -1 : 32).slice(0, 7);
  const navLabel = view === "annee" ? `Année ${season} / ${season + 1}` : `${MONTHS[+month.slice(5, 7) - 1]} ${month.slice(0, 4)}`;
  const step = (n: number) => { if (view === "annee") setSeason(season + n); else setMonth(shiftMonth(month, n)); };
  const goToday = () => { if (view === "annee") setSeason(seasonOf(todayParis())); else setMonth(todayParis().slice(0, 7)); };

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
  const [posterEv, setPosterEv] = useState<ClubEvent | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const toggleStar = async (e: ClubEvent) => {
    setErr("");
    if (!e.featured && events.filter((x) => x.featured && x.id !== e.id && x.startDate.slice(0, 7) === e.startDate.slice(0, 7)).length >= 3) { setErr("Il y a déjà 3 événements à mettre en avant ce mois-ci : retire une étoile avant d'en mettre une autre."); return; }
    try { await put(`/club/events/${e.id}`, { kind: e.kind, title: e.title || undefined, startDate: e.startDate, endDate: e.endDate, bands: e.bands, courts: e.courts, teams: e.teams, who: e.who, note: e.note || undefined, featured: !e.featured, allowConflict: true }); await load(); } catch (x: any) { setErr(x.message || "Impossible de changer l'étoile."); }
  };

  return (
    <Page>
      <div className="grid gap-3">
        <BackLink fallback={me ? homeFor(me.role) : "/coach"} className="text-sm font-bold text-ink">← Retour</BackLink>
        <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#d0592b] via-[#a63e1a] to-[#7d2c12] px-5 py-5 text-white shadow-md">
          <svg aria-hidden className="pointer-events-none absolute inset-0 size-full opacity-25" preserveAspectRatio="none" viewBox="0 0 400 100"><g fill="none" stroke="#fff" strokeWidth="1.2"><rect x="10" y="8" width="380" height="84" /><line x1="200" y1="8" x2="200" y2="92" /><line x1="70" y1="8" x2="70" y2="92" /><line x1="330" y1="8" x2="330" y2="92" /><line x1="70" y1="50" x2="330" y2="50" /></g></svg>
          <div className="relative flex flex-wrap items-center justify-between gap-4">
            <div className="flex min-w-0 items-center gap-3">
              <ClubLogo className="size-16 text-white drop-shadow" />
              <div className="min-w-0">
                <p className="m-0 text-xs font-extrabold uppercase tracking-[0.18em] text-white/80">{readOnly ? "Lecture seule" : "Réservé au club"} · Saison {season} / {season + 1}</p>
                <h1 className="m-0 text-3xl text-white">Planning du club</h1>
              </div>
            </div>
            {!readOnly && (
            <div className="flex flex-wrap gap-2">
              <button type="button" className="rounded-xl bg-[#dff04a] px-4 py-2.5 font-extrabold text-[#1b1863] shadow hover:brightness-95" onClick={() => { setAskNew(true); setMenuEnd(null); setMenuDay(todayParis()); }}>＋ Ajouter un événement</button>
              <button type="button" className="rounded-xl border-2 border-white bg-white px-4 py-2 font-extrabold text-[#1b1863] shadow-md hover:bg-[#fff1c2]" onClick={() => setPosterOpen(true)}>🖨️ Affiche du mois</button>
              <button type="button" className="rounded-xl border-2 border-white bg-white px-4 py-2 font-extrabold text-[#1b1863] shadow-md hover:bg-[#fff1c2]" onClick={() => setSettingsOpen(true)}>⚙️ Réglages</button>
            </div>
            )}
          </div>
        </section>
      </div>
      <Err msg={err} />
      <div className="grid gap-2">
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border-2 border-[#5b6680] bg-white p-2.5 shadow-sm">
          <div role="tablist" aria-label="Façon de voir le planning" className="flex rounded-xl bg-[#e9edf5] p-1">
            {VIEWS.map(([k, l]) => (
              <button key={k} role="tab" aria-selected={view === k} type="button" onClick={() => { setView(k); setMulti(false); }}
                className={`rounded-lg px-4 py-2 font-extrabold ${view === k ? "bg-[#1b1863] text-white shadow" : "text-ink hover:bg-white"}`}>{l}</button>
            ))}
          </div>
          <div className="flex flex-1 items-center justify-center gap-2">
            <button type="button" className="grid size-10 place-items-center rounded-full border-2 border-line bg-white text-xl font-black text-ink hover:border-ink" aria-label="Précédent" onClick={() => step(-1)}>‹</button>
            <b className="min-w-[11rem] text-center text-xl text-ink">{navLabel}</b>
            <button type="button" className="grid size-10 place-items-center rounded-full border-2 border-line bg-white text-xl font-black text-ink hover:border-ink" aria-label="Suivant" onClick={() => step(1)}>›</button>
            <button type="button" className="whitespace-nowrap rounded-xl border-2 border-line bg-white px-3 py-2 text-sm font-bold text-ink hover:border-ink" onClick={goToday}>{view === "annee" ? "Retour à l’année en cours" : "Retour au mois en cours"}</button>
          </div>
          {view === "mois" && !readOnly && <button type="button" aria-pressed={multi} onClick={() => setMulti(!multi)} className={`rounded-xl border-2 px-3 py-2 text-sm font-bold ${multi ? "border-clay bg-clay text-white" : "border-ink bg-white text-ink hover:bg-sand"}`}>📆 {multi ? "Annuler" : "Plusieurs jours de suite"}</button>}
        </div>
        {view === "mois" && !multi && !readOnly && <p className="m-0 px-1 text-sm text-muted">💡 Touche un jour pour y placer un événement.</p>}
        {readOnly && <p className="m-0 rounded-xl bg-[#eef2fb] px-3 py-2 text-sm font-bold text-[#1b1863]">👀 Tu peux consulter le planning ; seuls le coach et le président peuvent le modifier.</p>}
        {view === "mois" && multi && <p className="m-0 rounded-xl bg-[#fff1c2] px-3 py-2 font-bold text-[#5a4300]">📆 Touche le PREMIER jour, puis le DERNIER jour de l'événement.</p>}
      </div>
      {loading ? <p className="text-muted">Chargement…</p> : (
        <>
          {view === "annee" && <YearView season={season} setSeason={setSeason} events={events} clashes={clashes} onOpen={readOnly ? setActionEv : openEdit} onMonth={(m) => { setMonth(m); setView("mois"); }} />}
          {view === "mois" && <MonthView month={month} multi={multi} events={events} onDay={(d) => { if (readOnly) return; setAskNew(false); setDay(d); setMenuEnd(null); setMenuDay(d); }} onRange={(a, b) => { if (readOnly) return; setAskNew(false); setMulti(false); setDay(a); setMenuEnd(b); setMenuDay(a); }} onEvent={setActionEv} />}
        </>
      )}
      {draft && <EventModal key={draft.id ?? "new"} initial={draft} events={events} counts={counts} names={names} onClose={() => setDraft(null)} onDone={() => { setDraft(null); load(); }} />}
      {menuDay && <DayMenu key={`${menuDay}-${menuEnd}-${askNew}`} ask={askNew} day={menuDay} endInit={menuEnd ?? undefined} events={events} counts={counts} crew={crew} onPeople={() => setPeopleOpen(true)} onClose={() => setMenuDay(null)} onDone={() => { setMenuDay(null); load(); }} onEvent={(e) => { setMenuDay(null); setActionEv(e); }} />}
      {settingsOpen && (
        <Modal title="⚙️ Réglages" onClose={() => setSettingsOpen(false)}>
          <div className="grid gap-2">
            <button type="button" className="btn-outline" onClick={() => { setSettingsOpen(false); setTeamsOpen(true); }}>🎾 Mes équipes (combien d'équipes par catégorie)</button>
            <button type="button" className="btn-outline" onClick={() => { setSettingsOpen(false); setPeopleOpen(true); }}>👥 Mes personnes (bénévoles, bureau)</button>
          </div>
        </Modal>
      )}
      {actionEv && <EventActions e={events.find((x) => x.id === actionEv.id) ?? actionEv} onClose={() => setActionEv(null)} onStar={toggleStar} onPoster={(e) => { setActionEv(null); setPosterEv(e); }} onEdit={(e) => { setActionEv(null); openEdit(e); }} onDelete={async (e) => { await removeEvent(e); setActionEv(null); }} readOnly={readOnly} />}
      {posterEv && <EventPosterModal e={events.find((x) => x.id === posterEv.id) ?? posterEv} onClose={() => setPosterEv(null)} onEdit={(e) => { setPosterEv(null); openEdit(e); }} />}
      {posterOpen && <PosterModal events={events} initialMonth={month} onClose={() => setPosterOpen(false)} />}
      {peopleOpen && <PeopleModal people={people} onClose={() => setPeopleOpen(false)} onDone={() => { setPeopleOpen(false); load(); }} />}
      {teamsOpen && <TeamsModal counts={counts} onClose={() => setTeamsOpen(false)} onDone={() => { setTeamsOpen(false); load(); }} />}
    </Page>
  );
}

const MONTH_COLOR = ["#2E86C1", "#5B6FBF", "#27AE60", "#2FA84F", "#E0A800", "#D35400", "#C0392B", "#16A085", "#CA6F1E", "#A04000", "#7D5BA6", "#4A6FA5"]; // janvier → décembre

// ───────────── Année : une frise par court, de septembre à août ─────────────
function YearView({ season, setSeason, events, clashes, onOpen, onMonth }: { season: number; setSeason: (n: number) => void; events: ClubEvent[]; clashes: ReturnType<typeof allClashes>; onOpen: (e: ClubEvent) => void; onMonth: (m: string) => void }) {
  const months = Array.from({ length: 12 }, (_, i) => { const m = ((8 + i) % 12) + 1; return `${m >= 9 ? season : season + 1}-${String(m).padStart(2, "0")}`; });
  const today = todayParis();
  const [openSet, setOpenSet] = useState<Set<string>>(new Set());
  const dayLabel = (e: ClubEvent, m: string) => {
    const a = e.startDate < `${m}-01` ? "←" : String(+e.startDate.slice(8, 10)); const same = e.startDate.slice(0, 7) === e.endDate.slice(0, 7);
    if (e.startDate === e.endDate) return a;
    if (e.endDate.slice(0, 7) > m) return `${a} →`;
    return same ? `${a}–${+e.endDate.slice(8, 10)}` : `${a} → ${+e.endDate.slice(8, 10)}`;
  };
  return (
    <div className="grid gap-4">
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
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="m-0 text-sm text-muted">💡 Touche un mois pour voir ce qu'il contient.</p>
        <button type="button" className="rounded-xl border-2 border-line bg-white px-3 py-1.5 text-sm font-bold text-ink hover:border-ink" onClick={() => setOpenSet(openSet.size > 0 ? new Set() : new Set(months))}>{openSet.size > 0 ? "▲ Tout fermer" : "▼ Tout ouvrir"}</button>
      </div>
      <div className="grid items-start gap-3 md:grid-cols-2 xl:grid-cols-3">
        {months.map((m) => {
          const list = monthEvents(events, m);
          const now = today.slice(0, 7) === m;
          const mi = +m.slice(5, 7); const color = MONTH_COLOR[mi - 1];
          const shown = list.filter((e) => !e.kind.startsWith("BULLE"));
          return (
            <details key={m} open={openSet.has(m)} onToggle={(ev) => { const o = (ev.currentTarget as HTMLDetailsElement).open; setOpenSet((x) => { if (x.has(m) === o) return x; const n = new Set(x); if (o) n.add(m); else n.delete(m); return n; }); }}
              className={`group overflow-hidden rounded-2xl bg-white shadow-sm ${now ? "border-4 border-clay" : "border-2"}`} style={now ? undefined : { borderColor: color }}>
              <summary className="flex cursor-pointer list-none items-center gap-3 px-3 py-2.5 [&::-webkit-details-marker]:hidden" style={{ background: `${color}1a` }}>
                <span aria-hidden className="grid size-11 shrink-0 place-items-center rounded-xl text-xs font-black uppercase leading-none text-white" style={{ background: color }}>{["JANV", "FÉVR", "MARS", "AVR", "MAI", "JUIN", "JUIL", "AOÛT", "SEPT", "OCT", "NOV", "DÉC"][mi - 1]}</span>
                <span className="min-w-0 flex-1">
                  <span className="block text-lg font-black leading-tight text-ink">{MONTHS[mi - 1]} {m.slice(0, 4)}{now ? <small className="ml-2 rounded-full bg-clay px-2 py-0.5 align-middle text-[11px] font-extrabold text-white">Ce mois-ci</small> : null}</span>
                  <span className="block truncate text-xs font-semibold text-muted">{shown.length === 0 ? "Rien de prévu" : shown.map((e) => `${kindOf(e.kind).icon} ${titleOf(e)}`).join(" · ")}</span>
                </span>
                {shown.length > 0 && <span className="grid min-w-7 place-items-center rounded-full px-2 py-0.5 text-sm font-black text-white" style={{ background: color }}>{shown.length}</span>}
                <span aria-hidden className="text-xl font-black text-ink transition-transform group-open:rotate-90">›</span>
              </summary>
              <div className="p-3">
                {list.length === 0 ? <p className="m-0 rounded-lg bg-[#f4f1ea] px-3 py-2 text-sm text-muted">Rien de prévu ce mois-ci.</p> : (
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
                <button type="button" className="mt-3 w-full rounded-xl border-2 border-ink bg-white px-3 py-2 font-bold text-ink hover:bg-sand" aria-label={`Ouvrir ${MONTHS[mi - 1]} en vue mois par mois`} onClick={() => onMonth(m)}>🗓️ Voir {MONTHS[mi - 1].toLowerCase()} jour par jour ›</button>
              </div>
            </details>
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
function MonthView({ month, multi, events, onDay, onRange, onEvent }: { multi: boolean; onEvent: (e: ClubEvent) => void; month: string; events: ClubEvent[]; onDay: (d: string) => void; onRange: (a: string, b: string) => void }) {
  const [first, setFirst] = useState<string | null>(null);
  useEffect(() => { if (!multi) setFirst(null); }, [multi]);
  const click = (d: string) => {
    if (!multi) return onDay(d);
    if (!first) return setFirst(d);
    const [a, b] = d < first ? [d, first] : [first, d];
    setFirst(null); onRange(a, b);
  };
  const first1 = `${month}-01`;
  const gridStart = mondayOf(first1);
  const days = Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));
  const today = todayParis();
  const rows = days.slice(35).every((d) => d.slice(0, 7) !== month) ? days.slice(0, 35) : days;
  return (
    <div className="grid gap-3">
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
                {evs.slice(0, 3).map((e) => <button key={e.id} type="button" title={titleOf(e)} aria-label={`${titleOf(e)} : voir, modifier ou annuler`} onClick={(ev) => { ev.stopPropagation(); onEvent(e); }} className="block w-full rounded-md px-1 py-0.5 text-center sm:px-1.5 sm:text-left text-xs font-bold leading-tight underline-offset-2 hover:underline hover:brightness-95 [overflow-wrap:anywhere]" style={{ background: colorOf(e), color: textOn(colorOf(e)) }}>{e.featured ? "⭐" : ""}{kindOf(e.kind).icon}<span className="hidden sm:inline"> {titleOf(e)}{e.note ? " 📝" : ""}</span></button>)}
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
              <li key={e.id}>
                <button type="button" onClick={() => onEvent(e)} className="flex min-w-0 flex-1 items-start gap-3 rounded-xl border-2 border-line bg-white p-2 text-left hover:border-ink">
                  <span aria-hidden className="mt-1 size-3 shrink-0 rounded-full" style={{ background: colorOf(e) }} />
                  <span className="min-w-0 flex-1">
                    <b className="block text-ink [overflow-wrap:anywhere]">{e.featured ? "⭐ " : ""}{kindOf(e.kind).icon} {titleOf(e)} <span className="font-normal text-muted">· {fmtRange(e.startDate, e.endDate)}</span></b>
                    {e.who.length > 0 && <span className="block text-sm text-muted">👤 {e.who.join(", ")}</span>}
                    {e.note && <span className="mt-0.5 block text-sm text-ink [overflow-wrap:anywhere]">📝 {e.note}</span>}
                  </span>
                </button>
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
    const body = { kind: d.kind, title: d.title.trim() || undefined, startDate: d.startDate, endDate: d.endDate, bands: d.bands, courts: d.courts, teams: d.teams, who: d.who, note: d.note.trim() || undefined, featured: !!d.featured, time: (d.time ?? "").trim(), place: (d.place ?? "").trim(), signup: (d.signup ?? "").trim(), formulas: (d.formulas ?? []).filter((f) => f.label.trim() || f.price.trim() || (f.priceMember ?? "").trim()), audience: (d.audience ?? "").trim(), bring: (d.bring ?? "").trim(), allowConflict };
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
      {hasSimpleForm(d.kind) ? (
        <div className="mb-4 rounded-xl border-2 border-line bg-white p-3"><AnimationForm tournoi={isTournoi(d.kind)} title={d.title} onTitle={(t) => set({ title: t })} note={d.note} onNote={(t) => set({ note: t })} value={{ time: d.time ?? "", place: d.place ?? "", signup: d.signup ?? "", formulas: d.formulas ?? [], audience: d.audience ?? "", bring: d.bring ?? "" }} onChange={(v) => set(v)} /></div>
      ) : (<>
      <details className="mb-4"><summary className="cursor-pointer font-bold text-ink">✏️ Changer le nom (facultatif)</summary>
        <input aria-label="Nom de l'événement" maxLength={80} className="mt-2 w-full rounded-xl border-2 border-line px-3 py-2" placeholder={proposedTitle(d)} value={d.title} onChange={(e) => set({ title: e.target.value })} />
      </details>
      <label className="mb-4 block font-bold text-ink">📝 Description (facultative, 600 caractères)
        <textarea aria-label="Description de l'événement" rows={3} maxLength={600} value={d.note} onChange={(e) => set({ note: e.target.value })}
          placeholder="Quelques mots qui s'afficheront dans le planning et sur l'affiche"
          className="mt-1 w-full rounded-xl border-2 border-line bg-white px-3 py-2 font-normal" />
      </label>
      <details className="mb-4 rounded-xl border-2 border-line bg-white p-3" open={isStage(d.kind) || !!(d.time || d.place || d.signup || d.formulas?.length || d.audience || d.bring)}>
        <summary className="cursor-pointer font-bold text-ink">🪧 Je veux créer une affiche <span className="font-normal text-muted">(facultatif : ouvre ici pour remplir horaires, lieu, formules et prix)</span></summary>
        <div className="mt-3"><EventPosterFields kind={d.kind} value={{ time: d.time ?? "", place: d.place ?? "", signup: d.signup ?? "", formulas: d.formulas ?? [], audience: d.audience ?? "", bring: d.bring ?? "" }} onChange={(v) => set(v)} /></div>
      </details>
      </>)}
      <button type="button" role="checkbox" aria-checked={!!d.featured} onClick={() => set({ featured: !d.featured })}
        className={`mb-4 flex items-center gap-2 rounded-xl border-2 px-3 py-2 text-sm font-bold ${d.featured ? "border-[#d4a000] bg-[#fff3c4] text-[#5a4300]" : "border-line bg-white text-ink hover:border-ink"}`}>
        <span aria-hidden className="text-lg">{d.featured ? "⭐" : "☆"}</span> À mettre en avant sur l'affiche
      </button>
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
// Un menu déroulant FERMÉ par défaut : le titre dit déjà l'essentiel
function Fold({ open, color, icon, title, hint, badge, children }: { open?: boolean; color: string; icon: string; title: string; hint?: React.ReactNode; badge?: number; children: React.ReactNode }) {
  return (
  <details open={open} className="group mb-2 overflow-hidden rounded-2xl border-2 bg-white shadow-sm" style={{ borderColor: color }}>
    <summary className="flex cursor-pointer list-none items-center gap-3 px-3 py-2.5 [&::-webkit-details-marker]:hidden" style={{ background: `${color}14` }}>
      <span aria-hidden className="grid size-9 shrink-0 place-items-center rounded-xl text-lg text-white" style={{ background: color }}>{icon}</span>
      <span className="min-w-0 flex-1"><span className="block font-extrabold text-ink">{title}</span>{hint ? <span className="block truncate text-xs font-semibold text-muted">{hint}</span> : null}</span>
      {badge ? <span className="grid min-w-6 place-items-center rounded-full px-2 py-0.5 text-xs font-black text-white" style={{ background: color }}>{badge}</span> : null}
      <span aria-hidden className="text-lg font-black text-ink transition-transform group-open:rotate-90">›</span>
    </summary>
    <div className="p-3">{children}</div>
  </details>
);
}

interface Sel { title?: string; on: boolean; who: string[]; teams: string[]; note: string; star: boolean; info: PosterInfo; id?: string }
const infoOf = (e: ClubEvent): PosterInfo => ({ time: e.time ?? "", place: e.place ?? "", signup: e.signup ?? "", formulas: e.formulas ?? [], audience: e.audience ?? "", bring: e.bring ?? "" });
const cleanInfo = (i: PosterInfo) => ({ time: i.time.trim(), place: i.place.trim(), signup: i.signup.trim(), audience: i.audience.trim(), bring: i.bring.trim(), formulas: i.formulas.filter((f) => f.label.trim() || f.price.trim() || (f.priceMember ?? "").trim()).map((f) => ({ label: f.label.trim(), price: f.price.trim(), priceMember: (f.priceMember ?? "").trim(), detail: (f.detail ?? "").trim(), group: (f.group ?? "").trim() })) });
function DayMenu({ ask, endInit, day, events, counts, crew, onPeople, onClose, onDone, onEvent }: { ask?: boolean; endInit?: string; onEvent: (e: ClubEvent) => void; day: string; events: ClubEvent[]; counts: Record<string, number>; crew: { name: string; role: string }[]; onPeople: () => void; onClose: () => void; onDone: () => void }) {
  const [start, setStart] = useState(day);
  const [end, setEnd] = useState(endInit ?? day);
  const [pickEnd, setPickEnd] = useState(false);
  const [chosen, setChosen] = useState(!ask); // en mode « ajouter », rien ne s'enregistre tant qu'aucune date n'est choisie
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  // Ce qui est coché au départ = les événements déjà placés exactement ce jour-là ; changer les dates NE touche PAS aux cases cochées
  const [sel, setSel] = useState<Record<string, Sel>>(() => {
    const m: Record<string, Sel> = {};
    for (const k of KINDS) { const e = events.find((x) => x.kind === k.key && x.startDate === day && x.endDate === (endInit ?? day)); m[k.key] = e ? { title: e.title ?? "", on: true, who: e.who, teams: e.teams, note: e.note ?? "", star: !!e.featured, info: infoOf(e), id: e.id } : { on: false, who: [], teams: [], note: "", star: false, info: emptyInfo() }; }
    return m;
  });
  const placed = (k: string) => { const id = sel[k]?.id; return id ? events.find((x) => x.id === id) : undefined; };
  const already = events.filter((e) => e.startDate <= end && e.endDate >= start);
  const patch = (k: string, p: Partial<Sel>) => setSel((x) => ({ ...x, [k]: { ...x[k], ...p } }));
  const cats = TEAM_CATS.filter((c) => (counts[c.key] ?? c.def) > 0);
  const missing = sel.EQUIPES?.on && sel.EQUIPES.teams.length === 0 ? "Choisis au moins une équipe pour le match par équipes." : "";
  const nothing = !Object.values(sel).some((c) => c.on || c.id) ? "Coche au moins un choix." : "";
  // 1er toucher = premier jour, 2e toucher = dernier jour (dans n'importe quel ordre)
  const pickLast = (x: string) => { setChosen(true); setPickEnd(false); setEnd(x < start ? start : x); }; // fiche d'un jour : on choisit seulement le dernier jour
  const pickDate = (x: string) => {
    setChosen(true);
    if (!pickEnd) { setStart(x); setEnd(x); setPickEnd(true); }
    else { if (x < start) { setEnd(start); setStart(x); } else setEnd(x); setPickEnd(false); }
  };
  const save = async () => {
    setBusy(true); setErr("");
    try {
      for (const k of KINDS) {
        const c = sel[k.key]; const old = placed(k.key);
        if (c.on && !old) await post("/club/events", { kind: k.key, title: c.title?.trim() || undefined, startDate: start, endDate: end, bands: [], courts: k.courts ?? [], teams: c.teams, who: c.who, note: c.note.trim() || undefined, featured: c.star, ...cleanInfo(c.info) });
        else if (c.on && old && (c.star !== !!old.featured || (c.title ?? "").trim() !== (old.title ?? "").trim() || c.note.trim() !== (old.note ?? "").trim() || c.who.join() !== old.who.join() || c.teams.join() !== old.teams.join() || JSON.stringify(cleanInfo(c.info)) !== JSON.stringify(cleanInfo(infoOf(old))) || old.startDate !== start || old.endDate !== end)) await put(`/club/events/${old.id}`, { kind: old.kind, title: c.title?.trim() || undefined, startDate: start, endDate: end, bands: old.bands, courts: old.courts, teams: c.teams, who: c.who, note: c.note.trim() || undefined, featured: c.star, ...cleanInfo(c.info), allowConflict: true });
        else if (!c.on && old) await del(`/club/events/${old.id}`);
      }
      onDone();
    } catch (e: any) { setErr(e.message || "Impossible d'enregistrer."); setBusy(false); }
  };
  const groups = [...new Set(KINDS.map((k) => k.group))];
  const GROUP_META: Record<string, { icon: string; color: string }> = { "Compétition": { icon: "🏆", color: "#D35400" }, "Animations et stages": { icon: "🎉", color: "#8E44AD" }, "Terrains": { icon: "🧱", color: "#A04000" }, "Vie du club": { icon: "🥳", color: "#16A085" } };
  const nbDays = diffDays(start, end) + 1;
  return (
    <Modal title={chosen ? `📅 ${end === start ? fmtDay(start) : fmtRange(start, end)}` : "📅 Nouvel événement"} onClose={onClose}>
      <p className="mb-3 mt-0 rounded-xl bg-[#1b1863] px-3 py-2 text-sm font-bold text-white">{!chosen ? "1. Choisis la date (ou les dates) sur le calendrier · 2. Coche ce qui se passe." : `${nbDays === 1 ? "Une seule journée" : `${nbDays} jours de suite`} · touche un titre pour l'ouvrir, coche ce qui se passe.`}</p>
      <Fold open={ask} color="#2E86C1" icon="📆" title={ask ? "À quelle date ?" : "Jusqu'à quel jour ?"} hint={!chosen ? "👉 Choisis d'abord la date" : nbDays === 1 ? `Une seule journée : le ${fmtDay(start)}` : `Du ${fmtDay(start)} au ${fmtDay(end)} (${nbDays} jours)`}>
        <MiniCalendar start={start} end={end} onPick={ask ? pickDate : pickLast} />
        <p className="mb-0 mt-2 text-sm font-bold text-ink">{ask ? (!chosen ? "Touche le jour de l'événement. S'il dure plusieurs jours, touche le premier puis le dernier." : pickEnd ? "Si l'événement dure plusieurs jours, touche maintenant le DERNIER jour (sinon, c'est bon : une seule journée)." : nbDays === 1 ? `✔ Le ${fmtDay(start)}` : `✔ Du ${fmtDay(start)} au ${fmtDay(end)}`) : (nbDays === 1 ? `L'événement commence le ${fmtDay(start)}. Touche le DERNIER jour s'il dure plusieurs jours.` : `✔ Du ${fmtDay(start)} jusqu'au ${fmtDay(end)} (${nbDays} jours)`)}</p>
        {nbDays > 1 && <button type="button" className="btn-outline mt-2" onClick={() => { setEnd(start); setPickEnd(false); }}>↩ Une seule journée</button>}
      </Fold>
      {already.length > 0 && (
        <Fold color="#b8471f" icon="📌" title="Déjà prévu à ces dates" badge={already.length} hint={already.map((e) => titleOf(e)).join(" · ")}>
          <ul className="m-0 grid list-none gap-2 p-0">{already.map((e) => (
            <li key={e.id} className="flex flex-wrap items-center gap-2 rounded-xl bg-[#fff6f0] p-2">
              <span aria-hidden className="size-3 shrink-0 rounded-full" style={{ background: kindOf(e.kind).color }} />
              <span className="min-w-0 flex-1 font-bold text-ink [overflow-wrap:anywhere]">{kindOf(e.kind).icon} {titleOf(e)} <span className="font-normal text-muted">· {fmtRange(e.startDate, e.endDate)}</span>{e.note ? <span className="mt-0.5 block text-sm font-normal text-muted [overflow-wrap:anywhere]">📝 {e.note}</span> : null}</span>
              <button type="button" className="btn-outline" aria-label={`Gérer ${titleOf(e)}`} onClick={() => onEvent(e)}>Gérer ›</button>
            </li>))}
          </ul>
        </Fold>
      )}
      {groups.map((g) => {
        const gk = KINDS.filter((k) => k.group === g); const gm = GROUP_META[g] ?? { icon: "📅", color: "#2E86C1" };
        const on = gk.filter((k) => sel[k.key]?.on);
        return (
          <Fold key={g} color={gm.color} icon={gm.icon} title={g} badge={on.length} hint={on.length ? `✔ ${on.map((k) => k.label).join(" · ")}` : `${gk.length} choix`}>
            <div className="grid gap-2 sm:grid-cols-2">
              {gk.map((k) => { const c = sel[k.key] ?? { on: false }; return (
                <button key={k.key} type="button" role="checkbox" aria-checked={!!c.on} onClick={() => patch(k.key, { on: !c.on })}
                  style={c.on ? { borderColor: k.color, background: `${k.color}22` } : undefined}
                  className="flex items-center gap-3 rounded-xl border-2 border-line bg-white px-3 py-2.5 text-left font-bold text-ink hover:border-ink">
                  <span aria-hidden className="grid size-5 shrink-0 place-items-center rounded-md border-2 text-xs text-white" style={{ background: c.on ? k.color : "#fff", borderColor: c.on ? k.color : "#aaa" }}>{c.on ? "✔" : ""}</span>
                  <span>{k.icon} {k.label}</span>
                </button>
              ); })}
            </div>
            {on.map((k) => {
              const c = sel[k.key];
              return (
                <div key={k.key} className="mt-3 rounded-xl border-l-8 bg-[#fbf8f2] p-3" style={{ borderColor: k.color }}>
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                    <b className="text-ink">{k.icon} {k.label}</b>
                    <button type="button" role="checkbox" aria-checked={c.star} onClick={() => patch(k.key, { star: !c.star })}
                      className={`flex items-center gap-1.5 rounded-full border-2 px-3 py-1 text-sm font-bold ${c.star ? "border-[#d4a000] bg-[#fff3c4] text-[#5a4300]" : "border-line bg-white text-ink hover:border-ink"}`}>
                      <span aria-hidden>{c.star ? "⭐" : "☆"}</span> Mettre en avant <small className="font-normal text-muted">(3 max / mois)</small>
                    </button>
                  </div>
                  {hasSimpleForm(k.key) ? (
                    <div className="mt-1"><AnimationForm tournoi={isTournoi(k.key)} title={c.title} onTitle={(t) => patch(k.key, { title: t })} note={c.note} onNote={(t) => patch(k.key, { note: t })} value={c.info} onChange={(v) => patch(k.key, { info: v })} /></div>
                  ) : (<>
                  <div className="rounded-xl border-2 border-line bg-white p-3">
                    <p className="m-0 text-xs font-bold uppercase tracking-wide text-muted">① Pour le planning</p>
                    <p className="m-0 mb-2 text-sm text-ink">Cocher « {k.label} » suffit pour le placer dans le calendrier. Tu peux ajouter quelques mots (facultatif).</p>
                    <label className="block text-sm font-bold text-ink">📝 Description (facultatif)
                      <textarea aria-label={`Description : ${k.label}`} rows={2} maxLength={600} value={c.note} onChange={(e) => patch(k.key, { note: e.target.value })}
                        placeholder="Quelques mots sur cet événement"
                        className="mt-1 w-full rounded-xl border-2 border-line bg-white px-3 py-2 text-sm font-normal" />
                    </label>
                  </div>
                  <details className="mt-2 rounded-xl border-2 border-dashed border-[#9a8cc9] bg-[#f5f2ff] p-3" open={!!(c.info.time || c.info.place || c.info.signup || c.info.formulas.length || c.info.audience || c.info.bring)}>
                    <summary className="cursor-pointer text-sm font-bold text-ink">② 🪧 Je veux créer une affiche pour {isStage(k.key) ? "ce stage" : "cet événement"} <span className="font-normal text-muted">(facultatif : ouvre ici pour remplir)</span></summary>
                    <p className="m-0 mt-2 rounded-lg bg-white px-3 py-2 text-sm text-ink">Ces informations servent <b>seulement à fabriquer l'affiche</b> (horaires, lieu, formules et prix…). Si tu ne veux pas d'affiche, laisse ce menu fermé : l'événement sera quand même enregistré.</p>
                    <div className="mt-2"><EventPosterFields kind={k.key} value={c.info} onChange={(v) => patch(k.key, { info: v })} /></div>
                  </details>
                  </>)}
                  <details className="mt-2 rounded-xl border-2 border-line bg-white p-2"><summary className="cursor-pointer text-sm font-bold text-ink">③ 👥 Qui s'en occupe ? ({c.who.length}) <span className="font-normal text-muted">(facultatif)</span></summary>
                    {ROLES.map((r) => { const list = crew.filter((x) => x.role === r.key); return list.length === 0 ? null : (
                      <div key={r.key} className="mt-1.5 flex flex-wrap items-center gap-1.5"><span className="w-28 text-xs font-bold text-muted">{r.label}</span>
                        {list.map((n) => <Pill key={n.name} on={c.who.includes(n.name)} onClick={() => patch(k.key, { who: toggle(c.who, n.name) })}>{n.name}</Pill>)}</div>
                    ); })}
                    <button type="button" className="mt-2 text-xs font-bold text-ink underline" onClick={onPeople}>＋ Ajouter un bénévole ou un membre du bureau</button>
                  </details>
                  {k.key === "EQUIPES" && (
                    <details open className="mt-2 rounded-xl border-2 border-line bg-white p-2"><summary className="cursor-pointer text-sm font-bold text-ink">Quelles équipes ? ({c.teams.length})</summary>
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
          </Fold>
        );
      })}
      <Err msg={err || missing} />
      <button type="button" className="btn-clay mt-2" disabled={busy || !!missing || !!nothing || !chosen} onClick={save}>✔ Enregistrer</button>
    </Modal>
  );
}

// ───────────── Affiche d'un événement : A4 à imprimer ou carré pour les réseaux, enregistrée en PDF ou en image ─────────────
function EventPosterModal({ e, onClose, onEdit }: { e: ClubEvent; onClose: () => void; onEdit: (e: ClubEvent) => void }) {
  const [format, setFormat] = useState<PosterFormat>("A4");
  const [showWho, setShowWho] = useState(false);
  const [scale, setScale] = useState(0.5);
  const [msg, setMsg] = useState("");
  const holder = useRef<HTMLDivElement>(null);
  const { w, h } = SIZES[format];
  useEffect(() => { const f = () => setScale(Math.min(0.75, (Math.min(window.innerWidth, 720) - 48) / w)); f(); window.addEventListener("resize", f); return () => window.removeEventListener("resize", f); }, [w]);
  const print = () => {
    const st = document.createElement("style"); st.textContent = `@page{size:${w}px ${h}px;margin:0}`;
    document.head.appendChild(st); document.body.classList.add("printing-affiche");
    const done = () => { document.body.classList.remove("printing-affiche"); st.remove(); window.removeEventListener("afterprint", done); };
    window.addEventListener("afterprint", done); window.print();
  };
  const png = async () => {
    setMsg("Je prépare l'image…");
    try {
      const node = holder.current?.firstElementChild as HTMLElement;
      const blob = await posterToPng(node, w, h);
      const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
      a.download = `affiche-${titleOf(e).toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${e.startDate}-${format === "A4" ? "a4" : "carre"}.png`;
      document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); setMsg("✔ Image enregistrée dans tes téléchargements.");
    } catch { setMsg("Impossible de faire l'image sur cet appareil : utilise plutôt « Imprimer ou PDF »."); }
  };
  const empty = !e.time && !e.place && !e.signup && !e.audience && !e.bring && !(e.formulas ?? []).length;
  return (
    <Modal title={`🪧 Affiche : ${titleOf(e)}`} onClose={onClose}>
      <div className="mb-3 flex flex-wrap gap-2">
        <Pill on={format === "A4"} onClick={() => setFormat("A4")}>📄 A4 à imprimer</Pill>
        <Pill on={format === "CARRE"} onClick={() => setFormat("CARRE")}>📱 Carré (WhatsApp, Facebook)</Pill>
        {e.who.length > 0 && <Pill on={showWho} onClick={() => setShowWho(!showWho)}>👤 Montrer qui s'en occupe</Pill>}
      </div>
      {empty && <p className="mb-3 mt-0 rounded-xl bg-[#fff1c2] p-3 text-sm font-bold text-[#5a4300]">💡 Pour une affiche plus complète, ajoute les horaires, le lieu, les formules et les prix. <button type="button" className="font-extrabold underline" onClick={() => onEdit(e)}>Compléter l'événement ›</button></p>}
      <div className="mx-auto overflow-hidden rounded-lg border border-line shadow-lg" style={{ width: w * scale, height: h * scale }}>
        <div ref={holder} style={{ width: w, height: h, transform: `scale(${scale})`, transformOrigin: "top left" }}><EventPoster e={e} format={format} showWho={showWho} /></div>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" className="btn-clay" onClick={png}>💾 Enregistrer en image (PNG)</button>
        <button type="button" className="btn-outline" onClick={print}>🖨️ Imprimer ou enregistrer en PDF</button>
        <button type="button" className="btn-outline" onClick={() => onEdit(e)}>✏️ Modifier les infos</button>
      </div>
      {msg && <p className="mb-0 mt-2 text-sm font-bold text-ink" role="status">{msg}</p>}
      <p className="mb-0 mt-2 text-xs text-muted">Rien n'est envoyé sur Internet : tu envoies toi-même l'image ou le PDF par ta messagerie. Aucun nom d'élève sur l'affiche.</p>
      {createPortal(<div className="affiche-print"><EventPoster e={e} format={format} showWho={showWho} /></div>, document.body)}
    </Modal>
  );
}

// ───────────── Un événement : voir, mettre en avant, modifier, annuler ─────────────
function EventActions({ e, onClose, onStar, onEdit, onDelete, onPoster, readOnly = false }: { readOnly?: boolean; onPoster: (e: ClubEvent) => void; e: ClubEvent; onClose: () => void; onStar: (e: ClubEvent) => void; onEdit: (e: ClubEvent) => void; onDelete: (e: ClubEvent) => void }) {
  const k = kindOf(e.kind);
  return (
    <Modal title={`${k.icon} ${titleOf(e)}`} onClose={onClose}>
      <p className="mt-0 font-bold text-ink">📅 {fmtRange(e.startDate, e.endDate)}</p>
      {e.who.length > 0 && <p className="text-sm text-ink">👤 {e.who.join(", ")}</p>}
      {e.note ? <p className="rounded-xl bg-sand p-3 text-sm text-ink [overflow-wrap:anywhere]">📝 {e.note}</p> : <p className="text-sm text-muted">Pas de description.</p>}
      {!readOnly && <div className="mt-3 grid gap-2">
        <button type="button" aria-pressed={!!e.featured} className={e.featured ? "btn-outline !border-[#d4a000] !bg-[#fff3c4]" : "btn-outline"} onClick={() => onStar(e)}>{e.featured ? "⭐ Mis en avant sur l'affiche (toucher pour retirer)" : "☆ Mettre en avant sur l'affiche"}</button>
        <button type="button" className="btn-clay" onClick={() => onPoster(e)}>🪧 Créer l'affiche de cet événement</button>
        <button type="button" className="btn-outline" onClick={() => onEdit(e)}>⚙️ Modifier</button>
        <button type="button" className="btn-outline !border-[#b42318] !text-[#b42318] hover:!bg-[#b42318] hover:!text-white" onClick={() => onDelete(e)}>🗑️ Annuler cet événement</button>
      </div>}
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

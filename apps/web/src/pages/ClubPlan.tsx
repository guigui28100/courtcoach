import { YVELINES_CLUBS } from "../yvelinesClubs";
import { RANKINGS } from "../types";
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { ClubPoster, monthEvents, POSTER_H, POSTER_W, PosterModel } from "../components/ClubPoster";
import { del, get, post, put } from "../api";
import { useAuth } from "../auth";
import { homeFor } from "../components/Guard";
import { BackLink, ClubLogo, Err, Page } from "../components/ui";
import { CourtLines } from "../components/CourtLines";
import { AnimationForm, ChoiceField, emptyInfo, SURFACES, EventPosterFields, hasSimpleForm, isStage, isTournoi, PosterInfo } from "../components/EventPosterFields";
import { usePartnerLogos } from "../sponsors";
import { RecapModal } from "../components/RecapModal";
import { EventPoster, PosterFormat, SIZES, BlockKey, BlockFmt, PosterFmt } from "../components/EventPoster";
import { posterToPdf, posterToPng } from "../components/exportPoster";
import { download, inPeriod, toIcs } from "../clubExport";
import { buildDossier, DOSSIER_H, DOSSIER_W } from "../components/ClubDossier";
import {
  addDays, allClashes, BANDS, ClubEvent, clashesWith, colorOf, COURTS, CLAY_COURTS, DAYS, Draft, fmtDay, fmtRange, isVacation,
  Kind, KINDS, kindOf, MAX_TEAMS, MONTHS, mondayOf, proposedTitle, seasonOf, seasonStart, seasonWeeks, TEAM_CATS, teamLabel, teamCat, textOn, titleOf, todayParis,
  vacationWeeks, VENUE_AWAY, VENUE_HOME, weekdayOf,
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
  const [view, setView] = useState<View>("mois");
  const multi = false; const setMulti = (_: boolean) => {};
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
  const [exportOpen, setExportOpen] = useState(false);
  const nav = useNavigate();
  const [moreOpen, setMoreOpen] = useState(false);
  const shiftMonth = (m: string, n: number) => addDays(`${m}-01`, n < 0 ? -1 : 32).slice(0, 7);
  const navLabel = view === "annee" ? `Année ${season} / ${season + 1}` : `${MONTHS[+month.slice(5, 7) - 1]} ${month.slice(0, 4)}`;
  const step = (n: number) => { if (view === "annee") setSeason(season + n); else setMonth(shiftMonth(month, n)); };
  const goToday = () => { if (view === "annee") setSeason(seasonOf(todayParis())); else setMonth(todayParis().slice(0, 7)); };

  // Glisser-déposer dans une case du mois : on réordonne tout de suite à l'écran, puis on l'enregistre
  const reorder = async (ids: string[]) => {
    setEvents((cur) => cur.map((e) => (ids.includes(e.id) ? { ...e, position: ids.indexOf(e.id) } : e)).map((e, i) => [e, i] as const).sort(([a, i], [b, j]) => a.startDate.localeCompare(b.startDate) || (a.position ?? 0) - (b.position ?? 0) || i - j).map(([e]) => e));
    try { await put("/club/events-order", { ids }); } catch (x) { setErr((x as Error).message); load(); }
  };
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
  const [recapEv, setRecapEv] = useState<ClubEvent | null>(null);
  const [placed, setPlaced] = useState<ClubEvent | null>(null); // juste après l'enregistrement : proposer l'affiche
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
          <svg aria-hidden className="pointer-events-none absolute inset-0 size-full opacity-25" preserveAspectRatio="xMidYMid slice" viewBox="0 0 400 100"><g fill="none" stroke="#fff" strokeWidth="1.2"><CourtLines cx={200} y={12} h={76} netWidth={2} /></g></svg>
          <div className="relative flex flex-wrap items-center justify-between gap-4">
            <div className="flex min-w-0 items-center gap-3">
              <ClubLogo className="size-16 text-white drop-shadow" />
              <div className="min-w-0">
                <p className="m-0 text-xs font-extrabold uppercase tracking-[0.18em] text-white/80">{readOnly ? "Lecture seule" : "Réservé au club"} · Saison {season} / {season + 1}</p>
                <h1 className="m-0 text-3xl text-white">Planning du club</h1>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {!readOnly && <button type="button" className="rounded-xl bg-white px-4 py-2.5 font-extrabold text-[#b8471f] shadow-md hover:bg-[#fff1c2]" onClick={() => { setAskNew(true); setMenuEnd(null); setMenuDay(todayParis()); }}>＋ Ajouter un événement</button>}
              <button type="button" className="rounded-xl border-2 border-white/60 bg-white/15 px-4 py-2.5 font-extrabold text-white hover:bg-white/25" aria-haspopup="dialog" onClick={() => setMoreOpen(true)}>{readOnly ? "📤 Exporter" : "⋯ Affiche, export, réglages"}</button>
            </div>
          </div>
        </section>
      </div>
      <Err msg={err} />
      <div className="grid gap-2">
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border-2 border-[#5b6680] bg-white p-2.5 shadow-sm">
          <div role="tablist" aria-label="Façon de voir le planning" className="flex w-full rounded-xl sm:w-auto bg-[#e9edf5] p-1">
            {VIEWS.map(([k, l]) => (
              <button key={k} role="tab" aria-selected={view === k} type="button" onClick={() => { setView(k); setMulti(false); }}
                className={`flex-1 rounded-lg px-2 py-2 text-sm font-extrabold sm:flex-none sm:px-4 sm:text-base ${view === k ? "bg-[#1b1863] text-white shadow" : "text-ink hover:bg-white"}`}>{l}</button>
            ))}
          </div>
          <div className="flex flex-1 flex-wrap items-center justify-center gap-2">
            <button type="button" className="grid size-10 place-items-center rounded-full border-2 border-line bg-white text-xl font-black text-ink hover:border-ink" aria-label="Précédent" onClick={() => step(-1)}>‹</button>
            <b className="min-w-[8rem] text-center text-xl text-ink sm:min-w-[11rem]">{navLabel}</b>
            <button type="button" className="grid size-10 place-items-center rounded-full border-2 border-line bg-white text-xl font-black text-ink hover:border-ink" aria-label="Suivant" onClick={() => step(1)}>›</button>
            <button type="button" className="whitespace-nowrap rounded-xl border-2 border-line bg-white px-3 py-2 text-sm font-bold text-ink hover:border-ink" onClick={goToday}>{view === "annee" ? "Retour à l’année en cours" : "Retour au mois en cours"}</button>
          </div>
        </div>
        {readOnly && <p className="m-0 rounded-xl bg-[#eef2fb] px-3 py-2 text-sm font-bold text-[#1b1863]">👀 Tu peux consulter le planning ; seuls le coach et le président peuvent le modifier.</p>}
      </div>
      {moreOpen && (
        <Modal title="⋯ Affiche, export, réglages" onClose={() => setMoreOpen(false)}>
          <div className="grid gap-2">
            {[
              ...(readOnly ? [] : [{ i: "🖨️", t: "Affiche du mois", d: "Une affiche A4 du mois, à imprimer ou à envoyer en image.", go: () => setPosterOpen(true) }]),
              { i: "📤", t: "Exporter le planning", d: "Le dossier de saison en PDF, ou l’agenda à mettre dans ton téléphone.", go: () => setExportOpen(true) },
              ...(readOnly ? [] : [{ i: "🤝", t: "Partenaires (sponsors)", d: "Le suivi des entreprises qui soutiennent le club, leurs logos pour les affiches et le dossier à leur envoyer.", go: () => nav("/coach/club/partenaires") }]),
              ...(readOnly ? [] : [{ i: "⚙️", t: "Réglages", d: "Le nombre d’équipes et la liste des personnes (président, bénévoles, bureau).", go: () => setSettingsOpen(true) }]),
            ].map((o) => (
              <button key={o.t} type="button" className="flex items-center gap-3 rounded-2xl border-2 border-line bg-white p-3 text-left hover:border-ink" onClick={() => { setMoreOpen(false); o.go(); }}>
                <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-[#f3efe6] text-2xl">{o.i}</span>
                <span><b className="block text-ink">{o.t}</b><span className="text-sm text-muted">{o.d}</span></span>
              </button>
            ))}
          </div>
        </Modal>
      )}
      {loading ? <p className="text-muted">Chargement…</p> : (
        <>
          {view === "annee" && <YearView season={season} setSeason={setSeason} events={events} clashes={clashes} onOpen={readOnly ? setActionEv : openEdit} onMonth={(m) => { setMonth(m); setView("mois"); }} />}
          {view === "mois" && <MonthView month={month} multi={multi} events={events} onDay={(d) => { if (readOnly) return; setAskNew(false); setDay(d); setMenuEnd(null); setMenuDay(d); }} onRange={(a, b) => { if (readOnly) return; setAskNew(false); setMulti(false); setDay(a); setMenuEnd(b); setMenuDay(a); }} onEvent={setActionEv} onReorder={readOnly ? undefined : reorder} />}
        </>
      )}
      {draft && <EventModal key={draft.id ?? "new"} initial={draft} events={events} counts={counts} names={names} onClose={() => setDraft(null)} onDone={() => { setDraft(null); load(); }} />}
      {menuDay && <DayMenu key={`${menuDay}-${menuEnd}-${askNew}`} ask={askNew} day={menuDay} endInit={menuEnd ?? undefined} events={events} counts={counts} crew={crew} onPeople={() => setPeopleOpen(true)} onClose={() => setMenuDay(null)} onDone={(c) => { setMenuDay(null); load(); if (c) setPlaced(c); }} onEvent={(e) => { setMenuDay(null); setActionEv(e); }} />}
      {settingsOpen && (
        <Modal title="⚙️ Réglages" onClose={() => setSettingsOpen(false)}>
          <div className="grid gap-2">
            <button type="button" className="btn-outline" onClick={() => { setSettingsOpen(false); setTeamsOpen(true); }}>🎾 Mes équipes (combien d'équipes par catégorie)</button>
            <button type="button" className="btn-outline" onClick={() => { setSettingsOpen(false); setPeopleOpen(true); }}>👥 Mes personnes (bénévoles, bureau)</button>
          </div>
        </Modal>
      )}
      {actionEv && <EventActions e={events.find((x) => x.id === actionEv.id) ?? actionEv} onClose={() => setActionEv(null)} onStar={toggleStar} onPoster={(e) => { setActionEv(null); setPosterEv(e); }} onRecap={(e) => { setActionEv(null); setRecapEv(e); }} onEdit={(e) => { setActionEv(null); openEdit(e); }} onDelete={async (e) => { await removeEvent(e); setActionEv(null); }} readOnly={readOnly} />}
      {recapEv && <RecapModal e={recapEv} events={events} onClose={() => setRecapEv(null)} />}
      {placed && <PlacedModal e={placed} onLater={() => setPlaced(null)} onPoster={() => { setPosterEv(placed); setPlaced(null); }} />}
      {posterEv && <EventPosterModal e={events.find((x) => x.id === posterEv.id) ?? posterEv} onClose={() => setPosterEv(null)} onSaved={load} />}
      {exportOpen && <ExportModal events={events} season={season} month={month} onClose={() => setExportOpen(false)} />}
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
function MonthView({ month, multi, events, onDay, onRange, onEvent, onReorder }: { multi: boolean; onEvent: (e: ClubEvent) => void; onReorder?: (ids: string[]) => void; month: string; events: ClubEvent[]; onDay: (d: string) => void; onRange: (a: string, b: string) => void }) {
  const [first, setFirst] = useState<string | null>(null);
  useEffect(() => { if (!multi) setFirst(null); }, [multi]);
  const click = (d: string) => {
    if (!multi) return onDay(d);
    if (!first) return setFirst(d);
    const [a, b] = d < first ? [d, first] : [first, d];
    setFirst(null); onRange(a, b);
  };
  // Glisser-déposer (souris, stylet ou doigt en appui long) : un événement se place au-dessus ou en dessous d'un autre de la MÊME case.
  // Fait avec les « pointer events » (et non le glisser natif du navigateur, qui ne marche pas sur un bouton dans Firefox ni au doigt).
  const [drag, setDrag] = useState<{ id: string; day: string } | null>(null);
  const [over, setOver] = useState<{ id: string; after: boolean } | null>(null);
  const [ghost, setGhost] = useState<{ x: number; y: number; text: string } | null>(null);
  const justDragged = useRef(false);
  const press = (ev: React.PointerEvent<HTMLElement>, id: string, day: string, text: string) => {
    if (!onReorder || (ev.pointerType === "mouse" && ev.button !== 0)) return;
    const st = { id, day, sx: ev.clientX, sy: ev.clientY, active: false, touch: ev.pointerType !== "mouse", timer: 0, over: null as { id: string; after: boolean } | null };
    const begin = () => { st.active = true; setDrag({ id, day }); };
    if (st.touch) st.timer = window.setTimeout(begin, 380);
    const stop = () => { window.clearTimeout(st.timer); window.removeEventListener("pointermove", mv); window.removeEventListener("pointerup", up); window.removeEventListener("pointercancel", cancel); window.removeEventListener("touchmove", noScroll); setDrag(null); setOver(null); setGhost(null); };
    const noScroll = (e: TouchEvent) => { if (st.active) e.preventDefault(); };
    const mv = (e: PointerEvent) => {
      if (!st.active) { if (Math.hypot(e.clientX - st.sx, e.clientY - st.sy) <= 6) return; if (st.touch) return stop(); begin(); }
      setGhost({ x: e.clientX, y: e.clientY, text });
      const cell = (document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null)?.closest<HTMLElement>("[data-cell]");
      const tags = cell && cell.dataset.cell === day ? [...cell.querySelectorAll<HTMLElement>("[data-ev]")].filter((b) => b.dataset.ev !== id) : [];
      if (!tags.length) { st.over = null; setOver(null); return; }
      let target = tags[0], after = false; // au-dessus du premier : avant lui
      for (const b of tags) { const r = b.getBoundingClientRect(); if (e.clientY >= r.top) { target = b; after = e.clientY > r.top + r.height / 2; } }
      st.over = { id: target.dataset.ev!, after }; setOver(st.over);
    };
    const up = () => {
      const was = st.active; const o = st.over; stop();
      if (!was) return;
      justDragged.current = true; window.setTimeout(() => { justDragged.current = false; }, 80);
      if (!o) return;
      const ids = cellEvents(day).filter((x) => x.kind !== "BULLE").map((x) => x.id).filter((x) => x !== id);
      const at = ids.indexOf(o.id); if (at < 0) return;
      ids.splice(at + (o.after ? 1 : 0), 0, id);
      onReorder(ids);
    };
    const cancel = () => stop();
    window.addEventListener("pointermove", mv); window.addEventListener("pointerup", up); window.addEventListener("pointercancel", cancel);
    window.addEventListener("touchmove", noScroll, { passive: false });
  };
  // Ordre d'une case : la place choisie par glisser (position) d'abord, puis l'ordre habituel ; les repères de bulle restent en bas
  const cellEvents = (d: string) => {
    const here = events.filter((e) => covers(e, d)).map((e, i) => [e, i] as const);
    const main = here.filter(([e]) => e.kind !== "BULLE").sort(([a, i], [b, j]) => (a.position ?? 0) - (b.position ?? 0) || i - j).map(([e]) => e);
    return main.concat(here.filter(([e]) => e.kind === "BULLE").map(([e]) => e));
  };
  const first1 = `${month}-01`;
  const gridStart = mondayOf(first1);
  const days = Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));
  const today = todayParis();
  const rows = days.slice(35).every((d) => d.slice(0, 7) !== month) ? days.slice(0, 35) : days;
  return (
    <div className="grid gap-3">
      <div className="grid grid-cols-7 gap-2.5 text-center text-xs font-extrabold uppercase tracking-[0.14em] text-[#8a7f72]">{DAYS.map((d) => <span key={d}>{d.slice(0, 3)}</span>)}</div>
      <div className="grid grid-cols-7 gap-2.5">
        {rows.map((d) => {
          const evs = cellEvents(d);
          const out = d.slice(0, 7) !== month;
          const weekend = weekdayOf(d) >= 5;
          const bg = d === first ? "border-2 border-clay bg-[#ffd9c2] shadow-md" : d === today ? "border-2 border-clay bg-[#fff1c2] shadow-md" : out ? "border-2 border-[#cfc6b8] bg-[#ebe5da] opacity-60" : isVacation(d) ? "border-2 border-[#7f9fd0] bg-[#d9e6f8]" : weekend ? "border-2 border-[#a89c88] bg-[#f1e8d9]" : "border-2 border-[#a89c88] bg-white";
          return (
            <div key={d} data-cell={d} onClick={() => { if (justDragged.current) return; click(d); }}
              className={`min-h-[112px] cursor-pointer rounded-2xl p-2 text-left align-top shadow-md hover:border-clay hover:shadow-md ${bg}`}>
              <button type="button" onClick={(ev) => { ev.stopPropagation(); if (justDragged.current) return; click(d); }} aria-label={`${fmtDay(d)} : ${evs.length} événement${evs.length > 1 ? "s" : ""}`} className={`mb-1 block w-full text-left text-base font-black ${d === today ? "text-clay" : "text-ink"}`}>{+d.slice(8, 10)}</button>
              <span className="grid gap-1">
                {evs.slice(0, 3).map((e) => { const movable = !!onReorder && e.kind !== "BULLE"; const ov = over?.id === e.id && drag?.day === d && drag.id !== e.id ? over : null; return <button key={e.id} type="button" title={titleOf(e)} aria-label={`${titleOf(e)} : voir, modifier ou annuler`} onClick={(ev) => { ev.stopPropagation(); if (justDragged.current) return; onEvent(e); }}
                  {...(movable ? { "data-ev": e.id, onPointerDown: (ev: React.PointerEvent<HTMLElement>) => press(ev, e.id, d, titleOf(e)), onDragStart: (ev: React.DragEvent) => ev.preventDefault() } : {})}
                  className={"block w-full select-none rounded-md px-1 py-0.5 text-center sm:px-1.5 sm:text-left text-xs font-bold leading-tight underline-offset-2 hover:underline hover:brightness-95 [overflow-wrap:anywhere] " + (movable ? "cursor-grab " : "") + (drag?.id === e.id ? "opacity-40" : "")}
                  style={{ background: colorOf(e), color: textOn(colorOf(e)), boxShadow: ov ? (ov.after ? "0 4px 0 0 #1b1863" : "0 -4px 0 0 #1b1863") : undefined }}>{e.featured ? "⭐" : ""}{kindOf(e.kind).icon}<span className="hidden sm:inline"> {titleOf(e)}{e.note ? " 📝" : ""}{hasPoster(e) ? " 🪧" : ""}</span></button>; })}
                {evs.length > 3 && <span className="text-xs font-extrabold text-ink">+{evs.length - 3} autres</span>}
              </span>
            </div>
          );
        })}
      </div>
      {ghost && <div aria-hidden className="pointer-events-none fixed z-[60] max-w-[14rem] -translate-x-1/2 -translate-y-full truncate rounded-lg bg-ink px-3 py-1.5 text-xs font-extrabold text-white shadow-xl" style={{ left: ghost.x, top: ghost.y - 8 }}>↕ {ghost.text}</div>}
      {onReorder && <p className="m-0 hidden rounded-xl bg-[#eef2fb] px-3 py-2 text-sm font-bold text-[#1b1863] sm:block">↕ Pour changer l'ordre : glisse un événement au-dessus ou en dessous d'un autre dans la même case (avec la souris, ou en appuyant longuement avec le doigt).</p>}
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
export function Modal({ title, onClose, children, wide, bare }: { title: string; onClose: () => void; children: React.ReactNode; wide?: boolean; bare?: boolean }) {
  useEffect(() => { const f = (e: KeyboardEvent) => e.key === "Escape" && onClose(); window.addEventListener("keydown", f); return () => window.removeEventListener("keydown", f); }, [onClose]);
  if (bare) return ( // mode « carte seule » : le planning reste visible en fond (assombri), mais aucune autre carte autour
    <div className="fixed inset-0 z-50 grid content-start justify-items-center overflow-y-auto bg-black/50 p-4 sm:content-center" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()} className="w-full max-w-2xl">
        <div className="mb-2 flex justify-end"><button type="button" className="btn-outline btn-sm !bg-white" onClick={onClose}>✕ Fermer</button></div>
        {children}
      </div>
    </div>
  );
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()} className={`max-h-[92vh] w-full ${wide ? "max-w-5xl" : "max-w-2xl"} overflow-y-auto rounded-t-3xl bg-[#fbf8f2] p-5 shadow-2xl sm:rounded-3xl`}>
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
          <TeamTabs cats={cats} counts={counts} teams={d.teams} onToggle={(t) => set({ teams: toggle(d.teams, t) })} />
        </Step>
      )}
      {d.kind === "EQUIPES" && (
        <label className="mb-4 block rounded-xl border-2 border-line bg-white p-3 font-bold text-ink">🏟️ Club rencontré <span className="font-normal text-muted">(facultatif)</span>
          <input aria-label="Club rencontré" maxLength={80} value={d.audience ?? ""} onChange={(e) => set({ audience: e.target.value })} placeholder="Ex. TC Dreux, US Mantes…" className="mt-1 w-full rounded-xl border-2 border-line bg-white px-3 py-2 font-normal" />
        </label>)}
      {d.kind === "EQUIPES" && <VenuePick value={d.place ?? ""} onChange={(v) => set({ place: v })} />}
      {d.kind === "EQUIPES" && <MatchWhere courts={d.courts} onCourts={(c) => set({ courts: c })} time={d.time ?? ""} onTime={(t) => set({ time: t })} />}
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
      </details>
      <label className="mb-4 block font-bold text-ink">📝 Description (facultative, 600 caractères)
        <textarea aria-label="Description de l'événement" rows={3} maxLength={600} value={d.note} onChange={(e) => set({ note: e.target.value })}
          placeholder="Quelques mots qui s'afficheront dans le planning et sur l'affiche"
          className="mt-1 w-full rounded-xl border-2 border-line bg-white px-3 py-2 font-normal" />
      </label>
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


// Choix des équipes d'un match : rangées dans trois ONGLETS (jeunes de 8 à 18 ans · seniors · vétérans +35 / +45 ans), messieurs et dames dans chacun
const TEAM_TABS: { id: string; label: string; match: (g: string) => boolean }[] = [
  { id: "jeunes", label: "🧒 Jeunes de 8 à 18 ans", match: (g) => g.startsWith("Jeunes") },
  { id: "seniors", label: "🎾 Seniors", match: (g) => g.startsWith("Seniors") },
  { id: "veterans", label: "🏅 Vétérans +35 / +45 ans", match: (g) => g.startsWith("Vétérans") },
];
function TeamTabs({ cats, counts, teams, onToggle }: { cats: typeof TEAM_CATS; counts: Record<string, number>; teams: string[]; onToggle: (t: string) => void }) {
  const inTab = (id: string) => cats.filter((c) => TEAM_TABS.find((t) => t.id === id)!.match(c.group));
  const picked = (id: string) => teams.filter((t) => inTab(id).some((c) => c.key === t.split("#")[0])).length;
  const [tab, setTab] = useState<string>(() => TEAM_TABS.find((t) => picked(t.id) > 0)?.id ?? TEAM_TABS.find((t) => inTab(t.id).length > 0)?.id ?? "jeunes");
  const sexOf = (key: string) => (key.startsWith("gar") || key.endsWith("-m") ? "👦 Messieurs / garçons" : "👧 Dames / filles");
  const list = inTab(tab);
  return (
    <div>
      <div role="tablist" aria-label="Catégories d'équipes" className="mb-2 flex flex-wrap gap-1.5">
        {TEAM_TABS.filter((t) => inTab(t.id).length > 0).map((t) => (
          <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)}
            className={"min-h-10 rounded-full border-2 px-3 text-sm font-extrabold " + (tab === t.id ? "border-ink bg-ink text-white" : "border-line bg-white text-ink hover:border-ink")}>
            {t.label}{picked(t.id) > 0 && <span className="ml-1.5 rounded-full bg-[#facc15] px-1.5 text-xs text-ink">{picked(t.id)}</span>}
          </button>
        ))}
      </div>
      {list.map((c, i) => (
        <div key={c.key}>
          {(i === 0 || sexOf(list[i - 1].key) !== sexOf(c.key)) && <b className="mt-2 block text-xs uppercase tracking-wide text-muted">{sexOf(c.key)}</b>}
          <div className="mt-1 flex flex-wrap items-center gap-2"><span className="w-44 text-sm font-bold text-ink sm:w-52">{c.label}</span>
            {Array.from({ length: counts[c.key] ?? c.def }, (_, n) => `${c.key}#${n + 1}`).map((t, n) => <Pill key={t} on={teams.includes(t)} color={c.color} onClick={() => onToggle(t)}>Éq. {n + 1}</Pill>)}
          </div>
        </div>
      ))}
    </div>
  );
}


// Liste déroulante + possibilité d'écrire soi-même (valeur gardée dans le parent)
function ChoiceOrText({ label, value, onChange, options, placeholder, maxLength = 80 }: { label: string; value: string; onChange: (v: string) => void; options: string[]; placeholder: string; maxLength?: number }) {
  const [other, setOther] = useState(() => !!value && !options.includes(value));
  return (
    <div className="grid gap-2">
      <select aria-label={label} className="min-h-12 w-full rounded-xl border-2 border-line bg-white px-3 font-bold text-ink" value={other ? "__autre" : value}
        onChange={(e) => { if (e.target.value === "__autre") { setOther(true); onChange(""); } else { setOther(false); onChange(e.target.value); } }}>
        <option value="">Choisir dans la liste…</option>
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
        <option value="__autre">✏️ Autre : je l'écris moi-même</option>
      </select>
      {other && <input aria-label={`${label} : écrit à la main`} maxLength={maxLength} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="min-h-12 w-full rounded-xl border-2 border-line bg-white px-3" />}
    </div>
  );
}

// « Contre quel club ? » : on écrit ou on touche une lettre ; la liste (clubs des Yvelines + clubs déjà notés) se réduit
const plain = (t: string) => t.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
function ClubPicker({ value, onChange, known, compact, label = "Club rencontré" }: { value: string; onChange: (v: string) => void; known: string[]; compact?: boolean; label?: string }) {
  const all = [...new Set([...known, ...YVELINES_CLUBS])].sort((a, b) => plain(a).localeCompare(plain(b), "fr"));
  const [letter, setLetter] = useState("");
  const letters = [...new Set(all.map((n) => plain(n)[0]?.toUpperCase()).filter(Boolean))] as string[];
  const q = plain(value.trim());
  const shown = all.filter((n) => (letter ? plain(n).startsWith(letter.toLowerCase()) : true) && (q ? plain(n).startsWith(q) || plain(n).includes(` ${q}`) || plain(n).includes(`-${q}`) : true));
  return (
    <div className="grid gap-2">
      <input aria-label={label} maxLength={80} value={value} onChange={(e) => { onChange(e.target.value); setLetter(""); }} placeholder="Écris le début du nom, ou touche une lettre…" className="min-h-12 w-full rounded-xl border-2 border-line bg-white px-3 font-bold text-ink" />
      <div className="flex flex-wrap gap-1" role="group" aria-label="Filtrer par première lettre">
        {letters.map((l) => <button key={l} type="button" aria-pressed={letter === l} onClick={() => { setLetter(letter === l ? "" : l); onChange(""); }} className={"size-8 rounded-lg border-2 text-sm font-extrabold " + (letter === l ? "border-ink bg-ink text-white" : "border-line bg-white text-ink hover:border-ink")}>{l}</button>)}
      </div>
      <ul className={`m-0 grid ${compact ? "max-h-28" : "max-h-52"} list-none gap-1 overflow-y-auto p-0`} aria-label="Clubs proposés">
        {shown.map((n) => <li key={n}><button type="button" aria-pressed={value === n} onClick={() => { onChange(n); setLetter(""); }} className={"w-full rounded-xl border-2 px-3 py-2 text-left font-bold " + (value === n ? "border-ink bg-ink text-white" : "border-line bg-white text-ink hover:border-ink")}>{value === n ? "✔ " : ""}{n}</button></li>)}
        {shown.length === 0 && <li className="rounded-xl bg-[#fff3cd] px-3 py-2 text-sm font-bold text-[#7a5a00]">Aucun club dans la liste : « {value} » sera écrit tel quel.</li>}
      </ul>
    </div>
  );
}

// Match par équipes : des CARTES qui s'ouvrent l'une après l'autre (une seule visible à la fois)
const MATCH_HOURS = ["9 h", "10 h", "11 h", "14 h", "14 h 30", "15 h", "15 h 30", "16 h", "17 h", "18 h", "20 h"];
function MatchCards({ c, patch, cats, counts, crew, onPeople, pastClubs, onExit, onSave, busy, err }: { onExit?: () => void; onSave?: () => void; busy?: boolean; err?: string; c: Sel; patch: (p: Partial<Sel>) => void; cats: typeof TEAM_CATS; counts: Record<string, number>; crew: { name: string; role: string }[]; onPeople: () => void; pastClubs: string[] }) {
  const [i, setI] = useState(0);
  const [ti, setTi] = useState(0); // équipe dont on choisit le club adverse
  const away = c.info.place === VENUE_AWAY;
  const steps = ["teams", "club", "venue", ...(away ? [] : ["courts"]), "hour", "end"] as const;
  const cur = steps[Math.min(i, steps.length - 1)];
  const next = () => setI((x) => Math.min(x + 1, steps.length - 1));
  const info = (p: Partial<PosterInfo>) => patch({ info: { ...c.info, ...p } });
  const Nav = ({ ok = true, skip }: { ok?: boolean; skip?: boolean }) => (
    <div className="mt-3 flex flex-wrap gap-2">
      <button type="button" className="btn-clay" disabled={!ok} onClick={next}>Continuer →</button>
      {skip && <button type="button" className="btn-outline" onClick={next}>Passer</button>}
    </div>
  );
  const card = (title: string, body: React.ReactNode) => (
    <section aria-label={title} className="grid gap-2 rounded-2xl border-2 border-[#2a7fc1] bg-white p-3 sm:p-4">
      <div className="flex items-center justify-between gap-2">
        {i > 0 ? <button type="button" className="border-0 bg-transparent p-0 text-sm font-bold text-ink underline" onClick={() => setI(i - 1)}>← Retour</button> : onExit ? <button type="button" className="border-0 bg-transparent p-0 text-sm font-bold text-ink underline" onClick={onExit}>← Changer de type d'événement</button> : <span />}
        <small className="font-bold text-muted">Étape {Math.min(i, steps.length - 1) + 1} sur {steps.length}</small>
      </div>
      <h4 className="m-0 font-display text-lg text-ink">{title}</h4>
      {body}
    </section>
  );
  if (cur === "teams") return card("Quelles équipes jouent ?", <><TeamTabs cats={cats} counts={counts} teams={c.teams} onToggle={(t) => patch({ teams: toggle(c.teams, t) })} /><Nav ok={c.teams.length > 0} /></>);
  const many = c.teams.length > 1;
  const clubOf = (t: string) => c.clubs?.[t] ?? "";
  if (cur === "club") return card(many ? "Contre quel club ? (un par équipe)" : "Contre quel club ?", many ? <>
    <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Équipe à régler">
      {c.teams.map((t, n) => (
        <button key={t} type="button" role="tab" aria-selected={Math.min(ti, c.teams.length - 1) === n} onClick={() => setTi(n)}
          className={"rounded-xl border-2 px-2.5 py-1.5 text-left text-xs font-extrabold leading-tight " + (Math.min(ti, c.teams.length - 1) === n ? "border-ink bg-ink text-white" : "border-line bg-white text-ink hover:border-ink")}>
          <span className="block">{teamLabel(t)}</span><span className="block font-bold opacity-80">{clubOf(t) ? `✔ ${clubOf(t)}` : "club à choisir"}</span>
        </button>))}
    </div>
    {(() => { const t = c.teams[Math.min(ti, c.teams.length - 1)]; return <ClubPicker compact label={`Club rencontré par ${teamLabel(t)}`} value={clubOf(t)} onChange={(v) => patch({ clubs: { ...c.clubs, [t]: v } })} known={pastClubs} />; })()}
    <button type="button" className="justify-self-start text-sm font-bold text-ink underline" onClick={() => patch({ clubs: Object.fromEntries(c.teams.map((t) => [t, clubOf(c.teams[0])])) })}>↧ Même club pour toutes les équipes (celui de la 1re)</button>
    <small className="text-muted">Facultatif : laisse vide une équipe dont l'adversaire n'est pas connu.</small><Nav skip /></> : <>
    <ClubPicker value={c.info.audience} onChange={(v) => info({ audience: v })} known={pastClubs} />
    <small className="text-muted">Facultatif. Clubs des Yvelines (liste à compléter) et clubs déjà notés ; un club absent s'écrit à la main.</small><Nav skip /></>);
  if (cur === "venue") return card("Où se joue le match ?", <>
    <div className="grid grid-cols-2 gap-2">
      {([[VENUE_HOME, "🏠 À domicile", "au club"], [VENUE_AWAY, "🚌 En déplacement", "chez l'adversaire"]] as const).map(([v, l, sub]) => (
        <button key={v} type="button" aria-pressed={c.info.place === v} onClick={() => { info({ place: v }); setI(i + 1); }}
          className={`rounded-xl border-2 px-3 py-4 text-left ${c.info.place === v ? "border-ink bg-ink text-white" : "border-line bg-white text-ink hover:border-ink"}`}>
          <span className="block font-bold">{l}</span><span className="block text-xs font-normal opacity-80">{sub}</span>
        </button>))}
    </div><Nav skip /></>);
  if (cur === "courts") return card("Sur quels terrains ?", <>
    <div className="flex flex-wrap gap-2" role="group" aria-label="Terrains du match">
      {COURTS.map((k) => <Pill key={k.n} on={c.courts.includes(k.n)} onClick={() => patch({ courts: toggle(c.courts, k.n).sort() })}>Court {k.n}</Pill>)}
      <Pill on={c.courts.length === COURTS.length} onClick={() => patch({ courts: c.courts.length === COURTS.length ? [] : COURTS.map((k) => k.n) })}>Tous</Pill>
    </div><small className="text-muted">Facultatif.</small><Nav skip /></>);
  if (cur === "hour") return card("À quelle heure ?", <>
    <ChoiceOrText label="Heure du match" value={c.info.time} onChange={(v) => info({ time: v })} options={MATCH_HOURS} placeholder="Ex. 14 h, ou 9 h – 17 h" />
    <small className="text-muted">Facultatif.</small><Nav skip /></>);
  return card("Dernier détail : un mot et qui s'en occupe", <>
    <label className="block text-sm font-bold text-ink">📝 Un mot sur ce match (facultatif)
      <textarea aria-label="Description : match par équipes" rows={2} maxLength={600} value={c.note} onChange={(e) => patch({ note: e.target.value })} placeholder="Quelques mots sur cet événement" className="mt-1 w-full rounded-xl border-2 border-line bg-white px-3 py-2 text-sm font-normal" />
    </label>
    <div className="rounded-xl border-2 border-line bg-white p-2"><b className="text-sm text-ink">👥 Qui s'en occupe ? ({c.who.length}) <span className="font-normal text-muted">(facultatif)</span></b>
      {ROLES.map((r) => { const list = crew.filter((x) => x.role === r.key); return list.length === 0 ? null : (
        <div key={r.key} className="mt-1.5 flex flex-wrap items-center gap-1.5"><span className="w-28 text-xs font-bold text-muted">{r.label}</span>
          {list.map((n) => <Pill key={n.name} on={c.who.includes(n.name)} onClick={() => patch({ who: toggle(c.who, n.name) })}>{n.name}</Pill>)}</div>); })}
      <button type="button" className="mt-2 text-xs font-bold text-ink underline" onClick={onPeople}>＋ Ajouter un bénévole ou un membre du bureau</button>
    </div>
    <button type="button" role="checkbox" aria-checked={c.star} onClick={() => patch({ star: !c.star })} className={`justify-self-start rounded-full border-2 px-3 py-1 text-sm font-bold ${c.star ? "border-[#d4a000] bg-[#fff3c4] text-[#5a4300]" : "border-line bg-white text-ink"}`}>{c.star ? "⭐" : "☆"} Mettre en avant <small className="font-normal text-muted">(3 max / mois)</small></button>
    <div className="rounded-xl bg-[#eef3fb] p-3 text-sm font-bold text-[#1b1863]">🎾 {many ? c.teams.map((t) => `${teamLabel(t)}${clubOf(t) ? ` (contre ${clubOf(t)})` : ""}`).join(" · ") : `${c.teams.map(teamLabel).join(" · ") || "—"}${c.info.audience ? ` · contre ${c.info.audience}` : ""}`}{c.info.place ? ` · ${c.info.place === VENUE_HOME ? "🏠 à domicile" : "🚌 en déplacement"}` : ""}{c.info.time ? ` · 🕒 ${c.info.time}` : ""}{!away && c.courts.length ? ` · 🏟️ Court${c.courts.length > 1 ? "s" : ""} ${c.courts.join(", ")}` : ""}</div>
    <Err msg={err} />{onSave ? <button type="button" className="btn-clay justify-self-start" disabled={busy} onClick={onSave}>✔ Enregistrer ce match</button> : <small className="text-muted">Tout est prêt : touche « ✔ Enregistrer » en bas.</small>}</>);
}

// Tournoi : des CARTES qui s'ouvrent l'une après l'autre (type → catégorie → classements si TMC → surface → horaires → dernier détail)
const TOUR_TYPES = [{ key: "TMC", label: "TMC", sub: "Tournoi multi-chances : des matchs garantis, entre joueurs de niveaux proches", icon: "🎯" }, { key: "OPEN", label: "Tournoi open", sub: "Ouvert à tous les niveaux, sans limite de classement", icon: "🏆" }] as const;
const tourWord = (key: string) => (key === "sen-m" ? "messieurs" : key === "sen-d" ? "dames" : teamCat(key)?.label ?? "");
// Ce qui est gardé dans « audience » : la grande famille (pour la couleur de l'affiche) puis, si utile, le détail
const tourAudience = (keys: string[]) => {
  if (keys.length > 1) {
    const d = keys.map((k) => teamCat(k)?.label ?? "").join(", ");
    if (keys.every((k) => k.startsWith("vet-"))) { // plusieurs catégories de vétérans
      const ages = keys.map((k) => `+${k.split("-")[1]} ans`).filter((a, i, l) => l.indexOf(a) === i).join(", ");
      const allM = keys.every((k) => k.endsWith("-m")), allD = keys.every((k) => k.endsWith("-d"));
      return `${allM ? "Messieurs (adultes)" : allD ? "Dames (adultes)" : "Vétérans"} · ${ages}`;
    }
    return `Jeunes · ${d.length > 100 ? `${keys.length} catégories d'âge` : d}`;
  }
  const key = keys[0] ?? "";
  const base = key.startsWith("gar-") || key.startsWith("fil-") ? "Jeunes" : key.endsWith("-m") ? "Messieurs (adultes)" : "Dames (adultes)";
  const detail = base === "Jeunes" ? teamCat(key)?.label ?? "" : key.startsWith("vet-") ? `+${key.split("-")[1]} ans` : "";
  return detail ? `${base} · ${detail}` : base;
};
function TournoiCards({ c, patch, crew, onPeople, onExit, onSave, busy, err }: { onExit?: () => void; onSave?: () => void; busy?: boolean; err?: string; c: Sel; patch: (p: Partial<Sel>) => void; crew: { name: string; role: string }[]; onPeople: () => void }) {
  const [i, setI] = useState(0);
  const [type, setType] = useState<"" | "TMC" | "OPEN">("");
  const [pub, setPub] = useState<"jeunes" | "seniors">("seniors");
  const [catKeys, setCatKeys] = useState<string[]>([]); // plusieurs catégories d'âge possibles pour un tournoi de jeunes
  const catKey = catKeys[0] ?? "";
  const [bas, setBas] = useState("");
  const [haut, setHaut] = useState("");
  const [edited, setEdited] = useState(false);
  const tmc = type === "TMC";
  const isJ = (k: string) => k.startsWith("gar-") || k.startsWith("fil-"), isV = (k: string) => k.startsWith("vet-");
  const multiOk = (k: string) => (isJ(k) && catKeys.every(isJ)) || (isV(k) && catKeys.every(isV)); // plusieurs jeunes, ou plusieurs vétérans (pas de mélange)
  const steps = ["type", "cat", ...(tmc ? ["rank"] : []), "surface", "when", "end"] as const;
  const cur = steps[Math.min(i, steps.length - 1)];
  const next = () => setI((x) => Math.min(x + 1, steps.length - 1));
  const rankOk = !bas || !haut || RANKINGS.indexOf(bas) <= RANKINGS.indexOf(haut);
  const range = tmc && bas && haut && rankOk ? ` de ${bas} à ${haut}` : "";
    // Plusieurs catégories : le nom reste COURT (« Tournoi open jeunes », « Tournoi open vétérans ») ; le détail est sur l'affiche
  const vets = catKeys.length > 1 && catKeys.every((k) => k.startsWith("vet-"));
  const words = catKeys.length > 1 ? (vets ? `vétérans${catKeys.every((k) => k.endsWith("-m")) ? " messieurs" : catKeys.every((k) => k.endsWith("-d")) ? " dames" : ""}` : "jeunes") : tourWord(catKey);
  const auto = type && catKey ? `${type === "TMC" ? "TMC" : "Tournoi open"} ${words}${range}` : "";
  const info = (p: Partial<PosterInfo>) => patch({ info: { ...c.info, ...p } });
  useEffect(() => { if (!edited && auto && c.title !== auto) patch({ title: auto, info: { ...c.info, audience: tourAudience(catKeys) } }); });
  const Nav = ({ ok = true, skip }: { ok?: boolean; skip?: boolean }) => (
    <div className="mt-3 flex flex-wrap gap-2">
      <button type="button" className="btn-clay" disabled={!ok} onClick={next}>Continuer →</button>
      {skip && <button type="button" className="btn-outline" onClick={next}>Passer</button>}
    </div>
  );
  const card = (title: string, body: React.ReactNode) => (
    <section aria-label={title} className="grid gap-2 rounded-2xl border-2 border-[#2a7fc1] bg-white p-3 sm:p-4">
      <div className="flex items-center justify-between gap-2">
        {i > 0 ? <button type="button" className="border-0 bg-transparent p-0 text-sm font-bold text-ink underline" onClick={() => setI(i - 1)}>← Retour</button> : onExit ? <button type="button" className="border-0 bg-transparent p-0 text-sm font-bold text-ink underline" onClick={onExit}>← Changer de type d'événement</button> : <span />}
        <small className="font-bold text-muted">Étape {Math.min(i, steps.length - 1) + 1} sur {steps.length}</small>
      </div>
      <h4 className="m-0 font-display text-lg text-ink">{title}</h4>
      {body}
    </section>
  );
  const selCls = "w-full rounded-xl border-2 border-line bg-white px-3 py-2 text-sm font-bold text-ink";
  if (cur === "type") return card("Quel type de tournoi ?", <>
    <div className="grid gap-2 sm:grid-cols-2">
      {TOUR_TYPES.map((t) => (
        <button key={t.key} type="button" aria-pressed={type === t.key} onClick={() => { setType(t.key); if (t.key === "OPEN") { setBas(""); setHaut(""); } setI(1); }}
          className={`rounded-xl border-2 px-3 py-3 text-left ${type === t.key ? "border-ink bg-ink text-white" : "border-line bg-white text-ink hover:border-ink"}`}>
          <b className="block text-lg">{t.icon} {t.label}</b><small className="block font-normal opacity-80">{t.sub}</small></button>))}
    </div></>);
  if (cur === "cat") {
    const groups = pub === "jeunes" ? ["Jeunes · garçons", "Jeunes · filles"] : ["Seniors", "Vétérans"];
    return card("Pour quelle catégorie ?", <>
      <div role="tablist" aria-label="Jeunes ou seniors" className="grid grid-cols-2 gap-1 rounded-xl bg-[#e9edf5] p-1">
        {([["jeunes", "🧒 Jeunes"], ["seniors", "🎾 Seniors"]] as const).map(([k, l]) => (
          <button key={k} type="button" role="tab" aria-selected={pub === k} onClick={() => { setPub(k); setCatKeys([]); }} className={`rounded-lg px-3 py-2 font-extrabold ${pub === k ? "bg-[#1b1863] text-white shadow" : "text-ink hover:bg-white"}`}>{l}</button>))}
      </div>
      {groups.map((g) => (
        <div key={g}><b className="text-sm text-muted">{g}</b>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {TEAM_CATS.filter((t) => t.group === g).map((t) => (
              <Pill key={t.key} on={catKeys.includes(t.key)} onClick={() => setCatKeys(multiOk(t.key) ? toggle(catKeys, t.key) : [t.key])}>{tourWord(t.key).replace(/^./, (x) => x.toUpperCase())}</Pill>))}
          </div></div>))}
      <p className="m-0 text-sm text-muted">{pub === "jeunes" ? "Tu peux toucher plusieurs catégories d'âge (garçons et filles)" : "Pour les vétérans, tu peux toucher plusieurs catégories (+35, +45, messieurs et dames)"} : touche une seconde fois pour en retirer une.{catKeys.length > 1 ? ` ✔ ${catKeys.length} catégories choisies.` : ""}</p>
      <Nav ok={!!catKey} /></>);
  }
  if (cur === "rank") return card("Entre quels classements ?", <>
    <p className="m-0 text-sm text-muted">Pour un TMC, on indique le classement le plus bas et le plus haut des joueurs admis (de NC à -30).</p>
    <div className="grid gap-2 sm:grid-cols-2">
      <label className="text-sm font-bold text-ink">⬇️ Classement le plus bas
        <select aria-label="Classement le plus bas" className={selCls} value={bas} onChange={(e) => setBas(e.target.value)}><option value="">Choisir…</option>{RANKINGS.map((r) => <option key={r} value={r}>{r}</option>)}</select></label>
      <label className="text-sm font-bold text-ink">⬆️ Classement le plus haut
        <select aria-label="Classement le plus haut" className={selCls} value={haut} onChange={(e) => setHaut(e.target.value)}><option value="">Choisir…</option>{RANKINGS.map((r) => <option key={r} value={r}>{r}</option>)}</select></label>
    </div>
    {!rankOk && <p role="alert" className="m-0 rounded-xl bg-[#fff3cd] px-3 py-2 text-sm font-bold text-[#7a5a00]">Le classement le plus bas doit être plus bas que le plus haut : inverse-les.</p>}
    {range && <p className="m-0 rounded-xl bg-[#eef3fb] px-3 py-2 text-sm font-bold text-[#1b1863]">🎯 Tournoi réservé aux classements{range.replace(" de", "")}</p>}
    <Nav ok={rankOk} skip /></>);
  if (cur === "surface") return card("Sur quelle surface ?", <>
    <ChoiceField label="Surface" options={SURFACES} value={c.info.place} onChange={(v) => info({ place: v })} placeholder="Ex. Terre battue couverte" /><Nav skip /></>);
  if (cur === "when") return card("Horaires et finale", <>
    <label className="block text-sm font-bold text-ink">🕒 Horaires des matchs, jour par jour <small className="font-normal text-muted">(facultatif)</small>
      <input aria-label="Horaires des matchs" maxLength={80} value={c.info.time} onChange={(e) => info({ time: e.target.value })} placeholder="Ex. Sam. 9 h – 19 h · Dim. 9 h – 18 h" className="mt-1 w-full rounded-xl border-2 border-line bg-white px-3 py-2 text-sm font-normal" /></label>
    <label className="block text-sm font-bold text-ink">🏆 Date et heure de la finale <small className="font-normal text-muted">(facultatif)</small>
      <input aria-label="Finale" maxLength={120} value={c.info.signup} onChange={(e) => info({ signup: e.target.value })} placeholder="Ex. Dimanche 15 novembre à 16 h" className="mt-1 w-full rounded-xl border-2 border-line bg-white px-3 py-2 text-sm font-normal" /></label>
    <Nav skip /></>);
  return card("Dernier détail : le nom et qui s'en occupe", <>
    <label className="block text-sm font-bold text-ink">🏷️ Nom du tournoi
      <input aria-label="Nom du tournoi" maxLength={80} value={c.title ?? ""} onChange={(e) => { setEdited(true); patch({ title: e.target.value }); }} className="mt-1 w-full rounded-xl border-2 border-line bg-white px-3 py-2 text-sm font-normal" /></label>
    <label className="block text-sm font-bold text-ink">💬 Petit message <small className="font-normal text-muted">(facultatif)</small>
      <textarea aria-label="Petit message" rows={2} maxLength={600} value={c.note} onChange={(e) => patch({ note: e.target.value })} placeholder="Ex. Buvette sur place, remise des prix après la finale…" className="mt-1 w-full rounded-xl border-2 border-line bg-white px-3 py-2 text-sm font-normal" /></label>
    <div className="rounded-xl border-2 border-line bg-white p-2"><b className="text-sm text-ink">👥 Qui s'en occupe ? ({c.who.length}) <span className="font-normal text-muted">(facultatif)</span></b>
      {ROLES.map((r) => { const list = crew.filter((x) => x.role === r.key); return list.length === 0 ? null : (
        <div key={r.key} className="mt-1.5 flex flex-wrap items-center gap-1.5"><span className="w-28 text-xs font-bold text-muted">{r.label}</span>
          {list.map((n) => <Pill key={n.name} on={c.who.includes(n.name)} onClick={() => patch({ who: toggle(c.who, n.name) })}>{n.name}</Pill>)}</div>); })}
      <button type="button" className="mt-2 text-xs font-bold text-ink underline" onClick={onPeople}>＋ Ajouter un bénévole ou un membre du bureau</button>
    </div>
    <button type="button" role="checkbox" aria-checked={c.star} onClick={() => patch({ star: !c.star })} className={`justify-self-start rounded-full border-2 px-3 py-1 text-sm font-bold ${c.star ? "border-[#d4a000] bg-[#fff3c4] text-[#5a4300]" : "border-line bg-white text-ink"}`}>{c.star ? "⭐" : "☆"} Mettre en avant <small className="font-normal text-muted">(3 max / mois)</small></button>
    <div className="rounded-xl bg-[#eef3fb] p-3 text-sm font-bold text-[#1b1863]">🏆 {c.title || "—"}{c.info.place ? ` · 🎾 ${c.info.place}` : ""}{c.info.time ? ` · 🕒 ${c.info.time}` : ""}{c.info.signup ? ` · 🏆 finale : ${c.info.signup}` : ""}</div>
    <Err msg={err} />{onSave ? <button type="button" className="btn-clay justify-self-start" disabled={busy || !c.title?.trim()} onClick={onSave}>✔ Enregistrer ce tournoi</button> : null}</>);
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

const ROLES = [{ key: "PRESIDENT", label: "Président du club" }, { key: "PROF", label: "Professeurs" }, { key: "BENEVOLE", label: "Bénévoles" }, { key: "BUREAU", label: "Bureau" }];

function saveBlob(blob: Blob, name: string) {
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name;
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}
const POSTER_KINDS = ["TOURNOI", "ANIMATION", "STAGE_ENFANTS", "STAGE_ADULTES", "FETE", "FETE_ECOLE", "JUMELAGE"];
const hasPoster = (e: ClubEvent) => !!(e.time || e.place || e.signup || e.audience || e.bring || (e.formulas ?? []).length);

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

interface Sel { clubs?: Record<string, string>; title?: string; on: boolean; courts: number[]; who: string[]; teams: string[]; note: string; star: boolean; info: PosterInfo; id?: string }
// Match par équipes : deux gros boutons « à domicile » / « en déplacement » (on retouche pour effacer)
function VenuePick({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="mb-4 rounded-xl border-2 border-line bg-white p-3 font-bold text-ink" role="group" aria-label="Où se joue le match ?">
      <span>📍 Où se joue le match ? <span className="font-normal text-muted">(facultatif)</span></span>
      <div className="mt-2 grid grid-cols-2 gap-2">
        {([[VENUE_HOME, "🏠 À domicile", "au club"], [VENUE_AWAY, "🚌 En déplacement", "chez l'adversaire"]] as const).map(([v, l, s]) => (
          <button key={v} type="button" aria-pressed={value === v} onClick={() => onChange(value === v ? "" : v)}
            className={`rounded-xl border-2 px-3 py-3 text-left ${value === v ? "border-ink bg-ink text-white" : "border-line bg-white text-ink hover:border-ink"}`}>
            <span className="block">{l}</span><span className="block text-xs font-normal opacity-80">{s}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

// Match par équipes : sur quels terrains et à quelle heure (écrits sur l'affiche du mois)
function MatchWhere({ courts, onCourts, time, onTime }: { courts: number[]; onCourts: (c: number[]) => void; time: string; onTime: (t: string) => void }) {
  return (
    <div className="mb-4 rounded-xl border-2 border-line bg-white p-3 font-bold text-ink">
      <span>🏟️ Sur quels terrains ? <span className="font-normal text-muted">(facultatif)</span></span>
      <div className="mt-2 flex flex-wrap gap-2" role="group" aria-label="Terrains du match">
        {COURTS.map((c) => <Pill key={c.n} on={courts.includes(c.n)} onClick={() => onCourts(toggle(courts, c.n).sort())}>Court {c.n}</Pill>)}
        <Pill on={courts.length === COURTS.length} onClick={() => onCourts(courts.length === COURTS.length ? [] : COURTS.map((c) => c.n))}>Tous</Pill>
      </div>
      <label className="mt-3 block">🕒 À quelle heure ? <span className="font-normal text-muted">(facultatif)</span>
        <input aria-label="Heure du match" maxLength={80} value={time} onChange={(e) => onTime(e.target.value)} placeholder="Ex. 14 h, ou 9 h – 17 h" className="mt-1 w-full rounded-xl border-2 border-line bg-white px-3 py-2 font-normal" />
      </label>
    </div>
  );
}

const infoOf = (e: ClubEvent): PosterInfo => ({ time: e.time ?? "", place: e.place ?? "", signup: e.signup ?? "", formulas: e.formulas ?? [], audience: e.audience ?? "", bring: e.bring ?? "" });
const cleanInfo = (i: PosterInfo) => ({ time: i.time.trim(), place: i.place.trim(), signup: i.signup.trim(), audience: i.audience.trim(), bring: i.bring.trim(), formulas: i.formulas.filter((f) => f.label.trim() || f.price.trim() || (f.priceMember ?? "").trim()).map((f) => ({ label: f.label.trim(), price: f.price.trim(), priceMember: (f.priceMember ?? "").trim(), detail: (f.detail ?? "").trim(), group: (f.group ?? "").trim() })) });
function DayMenu({ ask, endInit, day, events, counts, crew, onPeople, onClose, onDone, onEvent }: { ask?: boolean; endInit?: string; onEvent: (e: ClubEvent) => void; day: string; events: ClubEvent[]; counts: Record<string, number>; crew: { name: string; role: string }[]; onPeople: () => void; onClose: () => void; onDone: (created?: ClubEvent) => void }) {
  const [start, setStart] = useState(day);
  const [end, setEnd] = useState(endInit ?? day);
  const [pickEnd, setPickEnd] = useState(false);
  const [tourFlow, setTourFlow] = useState(false); // idem pour un tournoi
  const [matchFlow, setMatchFlow] = useState(false); // vrai quand on remplit un match par équipes carte par carte (la carte est alors seule à l'écran)
  const [step, setStep] = useState<1 | 2>(1); // 1 = combien de jours ? · 2 = quel type d'événement ?
  const [multi, setMulti] = useState(endInit !== undefined && endInit !== day);
  const [chosen, setChosen] = useState(!ask); // en mode « ajouter », rien ne s'enregistre tant qu'aucune date n'est choisie
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  // Ce qui est coché au départ = les événements déjà placés exactement ce jour-là ; changer les dates NE touche PAS aux cases cochées
  const [sel, setSel] = useState<Record<string, Sel>>(() => {
    const m: Record<string, Sel> = {};
    for (const k of KINDS) { const e = events.find((x) => x.kind === k.key && x.startDate === day && x.endDate === (endInit ?? day)); m[k.key] = e ? { title: e.title ?? "", on: true, courts: e.courts, who: e.who, teams: e.teams, note: e.note ?? "", star: !!e.featured, info: infoOf(e), id: e.id } : { on: false, courts: [], who: [], teams: [], note: "", star: false, info: emptyInfo() }; }
    return m;
  });
  const placed = (k: string) => { const id = sel[k]?.id; return id ? events.find((x) => x.id === id) : undefined; };
  const already = events.filter((e) => e.startDate <= end && e.endDate >= start);
  const patch = (k: string, p: Partial<Sel>) => setSel((x) => ({ ...x, [k]: { ...x[k], ...p } }));
  const cats = TEAM_CATS.filter((c) => (counts[c.key] ?? c.def) > 0);
  const missing = sel.EQUIPES?.on && sel.EQUIPES.teams.length === 0 ? "Choisis au moins une équipe pour le match par équipes." : "";
  const noName = sel.AUTRE?.on && !(sel.AUTRE.title ?? "").trim() ? "Écris le nom de ton événement (ex. Repas des bénévoles)." : "";
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
      let created: ClubEvent | undefined;
      for (const k of KINDS) {
        const c = sel[k.key]; const old = placed(k.key);
        if (c.on && !old && k.key === "EQUIPES" && c.teams.length > 1) {
          // plusieurs équipes le même jour : UNE LIGNE PAR ÉQUIPE (chacune avec sa catégorie), mêmes infos communes ; l'étoile seulement sur la première
          for (const [n, t] of c.teams.entries()) await post<ClubEvent>("/club/events", { kind: "EQUIPES", startDate: start, endDate: end, bands: [], courts: c.courts, teams: [t], who: c.who, note: c.note.trim() || undefined, featured: c.star && n === 0, ...cleanInfo({ ...c.info, audience: c.clubs?.[t] ?? c.info.audience }) });
        }
        else if (c.on && !old) { const r = await post<ClubEvent>("/club/events", { kind: k.key, title: c.title?.trim() || undefined, startDate: start, endDate: end, bands: [], courts: k.key === "EQUIPES" ? c.courts : k.courts ?? [], teams: c.teams, who: c.who, note: c.note.trim() || undefined, featured: c.star, ...cleanInfo(c.info) }); if (!created && POSTER_KINDS.includes(k.key)) created = r; }
        else if (c.on && old && (c.star !== !!old.featured || (c.title ?? "").trim() !== (old.title ?? "").trim() || c.note.trim() !== (old.note ?? "").trim() || c.who.join() !== old.who.join() || c.teams.join() !== old.teams.join() || (k.key === "EQUIPES" && c.courts.join() !== old.courts.join()) || JSON.stringify(cleanInfo(c.info)) !== JSON.stringify(cleanInfo(infoOf(old))) || old.startDate !== start || old.endDate !== end)) await put(`/club/events/${old.id}`, { kind: old.kind, title: c.title?.trim() || undefined, startDate: start, endDate: end, bands: old.bands, courts: k.key === "EQUIPES" ? c.courts : old.courts, teams: c.teams, who: c.who, note: c.note.trim() || undefined, featured: c.star, ...cleanInfo(c.info), allowConflict: true });
        else if (!c.on && old) await del(`/club/events/${old.id}`);
      }
      onDone(created);
    } catch (e: any) { setErr(e.message || "Impossible d'enregistrer."); setBusy(false); }
  };
  const FAMILIES: { name: string; icon: string; color: string; kinds: string[] }[] = [
    { name: "Compétition", icon: "🏆", color: "#D35400", kinds: ["TOURNOI", "EQUIPES"] },
    { name: "Animation", icon: "🎉", color: "#8E44AD", kinds: ["ANIMATION", "FETE", "JUMELAGE"] },
    { name: "Stages", icon: "🎾", color: "#27AE60", kinds: ["STAGE_ENFANTS", "STAGE_ADULTES"] },
    { name: "Maintenance des installations", icon: "🔧", color: "#A04000", kinds: ["BULLE_MONTAGE_TB", "BULLE_DEMONTAGE_TB", "BULLE_MONTAGE_QUICK", "BULLE_DEMONTAGE_QUICK", "MAINT_BULLE_TB", "MAINT_BULLE_QUICK", "TERRE_BATTUE"] },
    { name: "Événement pédagogique", icon: "🎓", color: "#2C3E50", kinds: ["FETE_ECOLE", "INSCRIPTIONS", "DEBUT_COURS", "FIN_COURS"] },
    { name: "Vie associative", icon: "🏛️", color: "#1F618D", kinds: ["AG", "AGE"] },
    { name: "＋ Ajouter un autre événement", icon: "📌", color: "#566573", kinds: ["AUTRE"] },
  ];
  const setDays = (n: number) => { setChosen(true); setPickEnd(false); setEnd(addDays(start, Math.max(0, Math.min(365, n - 1)))); };
  const nbDays = diffDays(start, end) + 1;
  if (matchFlow && step === 2 && sel.EQUIPES?.on) return (
    <Modal bare title="Match par équipes" onClose={onClose}>
      <MatchCards c={sel.EQUIPES} patch={(p) => patch("EQUIPES", p)} cats={cats} counts={counts} crew={crew} onPeople={onPeople} pastClubs={[...new Set(events.filter((x) => x.kind === "EQUIPES" && x.audience).map((x) => x.audience!))]}
        onExit={() => { setMatchFlow(false); patch("EQUIPES", { on: false }); }} onSave={save} busy={busy || !!missing || !chosen} err={err || missing} />
    </Modal>
  );
  if (tourFlow && step === 2 && sel.TOURNOI?.on) return (
    <Modal bare title="Tournoi" onClose={onClose}>
      <TournoiCards c={sel.TOURNOI} patch={(p) => patch("TOURNOI", p)} crew={crew} onPeople={onPeople}
        onExit={() => { setTourFlow(false); patch("TOURNOI", { on: false }); }} onSave={save} busy={busy || !chosen} err={err} />
    </Modal>
  );
  return (
    <Modal title={chosen ? `📅 ${end === start ? fmtDay(start) : fmtRange(start, end)}` : "📅 Nouvel événement"} onClose={onClose}>
      {step === 1 ? (
        <div>
          <p className="mb-3 mt-0 rounded-xl bg-[#1b1863] px-3 py-2 text-sm font-bold text-white">Étape 1 sur 3 · Combien de jours dure l'événement ?</p>
          <div className="mb-3 grid grid-cols-2 gap-2">
            <button type="button" aria-pressed={!multi} onClick={() => { setMulti(false); setEnd(start); setPickEnd(false); }} className={`rounded-xl border-2 px-3 py-3 text-left font-bold ${!multi ? "border-[#2E86C1] bg-[#e8f3fb] text-ink" : "border-line bg-white text-ink hover:border-ink"}`}>📅 Un seul jour</button>
            <button type="button" aria-pressed={multi} onClick={() => setMulti(true)} className={`rounded-xl border-2 px-3 py-3 text-left font-bold ${multi ? "border-[#2E86C1] bg-[#e8f3fb] text-ink" : "border-line bg-white text-ink hover:border-ink"}`}>📆 Plusieurs jours</button>
          </div>
          {(ask || multi) && (
            <div className="mb-3 rounded-xl border-2 border-line bg-white p-3">
              <p className="m-0 mb-2 text-sm font-extrabold text-ink">{ask ? (multi ? "Touche le premier puis le dernier jour" : "Touche le jour de l'événement") : "Touche sur le calendrier le DERNIER jour de l'événement"}</p>
              <MiniCalendar start={start} end={end} onPick={ask ? (multi ? pickDate : (x: string) => { setChosen(true); setStart(x); setEnd(x); }) : pickLast} />
            </div>
          )}
          <p className="mb-3 mt-0 text-sm font-bold text-ink">{!chosen ? "👉 Choisis d'abord la date." : nbDays === 1 ? `✔ Une seule journée : le ${fmtDay(start)}` : `✔ Du ${fmtDay(start)} au ${fmtDay(end)} (${nbDays} jours)`}</p>
          <button type="button" className="btn-clay" disabled={!chosen} onClick={() => setStep(2)}>Valider la durée →</button>
        </div>
      ) : (<>
      <p className="mb-3 mt-0 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-[#1b1863] px-3 py-2 text-sm font-bold text-white"><span>Étape 2 sur 3 · Quel type d'événement veux-tu inscrire ? <span className="font-normal opacity-90">({nbDays === 1 ? "1 jour" : `${nbDays} jours`})</span></span><button type="button" className="rounded-lg bg-white px-2 py-1 text-xs font-extrabold text-[#1b1863]" onClick={() => setStep(1)}>↩ Changer la durée</button></p>
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
      {FAMILIES.map((fam) => {
        const g = fam.name; const gk = fam.kinds.map((id) => KINDS.find((k) => k.key === id)!).filter(Boolean); const gm = fam;
        const on = gk.filter((k) => sel[k.key]?.on);
        return (
          <Fold key={g} color={gm.color} icon={gm.icon} title={g} badge={on.length} hint={on.length ? `✔ ${on.map((k) => k.label).join(" · ")}` : `${gk.length} choix`}>
            <div className="grid gap-2 sm:grid-cols-2">
              {gk.map((k) => { const c = sel[k.key] ?? { on: false }; return (
                <button key={k.key} type="button" role="checkbox" aria-checked={!!c.on} onClick={() => { if (k.key === "EQUIPES" && !c.on) setMatchFlow(true); if (k.key === "TOURNOI" && !c.on && !c.id) setTourFlow(true); patch(k.key, { on: !c.on }); }}
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
                <Fragment key={k.key}>
                <div className="mt-3 rounded-xl border-l-8 bg-[#fbf8f2] p-3" style={{ borderColor: k.color }}>
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                    <b className="text-ink">{k.icon} {k.label}</b>
                    <button type="button" role="checkbox" aria-checked={c.star} onClick={() => patch(k.key, { star: !c.star })}
                      className={`flex items-center gap-1.5 rounded-full border-2 px-3 py-1 text-sm font-bold ${c.star ? "border-[#d4a000] bg-[#fff3c4] text-[#5a4300]" : "border-line bg-white text-ink hover:border-ink"}`}>
                      <span aria-hidden>{c.star ? "⭐" : "☆"}</span> Mettre en avant <small className="font-normal text-muted">(3 max / mois)</small>
                    </button>
                  </div>
                  {k.key === "EQUIPES" ? <MatchCards c={c} patch={(p) => patch(k.key, p)} cats={cats} counts={counts} crew={crew} onPeople={onPeople} pastClubs={[...new Set(events.filter((x) => x.kind === "EQUIPES" && x.audience).map((x) => x.audience!))]} /> : (<>
                  {(k.key === "TOURNOI" || k.key === "ANIMATION" || k.key === "AUTRE") && (
                    <label className="mb-2 block text-sm font-bold text-ink">🏷️ Nom {k.key === "TOURNOI" ? "du tournoi" : k.key === "AUTRE" ? "de ton événement" : "de l'animation"} {k.key === "AUTRE" ? "(obligatoire)" : "(facultatif)"}
                      <input aria-label={`Nom : ${k.label}`} maxLength={80} value={c.title ?? ""} onChange={(e) => patch(k.key, { title: e.target.value })} placeholder={k.key === "TOURNOI" ? "Ex. TMC messieurs de 15/1 à 4/6" : k.key === "AUTRE" ? "Ex. Repas des bénévoles" : "Ex. Soirée jeux"} className="mt-1 w-full rounded-xl border-2 border-line bg-white px-3 py-2 font-normal" />
                    </label>)}
                  {!POSTER_KINDS.includes(k.key) && (
                    <div className="rounded-xl border-2 border-line bg-white p-3">
                      <label className="block text-sm font-bold text-ink">📝 Description (facultatif)
                        <textarea aria-label={`Description : ${k.label}`} rows={2} maxLength={600} value={c.note} onChange={(e) => patch(k.key, { note: e.target.value })}
                          placeholder="Quelques mots sur cet événement"
                          className="mt-1 w-full rounded-xl border-2 border-line bg-white px-3 py-2 text-sm font-normal" />
                      </label>
                    </div>
                  )}
                  <details className="mt-2 rounded-xl border-2 border-line bg-white p-2"><summary className="cursor-pointer text-sm font-bold text-ink">👥 Qui s'en occupe ? ({c.who.length}) <span className="font-normal text-muted">(facultatif)</span></summary>
                    {ROLES.map((r) => { const list = crew.filter((x) => x.role === r.key); return list.length === 0 ? null : (
                      <div key={r.key} className="mt-1.5 flex flex-wrap items-center gap-1.5"><span className="w-28 text-xs font-bold text-muted">{r.label}</span>
                        {list.map((n) => <Pill key={n.name} on={c.who.includes(n.name)} onClick={() => patch(k.key, { who: toggle(c.who, n.name) })}>{n.name}</Pill>)}</div>
                    ); })}
                    <button type="button" className="mt-2 text-xs font-bold text-ink underline" onClick={onPeople}>＋ Ajouter un bénévole ou un membre du bureau</button>
                  </details>
                  </>)}
                </div>
                </Fragment>
              );
            })}
          </Fold>
        );
      })}
      <Err msg={err || missing || noName} />
      <button type="button" className="btn-clay mt-2" disabled={busy || !!missing || !!noName || !!nothing || !chosen} onClick={save}>✔ Enregistrer</button>
      </>)}
    </Modal>
  );
}

// ───────────── Affiche d'un événement : A4 à imprimer ou carré pour les réseaux, enregistrée en PDF ou en image ─────────────
function PlacedModal({ e, onLater, onPoster }: { e: ClubEvent; onLater: () => void; onPoster: () => void }) {
  const k = kindOf(e.kind);
  return (
    <Modal title="✔ Événement enregistré" onClose={onLater}>
      <div className="px-2 py-4 text-center">
        <div aria-hidden className="mx-auto mb-3 grid size-16 place-items-center rounded-full bg-[#3fb97a] text-4xl text-white shadow-[0_0_0_8px_#3fb97a33]">✓</div>
        <h3 className="m-0 text-2xl text-ink">C'est placé dans le planning !</h3>
        <p className="mb-4 mt-1 text-muted">Tu peux maintenant fabriquer l'affiche.</p>
        <p className="mx-auto mb-5 inline-block rounded-2xl border-2 bg-white px-4 py-2 font-extrabold text-ink" style={{ borderColor: k.color }}>{k.icon} {titleOf(e)} · {fmtRange(e.startDate, e.endDate)}</p>
        <div className="grid gap-2">
          <button type="button" className="btn-clay" onClick={onPoster}>🪧 Créer l'affiche maintenant</button>
          <button type="button" className="btn-outline bg-white hover:bg-ink hover:text-white" onClick={onLater}>Plus tard</button>
        </div>
        <p className="mb-0 mt-3 text-xs text-muted">Tu pourras toujours la faire plus tard en touchant l'événement dans le calendrier.</p>
      </div>
    </Modal>
  );
}

// ───────────── Mise en forme du texte de l'affiche : taille, gras, italique, souligné, alignement, bloc par bloc ─────────────
const FMT_BLOCKS: { key: BlockKey; label: string }[] = [
  { key: "titre", label: "Titre" }, { key: "date", label: "Date" }, { key: "infos", label: "Cartes d'infos" }, { key: "tarifs", label: "Tarifs" }, { key: "texte", label: "Description" },
];
function FormatPanel({ fmt, onChange }: { fmt: PosterFmt; onChange: (f: PosterFmt) => void }) {
  const [open, setOpen] = useState(false);
  const [key, setKey] = useState<BlockKey>("titre");
  const cur: BlockFmt = fmt[key] ?? {};
  const set = (patch: Partial<BlockFmt>) => onChange({ ...fmt, [key]: { ...cur, ...patch } });
  const size = cur.size ?? 0;
  const tog = (label: string, on: boolean | undefined, f: () => void, st?: React.CSSProperties) => (
    <button type="button" aria-pressed={!!on} onClick={f} style={st} className={`min-h-8 min-w-8 rounded-md border px-2 text-sm ${on ? "border-ink bg-ink text-white" : "border-line bg-white text-ink"}`}>{label}</button>
  );
  return (
    <details open={open} onToggle={(x) => setOpen((x.target as HTMLDetailsElement).open)} className="mb-2 rounded-lg border border-line bg-white p-2">
      <summary className="cursor-pointer text-xs font-extrabold text-ink">🔤 Mise en forme du texte (taille, gras, souligné, centré…)</summary>
      <p className="mb-1 mt-1 text-xs text-muted">Choisis une partie, puis règle-la (réglages gardés dans ce navigateur).</p>
      <div className="mb-1 flex flex-wrap gap-1">{FMT_BLOCKS.map((b) => <Pill key={b.key} on={key === b.key} onClick={() => setKey(b.key)}>{b.label}{fmt[b.key] && Object.keys(fmt[b.key]!).length ? " ●" : ""}</Pill>)}</div>
      <div className="flex flex-wrap items-center gap-1">
        <button type="button" aria-label="Plus petit" disabled={size <= -4} onClick={() => set({ size: size - 1 })} className="min-h-8 min-w-8 rounded-md border border-line bg-white text-sm font-extrabold text-ink">A−</button>
        <span className="min-w-14 text-center text-sm font-bold text-ink">{size === 0 ? "normale" : size > 0 ? `+${size}` : size}</span>
        <button type="button" aria-label="Plus grand" disabled={size >= 6} onClick={() => set({ size: size + 1 })} className="min-h-8 min-w-8 rounded-md border border-line bg-white text-sm font-extrabold text-ink">A+</button>
        {tog("G", cur.bold, () => set({ bold: cur.bold === false ? undefined : cur.bold ? false : true }), { fontWeight: 900 })}
        {tog("I", cur.italic, () => set({ italic: cur.italic ? undefined : true }), { fontStyle: "italic" })}
        {tog("S", cur.underline, () => set({ underline: cur.underline ? undefined : true }), { textDecoration: "underline" })}
        {(["left", "center", "right"] as const).map((a, i) => tog(["⬅", "↔", "➡"][i], cur.align === a, () => set({ align: cur.align === a ? undefined : a })))}
        <button type="button" onClick={() => { const n = { ...fmt }; delete n[key]; onChange(n); }} className="min-h-8 rounded-md border border-line bg-white px-2 text-xs font-bold text-ink">↺ Rétablir</button>
      </div>
      
    </details>
  );
}

// ───────────── Affiche d'un événement : on remplit les infos à gauche, l'aperçu se met à jour à droite ─────────────
function EventPosterModal({ e, onClose, onSaved }: { e: ClubEvent; onClose: () => void; onSaved: () => void }) {
  const [format, setFormat] = useState<PosterFormat>("A4");
  const [showWho, setShowWho] = useState(false);
  const logos = usePartnerLogos("event"); const [withPartners, setWithPartners] = useState(true);
  const partners = withPartners ? logos : [];
  const [scale, setScale] = useState(0.5);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [title, setTitle] = useState(e.title ?? "");
  const [note, setNote] = useState(e.note ?? "");
  const [info, setInfo] = useState<PosterInfo>(infoOf(e));
  const holder = useRef<HTMLDivElement>(null);
  const fmtKey = `cc-affiche-mise-en-forme-${e.id}`;
  const [fmt, setFmtState] = useState<PosterFmt>(() => { try { return JSON.parse(localStorage.getItem(fmtKey) || "{}"); } catch { return {}; } });
  const setFmt = (v: PosterFmt) => { setFmtState(v); try { localStorage.setItem(fmtKey, JSON.stringify(v)); } catch { /* sans mémoire du navigateur : le réglage reste pour cette fenêtre */ } };
  const { w, h } = SIZES[format];
  useEffect(() => { const f = () => setScale(Math.min(0.62, (Math.min(window.innerWidth, 1000) < 900 ? Math.min(window.innerWidth, 720) - 56 : 400) / w)); f(); window.addEventListener("resize", f); return () => window.removeEventListener("resize", f); }, [w]);
  const draft: ClubEvent = { ...e, title, note, ...cleanInfo(info) };
  const save = async () => {
    await put(`/club/events/${e.id}`, { kind: e.kind, title: title.trim() || undefined, startDate: e.startDate, endDate: e.endDate, bands: e.bands, courts: e.courts, teams: e.teams, who: e.who, note: note.trim() || undefined, featured: !!e.featured, ...cleanInfo(info), allowConflict: true });
    onSaved();
  };
  const run = async (fn: () => Promise<void> | void) => { setBusy(true); setMsg(""); try { await save(); await fn(); } catch (x: any) { setMsg(x?.message || "Impossible d'enregistrer."); } setBusy(false); };
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
      a.download = `affiche-${titleOf(draft).toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${e.startDate}-${format === "A4" ? "a4" : "carre"}.png`;
      document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); setMsg("✔ Image enregistrée dans tes téléchargements.");
    } catch { setMsg("Impossible de faire l'image sur cet appareil : utilise plutôt « Imprimer ou PDF »."); }
  };
  const pdf = async () => {
    setMsg("Je prépare le PDF…");
    try {
      const blob = await posterToPdf(holder.current?.firstElementChild as HTMLElement, w, h);
      saveBlob(blob, `affiche-${titleOf(draft).toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${e.startDate}-${format === "A4" ? "a4" : "carre"}.pdf`); setMsg("✔ PDF enregistré dans tes téléchargements.");
    } catch { setMsg("Impossible de faire le PDF sur cet appareil : utilise plutôt « Imprimer »."); }
  };
  return (
    <Modal wide title={`🪧 Affiche : ${titleOf(draft)}`} onClose={onClose}>
      <p className="mb-3 mt-0 text-sm text-muted">📅 {fmtRange(e.startDate, e.endDate)} <span className="text-xs">(les dates viennent du planning)</span></p>
      <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,420px)]">
        <div className="min-w-0">
          <div className="mb-3 flex flex-wrap gap-2">
            <Pill on={format === "A4"} onClick={() => setFormat("A4")}>📄 A4 à imprimer</Pill>
            <Pill on={format === "CARRE"} onClick={() => setFormat("CARRE")}>📱 Carré (WhatsApp, Facebook)</Pill>
            {e.who.length > 0 && <Pill on={showWho} onClick={() => setShowWho(!showWho)}>👤 Montrer qui s'en occupe</Pill>}
            {logos.length > 0 && <Pill on={withPartners} onClick={() => setWithPartners(!withPartners)}>🤝 Montrer les partenaires</Pill>}
          </div>
          <FormatPanel fmt={fmt} onChange={setFmt} />
          <div className="rounded-xl border-2 border-line bg-white p-3">
            {hasSimpleForm(e.kind)
              ? <AnimationForm tournoi={isTournoi(e.kind)} title={title} onTitle={setTitle} note={note} onNote={setNote} value={info} onChange={setInfo} />
              : <><label className="mb-3 block text-sm font-bold text-ink">📝 Description (facultatif)
                  <textarea aria-label="Description de l'affiche" rows={2} maxLength={600} value={note} onChange={(x) => setNote(x.target.value)} className="mt-1 w-full rounded-xl border-2 border-line bg-white px-3 py-2 text-sm font-normal" /></label>
                <EventPosterFields kind={e.kind} value={info} onChange={setInfo} /></>}
          </div>
        </div>
        <div className="min-w-0 md:sticky md:top-0 md:self-start">
          <div className="mx-auto overflow-hidden rounded-lg border border-line shadow-lg" style={{ width: w * scale, height: h * scale }}>
            <div ref={holder} style={{ width: w, height: h, transform: `scale(${scale})`, transformOrigin: "top left" }}><EventPoster e={draft} format={format} showWho={showWho} fmt={fmt} partners={partners} /></div>
          </div>
          <p className="mb-0 mt-2 text-center text-xs text-muted">L'aperçu change pendant que tu écris.</p>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" className="btn-clay" disabled={busy} onClick={() => run(pdf)}>📄 Enregistrer en PDF (haute qualité)</button>
        <button type="button" className="btn-outline bg-white hover:bg-ink hover:text-white" disabled={busy} onClick={() => run(png)}>💾 Enregistrer en image (PNG)</button>
        <button type="button" className="btn-outline bg-white hover:bg-ink hover:text-white" disabled={busy} onClick={() => run(print)}>🖨️ Imprimer</button>
        <button type="button" className="btn-outline bg-white hover:bg-ink hover:text-white" disabled={busy} onClick={() => run(() => { setMsg("✔ Infos de l'affiche enregistrées."); })}>✔ Enregistrer les infos</button>
      </div>
      {msg && <p className="mb-0 mt-2 text-sm font-bold text-ink" role="status">{msg}</p>}
      <p className="mb-0 mt-2 text-xs text-muted">Rien n'est envoyé sur Internet : tu envoies toi-même l'image ou le PDF par ta messagerie. L'image est en haute qualité (prête à imprimer). Aucun nom d'élève sur l'affiche.</p>
      {createPortal(<div className="affiche-print"><EventPoster e={draft} format={format} showWho={showWho} fmt={fmt} partners={partners} /></div>, document.body)}
    </Modal>
  );
}

// ───────────── Un événement : voir, mettre en avant, modifier, annuler ─────────────
function EventActions({ e, onClose, onStar, onEdit, onDelete, onPoster, onRecap, readOnly = false }: { readOnly?: boolean; onPoster: (e: ClubEvent) => void; onRecap: (e: ClubEvent) => void; e: ClubEvent; onClose: () => void; onStar: (e: ClubEvent) => void; onEdit: (e: ClubEvent) => void; onDelete: (e: ClubEvent) => void }) {
  const k = kindOf(e.kind);
  return (
    <Modal title={`${k.icon} ${titleOf(e)}`} onClose={onClose}>
      <p className="mt-0 font-bold text-ink">📅 {fmtRange(e.startDate, e.endDate)}</p>
      {e.who.length > 0 && <p className="text-sm text-ink">👤 {e.who.join(", ")}</p>}
      {e.note ? <p className="rounded-xl bg-sand p-3 text-sm text-ink [overflow-wrap:anywhere]">📝 {e.note}</p> : <p className="text-sm text-muted">Pas de description.</p>}
      {!readOnly && <div className="mt-3 grid gap-2">
        <button type="button" aria-pressed={!!e.featured} className={e.featured ? "btn-outline !border-[#d4a000] !bg-[#fff3c4]" : "btn-outline"} onClick={() => onStar(e)}>{e.featured ? "⭐ Mis en avant sur l'affiche (toucher pour retirer)" : "☆ Mettre en avant sur l'affiche"}</button>
        <button type="button" className="btn-clay" onClick={() => onPoster(e)}>🪧 {hasPoster(e) ? "Modifier ou refaire l'affiche" : "Créer l'affiche de cet événement"}</button>
        <button type="button" className="btn-outline bg-white hover:bg-ink hover:text-white" onClick={() => onRecap(e)}>📸 Affiche de bilan pour les réseaux (photos, résultats)</button>
        <button type="button" className="btn-outline" onClick={() => onEdit(e)}>⚙️ Modifier</button>
        <button type="button" className="btn-outline !border-[#b42318] !text-[#b42318] hover:!bg-[#b42318] hover:!text-white" onClick={() => onDelete(e)}>🗑️ Annuler cet événement</button>
      </div>}
    </Modal>
  );
}

// ───────────── Exporter le planning : tableau Excel, agenda, liste imprimable ─────────────
function ExportModal({ events, season, month, onClose }: { events: ClubEvent[]; season: number; month: string; onClose: () => void }) {
  const [scope, setScope] = useState<"saison" | "mois">("saison");
  const [withWho, setWithWho] = useState(false);
  const [cover, setCover] = useState(true);
  const [pageNo, setPageNo] = useState(0);
  const [scale, setScale] = useState(0.5);
  useEffect(() => { const f = () => setScale(Math.min(0.6, (Math.min(window.innerWidth, 720) - 56) / DOSSIER_W)); f(); window.addEventListener("resize", f); return () => window.removeEventListener("resize", f); }, []);
  const from = scope === "saison" ? `${season}-09-01` : `${month}-01`;
  const to = scope === "saison" ? `${season + 1}-08-31` : addDays(`${addDays(`${month}-01`, 32).slice(0, 7)}-01`, -1);
  const opts = { from, to, withWho };
  const n = inPeriod(events, from, to).length;
  const pages = useMemo(() => buildDossier(events, { from, to, withWho, season: scope === "saison" ? season : undefined, cover: scope === "saison" && cover }), [events, from, to, withWho, scope, season, cover]);
  const idx = Math.min(pageNo, Math.max(0, pages.length - 1));
  const tag = scope === "saison" ? `saison-${season}-${season + 1}` : month;
  const print = () => {
    const st = document.createElement("style"); st.textContent = "@page{size:210mm 297mm;margin:0}";
    document.head.appendChild(st); document.body.classList.add("printing-affiche");
    const done = () => { document.body.classList.remove("printing-affiche"); st.remove(); window.removeEventListener("afterprint", done); };
    window.addEventListener("afterprint", done); window.print();
  };
  return (
    <Modal title="📤 Exporter le planning" onClose={onClose}>
      <p className="mt-0 text-sm text-ink">Le document est fabriqué sur ton ordinateur : rien n'est envoyé sur Internet.</p>
      <p className="mb-1 text-sm font-extrabold text-ink">1. Quelle période ?</p>
      <div className="mb-3 flex flex-wrap gap-2">
        <Pill on={scope === "saison"} onClick={() => { setScope("saison"); setPageNo(0); }}>📆 Toute la saison {season} / {season + 1}</Pill>
        <Pill on={scope === "mois"} onClick={() => { setScope("mois"); setPageNo(0); }}>🗓️ {MONTHS[+month.slice(5, 7) - 1]} {month.slice(0, 4)} seulement</Pill>
      </div>
      <p className="mb-1 text-sm font-extrabold text-ink">2. Options</p>
      <div className="mb-3 flex flex-wrap gap-2">
        {scope === "saison" && <Pill on={cover} onClick={() => { setCover(!cover); setPageNo(0); }}>📘 Avec la couverture</Pill>}
        <Pill on={withWho} onClick={() => setWithWho(!withWho)}>👤 Ajouter « Qui s'en occupe »</Pill>
      </div>
      <p className="mb-1 text-sm font-extrabold text-ink">3. Le dossier de saison <span className="font-normal text-muted">({n} événement{n > 1 ? "s" : ""} · {pages.length} page{pages.length > 1 ? "s" : ""})</span></p>
      {n > 0 && pages.length > 0 ? (<>
        <div className="mx-auto overflow-hidden rounded-lg border border-line shadow-lg" style={{ width: DOSSIER_W * scale, height: DOSSIER_H * scale }}>
          <div style={{ width: DOSSIER_W, height: DOSSIER_H, transform: `scale(${scale})`, transformOrigin: "top left" }}>{pages[idx]}</div>
        </div>
        <div className="mt-2 flex items-center justify-center gap-3">
          <button type="button" className="btn-outline" aria-label="Page précédente" disabled={idx === 0} onClick={() => setPageNo(idx - 1)}>‹</button>
          <b className="text-ink">Page {idx + 1} / {pages.length}</b>
          <button type="button" className="btn-outline" aria-label="Page suivante" disabled={idx >= pages.length - 1} onClick={() => setPageNo(idx + 1)}>›</button>
        </div>
        <button type="button" className="btn-clay mt-3 w-full" onClick={print}>📘 Imprimer ou enregistrer en PDF</button>
        <p className="mb-0 mt-2 text-xs text-muted">Dans la fenêtre d'impression, choisis « Enregistrer au format PDF » (format A4, marges : aucune).</p>
      </>) : <p className="mb-0 mt-1 text-sm text-muted">Il n'y a aucun événement sur cette période.</p>}
      <button type="button" className="btn-outline mt-4 w-full bg-white hover:bg-ink hover:text-white" disabled={!n} onClick={() => download(`planning-${tag}.ics`, "text/calendar", toIcs(events, opts))}>📅 Agenda pour Google, Outlook, iPhone (.ics)</button>
      {createPortal(<div className="affiche-print" style={{ background: "#fff" }}>{pages}</div>, document.body)}
    </Modal>
  );
}

// ───────────── Affiche du mois ─────────────
function PosterModal({ events, initialMonth, onClose }: { events: ClubEvent[]; initialMonth: string; onClose: () => void }) {
  const [month, setMonth] = useState(initialMonth);
  const [model, setModel] = useState<PosterModel>("liste");
  const [showWho, setShowWho] = useState(false);
  const logos = usePartnerLogos("mois"); const [withPartners, setWithPartners] = useState(true);
  const partners = withPartners ? logos : [];
  const [scale, setScale] = useState(0.5);
  const [msg, setMsg] = useState("");
  const holder = useRef<HTMLDivElement>(null);
  useEffect(() => { const f = () => setScale(Math.min(0.75, (Math.min(window.innerWidth, 720) - 48) / POSTER_W)); f(); window.addEventListener("resize", f); return () => window.removeEventListener("resize", f); }, []);
  const shift = (n: number) => setMonth(addDays(`${month}-01`, n < 0 ? -1 : 32).slice(0, 7));
  const print = () => {
    const st = document.createElement("style"); st.textContent = "@page{size:A4;margin:0}";
    document.head.appendChild(st); document.body.classList.add("printing-affiche");
    const done = () => { document.body.classList.remove("printing-affiche"); st.remove(); window.removeEventListener("afterprint", done); };
    window.addEventListener("afterprint", done); window.print();
  };
  const png = async () => {
    setMsg("Je prépare l'image…");
    try {
      const blob = await posterToPng(holder.current?.firstElementChild as HTMLElement, POSTER_W, POSTER_H);
      const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `affiche-${month}-${model}.png`;
      document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); setMsg("✔ Image enregistrée dans tes téléchargements.");
    } catch { setMsg("Impossible de faire l'image sur cet appareil : utilise plutôt « Imprimer ou PDF »."); }
  };
  const pdf = async () => {
    setMsg("Je prépare le PDF…");
    try { saveBlob(await posterToPdf(holder.current?.firstElementChild as HTMLElement, POSTER_W, POSTER_H), `affiche-${month}-${model}.pdf`); setMsg("✔ PDF enregistré dans tes téléchargements."); }
    catch { setMsg("Impossible de faire le PDF sur cet appareil : utilise plutôt « Imprimer »."); }
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
        {logos.length > 0 && <Pill on={withPartners} onClick={() => setWithPartners(!withPartners)}>🤝 Montrer les partenaires</Pill>}
      </div>
      <div className="mx-auto overflow-hidden rounded-lg border border-line shadow-lg" style={{ width: POSTER_W * scale, height: POSTER_H * scale }}>
        <div ref={holder} style={{ width: POSTER_W, height: POSTER_H, transform: `scale(${scale})`, transformOrigin: "top left" }}><ClubPoster events={events} month={month} model={model} showWho={showWho} partners={partners} /></div>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" className="btn-clay" onClick={pdf}>📄 Enregistrer en PDF (haute qualité)</button>
        <button type="button" className="btn-outline bg-white hover:bg-ink hover:text-white" onClick={png}>💾 Enregistrer en image (PNG)</button>
        <button type="button" className="btn-outline bg-white hover:bg-ink hover:text-white" onClick={print}>🖨️ Imprimer</button>
      </div>
      {msg && <p className="mb-0 mt-2 text-sm font-bold text-ink" role="status">{msg}</p>}
      <p className="mb-0 mt-2 text-xs text-muted">Dans la fenêtre d'impression, choisis « Enregistrer au format PDF ». Rien n'est envoyé sur Internet. Aucun nom d'élève sur l'affiche.</p>
      {createPortal(<div className="affiche-print"><ClubPoster events={events} month={month} model={model} showWho={showWho} partners={partners} /></div>, document.body)}
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

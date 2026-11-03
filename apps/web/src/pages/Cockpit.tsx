import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { get } from "../api";
import { useAuth } from "../auth";
import { PageHead, Page } from "../components/ui";
import { colorOf, evOn, kindOf, titleOf, ClubEvent } from "../clubPlan";
import { holidaysDaysLeft, holidaysLastDay } from "../schoolDays";
import { Sponsor } from "../sponsors";
import { Lesson, fmtSlot, todayIso } from "../types";

// Cockpit « Cette semaine » : une seule page qui rassemble ce qui existait déjà en plusieurs endroits
// (événements du club, cours à confirmer, contrats de partenaires, professeurs à valider, vacances à compléter).
// Rien n'est enregistré ici : ce sont seulement des lectures des routes existantes, chacune avec ses droits.
// Un morceau auquel la personne n'a pas droit (ex. le bureau et les cours) est simplement absent.

type ProfAdmin = { id: string; firstName: string; lastName: string | null; status: string; documents: { kind: string; validUntil: string | null }[] };
type Section<T> = { ok: boolean; data: T };

const addDays = (iso: string, n: number) => { const d = new Date(`${iso}T12:00:00`); d.setDate(d.getDate() + n); return d.toLocaleDateString("sv-SE"); };
const longDate = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
const daysUntil = (from: string, to: string) => Math.round((Date.parse(`${to}T12:00:00`) - Date.parse(`${from}T12:00:00`)) / 86_400_000);

function useSection<T>(path: string, empty: T): Section<T> & { loading: boolean } {
  const [state, setState] = useState<Section<T> & { loading: boolean }>({ ok: false, data: empty, loading: true });
  useEffect(() => {
    let alive = true;
    get<T>(path).then((d) => alive && setState({ ok: true, data: d, loading: false })).catch(() => alive && setState({ ok: false, data: empty, loading: false }));
    return () => { alive = false; };
  }, [path]); // eslint-disable-line react-hooks/exhaustive-deps
  return state;
}

type Alert = { key: string; tone: "red" | "amber" | "blue"; text: string; to?: string; cta?: string };
const TONE = { red: "border-[#b42318] bg-[#fdecea] text-[#7a1810]", amber: "border-[#c88a00] bg-[#fff6dd] text-[#5c4300]", blue: "border-[#3b6ea5] bg-[#eaf2fb] text-[#1d3c61]" };

export default function Cockpit({ embedded = false }: { embedded?: boolean }) {
  const { me } = useAuth();
  const today = todayIso();
  const plan = useSection<{ events: ClubEvent[] }>("/club/plan", { events: [] });
  const sponsors = useSection<Sponsor[]>("/sponsors", []);
  const lessons = useSection<Lesson[]>("/lessons", []);
  const profs = useSection<ProfAdmin[]>("/profs/admin", []);

  const week = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(today, i)), [today]);
  const eventsByDay = useMemo(() => week.map((d) => ({ day: d, events: plan.data.events.filter((e) => evOn(e, d)) })), [week, plan.data.events]);
  const weekCount = new Set(eventsByDay.flatMap((x) => x.events.map((e) => e.id))).size;
  const tentative = plan.data.events.filter((e) => e.tentative && e.endDate >= today);

  const toConfirm = lessons.data.filter((l) => l.status === "BOOKED" && l.finalSlot && l.finalSlot.date >= today);
  const nextLessons = lessons.data.filter((l) => l.status === "ACCEPTED" && l.finalSlot && l.finalSlot.date >= today && l.finalSlot.date <= week[6]).sort((a, b) => (a.finalSlot!.date + a.finalSlot!.time).localeCompare(b.finalSlot!.date + b.finalSlot!.time));

  const alerts: Alert[] = [];
  const left = holidaysDaysLeft(today);
  if (left < 60) alerts.push({ key: "hol", tone: left < 0 ? "red" : "amber", text: left < 0 ? `Les vacances scolaires connues se sont arrêtées le ${longDate(holidaysLastDay())} : il faut ajouter celles de l'année.` : `Les vacances scolaires connues s'arrêtent dans ${left} jours : pense à ajouter celles de l'année suivante.`, to: undefined });
  for (const s of sponsors.data) {
    if (s.status === "TERMINE" || !s.endDate) continue;
    const n = daysUntil(today, s.endDate);
    if (n < 0) alerts.push({ key: `sp-${s.id}`, tone: "red", text: `Le contrat de ${s.name} est terminé depuis le ${longDate(s.endDate)}.`, to: "/coach/club/partenaires", cta: "Voir le partenaire" });
    else if (n <= 60) alerts.push({ key: `sp-${s.id}`, tone: "amber", text: `Le contrat de ${s.name} se termine dans ${n} jour${n > 1 ? "s" : ""} (${longDate(s.endDate)}).`, to: "/coach/club/partenaires", cta: "Voir le partenaire" });
    if (s.status === "RELANCE") alerts.push({ key: `rel-${s.id}`, tone: "blue", text: `${s.name} est à relancer.`, to: "/coach/club/partenaires", cta: "Ouvrir" });
  }
  for (const p of profs.data) {
    const card = p.documents.find((d) => d.kind === "CARTE_PRO");
    const who = `${p.firstName}${p.lastName ? ` ${p.lastName}` : ""}`;
    if (p.status === "waiting") alerts.push({ key: `pw-${p.id}`, tone: "amber", text: `${who} attend ta validation pour donner des cours particuliers.`, to: me?.role === "PRESIDENT" ? "/president?onglet=profs" : "/coach/adultes?onglet=profs", cta: "Vérifier" });
    if (card?.validUntil) {
      const n = daysUntil(today, card.validUntil);
      if (n < 0) alerts.push({ key: `pc-${p.id}`, tone: "red", text: `La carte professionnelle de ${who} a expiré le ${longDate(card.validUntil)}.` });
      else if (n <= 45) alerts.push({ key: `pc-${p.id}`, tone: "amber", text: `La carte professionnelle de ${who} expire dans ${n} jour${n > 1 ? "s" : ""}.` });
    }
  }
  if (toConfirm.length) alerts.push({ key: "tc", tone: "amber", text: `${toConfirm.length} cours réservé${toConfirm.length > 1 ? "s" : ""} attend${toConfirm.length > 1 ? "ent" : ""} la confirmation d'un professeur.`, to: me?.role === "PRESIDENT" ? "/president?onglet=demandes" : "/coach/adultes", cta: "Voir" });
  if (tentative.length) alerts.push({ key: "tent", tone: "blue", text: `${tentative.length} événement${tentative.length > 1 ? "s" : ""} prévisionnel${tentative.length > 1 ? "s" : ""} pas encore validé${tentative.length > 1 ? "s" : ""}.`, to: "/coach/club", cta: "Ouvrir le planning" });
  const order = { red: 0, amber: 1, blue: 2 } as const;
  alerts.sort((a, b) => order[a.tone] - order[b.tone]);

  const loading = plan.loading || sponsors.loading || lessons.loading || profs.loading;
  const canPlan = me?.role !== "TRAINER";

  return (
    <>
      {!embedded && <PageHead eyebrow="Gestion du club" title="Cockpit · cette semaine" />}
      {(() => { const W = embedded ? (({ children }: { children: React.ReactNode }) => <div className="grid gap-6">{children}</div>) : Page; return <W>
        <p className="m-0 max-w-3xl text-sm text-muted">Tout ce qui demande ton attention, rassemblé. Rien n'est modifié ici : chaque ligne ouvre la page où agir.</p>

        <section aria-labelledby="ck-alertes" className="grid gap-3">
          <h2 id="ck-alertes" className="m-0 font-display text-2xl">À surveiller {alerts.length ? <span className="ml-1 text-base text-muted">({alerts.length})</span> : null}</h2>
          {loading && <p className="m-0 text-sm text-muted">Chargement…</p>}
          {!loading && alerts.length === 0 && <p className="m-0 border border-line bg-paper p-4 text-sm">✅ Rien d'urgent. Tout est à jour.</p>}
          <ul className="m-0 grid list-none gap-2 p-0">
            {alerts.map((a) => (
              <li key={a.key} className={`flex flex-wrap items-center gap-3 border-l-4 px-4 py-3 text-sm ${TONE[a.tone]}`}>
                <span className="min-w-0 flex-1">{a.text}</span>
                {a.to && <Link to={a.to} className="btn-outline !px-3 !py-1.5">{a.cta ?? "Ouvrir"} →</Link>}
              </li>
            ))}
          </ul>
        </section>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
          {canPlan && plan.ok && (
            <section aria-labelledby="ck-sem" className="grid content-start gap-3">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 id="ck-sem" className="m-0 font-display text-2xl">Les 7 prochains jours <span className="ml-1 text-base text-muted">({weekCount} événement{weekCount > 1 ? "s" : ""})</span></h2>
                <Link to="/coach/club" className="text-sm font-bold underline">Ouvrir le planning →</Link>
              </div>
              <ol className="m-0 grid list-none gap-2 p-0">
                {eventsByDay.map(({ day, events }) => (
                  <li key={day} className="grid grid-cols-[110px_minmax(0,1fr)] gap-3 border border-line bg-paper p-3">
                    <div className={`text-sm font-bold capitalize ${day === today ? "text-[#b8471f]" : ""}`}>{day === today ? "Aujourd'hui" : new Date(`${day}T12:00:00`).toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" })}</div>
                    <div className="grid gap-1.5">
                      {events.length === 0 && <span className="text-sm text-muted">—</span>}
                      {events.map((e) => (
                        <div key={e.id} className="flex flex-wrap items-center gap-2 text-sm" style={e.tentative ? { opacity: 0.75 } : undefined}>
                          <span aria-hidden className="size-3 shrink-0 rounded-full" style={{ background: colorOf(e) }} />
                          <b className="[overflow-wrap:anywhere]">{kindOf(e.kind).icon} {titleOf(e)}</b>
                          {e.tentative && <span className="rounded-full bg-sand px-2 py-0.5 text-xs">prévisionnel</span>}
                          {e.time && <span className="text-muted">· {e.time.split("\n")[0]}</span>}
                          {e.who.length > 0 && <span className="text-muted">· 👤 {e.who.join(", ")}</span>}
                        </div>
                      ))}
                    </div>
                  </li>
                ))}
              </ol>
            </section>
          )}

          <div className="grid content-start gap-6">
            {lessons.ok && (
              <section aria-labelledby="ck-cours" className="grid gap-3">
                <h2 id="ck-cours" className="m-0 font-display text-2xl">Cours particuliers</h2>
                {nextLessons.length === 0 && <p className="m-0 text-sm text-muted">Aucun cours confirmé cette semaine.</p>}
                <ul className="m-0 grid list-none gap-2 p-0">
                  {nextLessons.slice(0, 6).map((l) => (
                    <li key={l.id} className="border border-line bg-paper p-3 text-sm"><b className="capitalize">{fmtSlot(l.finalSlot!)}</b>{l.place ? ` · ${l.place}` : ""}</li>
                  ))}
                </ul>
              </section>
            )}
            {sponsors.ok && (
              <section aria-labelledby="ck-spo" className="grid gap-3">
                <h2 id="ck-spo" className="m-0 font-display text-2xl">Partenaires</h2>
                <p className="m-0 text-sm">
                  {sponsors.data.filter((s) => ["SIGNE", "FACTURE", "PAYE"].includes(s.status)).length} partenaire(s) engagé(s) · {sponsors.data.filter((s) => s.status === "A_CONTACTER" || s.status === "RELANCE").length} à contacter ou relancer.
                </p>
                <Link to="/coach/club/partenaires" className="text-sm font-bold underline">Gérer les partenaires →</Link>
              </section>
            )}
          </div>
        </div>
      </W>; })()}
    </>
  );
}

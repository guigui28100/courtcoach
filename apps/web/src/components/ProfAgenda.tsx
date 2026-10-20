import { useEffect, useMemo, useState } from "react";
import { adultName, fmtTime, Lesson, ProfSlot, WEEKDAYS } from "../types";
import { offDay } from "../series";
import { LessonRow } from "../pages/Coach";

// Agenda du professeur : la semaine en grille (jours en colonnes, heures en lignes).
// Vert = cours confirmé, jaune = à confirmer, vert clair = libre, hachuré = pas disponible. On touche un cours : sa fiche s'ouvre.
const iso = (d: Date) => d.toISOString().slice(0, 10);
const localToday = () => new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Paris" }); // date du jour à Paris (AAAA-MM-JJ)
const addDays = (date: string, n: number) => iso(new Date(new Date(`${date}T12:00:00Z`).getTime() + n * 86_400_000));
const weekdayOf = (date: string) => (new Date(`${date}T12:00:00Z`).getUTCDay() + 6) % 7; // 0 = lundi
const mins = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
const MONTHS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
const dayNum = (date: string) => Number(date.slice(8, 10));
const monthOf = (date: string) => MONTHS[Number(date.slice(5, 7)) - 1];
const shortName = (a: Lesson["member"]) => { const f = a?.firstName?.trim(); const l = a?.lastName?.trim(); return f ? (l ? `${f} ${l[0].toUpperCase()}.` : f) : adultName(a, "Adhérent"); };

function useDays() {
  const [n, setN] = useState(() => (typeof window !== "undefined" && window.matchMedia("(max-width: 767px)").matches ? 3 : 7));
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const f = () => setN(mq.matches ? 3 : 7);
    mq.addEventListener("change", f); return () => mq.removeEventListener("change", f);
  }, []);
  return n;
}

export function ProfAgenda({ lessons, slots, skipHolidays = true, reload, preview = false }: { lessons: Lesson[]; slots: ProfSlot[]; skipHolidays?: boolean; reload: () => void; preview?: boolean }) {
  const [today, setToday] = useState(localToday);
  const count = useDays();
  const [anchor, setAnchor] = useState(today);
  const [follow, setFollow] = useState(true); // tant qu'on n'a pas navigué, l'agenda suit la date : il avance d'un jour à minuit
  // minuit passé : on avance d'un jour ; retour sur la page ou toutes les 5 minutes : on recharge les cours
  useEffect(() => {
    const tick = () => setToday((t) => { const n = localToday(); return n === t ? t : n; });
    const refresh = () => { tick(); reload(); };
    const a = setInterval(tick, 30_000), b = setInterval(refresh, 300_000);
    const vis = () => { if (document.visibilityState === "visible") refresh(); };
    document.addEventListener("visibilitychange", vis);
    return () => { clearInterval(a); clearInterval(b); document.removeEventListener("visibilitychange", vis); };
  }, [reload]);
  useEffect(() => { if (follow) setAnchor(today); }, [today, follow]);
  const [open, setOpen] = useState<Lesson | null>(null);
  const start = anchor; // 7 jours (3 sur téléphone) à partir d'aujourd'hui : l'agenda avance d'un jour chaque jour
  const days = Array.from({ length: count }, (_, i) => addDays(start, i));

  // cours à afficher : réservés (à confirmer) ou confirmés
  const shown = useMemo(() => lessons.filter((l) => (l.status === "BOOKED" || l.status === "ACCEPTED") && l.finalSlot), [lessons]);
  const upcomingOf = (l: Lesson) => l.seriesId ? shown.filter((r) => r.seriesId === l.seriesId && r.finalSlot!.date >= today).length : 0;
  const lessonAt = (date: string, hour: number) => shown.find((l) => l.finalSlot!.date === date && Math.floor(mins(l.finalSlot!.time) / 60) === hour);

  const free = (date: string, hour: number) => slots.some((s) => {
    const okDay = s.date ? s.date === date : s.weekday === weekdayOf(date) && !(skipHolidays && offDay(date));
    return okDay && mins(s.start) <= hour * 60 && mins(s.end) >= (hour + 1) * 60;
  });

  // heures affichées : seulement celles où il y a un cours ou un créneau libre dans la période (sinon une plage par défaut)
  const hours = useMemo(() => {
    const set = new Set<number>();
    for (let h = 6; h <= 22; h++) for (const d of days) if (free(d, h)) set.add(h);
    for (const l of shown) if (days.includes(l.finalSlot!.date)) set.add(Math.floor(mins(l.finalSlot!.time) / 60));
    const list = [...set].sort((x, y) => x - y);
    return list.length ? list : [17, 18, 19];
  }, [days.join(), slots, shown, skipHolidays]); // eslint-disable-line react-hooks/exhaustive-deps

  const inPeriod = shown.filter((l) => days.includes(l.finalSlot!.date));
  const toConfirm = inPeriod.filter((l) => l.status === "BOOKED").length;
  const offLabel = days.map((d) => offDay(d)).find(Boolean);
  const last = days[count - 1];
  const title = `Du ${dayNum(days[0])} ${days[0].slice(5, 7) === last.slice(5, 7) ? "" : monthOf(days[0]) + " "}au ${dayNum(last)} ${monthOf(last)}`;

  return (
    <section className="overflow-hidden rounded-3xl border-2 border-line bg-white shadow-sm" aria-label="Mon agenda">
      <div className="agenda-hero flex flex-wrap items-center gap-3 px-4 py-4 text-white">
        <span aria-hidden className="text-3xl">🎾</span>
        <div className="min-w-[12rem] flex-1">
          <h3 className="m-0 font-display text-xl font-black text-white">{title}</h3>
          <p className="m-0 text-sm text-white/90">{inPeriod.length === 0 ? "Aucun cours sur cette période" : `${inPeriod.length} cours${toConfirm ? ` · ${toConfirm} à confirmer` : ""}`}</p>
        </div>
        <div className="flex items-center gap-2 max-[480px]:w-full max-[480px]:justify-between">
          <button className="agenda-nav" aria-label="Période précédente" onClick={() => { setFollow(false); setAnchor(addDays(start, -count)); }}>‹</button>
          <button className="agenda-nav !w-auto px-3 text-sm" onClick={() => { setFollow(true); setAnchor(today); }}>Aujourd'hui</button>
          <button className="agenda-nav" aria-label="Période suivante" onClick={() => { setFollow(false); setAnchor(addDays(start, count)); }}>›</button>
        </div>
      </div>

      <div className="p-2 sm:p-4">
        {inPeriod.length === 0 && !hours.some((h) => days.some((d) => free(d, h))) && <p className="m-0 mb-2 rounded-xl bg-sand p-3 text-sm">Aucun cours ni créneau libre sur cette période.</p>}
        <div className="agenda-grid" style={{ gridTemplateColumns: `3rem repeat(${count}, minmax(0, 1fr))` }} role="grid" aria-label="Agenda de la période">
          <div />
          {days.map((d) => (
            <div key={d} className={"agenda-day " + (d === today ? "is-today" : "")} role="columnheader">
              <small>{WEEKDAYS[weekdayOf(d)].slice(0, 3)}</small>
              <b>{dayNum(d)}</b>
            </div>
          ))}
          {hours.map((h) => (
            <div key={h} className="contents" role="row">
              <div className="agenda-hour">{h} h</div>
              {days.map((d) => {
                const l = lessonAt(d, h);
                if (l) {
                  const wait = l.status === "BOOKED";
                  const name = shortName(l.member);
                  return (
                    <button key={d + h} type="button" role="gridcell" onClick={() => setOpen({ ...l, seriesCount: upcomingOf(l) || l.seriesCount })}
                      className={"agenda-lesson " + (wait ? "is-wait" : "is-ok")}
                      aria-label={`${wait ? "À confirmer" : "Cours confirmé"} : ${name}, ${WEEKDAYS[weekdayOf(d)]} ${dayNum(d)} ${monthOf(d)} à ${fmtTime(l.finalSlot!.time)}`}>
                      <span className="min-w-0 text-left leading-tight">
                        <b className="block truncate">{name}</b>
                        <small className="block truncate">{wait ? "⏳ À confirmer" : "✅ " + fmtTime(l.finalSlot!.time)}{l.seriesId ? " · 🔁" : ""}{l.type === "duo" ? " · 👥" : ""}</small>
                      </span>
                    </button>
                  );
                }
                return free(d, h)
                  ? <div key={d + h} role="gridcell" className="agenda-free" aria-label={`${WEEKDAYS[weekdayOf(d)]} ${dayNum(d)}, ${h} h : libre`}><span>libre</span></div>
                  : <div key={d + h} role="gridcell" className="agenda-off" aria-hidden />;
              })}
            </div>
          ))}
        </div>

        <ul className="m-0 mt-3 flex list-none flex-wrap gap-x-4 gap-y-2 p-0 text-sm" aria-label="Légende">
          <li><i className="agenda-dot bg-ok" />Cours confirmé</li>
          <li><i className="agenda-dot bg-[#f2d230]" />À confirmer</li>
          <li><i className="agenda-dot border border-[#b5dcbf] bg-[#e7f4ea]" />Libre</li>
          <li><i className="agenda-dot border border-line bg-[#f1ece1]" />Pas disponible</li>
          <li>🔁 série · 👥 à deux</li>
        </ul>
        {skipHolidays && offLabel && <p className="m-0 mt-2 rounded-xl bg-[#fff3cd] p-2 text-sm text-[#5c4300]">🏖️ {offLabel} : tes créneaux « chaque semaine » ne sont pas proposés aux adultes ces jours-là (case « pas de cours pendant les vacances » dans Mes disponibilités).</p>}
        <p className="m-0 mt-2 text-sm text-muted">👉 Touche un cours pour voir l'adulte, son téléphone, le tarif et pour le confirmer ou le libérer.</p>
      </div>

      {open && (
        <div role="dialog" aria-modal="true" aria-label="Fiche du cours" className="fixed inset-0 z-[100] grid place-items-center overflow-auto bg-ink/70 p-3" onClick={() => setOpen(null)} onKeyDown={(e) => e.key === "Escape" && setOpen(null)}>
          <div className="w-full max-w-xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-2 flex justify-end"><button className="btn-outline btn-sm bg-white hover:bg-ink hover:text-white" autoFocus onClick={() => setOpen(null)}>✕ Fermer</button></div>
            <ul className="m-0 list-none p-0"><LessonRow l={open} asProf onDone={() => { setOpen(null); reload(); }} /></ul>
            {preview && <p className="mt-2 rounded-xl bg-[#fff3cd] p-2 text-sm text-[#5c4300]">Aperçu : les boutons ne font rien.</p>}
          </div>
        </div>
      )}
    </section>
  );
}

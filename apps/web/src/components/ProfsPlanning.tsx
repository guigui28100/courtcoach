import { useEffect, useState } from "react";
import { get } from "../api";
import { WeekPlanner } from "./WeekPlanner";

// Planning des profs : le coach ou le président choisit un prof (ou lui-même) et place ses cours du club ; le prof les voit, sans pouvoir les changer, dans « Ton agenda »
// Le président place, pour chaque entraîneur, ses cours du club (cours adultes, compétition jeunes, école de tennis) : même grille que le coach
export function ProfsPlanning() {
  const [staff, setStaff] = useState<{ id: string; firstName: string; role: string }[] | null>(null);
  const [who, setWho] = useState("");
  useEffect(() => { get<{ id: string; firstName: string; role: string }[]>("/club/staff").then((l) => { setStaff(l); setWho(l[0]?.id ?? ""); }).catch(() => setStaff([])); }, []);
  if (staff === null) return <p className="text-muted">Chargement…</p>;
  const name = (p: { firstName: string; role: string }) => (p.firstName || "Entraîneur") + (p.role === "COACH" ? " (coach)" : "");
  return (
    <section className="grid gap-3">
      <div><h2 className="m-0 text-xl">🗓️ Planning des profs</h2><p className="m-0 mt-1 text-sm text-muted">Choisis la personne, puis place ses cours de la semaine : cours adultes, compétition jeunes, école de tennis. Elle les voit dans « Ton agenda ».</p></div>
      <div className="flex flex-wrap gap-2">{staff.map((p) => <button key={p.id} type="button" aria-pressed={who === p.id} onClick={() => setWho(p.id)} className={"rounded-full border-2 px-3 py-1 text-sm font-bold " + (who === p.id ? "border-ink bg-ink text-white" : "border-line bg-white text-ink")}>{name(p)}</button>)}</div>
      {who ? <WeekPlanner key={who} id={who} name={name(staff.find((p) => p.id === who)!)} /> : <p className="text-muted">Aucun entraîneur pour le moment.</p>}
    </section>
  );
}

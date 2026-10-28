import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { get } from "../api";
import { useAuth } from "../auth";
import { ClubEvent, colorOf, fmtRange, kindOf, titleOf } from "../clubPlan";

export type Mine = Pick<ClubEvent, "id" | "kind" | "title" | "startDate" | "endDate" | "bands" | "courts" | "teams" | "time" | "place" | "audience" | "note">;
// Ce qui change pour la personne : si la date, l'heure ou le lieu bougent, l'événement redevient « modifié »
const sig = (e: Mine) => [e.startDate, e.endDate, e.time, e.place, e.title, e.audience].join("|");
const key = (id?: string) => `cc-club-vu-${id ?? ""}`;
const read = (id?: string): Record<string, string> => { try { return JSON.parse(localStorage.getItem(key(id)) || "{}"); } catch { return {}; } };

// Les événements du planning du club où la personne est placée (« Qui s'en occupe ? »), avec ce qui est nouveau ou modifié depuis sa dernière visite.
export function useMyClubEvents() {
  const { me } = useAuth();
  const [list, setList] = useState<Mine[] | null>(null);
  const [seen, setSeen] = useState<Record<string, string>>(() => read(me?.id));
  useEffect(() => {
    if (!me) return;
    setSeen(read(me.id));
    get<Mine[]>("/club/mine").then(setList).catch(() => setList([]));
  }, [me]);
  const state = (e: Mine): "nouveau" | "modifie" | "vu" => (seen[e.id] === undefined ? "nouveau" : seen[e.id] !== sig(e) ? "modifie" : "vu");
  const markSeen = useCallback((es: Mine[]) => {
    const next = { ...seen };
    for (const e of es) next[e.id] = sig(e);
    try { localStorage.setItem(key(me?.id), JSON.stringify(next)); } catch { /* pas grave */ }
    setSeen(next);
  }, [seen, me]);
  const fresh = (list ?? []).filter((e) => state(e) !== "vu");
  return { list, fresh, state, markSeen };
}

// Petit bandeau « tu as été placé sur … » pour l'accueil
export function ClubNotice() {
  const { me } = useAuth();
  const { fresh } = useMyClubEvents();
  if (fresh.length === 0) return null;
  return (
    <Link to={me?.role === "COACH" ? "/coach/prof" : "/prof"} className="mb-4 flex items-center gap-3 rounded border-2 border-champagne bg-[#fff6dd] px-4 py-3 text-ink no-underline hover:bg-[#ffefc2]">
      <span aria-hidden="true" className="text-2xl">🔔</span>
      <span className="min-w-0 flex-1"><b>Tu as été placé sur {fresh.length} événement{fresh.length > 1 ? "s" : ""} du club.</b> <span className="text-muted">Ils sont dans ton agenda.</span></span>
      <span className="shrink-0 font-bold">Voir →</span>
    </Link>
  );
}

export const KIND_COLOR: Record<string, string> = { ADULTES: "#2f5f9e", COMPETITION: "#6f4b9e", ECOLE: "#c2561f" }; // cours adultes, compétition jeunes, école de tennis

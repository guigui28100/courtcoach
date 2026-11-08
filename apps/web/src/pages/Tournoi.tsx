import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { api } from "../api";
import { BackLink } from "../components/ui";
import { ClubEvent, fmtRange, titleOf } from "../clubPlan";
import markup from "../tournoi/markup.html?raw";

// Aide au tournoi d'une animation (coach, président, bureau). L'assistant lui-même est un petit programme fait pour le navigateur
// (`public/tournoi/tournoi.js` + `tournoi.css`, tout est limité à la zone #tournoi-root) : cette page le charge, lui donne le
// tournoi enregistré avec l'animation et enregistre chaque changement sur le serveur (prénoms et scores seulement).
type Host = { scrollTop?: () => void; initial: string | null; title: string; dateLabel: string; start?: string; avail?: number; save: (json: string) => void; ready: () => void };
declare global { interface Window { __tournoiHost?: Host } }

// « 14 h – 18 h » ou « 14h30 à 17h » → heure de début et temps disponible
export function parseHours(t?: string): { start?: string; avail?: number } {
  const m = [...(t ?? "").matchAll(/(\d{1,2})\s*h\s*(\d{2})?/gi)];
  if (!m.length) return {};
  const mins = (x: RegExpMatchArray) => +x[1] * 60 + (x[2] ? +x[2] : 0);
  const a = mins(m[0]); const start = `${String(Math.floor(a / 60)).padStart(2, "0")}:${String(a % 60).padStart(2, "0")}`;
  if (a >= 24 * 60 || +m[0][1] > 23) return {};
  if (m.length > 1) { const d = mins(m[1]) - a; if (d > 0 && d <= 12 * 60) return { start, avail: d / 60 }; }
  return { start };
}

export default function Tournoi() {
  const { id } = useParams();
  const [ev, setEv] = useState<ClubEvent | null | undefined>(undefined);
  const [initial, setInitial] = useState<string | null | undefined>(undefined);
  const [err, setErr] = useState("");
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const timer = useRef<number | undefined>(undefined);
  const latest = useRef<string>("");
  const lastSent = useRef<string>("");

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const plan = await api<{ events: ClubEvent[] }>("/club/plan");
        const e = plan.events.find((x) => x.id === id) ?? null;
        if (!alive) return;
        if (!e) { setEv(null); return; }
        const t = await api<{ data: unknown }>(`/club/tournoi/${id}`);
        if (!alive) return;
        const json = t.data ? JSON.stringify(t.data) : null;
        lastSent.current = json ?? "";
        setEv(e); setInitial(json);
      } catch (x) { if (alive) setErr(x instanceof Error ? x.message : "Impossible de charger le tournoi."); }
    })();
    return () => { alive = false; };
  }, [id]);

  const send = async (json: string) => {
    if (!json || json === lastSent.current) return;
    setStatus("saving");
    try { await api(`/club/tournoi/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ data: JSON.parse(json) }) }); lastSent.current = json; setStatus("saved"); }
    catch { setStatus("error"); }
  };

  useEffect(() => {
    if (!ev || initial === undefined) return;
    const css = document.createElement("link"); css.rel = "stylesheet"; css.href = `/tournoi/tournoi.css?v=${Date.now()}`; document.head.appendChild(css);
    const hours = parseHours(ev.time);
    const day = new Date(`${ev.startDate}T12:00:00`).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
    window.__tournoiHost = {
      initial, title: titleOf(ev), dateLabel: day.replace(/^./, (c) => c.toUpperCase()), start: hours.start, avail: hours.avail,
      save: (json) => { latest.current = json; window.clearTimeout(timer.current); timer.current = window.setTimeout(() => { void send(latest.current); }, 1200); },
      scrollTop: () => window.scrollTo({ top: 0 }),
      ready: () => undefined,
    };
    const s = document.createElement("script"); s.src = `/tournoi/tournoi.js?v=${Date.now()}`; document.body.appendChild(s);
    return () => {
      window.clearTimeout(timer.current);
      if (latest.current && latest.current !== lastSent.current) void send(latest.current); // on n'oublie pas le dernier score en quittant la page
      s.remove(); css.remove(); delete window.__tournoiHost; document.body.removeAttribute("data-pr");
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ev, initial]);

  if (err) return <main className="mx-auto max-w-3xl p-4"><BackLink fallback="/coach/club">← Retour</BackLink><p role="alert" className="mt-4 rounded border border-[#b42318] p-3 text-[#b42318]">{err}</p></main>;
  if (ev === undefined || initial === undefined) return <main className="mx-auto max-w-3xl p-4"><p className="text-muted">Chargement du tournoi…</p></main>;
  if (ev === null) return <main className="mx-auto max-w-3xl p-4"><BackLink fallback="/coach/club">← Retour</BackLink><p className="mt-4">Cette animation n'existe plus.</p></main>;
  if (ev.kind !== "ANIMATION") return <main className="mx-auto max-w-3xl p-4"><BackLink fallback="/coach/club">← Retour</BackLink><p className="mt-4">L'aide au tournoi est réservée aux animations.</p></main>;

  return (
    <div id="tournoi-fs" className="min-h-[70vh] bg-[#f6f2ea]">
      <h1 className="sr-only">Aide au tournoi : {titleOf(ev)}</h1>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line bg-white px-4 py-2">
        <BackLink fallback="/coach/club">← Retour au planning</BackLink>
        <p className="m-0 order-last basis-full text-center text-sm text-ink break-words sm:order-none sm:min-w-0 sm:flex-1 sm:basis-0">🎉 {titleOf(ev)} · {fmtRange(ev.startDate, ev.endDate)}{ev.time ? ` · ${ev.time}` : ""}</p>
        <p className="m-0 text-sm text-muted" role="status" aria-live="polite">
          {status === "saving" ? "Enregistrement…" : status === "saved" ? "✔ Enregistré avec l'animation" : status === "error" ? "⚠ Pas enregistré : vérifie la connexion" : ""}
        </p>
      </div>
      <div className="px-4 pb-6">
        <div id="tournoi-root" dangerouslySetInnerHTML={{ __html: markup }} />
      </div>
    </div>
  );
}

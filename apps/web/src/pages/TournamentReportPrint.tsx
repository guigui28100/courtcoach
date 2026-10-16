import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { get } from "../api";
import { BackLink, Empty } from "../components/ui";
import { fmtPeriod, Player, REPORT_FEELINGS, REPORT_THEMES, reportStarsOf, TournamentReport } from "../types";

// Version imprimable du bilan de tournoi (à enregistrer en PDF avec « Imprimer ») : sans le nom de l'entraîneur, sans notes privées.
export default function TournamentReportPrint() {
  const { id = "", rid = "" } = useParams();
  const [p, setP] = useState<Player | null>(null);
  const [r, setR] = useState<TournamentReport | null | undefined>(undefined);
  const [signature, setSignature] = useState<string | null>(null);
  useEffect(() => {
    get<Player>(`/players/${id}`).then(setP).catch(() => setP(null));
    get<TournamentReport[]>(`/players/${id}/tournament-reports`).then((l) => setR(l.find((x) => x.id === rid) ?? null)).catch(() => setR(null));
    get<{ signature: string | null }>(`/players/${id}/signature`).then((x) => setSignature(x.signature)).catch(() => setSignature(null));
  }, [id, rid]);
  const back = `/coach/centre/${id}?onglet=matchs`;
  if (r === null) return <div className="mx-auto max-w-3xl p-6"><Empty>Ce bilan est introuvable.</Empty><BackLink fallback={back} className="btn-clay no-underline">Retour</BackLink></div>;
  if (!r || !p) return <p className="p-8 text-center text-muted">Chargement…</p>;
  const f = REPORT_FEELINGS.find((x) => x.n === r.feeling);
  const well = REPORT_THEMES.filter((t) => r.themes[t.key] && r.themes[t.key].level !== "a-travailler"), work = REPORT_THEMES.filter((t) => r.themes[t.key]?.level === "a-travailler");
  const stars = reportStarsOf(r), wins = r.matches.filter((m) => m.result === "Victoire").length;
  return (
    <div className="mx-auto grid max-w-3xl gap-4 p-4">
      <div className="flex flex-wrap items-center gap-2 print:hidden">
        <BackLink fallback={back} className="btn-outline btn-sm no-underline">← Retour</BackLink>
        <button className="btn-clay btn-sm" onClick={() => window.print()}>🖨️ Imprimer / enregistrer en PDF</button>
        {r.status !== "VALIDATED" && <span className="alert m-0 text-sm">Ce bilan n'est pas encore validé : tu peux l'imprimer pour le relire.</span>}
      </div>
      <article className="print-exact overflow-hidden rounded-2xl border-2 border-line bg-white text-[#1a2233]" aria-label={`Bilan de tournoi de ${p.firstName}`}>
        <header className="px-6 py-5 text-white" style={{ background: "#1f7a4d", borderBottom: "6px solid #dcf247" }}>
          <p className="m-0 text-sm font-bold uppercase tracking-widest opacity-90">🎾 Tennis Club Houdan · Centre de compétition jeunes</p>
          <h1 className="m-0 text-3xl !text-white">Bilan de tournoi</h1>
          <p className="m-0 text-lg">{p.firstName} {p.lastName} · {r.name}</p>
          <p className="m-0 opacity-90">{fmtPeriod(r.dateFrom, r.dateTo)}</p>
        </header>
        <div className="grid gap-5 p-6">
          <p className="m-0 text-xl">{f?.emoji} <strong>{f?.label}</strong> · {wins} victoire{wins > 1 ? "s" : ""}, {r.matches.length - wins} défaite{r.matches.length - wins > 1 ? "s" : ""}</p>
          <section><h2 className="m-0 mb-2 text-lg">Les matchs</h2>
            <table className="w-full border-collapse text-left text-sm"><thead><tr className="border-b-2 border-[#1f7a4d]"><th className="py-1">Date</th><th>Tour</th><th>Score</th><th>Adversaire</th><th>Résultat</th></tr></thead>
              <tbody>{r.matches.map((m, i) => <tr key={i} className="border-b border-[#dfe5ef]"><td className="py-1">{fmtPeriod(m.day, m.day)}</td><td>{m.round || "—"}</td><td>{m.score || "—"}</td><td>{m.opponentRanking || "—"}</td><td className="font-bold">{m.result === "Victoire" ? "🏆 Victoire" : "😕 Défaite"}</td></tr>)}</tbody></table>
          </section>
          {well.length > 0 && <section><h2 className="m-0 mb-1 text-lg">👍 Ce qui était bien</h2><p className="m-0">{well.map((t) => `${t.label}${r.themes[t.key].level === "tres-bien" ? " (très bien)" : ""}`).join(" · ")}</p></section>}
          {work.length > 0 && <section><h2 className="m-0 mb-1 text-lg">🎯 À travailler</h2><p className="m-0">{work.map((t) => t.label).join(" · ")}</p></section>}
          {r.summary && <section className="rounded-xl bg-[#fff8d6] p-4"><h2 className="m-0 mb-1 text-lg">💬 Le mot du bilan</h2><p className="m-0">« {r.summary} »</p></section>}
          {stars > 0 && r.status === "VALIDATED" && <p className="m-0 font-bold">⭐ {stars} étoile{stars > 1 ? "s" : ""} gagnée{stars > 1 ? "s" : ""} en match (doublées) sur les objectifs.</p>}
          <footer className="grid justify-items-end gap-1 pt-4"><span className="text-sm text-[#51607a]">Le coach</span>{signature ? <img src={signature} alt="Signature du coach" className="h-16" /> : <span className="h-16" />}</footer>
        </div>
      </article>
    </div>
  );
}

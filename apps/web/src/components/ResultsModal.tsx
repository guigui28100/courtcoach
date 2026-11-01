import { useEffect, useRef, useState } from "react";
import { BgPicker } from "./PosterBackdrop";
import { ClubEvent, titleOf } from "../clubPlan";
import { usePartnerLogos } from "../sponsors";
import { posterToPdf, posterToPng } from "./exportPoster";
import { fullRange } from "./ClubPoster";
import { photoFromFile } from "./RecapPoster";
import { emptyResults, emptyTournament, MAX_PHOTOS_EACH, MAX_RESULT_LINES, MAX_TOURNAMENTS, RESULTS_SIZES, ResultsData, ResultsFormat, ResultsPoster, ResultsTournament } from "./ResultsPoster";

const field = "w-full rounded-xl border-2 border-line bg-white px-3 py-2 text-sm font-normal";
const Pill = ({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) => (
  <button type="button" aria-pressed={on} onClick={onClick} className={`rounded-xl border-2 px-3 py-2 text-sm font-bold ${on ? "border-ink bg-ink text-white" : "border-line bg-white text-ink hover:border-ink"}`}>{children}</button>
);
const YOUTH = ["Garçons 8/10 ans", "Garçons 11/12 ans", "Garçons 13/14 ans", "Garçons 15/18 ans", "Filles 8/10 ans", "Filles 11/12 ans", "Filles 13/14 ans", "Filles 15/18 ans"];
const QUICK = ["🥇 Vainqueur", "🥈 Finaliste", "Demi-finalistes", "👏 Bravo à"];

// Fenêtre de l'affiche « Résultats de plusieurs tournois » : RIEN n'est enregistré ni envoyé, tout reste dans cette fenêtre.
export function ResultsModal({ events, onClose }: { events: ClubEvent[]; onClose: () => void }) {
  const [format, setFormat] = useState<ResultsFormat>("PORTRAIT");
  const [bg, setBg] = useState("");
  const [d, setD] = useState<ResultsData>(emptyResults);
  const logos = usePartnerLogos(); const [withPartners, setWithPartners] = useState(true);
  const [scale, setScale] = useState(0.4); const [msg, setMsg] = useState("");
  const holder = useRef<HTMLDivElement>(null);
  const { w, h } = RESULTS_SIZES[format];
  useEffect(() => { const f = () => setScale(Math.min(0.5, (window.innerWidth < 900 ? Math.min(window.innerWidth, 720) - 56 : 400) / w, window.innerWidth < 768 ? 9 : (window.innerHeight - 260) / h)); f(); window.addEventListener("resize", f); return () => window.removeEventListener("resize", f); }, [w, h]);
  const planned = events.filter((e) => e.kind === "TOURNOI").sort((a, b) => b.startDate.localeCompare(a.startDate)).slice(0, 30);
  const setT = (i: number, p: Partial<ResultsTournament>) => setD((o) => ({ ...o, tournaments: o.tournaments.map((t, j) => (j === i ? { ...t, ...p } : t)) }));
  const addPhotos = async (i: number, files: FileList | null) => {
    if (!files) return; setMsg("");
    try { const t = d.tournaments[i]; const room = MAX_PHOTOS_EACH - t.photos.length; const list = await Promise.all(Array.from(files).slice(0, room).map(photoFromFile)); setT(i, { photos: [...t.photos, ...list] }); if (files.length > room) setMsg(`${MAX_PHOTOS_EACH} photos au plus par tournoi.`); }
    catch (x) { setMsg((x as Error).message); }
  };
  const save = async (kind: "png" | "pdf") => {
    setMsg(kind === "png" ? "Je prépare l'image…" : "Je prépare le PDF…");
    try {
      const node = holder.current?.firstElementChild as HTMLElement;
      const blob = kind === "png" ? await posterToPng(node, w, h) : await posterToPdf(node, w, h);
      const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `resultats-tournois-${format.toLowerCase()}.${kind}`;
      document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
      setMsg(kind === "png" ? "✔ Image enregistrée dans tes téléchargements : envoie-la sur Facebook, Instagram ou WhatsApp." : "✔ PDF enregistré dans tes téléchargements.");
    } catch { setMsg("Impossible de faire le fichier sur cet appareil."); }
  };
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label="Affiche de résultats de plusieurs tournois" onClick={(x) => x.stopPropagation()} className="max-h-[94vh] w-full max-w-5xl overflow-y-auto rounded-t-3xl bg-[#fbf8f2] p-5 shadow-2xl sm:rounded-3xl">
        <div className="mb-3 flex items-center justify-between gap-2"><h2 className="m-0 text-xl text-ink">🏆 Affiche de résultats : plusieurs tournois</h2><button type="button" className="btn-outline" onClick={onClose}>✕ Fermer</button></div>
        <details className="mb-3 rounded-xl bg-[#fff4cc] p-3 text-sm text-[#6b4e00]">
          <summary role="note" className="cursor-pointer font-bold">⚠️ Avant de publier : seulement les photos d'enfants dont les parents ont donné le droit à l'image</summary>
          <p className="m-0 mt-2">Rubrique « Mes autorisations » de leur famille. Pour les enfants, écris seulement le prénom. <b>Rien n'est enregistré</b> : les photos et les noms restent dans cette fenêtre. Si tu la fermes, il faudra tout refaire.</p>
        </details>
        <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,420px)]">
          <div className="grid min-w-0 content-start gap-3">
            <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Titre de l'affiche : choix rapide">
              <Pill on={d.headline === "Résultats du week-end"} onClick={() => setD({ ...d, headline: "Résultats du week-end" })}>Résultats du week-end</Pill>
              <Pill on={d.headline === "Résultats des vacances"} onClick={() => setD({ ...d, headline: "Résultats des vacances" })}>Résultats des vacances</Pill>
            </div>
            <label className="text-sm font-bold text-ink">Titre de l'affiche <span className="font-normal text-muted">(ou écris le tien)</span>
              <input aria-label="Titre de l'affiche" className={`${field} mt-1`} maxLength={40} placeholder="Résultats" value={d.headline} onChange={(x) => setD({ ...d, headline: x.target.value })} /></label>
            {d.tournaments.map((t, i) => (
              <section key={i} aria-label={`Tournoi ${i + 1}`} className="grid gap-2 rounded-2xl border-2 border-line bg-white p-3">
                <div className="flex items-center justify-between gap-2"><h3 className="m-0 text-base text-ink">Tournoi {i + 1}</h3>
                  {d.tournaments.length > 1 && <button type="button" className="btn-outline" aria-label={`Retirer le tournoi ${i + 1}`} onClick={() => setD({ ...d, tournaments: d.tournaments.filter((_, j) => j !== i) })}>🗑️ Retirer</button>}</div>
                {planned.length > 0 && (
                  <select aria-label={`Tournoi ${i + 1} : reprendre un tournoi du planning`} className={field} value="" onChange={(x) => { const e = planned.find((y) => y.id === x.target.value); if (e) setT(i, { name: titleOf(e), when: fullRange(e).replace(/^./, (c) => c.toUpperCase()) }); }}>
                    <option value="">Reprendre un tournoi du planning…</option>
                    {planned.map((e) => <option key={e.id} value={e.id}>{titleOf(e)} · {e.startDate.split("-").reverse().join("/")}</option>)}
                  </select>)}
                <div className="flex flex-wrap gap-2">
                  <input aria-label={`Tournoi ${i + 1} : nom`} className={`${field} min-w-0 flex-[2]`} maxLength={60} placeholder="Nom du tournoi" value={t.name} onChange={(x) => setT(i, { name: x.target.value })} />
                  <input aria-label={`Tournoi ${i + 1} : dates`} className={`${field} min-w-0 flex-1`} maxLength={40} placeholder="Dates (ex. 7 et 8 nov.)" value={t.when} onChange={(x) => setT(i, { when: x.target.value })} />
                </div>
                <div className="grid gap-2">
                  {t.results.map((r, j) => (
                    <div key={j} className="flex gap-2">
                      {r.group && (j === 0 || t.results[j - 1].group !== r.group) && <span className="grid min-w-24 place-items-center rounded-xl bg-[#efe8da] px-2 text-center text-xs font-extrabold text-ink">{r.group}</span>}
                      <input aria-label={`Tournoi ${i + 1}, résultat ${j + 1} : quoi`} className={field} maxLength={40} placeholder="Quoi (ex. Finale)" value={r.what} onChange={(x) => setT(i, { results: t.results.map((o, m) => (m === j ? { ...o, what: x.target.value } : o)) })} />
                      <input aria-label={`Tournoi ${i + 1}, résultat ${j + 1} : résultat`} className={field} maxLength={120} placeholder={r.what.includes("Bravo") ? "Les prénoms" : "Résultat (ex. Paul, 6-4 6-3)"} value={r.result} onChange={(x) => setT(i, { results: t.results.map((o, m) => (m === j ? { ...o, result: x.target.value } : o)) })} />
                      <button type="button" className="btn-outline" aria-label={`Retirer le résultat ${j + 1}`} onClick={() => setT(i, { results: t.results.filter((_, m) => m !== j) })}>🗑️</button>
                    </div>))}
                  {t.results.length < MAX_RESULT_LINES && <div className="flex flex-wrap gap-2">{QUICK.map((a) => <button key={a} type="button" className="btn-outline" onClick={() => setT(i, { results: [...t.results, { what: a, result: "" }] })}>＋ {a}</button>)}<button type="button" className="btn-outline" onClick={() => setT(i, { results: [...t.results, { what: "", result: "" }] })}>＋ Autre ligne</button></div>}
                  {t.results.length + 2 <= MAX_RESULT_LINES && (
                    <select aria-label={`Tournoi ${i + 1} : ajouter une catégorie de jeunes avec vainqueur et finaliste`} className={field} value="" onChange={(x) => { const g = x.target.value; if (g) setT(i, { results: [...t.results, { what: "🥇 Vainqueur", result: "", group: g }, { what: "🥈 Finaliste", result: "", group: g }] }); }}>
                      <option value="">＋ Une catégorie de jeunes (vainqueur et finaliste)…</option>
                      {YOUTH.map((g) => <option key={g} value={g}>{g}</option>)}
                    </select>)}
                </div>
                <div>
                  <p className="m-0 mb-1 text-sm font-bold text-ink">📷 Photos de ce tournoi <span className="font-normal text-muted">({t.photos.length} sur {MAX_PHOTOS_EACH})</span></p>
                  <ul className="m-0 flex list-none flex-wrap gap-2 p-0">
                    {t.photos.map((s, j) => (
                      <li key={j} className="relative"><img src={s} alt={`Photo ${j + 1} du tournoi ${i + 1}`} className="size-20 rounded-lg object-cover" />
                        <button type="button" aria-label={`Retirer la photo ${j + 1}`} className="absolute right-1 top-1 grid size-7 place-items-center rounded-md bg-white/90 text-sm shadow" onClick={() => setT(i, { photos: t.photos.filter((_, m) => m !== j) })}>🗑️</button></li>))}
                    {t.photos.length < MAX_PHOTOS_EACH && (
                      <li><label className="grid size-20 cursor-pointer place-items-center rounded-lg border-2 border-dashed border-line bg-[#fbf8f2] text-center text-xs font-bold text-ink hover:border-ink"><span><span className="block text-xl" aria-hidden>📷</span>Ajouter</span>
                        <input aria-label={`Ajouter des photos au tournoi ${i + 1}`} type="file" multiple accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(x) => { void addPhotos(i, x.target.files); x.target.value = ""; }} /></label></li>)}
                  </ul>
                </div>
              </section>))}
            {d.tournaments.length < MAX_TOURNAMENTS && <button type="button" className="btn-outline justify-self-start" onClick={() => setD({ ...d, tournaments: [...d.tournaments, emptyTournament()] })}>＋ Ajouter un tournoi</button>}
            <label className="text-sm font-bold text-ink">Un mot de remerciement <span className="font-normal text-muted">(facultatif)</span>
              <textarea aria-label="Mot de remerciement" rows={2} maxLength={200} className={`${field} mt-1`} value={d.message} onChange={(x) => setD({ ...d, message: x.target.value })} /></label>
            <details className="rounded-2xl border-2 border-line bg-white p-3">
              <summary className="cursor-pointer text-base font-extrabold text-ink">🎨 Fond <span className="text-xs font-normal text-muted">(facultatif)</span></summary>
              <div className="mt-3"><BgPicker bg={bg} onChange={setBg} /></div>
            </details>
          </div>
          <div className="min-w-0 md:sticky md:top-0 md:self-start">
            <div className="mb-3 flex flex-wrap justify-center gap-2">
              <Pill on={format === "PORTRAIT"} onClick={() => setFormat("PORTRAIT")}>📱 Portrait 4:5</Pill>
              <Pill on={format === "CARRE"} onClick={() => setFormat("CARRE")}>⬜ Carré</Pill>
              <Pill on={format === "A4"} onClick={() => setFormat("A4")}>📄 A4 (à imprimer)</Pill>
              {logos.length > 0 && <Pill on={withPartners} onClick={() => setWithPartners(!withPartners)}>🤝 Remercier les partenaires</Pill>}
            </div>
            <div className="mx-auto overflow-hidden rounded-lg border border-line shadow-lg" style={{ width: w * scale, height: h * scale }}>
              <div className="pf-prev" ref={holder} style={{ width: w, height: h, transform: `scale(${scale})`, transformOrigin: "top left" }}><ResultsPoster format={format} data={d} partners={withPartners ? logos : []} bg={bg} /></div>
            </div>
            <p className="mb-0 mt-2 text-center text-xs text-muted">L'aperçu change pendant que tu écris.</p>
            <div className="mt-3 flex flex-wrap justify-center gap-2">
              <button type="button" className="btn-clay" onClick={() => save("png")}>💾 Enregistrer en image (PNG)</button>
              <button type="button" className="btn-outline bg-white hover:bg-ink hover:text-white" onClick={() => save("pdf")}>📄 PDF</button>
            </div>
            {msg && <p className="mb-0 mt-2 text-center text-sm font-bold text-ink" role="status">{msg}</p>}
          </div>
        </div>
      </div>
    </div>
  );
}

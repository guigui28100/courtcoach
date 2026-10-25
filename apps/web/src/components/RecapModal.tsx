import { useEffect, useRef, useState } from "react";
import { ClubEvent, titleOf } from "../clubPlan";
import { usePartnerLogos } from "../sponsors";
import { posterToPdf, posterToPng } from "./exportPoster";
import { emptyRecap, photoFromFile, RECAP_SIZES, RecapData, RecapFormat, RecapPoster } from "./RecapPoster";

const field = "w-full rounded-xl border-2 border-line bg-white px-3 py-2 text-sm font-normal";
const Pill = ({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) => (
  <button type="button" aria-pressed={on} onClick={onClick} className={`rounded-xl border-2 px-3 py-2 text-sm font-bold ${on ? "border-ink bg-ink text-white" : "border-line bg-white text-ink hover:border-ink"}`}>{children}</button>
);
const slug = (e: ClubEvent) => titleOf(e).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const MAX_PHOTOS = 6, MAX_RESULTS = 10, MAX_STEPS = 8;
const QUICK = [["🥇 Vainqueur", ""], ["🥈 Finaliste", ""], ["Demi-finalistes", ""], ["Match par équipes", "Victoire 4 – 2"]];

// Fenêtre de l'affiche de bilan : on choisit des photos, on écrit les résultats et le déroulement ; RIEN n'est enregistré ni envoyé.
export function RecapModal({ e, onClose }: { e: ClubEvent; onClose: () => void }) {
  const [format, setFormat] = useState<RecapFormat>("CARRE");
  const [d, setD] = useState<RecapData>(emptyRecap());
  const logos = usePartnerLogos(); const [withPartners, setWithPartners] = useState(true);
  const [scale, setScale] = useState(0.4); const [msg, setMsg] = useState("");
  const holder = useRef<HTMLDivElement>(null);
  const { w, h } = RECAP_SIZES[format];
  useEffect(() => { const f = () => setScale(Math.min(0.5, (window.innerWidth < 900 ? Math.min(window.innerWidth, 720) - 56 : 400) / w)); f(); window.addEventListener("resize", f); const k = (ev: KeyboardEvent) => ev.key === "Escape" && onClose(); window.addEventListener("keydown", k); return () => { window.removeEventListener("resize", f); window.removeEventListener("keydown", k); }; }, [w, onClose]);
  const set = (p: Partial<RecapData>) => setD((o) => ({ ...o, ...p }));
  const addPhotos = async (files: FileList | null) => {
    if (!files) return; setMsg("");
    try { const room = MAX_PHOTOS - d.photos.length; const list = await Promise.all(Array.from(files).slice(0, room).map(photoFromFile)); set({ photos: [...d.photos, ...list] }); if (files.length > room) setMsg(`${MAX_PHOTOS} photos au plus : les autres n'ont pas été ajoutées.`); }
    catch (x) { setMsg((x as Error).message); }
  };
  const png = async () => {
    setMsg("Je prépare l'image…");
    try {
      const blob = await posterToPng(holder.current?.firstElementChild as HTMLElement, w, h);
      const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `bilan-${slug(e)}-${e.startDate}-${format === "CARRE" ? "carre" : "portrait"}.png`;
      document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); setMsg("✔ Image enregistrée dans tes téléchargements : envoie-la sur Facebook, Instagram ou WhatsApp.");
    } catch { setMsg("Impossible de faire l'image sur cet appareil."); }
  };
  const pdf = async () => {
    setMsg("Je prépare le PDF…");
    try {
      const blob = await posterToPdf(holder.current?.firstElementChild as HTMLElement, w, h);
      const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `bilan-${slug(e)}-${e.startDate}.pdf`;
      document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); setMsg("✔ PDF enregistré dans tes téléchargements.");
    } catch { setMsg("Impossible de faire le PDF sur cet appareil."); }
  };
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label="Affiche de bilan" onClick={(x) => x.stopPropagation()} className="max-h-[94vh] w-full max-w-5xl overflow-y-auto rounded-t-3xl bg-[#fbf8f2] p-5 shadow-2xl sm:rounded-3xl">
        <div className="mb-3 flex items-center justify-between gap-2"><h2 className="m-0 text-xl text-ink">📸 Affiche de bilan : {titleOf(e)}</h2><button type="button" className="btn-outline" onClick={onClose}>✕ Fermer</button></div>
        <p role="note" className="mb-3 mt-0 rounded-xl bg-[#fff4cc] p-3 text-sm text-[#6b4e00]">
          <b>⚠️ Avant de publier :</b> ne mets que des photos d'enfants dont les parents ont donné le <b>droit à l'image</b> (rubrique « Mes autorisations »), et pour les enfants écris seulement le prénom. <b>Rien n'est enregistré</b> : les photos et les noms restent dans cette fenêtre et ne sont envoyés nulle part ; si tu la fermes, il faudra tout refaire.
        </p>
        <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,420px)]">
          <div className="grid min-w-0 content-start gap-3">
            <div className="flex flex-wrap gap-2">
              <Pill on={format === "CARRE"} onClick={() => setFormat("CARRE")}>⬜ Carré (Facebook, Instagram)</Pill>
              <Pill on={format === "PORTRAIT"} onClick={() => setFormat("PORTRAIT")}>📱 Portrait 4:5</Pill>
              {logos.length > 0 && <Pill on={withPartners} onClick={() => setWithPartners(!withPartners)}>🤝 Remercier les partenaires</Pill>}
            </div>
            <label className="text-sm font-bold text-ink">Petit titre en haut
              <input aria-label="Petit titre" className={`${field} mt-1`} maxLength={40} value={d.headline} onChange={(x) => set({ headline: x.target.value })} /></label>
            <div className="rounded-2xl border-2 border-line bg-white p-3">
              <p className="m-0 mb-2 text-sm font-bold text-ink">📷 Photos <span className="font-normal text-muted">({d.photos.length} sur {MAX_PHOTOS})</span></p>
              <div className="flex flex-wrap items-center gap-2">
                {d.photos.map((s, i) => (
                  <span key={i} className="relative"><img src={s} alt={`Photo ${i + 1}`} className="size-16 rounded-lg object-cover" />
                    <button type="button" aria-label={`Retirer la photo ${i + 1}`} className="absolute -right-2 -top-2 grid size-6 place-items-center rounded-full bg-ink text-xs text-white" onClick={() => set({ photos: d.photos.filter((_, j) => j !== i) })}>✕</button></span>))}
                {d.photos.length < MAX_PHOTOS && <label className="btn-outline cursor-pointer">＋ Ajouter des photos<input aria-label="Ajouter des photos" type="file" multiple accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(x) => { void addPhotos(x.target.files); x.target.value = ""; }} /></label>}
              </div>
            </div>
            <div className="rounded-2xl border-2 border-line bg-white p-3">
              <p className="m-0 mb-2 text-sm font-bold text-ink">🏆 Résultats <span className="font-normal text-muted">(tournoi, match par équipes…)</span></p>
              <div className="grid gap-2">
                {d.results.map((r, i) => (
                  <div key={i} className="flex gap-2">
                    <input aria-label={`Résultat ${i + 1} : quoi`} className={field} maxLength={40} placeholder="Quoi (ex. Finale)" value={r.what} onChange={(x) => set({ results: d.results.map((o, j) => (j === i ? { ...o, what: x.target.value } : o)) })} />
                    <input aria-label={`Résultat ${i + 1} : résultat`} className={field} maxLength={60} placeholder="Résultat (ex. Paul, 6-4 6-3)" value={r.result} onChange={(x) => set({ results: d.results.map((o, j) => (j === i ? { ...o, result: x.target.value } : o)) })} />
                    <button type="button" className="btn-outline" aria-label={`Retirer le résultat ${i + 1}`} onClick={() => set({ results: d.results.filter((_, j) => j !== i) })}>🗑️</button>
                  </div>))}
                {d.results.length < MAX_RESULTS && (
                  <div className="flex flex-wrap gap-2">{QUICK.map(([a, b]) => <button key={a} type="button" className="btn-outline" onClick={() => set({ results: [...d.results, { what: a, result: b }] })}>＋ {a}</button>)}<button type="button" className="btn-outline" onClick={() => set({ results: [...d.results, { what: "", result: "" }] })}>＋ Une ligne libre</button></div>)}
              </div>
            </div>
            <div className="rounded-2xl border-2 border-line bg-white p-3">
              <p className="m-0 mb-2 text-sm font-bold text-ink">📋 Déroulement <span className="font-normal text-muted">(pour une animation, un stage…)</span></p>
              <div className="grid gap-2">
                {d.steps.map((s, i) => (
                  <div key={i} className="flex gap-2">
                    <input aria-label={`Étape ${i + 1} : heure`} className={`${field} !w-28 shrink-0`} maxLength={14} placeholder="9 h 30" value={s.time} onChange={(x) => set({ steps: d.steps.map((o, j) => (j === i ? { ...o, time: x.target.value } : o)) })} />
                    <input aria-label={`Étape ${i + 1} : ce qui s'est passé`} className={field} maxLength={50} placeholder="Ce qui s'est passé" value={s.text} onChange={(x) => set({ steps: d.steps.map((o, j) => (j === i ? { ...o, text: x.target.value } : o)) })} />
                    <button type="button" className="btn-outline" aria-label={`Retirer l'étape ${i + 1}`} onClick={() => set({ steps: d.steps.filter((_, j) => j !== i) })}>🗑️</button>
                  </div>))}
                {d.steps.length < MAX_STEPS && <button type="button" className="btn-outline justify-self-start" onClick={() => set({ steps: [...d.steps, { time: "", text: "" }] })}>＋ Ajouter une étape</button>}
              </div>
            </div>
            <label className="text-sm font-bold text-ink">Un mot de remerciement <span className="font-normal text-muted">(facultatif)</span>
              <textarea aria-label="Mot de remerciement" rows={2} maxLength={200} className={`${field} mt-1`} value={d.message} onChange={(x) => set({ message: x.target.value })} /></label>
          </div>
          <div className="min-w-0 md:sticky md:top-0 md:self-start">
            <div className="mx-auto overflow-hidden rounded-lg border border-line shadow-lg" style={{ width: w * scale, height: h * scale }}>
              <div ref={holder} style={{ width: w, height: h, transform: `scale(${scale})`, transformOrigin: "top left" }}><RecapPoster e={e} format={format} data={d} partners={withPartners ? logos : []} /></div>
            </div>
            <p className="mb-0 mt-2 text-center text-xs text-muted">L'aperçu change pendant que tu écris.</p>
            <div className="mt-3 flex flex-wrap justify-center gap-2">
              <button type="button" className="btn-clay" onClick={png}>💾 Enregistrer en image (PNG)</button>
              <button type="button" className="btn-outline bg-white hover:bg-ink hover:text-white" onClick={pdf}>📄 PDF</button>
            </div>
            {msg && <p className="mb-0 mt-2 text-center text-sm font-bold text-ink" role="status">{msg}</p>}
          </div>
        </div>
      </div>
    </div>
  );
}

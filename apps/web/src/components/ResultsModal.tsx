import { useEffect, useRef, useState } from "react";
import { ClubEvent, titleOf } from "../clubPlan";
import { usePartnerLogos } from "../sponsors";
import { fullRange } from "./ClubPoster";
import { photoFromFile } from "./RecapPoster";
import { deleteDraft, listDrafts, PosterDraft } from "./posterDrafts";
import { loadOnline, OnlineInfo, PhotoAccess, saveOnline } from "./posterOnline";
import { PosterStudio, photoSig, StudioFormat, useAutosave } from "./PosterStudio";
import { DraftsMenu } from "./DraftsMenu";
import { emptyResults, emptyTournament, MAX_PHOTOS_EACH, MAX_PHOTOS_TOTAL, MAX_RESULT_LINES, MAX_TOURNAMENTS, RESULTS_SIZES, ResultsData, ResultsFormat, ResultsPoster, ResultsTournament } from "./ResultsPoster";

// Vignette « cadre » : la photo remplit le cadre, on la fait glisser pour montrer la partie qui manque (jamais de vide)
function PhotoFrame({ src, alt, focus, zoom = 1, onFocus }: { src: string; alt: string; focus: [number, number]; zoom?: number; onFocus: (x: number, y: number) => void }) {
  const drag = useRef<{ x: number; y: number; fx: number; fy: number; ox: number; oy: number } | null>(null);
  const down = (e: React.PointerEvent<HTMLDivElement>) => {
    const box = e.currentTarget.getBoundingClientRect(), img = e.currentTarget.firstElementChild as HTMLImageElement;
    const iw = img.naturalWidth || 1, ih = img.naturalHeight || 1, k = Math.max(box.width / iw, box.height / ih);
    drag.current = { x: e.clientX, y: e.clientY, fx: focus[0], fy: focus[1], ox: Math.max(1, iw * k * zoom - box.width), oy: Math.max(1, ih * k * zoom - box.height) };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const move = (e: React.PointerEvent<HTMLDivElement>) => {
    const g = drag.current; if (!g) return;
    onFocus(g.fx - ((e.clientX - g.x) / g.ox) * 100, g.fy - ((e.clientY - g.y) / g.oy) * 100);
  };
  return (
    <div role="img" aria-label={alt} className="aspect-[4/3] w-28 cursor-grab touch-none overflow-hidden rounded-lg active:cursor-grabbing" onPointerDown={down} onPointerMove={move} onPointerUp={() => { drag.current = null; }} onPointerCancel={() => { drag.current = null; }}>
      <img src={src} alt="" draggable={false} className="size-full select-none object-cover" style={{ objectPosition: `${focus[0]}% ${focus[1]}%`, transform: `scale(${zoom})`, transformOrigin: `${focus[0]}% ${focus[1]}%` }} />
    </div>
  );
}

const field = "w-full rounded-xl border-2 border-line bg-white px-3 py-2 text-sm font-normal";
const Pill = ({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) => (
  <button type="button" aria-pressed={on} onClick={onClick} className={`rounded-xl border-2 px-3 py-2 text-sm font-bold ${on ? "border-ink bg-ink text-white" : "border-line bg-white text-ink hover:border-ink"}`}>{children}</button>
);
const YOUTH = ["Garçons 8/10 ans", "Garçons 11/12 ans", "Garçons 13/14 ans", "Garçons 15/18 ans", "Filles 8/10 ans", "Filles 11/12 ans", "Filles 13/14 ans", "Filles 15/18 ans"];
const QUICK = ["🥇 Vainqueur", "🥈 Finaliste", "Demi-finalistes", "👏 Bravo à"];

type Saved = { d: ResultsData; format: ResultsFormat; bg: string; withPartners: boolean };
const resultsAccess: PhotoAccess<Saved> = {
  photos: (s) => s.d.tournaments.flatMap((t) => t.photos),
  remap: (s, f) => ({ ...s, d: { ...s.d, tournaments: s.d.tournaments.map((t) => ({ ...t, photos: t.photos.map(f) })) } }),
};
const FORMATS: StudioFormat[] = [
  { id: "PORTRAIT", label: "📱 Portrait 4:5", ...RESULTS_SIZES.PORTRAIT }, { id: "CARRE", label: "⬜ Carré", ...RESULTS_SIZES.CARRE }, { id: "A4", label: "📄 A4", ...RESULTS_SIZES.A4 },
];

// Affiche « Résultats de plusieurs tournois » dans le studio commun. Elle s'enregistre TOUTE SEULE en ligne (photos comprises) : coach, président et bureau seulement.
export function ResultsModal({ events, onClose }: { events: ClubEvent[]; onClose: () => void }) {
  const [format, setFormat] = useState<ResultsFormat>("PORTRAIT");
  const [bg, setBg] = useState("");
  const [d, setD] = useState<ResultsData>(emptyResults);
  const logos = usePartnerLogos(); const [withPartners, setWithPartners] = useState(true);
  const [msg, setMsg] = useState("");
  const [draftId, setDraftId] = useState<string | null>(null);
  const idRef = useRef<string | null>(null);
  const [local, setLocal] = useState<PosterDraft<Saved>[]>([]);
  const [rev, setRev] = useState(0);
  useEffect(() => { listDrafts<Saved>("resultats").then(setLocal).catch(() => setLocal([])); }, [rev]);
  const name = d.headline.trim() || "Affiche de résultats";
  const sig = JSON.stringify({ d: { ...d, tournaments: d.tournaments.map((t) => ({ ...t, photos: t.photos.map(photoSig) })) }, format, bg, withPartners });
  const auto = useAutosave({
    sig,
    save: async () => {
      const id = await saveOnline<Saved>("resultats", idRef.current, name, { d, format, bg, withPartners }, resultsAccess, (n, t) => t && auto.setState({ kind: "saving", text: `Envoi des photos : ${n} sur ${t}…` }));
      idRef.current = id; setDraftId(id); setRev((r) => r + 1);
    },
  });
  const openDraft = async (x: OnlineInfo) => {
    await auto.flush();
    const r = await loadOnline<Saved>(x.id, resultsAccess);
    auto.skipNext(); idRef.current = x.id; setDraftId(x.id);
    setD(r.saved.d); setFormat(r.saved.format); setBg(r.saved.bg); setWithPartners(r.saved.withPartners); auto.setState({ kind: "saved" });
  };
  const planned = events.filter((e) => e.kind === "TOURNOI").sort((a, b) => b.startDate.localeCompare(a.startDate)).slice(0, 30);
  const setT = (i: number, p: Partial<ResultsTournament>) => setD((o) => ({ ...o, tournaments: o.tournaments.map((t, j) => (j === i ? { ...t, ...p } : t)) }));
  const addPhotos = async (i: number, files: FileList | null) => {
    if (!files) return; setMsg("");
    try { const t = d.tournaments[i]; const used = d.tournaments.reduce((a, x) => a + x.photos.length, 0); const room = Math.max(0, Math.min(MAX_PHOTOS_EACH - t.photos.length, MAX_PHOTOS_TOTAL - used)); const list = await Promise.all(Array.from(files).slice(0, room).map(photoFromFile)); setT(i, { photos: [...t.photos, ...list] }); if (files.length > room) setMsg(`${MAX_PHOTOS_EACH} photos au plus par tournoi et ${MAX_PHOTOS_TOTAL} sur toute l'affiche : les autres n'ont pas été ajoutées.`); }
    catch (x) { setMsg((x as Error).message); }
  };
  const content = (<>
    <details className="rounded-md bg-[#fff4cc] p-3 text-sm text-[#6b4e00]">
      <summary role="note" className="cursor-pointer font-bold">⚠️ Seulement les photos d'enfants dont les parents ont donné le droit à l'image</summary>
      <p className="m-0 mt-2">Rubrique « Mes autorisations » de leur famille. Pour les enfants, écris seulement le prénom. L'affiche et ses photos sont gardées sur le serveur du club (visibles seulement par le coach, le président et le bureau).</p>
    </details>
    {msg && <p className="m-0 text-sm font-bold text-ink" role="status">{msg}</p>}
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
          {t.photos.length > 0 && <p className="m-0 mb-2 text-xs text-muted">Une tête est coupée ? Fais glisser la photo avec le doigt ou la souris (vers le bas pour faire apparaître le haut), ou avec les flèches ◀ ▲ ▼ ▶ : ➕ grossit la photo. Elle reste toujours dans son cadre.</p>}
          <ul className="m-0 flex list-none flex-wrap gap-2 p-0">
            {t.photos.map((s, j) => { const fo = t.focus?.[j] ?? [50, 50]; const setFocus = (x: number, y: number) => { const f = t.photos.map((_, m) => t.focus?.[m] ?? [50, 50]); f[j] = [Math.max(0, Math.min(100, x)), Math.max(0, Math.min(100, y))]; setT(i, { focus: f as [number, number][] }); };
              // La photo reste toujours dans son cadre : on la FAIT GLISSER (au doigt, à la souris ou avec les flèches) pour montrer la partie qui manque
              const zo = t.zoom?.[j] ?? 1; const setZoom = (v: number) => { const z = t.photos.map((_, m) => t.zoom?.[m] ?? 1); z[j] = Math.max(1, Math.min(3, Math.round(v * 4) / 4)); setT(i, { zoom: z }); };
              const slide = (dx: number, dy: number) => setFocus(fo[0] - dx, fo[1] - dy);
              const B = "grid size-8 place-items-center rounded-md border border-line bg-white text-sm font-bold hover:bg-sand";
              return (
              <li key={j} className="relative w-28"><PhotoFrame src={s} alt={`Photo ${j + 1} du tournoi ${i + 1}`} focus={fo} zoom={zo} onFocus={setFocus} />
                <button type="button" aria-label={`Retirer la photo ${j + 1}`} className="absolute right-1 top-1 grid size-7 place-items-center rounded-md bg-white/90 text-sm shadow" onClick={() => setT(i, { photos: t.photos.filter((_, m) => m !== j), focus: (t.focus ?? []).filter((_, m) => m !== j), zoom: (t.zoom ?? []).filter((_, m) => m !== j) })}>🗑️</button>
                <div className="mt-1 flex justify-between" role="group" aria-label={`Faire glisser la photo ${j + 1}`}>
                  <button type="button" className={B} aria-label="Glisser la photo vers la gauche" onClick={() => slide(-12, 0)}>◀</button>
                  <button type="button" className={B} aria-label="Glisser la photo vers le haut" onClick={() => slide(0, -12)}>▲</button>
                  <button type="button" className={B} aria-label="Glisser la photo vers le bas" onClick={() => slide(0, 12)}>▼</button>
                  <button type="button" className={B} aria-label="Glisser la photo vers la droite" onClick={() => slide(12, 0)}>▶</button>
                </div>
                <div className="mt-1 flex items-center justify-between" role="group" aria-label={`Taille de la photo ${j + 1}`}>
                  <button type="button" className={B} aria-label="Réduire la photo" disabled={zo <= 1} onClick={() => setZoom(zo - 0.25)}>➖</button>
                  <span className="text-xs text-muted">{zo === 1 ? "taille normale" : `×${zo}`}</span>
                  <button type="button" className={B} aria-label="Grossir la photo" disabled={zo >= 3} onClick={() => setZoom(zo + 0.25)}>➕</button>
                </div></li>); })}
            {t.photos.length < MAX_PHOTOS_EACH && d.tournaments.reduce((a, x) => a + x.photos.length, 0) < MAX_PHOTOS_TOTAL && (
              <li><label className="grid size-20 cursor-pointer place-items-center rounded-lg border-2 border-dashed border-line bg-[#fbf8f2] text-center text-xs font-bold text-ink hover:border-ink"><span><span className="block text-xl" aria-hidden>📷</span>Ajouter</span>
                <input aria-label={`Ajouter des photos au tournoi ${i + 1}`} type="file" multiple accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(x) => { void addPhotos(i, x.target.files); x.target.value = ""; }} /></label></li>)}
          </ul>
        </div>
      </section>))}
    {d.tournaments.length < MAX_TOURNAMENTS && <button type="button" className="btn-outline justify-self-start" onClick={() => setD({ ...d, tournaments: [...d.tournaments, emptyTournament()] })}>＋ Ajouter un tournoi</button>}
    <label className="text-sm font-bold text-ink">Un mot de remerciement <span className="font-normal text-muted">(facultatif)</span>
      <textarea aria-label="Mot de remerciement" rows={2} maxLength={200} className={`${field} mt-1`} value={d.message} onChange={(x) => setD({ ...d, message: x.target.value })} /></label>
  </>);
  return (
    <PosterStudio
      title="🏆 Résultats de plusieurs tournois" subtitle={`${d.tournaments.length} tournoi${d.tournaments.length > 1 ? "s" : ""} · ${draftId ? "enregistrée en ligne" : "pas encore enregistrée"}`} onClose={() => { void auto.flush().finally(onClose); }}
      formats={FORMATS} format={format} onFormat={(f) => setFormat(f as ResultsFormat)}
      content={content} bg={bg} onBg={setBg}
      partners={{ count: logos.length, on: withPartners, onChange: setWithPartners, label: "🤝 Remercier les partenaires" }}
      preview={() => <ResultsPoster format={format} data={d} partners={withPartners ? logos : []} bg={bg} />}
      printNode={<ResultsPoster format={format} data={d} partners={withPartners ? logos : []} bg={bg} />}
      fileBase={(f) => `resultats-tournois-${f.toLowerCase()}`}
      save={auto.state.kind === "idle" ? { kind: "idle", text: "Se sauvegarde toute seule, photos comprises" } : auto.state}
      beforeDownload={auto.flush}
      topExtra={<DraftsMenu kind="resultats" currentId={draftId} refreshKey={rev} onOpen={openDraft} onDeleted={(id) => { if (id === idRef.current) { idRef.current = null; setDraftId(null); } }}
        local={local.map((x) => ({ id: x.id, name: x.name }))} onUploadLocal={async (id) => { const x = local.find((y) => y.id === id); if (!x) return; await saveOnline<Saved>("resultats", null, x.name, x.data, resultsAccess); await deleteDraft(x.id); setRev((r) => r + 1); }} />}
    />
  );
}

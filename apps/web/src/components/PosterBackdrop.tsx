import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

// Fonds possibles d'une affiche : « Classique » (neutre, sans fond) ou une photo du club (déposée dans apps/web/public).
export type PosterBg = string; // "" (classique) ou l'adresse d'une photo du club (ex. "/fond-bulle.jpg")
// Les fonds proposés (déposés dans apps/web/public, nom « fond-<mot>.jpg » ; leur vignette est dans apps/web/public/fond-mini/<mot>.jpg).
// Pour en ajouter : déposer le fond ET sa vignette, puis écrire une ligne ici (un seul endroit).
export type PhotoCat = "club" | "terre" | "couleurs" | "enfants" | "joueurs";
export const PHOTO_CATS: { key: PhotoCat; label: string }[] = [{ key: "club", label: "🏟️ Le club" }, { key: "terre", label: "🟠 Terre battue" }, { key: "couleurs", label: "🎨 Couleurs" }, { key: "enfants", label: "🧒 Enfants (dessins)" }, { key: "joueurs", label: "🎾 Joueurs" }];
const P = (name: string, label: string, cat: PhotoCat, dark = false) => ({ url: `/fond-${name}.jpg`, thumb: `/fond-mini/${name}.jpg`, label, cat, dark }); // dark : fond très sombre, le voile blanc est renforcé pour garder le texte lisible
export const PHOTOS = [
  P("bulle", "Sous la bulle", "club"), P("terres", "Les 4 courts", "club"), P("nuit", "La bulle de nuit", "club"), P("neige", "Sous la neige", "club"), P("couchant", "Coucher de soleil", "club"), P("club-orange", "Affiche du club", "club"),
  P("balles-terre", "Balles sur la terre", "terre"), P("terre-revers", "Revers sur la terre", "terre"), P("terre-plongeon", "Plongeon sur la terre", "terre"),
  P("filet-rose", "Filet rose", "couleurs"), P("violet-joueurs", "Violet", "couleurs"), P("bleu-joueur", "Bleu ciel", "couleurs"), P("noir-raquette", "Noir et néon", "couleurs", true), P("style3", "Raquette rose et vert", "couleurs"),
  P("fillette", "Fillette", "enfants"), P("garcon", "Garçon", "enfants"), P("enfants", "Les deux enfants", "enfants"),
  P("ombres", "Ombres sur le court", "joueurs"), P("service-bleu", "Service sur dur bleu", "joueurs"), P("style1", "Tennis bleu nuit", "joueurs"), P("style2", "Joueurs sur fond bleu", "joueurs"),
];
const VEILS = { light: "rgba(255,255,255,.04) 0%,rgba(255,255,255,.14) 50%,rgba(255,255,255,.4) 100%", normal: "rgba(255,255,255,.14) 0%,rgba(255,255,255,.3) 50%,rgba(255,255,255,.6) 100%", strong: "rgba(255,255,255,.45) 0%,rgba(255,255,255,.58) 50%,rgba(255,255,255,.76) 100%" };
// Le fond et son voile blanc (le voile garde le texte lisible) ; sans fond choisi (« Classique »), rien n'est dessiné
export function Backdrop({ bg, w, h, veil = "normal" }: { bg: PosterBg; w: number; h: number; veil?: "light" | "normal" | "strong" }) {
  if (!bg) return null;
  if (PHOTOS.find((p) => p.url === bg)?.dark) veil = veil === "light" ? "normal" : "strong";
  return (<>
    {bg.startsWith("/") && <div aria-hidden style={{ position: "absolute", inset: 0, backgroundImage: `url(${bg})`, backgroundSize: "cover", backgroundPosition: "center" }} />}
    <div aria-hidden style={{ position: "absolute", inset: 0, background: `linear-gradient(180deg,${VEILS[veil]})` }} />
  </>);
}

// Choix du fond (le même pour toutes les affiches) : un bouton qui montre le fond actuel et ouvre une galerie de vignettes rangées par thème
export function BgPicker({ bg, onChange, extra }: { bg: PosterBg; onChange: (b: PosterBg) => void; extra?: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const cur = PHOTOS.find((p) => p.url === bg);
  return (
    <div className="mb-3 flex flex-wrap items-center gap-2" role="group" aria-label="Fond de l'affiche">
      <span className="text-sm font-bold text-ink">🖼️ Fond :</span>
      <button type="button" onClick={() => setOpen(true)} aria-haspopup="dialog" className="flex items-center gap-2 rounded-xl border-2 border-line bg-white px-2 py-1.5 text-sm font-bold text-ink hover:border-ink">
        {cur ? <img src={cur.thumb} alt="" className="h-10 w-8 rounded object-cover" /> : <span aria-hidden className="grid h-10 w-8 place-items-center rounded border border-line bg-white text-xs text-muted">∅</span>}
        <span>{cur ? cur.label : "Classique (sans fond)"}</span>
        <span className="text-xs text-muted">▾ Choisir un autre fond ({PHOTOS.length})</span>
      </button>
      {bg !== "" && <button type="button" onClick={() => onChange("")} className="rounded-xl border-2 border-line bg-white px-3 py-2 text-sm font-bold text-ink hover:border-ink">✕ Sans fond</button>}
      {bg !== "" && extra}
      {open && <BgGallery bg={bg} onPick={(b) => { onChange(b); setOpen(false); }} onClose={() => setOpen(false)} />}
    </div>
  );
}

function BgGallery({ bg, onPick, onClose }: { bg: PosterBg; onPick: (b: PosterBg) => void; onClose: () => void }) {
  const curCat = PHOTOS.find((p) => p.url === bg)?.cat ?? null;
  const [cat, setCat] = useState<PhotoCat | "tous">(curCat ?? "tous");
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", k);
    const old = document.body.style.overflow; document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", k); document.body.style.overflow = old; };
  }, [onClose]);
  const list = PHOTOS.filter((p) => cat === "tous" || p.cat === cat);
  const chip = (on: boolean, label: string, f: () => void, key: string) => (
    <button key={key} type="button" aria-pressed={on} onClick={f} className={`rounded-full border-2 px-3 py-1.5 text-sm font-bold ${on ? "border-ink bg-ink text-white" : "border-line bg-white text-ink hover:border-ink"}`}>{label}</button>
  );
  return createPortal(
    <div role="dialog" aria-modal="true" aria-label="Choisir un fond" className="fixed inset-0 z-[90] flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-4" onClick={onClose}>
      <div className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-t-2xl bg-paper shadow-2xl sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between gap-3 border-b border-line bg-white px-4 py-3">
          <h2 className="m-0 text-lg font-extrabold text-ink">🖼️ Choisis un fond</h2>
          <button type="button" onClick={onClose} className="rounded-lg border-2 border-line bg-white px-3 py-1.5 text-sm font-bold text-ink hover:border-ink">✕ Fermer</button>
        </div>
        <div className="flex flex-wrap gap-1.5 border-b border-line bg-white px-4 py-2" role="group" aria-label="Thèmes de fonds">
          {chip(cat === "tous", `Tous (${PHOTOS.length})`, () => setCat("tous"), "tous")}
          {PHOTO_CATS.map((c) => chip(cat === c.key, `${c.label} (${PHOTOS.filter((p) => p.cat === c.key).length})`, () => setCat(c.key), c.key))}
        </div>
        <div className="overflow-y-auto p-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            <button type="button" aria-pressed={bg === ""} onClick={() => onPick("")} className={`flex flex-col overflow-hidden rounded-xl border-2 bg-white text-left ${bg === "" ? "border-ink ring-2 ring-champagne" : "border-line hover:border-ink"}`}>
              <span aria-hidden className="grid aspect-[3/4] w-full place-items-center bg-white text-3xl text-muted">∅</span>
              <span className="px-2 py-1.5 text-xs font-bold text-ink">{bg === "" ? "✔ " : ""}Classique (sans fond)</span>
            </button>
            {list.map((p) => (
              <button key={p.url} type="button" aria-pressed={bg === p.url} onClick={() => onPick(p.url)} className={`flex flex-col overflow-hidden rounded-xl border-2 bg-white text-left ${bg === p.url ? "border-ink ring-2 ring-champagne" : "border-line hover:border-ink"}`}>
                <img src={p.thumb} alt="" loading="lazy" className="aspect-[3/4] w-full object-cover" />
                <span className="px-2 py-1.5 text-xs font-bold text-ink">{bg === p.url ? "✔ " : ""}{p.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

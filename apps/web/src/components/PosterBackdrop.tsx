import { useEffect, useLayoutEffect, useRef, useState } from "react";
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
export function Backdrop({ bg, w, h, veil = "normal", pos = "center" }: { bg: PosterBg; w: number; h: number; veil?: "light" | "normal" | "strong"; pos?: string }) {
  if (!bg) return null;
  if (PHOTOS.find((p) => p.url === bg)?.dark) veil = veil === "light" ? "normal" : "strong";
  return (<>
    {bg.startsWith("/") && <div aria-hidden style={{ position: "absolute", inset: 0, backgroundImage: `url(${bg})`, backgroundSize: "cover", backgroundPosition: pos }} />}
    <div aria-hidden style={{ position: "absolute", inset: 0, background: `linear-gradient(180deg,${VEILS[veil]})` }} />
  </>);
}

// Choix du fond (le même pour toutes les affiches) : un bouton qui montre le fond actuel et ouvre une galerie de vignettes rangées par thème
export function BgPicker({ bg, onChange, extra }: { bg: PosterBg; onChange: (b: PosterBg) => void; extra?: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const btn = useRef<HTMLButtonElement>(null);
  const cur = PHOTOS.find((p) => p.url === bg);
  return (
    <div className="mb-3 flex flex-wrap items-center gap-2" role="group" aria-label="Fond de l'affiche">
      <span className="text-sm font-bold text-ink">🖼️ Fond :</span>
      <button ref={btn} type="button" onClick={() => setOpen((o) => !o)} aria-haspopup="dialog" aria-expanded={open} className="flex items-center gap-2 rounded-xl border-2 border-line bg-white px-2 py-1.5 text-sm font-bold text-ink hover:border-ink">
        {cur ? <img src={cur.thumb} alt="" className="h-10 w-8 rounded object-cover" /> : <span aria-hidden className="grid h-10 w-8 place-items-center rounded border-2 text-[9px] font-black" style={{ background: "#fbf8f2", borderColor: "#b8975a", color: "#8a6a2f" }}>TCH</span>}
        <span>{cur ? cur.label : "Élégant (ivoire, sans photo)"}</span>
        <span className="text-xs text-muted">▾ {PHOTOS.length} fonds</span>
      </button>
      {bg !== "" && <button type="button" onClick={() => onChange("")} className="rounded-xl border-2 border-line bg-white px-3 py-2 text-sm font-bold text-ink hover:border-ink">✨ Retour à l’élégant</button>}
      {bg !== "" && extra}
      {open && <BgGallery bg={bg} anchor={btn.current} onPick={onChange} onClose={() => setOpen(false)} />}
    </div>
  );
}

// Petite fenêtre de choix, posée juste sous le bouton (elle ne cache pas l'affiche) : vignettes serrées, thèmes en haut ; un clic applique le fond tout de suite
// et la fenêtre RESTE ouverte pour comparer ; elle se ferme par « Terminé », Échap ou un clic à côté.
function BgGallery({ bg, anchor, onPick, onClose }: { bg: PosterBg; anchor: HTMLElement | null; onPick: (b: PosterBg) => void; onClose: () => void }) {
  const curCat = PHOTOS.find((p) => p.url === bg)?.cat ?? null;
  const [cat, setCat] = useState<PhotoCat | "tous">(curCat ?? "tous");
  const [hover, setHover] = useState<string | null>(null);
  const box = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top?: number; bottom?: number; left: number; width: number; maxH: number }>({ top: 0, left: 0, width: 420, maxH: 460 });
  useLayoutEffect(() => {
    const place = () => {
      if (!anchor) return;
      const r = anchor.getBoundingClientRect();
      const width = Math.min(window.innerWidth - 16, 440);
      const left = Math.max(8, Math.min(r.left, window.innerWidth - width - 8));
      // Assez de place dessous : on s'ouvre dessous ; sinon on s'ouvre AU-DESSUS du bouton (jamais caché en bas de l'écran)
      const below = window.innerHeight - r.bottom - 12, above = r.top - 12;
      if (below >= 320 || below >= above) setPos({ top: r.bottom + 6, left, width, maxH: Math.max(200, below) });
      else setPos({ bottom: window.innerHeight - r.top + 6, left, width, maxH: Math.max(200, above) });
    };
    place();
    window.addEventListener("resize", place); window.addEventListener("scroll", place, true);
    return () => { window.removeEventListener("resize", place); window.removeEventListener("scroll", place, true); };
  }, [anchor]);
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    const d = (e: MouseEvent) => { const t = e.target as Node; if (box.current && !box.current.contains(t) && !anchor?.contains(t)) onClose(); };
    window.addEventListener("keydown", k); document.addEventListener("mousedown", d);
    return () => { window.removeEventListener("keydown", k); document.removeEventListener("mousedown", d); };
  }, [onClose, anchor]);
  const list = PHOTOS.filter((p) => cat === "tous" || p.cat === cat);
  const shown = PHOTOS.find((p) => p.url === (hover ?? bg));
  const chip = (on: boolean, label: string, f: () => void, key: string) => (
    <button key={key} type="button" aria-pressed={on} onClick={f} className={`rounded-full border px-2.5 py-1 text-xs font-bold ${on ? "border-ink bg-ink text-white" : "border-line bg-white text-ink hover:border-ink"}`}>{label}</button>
  );
  const tile = (on: boolean, label: string, f: () => void, key: string, img?: string) => (
    <button key={key} type="button" aria-pressed={on} aria-label={label} title={label} onClick={f} onMouseEnter={() => setHover(key === "none" ? "" : key)} onMouseLeave={() => setHover(null)} onFocus={() => setHover(key === "none" ? "" : key)} onBlur={() => setHover(null)}
      className={`relative block overflow-hidden rounded-lg border-2 bg-white ${on ? "border-ink ring-2 ring-champagne" : "border-line hover:border-ink"}`}>
      {img ? <img src={img} alt="" loading="lazy" className="aspect-[3/4] w-full object-cover" /> : <span aria-hidden className="grid aspect-[3/4] w-full place-items-center text-center text-[10px] font-black leading-tight" style={{ background: "#fbf8f2", outline: "2px solid #b8975a", outlineOffset: -6, color: "#8a6a2f" }}>Élégant<br />sans photo</span>}
      {on && <span aria-hidden className="absolute right-1 top-1 grid h-5 w-5 place-items-center rounded-full bg-ink text-[11px] font-black text-white">✓</span>}
    </button>
  );
  return createPortal(
    <div ref={box} role="dialog" aria-label="Choisir un fond" style={{ position: "fixed", top: pos.top, bottom: pos.bottom, left: pos.left, width: pos.width, maxHeight: pos.maxH }} className="z-[90] flex flex-col overflow-hidden rounded-xl border border-line bg-paper shadow-2xl">
      <div className="flex flex-wrap gap-1 border-b border-line bg-white px-2.5 py-2" role="group" aria-label="Thèmes de fonds">
        {chip(cat === "tous", `Tous ${PHOTOS.length}`, () => setCat("tous"), "tous")}
        {PHOTO_CATS.map((c) => chip(cat === c.key, `${c.label} ${PHOTOS.filter((p) => p.cat === c.key).length}`, () => setCat(c.key), c.key))}
      </div>
      <div className="overflow-y-auto p-2.5">
        <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-5">
          {tile(bg === "", "Élégant (ivoire, sans photo)", () => onPick(""), "none")}
          {list.map((p) => tile(bg === p.url, p.label, () => onPick(p.url), p.url, p.thumb))}
        </div>
      </div>
      <div className="flex items-center justify-between gap-2 border-t border-line bg-white px-2.5 py-1.5">
        <span className="min-w-0 truncate text-xs font-bold text-ink" aria-live="polite">{(hover ?? bg) === "" ? "Élégant (ivoire, sans photo)" : shown?.label ?? ""}</span>
        <button type="button" onClick={onClose} className="shrink-0 rounded-lg bg-ink px-3 py-1 text-xs font-bold text-white">Terminé</button>
      </div>
    </div>,
    document.body,
  );
}

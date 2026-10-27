import { useEffect, useState } from "react";

// Fonds possibles d'une affiche : « Classique » (neutre, sans fond) ou une photo du club (déposée dans apps/web/public).
export type PosterBg = string; // "" (classique) ou l'adresse d'une photo du club (ex. "/fond-bulle.jpg")
// Les photos du club (une photo absente n'est simplement pas proposée)
export const PHOTOS = [{ url: "/fond-bulle.jpg", label: "Sous la bulle" }, { url: "/fond-terres.jpg", label: "Les 4 courts" }, { url: "/fond-nuit.jpg", label: "La bulle de nuit" }, { url: "/fond-neige.jpg", label: "Sous la neige" }, { url: "/fond-style1.jpg", label: "Tennis bleu nuit" }, { url: "/fond-style2.jpg", label: "Joueurs sur fond bleu" }, { url: "/fond-style3.jpg", label: "Raquette rose et vert" }];
const VEILS = { light: "rgba(255,255,255,.04) 0%,rgba(255,255,255,.14) 50%,rgba(255,255,255,.4) 100%", normal: "rgba(255,255,255,.14) 0%,rgba(255,255,255,.3) 50%,rgba(255,255,255,.6) 100%", strong: "rgba(255,255,255,.45) 0%,rgba(255,255,255,.58) 50%,rgba(255,255,255,.76) 100%" };
// Le fond et son voile blanc (le voile garde le texte lisible) ; sans fond choisi (« Classique »), rien n'est dessiné
export function Backdrop({ bg, w, h, veil = "normal" }: { bg: PosterBg; w: number; h: number; veil?: "light" | "normal" | "strong" }) {
  if (!bg) return null;
  return (<>
    {bg.startsWith("/") && <div aria-hidden style={{ position: "absolute", inset: 0, backgroundImage: `url(${bg})`, backgroundSize: "cover", backgroundPosition: "center" }} />}
    <div aria-hidden style={{ position: "absolute", inset: 0, background: `linear-gradient(180deg,${VEILS[veil]})` }} />
  </>);
}

// Les photos réellement présentes dans le site
export function usePhotos() {
  const [photos, setPhotos] = useState<{ url: string; label: string }[]>([]);
  useEffect(() => { PHOTOS.forEach((ph) => fetch(ph.url, { method: "HEAD" }).then((r) => { if (r.ok && (r.headers.get("content-type") ?? "").startsWith("image/")) setPhotos((l) => (l.some((x) => x.url === ph.url) ? l : [...l, ph])); }).catch(() => {})); }, []);
  return PHOTOS.filter((ph) => photos.some((x) => x.url === ph.url));
}

// Choix du fond (le même pour toutes les affiches)
export function BgPicker({ bg, onChange, extra }: { bg: PosterBg; onChange: (b: PosterBg) => void; extra?: React.ReactNode }) {
  const photos = usePhotos();
  const pill = (on: boolean, label: string, f: () => void) => (
    <button key={label} type="button" aria-pressed={on} onClick={f} className={`rounded-xl border-2 px-3 py-2 text-sm font-bold ${on ? "border-ink bg-ink text-white" : "border-line bg-white text-ink hover:border-ink"}`}>{label}</button>
  );
  return (
    <div className="mb-3 flex flex-wrap items-center gap-2" role="group" aria-label="Fond de l'affiche"><span className="text-sm font-bold text-ink">🖼️ Fond :</span>
      {pill(bg === "", "Classique", () => onChange(""))}
      {photos.map((ph) => pill(bg === ph.url, `📷 ${ph.label}`, () => onChange(ph.url)))}
      {bg !== "" && extra}
    </div>
  );
}

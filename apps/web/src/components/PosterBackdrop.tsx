import { useEffect, useState } from "react";

// Fonds possibles d'une affiche : « Classique » (neutre, sans fond), un fond dessiné « Sous la bulle » ou une photo du club (déposée dans apps/web/public).
export type PosterBg = string; // "" (classique), "bulle" (dessiné) ou l'adresse d'une photo du club (ex. "/fond-bulle.jpg")
// Les photos du club (une photo absente n'est simplement pas proposée)
export const PHOTOS = [{ url: "/fond-bulle.jpg", label: "Sous la bulle" }, { url: "/fond-terres.jpg", label: "Les 4 courts" }, { url: "/fond-nuit.jpg", label: "La bulle de nuit" }, { url: "/fond-neige.jpg", label: "Sous la neige" }];
// Fond « sous la bulle » dessiné (bulle blanche à arceaux, mur vert, terre battue et lignes du court)
function BulleBg({ w, h }: { w: number; h: number }) {
  return (
    <svg aria-hidden width={w} height={h} viewBox="0 0 794 1123" preserveAspectRatio="xMidYMid slice" style={{ position: "absolute", inset: 0 }}>
      <defs>
        <linearGradient id="bb-d" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#f7f8fb" /><stop offset="1" stopColor="#cfd3df" /></linearGradient>
        <linearGradient id="bb-c" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#d2602f" /><stop offset="1" stopColor="#a8431c" /></linearGradient>
      </defs>
      <rect width="794" height="1123" fill="url(#bb-d)" />
      <g fill="none" stroke="#b9bfd0" strokeWidth="3"><path d="M-40 430 Q300 -40 520 -20" /><path d="M60 560 Q420 60 700 20" /><path d="M200 640 Q560 140 800 60" /><path d="M380 700 Q700 260 840 160" /></g>
      <path d="M0 360 Q120 300 260 330 L260 520 L0 520Z" fill="#1d5f52" />
      <path d="M0 560 L794 440 L794 1123 L0 1123Z" fill="url(#bb-c)" />
      <g stroke="#fff" strokeWidth="7" fill="none" opacity=".95"><path d="M-20 700 L560 760 L794 640" /><path d="M60 620 L794 560" /><path d="M0 900 L794 800" /></g>
    </svg>
  );
}


const VEILS = { light: "rgba(255,255,255,.12) 0%,rgba(255,255,255,.28) 50%,rgba(255,255,255,.6) 100%", normal: "rgba(255,255,255,.35) 0%,rgba(255,255,255,.55) 50%,rgba(255,255,255,.82) 100%", strong: "rgba(255,255,255,.72) 0%,rgba(255,255,255,.84) 50%,rgba(255,255,255,.93) 100%" };
// Le fond et son voile blanc (le voile garde le texte lisible) ; sans fond choisi (« Classique »), rien n'est dessiné
export function Backdrop({ bg, w, h, veil = "normal" }: { bg: PosterBg; w: number; h: number; veil?: "light" | "normal" | "strong" }) {
  if (!bg) return null;
  return (<>
    {bg === "bulle" && <BulleBg w={w} h={h} />}
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
      {pill(bg === "bulle", "🎈 Dessiné : sous la bulle", () => onChange("bulle"))}
      {photos.map((ph) => pill(bg === ph.url, `📷 ${ph.label}`, () => onChange(ph.url)))}
      {bg !== "" && extra}
    </div>
  );
}

import { useEffect, useRef, useState } from "react";
import { Backdrop } from "./PosterBackdrop";
import { usePartnerLogos } from "../sponsors";
import { SERIF } from "./posterFonts";
import { PosterStudio, photoSig, Sec, Seg, StudioFormat, Toggle, useAutosave } from "./PosterStudio";
import { glue, priceText, tidy } from "./posterCopy";
import { photoFromFile } from "./RecapPoster";
import { PhotoTuner } from "./PhotoTuner";
import { PhotoRetouch } from "./PhotoRetouch";
import { FmtStyle, Fmts, pickFmt, txt } from "./posterFmt";
import { FmtItem } from "./FmtPanel";
import { DraftsMenu } from "./DraftsMenu";
import { loadOnline, OnlineInfo, PhotoAccess, saveOnline } from "./posterOnline";
import { TEXTILE_PLAYERS, TEXTILE_PLAYERS_RATIO } from "./textileArt";

// Affiche « OPÉRATION TEXTILE » : la vente de tenues du club. Le coach (ou le bureau) importe ses photos de vêtements,
// écrit le nom, la précision et le PRIX de chaque article (un seul prix : pas de tarif non adhérent), la date limite, la remise et la façon de commander.
// Deux styles : « élégant » (encre, ivoire, champagne) et « clair » (l'affiche d'origine). Arrière-plan réglable, joueurs dessinés (sans visages).
// Enregistrée en ligne (photos comprises) comme les autres affiches. Aucun nom d'élève.
export type Zone = "g" | "d" | "b"; // colonne de gauche, colonne de droite, rangée du bas
export type TextileItem = { name: string; price: string; photo: string; focus?: [number, number]; zoom?: number; colors?: string[]; sub?: string; hidePrice?: boolean; zone?: Zone }; // colors : coloris proposés (pastilles de couleur, jusqu'à 8)
export const COLOR_CHOICES: [string, string][] = [["#ffffff", "Blanc"], ["#17140f", "Noir"], ["#1b1863", "Bleu marine"], ["#2f6bd1", "Bleu"], ["#7fb2e5", "Ciel"], ["#c0392b", "Rouge"], ["#b8471f", "Terre battue"], ["#e8920c", "Orange"], ["#ffd84d", "Jaune"], ["#2f6b4a", "Vert"], ["#8a8a8a", "Gris"], ["#d96aa7", "Rose"]];
const colorName = (c: string) => COLOR_CHOICES.find(([h]) => h === c.toLowerCase())?.[1] ?? c;
export type TextileStyle = "elegant" | "clair";
export type TextileData = {
  chip: string; tagline: string; deadline: string; delivery: string; how: string; sizes: string; items: TextileItem[];
  title: string; brandL: string; brandR: string; style: TextileStyle; showPrices: boolean;
  c1: string; c2: string; cg: string; glow: number; // couleurs du fond (haut et bas, milieu, lueur) et force de la lueur
  players: boolean; pw: number; py: number; px: number; // joueurs dessinés : taille, haut / bas (% du corps), gauche / droite
};
export type TextileFormat = "A4" | "CARRE" | "PORTRAIT";
export const TEXTILE_SIZES: Record<TextileFormat, { w: number; h: number }> = { A4: { w: 794, h: 1123 }, CARRE: { w: 1080, h: 1080 }, PORTRAIT: { w: 1080, h: 1350 } };
export const emptyTextile = (): TextileData => ({
  chip: "", tagline: "Collection officielle Wilson x Intersport", deadline: "", delivery: "", how: "Commandez en ligne sur le proshop du club : proshop.tchoudan.fr", sizes: "", items: [],
  title: "Opération textile TC Houdan", brandL: "Wilson", brandR: "INTERSPORT", style: "elegant", showPrices: true,
  c1: "#14110d", c2: "#1d1810", cg: "#c9a66b", glow: 26, players: true, pw: 340, py: 8, px: 0,
});
export const BG_PRESETS: { label: string; c1: string; c2: string; cg: string }[] = [
  { label: "Encre", c1: "#14110d", c2: "#1d1810", cg: "#c9a66b" }, { label: "Bleu nuit", c1: "#0f1b33", c2: "#1c2f55", cg: "#6aa8ff" }, { label: "Terre battue", c1: "#3b1408", c2: "#8a3a1c", cg: "#f2a35e" },
  { label: "Vert club", c1: "#0d2417", c2: "#1f4a30", cg: "#9fd9a8" }, { label: "Violet", c1: "#2a1038", c2: "#4b2060", cg: "#e0b3ff" }, { label: "Ivoire", c1: "#e9e4d8", c2: "#f6f1e6", cg: "#c9a66b" },
];
const MAX_ITEMS = 12;
const rgba = (hex: string, a: number) => { const h = hex.replace("#", ""); const n = parseInt(h.length === 3 ? h.split("").map((c) => c + c).join("") : h, 16); return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`; };
const lum = (hex: string) => { const n = parseInt(hex.replace("#", ""), 16); return (((n >> 16) & 255) * 299 + ((n >> 8) & 255) * 587 + (n & 255) * 114) / 1000; };
// Où va chaque article : la zone choisie, sinon gauche / droite en alternance puis la rangée du bas
const zonesOf = (items: TextileItem[]): Zone[] => { let a = 0; return items.map((x) => x.zone ?? (a++ < 4 ? (a % 2 === 1 ? "g" : "d") : "b")); };

const Logo = ({ size, color = "#fff", style }: { size: number; color?: string; style?: React.CSSProperties }) => (
  <span aria-hidden style={{ display: "inline-block", width: size, height: size, background: color, WebkitMask: "url(/logo-tch.png) center / contain no-repeat", mask: "url(/logo-tch.png) center / contain no-repeat", ...style }} />
);

export function TextilePoster({ data, format, bg = "", fmt, onPick, onPan, logos = [] }: { data: TextileData; format: TextileFormat; bg?: string; fmt?: Fmts; onPick?: (k: string) => void; onPan?: (i: number, x: number, y: number) => void; logos?: string[] }) {
  const { w: W, h: H } = TEXTILE_SIZES[format];
  const el = data.style === "elegant";
  const light = el && lum(data.c1) > 150;
  const P = el
    ? { text: light ? "#14110d" : "#f6f1e6", accent: light ? "#8f6f3a" : "#c9a66b", tile: "#f6f1e6", tileText: "#14110d", tileLine: "#c9a66b", priceBg: "#14110d", priceFg: "#c9a66b", foot: "#0d0b08", footText: "#f6f1e6", band: "#c9a66b", bandText: "#14110d" }
    : { text: "#17202e", accent: "#b8471f", tile: "#ffffff", tileText: "#1b2430", tileLine: "rgba(0,0,0,.12)", priceBg: "#f2d329", priceFg: "#1a1a1a", foot: "#1f3358", footText: "#ffffff", band: "#f2d329", bandText: "#1a1a1a" };
  const u = Math.min(W / 794, H / 1123) * (1 + (fmt?.tout?.size ?? 0) * 0.08);
  const items = data.items.filter((x) => x.photo || x.name.trim() || x.price.trim());
  const zs = zonesOf(items), n = items.length;
  const inZone = (z: Zone) => items.map((it, i) => ({ it, i })).filter(({ i }) => zs[i] === z);
  const G = inZone("g"), D = inZone("d"), B = inZone("b");
  const panPhoto = (i: number, f0: [number, number]) => (ev: React.PointerEvent<HTMLDivElement>) => {
    if (!onPan) return;
    const e = ev.currentTarget; const rect = e.getBoundingClientRect(); const kk = rect.width / e.offsetWidth || 1; const x0 = ev.clientX, y0 = ev.clientY;
    e.setPointerCapture(ev.pointerId);
    const move = (mv: PointerEvent) => onPan(i, Math.max(0, Math.min(100, f0[0] - ((mv.clientX - x0) / kk / e.offsetWidth) * 140)), Math.max(0, Math.min(100, f0[1] - ((mv.clientY - y0) / kk / e.offsetHeight) * 140)));
    const up = () => { e.removeEventListener("pointermove", move); e.removeEventListener("pointerup", up); e.removeEventListener("pointercancel", up); };
    e.addEventListener("pointermove", move); e.addEventListener("pointerup", up); e.addEventListener("pointercancel", up);
  };
  const dense = n > 8 ? 0.82 : n > 6 ? 0.9 : 1;
  const tile = ({ it, i }: { it: TextileItem; i: number }, basis: string, bottom = false) => {
    const f = it.focus ?? [50, 50], z = it.zoom ?? 1, pr = priceText(it.price), showP = data.showPrices && !it.hidePrice && !!pr;
    return (
      <div key={i} style={{ flex: `0 1 ${basis}`, minWidth: 0, minHeight: 0, display: "flex", flexDirection: "column", background: P.tile, color: P.tileText, border: el ? `1px solid ${P.tileLine}` : "3px solid rgba(255,255,255,.7)", borderRadius: el ? 3 : 12 * u, boxShadow: "0 6px 18px rgba(0,0,0,.35)", padding: 9 * u, gap: 6 * u, maxWidth: bottom ? "none" : undefined }}>
        <div data-fmt={`nom-${i}`} style={{ textAlign: "center", fontFamily: el ? SERIF : "Archivo, system-ui, sans-serif", fontWeight: 800, textTransform: "uppercase", letterSpacing: el ? "0.05em" : "0.02em", fontSize: (el ? 20 : 17) * u * dense, lineHeight: 1.1, borderBottom: el ? `1px solid ${P.tileLine}` : "none", paddingBottom: 5 * u, overflowWrap: "break-word" }}>{txt(fmt, `nom-${i}`, tidy(it.name) || `Article ${i + 1}`)}</div>
        <div role="img" aria-label={it.name || `Article ${i + 1}`} onPointerDown={it.photo ? panPhoto(i, f) : undefined} style={{ position: "relative", flex: 1, minHeight: 60 * u, background: "#fff", overflow: "hidden", borderRadius: 2, cursor: onPan && it.photo ? "grab" : undefined, touchAction: onPan ? "none" : undefined }}>
          {it.photo && <img src={it.photo} alt="" draggable={false} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", objectPosition: `${f[0]}% ${f[1]}%`, transform: `scale(${z})`, transformOrigin: `${f[0]}% ${f[1]}%`, pointerEvents: "none" }} />}
        </div>
        {it.sub?.trim() && <div data-fmt={`sub-${i}`} style={{ textAlign: "center", fontWeight: 700, fontSize: 13 * u * dense, letterSpacing: "0.14em", textTransform: "uppercase", color: el ? "#8f6f3a" : P.tileText }}>{txt(fmt, `sub-${i}`, tidy(it.sub))}</div>}
        {it.colors && it.colors.length > 0 && <div role="img" aria-label={`Coloris : ${it.colors.map(colorName).join(", ")}`} style={{ display: "flex", gap: 6 * u, justifyContent: "center" }}>{it.colors.map((c) => <span key={c} style={{ width: 18 * u, height: 18 * u, borderRadius: "50%", background: c, border: "2px solid #fff", boxShadow: "0 0 0 1px rgba(0,0,0,.35)" }} />)}</div>}
        {showP && <div data-fmt={`prix-${i}`} style={{ alignSelf: "center", background: P.priceBg, color: P.priceFg, border: el ? `1px solid ${P.tileLine}` : "none", borderRadius: el ? 3 : 99, padding: `${3 * u}px ${14 * u}px`, fontFamily: el ? SERIF : "Archivo, system-ui, sans-serif", fontWeight: 800, fontSize: (el ? 26 : 22) * u * dense, lineHeight: 1.1 }}>{txt(fmt, `prix-${i}`, pr)}</div>}
      </div>
    );
  };
  const col = (L: { it: TextileItem; i: number }[]) => (
    <div style={{ flex: "0 0 27%", display: "flex", flexDirection: "column", justifyContent: "space-evenly", gap: 14 * u, minHeight: 0, zIndex: 1 }}>{L.map((x) => tile(x, `${100 / Math.max(2, L.length) - 3}%`))}</div>
  );
  const ph = Math.round(data.pw * u);
  const band = data.deadline.trim() || data.delivery.trim();
  return (
    <div style={{ position: "relative", width: W, height: H, background: el ? data.c1 : "#e8eff3", color: P.text, overflow: "hidden", display: "flex", flexDirection: "column", fontFamily: "Archivo, 'Atkinson Hyperlegible', system-ui, sans-serif", fontVariantNumeric: "lining-nums" }} onClick={(ev) => pickFmt(ev, onPick)}>
      <FmtStyle fmts={fmt} />
      <div aria-hidden style={{ position: "absolute", inset: 0, background: el ? `radial-gradient(120% 55% at 50% 38%, ${rgba(data.cg, data.glow / 100)} 0, transparent 60%), linear-gradient(180deg, ${data.c1} 0, ${data.c2} 55%, ${data.c1} 100%)` : "linear-gradient(180deg,#eef3f6 0,#e3ebf0 30%,#6d8a52 55%,#46633a 70%,#b9522c 100%)" }} />
      <Backdrop bg={bg} w={W} h={H} veil={el ? "light" : "strong"} />
      {/* en-tête : marques, logo du club, titre */}
      <div style={{ position: "relative", flex: "0 0 auto", padding: `${34 * u}px ${40 * u}px ${10 * u}px`, textAlign: "center" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 26 * u }}>
          <span data-fmt="marque-g" style={{ fontFamily: SERIF, fontStyle: "italic", fontWeight: 700, fontSize: 46 * u, lineHeight: 1, color: el ? P.text : "#7d1414" }}>{txt(fmt, "marque-g", data.brandL)}</span>
          <span aria-hidden style={{ width: 1, height: 60 * u, background: P.accent, opacity: 0.8 }} />
          <Logo size={112 * u} color={el ? P.text : "#1a1a1a"} />
          <span aria-hidden style={{ width: 1, height: 60 * u, background: P.accent, opacity: 0.8 }} />
          <span data-fmt="marque-d" style={{ fontFamily: "Archivo, system-ui, sans-serif", fontStyle: "italic", fontWeight: 900, fontSize: 38 * u, lineHeight: 1, letterSpacing: "-0.01em", color: P.text }}>{txt(fmt, "marque-d", data.brandR)}</span>
        </div>
        {data.chip.trim() && <div data-fmt="chip" style={{ display: "inline-block", marginTop: 12 * u, border: `2px solid ${P.accent}`, color: P.accent, fontWeight: 800, fontSize: 13 * u, letterSpacing: "0.2em", padding: `${4 * u}px ${14 * u}px`, borderRadius: 99, whiteSpace: "nowrap" }}>{txt(fmt, "chip", data.chip)}</div>}
        <div data-fmt="titre" style={{ marginTop: 14 * u, fontFamily: el ? SERIF : "Oswald, Archivo, sans-serif", fontWeight: 700, textTransform: "uppercase", letterSpacing: el ? "0.03em" : "0", lineHeight: 1, whiteSpace: "nowrap", fontSize: Math.min(52 * u, (W - 80 * u) / (Math.max(10, data.title.length) * (el ? 0.66 : 0.74))) }}>{txt(fmt, "titre", data.title)}</div>
        {data.tagline.trim() && <div data-fmt="accroche" style={{ marginTop: 6 * u, fontFamily: SERIF, fontStyle: "italic", fontWeight: 600, fontSize: 24 * u, color: P.accent, lineHeight: 1.2 }}>{txt(fmt, "accroche", glue(data.tagline))}</div>}
        {el && <div aria-hidden style={{ width: 120 * u, height: 2, margin: `${10 * u}px auto 0`, background: `linear-gradient(90deg, transparent, ${P.accent}, transparent)` }} />}
      </div>
      {/* corps : colonne gauche, joueurs au milieu, colonne droite, rangée du bas */}
      <div style={{ position: "relative", flex: 1, minHeight: 0, display: "flex", flexDirection: "column", gap: 14 * u, padding: `${10 * u}px ${30 * u}px ${12 * u}px` }}>
        {data.players && <img src={TEXTILE_PLAYERS} alt="" draggable={false} style={{ position: "absolute", left: `calc(48% + ${data.px * u}px)`, top: `${data.py}%`, width: ph, height: ph * TEXTILE_PLAYERS_RATIO, transform: "translateX(-50%)", pointerEvents: "none" }} />}
        {n === 0 && <div style={{ flex: 1, display: "grid", placeItems: "center", textAlign: "center", fontSize: 24 * u, opacity: 0.8, border: "2px dashed rgba(128,128,128,.6)" }}>Ajoute tes photos de vêtements dans le menu de gauche.</div>}
        {n > 0 && <div style={{ position: "relative", flex: B.length ? "1 1 62%" : 1, minHeight: 0, display: "flex", justifyContent: "space-between", gap: 14 * u }}>{col(G)}{col(D)}</div>}
        {B.length > 0 && <div style={{ position: "relative", flex: "1 1 38%", minHeight: 0, display: "flex", gap: 12 * u, alignItems: "stretch" }}>{B.map((x) => tile(x, `${100 / B.length}%`, true))}</div>}
      </div>
      {/* pied : tailles, date limite, comment commander */}
      <div style={{ position: "relative", flex: "0 0 auto" }}>
        {data.sizes.trim() && <div data-fmt="tailles" style={{ display: "flex", justifyContent: "center", gap: 14 * u, alignItems: "baseline", padding: `${4 * u}px ${30 * u}px ${8 * u}px`, fontSize: 16 * u, fontWeight: 800, letterSpacing: "0.08em" }}><span style={{ opacity: 0.8, letterSpacing: "0.18em", fontSize: 12 * u }}>TAILLES</span><span>{txt(fmt, "tailles", data.sizes)}</span></div>}
        {band && <div style={{ background: P.band, color: P.bandText, padding: `${9 * u}px ${30 * u}px`, display: "flex", flexWrap: "wrap", gap: `${2 * u}px ${28 * u}px`, alignItems: "baseline", justifyContent: "center", textAlign: "center" }}>
          {data.deadline.trim() && <span data-fmt="date-limite" style={{ fontSize: 26 * u, fontWeight: 900, textTransform: "uppercase", letterSpacing: el ? "0.04em" : 0, lineHeight: 1.1 }}>{txt(fmt, "date-limite", `Commande avant le ${tidy(data.deadline)}`)}</span>}
          {data.delivery.trim() && <span data-fmt="remise" style={{ fontSize: 17 * u, fontWeight: 700 }}>{txt(fmt, "remise", `Remise des tenues : ${data.delivery.trim()}`)}</span>}
        </div>}
        <div style={{ background: P.foot, color: P.footText, borderTop: el ? `2px solid ${P.accent}` : "none", display: "flex", alignItems: "center", gap: 24 * u, padding: `${16 * u}px ${40 * u}px ${18 * u}px` }}>
          <Logo size={86 * u} color="#fff" />
          <span aria-hidden style={{ alignSelf: "stretch", width: 1, background: P.accent, opacity: 0.7 }} />
          <div data-fmt="commande" style={{ flex: 1, textAlign: "center", fontFamily: SERIF, fontWeight: 700, fontSize: 30 * u, lineHeight: 1.2, whiteSpace: "pre-line", overflowWrap: "break-word" }}>{txt(fmt, "commande", glue(data.how)) || "Renseigne la façon de commander dans le menu de gauche."}</div>
        </div>
        {logos.length > 0 && <div style={{ background: P.foot, display: "flex", gap: 14 * u, alignItems: "center", justifyContent: "center", padding: `0 ${30 * u}px ${12 * u}px` }}>{logos.slice(0, 8).map((l, i) => <img key={i} src={l} alt="" style={{ maxHeight: 40 * u, maxWidth: 110 * u, objectFit: "contain", background: "#fff", padding: 4 }} />)}</div>}
      </div>
    </div>
  );
}

// ---- fenêtre de l'affiche ----
type Saved = { d: TextileData; format: TextileFormat; bg: string };
const FORMATS: StudioFormat[] = [{ id: "A4", label: "📄 A4 à imprimer", ...TEXTILE_SIZES.A4 }, { id: "CARRE", label: "📱 Carré (réseaux)", ...TEXTILE_SIZES.CARRE }, { id: "PORTRAIT", label: "📱 Portrait 4:5", ...TEXTILE_SIZES.PORTRAIT }];
const access: PhotoAccess<Saved> = {
  photos: (s) => s.d.items.map((x) => x.photo || ""),
  remap: (s, f) => ({ ...s, d: { ...s.d, items: s.d.items.map((x) => (x.photo ? { ...x, photo: f(x.photo) } : x)) } }),
  prune: (s) => ({ ...s, d: { ...s.d, items: s.d.items.map((x) => (x.photo ? x : { ...x, photo: "", focus: undefined, zoom: undefined })) } }),
};
const NAME = "Opération textile";
const field = "w-full rounded-md border-2 border-line bg-white px-3 py-2 text-sm text-ink";

export function TextileModal({ onClose, canPartners = true }: { onClose: () => void; canPartners?: boolean }) {
  const [d, setD] = useState<TextileData>(emptyTextile);
  const [format, setFormat] = useState<TextileFormat>("A4");
  const [bg, setBg] = useState("");
  const [fmt, setFmt] = useState<Fmts>({});
  const [sel, setSel] = useState("titre");
  const [msg, setMsg] = useState("");
  const [retouch, setRetouch] = useState<number | null>(null);
  const logos = usePartnerLogos("event"); const [withPartners, setWithPartners] = useState(false);
  const [draftId, setDraftId] = useState<string | null>(null);
  const idRef = useRef<string | null>(null);
  const [rev, setRev] = useState(0);
  const sig = JSON.stringify({ d: { ...d, items: d.items.map((x) => ({ ...x, photo: x.photo ? photoSig(x.photo) : "" })) }, format, bg, fmt });
  const auto = useAutosave({
    sig,
    save: async () => {
      const id = await saveOnline<Saved & { fmt: Fmts }>("textile", idRef.current, NAME, { d, format, bg, fmt }, access as PhotoAccess<Saved & { fmt: Fmts }>, (n, t) => t && auto.setState({ kind: "saving", text: `Envoi des photos : ${n} sur ${t}…` }));
      idRef.current = id; setDraftId(id); setRev((r) => r + 1);
    },
  });
  const open = async (x: OnlineInfo) => {
    await auto.flush();
    const r = await loadOnline<Saved & { fmt?: Fmts }>(x.id, access as PhotoAccess<Saved & { fmt?: Fmts }>);
    auto.skipNext(); idRef.current = x.id; setDraftId(x.id);
    setD({ ...emptyTextile(), ...r.saved.d }); setFormat(r.saved.format); setBg(r.saved.bg); setFmt(r.saved.fmt ?? {}); auto.setState({ kind: "saved" });
    if (r.lost) setMsg(`${r.lost} photo${r.lost > 1 ? "s" : ""} introuvable${r.lost > 1 ? "s" : ""} : à remettre.`);
  };
  // L'affiche déjà commencée se rouvre toute seule
  useEffect(() => {
    let off = false;
    (async () => {
      try {
        const { listOnline } = await import("./posterOnline");
        const mine = (await listOnline("textile"))[0];
        if (!mine || off) return;
        setMsg("Je reprends ton travail précédent…"); await open(mine); if (!off) setMsg((m) => (m.startsWith("Je reprends") ? "" : m));
      } catch { if (!off) setMsg(""); }
    })();
    return () => { off = true; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const set = (p: Partial<TextileData>) => setD((o) => ({ ...o, ...p }));
  const setItem = (i: number, p: Partial<TextileItem>) => setD((o) => ({ ...o, items: o.items.map((x, j) => (j === i ? { ...x, ...p } : x)) }));
  const addFiles = async (files: FileList | null) => {
    if (!files?.length) return; setMsg("");
    try {
      const room = MAX_ITEMS - d.items.length;
      const list = await Promise.all(Array.from(files).slice(0, room).map(photoFromFile));
      setD((o) => ({ ...o, items: [...o.items, ...list.map((p) => ({ name: "", price: "", photo: p }))] }));
      if (files.length > room) setMsg(`${MAX_ITEMS} articles au plus : les autres photos n'ont pas été ajoutées.`);
    } catch (x) { setMsg((x as Error).message); }
  };
  const move = (i: number, to: number) => setD((o) => { if (to < 0 || to >= o.items.length) return o; const l = [...o.items]; const [a] = l.splice(i, 1); l.splice(to, 0, a); return { ...o, items: l }; });
  const shown = d.items.map((x, i) => ({ x, i })).filter(({ x }) => x.photo || x.name.trim() || x.price.trim());
  const fmtItems: FmtItem[] = [
    { key: "marque-g", label: "Marque de gauche", edit: true }, { key: "marque-d", label: "Marque de droite", edit: true }, { key: "chip", label: "Pastille « commandes ouvertes »", edit: true }, { key: "titre", label: "Titre", edit: true }, { key: "accroche", label: "Phrase sous le titre", edit: true },
    ...shown.flatMap((_, j) => [{ key: `nom-${j}`, label: `Article ${j + 1} : nom`, edit: true }, { key: `sub-${j}`, label: `Article ${j + 1} : précision`, edit: true }, { key: `prix-${j}`, label: `Article ${j + 1} : prix`, edit: true }] as FmtItem[]),
    { key: "tailles", label: "Tailles", edit: true }, { key: "date-limite", label: "Date limite", edit: true }, { key: "remise", label: "Remise des tenues", edit: true }, { key: "commande", label: "Comment commander", edit: true }, { key: "tout", label: "Tous les textes", sizeOnly: true },
  ];
  const poster = (extra: object = {}) => <TextilePoster data={d} format={format} bg={bg} fmt={fmt} logos={withPartners ? logos : []} {...extra} />;
  return (<>
    <PosterStudio
      title="👕 Affiche de l'opération textile" subtitle={draftId ? "enregistrée en ligne" : "pas encore enregistrée"} onClose={() => { void auto.flush().finally(onClose); }}
      formats={FORMATS} format={format} onFormat={(f) => setFormat(f as TextileFormat)}
      intro={<details className="rounded-md bg-[#fff4cc] p-3 text-sm text-[#6b4e00]"><summary role="note" className="cursor-pointer font-bold">⚠️ Photos portées : seulement des adultes ou des enfants avec le droit à l'image</summary><p className="m-0 mt-2">Pour des photos de vêtements portés, vérifie l'accord des personnes (des parents pour un enfant). Des photos de vêtements seuls n'ont aucune contrainte.</p></details>}
      content={<>
        {msg && <p className="m-0 text-sm font-bold text-ink" role="status">{msg}</p>}
        <Sec title="1 · Titre et marques">
          <label className="block text-sm font-bold text-ink">Titre de l'affiche
            <input className={`${field} mt-1`} aria-label="Titre de l'affiche" maxLength={60} value={d.title} onChange={(e) => set({ title: e.target.value })} /></label>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <label className="block text-sm font-bold text-ink">Marque à gauche<input className={`${field} mt-1`} aria-label="Marque à gauche" maxLength={20} value={d.brandL} onChange={(e) => set({ brandL: e.target.value })} /></label>
            <label className="block text-sm font-bold text-ink">Marque à droite<input className={`${field} mt-1`} aria-label="Marque à droite" maxLength={20} value={d.brandR} onChange={(e) => set({ brandR: e.target.value })} /></label>
          </div>
        </Sec>
        <Sec title="2 · Les articles (photos, noms, prix)">
          {d.items.length === 0 ? (
            <label className="grid cursor-pointer place-items-center gap-1 rounded-xl border-2 border-dashed border-ink bg-white p-6 text-center text-ink hover:bg-sand">
              <span className="text-2xl" aria-hidden>📷</span><b>Ajouter mes photos de vêtements</b><span className="text-xs text-muted">Touche ici (plusieurs photos d'un coup, 6 au plus)</span>
              <input type="file" multiple accept="image/jpeg,image/png,image/webp" className="sr-only" aria-label="Ajouter des photos de vêtements" onChange={(e) => { void addFiles(e.target.files); e.target.value = ""; }} />
            </label>
          ) : (
            <div className="grid gap-3">
              {d.items.map((it, i) => (
                <div key={i} className={"grid gap-2 rounded-md border-2 border-line bg-white p-2"}>
                  <div className="flex items-center gap-2">
                    {it.photo ? <img src={it.photo} alt="" className="h-16 w-14 rounded object-cover" /> : <span className="grid h-16 w-14 place-items-center rounded bg-sand text-xs text-muted">photo</span>}
                    <div className="grid min-w-0 flex-1 gap-1">
                      <input className={field} aria-label={`Article ${i + 1} : nom`} placeholder="Nom (ex. Polo, Sweat à capuche)" maxLength={40} value={it.name} onChange={(e) => setItem(i, { name: e.target.value })} />
                      <input className={field} aria-label={`Article ${i + 1} : précision`} placeholder="Précision (ex. Coupe homme) : facultatif" maxLength={30} value={it.sub ?? ""} onChange={(e) => setItem(i, { sub: e.target.value })} />
                      <div className="flex items-center gap-2">
                        <input className={field} aria-label={`Article ${i + 1} : prix`} placeholder="Prix (ex. 35 €)" maxLength={20} value={it.price} onChange={(e) => setItem(i, { price: e.target.value })} />
                        <label className="flex shrink-0 items-center gap-1 text-xs font-bold text-ink"><input type="checkbox" checked={!it.hidePrice} onChange={(e) => setItem(i, { hidePrice: !e.target.checked })} aria-label={`Article ${i + 1} : montrer le prix`} />Prix affiché</label>
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <label className="flex items-center gap-1 text-xs font-bold text-ink">Place
                      <select className="rounded-md border-2 border-line bg-white px-2 py-1.5 text-sm" aria-label={`Article ${i + 1} : place sur l'affiche`} value={it.zone ?? "auto"} onChange={(e) => setItem(i, { zone: e.target.value === "auto" ? undefined : (e.target.value as Zone) })}>
                        <option value="auto">Automatique</option><option value="g">Colonne de gauche</option><option value="d">Colonne de droite</option><option value="b">Rangée du bas</option></select></label>
                    <button type="button" className="btn-outline btn-sm" aria-label={`Article ${i + 1} : avant`} disabled={i === 0} onClick={() => move(i, i - 1)}>◀</button>
                    <button type="button" className="btn-outline btn-sm" aria-label={`Article ${i + 1} : après`} disabled={i === d.items.length - 1} onClick={() => move(i, i + 1)}>▶</button>
                    <label className="btn-outline btn-sm cursor-pointer">📷 {it.photo ? "Changer la photo" : "Ajouter la photo"}
                      <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" aria-label={`Article ${i + 1} : photo`} onChange={async (e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) { try { setItem(i, { photo: await photoFromFile(f), focus: undefined, zoom: undefined }); } catch (x) { setMsg((x as Error).message); } } }} /></label>
                    {it.photo && <button type="button" className="btn-outline btn-sm" aria-label={`Article ${i + 1} : retoucher la photo`} onClick={() => setRetouch(i)}>🎨 Retoucher</button>}
                    <button type="button" className="btn-outline btn-sm" aria-label={`Retirer l'article ${i + 1}`} onClick={() => { setD((o) => ({ ...o, items: o.items.filter((_, j) => j !== i) })); }}>🗑️ Retirer</button>
                  </div>
                  <div className="grid gap-1" role="group" aria-label={`Article ${i + 1} : coloris`}>
                    <span className="text-xs font-bold text-ink">Coloris proposés <span className="font-normal text-muted">(touche pour ajouter ou retirer)</span></span>
                    <div className="flex flex-wrap items-center gap-1.5">
                      {COLOR_CHOICES.map(([h, nm]) => { const on = (it.colors ?? []).includes(h); return (
                        <button key={h} type="button" aria-pressed={on} aria-label={`${nm}${on ? " (choisi)" : ""}`} title={nm} onClick={() => setItem(i, { colors: on ? (it.colors ?? []).filter((c) => c !== h) : [...(it.colors ?? []), h].slice(0, 8) })}
                          className={"h-8 w-8 rounded-full border-2 " + (on ? "border-ink ring-2 ring-champagne" : "border-line")} style={{ background: h }}>{on ? <span style={{ color: h === "#ffffff" || h === "#ffd84d" ? "#17140f" : "#fff" }}>✓</span> : null}</button>); })}
                      <label className="flex h-8 cursor-pointer items-center gap-1 rounded-full border-2 border-dashed border-ink bg-white px-2 text-xs font-bold text-ink">＋ Autre
                        <input type="color" className="h-5 w-6 cursor-pointer border-0 bg-transparent p-0" aria-label={`Article ${i + 1} : ajouter une autre couleur`} onChange={(e) => { const h = e.target.value.toLowerCase(); if (!(it.colors ?? []).includes(h)) setItem(i, { colors: [...(it.colors ?? []), h].slice(0, 8) }); }} /></label>
                    </div>
                    {(it.colors ?? []).filter((c) => !COLOR_CHOICES.some(([h]) => h === c)).length > 0 && <div className="flex flex-wrap gap-1.5">{(it.colors ?? []).filter((c) => !COLOR_CHOICES.some(([h]) => h === c)).map((c) => <button key={c} type="button" className="flex items-center gap-1 rounded-full border-2 border-line bg-white px-2 py-0.5 text-xs font-bold" aria-label={`Retirer la couleur ${c}`} onClick={() => setItem(i, { colors: (it.colors ?? []).filter((x) => x !== c) })}><span className="h-4 w-4 rounded-full border border-line" style={{ background: c }} />{c} ✕</button>)}</div>}
                  </div>
                  {it.photo && <details className="rounded-md bg-sand/60 p-2"><summary className="cursor-pointer text-xs font-bold text-ink">🖼️ Régler le cadrage de la photo</summary><div className="mt-2"><PhotoTuner label={it.name || `article ${i + 1}`} value={{ focus: it.focus, zoom: it.zoom }} onChange={(t) => setItem(i, t)} /></div></details>}
                </div>
              ))}
              {d.items.length < MAX_ITEMS && ( // eslint-disable-line
                <label className="btn-outline cursor-pointer justify-self-start">＋ Ajouter des photos
                  <input type="file" multiple accept="image/jpeg,image/png,image/webp" className="sr-only" aria-label="Ajouter d'autres photos" onChange={(e) => { void addFiles(e.target.files); e.target.value = ""; }} /></label>
              )}
              <button type="button" className="btn-outline justify-self-start" onClick={() => { setD((o) => ({ ...o, items: [...o.items, { name: "", price: "", photo: "" }] })); }} disabled={d.items.length >= MAX_ITEMS}>＋ Un article sans photo</button>
            </div>
          )}
        </Sec>
        <Sec title="3 · Date limite et remise">
          <label className="block text-sm font-bold text-ink">Date limite de commande <span className="font-normal text-muted">(écris par exemple « 30 novembre »)</span>
            <input className={`${field} mt-1`} aria-label="Date limite de commande" maxLength={40} placeholder="30 novembre" value={d.deadline} onChange={(e) => set({ deadline: e.target.value })} /></label>
          <label className="mt-2 block text-sm font-bold text-ink">Remise des tenues <span className="font-normal text-muted">(facultatif)</span>
            <input className={`${field} mt-1`} aria-label="Remise des tenues" maxLength={60} placeholder="mi-décembre, au club" value={d.delivery} onChange={(e) => set({ delivery: e.target.value })} /></label>
        </Sec>
        <Sec title="4 · Comment commander">
          <label className="block text-sm font-bold text-ink">Comment commander ?
            <textarea className={`${field} mt-1`} aria-label="Comment commander" rows={3} maxLength={240} value={d.how} onChange={(e) => set({ how: e.target.value })} /></label>
          <div className="mt-2 flex flex-wrap gap-2">
            {["Au club, à l'accueil", "Par e-mail à tennisclubhoudan@gmail.com", "Bon de commande à déposer au club", "Paiement à la commande"].map((s) => <button key={s} type="button" className="btn-outline btn-sm" onClick={() => set({ how: d.how.trim() ? `${d.how.trim()}\n${s}` : s })}>＋ {s}</button>)}
          </div>
        </Sec>
        <Sec title="5 · Tailles et pastille">
          <label className="block text-sm font-bold text-ink">Tailles proposées <span className="font-normal text-muted">(vide = non affiché)</span>
            <input className={`${field} mt-1`} aria-label="Tailles proposées" maxLength={60} value={d.sizes} onChange={(e) => set({ sizes: e.target.value })} /></label>
          <label className="mt-2 block text-sm font-bold text-ink">Pastille du haut <span className="font-normal text-muted">(vide = non affichée)</span>
            <input className={`${field} mt-1`} aria-label="Pastille du haut" maxLength={30} value={d.chip} onChange={(e) => set({ chip: e.target.value })} /></label>
          <label className="mt-2 block text-sm font-bold text-ink">Phrase sous le titre
            <input className={`${field} mt-1`} aria-label="Phrase sous le titre" maxLength={90} value={d.tagline} onChange={(e) => set({ tagline: e.target.value })} /></label>
        </Sec>
      </>}
      look={<>
        <Sec title="Style">
          <Seg<TextileStyle> label="Style de l'affiche" value={d.style} onChange={(v) => set({ style: v })} options={[{ id: "elegant", label: "✨ Élégant" }, { id: "clair", label: "🏷️ Clair (d'origine)" }]} />
          <div className="mt-2"><Toggle on={d.showPrices} onChange={(v) => set({ showPrices: v })} label="Afficher les prix" hint="Un prix peut aussi être caché article par article." /></div>
        </Sec>
        {d.style === "elegant" && <Sec title="Couleurs du fond">
          <div className="flex flex-wrap gap-2" role="group" aria-label="Palettes prêtes">
            {BG_PRESETS.map((p) => <button key={p.label} type="button" className="btn-outline btn-sm flex items-center gap-1.5" onClick={() => set({ c1: p.c1, c2: p.c2, cg: p.cg })}><span aria-hidden className="inline-block h-4 w-4 rounded-full border border-line" style={{ background: p.c2 }} />{p.label}</button>)}
          </div>
          <div className="mt-2 grid gap-1">
            {([["c1", "Haut et bas"], ["c2", "Milieu"], ["cg", "Lueur"]] as const).map(([k, l]) => <label key={k} className="flex items-center justify-between text-sm font-bold text-ink">{l}<input type="color" aria-label={`Couleur : ${l}`} value={d[k]} onChange={(e) => set({ [k]: e.target.value } as Partial<TextileData>)} /></label>)}
            <label className="grid gap-0.5 text-sm font-bold text-ink">Force de la lueur<input type="range" min={0} max={70} value={d.glow} onChange={(e) => set({ glow: +e.target.value })} className="min-h-8 w-full" /></label>
          </div>
          <p className="m-0 mt-1 text-xs text-muted">Pour une photo de fond, utilise « Fond » plus bas.</p>
        </Sec>}
        <Sec title="Joueurs dessinés">
          <Toggle on={d.players} onChange={(v) => set({ players: v })} label="Un joueur en jogging et une joueuse en tenue de sport" hint="Illustration du club, sans visages." />
          {d.players && <div className="mt-1 grid gap-1">
            <label className="grid gap-0.5 text-sm font-bold text-ink">Taille<input type="range" min={200} max={700} value={d.pw} onChange={(e) => set({ pw: +e.target.value })} className="min-h-8 w-full" /></label>
            <label className="grid gap-0.5 text-sm font-bold text-ink">Haut / bas<input type="range" min={0} max={50} value={d.py} onChange={(e) => set({ py: +e.target.value })} className="min-h-8 w-full" /></label>
            <label className="grid gap-0.5 text-sm font-bold text-ink">Gauche / droite<input type="range" min={-220} max={220} value={d.px} onChange={(e) => set({ px: +e.target.value })} className="min-h-8 w-full" /></label>
          </div>}
        </Sec>
        {canPartners && logos.length > 0 && <Sec title="Partenaires"><Toggle on={withPartners} onChange={setWithPartners} label="🤝 Montrer les logos des partenaires" /></Sec>}
      </>}
      bg={bg} onBg={setBg}
      fmt={{ items: fmtItems, value: fmt, onChange: setFmt, selected: sel, onSelect: setSel }}
      preview={({ pick }) => poster({ onPick: pick, onPan: (i: number, x: number, y: number) => { const real = shown[i]?.i; if (real !== undefined) setItem(real, { focus: [x, y] }); } })}
      printNode={poster()}
      fileBase={(f) => `affiche-operation-textile-${f.toLowerCase()}`}
      save={auto.state.kind === "idle" ? { kind: "idle", text: "Se sauvegarde toute seule, photos comprises" } : auto.state}
      beforeDownload={auto.flush}
      topExtra={<DraftsMenu kind="textile" currentId={draftId} refreshKey={rev} onOpen={open} onDeleted={(id) => { if (id === idRef.current) { idRef.current = null; setDraftId(null); } }} />}
    />
    {retouch !== null && d.items[retouch]?.photo && <PhotoRetouch src={d.items[retouch].photo} onClose={() => setRetouch(null)} onApply={(url) => { setItem(retouch, { photo: url }); setRetouch(null); }} />}
  </>);
}

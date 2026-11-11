import { useEffect, useRef, useState } from "react";
import { Backdrop } from "./PosterBackdrop";
import { usePartnerLogos } from "../sponsors";
import { SERIF } from "./posterFonts";
import { PosterStudio, photoSig, Sec, StudioFormat, Toggle, useAutosave } from "./PosterStudio";
import { glue, priceText, tidy } from "./posterCopy";
import { photoFromFile } from "./RecapPoster";
import { PhotoTuner } from "./PhotoTuner";
import { FmtStyle, Fmts, pickFmt, txt } from "./posterFmt";
import { FmtItem } from "./FmtPanel";
import { DraftsMenu } from "./DraftsMenu";
import { loadOnline, OnlineInfo, PhotoAccess, saveOnline } from "./posterOnline";

// Affiche « OPÉRATION TEXTILE » : la vente de tenues du club. Le coach (ou le bureau) importe ses photos de vêtements,
// écrit le nom et le PRIX de chaque article (un seul prix : pas de tarif non adhérent), la date limite, la remise et la façon de commander.
// Enregistrée en ligne (photos comprises) comme les autres affiches. Aucun nom d'élève.
export type TextileItem = { name: string; price: string; photo: string; focus?: [number, number]; zoom?: number; colors?: string[] }; // colors : coloris proposés (pastilles de couleur, jusqu'à 8)
export const COLOR_CHOICES: [string, string][] = [["#ffffff", "Blanc"], ["#17140f", "Noir"], ["#1b1863", "Bleu marine"], ["#2f6bd1", "Bleu"], ["#7fb2e5", "Ciel"], ["#c0392b", "Rouge"], ["#b8471f", "Terre battue"], ["#e8920c", "Orange"], ["#ffd84d", "Jaune"], ["#2f6b4a", "Vert"], ["#8a8a8a", "Gris"], ["#d96aa7", "Rose"]];
const colorName = (c: string) => COLOR_CHOICES.find(([h]) => h === c.toLowerCase())?.[1] ?? c;
export type TextileData = { chip: string; tagline: string; deadline: string; delivery: string; how: string; sizes: string; items: TextileItem[] };
export type TextileFormat = "A4" | "CARRE";
export const TEXTILE_SIZES: Record<TextileFormat, { w: number; h: number }> = { A4: { w: 794, h: 1123 }, CARRE: { w: 1080, h: 1080 } };
export const emptyTextile = (): TextileData => ({ chip: "COMMANDES OUVERTES", tagline: "Choisis ta tenue aux couleurs du club.", deadline: "", delivery: "", how: "Au club, ou par e-mail à tennisclubhoudan@gmail.com", sizes: "XS · S · M · L · XL · XXL", items: [] });
const MAX_ITEMS = 6;

const Logo = ({ size, color = "#fff", style }: { size: number; color?: string; style?: React.CSSProperties }) => (
  <span aria-hidden style={{ display: "inline-block", width: size, height: size, background: color, WebkitMask: "url(/logo-tch.png) center / contain no-repeat", mask: "url(/logo-tch.png) center / contain no-repeat", ...style }} />
);

export function TextilePoster({ data, format, bg = "", fmt, onPick, onPan, logos = [] }: { data: TextileData; format: TextileFormat; bg?: string; fmt?: Fmts; onPick?: (k: string) => void; onPan?: (i: number, x: number, y: number) => void; logos?: string[] }) {
  const { w: W, h: H } = TEXTILE_SIZES[format];
  const sq = format === "CARRE";
  const items = data.items.filter((x) => x.photo || x.name.trim() || x.price.trim());
  const n = items.length, cols = n <= 1 ? 1 : n === 2 ? 2 : n === 4 ? 2 : 3;
  const g = 1 + (fmt?.tout?.size ?? 0) * 0.08;
  const panPhoto = (i: number, f0: [number, number]) => (ev: React.PointerEvent<HTMLDivElement>) => {
    if (!onPan) return;
    const el = ev.currentTarget; const rect = el.getBoundingClientRect(); const kk = rect.width / el.offsetWidth || 1; const x0 = ev.clientX, y0 = ev.clientY;
    el.setPointerCapture(ev.pointerId);
    const move = (mv: PointerEvent) => onPan(i, Math.max(0, Math.min(100, f0[0] - ((mv.clientX - x0) / kk / el.offsetWidth) * 140)), Math.max(0, Math.min(100, f0[1] - ((mv.clientY - y0) / kk / el.offsetHeight) * 140)));
    const up = () => { el.removeEventListener("pointermove", move); el.removeEventListener("pointerup", up); el.removeEventListener("pointercancel", up); };
    el.addEventListener("pointermove", move); el.addEventListener("pointerup", up); el.addEventListener("pointercancel", up);
  };
  const HEAD = sq ? 250 : 310, FOOT = sq ? 250 : 350;
  const k = (sq ? 0.92 : 1) * g;
  return (
    <div style={{ position: "relative", width: W, height: H, background: "#1b1863", color: "#fff", overflow: "hidden", fontFamily: "Archivo, 'Atkinson Hyperlegible', system-ui, sans-serif", fontVariantNumeric: "lining-nums" }} onClick={(ev) => pickFmt(ev, onPick)}>
      <FmtStyle fmts={fmt} />
      <Backdrop bg={bg} w={W} h={H} veil="strong" />
      <div style={{ position: "absolute", left: 0, right: 0, top: 0, height: HEAD, padding: "40px 52px 0", display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <Logo size={64} color="#ffd84d" />
          <div data-fmt="entete" style={{ fontSize: 20 * k, fontWeight: 800, letterSpacing: "0.22em", whiteSpace: "nowrap" }}>{txt(fmt, "entete", "TENNIS CLUB HOUDAN")}</div>
          {data.chip.trim() && <span data-fmt="chip" style={{ marginLeft: "auto", border: "2px solid #ffd84d", color: "#ffd84d", fontWeight: 800, fontSize: 15 * k, letterSpacing: "0.18em", padding: "6px 16px", borderRadius: 99, whiteSpace: "nowrap" }}>{txt(fmt, "chip", data.chip)}</span>}
        </div>
        <div data-fmt="titre" style={{ fontFamily: SERIF, fontWeight: 700, fontSize: (sq ? 92 : 98) * k, lineHeight: 0.95, marginTop: 14, whiteSpace: "nowrap" }}>{txt(fmt, "titre", "Opération ")}<span style={{ fontStyle: "italic", color: "#ffd84d" }}>textile</span></div>
        {data.tagline.trim() && <div data-fmt="accroche" style={{ fontSize: (sq ? 26 : 30) * k, lineHeight: 1.25, opacity: 0.95, maxWidth: "88%", whiteSpace: "pre-line" }}>{txt(fmt, "accroche", glue(data.tagline))}</div>}
      </div>
      <div style={{ position: "absolute", left: 52, right: 52, top: HEAD + 8, bottom: FOOT + 8, display: "grid", gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`, gridAutoRows: "minmax(0, 1fr)", gap: 20 }}>
        {n === 0 && <div style={{ gridColumn: "1 / -1", display: "grid", placeItems: "center", textAlign: "center", fontSize: 26, opacity: 0.8, border: "2px dashed rgba(255,255,255,.45)" }}>Ajoute tes photos de vêtements dans le menu de gauche.</div>}
        {items.map((it, i) => {
          const f = it.focus ?? [50, 50], z = it.zoom ?? 1, pr = priceText(it.price);
          return (
            <div key={i} style={{ minWidth: 0, minHeight: 0, display: "flex", flexDirection: "column", background: "rgba(255,255,255,.1)", border: "2px solid rgba(255,255,255,.3)" }}>
              <div role="img" aria-label={it.name || `Article ${i + 1}`} onPointerDown={it.photo ? panPhoto(i, f) : undefined} style={{ position: "relative", flex: 1, minHeight: 0, background: "rgba(255,255,255,.92)", overflow: "hidden", cursor: onPan && it.photo ? "grab" : undefined, touchAction: onPan ? "none" : undefined }}>
                {it.photo && <img src={it.photo} alt="" draggable={false} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", objectPosition: `${f[0]}% ${f[1]}%`, transform: `scale(${z})`, transformOrigin: `${f[0]}% ${f[1]}%`, pointerEvents: "none" }} />}
              </div>
              <div style={{ flex: "0 0 auto", padding: "10px 12px 12px", textAlign: "center", display: "grid", gap: 2 }}>
                <div data-fmt={`nom-${i}`} style={{ fontSize: (n > 4 ? 17 : 21) * k, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", overflowWrap: "break-word" }}>{txt(fmt, `nom-${i}`, tidy(it.name) || `Article ${i + 1}`)}</div>
                {it.colors && it.colors.length > 0 && <div role="img" aria-label={`Coloris : ${it.colors.map(colorName).join(", ")}`} style={{ display: "flex", gap: 8, justifyContent: "center", marginTop: 4 }}>{it.colors.map((c) => <span key={c} style={{ width: n > 4 ? 20 : 26, height: n > 4 ? 20 : 26, borderRadius: "50%", background: c, border: "2px solid #fff", boxShadow: "0 0 0 1px rgba(0,0,0,.35)" }} />)}</div>}
                {pr && <div data-fmt={`prix-${i}`} style={{ fontSize: (n > 4 ? 30 : 38) * k, fontWeight: 900, color: "#ffd84d", lineHeight: 1.05 }}>{txt(fmt, `prix-${i}`, pr)}</div>}
              </div>
            </div>
          );
        })}
      </div>
      <div style={{ position: "absolute", left: 52, right: 52, bottom: 36, height: FOOT - 36, display: "flex", flexDirection: "column", justifyContent: "flex-end", gap: 12 }}>
        {data.sizes.trim() && <div data-fmt="tailles" style={{ display: "flex", gap: 14, alignItems: "baseline", fontSize: 19 * k, fontWeight: 800, letterSpacing: "0.08em", borderTop: "2px solid rgba(255,255,255,.35)", paddingTop: 10 }}><span style={{ opacity: 0.8, letterSpacing: "0.18em", fontSize: 15 * k }}>TAILLES</span><span>{txt(fmt, "tailles", data.sizes)}</span></div>}
        <div style={{ background: "#ffd84d", color: "#1b1863", padding: "18px 24px", display: "grid", gap: 8 }}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 30px", alignItems: "baseline" }}>
            {data.deadline.trim() && <div data-fmt="date-limite" style={{ fontSize: 34 * k, fontWeight: 900, textTransform: "uppercase", lineHeight: 1.05 }}>{txt(fmt, "date-limite", `Commande avant le ${tidy(data.deadline)}`)}</div>}
            {data.delivery.trim() && <div data-fmt="remise" style={{ fontSize: 21 * k, fontWeight: 700 }}>{txt(fmt, "remise", `Remise des tenues : ${data.delivery.trim()}`)}</div>}
          </div>
          {data.how.trim() && <div data-fmt="commande" style={{ fontSize: 22 * k, fontWeight: 600, lineHeight: 1.3, whiteSpace: "pre-line" }}><b style={{ letterSpacing: "0.14em", fontSize: 16 * k }}>POUR COMMANDER · </b>{txt(fmt, "commande", glue(data.how))}</div>}
          {!data.deadline.trim() && !data.delivery.trim() && !data.how.trim() && <div style={{ fontSize: 20, fontWeight: 700 }}>Renseigne la date limite et la façon de commander dans le menu de gauche.</div>}
        </div>
        {logos.length > 0 && <div style={{ display: "flex", gap: 14, alignItems: "center", justifyContent: "center", height: 46 }}>{logos.slice(0, 8).map((l, i) => <img key={i} src={l} alt="" style={{ maxHeight: 46, maxWidth: 120, objectFit: "contain", background: "#fff", padding: 4 }} />)}</div>}
      </div>
    </div>
  );
}

// ---- fenêtre de l'affiche ----
type Saved = { d: TextileData; format: TextileFormat; bg: string };
const FORMATS: StudioFormat[] = [{ id: "A4", label: "📄 A4 à imprimer", ...TEXTILE_SIZES.A4 }, { id: "CARRE", label: "📱 Carré (réseaux)", ...TEXTILE_SIZES.CARRE }];
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
    { key: "entete", label: "Nom du club (haut)", edit: true }, { key: "chip", label: "Pastille « commandes ouvertes »", edit: true }, { key: "titre", label: "Titre", edit: true }, { key: "accroche", label: "Phrase sous le titre", edit: true },
    ...shown.flatMap((_, j) => [{ key: `nom-${j}`, label: `Article ${j + 1} : nom`, edit: true }, { key: `prix-${j}`, label: `Article ${j + 1} : prix`, edit: true }] as FmtItem[]),
    { key: "tailles", label: "Tailles", edit: true }, { key: "date-limite", label: "Date limite", edit: true }, { key: "remise", label: "Remise des tenues", edit: true }, { key: "commande", label: "Comment commander", edit: true }, { key: "tout", label: "Tous les textes", sizeOnly: true },
  ];
  const poster = (extra: object = {}) => <TextilePoster data={d} format={format} bg={bg} fmt={fmt} logos={withPartners ? logos : []} {...extra} />;
  return (
    <PosterStudio
      title="👕 Affiche de l'opération textile" subtitle={draftId ? "enregistrée en ligne" : "pas encore enregistrée"} onClose={() => { void auto.flush().finally(onClose); }}
      formats={FORMATS} format={format} onFormat={(f) => setFormat(f as TextileFormat)}
      intro={<details className="rounded-md bg-[#fff4cc] p-3 text-sm text-[#6b4e00]"><summary role="note" className="cursor-pointer font-bold">⚠️ Photos portées : seulement des adultes ou des enfants avec le droit à l'image</summary><p className="m-0 mt-2">Pour des photos de vêtements portés, vérifie l'accord des personnes (des parents pour un enfant). Des photos de vêtements seuls n'ont aucune contrainte.</p></details>}
      content={<>
        {msg && <p className="m-0 text-sm font-bold text-ink" role="status">{msg}</p>}
        <Sec title="1 · Les articles (photos, noms, prix)">
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
                      <input className={field} aria-label={`Article ${i + 1} : prix`} placeholder="Prix (ex. 35 €)" maxLength={20} value={it.price} onChange={(e) => setItem(i, { price: e.target.value })} />
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button type="button" className="btn-outline btn-sm" aria-label={`Article ${i + 1} : avant`} disabled={i === 0} onClick={() => move(i, i - 1)}>◀</button>
                    <button type="button" className="btn-outline btn-sm" aria-label={`Article ${i + 1} : après`} disabled={i === d.items.length - 1} onClick={() => move(i, i + 1)}>▶</button>
                    <label className="btn-outline btn-sm cursor-pointer">📷 {it.photo ? "Changer la photo" : "Ajouter la photo"}
                      <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" aria-label={`Article ${i + 1} : photo`} onChange={async (e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) { try { setItem(i, { photo: await photoFromFile(f), focus: undefined, zoom: undefined }); } catch (x) { setMsg((x as Error).message); } } }} /></label>
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
              {d.items.length < MAX_ITEMS && (
                <label className="btn-outline cursor-pointer justify-self-start">＋ Ajouter des photos
                  <input type="file" multiple accept="image/jpeg,image/png,image/webp" className="sr-only" aria-label="Ajouter d'autres photos" onChange={(e) => { void addFiles(e.target.files); e.target.value = ""; }} /></label>
              )}
              <button type="button" className="btn-outline justify-self-start" onClick={() => { setD((o) => ({ ...o, items: [...o.items, { name: "", price: "", photo: "" }] })); }} disabled={d.items.length >= MAX_ITEMS}>＋ Un article sans photo</button>
            </div>
          )}
        </Sec>
        <Sec title="2 · Date limite et remise">
          <label className="block text-sm font-bold text-ink">Date limite de commande <span className="font-normal text-muted">(écris par exemple « 30 novembre »)</span>
            <input className={`${field} mt-1`} aria-label="Date limite de commande" maxLength={40} placeholder="30 novembre" value={d.deadline} onChange={(e) => set({ deadline: e.target.value })} /></label>
          <label className="mt-2 block text-sm font-bold text-ink">Remise des tenues <span className="font-normal text-muted">(facultatif)</span>
            <input className={`${field} mt-1`} aria-label="Remise des tenues" maxLength={60} placeholder="mi-décembre, au club" value={d.delivery} onChange={(e) => set({ delivery: e.target.value })} /></label>
        </Sec>
        <Sec title="3 · Comment commander">
          <label className="block text-sm font-bold text-ink">Comment commander ?
            <textarea className={`${field} mt-1`} aria-label="Comment commander" rows={3} maxLength={240} value={d.how} onChange={(e) => set({ how: e.target.value })} /></label>
          <div className="mt-2 flex flex-wrap gap-2">
            {["Au club, à l'accueil", "Par e-mail à tennisclubhoudan@gmail.com", "Bon de commande à déposer au club", "Paiement à la commande"].map((s) => <button key={s} type="button" className="btn-outline btn-sm" onClick={() => set({ how: d.how.trim() ? `${d.how.trim()}\n${s}` : s })}>＋ {s}</button>)}
          </div>
        </Sec>
        <Sec title="4 · Tailles et pastille">
          <label className="block text-sm font-bold text-ink">Tailles proposées <span className="font-normal text-muted">(vide = non affiché)</span>
            <input className={`${field} mt-1`} aria-label="Tailles proposées" maxLength={60} value={d.sizes} onChange={(e) => set({ sizes: e.target.value })} /></label>
          <label className="mt-2 block text-sm font-bold text-ink">Pastille du haut <span className="font-normal text-muted">(vide = non affichée)</span>
            <input className={`${field} mt-1`} aria-label="Pastille du haut" maxLength={30} value={d.chip} onChange={(e) => set({ chip: e.target.value })} /></label>
          <label className="mt-2 block text-sm font-bold text-ink">Phrase sous le titre
            <input className={`${field} mt-1`} aria-label="Phrase sous le titre" maxLength={90} value={d.tagline} onChange={(e) => set({ tagline: e.target.value })} /></label>
        </Sec>
      </>}
      look={canPartners && logos.length > 0 ? <Sec title="Partenaires"><Toggle on={withPartners} onChange={setWithPartners} label="🤝 Montrer les logos des partenaires" /></Sec> : undefined}
      bg={bg} onBg={setBg}
      fmt={{ items: fmtItems, value: fmt, onChange: setFmt, selected: sel, onSelect: setSel }}
      preview={({ pick }) => poster({ onPick: pick, onPan: (i: number, x: number, y: number) => { const real = shown[i]?.i; if (real !== undefined) setItem(real, { focus: [x, y] }); } })}
      printNode={poster()}
      fileBase={(f) => `affiche-operation-textile-${f.toLowerCase()}`}
      save={auto.state.kind === "idle" ? { kind: "idle", text: "Se sauvegarde toute seule, photos comprises" } : auto.state}
      beforeDownload={auto.flush}
      topExtra={<DraftsMenu kind="textile" currentId={draftId} refreshKey={rev} onOpen={open} onDeleted={(id) => { if (id === idRef.current) { idRef.current = null; setDraftId(null); } }} />}
    />
  );
}

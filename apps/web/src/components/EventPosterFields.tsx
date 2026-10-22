import { useState } from "react";
import { Formula, Kind } from "../clubPlan";

export interface PosterInfo { time: string; place: string; signup: string; formulas: Formula[]; audience: string; bring: string }
export const emptyInfo = (): PosterInfo => ({ time: "", place: "", signup: "", formulas: [], audience: "", bring: "" });
export const MAX_FORMULAS = 8;
export const CLUB_SITE = "https://tennisclubhoudan78.jimdofree.com/"; // site internet du club (simple texte sur l'affiche, rien n'est chargé)
export const SIGNUP_ONLINE = "Sur le site internet du club : tennisclubhoudan78.jimdofree.com";
export const isStage = (kind: string) => kind === "STAGE_ENFANTS" || kind === "STAGE_ADULTES";
const SUGGEST = ["Adhérent", "Non adhérent", "Journée", "Demi-journée", "Semaine complète", "1 enfant", "2e enfant"];
// Les formules habituelles des stages enfants du club (les prix restent à écrire)
export const KIDS_AUDIENCE = "Enfants et ados de 6 à 17 ans · mini tennis de 3 à 5 ans";
export const KIDS_PRESET: Formula[] = [
  { group: "Toute la semaine · 6 à 17 ans", label: "Journée 10 h – 16 h", detail: "pique-nique le midi", price: "" },
  { group: "Toute la semaine · 6 à 17 ans", label: "Demi-journée 13 h – 16 h", detail: "", price: "" },
  { group: "À la carte · 6 à 17 ans", label: "Journée 10 h – 16 h", detail: "au choix, à l'unité · pique-nique le midi", price: "" },
  { group: "À la carte · 6 à 17 ans", label: "Demi-journée 13 h – 16 h", detail: "au choix, à l'unité", price: "" },
  { group: "Mini tennis · 3 à 5 ans · 16 h – 17 h", label: "Toute la semaine", detail: "lundi, mardi, jeudi et vendredi", price: "" },
  { group: "Mini tennis · 3 à 5 ans · 16 h – 17 h", label: "À la journée", detail: "au choix, à l'unité", price: "" },
];
const STAGE_SUGGEST = ["Semaine complète", "Journée", "Demi-journée", "Adhérent", "Non adhérent", "2e enfant"];

const inputCls = "mt-1 w-full rounded-xl border-2 border-line bg-white px-3 py-2 text-sm font-normal text-ink";

function Formulas({ value, onChange, stage, kids }: { value: PosterInfo; onChange: (v: PosterInfo) => void; stage: boolean; kids?: boolean }) {
  const set = (p: Partial<PosterInfo>) => onChange({ ...value, ...p });
  const setF = (i: number, p: Partial<Formula>) => set({ formulas: value.formulas.map((f, k) => (k === i ? { ...f, ...p } : f)) });
  const add = (label = "") => value.formulas.length < MAX_FORMULAS && set({ formulas: [...value.formulas, { label, price: "", detail: "", group: value.formulas[value.formulas.length - 1]?.group ?? "" }] });
  const KEY = "cc-formula-model"; // modèle personnel gardé seulement dans le navigateur du coach (rien n'est envoyé)
  const [mine, setMine] = useState<Formula[]>(() => { try { const v = JSON.parse(localStorage.getItem(KEY) ?? "[]"); return Array.isArray(v) ? v : []; } catch { return []; } });
  const saveMine = (f: Formula[]) => { const clean = f.map((x) => ({ ...x, price: "" })); try { localStorage.setItem(KEY, JSON.stringify(clean)); } catch { /* sans stockage, pas de modèle */ } setMine(clean); };
  const replaceWith = (list: Formula[], audience?: string) => {
    if (value.formulas.length > 0 && !window.confirm("Remplacer les formules actuelles par ce modèle ? (les prix seront à ressaisir)")) return;
    onChange({ ...value, formulas: list.map((f) => ({ ...f })), audience: audience && !value.audience ? audience : value.audience, signup: audience && !value.signup ? SIGNUP_ONLINE : value.signup });
  };
  const groups = [...new Set(value.formulas.map((f) => f.group ?? "").filter(Boolean))];
  const sug = (stage ? STAGE_SUGGEST : SUGGEST).filter((s) => !value.formulas.some((f) => f.label === s)).slice(0, 5);
  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center gap-1.5">
        {kids && <button type="button" className={value.formulas.length === 0 ? "btn-clay" : "btn-outline"} onClick={() => replaceWith(KIDS_PRESET, KIDS_AUDIENCE)}>📋 Formules habituelles des stages enfants</button>}
        {mine.length > 0 && <button type="button" className="btn-outline" onClick={() => replaceWith(mine)}>📂 Mon modèle ({mine.length})</button>}
        {value.formulas.length > 0 && <button type="button" className="btn-outline" onClick={() => saveMine(value.formulas)}>💾 Garder ces formules comme mon modèle</button>}
        {value.formulas.length > 0 && <button type="button" className="btn-outline" onClick={() => { if (window.confirm("Effacer toutes les formules ?")) set({ formulas: [] }); }}>🧹 Tout effacer</button>}
      </div>
      {value.formulas.length === 0 && <p className="mb-2 mt-0 text-sm text-muted">Écris tes propres formules avec « ＋ Ajouter une formule », ou pars d'un modèle ci-dessus : tout reste modifiable (noms, prix, rubriques, précisions).</p>}
      <datalist id="formula-groups">{groups.map((g) => <option key={g} value={g} />)}</datalist>
      <ul className="m-0 grid list-none gap-2.5 p-0">
        {value.formulas.map((f, i) => (
          <li key={i} className="rounded-xl border-2 border-line bg-white p-2.5">
            <div className="flex flex-wrap items-center gap-2">
              <span aria-hidden className="grid size-7 shrink-0 place-items-center rounded-full bg-ink text-xs font-black text-white">{i + 1}</span>
              <input aria-label={`Formule ${i + 1}`} maxLength={40} value={f.label} onChange={(e) => setF(i, { label: e.target.value })} placeholder="Nom de la formule (ex. Semaine complète)" className="min-w-0 flex-[3_1_11rem] rounded-xl border-2 border-line bg-white px-3 py-2 text-sm font-bold text-ink" />
              <input aria-label={`Prix ${i + 1}`} maxLength={30} value={f.price} onChange={(e) => setF(i, { price: e.target.value })} placeholder="Prix (ex. 120 €)" className="w-32 flex-[1_1_7rem] rounded-xl border-2 border-line bg-white px-3 py-2 text-sm font-black text-ink" />
              <button type="button" className="rounded-lg border-2 border-line bg-white px-2.5 py-1.5 text-sm font-bold text-ink hover:border-ink" aria-label={`Retirer la formule ${i + 1}`} onClick={() => set({ formulas: value.formulas.filter((_, k) => k !== i) })}>🗑️</button>
            </div>
            <input aria-label={`Rubrique de la formule ${i + 1}`} list="formula-groups" maxLength={60} value={f.group ?? ""} onChange={(e) => setF(i, { group: e.target.value })} placeholder="Rubrique (facultatif) : 6 à 17 ans, Mini tennis 3 à 5 ans…" className="mt-2 w-full rounded-xl border-2 border-dashed border-line bg-[#fbf8f2] px-3 py-1.5 text-sm text-ink" />
            <input aria-label={`Détail de la formule ${i + 1}`} maxLength={60} value={f.detail ?? ""} onChange={(e) => setF(i, { detail: e.target.value })} placeholder="Précision (facultatif) : 5 matinées de 9 h à 12 h, goûter compris…" className="mt-2 w-full rounded-xl border-2 border-dashed border-line bg-[#fbf8f2] px-3 py-1.5 text-sm text-ink" />
          </li>))}
      </ul>
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <button type="button" className="btn-outline" disabled={value.formulas.length >= MAX_FORMULAS} onClick={() => add()}>＋ Ajouter une formule</button>
        {value.formulas.length < MAX_FORMULAS && sug.map((s) => (
          <button key={s} type="button" className="rounded-full border-2 border-line bg-white px-2.5 py-1 text-xs font-bold text-ink hover:border-ink" onClick={() => add(s)}>＋ {s}</button>))}
      </div>
    </div>
  );
}

const Step = ({ n, title, hint, color, children }: { n: number; title: string; hint?: string; color: string; children: React.ReactNode }) => (
  <section className="rounded-2xl border-2 bg-white p-3" style={{ borderColor: color }}>
    <h4 className="m-0 mb-2 flex items-center gap-2 text-base text-ink"><span aria-hidden className="grid size-7 place-items-center rounded-full text-sm font-black text-white" style={{ background: color }}>{n}</span>{title}{hint ? <small className="font-normal text-muted">{hint}</small> : null}</h4>
    {children}
  </section>
);

// Les informations de l'affiche d'un événement. Tout est facultatif : une case vide n'apparaît pas sur l'affiche.
// Pour un STAGE : un vrai formulaire en 5 étapes (pour qui, quand et où, formules et prix, à prévoir, inscriptions).
export function EventPosterFields({ value, onChange, kind }: { value: PosterInfo; onChange: (v: PosterInfo) => void; kind?: Kind | string }) {
  const set = (p: Partial<PosterInfo>) => onChange({ ...value, ...p });
  if (kind && isStage(kind)) {
    const adults = kind === "STAGE_ADULTES";
    return (
      <div className="grid gap-3">
        <Step n={1} title="Pour qui ?" color="#27AE60">
          <input aria-label="Pour qui" maxLength={120} value={value.audience} onChange={(e) => set({ audience: e.target.value })} placeholder={adults ? "Ex. Adultes, tous niveaux" : "Ex. 8 à 12 ans, tous niveaux"} className={inputCls} />
        </Step>
        <Step n={2} title="Quand et où ?" color="#2E86C1">
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="block text-sm font-bold text-ink">🕒 Horaires
              <input aria-label="Horaires" maxLength={80} value={value.time} onChange={(e) => set({ time: e.target.value })} placeholder="Ex. 9 h – 12 h" className={inputCls} /></label>
            <label className="block text-sm font-bold text-ink">📍 Lieu
              <input aria-label="Lieu" maxLength={120} value={value.place} onChange={(e) => set({ place: e.target.value })} placeholder="Ex. Courts couverts, Houdan" className={inputCls} /></label>
          </div>
          <p className="mb-0 mt-1.5 text-xs text-muted">Les dates du stage viennent du planning : elles s'écrivent toutes seules sur l'affiche.</p>
        </Step>
        <Step n={3} title="Formules et prix" hint={` · plusieurs formules possibles, ${MAX_FORMULAS} au plus`} color="#D35400">
          <Formulas value={value} onChange={onChange} stage kids={kind === "STAGE_ENFANTS"} />
        </Step>
        <Step n={4} title="À prévoir" hint=" · facultatif" color="#8E44AD">
          <input aria-label="À prévoir" maxLength={160} value={value.bring} onChange={(e) => set({ bring: e.target.value })} placeholder="Ex. Tenue de sport, bouteille d'eau, raquette (prêt possible)" className={inputCls} />
        </Step>
        <Step n={5} title="Inscriptions" color="#16A085">
          <button type="button" className="mb-1 mt-1 rounded-full border-2 border-line bg-white px-2.5 py-1 text-xs font-bold text-ink hover:border-ink" onClick={() => set({ signup: SIGNUP_ONLINE })}>🌐 Inscriptions sur le site internet du club</button>
        <input aria-label="Inscriptions" maxLength={160} value={value.signup} onChange={(e) => set({ signup: e.target.value })} placeholder="Ex. À l'accueil du club, avant le 20 octobre" className={inputCls} />
        </Step>
      </div>
    );
  }
  return (
    <div className="grid gap-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-sm font-bold text-ink">🕒 Horaires
          <input aria-label="Horaires" maxLength={80} value={value.time} onChange={(e) => set({ time: e.target.value })} placeholder="Ex. 9 h – 12 h" className={inputCls} /></label>
        <label className="block text-sm font-bold text-ink">📍 Lieu
          <input aria-label="Lieu" maxLength={120} value={value.place} onChange={(e) => set({ place: e.target.value })} placeholder="Ex. Courts couverts, Houdan" className={inputCls} /></label>
      </div>
      <label className="block text-sm font-bold text-ink">👥 Pour qui ? <small className="font-normal text-muted">(facultatif)</small>
        <input aria-label="Pour qui" maxLength={120} value={value.audience} onChange={(e) => set({ audience: e.target.value })} placeholder="Ex. Ouvert à tous les adhérents" className={inputCls} /></label>
      <div>
        <p className="m-0 mb-1.5 text-sm font-bold text-ink">💶 Formules et prix <small className="font-normal text-muted">(plusieurs possibles, {MAX_FORMULAS} au plus)</small></p>
        <Formulas value={value} onChange={onChange} stage={false} />
      </div>
      <label className="block text-sm font-bold text-ink">🎒 À prévoir <small className="font-normal text-muted">(facultatif)</small>
        <input aria-label="À prévoir" maxLength={160} value={value.bring} onChange={(e) => set({ bring: e.target.value })} placeholder="Ex. Tenue de sport, bouteille d'eau" className={inputCls} /></label>
      <label className="block text-sm font-bold text-ink">✍️ Inscriptions
        <button type="button" className="mb-1 mt-1 rounded-full border-2 border-line bg-white px-2.5 py-1 text-xs font-bold text-ink hover:border-ink" onClick={() => set({ signup: SIGNUP_ONLINE })}>🌐 Inscriptions sur le site internet du club</button>
        <input aria-label="Inscriptions" maxLength={160} value={value.signup} onChange={(e) => set({ signup: e.target.value })} placeholder="Ex. À l'accueil, jusqu'au 20 octobre" className={inputCls} /></label>
    </div>
  );
}

import { useState } from "react";
import { Formula, Kind } from "../clubPlan";

export interface PosterInfo { time: string; place: string; signup: string; formulas: Formula[]; audience: string; bring: string }
export const emptyInfo = (): PosterInfo => ({ time: "", place: "", signup: "", formulas: [], audience: "", bring: "" });
export const MAX_FORMULAS = 8;
export const CLUB_SITE = "https://tennisclubhoudan78.jimdofree.com/"; // site internet du club (simple texte sur l'affiche, rien n'est chargé)
export const SIGNUP_ONLINE = "Sur le site internet du club : tennisclubhoudan78.jimdofree.com";
export const isStage = (kind: string) => kind === "STAGE_ENFANTS" || kind === "STAGE_ADULTES";
export const isAnimation = (kind: string) => kind === "ANIMATION";
export const isTournoi = (kind: string) => kind === "TOURNOI";
export const hasSimpleForm = (kind: string) => isAnimation(kind) || isTournoi(kind);
const SUGGEST = ["Adhérent", "Non adhérent", "Journée", "Demi-journée", "Semaine complète", "1 enfant", "2e enfant"];
// Les formules habituelles des stages enfants du club (les prix restent à écrire)
export const KIDS_AUDIENCE = "Enfants et ados de 6 à 17 ans · mini tennis de 3 à 5 ans";
export const KIDS_BRING = "Tenue de sport, bouteille d'eau · pique-nique pour les formules à la journée (10 h – 16 h)";
export const KIDS_PRESET: Formula[] = [
  { group: "Stage à la semaine · 6 à 17 ans", label: "Toute la semaine · 10 h – 16 h", detail: "journée, tous les jours de la semaine · pique-nique le midi", price: "", priceMember: "" },
  { group: "Stage à la semaine · 6 à 17 ans", label: "Toute la semaine · 13 h – 16 h", detail: "demi-journée, tous les jours de la semaine", price: "", priceMember: "" },
  { group: "Stage à la journée ou à la demi-journée · 6 à 17 ans", label: "À la journée 10 h – 16 h", detail: "au choix, à l'unité · pique-nique le midi", price: "", priceMember: "" },
  { group: "Stage à la journée ou à la demi-journée · 6 à 17 ans", label: "À la demi-journée 13 h – 16 h", detail: "au choix, à l'unité", price: "", priceMember: "" },
  { group: "Stage mini tennis · 3 à 5 ans · 16 h – 17 h", label: "Toute la semaine", detail: "lundi, mardi, jeudi et vendredi", price: "", priceMember: "" },
  { group: "Stage mini tennis · 3 à 5 ans · 16 h – 17 h", label: "À la journée", detail: "au choix, à l'unité", price: "", priceMember: "" },
];
const STAGE_SUGGEST = ["Semaine complète", "Journée", "Demi-journée", "Adhérent", "Non adhérent", "2e enfant"];

// Prix : un menu déroulant de tarifs habituels, ou « Autre » pour l'écrire à la main (une valeur déjà écrite reste affichée)
export const PRICE_CHOICES = ["Gratuit", ...[5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 60, 70, 80, 90, 100, 110, 120, 130, 140, 150, 160, 180, 200].map((n) => `${n} €`)];
const PRICE_OTHER = "__autre__";
function PriceField({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  const [other, setOther] = useState(false);
  const custom = other || (value !== "" && !PRICE_CHOICES.includes(value));
  return (
    <div className="grid gap-1.5">
      <select aria-label={label} className="w-full rounded-xl border-2 border-line bg-white px-3 py-2 text-sm font-black normal-case text-ink" value={custom ? PRICE_OTHER : value}
        onChange={(e) => { const v = e.target.value; if (v === PRICE_OTHER) { setOther(true); if (PRICE_CHOICES.includes(value)) onChange(""); } else { setOther(false); onChange(v); } }}>
        <option value="">Choisir un prix…</option>
        {PRICE_CHOICES.map((o) => <option key={o} value={o}>{o}</option>)}
        <option value={PRICE_OTHER}>✏️ Autre : je l'écris moi-même</option>
      </select>
      {custom && <input aria-label={`${label} : écrit à la main`} maxLength={30} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder ?? "Ex. 5 € par personne"} className="w-full rounded-xl border-2 border-line bg-white px-3 py-2 text-sm font-black normal-case text-ink" />}
    </div>
  );
}

// Menu déroulant générique + « Autre » pour écrire à la main
function ChoiceField({ label, options, value, onChange, placeholder, first = "Choisir…" }: { label: string; options: string[]; value: string; onChange: (v: string) => void; placeholder?: string; first?: string }) {
  const [other, setOther] = useState(false);
  const custom = other || (value !== "" && !options.includes(value));
  return (
    <div className="grid gap-1.5">
      <select aria-label={label} className="w-full rounded-xl border-2 border-line bg-white px-3 py-2 text-sm font-bold normal-case text-ink" value={custom ? PRICE_OTHER : value}
        onChange={(e) => { const v = e.target.value; if (v === PRICE_OTHER) { setOther(true); if (options.includes(value)) onChange(""); } else { setOther(false); onChange(v); } }}>
        <option value="">{first}</option>
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
        <option value={PRICE_OTHER}>✏️ Autre : je l'écris moi-même</option>
      </select>
      {custom && <input aria-label={`${label} : écrit à la main`} maxLength={120} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="w-full rounded-xl border-2 border-line bg-white px-3 py-2 text-sm font-bold normal-case text-ink" />}
    </div>
  );
}
export const SURFACES = ["Terre battue", "Dur (quick)", "Terre battue et dur", "Moquette", "Gazon synthétique"];

const inputCls = "mt-1 w-full rounded-xl border-2 border-line bg-white px-3 py-2 text-sm font-normal text-ink";

function Formulas({ value, onChange, stage, kids }: { value: PosterInfo; onChange: (v: PosterInfo) => void; stage: boolean; kids?: boolean }) {
  const set = (p: Partial<PosterInfo>) => onChange({ ...value, ...p });
  const setF = (i: number, p: Partial<Formula>) => set({ formulas: value.formulas.map((f, k) => (k === i ? { ...f, ...p } : f)) });
  const add = (label = "") => value.formulas.length < MAX_FORMULAS && set({ formulas: [...value.formulas, { label, price: "", detail: "", group: value.formulas[value.formulas.length - 1]?.group ?? "" }] });
  const KEY = "cc-formula-model"; // modèle personnel gardé seulement dans le navigateur du coach (rien n'est envoyé)
  const [mine, setMine] = useState<Formula[]>(() => { try { const v = JSON.parse(localStorage.getItem(KEY) ?? "[]"); return Array.isArray(v) ? v : []; } catch { return []; } });
  const saveMine = (f: Formula[]) => { const clean = f.map((x) => ({ ...x, price: "", priceMember: "" })); try { localStorage.setItem(KEY, JSON.stringify(clean)); } catch { /* sans stockage, pas de modèle */ } setMine(clean); };
  const replaceWith = (list: Formula[], audience?: string, bring?: string) => {
    if (value.formulas.length > 0 && !window.confirm("Remplacer les formules actuelles par ce modèle ? (les prix seront à ressaisir)")) return;
    onChange({ ...value, formulas: list.map((f) => ({ ...f })), audience: audience && !value.audience ? audience : value.audience, signup: audience && !value.signup ? SIGNUP_ONLINE : value.signup, bring: bring && !value.bring ? bring : value.bring });
  };
  const groups = [...new Set(value.formulas.map((f) => f.group ?? "").filter(Boolean))];
  const sug = (stage ? STAGE_SUGGEST : SUGGEST).filter((s) => !value.formulas.some((f) => f.label === s)).slice(0, 5);
  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center gap-1.5">
        {kids && <button type="button" className={value.formulas.length === 0 ? "btn-clay" : "btn-outline"} onClick={() => replaceWith(KIDS_PRESET, KIDS_AUDIENCE, KIDS_BRING)}>📋 Formules habituelles des stages enfants</button>}
        <button type="button" className={value.formulas.length === 0 && !kids ? "btn-clay" : "btn-outline"} disabled={value.formulas.length >= MAX_FORMULAS} onClick={() => add()}>＋ Créer ma propre formule</button>
        {mine.length > 0 && <button type="button" className="btn-outline" onClick={() => replaceWith(mine)}>📂 Mon modèle ({mine.length})</button>}
        {value.formulas.length > 0 && <button type="button" className="btn-outline" onClick={() => saveMine(value.formulas)}>💾 Garder ces formules comme mon modèle</button>}
        {value.formulas.length > 0 && <button type="button" className="btn-outline" onClick={() => { if (window.confirm("Effacer toutes les formules ?")) set({ formulas: [] }); }}>🧹 Tout effacer</button>}
      </div>
      {value.formulas.length === 0 && <p className="mb-2 mt-0 text-sm text-muted">Pour chaque formule, écris un prix « adhérent » et un prix « non adhérent » (ou un seul des deux). Écris tes propres formules avec « ＋ Ajouter une formule », ou pars d'un modèle ci-dessus : tout reste modifiable (noms, prix, rubriques, précisions).</p>}
      <datalist id="formula-groups">{groups.map((g) => <option key={g} value={g} />)}</datalist>
      <ul className="m-0 grid list-none gap-2.5 p-0">
        {value.formulas.map((f, i) => (
          <li key={i} className="rounded-xl border-2 border-line bg-white p-2.5">
            <div className="flex flex-wrap items-center gap-2">
              <span aria-hidden className="grid size-7 shrink-0 place-items-center rounded-full bg-ink text-xs font-black text-white">{i + 1}</span>
              <input aria-label={`Formule ${i + 1}`} maxLength={40} value={f.label} onChange={(e) => setF(i, { label: e.target.value })} placeholder="Nom de la formule (ex. Semaine complète)" className="min-w-0 flex-[3_1_11rem] rounded-xl border-2 border-line bg-white px-3 py-2 text-sm font-bold text-ink" />
              <button type="button" className="rounded-lg border-2 border-line bg-white px-2.5 py-1.5 text-sm font-bold text-ink hover:border-ink" aria-label={`Retirer la formule ${i + 1}`} onClick={() => set({ formulas: value.formulas.filter((_, k) => k !== i) })}>🗑️</button>
            </div>
            <div className="mt-2 flex gap-2">
              <div className="flex-1"><span className="mb-0.5 block text-xs font-black uppercase tracking-wide text-muted">Tarif adhérent</span>
                <PriceField label={`Prix adhérent ${i + 1}`} value={f.priceMember ?? ""} onChange={(v) => setF(i, { priceMember: v })} placeholder="Ex. 100 €" /></div>
              <div className="flex-1"><span className="mb-0.5 block text-xs font-black uppercase tracking-wide text-muted">Tarif non adhérent</span>
                <PriceField label={`Prix non adhérent ${i + 1}`} value={f.price} onChange={(v) => setF(i, { price: v })} placeholder="Ex. 120 €" /></div>
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
          <p className="mb-0 mt-1.5 text-xs text-muted">Les dates viennent du planning : elles s'écrivent toutes seules sur l'affiche.</p>
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

// Formulaire SIMPLE d'une animation ou d'un tournoi : nom, pour qui, ce qu'il va se passer, horaires, (lieu), tarif, (à prévoir), où s'inscrire (la date vient du planning).
export function AnimationForm({ value, onChange, title, onTitle, note, onNote, tournoi }: { value: PosterInfo; onChange: (v: PosterInfo) => void; title?: string; onTitle?: (t: string) => void; note: string; onNote: (t: string) => void; tournoi?: boolean }) {
  const set = (p: Partial<PosterInfo>) => onChange({ ...value, ...p });
  const first = value.formulas[0];
  const setPrices = (p: { price?: string; priceMember?: string }) => {
    const rest = value.formulas.slice(1);
    const next = { priceMember: "", detail: "", group: "", ...first, label: first?.label || (tournoi ? "Inscription" : "Participation"), price: first?.price ?? "", ...p };
    set({ formulas: !next.price.trim() && !(next.priceMember ?? "").trim() && rest.length === 0 ? [] : [next, ...rest] });
  };
  const setPrice = (price: string) => setPrices({ price });
  if (tournoi) {
    return (
      <div className="grid gap-3">
        {onTitle && <label className="block text-sm font-bold text-ink">🏷️ Nom du tournoi
          <input aria-label="Nom du tournoi" maxLength={80} value={title ?? ""} onChange={(e) => onTitle(e.target.value)} placeholder="Ex. TMC messieurs de 15/1 à 4/6" className={inputCls} /></label>}
        <p className="m-0 text-xs text-muted">📅 Les dates du tournoi viennent du planning : elles s'écrivent toutes seules sur l'affiche.</p>
        <div className="text-sm font-bold text-ink">🎨 Catégorie <small className="font-normal text-muted">(change les couleurs de l'affiche)</small>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {["Messieurs (adultes)", "Dames (adultes)", "Jeunes"].map((c) => (
              <button key={c} type="button" aria-pressed={value.audience === c} onClick={() => set({ audience: value.audience === c ? "" : c })}
                className={`rounded-full border-2 px-3 py-1.5 text-sm font-bold ${value.audience === c ? "border-ink bg-ink text-white" : "border-line bg-white text-ink hover:border-ink"}`}>{c === "Messieurs (adultes)" ? "👨 " : c === "Dames (adultes)" ? "👩 " : "🧒 "}{c}</button>))}
          </div></div>
        <div className="text-sm font-bold text-ink">🎾 Surface
          <div className="mt-1"><ChoiceField label="Surface" options={SURFACES} value={value.place} onChange={(v) => set({ place: v })} placeholder="Ex. Terre battue couverte" /></div></div>
        <label className="block text-sm font-bold text-ink">🕒 Horaires des matchs, jour par jour
          <input aria-label="Horaires des matchs" maxLength={80} value={value.time} onChange={(e) => set({ time: e.target.value })} placeholder="Ex. Sam. 9 h – 19 h · Dim. 9 h – 18 h" className={inputCls} /></label>
        <label className="block text-sm font-bold text-ink">🏆 Date et heure de la finale
          <input aria-label="Finale" maxLength={120} value={value.signup} onChange={(e) => set({ signup: e.target.value })} placeholder="Ex. Dimanche 15 novembre à 16 h" className={inputCls} /></label>
        <label className="block text-sm font-bold text-ink">💬 Petit message <small className="font-normal text-muted">(facultatif)</small>
          <textarea aria-label="Petit message" rows={3} maxLength={600} value={note} onChange={(e) => onNote(e.target.value)} placeholder="Ex. Buvette sur place, remise des prix après la finale…" className={inputCls} /></label>
      </div>
    );
  }
  return (
    <div className="grid gap-3">
      {onTitle && <label className="block text-sm font-bold text-ink">🏷️ {tournoi ? "Nom du tournoi" : "Nom de l'animation"}
        <input aria-label={tournoi ? "Nom du tournoi" : "Nom de l'animation"} maxLength={80} value={title ?? ""} onChange={(e) => onTitle(e.target.value)} placeholder={tournoi ? "Ex. Tournoi interne de la Toussaint" : "Ex. Journée portes ouvertes"} className={inputCls} /></label>}
      <p className="m-0 text-xs text-muted">📅 La date vient du planning : elle s'écrit toute seule sur l'affiche.</p>
      <label className="block text-sm font-bold text-ink">👥 {tournoi ? "Qui peut jouer ? (catégories)" : "Pour qui ?"}
        <input aria-label="Pour qui" maxLength={120} value={value.audience} onChange={(e) => set({ audience: e.target.value })} placeholder={tournoi ? "Ex. Simple messieurs et dames, tous niveaux" : "Ex. Ouvert à tous les adhérents"} className={inputCls} /></label>
      <label className="block text-sm font-bold text-ink">📝 {tournoi ? "Format et déroulement" : "Ce qu'il va se passer"}
        <textarea aria-label="Ce qu'il va se passer" rows={3} maxLength={600} value={note} onChange={(e) => onNote(e.target.value)} placeholder={tournoi ? "Ex. Poules puis tableau final, matchs de 6 jeux, remise des prix à 18 h, buvette sur place…" : "Ex. Matchs amicaux, initiation pour les débutants, goûter offert…"} className={inputCls} /></label>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-sm font-bold text-ink">🕒 Horaires
          <input aria-label="Horaires" maxLength={80} value={value.time} onChange={(e) => set({ time: e.target.value })} placeholder="Ex. 9 h – 18 h" className={inputCls} /></label>
        {tournoi && <label className="block text-sm font-bold text-ink">📍 Lieu
          <input aria-label="Lieu" maxLength={120} value={value.place} onChange={(e) => set({ place: e.target.value })} placeholder="Ex. Courts couverts, Houdan" className={inputCls} /></label>}
      </div>
      {tournoi ? (
        <div className="text-sm font-bold text-ink">💶 Droits d'inscription
          <div className="mt-1 grid gap-2 sm:grid-cols-2">
            <div><span className="mb-0.5 block text-xs font-black uppercase tracking-wide text-muted">Adhérent</span><PriceField label="Tarif adhérent" value={first?.priceMember ?? ""} onChange={(v) => setPrices({ priceMember: v })} placeholder="Ex. 10 €" /></div>
            <div><span className="mb-0.5 block text-xs font-black uppercase tracking-wide text-muted">Non adhérent</span><PriceField label="Tarif non adhérent" value={first?.price ?? ""} onChange={setPrice} placeholder="Ex. 15 €" /></div>
          </div>
        </div>
      ) : (
        <div className="text-sm font-bold text-ink">💶 Tarif
          <div className="mt-1"><PriceField label="Tarif" value={first?.price ?? ""} onChange={setPrice} placeholder="Ex. 5 € par personne" /></div>
          <button type="button" className="mt-1.5 rounded-full border-2 border-line bg-white px-2.5 py-1 text-xs font-bold text-ink hover:border-ink" onClick={() => setPrice("Gratuit")}>🎁 Gratuit</button>
        </div>
      )}
      {tournoi && <label className="block text-sm font-bold text-ink">🎒 À prévoir <small className="font-normal text-muted">(facultatif)</small>
        <input aria-label="À prévoir" maxLength={160} value={value.bring} onChange={(e) => set({ bring: e.target.value })} placeholder="Ex. Tenue de sport, raquettes, bouteille d'eau (balles fournies)" className={inputCls} /></label>}
      <div className="text-sm font-bold text-ink">✍️ {tournoi ? "Où et jusqu'à quand s'inscrire ?" : "Où s'inscrire ?"}
        <button type="button" className="mb-1 mt-1 block rounded-full border-2 border-line bg-white px-2.5 py-1 text-xs font-bold text-ink hover:border-ink" onClick={() => set({ signup: SIGNUP_ONLINE })}>🌐 Sur le site internet du club</button>
        <input aria-label="Inscriptions" maxLength={160} value={value.signup} onChange={(e) => set({ signup: e.target.value })} placeholder="Ex. À l'accueil du club, avant le 20 octobre" className={inputCls} />
      </div>
    </div>
  );
}

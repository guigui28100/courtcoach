import { Formula } from "../clubPlan";

export interface PosterInfo { time: string; place: string; signup: string; formulas: Formula[] }
export const emptyInfo = (): PosterInfo => ({ time: "", place: "", signup: "", formulas: [] });
const SUGGEST = ["Adhérent", "Non adhérent", "Journée", "Semaine complète", "1 enfant", "2e enfant", "Licence comprise"];
export const MAX_FORMULAS = 8;

// Les informations de l'affiche d'un événement : horaires, lieu, formules avec leur prix, inscriptions. Tout est facultatif : une case vide n'apparaît pas sur l'affiche.
export function EventPosterFields({ value, onChange }: { value: PosterInfo; onChange: (v: PosterInfo) => void }) {
  const set = (p: Partial<PosterInfo>) => onChange({ ...value, ...p });
  const setF = (i: number, p: Partial<Formula>) => set({ formulas: value.formulas.map((f, k) => (k === i ? { ...f, ...p } : f)) });
  const add = (label = "") => value.formulas.length < MAX_FORMULAS && set({ formulas: [...value.formulas, { label, price: "" }] });
  const input = "mt-1 w-full rounded-xl border-2 border-line bg-white px-3 py-2 text-sm font-normal text-ink";
  return (
    <div className="grid gap-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-sm font-bold text-ink">🕒 Horaires
          <input aria-label="Horaires" maxLength={80} value={value.time} onChange={(e) => set({ time: e.target.value })} placeholder="Ex. 9 h – 12 h" className={input} /></label>
        <label className="block text-sm font-bold text-ink">📍 Lieu
          <input aria-label="Lieu" maxLength={120} value={value.place} onChange={(e) => set({ place: e.target.value })} placeholder="Ex. Courts couverts, Houdan" className={input} /></label>
      </div>
      <div>
        <p className="m-0 text-sm font-bold text-ink">💶 Formules et prix <small className="font-normal text-muted">(écris autant de formules que tu veux, {MAX_FORMULAS} au plus)</small></p>
        <ul className="m-0 mt-1.5 grid list-none gap-2 p-0">
          {value.formulas.map((f, i) => (
            <li key={i} className="flex flex-wrap items-center gap-2">
              <input aria-label={`Formule ${i + 1}`} maxLength={40} value={f.label} onChange={(e) => setF(i, { label: e.target.value })} placeholder="Ex. Adhérent, Semaine complète…" className="min-w-0 flex-[2_1_10rem] rounded-xl border-2 border-line bg-white px-3 py-2 text-sm text-ink" />
              <input aria-label={`Prix ${i + 1}`} maxLength={30} value={f.price} onChange={(e) => setF(i, { price: e.target.value })} placeholder="Ex. 60 €" className="w-28 flex-[1_1_6rem] rounded-xl border-2 border-line bg-white px-3 py-2 text-sm font-bold text-ink" />
              <button type="button" className="rounded-lg border-2 border-line bg-white px-2.5 py-1.5 text-sm font-bold text-ink hover:border-ink" aria-label={`Retirer la formule ${i + 1}`} onClick={() => set({ formulas: value.formulas.filter((_, k) => k !== i) })}>🗑️</button>
            </li>))}
        </ul>
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <button type="button" className="btn-outline" disabled={value.formulas.length >= MAX_FORMULAS} onClick={() => add()}>＋ Ajouter une formule</button>
          {value.formulas.length < MAX_FORMULAS && SUGGEST.filter((s) => !value.formulas.some((f) => f.label === s)).slice(0, 5).map((s) => (
            <button key={s} type="button" className="rounded-full border-2 border-line bg-white px-2.5 py-1 text-xs font-bold text-ink hover:border-ink" onClick={() => add(s)}>＋ {s}</button>))}
        </div>
      </div>
      <label className="block text-sm font-bold text-ink">✍️ Inscriptions
        <input aria-label="Inscriptions" maxLength={160} value={value.signup} onChange={(e) => set({ signup: e.target.value })} placeholder="Ex. À l'accueil, jusqu'au 20 octobre" className={input} /></label>
    </div>
  );
}

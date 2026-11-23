import { createContext, useContext, CSSProperties } from "react";
import { Fmts, txt } from "./posterFmt";

// ───────────────────────────────────────────────────────────────────────────�
// L'ANECDOTE : un petit encadré facultatif que le coach peut ajouter sur TOUTES les affiches (fait marquant, coup de cœur, mot du capitaine…).
// Le texte se saisit dans l'onglet « Contenu » du studio (PosterStudio) ; chaque affiche pose <AnecdoteBox /> à l'endroit qui lui convient
// et ajoute `anec.sig` à sa signature de mise en page (pour se remesurer quand le texte change). Rien n'est enregistré avec l'affiche.
// ───────────────────────────────────────────────────────────────────────────�
export interface Anec { title: string; text: string; sig: string }
export const ANEC_TITLES = ["L'anecdote du week-end", "Le fait marquant", "Le coup de cœur", "Le mot du capitaine", "Le saviez-vous ?"];
export const ANEC_MAX = 1000;
export const noAnec: Anec = { title: ANEC_TITLES[0], text: "", sig: "" };
export const AnecCtx = createContext<Anec>(noAnec);
export const useAnec = () => useContext(AnecCtx);

// L'encadré lui-même : bulle jaune « balle de tennis », légèrement penchée. `scale` : taille relative (affiche carrée ou dense).
export function AnecdoteBox({ fmt, scale = 1, style }: { fmt?: Fmts; scale?: number; style?: CSSProperties }) {
  const a = useAnec();
  const text = txt(fmt, "anec", a.text.trim());
  if (text === "") return null;
  const s = (n: number) => Math.round(n * scale);
  return (
    <div data-anec style={{ position: "relative", flexShrink: 0, margin: `${s(16)}px 0 ${s(6)}px`, background: "#f4ec7a", border: `${Math.max(2, s(3))}px solid #17140f`, borderRadius: s(22), padding: `${s(14)}px ${s(24)}px ${s(16)}px ${s(88)}px`, transform: "rotate(-0.8deg)", boxShadow: `${s(6)}px ${s(6)}px 0 #17140f`, color: "#17140f", textAlign: "left", fontVariantNumeric: "lining-nums", ...style }}>
      <span aria-hidden style={{ position: "absolute", left: s(16), top: "50%", marginTop: -s(29), width: s(58), height: s(58), borderRadius: 99, background: "#fff", border: `${Math.max(2, s(3))}px solid #17140f`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: s(32) }}>🎾</span>
      <div data-fmt="anec-t" style={{ fontFamily: "Archivo, system-ui, sans-serif", fontSize: s(15), fontWeight: 900, letterSpacing: "0.16em", textTransform: "uppercase", marginBottom: s(4) }}>{txt(fmt, "anec-t", a.title.trim() || ANEC_TITLES[0])}</div>
      <div data-fmt="anec" style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: s(25), fontWeight: 700, fontStyle: "italic", lineHeight: 1.25, whiteSpace: "pre-line", overflowWrap: "break-word" }}>{text}</div>
    </div>
  );
}

// Les deux zones de saisie (onglet « Contenu » du studio)
export function AnecdoteFields({ value, onChange }: { value: { title: string; text: string }; onChange: (v: { title: string; text: string }) => void }) {
  return (
    <section>
      <h3 className="m-0 mb-1 text-[11px] font-extrabold uppercase tracking-[.12em] text-muted">Une anecdote (facultatif)</h3>
      <p className="mb-2 mt-0 text-xs text-muted">Un petit mot qui donne envie de lire : un fait marquant, un coup de cœur, une blague d'équipe. Sans nom d'enfant (prénom seulement si ses parents sont d'accord). Elle n'est pas gardée avec l'affiche.</p>
      <div className="mb-2 flex flex-wrap gap-1.5">
        {ANEC_TITLES.map((t) => (
          <button key={t} type="button" aria-pressed={value.title === t} className={`rounded-full border-2 px-3 py-1.5 text-xs font-bold ${value.title === t ? "border-ink bg-ink text-white" : "border-line bg-white text-ink hover:border-ink"}`} onClick={() => onChange({ ...value, title: t })}>{t}</button>
        ))}
      </div>
      <textarea className="w-full rounded-md border-2 border-line bg-white px-2 py-2 text-sm text-ink" rows={5} maxLength={ANEC_MAX} aria-label="Texte de l'anecdote" placeholder="Ex. : Match décidé au super tie-break après 3 h de jeu, et personne n'a lâché !" value={value.text} onChange={(ev) => onChange({ ...value, text: ev.target.value })} />
      <div className="mt-1 text-right text-[11px] text-muted">{value.text.length} / {ANEC_MAX}</div>
    </section>
  );
}

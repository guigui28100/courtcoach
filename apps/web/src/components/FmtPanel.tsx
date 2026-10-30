import { useEffect, useRef, useState } from "react";
import { ElFmt, FMT_COLORS, Fmts } from "./posterFmt";

// Contour rouge autour du texte choisi, SEULEMENT sur l'aperçu (pas dans l'affiche : l'image enregistrée n'a pas de contour)
export const SelOutline = ({ sel }: { sel: string }) => (
  <style>{`.pf-prev [data-fmt]{cursor:pointer}.pf-prev [data-fmt]:hover{outline:2px dotted #b8471f;outline-offset:2px}${sel && /^[a-z0-9-]+$/i.test(sel) ? `.pf-prev [data-fmt="${sel}"]{outline:3px solid #e11d48;outline-offset:3px}` : ""}`}</style>
);

export type FmtItem = { key: string; label: string; move?: boolean; sizeOnly?: boolean; edit?: boolean };

// Panneau « Mise en forme du texte » : on choisit une partie (ou on touche le texte sur l'affiche), puis on règle taille, gras, italique, souligné, alignement, couleur, position.
export function FmtPanel({ items, fmt, onChange, selected, onSelect, title = "🔤 Mise en forme du texte (taille, gras, couleur…)", hint }: { items: FmtItem[]; fmt: Fmts; onChange: (f: Fmts) => void; selected: string; onSelect: (k: string) => void; title?: string; hint?: string }) {
  const [open, setOpen] = useState(false);
  const first = useRef(true);
  useEffect(() => { if (first.current) { first.current = false; return; } if (selected) setOpen(true); }, [selected]); // toucher un texte sur l'affiche ouvre le panneau
  const item = items.find((i) => i.key === selected) ?? items[0];
  const key = item.key;
  const cur: ElFmt = fmt[key] ?? {};
  const set = (patch: Partial<ElFmt>) => onChange({ ...fmt, [key]: { ...cur, ...patch } });
  const size = cur.size ?? 0;
  const tog = (label: string, on: boolean | undefined, f: () => void, st?: React.CSSProperties, name?: string) => (
    <button type="button" aria-label={name} aria-pressed={!!on} onClick={f} style={st} className={`min-h-8 min-w-8 rounded-md border px-2 text-sm ${on ? "border-ink bg-ink text-white" : "border-line bg-white text-ink"}`}>{label}</button>
  );
  const used = (k: string) => (fmt[k] && Object.values(fmt[k]!).some((v) => v !== undefined && v !== 0) ? " ●" : "");
  return (
    <details open={open} onToggle={(x) => setOpen((x.target as HTMLDetailsElement).open)} className="mb-2 rounded-lg border border-line bg-white p-2">
      <summary className="cursor-pointer text-xs font-extrabold text-ink">{title}</summary>
      <p className="mb-1 mt-1 text-xs text-muted">{hint ?? "Touche un texte sur l'affiche (il s'entoure en rouge) ou choisis-le dans la liste, puis règle-le. Réglages gardés dans ce navigateur."}</p>
      <div className="mb-1 flex flex-wrap gap-1">
        {items.map((b) => (
          <button key={b.key} type="button" aria-pressed={key === b.key} onClick={() => onSelect(b.key)} className={`rounded-full border px-2.5 py-1 text-xs font-bold ${key === b.key ? "border-ink bg-ink text-white" : "border-line bg-white text-ink"}`}>{b.label}{used(b.key)}</button>
        ))}
      </div>
      <p className="m-0 mb-1 text-xs font-extrabold text-ink">Texte choisi : {item.label}</p>
      {item.edit && (
        <label className="mb-2 block text-xs font-extrabold text-ink">✏️ Écrire ce texte (Entrée = nouvelle ligne)
          <textarea aria-label={`Texte : ${item.label}`} rows={3} value={cur.text ?? (typeof document !== "undefined" ? document.querySelector(`.pf-prev [data-fmt="${key}"]`)?.textContent ?? "" : "")} onChange={(x) => set({ text: x.target.value })} className="mt-1 w-full rounded-md border-2 border-line bg-white px-2 py-1 text-sm font-normal" />
          {cur.text !== undefined && <button type="button" onClick={() => { const { text: _t, ...rest } = cur; const n = { ...fmt }; if (Object.keys(rest).length) n[key] = rest; else delete n[key]; onChange(n); }} className="mt-1 rounded-md border border-line bg-white px-2 py-1 text-xs font-bold text-ink">↺ Remettre le texte d'origine</button>}
        </label>
      )}
      <div className="flex flex-wrap items-center gap-1">
        <button type="button" aria-label="Plus petit" disabled={size <= -4} onClick={() => set({ size: size - 1 })} className="min-h-8 min-w-8 rounded-md border border-line bg-white text-sm font-extrabold text-ink disabled:opacity-40">A−</button>
        <span className="min-w-14 text-center text-sm font-bold text-ink">{size === 0 ? "normale" : size > 0 ? `+${size}` : size}</span>
        <button type="button" aria-label="Plus grand" disabled={size >= 8} onClick={() => set({ size: size + 1 })} className="min-h-8 min-w-8 rounded-md border border-line bg-white text-sm font-extrabold text-ink disabled:opacity-40">A+</button>
        {!item.sizeOnly && <>
          {tog("G", cur.bold, () => set({ bold: cur.bold === false ? undefined : cur.bold ? false : true }), { fontWeight: 900 }, "Gras")}
          {tog("I", cur.italic, () => set({ italic: cur.italic ? undefined : true }), { fontStyle: "italic" }, "Italique")}
          {tog("S", cur.underline, () => set({ underline: cur.underline ? undefined : true }), { textDecoration: "underline" }, "Souligné")}
          {(["left", "center", "right"] as const).map((a, i) => tog(["⬅", "↔", "➡"][i], cur.align === a, () => set({ align: cur.align === a ? undefined : a }), undefined, ["À gauche", "Centré", "À droite"][i]))}
          <button type="button" aria-label="Monter" onClick={() => set({ dy: (cur.dy ?? 0) - 1 })} className="min-h-8 min-w-8 rounded-md border border-line bg-white text-sm text-ink">⬆</button>
          <button type="button" aria-label="Descendre" onClick={() => set({ dy: (cur.dy ?? 0) + 1 })} className="min-h-8 min-w-8 rounded-md border border-line bg-white text-sm text-ink">⬇</button>
        </>}
        <button type="button" onClick={() => { const n = { ...fmt }; delete n[key]; onChange(n); }} className="min-h-8 rounded-md border border-line bg-white px-2 text-xs font-bold text-ink">↺ Rétablir ce texte (et sa mise en forme)</button>
        <button type="button" onClick={() => onChange({})} className="min-h-8 rounded-md border border-line bg-white px-2 text-xs font-bold text-ink">↺ Tout rétablir</button>
      </div>
      {!item.sizeOnly && (
        <div className="mt-1 flex flex-wrap items-center gap-1" role="group" aria-label="Couleur du texte">
          <span className="text-xs font-bold text-ink">Couleur :</span>
          {FMT_COLORS.map(([c, n]) => <button key={c} type="button" aria-label={n} aria-pressed={cur.color === c} title={n} onClick={() => set({ color: cur.color === c ? undefined : c })} style={{ background: c }} className={`h-7 w-7 rounded-full border-2 ${cur.color === c ? "border-ink ring-2 ring-champagne" : "border-line shadow"}`} />)}
        </div>
      )}
      {item.sizeOnly && <p className="m-0 mt-1 text-xs text-muted">Agrandit ou réduit tous les textes ensemble. Si tu agrandis trop, le bas peut être coupé : regarde l'aperçu.</p>}
    </details>
  );
}

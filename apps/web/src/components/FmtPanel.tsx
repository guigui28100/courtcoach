import { useEffect, useRef, useState } from "react";
import { ElFmt, FMT_COLORS, Fmts } from "./posterFmt";

// Contour rouge autour du texte choisi, SEULEMENT sur l'aperçu (pas dans l'affiche : l'image enregistrée n'a pas de contour)
export const SelOutline = ({ sel }: { sel: string }) => (
  <style>{`.pf-prev [data-fmt]{cursor:pointer}.pf-prev [data-fmt]:hover{outline:2px dotted #b8471f;outline-offset:2px}${sel && /^[a-z0-9-]+$/i.test(sel) ? `.pf-prev [data-fmt="${sel}"]{outline:3px solid #e11d48;outline-offset:3px}` : ""}`}</style>
);

export type FmtItem = { key: string; label: string; move?: boolean; sizeOnly?: boolean; edit?: boolean };

// Panneau « Mise en forme du texte » : on choisit une partie (ou on touche le texte sur l'affiche), puis on règle taille, gras, italique, souligné, alignement, couleur, position.
export function FmtPanel({ items, fmt, onChange, selected, onSelect, title = "🔤 Textes : réécrire, taille, couleur…", hint }: { items: FmtItem[]; fmt: Fmts; onChange: (f: Fmts) => void; selected: string; onSelect: (k: string) => void; title?: string; hint?: string }) {
  const [open, setOpen] = useState(false);
  const first = useRef(true);
  useEffect(() => { if (first.current) { first.current = false; return; } if (selected) setOpen(true); }, [selected]); // toucher un texte sur l'affiche ouvre le panneau
  const item = items.find((i) => i.key === selected) ?? items[0];
  const key = item.key;
  const cur: ElFmt = fmt[key] ?? {};
  const set = (patch: Partial<ElFmt>) => onChange({ ...fmt, [key]: { ...cur, ...patch } });
  const size = cur.size ?? 0;
  const used = (k: string) => (fmt[k] && Object.values(fmt[k]!).some((v) => v !== undefined && v !== 0) ? " ●" : "");
  const live = typeof document !== "undefined" ? document.querySelector(`.pf-prev [data-fmt="${key}"]`)?.textContent ?? "" : "";
  const btn = (label: React.ReactNode, on: boolean | undefined, f: () => void, name: string, st?: React.CSSProperties, off?: boolean) => (
    <button type="button" aria-label={name} title={name} aria-pressed={on === undefined ? undefined : !!on} disabled={off} onClick={f} style={st} className={`grid h-10 min-w-10 place-items-center rounded-lg border-2 px-2 text-base font-bold disabled:opacity-35 ${on ? "border-ink bg-ink text-white" : "border-line bg-white text-ink hover:border-ink"}`}>{label}</button>
  );
  const row = (label: string, children: React.ReactNode) => (
    <div className="grid items-center gap-2 sm:grid-cols-[88px_1fr]"><span className="text-xs font-extrabold uppercase tracking-wide text-muted">{label}</span><div className="flex flex-wrap items-center gap-1.5">{children}</div></div>
  );
  return (
    <details open={open} onToggle={(x) => setOpen((x.target as HTMLDetailsElement).open)} className="mb-2 rounded-2xl border-2 border-line bg-white p-3">
      <summary className="cursor-pointer text-base font-extrabold text-ink">{title}</summary>
      <p className="mb-2 mt-2 text-xs text-muted">{hint ?? "Touche un texte sur l'affiche (il s'entoure en rouge), ou choisis-le ci-dessous. Gardé dans ce navigateur."}</p>
      <label className="block text-xs font-extrabold uppercase tracking-wide text-muted">1 · Quel texte ?
        <select aria-label="Quel texte régler" value={key} onChange={(x) => onSelect(x.target.value)} className="mt-1 w-full rounded-xl border-2 border-line bg-white px-3 py-2 text-sm font-bold normal-case tracking-normal text-ink">
          {items.map((b) => <option key={b.key} value={b.key}>{b.label}{used(b.key)}</option>)}
        </select>
      </label>
      {item.edit && (
        <label className="mt-3 block text-xs font-extrabold uppercase tracking-wide text-muted">2 · Écrire ce texte <span className="font-normal normal-case tracking-normal">(Entrée = nouvelle ligne)</span>
          <textarea aria-label={`Texte : ${item.label}`} rows={3} value={cur.text ?? live} onChange={(x) => set({ text: x.target.value })} className="mt-1 w-full rounded-xl border-2 border-line bg-white px-3 py-2 text-sm font-normal normal-case tracking-normal text-ink" />
          {cur.text !== undefined && <button type="button" onClick={() => { const { text: _t, ...rest } = cur; const n = { ...fmt }; if (Object.keys(rest).length) n[key] = rest; else delete n[key]; onChange(n); }} className="mt-1 rounded-lg border-2 border-line bg-white px-2 py-1 text-xs font-bold normal-case tracking-normal text-ink hover:border-ink">↺ Remettre le texte d'origine</button>}
        </label>
      )}
      <div className="mt-3 grid gap-2 rounded-xl bg-[#fbf8f2] p-3">
        <p className="m-0 text-xs font-extrabold uppercase tracking-wide text-muted">{item.edit ? "3" : "2"} · Mise en forme <span className="font-normal normal-case tracking-normal">: {item.label}</span></p>
        {row("Taille", <>
          {btn("A−", undefined, () => set({ size: size - 1 }), "Plus petit", undefined, size <= -4)}
          <span className="min-w-16 text-center text-sm font-bold text-ink">{size === 0 ? "normale" : size > 0 ? `+${size}` : size}</span>
          {btn("A+", undefined, () => set({ size: size + 1 }), "Plus grand", undefined, size >= 8)}
        </>)}
        {!item.sizeOnly && <>
          {row("Style", <>
            {btn("G", cur.bold, () => set({ bold: cur.bold === false ? undefined : cur.bold ? false : true }), "Gras", { fontWeight: 900 })}
            {btn("I", cur.italic, () => set({ italic: cur.italic ? undefined : true }), "Italique", { fontStyle: "italic" })}
            {btn("S", cur.underline, () => set({ underline: cur.underline ? undefined : true }), "Souligné", { textDecoration: "underline" })}
          </>)}
          {row("Alignement", (["left", "center", "right"] as const).map((a, i) => <span key={a}>{btn(["⬅", "↔", "➡"][i], cur.align === a, () => set({ align: cur.align === a ? undefined : a }), ["À gauche", "Centré", "À droite"][i])}</span>))}
          {row("Position", <>{btn("⬆", undefined, () => set({ dy: (cur.dy ?? 0) - 1 }), "Monter")}{btn("⬇", undefined, () => set({ dy: (cur.dy ?? 0) + 1 }), "Descendre")}</>)}
          {row("Couleur", <span className="flex flex-wrap gap-1.5" role="group" aria-label="Couleur du texte">{FMT_COLORS.map(([c, n]) => <button key={c} type="button" aria-label={n} aria-pressed={cur.color === c} title={n} onClick={() => set({ color: cur.color === c ? undefined : c })} style={{ background: c }} className={`size-8 rounded-full border-2 ${cur.color === c ? "border-ink ring-2 ring-champagne" : "border-line shadow"}`} />)}</span>)}
        </>}
        {item.sizeOnly && <p className="m-0 text-xs text-muted">Agrandit ou réduit tous les textes ensemble. Si tu agrandis trop, le bas peut être coupé : regarde l'aperçu.</p>}
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        <button type="button" onClick={() => { const n = { ...fmt }; delete n[key]; onChange(n); }} className="rounded-lg border-2 border-line bg-white px-3 py-1.5 text-xs font-bold text-ink hover:border-ink">↺ Rétablir ce texte</button>
        <button type="button" onClick={() => onChange({})} className="rounded-lg border-2 border-line bg-white px-3 py-1.5 text-xs font-bold text-ink hover:border-ink">↺ Tout rétablir</button>
      </div>
    </details>
  );
}

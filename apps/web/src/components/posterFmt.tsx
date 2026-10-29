// Mise en forme du texte des affiches : chaque texte d'une affiche est repéré par un nom (`data-fmt="titre"`…).
// Le coach touche un texte sur l'aperçu (ou le choisit dans la liste) puis règle sa taille, son gras, sa couleur, sa position…
// Les réglages deviennent de simples règles de style écrites DANS l'affiche : l'aperçu, l'image PNG, le PDF et l'impression sont identiques.
export type ElFmt = { size?: number; bold?: boolean; italic?: boolean; underline?: boolean; align?: "left" | "center" | "right"; color?: string; dy?: number };
export type Fmts = Record<string, ElFmt>;

export const FMT_COLORS: [string, string][] = [["#17140f", "Noir"], ["#1b1863", "Bleu nuit"], ["#2E86C1", "Bleu"], ["#1E8449", "Vert"], ["#D35400", "Orange"], ["#C0392B", "Rouge"], ["#8E44AD", "Violet"], ["#B8860B", "Or"], ["#ffffff", "Blanc"]];
export const stepZoom = (n?: number) => 1 + (n ?? 0) * 0.08;

// `noZoom` : les parties dont la taille est déjà gérée par l'affiche elle-même (pas de zoom en plus)
export function fmtCss(fmts: Fmts | undefined, noZoom: string[] = []): string {
  let css = "";
  for (const [k, f] of Object.entries(fmts ?? {})) {
    if (!/^[a-z0-9-]+$/i.test(k) || !f) continue;
    const sel = `[data-fmt="${k}"]`;
    const kids: string[] = [];
    if (f.bold !== undefined) kids.push(`font-weight:${f.bold ? 900 : 400} !important`);
    if (f.italic !== undefined) kids.push(`font-style:${f.italic ? "italic" : "normal"} !important`);
    if (f.underline) kids.push("text-decoration:underline !important");
    if (f.align) kids.push(`text-align:${f.align} !important`);
    if (f.color && /^#[0-9a-f]{3,8}$/i.test(f.color)) kids.push(`color:${f.color} !important`);
    if (kids.length) css += `${sel},${sel} *{${kids.join(";")}}`;
    const own: string[] = [];
    if (f.align) own.push(`justify-content:${f.align === "center" ? "center" : f.align === "right" ? "flex-end" : "flex-start"}`);
    if (f.dy) own.push(`transform:translateY(${f.dy * 8}px)`);
    if (f.size && !noZoom.includes(k) && k !== "tout") own.push(`zoom:${stepZoom(f.size)}`);
    if (own.length) css += `${sel}{${own.join(";")}}`;
  }
  return css;
}

// Les règles de mise en forme, posées DANS l'affiche (donc reprises par l'image, le PDF et l'impression)
export const FmtStyle = ({ fmts, noZoom }: { fmts?: Fmts; noZoom?: string[] }) => {
  const css = fmtCss(fmts, noZoom);
  return css ? <style>{css}</style> : null;
};

// Clic sur un texte de l'aperçu : on remonte jusqu'à la partie repérée la plus proche
export const pickFmt = (ev: { target: EventTarget | null }, onPick?: (k: string) => void) => {
  if (!onPick) return;
  const el = (ev.target as HTMLElement | null)?.closest?.("[data-fmt]");
  const k = el?.getAttribute("data-fmt");
  if (k) onPick(k);
};

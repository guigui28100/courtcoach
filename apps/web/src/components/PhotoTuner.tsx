// Boutons de réglage d'UNE photo d'affiche (les mêmes partout) : déplacer dans le cadre, zoomer, et (si demandé) changer la taille du cadre.
// Rien n'est envoyé : ce sont seulement des nombres gardés avec l'affiche (focus en %, zoom de 1 à 3, taille du cadre de 0,6 à 1,4).
export interface TunePhoto { focus?: [number, number]; zoom?: number; size?: number }
const b = "grid h-10 min-w-10 place-items-center rounded-lg border-2 border-line bg-white px-2 text-base font-bold text-ink hover:border-ink disabled:opacity-30";
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

export function PhotoTuner({ value, onChange, label, withSize = false }: { value: TunePhoto; onChange: (p: TunePhoto) => void; label: string; withSize?: boolean }) {
  const f = value.focus ?? [50, 50], z = value.zoom ?? 1, sz = value.size ?? 1;
  const mv = (dx: number, dy: number) => onChange({ focus: [clamp(f[0] + dx, 0, 100), clamp(f[1] + dy, 0, 100)] });
  return (
    <div className="grid gap-2 rounded-xl border-2 border-ink bg-white p-2" role="group" aria-label={`Réglage de la photo : ${label}`}>
      <p className="m-0 text-sm font-extrabold text-ink">🖼️ Régler la photo</p>
      <div className="flex flex-wrap items-center gap-3">
        <div className="grid grid-cols-3 gap-1">
          <span /><button type="button" className={b} aria-label="Monter la photo" onClick={() => mv(0, 10)}>▲</button><span />
          <button type="button" className={b} aria-label="Photo vers la gauche" onClick={() => mv(10, 0)}>◀</button>
          <button type="button" className={b} aria-label="Tout remettre" title="Tout remettre" onClick={() => onChange({ focus: [50, 50], zoom: 1, size: 1 })}>↺</button>
          <button type="button" className={b} aria-label="Photo vers la droite" onClick={() => mv(-10, 0)}>▶</button>
          <span /><button type="button" className={b} aria-label="Descendre la photo" onClick={() => mv(0, -10)}>▼</button><span />
        </div>
        <div className="grid gap-1">
          <div className="flex items-center gap-1"><span className="w-28 text-xs font-bold text-ink">Zoom (agrandir)</span>
            <button type="button" className={b} aria-label="Photo plus petite" disabled={z <= 1} onClick={() => onChange({ zoom: Math.max(1, Math.round((z - 0.25) * 100) / 100) })}>➖</button>
            <span className="w-12 text-center text-sm font-bold">×{z}</span>
            <button type="button" className={b} aria-label="Agrandir la photo" disabled={z >= 3} onClick={() => onChange({ zoom: Math.min(3, Math.round((z + 0.25) * 100) / 100) })}>➕</button></div>
          {withSize && <div className="flex items-center gap-1"><span className="w-28 text-xs font-bold text-ink">Taille du cadre</span>
            <button type="button" className={b} aria-label="Cadre plus petit" disabled={sz <= 0.6} onClick={() => onChange({ size: Math.max(0.6, Math.round((sz - 0.2) * 10) / 10) })}>➖</button>
            <span className="w-12 text-center text-sm font-bold">{Math.round(sz * 100)} %</span>
            <button type="button" className={b} aria-label="Cadre plus grand" disabled={sz >= 1.4} onClick={() => onChange({ size: Math.min(1.4, Math.round((sz + 0.2) * 10) / 10) })}>➕</button></div>}
        </div>
      </div>
      <p className="m-0 text-xs text-muted">Tu peux aussi glisser la photo directement sur l'affiche.</p>
    </div>
  );
}

// Réglage de la taille des textes d'une affiche : A− / A+ (1 cran = 8 %), « normale » = taille calculée pour remplir l'affiche
export function SizeStepper({ label, value, onChange, min = -4, max = 6 }: { label: string; value: number; onChange: (n: number) => void; min?: number; max?: number }) {
  return (
    <div className="flex flex-wrap items-center gap-1">
      <span className="min-w-36 text-sm font-bold text-ink">{label}</span>
      <button type="button" aria-label={`${label} : plus petit`} disabled={value <= min} onClick={() => onChange(value - 1)} className="min-h-8 min-w-8 rounded-md border border-line bg-white text-sm font-extrabold text-ink disabled:opacity-40">A−</button>
      <span className="min-w-14 text-center text-sm font-bold text-ink">{value === 0 ? "normale" : value > 0 ? `+${value}` : value}</span>
      <button type="button" aria-label={`${label} : plus grand`} disabled={value >= max} onClick={() => onChange(value + 1)} className="min-h-8 min-w-8 rounded-md border border-line bg-white text-sm font-extrabold text-ink disabled:opacity-40">A+</button>
    </div>
  );
}

// Petits éléments graphiques de l'univers « galaxie » (tout est dessiné ici : aucune image ni police extérieure).
export const Stars = () => (<><div className="stars" aria-hidden="true" /><div className="stars stars2" aria-hidden="true" /></>);

// Une balle de tennis qui flotte dans l'espace, avec son anneau
export function Planet({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 220 200" role="img" aria-label="Une balle de tennis qui flotte dans l'espace" className={"planet-float w-full " + className}>
      <defs>
        <radialGradient id="gal-ball" cx="35%" cy="30%" r="78%"><stop offset="0" stopColor="#f8ff9c" /><stop offset="0.55" stopColor="#dcf247" /><stop offset="1" stopColor="#97b215" /></radialGradient>
        <linearGradient id="gal-ring" x1="0" x2="1"><stop offset="0" stopColor="#c4b5fd" /><stop offset="1" stopColor="#60a5fa" /></linearGradient>
      </defs>
      <g transform="rotate(-18 110 102)"><ellipse cx="110" cy="102" rx="98" ry="25" fill="none" stroke="url(#gal-ring)" strokeWidth="6" opacity="0.55" /></g>
      <circle cx="110" cy="100" r="62" fill="url(#gal-ball)" />
      <path d="M62 62 C 96 86 96 114 62 138" fill="none" stroke="#fff" strokeWidth="5" strokeLinecap="round" opacity="0.92" />
      <path d="M158 62 C 124 86 124 114 158 138" fill="none" stroke="#fff" strokeWidth="5" strokeLinecap="round" opacity="0.92" />
      <g transform="rotate(-18 110 102)"><path d="M12 102 A 98 25 0 0 0 208 102" fill="none" stroke="url(#gal-ring)" strokeWidth="6" strokeLinecap="round" /></g>
      {[[28, 30, 7], [196, 44, 5], [182, 168, 6], [34, 160, 4]].map(([x, y, r], i) => (
        <path key={i} d={`M${x} ${y - r} L${x + r / 3} ${y - r / 3} L${x + r} ${y} L${x + r / 3} ${y + r / 3} L${x} ${y + r} L${x - r / 3} ${y + r / 3} L${x - r} ${y} L${x - r / 3} ${y - r / 3} Z`} fill={i % 2 ? "#dcf247" : "#fff"} />
      ))}
    </svg>
  );
}

// Barre de mission : la fusée avance avec la progression, une étoile à 100 %
export function MissionBar({ value, color, label }: { value: number; color: string; label: string }) {
  const v = Math.max(0, Math.min(100, value));
  return (
    <div className="relative pt-5">
      <div role="progressbar" aria-valuenow={v} aria-valuemin={0} aria-valuemax={100} aria-label={label} className="h-3.5 overflow-hidden rounded-full bg-white/15">
        <div className="h-full rounded-full transition-[width] duration-700" style={{ width: `${v}%`, background: `linear-gradient(90deg, ${color}, #dcf247)` }} />
      </div>
      <span aria-hidden="true" className="absolute top-0 text-xl leading-none" style={{ left: `clamp(0px, calc(${v}% - 12px), calc(100% - 24px))` }}>{v >= 100 ? "⭐" : "🚀"}</span>
    </div>
  );
}

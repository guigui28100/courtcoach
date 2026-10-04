import { ReactNode } from "react";

export function PageHead({ eyebrow, title, icon, children }: { eyebrow?: string; title: string; icon?: ReactNode; children?: ReactNode }) {
  return (
    <section className="relative overflow-hidden border-b border-line bg-gradient-to-br from-sand to-[#f6e3d1]">
      <svg viewBox="0 0 200 120" className="pointer-events-none absolute right-6 top-1/2 h-28 w-44 -translate-y-1/2 text-clay/15 max-md:hidden" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="3"><rect x="10" y="10" width="180" height="100" rx="4" /><path d="M100 10v100M10 60h180M45 10v100M155 10v100" /></svg>
      <div className="relative mx-auto flex max-w-6xl items-center gap-4 px-4 py-7">
        {icon}
        <div className="min-w-0">
          {eyebrow && <p className="mb-1 text-xs font-bold uppercase tracking-[0.14em] text-muted">{eyebrow}</p>}
          <h1 className="mb-1">{title}</h1>
          {children && <div className="max-w-2xl text-muted">{children}</div>}
        </div>
      </div>
    </section>
  );
}

const HUES = ["#b8471f", "#2a6fb0", "#2f8f5b", "#7a4cc2", "#c47b00", "#c0306a"];
// Pastille ronde avec les initiales (couleur stable pour une même personne) : aucun nom de famille ni photo
export function Avatar({ name, size = 48 }: { name: string; size?: number }) {
  const ini = name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join("") || "?";
  const hue = HUES[[...name].reduce((n, c) => n + c.charCodeAt(0), 0) % HUES.length];
  return <span aria-hidden="true" className="inline-grid shrink-0 place-items-center rounded-full font-display font-black text-white shadow-sm" style={{ width: size, height: size, background: hue, fontSize: size * 0.4 }}>{ini}</span>;
}

// Case de chiffre clé qui mène à la bonne partie de la page
export function StatTile({ value, label, icon, to, tone = "clay" }: { value: number | string; label: string; icon: string; to?: string; tone?: "clay" | "ok" | "ink" }) {
  const tones = { clay: "bg-[#fdf1ea] text-clay", ok: "bg-[#eaf6ef] text-ok", ink: "bg-[#e8edf6] text-ink" };
  const body = (
    <>
      <span className={"grid h-12 w-12 place-items-center rounded-2xl text-2xl " + tones[tone]} aria-hidden="true">{icon}</span>
      <span className="grid"><strong className="font-display text-3xl font-black leading-none text-ink">{value}</strong><span className="text-sm font-bold text-muted">{label}</span></span>
    </>
  );
  const cls = "card lift flex items-center gap-4 !p-4 no-underline";
  return to ? <a href={to} className={cls}>{body}</a> : <div className={cls}>{body}</div>;
}

// Écran de chargement : des blocs qui brillent doucement, plus agréables qu'un simple « Chargement… »
export function Skeleton({ lines = 3 }: { lines?: number }) {
  return (
    <div className="mx-auto grid max-w-6xl gap-3 px-4 py-8" role="status" aria-label="Chargement en cours">
      <div className="skeleton h-9 w-1/2" />
      {Array.from({ length: lines }, (_, i) => <div key={i} className="skeleton h-20" />)}
    </div>
  );
}

export const Page = ({ children }: { children: ReactNode }) => <div className="mx-auto grid max-w-6xl grid-cols-[minmax(0,1fr)] gap-6 px-4 py-6">{children}</div>;

export function Field({ label, id, children, hint }: { label: string; id: string; children: ReactNode; hint?: string }) {
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {children}
      {hint && <small className="hint">{hint}</small>}
    </div>
  );
}

export const Err = ({ msg }: { msg?: string }) => (msg ? <p role="alert" className="alert-err m-0">{msg}</p> : null);
export const Empty = ({ children }: { children: ReactNode }) => <p className="rounded-2xl border-2 border-dashed border-line bg-white p-6 text-center text-muted">{children}</p>;

export function ProgressBar({ value, color = "#b8471f" }: { value: number; color?: string }) {
  return (
    <div className="h-2 overflow-hidden rounded-full bg-sand" role="progressbar" aria-valuenow={value} aria-valuemin={0} aria-valuemax={100}>
      <div className="h-full rounded-full transition-[width]" style={{ width: `${value}%`, background: color }} />
    </div>
  );
}

import { ReactNode } from "react";
import { Link } from "react-router-dom";

export function PageHead({ eyebrow, title, icon, children }: { eyebrow?: string; title: string; icon?: ReactNode; children?: ReactNode }) {
  return (
    <section className="relative overflow-hidden border-b border-line bg-gradient-to-br from-sand to-[#f6e3d1]">
      <BallArt className="pointer-events-none absolute -right-2 top-1/2 h-32 w-32 -translate-y-1/2 opacity-90 max-md:hidden" />
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
export const hueOf = (name: string) => HUES[[...name].reduce((n, c) => n + c.charCodeAt(0), 0) % HUES.length];
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

// Balle de tennis dessinée en SVG (aucune image extérieure) : dégradé, coutures, reflet, ombre et traits de vitesse
export function BallArt({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 180 160" className={className} aria-hidden="true">
      <defs>
        <radialGradient id="ballg" cx="34%" cy="28%" r="78%"><stop offset="0" stopColor="#f6ff9a" /><stop offset="0.5" stopColor="#dcf247" /><stop offset="1" stopColor="#a3bb16" /></radialGradient>
      </defs>
      <ellipse cx="108" cy="150" rx="44" ry="7" fill="#10203a" opacity="0.16" />
      <g stroke="#fff" strokeWidth="4" strokeLinecap="round" opacity="0.55"><path d="M6 62h30M0 80h38M10 98h28" /></g>
      <circle cx="108" cy="76" r="60" fill="url(#ballg)" />
      <path d="M70 28c32 28 32 66 0 96M146 28c-32 28-32 66 0 96" fill="none" stroke="#fff" strokeWidth="5.5" strokeLinecap="round" opacity="0.95" />
      <ellipse cx="86" cy="44" rx="16" ry="9" fill="#fff" opacity="0.35" transform="rotate(-30 86 44)" />
    </svg>
  );
}

// Bandeau d'accueil du coach : fond bleu nuit, balle, salutation, chiffres et boutons d'action
export function CoachHero({ eyebrow, title, subtitle, chips, actions, tone = "default" }: { eyebrow: string; title: string; subtitle?: ReactNode; chips?: ReactNode; actions?: ReactNode; tone?: "default" | "adultes" | "jeunes" }) {
  const base = { default: "linear-gradient(120deg,#0e1c33 0%,#1b3760 100%)", adultes: "linear-gradient(120deg,#16355f 0%,#2a6fb0 100%)", jeunes: "linear-gradient(120deg,#0e1c33 0%,#1b3760 60%,#93371a 130%)" }[tone];
  return (
    <section className="relative isolate overflow-hidden text-white" style={{ background: `radial-gradient(700px 320px at 88% 10%, rgba(220,242,71,0.22), transparent 62%), radial-gradient(520px 260px at 0% 120%, rgba(184,71,31,0.45), transparent 65%), ${base}` }}>
      <svg className="pointer-events-none absolute inset-0 -z-10 h-full w-full opacity-[0.07]" aria-hidden="true"><defs><pattern id="hero-lines" width="64" height="64" patternUnits="userSpaceOnUse"><path d="M0 63.5h64M63.5 0v64" stroke="#fff" strokeWidth="1" fill="none" /></pattern></defs><rect width="100%" height="100%" fill="url(#hero-lines)" /></svg>
      <div className="mx-auto grid max-w-6xl items-center gap-4 px-4 py-8 sm:py-10 md:grid-cols-[1fr_auto]">
        <div className="grid gap-3">
          <p className="m-0 text-xs font-bold uppercase tracking-[0.18em] text-[#dcf247]">{eyebrow}</p>
          <h1 className="m-0 !text-white">{title}</h1>
          {subtitle && <p className="m-0 max-w-xl text-lg text-white/85">{subtitle}</p>}
          {chips && <div className="flex flex-wrap gap-2">{chips}</div>}
          {actions && <div className="mt-1 flex flex-wrap gap-2">{actions}</div>}
        </div>
        <BallArt className="coach-ball h-40 w-44 justify-self-center max-md:hidden lg:h-48 lg:w-52" />
      </div>
    </section>
  );
}

export const HeroChip = ({ children }: { children: ReactNode }) => <span className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-sm font-bold backdrop-blur">{children}</span>;

// Grande tuile de raccourci (couleur, icône, titre, texte, pastille de nombre)
export function ShortcutTile({ icon, title, text, to, tone, badge }: { icon: string; title: string; text: string; to: string; tone: "yellow" | "clay" | "blue" | "ink"; badge?: number }) {
  const bg = { yellow: "linear-gradient(135deg,#fff3b0,#ffe56a)", clay: "linear-gradient(135deg,#fde3d6,#f6b79a)", blue: "linear-gradient(135deg,#dbe9fb,#a9c8f2)", ink: "linear-gradient(135deg,#dfe5ef,#b8c4d8)" }[tone];
  const cls = "lift relative grid content-start gap-1 rounded-3xl p-4 text-ink no-underline";
  const inner = (
    <>
      <span className="text-4xl" aria-hidden="true">{icon}</span>
      <strong className="font-display text-lg leading-tight">{title}</strong>
      <span className="text-sm text-ink/75">{text}</span>
      {!!badge && <span className="absolute right-3 top-3 grid h-8 min-w-8 place-items-center rounded-full bg-clay px-2 font-display text-sm font-black text-white shadow" aria-label={`${badge} à traiter`}>{badge}</span>}
    </>
  );
  return to.startsWith("#") ? <a href={to} className={cls} style={{ background: bg }}>{inner}</a> : <Link to={to} className={cls} style={{ background: bg }}>{inner}</Link>;
}

// Barre d'onglets collée sous l'en-tête (avec pastille de nombre)
export function TabsBar({ tabs, active, onChange, label }: { tabs: [string, string, number?][]; active: string; onChange: (k: string) => void; label: string }) {
  return (
    <div className="tabbar side">
      <div role="tablist" aria-label={label}>
        {tabs.map(([k, l, n]) => (
          <button key={k} role="tab" aria-selected={active === k} onClick={(e) => { onChange(k); e.currentTarget.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" }); }} className={"min-h-12 whitespace-nowrap border-b-4 px-4 font-bold transition-colors " + (active === k ? "border-clay text-clay" : "border-transparent text-muted hover:text-ink")}>
            {l}{!!n && <b className="ml-1.5 rounded-full bg-clay px-2 py-0.5 text-xs text-white">{n}</b>}
          </button>
        ))}
      </div>
    </div>
  );
}

// Page à deux colonnes sur ordinateur : menu à gauche, contenu à droite (menu en haut sur téléphone)
export const SideLayout = ({ nav, children }: { nav: ReactNode; children: ReactNode }) => (
  <div className="grid gap-4 md:grid-cols-[230px_minmax(0,1fr)] md:items-start md:gap-6">{nav}<div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-6">{children}</div></div>
);

// Qui a saisi : le coach est orange, chaque entraîneur de comité a sa propre couleur (stable, tirée de son identifiant)
export interface Authored { authorId?: string | null; authorName?: string | null; authorRole?: string | null; }
const TRAINER_COLORS = ["#2a6fb0", "#2f8f5b", "#7a4cc2", "#0e7490", "#be185d", "#4d7c0f"];
export function authorColor(a: Authored | null | undefined) {
  if (!a?.authorName) return null;
  if (a.authorRole === "COACH") return "#b8471f";
  let h = 0; for (const ch of a.authorId ?? a.authorName) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return TRAINER_COLORS[h % TRAINER_COLORS.length];
}
export function AuthorBadge({ a, prefix = "Saisi par" }: { a: Authored | null | undefined; prefix?: string }) {
  const c = authorColor(a); if (!c || !a) return null;
  return <span className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-bold" style={{ borderColor: c, color: c, background: `${c}14` }}><span aria-hidden="true" className="h-2.5 w-2.5 rounded-full" style={{ background: c }} />{prefix} {a.authorName}{a.authorRole === "COACH" ? " (coach)" : ""}</span>;
}

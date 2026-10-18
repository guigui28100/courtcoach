import { ReactNode, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

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

// Sépare l'icône (emoji) du texte d'un onglet : le texte revenu à la ligne reste aligné proprement, sous le texte et non sous l'icône
export function TabLabel({ text }: { text: string }) {
  const m = text.match(/^((?:\p{Extended_Pictographic}\ufe0f?(?:\u200d\p{Extended_Pictographic}\ufe0f?)*)+)\s+(.*)$/u);
  if (!m) return <span className="tab-txt">{text}</span>;
  return <><span className="tab-ico" aria-hidden="true">{m[1]}</span><span className="tab-txt">{m[2]}</span></>;
}

// Barre d'onglets collée sous l'en-tête (avec pastille de nombre)
export function TabsBar({ tabs, active, onChange, label, side = true }: { tabs: [string, string, number?][]; active: string; onChange: (k: string) => void; label: string; side?: boolean }) {
  return (
    <div className={side ? "tabbar side" : "tabbar"}>
      <div role="tablist" aria-label={label}>
        {tabs.map(([k, l, n]) => (
          <button key={k} role="tab" aria-selected={active === k} onClick={(e) => { onChange(k); e.currentTarget.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" }); }} className={"min-h-12 whitespace-nowrap border-b-4 px-4 font-bold transition-colors " + (active === k ? "border-clay text-clay" : "border-transparent text-muted hover:text-ink")}>
            <TabLabel text={l} />{!!n && <b className="ml-1.5 rounded-full bg-clay px-2 py-0.5 text-xs text-white">{n}</b>}
          </button>
        ))}
      </div>
    </div>
  );
}

// Page à deux colonnes sur ordinateur : menu à gauche, contenu à droite (menu en haut sur téléphone)
export const SideLayout = ({ nav, children }: { nav: ReactNode; children: ReactNode }) => (
  <div className="grid gap-4 md:grid-cols-[230px_minmax(0,1fr)] md:items-stretch md:gap-6">{nav}<div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-6">{children}</div></div>
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

// Menu déroulant avec « Autre : je l'écris » : on choisit dans la liste ou on écrit sa propre réponse ; la valeur part dans un champ caché
const OTHER = "__autre";
export function SelectOrText({ id, name, options, value, suffix = "", type = "text", maxLength = 100 }: { id: string; name: string; options: string[]; value?: string | number | null; suffix?: string; type?: "text" | "number"; maxLength?: number }) {
  const start = value === null || value === undefined ? "" : String(value);
  const [custom, setCustom] = useState(start !== "" && !options.includes(start));
  const [val, setVal] = useState(start);
  return (
    <div className="grid gap-2">
      <select id={id} className="input" value={custom ? OTHER : val} onChange={(e) => { if (e.target.value === OTHER) { setCustom(true); setVal(""); } else { setCustom(false); setVal(e.target.value); } }}>
        <option value="">Choisir…</option>
        {options.map((o) => <option key={o} value={o}>{o}{suffix}</option>)}
        <option value={OTHER}>✏️ Autre : je l'écris moi-même</option>
      </select>
      {custom && <input type={type} className="input" aria-label="Ma réponse" placeholder="Écris ta réponse ici" maxLength={maxLength} value={val} onChange={(e) => setVal(e.target.value)} />}
      <input type="hidden" name={name} value={val} />
    </div>
  );
}

// Menu déroulant à choix multiples (cases à cocher) ; la valeur est envoyée dans un champ caché, séparée par des virgules
export function MultiSelect({ id, name, options, value, allowOther }: { id: string; name: string; options: string[]; value?: string | null; allowOther?: boolean }) {
  const [extra, setExtra] = useState("");
  const [chosen, setChosen] = useState<string[]>(() => (value ?? "").split(",").map((s) => s.trim()).filter(Boolean));
  const all = [...options, ...chosen.filter((c) => !options.includes(c))]; // une ancienne valeur libre reste cochée
  const add = () => { const v = extra.replace(/,/g, " ").trim(); if (v && !chosen.includes(v)) setChosen((c) => [...c, v]); setExtra(""); };
  const toggle = (o: string) => setChosen((c) => (c.includes(o) ? c.filter((x) => x !== o) : [...c, o]));
  return (
    <details className="relative">
      <summary id={id} className="input flex min-h-12 cursor-pointer list-none items-center justify-between gap-2">
        <span className={chosen.length ? "" : "text-muted"}>{chosen.length ? chosen.join(", ") : "Choisir…"}</span><span aria-hidden="true">▾</span>
      </summary>
      <div className="absolute left-0 right-0 z-20 mt-1 grid gap-1 rounded-2xl border-2 border-line bg-white p-2 shadow-lg">
        {all.map((o) => (
          <label key={o} className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl px-3 hover:bg-sand">
            <input type="checkbox" className="h-5 w-5" checked={chosen.includes(o)} onChange={() => toggle(o)} />{o}
          </label>
        ))}
        {allowOther && (
          <div className="flex gap-2 px-1 pt-1">
            <input className="input !min-h-11" aria-label="Autre : je l'écris moi-même" placeholder="✏️ Autre : je l'écris" maxLength={40} value={extra} onChange={(e) => setExtra(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }} />
            <button type="button" className="btn-outline btn-sm" onClick={add}>Ajouter</button>
          </div>
        )}
      </div>
      <input type="hidden" name={name} value={chosen.join(", ")} />
    </details>
  );
}

// Vrai bouton « retour » : revient à la page d'où l'on vient (avec son onglet) ; si on est arrivé directement sur cette page, va à l'adresse de secours
export function BackLink({ fallback, className, children }: { fallback: string; className?: string; children: ReactNode }) {
  const nav = useNavigate();
  return (
    <Link to={fallback} className={className} onClick={(e) => { e.preventDefault(); if ((window.history.state?.idx ?? 0) > 0) nav(-1); else nav(fallback); }}>{children}</Link>
  );
}

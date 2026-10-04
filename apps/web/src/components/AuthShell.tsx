import { ReactNode, useState } from "react";

// Habillage des pages de connexion : un panneau « terrain de tennis » à gauche, le formulaire à droite (en haut sur téléphone).
export function AuthShell({ eyebrow, title, subtitle, children }: { eyebrow?: string; title: string; subtitle?: ReactNode; children: ReactNode }) {
  return (
    <div className="grid lg:min-h-[calc(100dvh-125px)] lg:grid-cols-[1fr_1.1fr]">
      <aside className="relative overflow-hidden bg-gradient-to-br from-clay to-[#7d2d12] px-6 py-8 text-white lg:px-12 lg:py-14" aria-label="Présentation">
        <svg viewBox="0 0 240 150" className="pointer-events-none absolute -bottom-6 -right-10 w-[22rem] text-white/15 max-lg:hidden" fill="none" stroke="currentColor" strokeWidth="3" aria-hidden="true">
          <rect x="10" y="10" width="220" height="130" rx="6" /><path d="M120 10v130M10 75h220M45 28v94M195 28v94M45 75h150" strokeLinecap="round" />
        </svg>
        <div className="relative grid max-w-md gap-4">
          <span className="grid h-14 w-14 place-items-center rounded-full bg-ball shadow-lg" aria-hidden="true">
            <svg viewBox="0 0 32 32" className="h-9 w-9"><circle cx="16" cy="16" r="15" fill="#dcf247" /><path d="M5 6c6 5 6 15 0 20M27 6c-6 5-6 15 0 20" fill="none" stroke="#10203a" strokeWidth="1.8" strokeLinecap="round" /></svg>
          </span>
          <div>
            <p className="m-0 text-xs font-bold uppercase tracking-[0.16em] text-white/80">Tennis Club Houdan</p>
            <p className="m-0 mt-1 font-display text-3xl font-black leading-tight lg:text-4xl" style={{ fontStretch: "85%" }}>Ton coach analyse ton geste, tu progresses.</p>
          </div>
          <ul className="m-0 grid list-none gap-2.5 p-0 text-white/90 max-lg:hidden">
            {["Tes vidéos et les conseils de ton coach, au même endroit", "Objectifs et bulletins de l'année pour les jeunes du Centre", "Données protégées : aucune publicité, aucun suivi"].map((t) => (
              <li key={t} className="flex items-start gap-2.5"><span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-white/20 text-sm font-bold" aria-hidden="true">✓</span>{t}</li>
            ))}
          </ul>
        </div>
      </aside>

      <section className="grid content-center bg-gradient-to-b from-chalk to-sand/50 px-4 py-8 sm:px-8 lg:py-14">
        <div className="mx-auto grid w-full max-w-md gap-5">
          <header>
            {eyebrow && <p className="mb-1 text-xs font-bold uppercase tracking-[0.14em] text-clay">{eyebrow}</p>}
            <h1 className="mb-1">{title}</h1>
            {subtitle && <p className="m-0 text-muted">{subtitle}</p>}
          </header>
          {children}
        </div>
      </section>
    </div>
  );
}

// Champ mot de passe avec bouton « afficher / masquer » (utile sur téléphone)
export function PasswordInput({ id, name, autoComplete, minLength, required = true }: { id: string; name: string; autoComplete: string; minLength?: number; required?: boolean }) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <input id={id} name={name} type={show ? "text" : "password"} required={required} minLength={minLength} maxLength={128} autoComplete={autoComplete} className="input !pr-24" />
      <button type="button" onClick={() => setShow(!show)} aria-pressed={show} className="absolute right-1.5 top-1/2 min-h-9 -translate-y-1/2 rounded-lg px-3 text-sm font-bold text-clay hover:bg-sand">{show ? "Masquer" : "Afficher"}</button>
    </div>
  );
}

import { ReactNode } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../auth";
import { Role } from "../types";

type NavItem = { to: string; label: string; short?: string; icon: string };
const NAV: Record<Role, NavItem[]> = {
  COACH: [
    { to: "/coach", label: "Accueil", icon: "home" },
    { to: "/coach/adultes", label: "Adultes · Coaching", short: "Adultes", icon: "star" },
    { to: "/coach/centre", label: "Jeunes · Centre", short: "Jeunes", icon: "users" },
    { to: "/coach/securite", label: "Sécurité", icon: "shield" },
  ],
  TRAINER: [
    { to: "/coach/centre", label: "Mes jeunes · Centre", short: "Jeunes", icon: "users" },
    { to: "/coach/securite", label: "Sécurité", icon: "shield" },
  ],
  ADULT: [{ to: "/espace", label: "Mon espace", icon: "home" }],
  GUARDIAN: [{ to: "/suivi", label: "Mon suivi", icon: "star" }],
  YOUTH: [{ to: "/suivi", label: "Mon suivi", icon: "star" }],
};

// Petites icônes dessinées ici (aucune image ni police extérieure)
const ICONS: Record<string, string> = {
  home: "M3 11 12 3l9 8M5 10v10h5v-6h4v6h5V10",
  users: "M16 20v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 10a4 4 0 1 0 0-8 4 4 0 0 0 0 8M22 20v-2a4 4 0 0 0-3-3.9M16 2.1a4 4 0 0 1 0 7.8",
  shield: "M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6l-8-3zM9 12l2 2 4-4",
  star: "m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9L12 3z",
  out: "M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4M10 17l5-5-5-5M15 12H3",
};
const Icon = ({ name }: { name: string }) => <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={ICONS[name]} /></svg>;

export function Brand({ light = false }: { light?: boolean }) {
  return (
    <Link to="/" className={"flex items-center gap-2 font-display text-2xl font-black no-underline " + (light ? "text-[#dcf247]" : "text-clay")} style={{ fontStretch: "80%" }} aria-label="CourtCoach, accueil">
      <svg viewBox="0 0 32 32" className="h-7 w-7" aria-hidden="true">
        <circle cx="16" cy="16" r="15" fill="#dcf247" />
        <path d="M5 6c6 5 6 15 0 20M27 6c-6 5-6 15 0 20" fill="none" stroke="#10203a" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
      CourtCoach
    </Link>
  );
}

export function Layout({ children }: { children: ReactNode }) {
  const { me, logout } = useAuth();
  const nav = useNavigate();
  const items = me ? NAV[me.role] : [];
  const { pathname } = useLocation();
  const galaxy = (me?.role === "YOUTH" && pathname === "/suivi") || ((me?.role === "COACH" || me?.role === "TRAINER") && /^\/coach\/centre\/[^/]+\/apercu$/.test(pathname)) || pathname.includes("/bulletin/"); // univers « galaxie » de l'espace jeune
  const link = ({ isActive }: { isActive: boolean }) =>
    "inline-flex items-center gap-1.5 px-1 py-2.5 font-bold border-b-[3px] no-underline transition-colors " + (galaxy ? (isActive ? "text-white border-[#dcf247]" : "text-white/80 border-transparent hover:text-white") : (isActive ? "text-ink border-clay" : "text-muted border-transparent hover:text-ink"));

  return (
    <div className="flex min-h-dvh flex-col">
      <a href="#contenu" className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:bg-ink focus:p-3 focus:text-white">Aller au contenu</a>
      <header className={"print:hidden sticky top-0 z-40 border-b backdrop-blur " + (galaxy ? "gal-bar border-white/30 shadow-[0_6px_20px_rgba(20,16,80,0.45)]" : "border-line bg-chalk/95")}>
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-2.5">
          <Brand light={galaxy} />
          <nav aria-label="Menu principal" className="hidden items-center gap-6 md:flex">
            {items.map((i) => <NavLink key={i.to} to={i.to} end className={link}><Icon name={i.icon} />{i.label}</NavLink>)}
            {me ? (
              <button className={galaxy ? "btn btn-sm border-2 border-white/70 text-white hover:bg-white hover:text-ink" : "btn-outline btn-sm"} onClick={async () => { await logout(); nav("/"); }}>Se déconnecter</button>
            ) : (
              <Link to="/connexion" className="btn-ink btn-sm no-underline">Connexion</Link>
            )}
          </nav>
          {!me && <Link to="/connexion" className="btn-ink btn-sm no-underline md:hidden">Connexion</Link>}
        </div>
      </header>

      <main id="contenu" className={"flex-1 " + (galaxy ? "galaxy-sky" : "")}><div key={pathname} className="page-in">{children}</div></main>

      {me && (
        <nav aria-label="Menu principal" className={"print:hidden sticky bottom-0 z-40 grid border-t md:hidden " + (galaxy ? "gal-bar border-white/30" : "border-line bg-white/97")} style={{ gridTemplateColumns: `repeat(${items.length + 1}, 1fr)` }}>
          {items.map((i) => (
            <NavLink key={i.to} to={i.to} end className={({ isActive }) => "flex min-h-16 flex-col items-center justify-center gap-0.5 px-1 text-center text-xs font-bold no-underline transition-colors " + (galaxy ? (isActive ? "bg-white/10 text-[#dcf247]" : "text-white/80") : (isActive ? "bg-[#fdf1ea] text-clay" : "text-muted"))}>
              <Icon name={i.icon} />{i.short ?? i.label}
            </NavLink>
          ))}
          <button className={"flex min-h-16 flex-col items-center justify-center gap-0.5 text-xs font-bold " + (galaxy ? "text-white/80" : "text-muted")} onClick={async () => { await logout(); nav("/"); }}><Icon name="out" />Quitter</button>
        </nav>
      )}

      <footer className="print:hidden bg-ink px-4 py-6 text-sm text-white">
        <div className="mx-auto flex max-w-6xl flex-wrap gap-x-6 gap-y-2">
          <p className="m-0 whitespace-nowrap"><strong>Tennis Club Houdan</strong> · CourtCoach</p>
          <p className="m-0">
            Association à but non lucratif · <Link to="/confidentialite" className="underline">Confidentialité</Link>
          </p>
          {me && (me.role === "YOUTH" || me.role === "GUARDIAN") && (
            <p className="m-0 basis-full rounded-lg bg-white/10 px-3 py-2">
              🛡️ Un jeune ne peut échanger qu'avec son coach, à propos de ses analyses. Si quelque chose gêne, parlez-en à un parent ou à un responsable du club.
            </p>
          )}
        </div>
      </footer>
    </div>
  );
}

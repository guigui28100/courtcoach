import { ReactNode } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../auth";
import { Role } from "../types";

const NAV: Record<Role, { to: string; label: string; short?: string }[]> = {
  COACH: [
    { to: "/coach", label: "Espace" },
    { to: "/coach/centre", label: "Centre de compétition jeunes", short: "Centre jeunes" },
  ],
  ADULT: [{ to: "/espace", label: "Mon espace" }],
  GUARDIAN: [{ to: "/suivi", label: "Mon suivi" }],
  YOUTH: [{ to: "/suivi", label: "Mon suivi" }],
};

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
  const galaxy = (me?.role === "YOUTH" && pathname === "/suivi") || (me?.role === "COACH" && /^\/coach\/centre\/[^/]+\/apercu$/.test(pathname)) || pathname.includes("/bulletin/"); // univers « galaxie » de l'espace jeune
  const link = ({ isActive }: { isActive: boolean }) =>
    "px-1 py-2.5 font-bold border-b-[3px] no-underline " + (galaxy ? (isActive ? "text-white border-[#dcf247]" : "text-white/80 border-transparent hover:text-white") : (isActive ? "text-ink border-clay" : "text-muted border-transparent hover:text-ink"));

  return (
    <div className="flex min-h-dvh flex-col">
      <a href="#contenu" className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:bg-ink focus:p-3 focus:text-white">Aller au contenu</a>
      <header className={"print:hidden sticky top-0 z-40 border-b backdrop-blur " + (galaxy ? "border-white/15 bg-[#0a0d2c]/90" : "border-line bg-chalk/95")}>
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-2.5">
          <Brand light={galaxy} />
          <nav aria-label="Menu principal" className="hidden items-center gap-6 md:flex">
            {items.map((i) => <NavLink key={i.to} to={i.to} end className={link}>{i.label}</NavLink>)}
            {me ? (
              <button className={galaxy ? "btn btn-sm border-2 border-white/70 text-white hover:bg-white hover:text-ink" : "btn-outline btn-sm"} onClick={async () => { await logout(); nav("/"); }}>Se déconnecter</button>
            ) : (
              <Link to="/connexion" className="btn-ink btn-sm no-underline">Connexion</Link>
            )}
          </nav>
          {!me && <Link to="/connexion" className="btn-ink btn-sm no-underline md:hidden">Connexion</Link>}
        </div>
      </header>

      <main id="contenu" className={"flex-1 " + (galaxy ? "galaxy-sky" : "")}>{children}</main>

      {me && (
        <nav aria-label="Menu principal" className={"print:hidden sticky bottom-0 z-40 grid border-t md:hidden " + (galaxy ? "border-white/15 bg-[#0a0d2c]/95" : "border-line bg-white/97")} style={{ gridTemplateColumns: `repeat(${items.length + 1}, 1fr)` }}>
          {items.map((i) => (
            <NavLink key={i.to} to={i.to} end className={({ isActive }) => "flex min-h-14 items-center justify-center px-1 text-center text-sm font-bold no-underline " + (galaxy ? (isActive ? "bg-white/10 text-[#dcf247]" : "text-white/80") : (isActive ? "bg-[#fdf1ea] text-clay" : "text-muted"))}>
              {i.short ?? i.label}
            </NavLink>
          ))}
          <button className={"min-h-14 text-sm font-bold " + (galaxy ? "text-white/80" : "text-muted")} onClick={async () => { await logout(); nav("/"); }}>Quitter</button>
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

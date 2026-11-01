import { ReactNode, useEffect, useState } from "react";
import { onPending } from "../api";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../auth";
import { Role } from "../types";
import { ClubLogo } from "./ui";
import { setSidebar, useSubNav } from "./subnav";

type NavItem = { to: string; label: string; short?: string; icon: string };
const NAV: Record<Role, NavItem[]> = {
  COACH: [
    { to: "/coach", label: "Accueil", icon: "home" },
    { to: "/coach/adultes", label: "Adultes · Coaching", short: "Adultes", icon: "star" },
    { to: "/coach/centre", label: "Jeunes · Centre de compétition", short: "Jeunes", icon: "users" },
    { to: "/coach/prof", label: "Ton agenda", short: "Agenda", icon: "star" },
    { to: "/coach/planning-profs", label: "Planning des profs", short: "Profs", icon: "users" },
    { to: "/coach/club", label: "Planning du club", short: "Club", icon: "home" },
    { to: "/coach/club/partenaires", label: "Partenaires (sponsoring)", short: "Sponsors", icon: "star" },
    { to: "/coach/securite", label: "Sécurité", icon: "shield" },
  ],
  TRAINER: [
    { to: "/coach/centre", label: "Mes jeunes · Centre", short: "Jeunes", icon: "users" },
    { to: "/prof", label: "Ton agenda", short: "Agenda", icon: "star" },
    { to: "/coach/securite", label: "Sécurité", icon: "shield" },
  ],
  PRESIDENT: [
    { to: "/president", label: "Cours particuliers", short: "Cours", icon: "star" },
    { to: "/coach/club", label: "Planning du club", short: "Club", icon: "home" },
    { to: "/coach/club/partenaires", label: "Partenaires (sponsoring)", short: "Sponsors", icon: "star" },
    { to: "/coach/securite", label: "Sécurité", icon: "shield" },
  ],
  BUREAU: [
    { to: "/coach/club", label: "Planning du club", short: "Club", icon: "home" },
    { to: "/mot-de-passe", label: "Mon mot de passe", short: "Mot de passe", icon: "shield" },
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
    <Link to="/" className={"flex items-center gap-2.5 no-underline sm:gap-3 " + (light ? "text-white" : "text-ink")} aria-label="CourtCoach, accueil">
      <ClubLogo className={"size-9 sm:size-11 " + (light ? "text-white" : "text-ink")} />
      <span className="grid leading-none">
        <span className={"font-serif text-[1.2rem] font-semibold uppercase tracking-[0.14em] sm:text-[1.55rem] sm:tracking-[0.2em] " + (light ? "text-[#c9ad77]" : "text-ink")}>CourtCoach</span>
        <span className={"mt-1 font-ui text-[0.52rem] font-semibold uppercase tracking-[0.26em] sm:text-[0.6rem] sm:tracking-[0.34em] " + (light ? "text-white/70" : "text-clay")}>Tennis Club Houdan</span>
      </span>
    </Link>
  );
}

// Attente du serveur : un trait qui défile en haut dès que ça tarde, puis un petit message si ça dure (le serveur gratuit s'endort et met quelques secondes à se réveiller).
function NetLoader() {
  const [n, setN] = useState(0), [show, setShow] = useState(false), [slow, setSlow] = useState(false);
  useEffect(() => onPending(setN), []);
  useEffect(() => {
    if (n === 0) { setShow(false); setSlow(false); return; }
    const a = window.setTimeout(() => setShow(true), 250), b = window.setTimeout(() => setSlow(true), 3000);
    return () => { window.clearTimeout(a); window.clearTimeout(b); };
  }, [n]);
  if (!show) return null;
  return (
    <>
      <div className="net-bar print:hidden" aria-hidden="true"><span /></div>
      {slow && <p role="status" className="net-msg print:hidden"><span className="net-spin" aria-hidden="true" /> Un instant, le serveur se réveille…</p>}
    </>
  );
}

export function Layout({ children }: { children: ReactNode }) {
  const { me, logout, viewAs, stopViewAs } = useAuth();
  const nav = useNavigate();
  const items = me ? NAV[me.role] : [];
  const { pathname } = useLocation();
  const galaxy = ((me?.role === "YOUTH" || me?.role === "GUARDIAN") && pathname === "/suivi") || ((me?.role === "COACH" || me?.role === "TRAINER") && /^\/coach\/centre\/[^/]+\/apercu$/.test(pathname)) || pathname.includes("/bulletin/"); // univers « galaxie » de l'espace jeune
  const link = ({ isActive }: { isActive: boolean }) =>
    "inline-flex items-center gap-1.5 whitespace-nowrap px-0.5 py-2.5 border-b-2 no-underline transition-colors " + (galaxy ? "font-bold " + (isActive ? "text-white border-[#c9ad77]" : "text-white/80 border-transparent hover:text-white") : "font-ui text-[0.74rem] font-semibold uppercase tracking-[0.14em] " + (isActive ? "text-ink border-champagne-deep" : "text-muted border-transparent hover:text-ink hover:border-champagne"));

  // Barre de navigation à gauche (ordinateur) pour le coach, les entraîneurs, le président et le bureau, sauf sur le planning du club (calendrier pleine largeur)
  const side = !!me && ["COACH", "TRAINER", "PRESIDENT", "BUREAU"].includes(me.role) && !galaxy && pathname !== "/coach/club";
  useEffect(() => { setSidebar(side); return () => setSidebar(false); }, [side]);
  const sub = useSubNav().items;
  const activeTo = [...items].filter((i) => pathname === i.to || pathname.startsWith(i.to + "/")).sort((a, b) => b.to.length - a.to.length)[0]?.to;
  // Les sous-menus de la barre de gauche sont fermés au départ : un clic sur la rubrique les ouvre, un second clic les ferme
  const [openSub, setOpenSub] = useState<string | null>(null);
  useEffect(() => { setOpenSub((o) => (o === activeTo ? o : null)); }, [activeTo]);
  const sideLink = ({ isActive }: { isActive: boolean }) =>
    "flex items-center gap-3 rounded-sm px-3 py-2.5 font-ui text-sm font-semibold no-underline transition-colors " + (isActive ? "bg-champagne text-ink" : "text-chalk/85 hover:bg-white/10 hover:text-white");

  return (
    <div className="flex min-h-dvh flex-col">
      <NetLoader />
      {viewAs && <div role="status" className="sticky top-0 z-50 flex flex-wrap items-center justify-center gap-3 bg-champagne-soft border-b border-champagne px-4 py-2 text-center font-bold text-ink print:hidden">👀 Aperçu : tu vois l'espace {viewAs.role ? viewAs.name : `de ${viewAs.name}`}, en lecture seule (rien n'est enregistré).<button className="btn-ink btn-sm" onClick={() => { const to = viewAs.role ? "/coach/securite" : "/coach/centre?onglet=entraineurs"; stopViewAs(); window.setTimeout(() => nav(to), 50); }}>Quitter l'aperçu</button></div>}
      <a href="#contenu" className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:bg-ink focus:p-3 focus:text-white">Aller au contenu</a>
      <div className={side ? "flex flex-1 flex-col md:flex-row" : "contents"}>
      {side && me && (
        <aside aria-label="Menu principal" className="print:hidden sticky top-0 hidden h-dvh w-64 shrink-0 flex-col gap-1 overflow-y-auto bg-ink px-3 py-5 text-chalk md:flex">
          <Link to="/" className="mb-4 flex items-center gap-2.5 border-b border-champagne/40 px-2 pb-5 no-underline" aria-label="CourtCoach, accueil">
            <ClubLogo className="size-10 shrink-0 text-white" />
            <span className="grid leading-none"><span className="font-serif text-lg font-semibold uppercase tracking-[0.12em] text-champagne">CourtCoach</span><span className="mt-1 font-ui text-[0.5rem] font-semibold uppercase tracking-[0.22em] text-white/70">Tennis Club Houdan</span></span>
          </Link>
          {items.map((i) => (
            <div key={i.to} className="grid gap-1">
              <NavLink to={i.to} end aria-expanded={sub && activeTo === i.to ? openSub === i.to : undefined}
                onClick={(e) => { if (activeTo === i.to && pathname === i.to && sub) { e.preventDefault(); setOpenSub(openSub === i.to ? null : i.to); } else setOpenSub(i.to); }}
                className={({ isActive }) => sideLink({ isActive: isActive || activeTo === i.to }) + (sub && activeTo === i.to ? " !bg-white/10 !text-champagne" : "")}>
                <Icon name={i.icon} /><span className="min-w-0 flex-1">{i.label}</span>
                {sub && activeTo === i.to && <svg viewBox="0 0 24 24" className={"h-4 w-4 shrink-0 transition-transform " + (openSub === i.to ? "rotate-180" : "")} fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>}
              </NavLink>
              {sub && activeTo === i.to && openSub === i.to && (
                <ul aria-label={"Sections : " + i.label} className="m-0 mb-1 ml-5 grid list-none gap-0.5 border-l border-champagne/40 p-0 pl-2">
                  {sub.map((x) => {
                    const cls = "flex w-full items-center justify-between gap-2 rounded-sm px-3 py-2 text-left font-ui text-[0.82rem] font-semibold no-underline transition-colors " + (x.active ? "bg-champagne text-ink" : "text-chalk/80 hover:bg-white/10 hover:text-white");
                    const inner = <><span className="min-w-0">{x.label}</span>{!!x.count && <b className="shrink-0 rounded-full bg-champagne px-2 text-xs text-ink">{x.count}</b>}</>;
                    return <li key={x.key}>{x.to ? <Link to={x.to} className={cls}>{inner}</Link> : <button type="button" aria-current={x.active ? "page" : undefined} className={cls} onClick={x.onSelect}>{inner}</button>}</li>;
                  })}
                </ul>
              )}
            </div>
          ))}
          <div className="mt-auto border-t border-champagne/40 px-2 pt-4 text-xs text-chalk/70">
            <button className="btn btn-sm w-full border border-white/50 text-white hover:bg-white hover:text-ink" onClick={async () => { await logout(); nav("/"); }}>Se déconnecter</button>
          </div>
        </aside>
      )}
      <div className={side ? "flex min-w-0 flex-1 flex-col" : "contents"}>
      <header className={(side ? "md:hidden " : "") + "print:hidden sticky top-0 z-40 border-b backdrop-blur " + (galaxy ? "gal-bar border-white/30 shadow-[0_6px_20px_rgba(23, 20, 15, 0.45)]" : "border-line bg-chalk/95 shadow-[0_1px_0_rgba(201,173,119,0.45)]")}>
        <div className="mx-auto flex min-h-[72px] max-w-[2400px] items-center justify-between gap-4 px-4 lg:px-10 2xl:px-14">
          <span className="shrink-0 whitespace-nowrap"><Brand light={galaxy} /></span>
          <nav aria-label="Menu principal" className="hidden items-center gap-5 md:flex xl:gap-7">
            {items.map((i) => <NavLink key={i.to} to={i.to} end className={link}><span className="hidden lg:inline-flex"><Icon name={i.icon} /></span>{i.short && i.short !== i.label ? <><span className="2xl:hidden">{i.short}</span><span className="hidden 2xl:inline">{i.label}</span></> : i.label}</NavLink>)}
            {me ? (
              <button className={galaxy ? "btn btn-sm shrink-0 whitespace-nowrap border-2 border-white/70 text-white hover:bg-white hover:text-ink" : "btn-outline btn-sm shrink-0 whitespace-nowrap"} onClick={async () => { await logout(); nav("/"); }}><span className="lg:hidden">Quitter</span><span className="hidden lg:inline">Se déconnecter</span></button>
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
            <NavLink key={i.to} to={i.to} end className={({ isActive }) => "flex min-h-16 flex-col items-center justify-center gap-0.5 px-1 text-center text-xs font-bold no-underline transition-colors " + (galaxy ? (isActive ? "bg-white/10 text-[#c9ad77]" : "text-white/80") : (isActive ? "bg-champagne-soft text-ink" : "text-muted"))}>
              <Icon name={i.icon} />{i.short ?? i.label}
            </NavLink>
          ))}
          <button className={"flex min-h-16 flex-col items-center justify-center gap-0.5 text-xs font-bold " + (galaxy ? "text-white/80" : "text-muted")} onClick={async () => { await logout(); nav("/"); }}><Icon name="out" />Quitter</button>
        </nav>
      )}

      </div>
      </div>

      <footer className="print:hidden border-t-2 border-champagne bg-ink px-4 py-8 lg:px-10 2xl:px-14 text-sm text-chalk/85">
        <div className="mx-auto flex max-w-[2400px] flex-wrap items-center gap-x-8 gap-y-3">
          <p className="m-0 whitespace-nowrap font-serif text-xl font-semibold uppercase tracking-[0.18em] text-champagne">CourtCoach</p>
          <p className="m-0 whitespace-nowrap"><strong className="font-semibold text-chalk">Tennis Club Houdan</strong></p>
          <p className="m-0">
            Association à but non lucratif · <Link to="/confidentialite" className="underline decoration-champagne underline-offset-4">Confidentialité</Link>
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

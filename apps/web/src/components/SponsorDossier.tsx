import type { CSSProperties, ReactNode } from "react";
import { NoBreak } from "./NoBreak";
import { Offer, perkOf, PERKS, Sponsor } from "../sponsors";
import { CourtLines } from "./CourtLines";

// Dossier de présentation à envoyer aux entreprises qui pourraient devenir partenaires : 2 pages A4 dessinées dans le navigateur (rien n'est envoyé sur Internet).
export const SPONSOR_W = 794, SPONSOR_H = 1123;
const FONT = "Archivo, 'Arial Narrow', system-ui, sans-serif";
const NAVY = "#1b1863", CLAY = "#b8471f", GOLD = "#f4c20d", LINE = "#e3e6ee", MUTED = "#5b6477";
const LOGO = "url(/logo-tch.png) center / contain no-repeat";
const EMAIL = "tennisclubhoudan@gmail.com";

const Page = ({ children, style }: { children: ReactNode; style?: CSSProperties }) => (
  <div className="dossier-page" style={{ width: SPONSOR_W, height: SPONSOR_H, background: "#fff", position: "relative", overflow: "hidden", fontFamily: FONT, color: NAVY, breakAfter: "page", display: "flex", flexDirection: "column", WebkitPrintColorAdjust: "exact", printColorAdjust: "exact", ...style }}>{children}</div>
);
const Foot = ({ n }: { n: number }) => (
  <div style={{ height: 64, background: NAVY, color: "#fff", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 48px", fontSize: 14, flex: "0 0 auto" }}>
    <span style={{ display: "flex", alignItems: "center", gap: 12, fontWeight: 900, letterSpacing: "0.2em", color: GOLD }}><span aria-hidden style={{ display: "inline-block", width: 36, height: 36, background: "#fff", WebkitMask: LOGO, mask: LOGO }} />TENNIS CLUB HOUDAN</span>
    <span style={{ whiteSpace: "nowrap" }}>✉️ {EMAIL} · page {n}/2</span>
  </div>
);

export function buildSponsorDossier(offer: Offer, sponsors: Sponsor[]): ReactNode[] {
  const logos = sponsors.filter((s) => s.logo && s.status !== "TERMINE" && s.status !== "A_CONTACTER").slice(0, 10);
  const packs = offer.packs.filter((p) => p.name);
  const cols = packs.length >= 3 ? 3 : Math.max(1, packs.length);
  return [
    // Page 1 : couverture et présentation du club
    <Page key="p1">
      <div style={{ position: "relative", background: `linear-gradient(135deg, ${CLAY}, #7d2d12)`, color: "#fff", padding: "54px 56px 46px", flex: "0 0 auto", overflow: "hidden" }}>
        <svg viewBox="0 0 400 190" style={{ position: "absolute", right: -30, bottom: -28, width: 560, color: "rgba(255,255,255,.16)" }} fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" aria-hidden><CourtLines cx={200} y={8} h={174} netWidth={5} /></svg>
        <div style={{ position: "relative" }}>
          <span role="img" aria-label="Tennis Club Houdan" style={{ display: "inline-block", width: 74, height: 74, verticalAlign: "middle", background: "#fff", WebkitMask: "url(/logo-tch.png) center / contain no-repeat", mask: "url(/logo-tch.png) center / contain no-repeat" }} />
          <div style={{ marginTop: 20, fontSize: 15, fontWeight: 900, letterSpacing: "0.3em", color: GOLD }}>TENNIS CLUB HOUDAN</div>
          <h1 style={{ margin: "10px 0 0", color: "#fff", fontSize: 56, lineHeight: 1.02, fontWeight: 900, letterSpacing: "-0.02em" }}>Devenez partenaire<br />de votre club de tennis</h1>
          <p style={{ margin: "16px 0 0", fontSize: 20, opacity: 0.92 }}>Dossier de présentation · saison en cours</p>
        </div>
      </div>
      <div style={{ flex: 1, padding: "34px 56px 0", display: "flex", flexDirection: "column", justifyContent: "space-evenly", gap: 20, minHeight: 0 }}>
        {offer.intro && <p style={{ margin: 0, fontSize: 22, lineHeight: 1.45, fontWeight: 500, borderLeft: `6px solid ${GOLD}`, paddingLeft: 20 }}>{offer.intro}</p>}
        {offer.facts.length > 0 && (
          <div>
            <div style={{ fontSize: 14, fontWeight: 900, letterSpacing: "0.16em", color: CLAY, marginBottom: 10 }}>LE CLUB EN QUELQUES MOTS</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              {offer.facts.map((f) => <div key={f} style={{ border: `2px solid ${LINE}`, borderLeft: `8px solid ${CLAY}`, borderRadius: 14, padding: "14px 18px", fontSize: 19, fontWeight: 800, lineHeight: 1.25 }}>{f}</div>)}
            </div>
          </div>
        )}
        {logos.length > 0 && (
          <div>
            <div style={{ fontSize: 14, fontWeight: 900, letterSpacing: "0.16em", color: CLAY, marginBottom: 10 }}>ILS NOUS FONT DÉJÀ CONFIANCE</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 14, alignItems: "center" }}>
              {logos.map((s) => <div key={s.id} style={{ width: 130, height: 76, border: `2px solid ${LINE}`, borderRadius: 12, display: "grid", placeItems: "center", padding: 8, background: "#fff" }}><img src={s.logo} alt={s.name} style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }} /></div>)}
            </div>
          </div>
        )}
      </div>
      <Foot n={1} />
    </Page>,
    // Page 2 : ce que le club propose en échange
    <Page key="p2">
      <div style={{ background: NAVY, color: "#fff", padding: "34px 56px 28px", flex: "0 0 auto" }}>
        <div style={{ fontSize: 14, fontWeight: 900, letterSpacing: "0.3em", color: GOLD }}>CE QUE NOUS VOUS PROPOSONS</div>
        <h2 style={{ margin: "8px 0 0", color: "#fff", fontSize: 40, lineHeight: 1.05, fontWeight: 900 }}>Votre soutien, notre visibilité</h2>
      </div>
      <div style={{ height: 8, background: `linear-gradient(90deg, ${CLAY}, ${GOLD})`, flex: "0 0 auto" }} />
      <div style={{ flex: 1, padding: "26px 56px 0", display: "flex", flexDirection: "column", justifyContent: "space-evenly", gap: 18, minHeight: 0 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px 18px" }}>
          {PERKS.map((p) => (
            <div key={p.key} style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
              <span aria-hidden style={{ flex: "0 0 40px", height: 40, borderRadius: 11, background: "#f3efe6", display: "grid", placeItems: "center", fontSize: 22 }}>{p.icon}</span>
              <div style={{ minWidth: 0 }}><div style={{ fontSize: 16, fontWeight: 900, lineHeight: 1.2 }}>{p.label}</div><div style={{ fontSize: 13, color: MUTED, lineHeight: 1.3, marginTop: 2 }}>{p.hint}</div></div>
            </div>))}
        </div>
        {packs.length > 0 && (
          <div style={{ display: "grid", gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: 14 }}>
            {packs.map((p, i) => (
              <div key={p.name} style={{ border: `3px solid ${i === packs.length - 1 && packs.length > 1 ? GOLD : LINE}`, borderRadius: 18, overflow: "hidden", background: "#fff", display: "flex", flexDirection: "column" }}>
                <div style={{ background: i === packs.length - 1 && packs.length > 1 ? GOLD : NAVY, color: i === packs.length - 1 && packs.length > 1 ? NAVY : "#fff", padding: "12px 14px" }}>
                  <div style={{ fontSize: 20, fontWeight: 900, lineHeight: 1.1 }}>{p.name}</div>
                  <div style={{ fontSize: 15, fontWeight: 800, marginTop: 4 }}>{p.price || "Tarif à définir ensemble"}</div>
                </div>
                <ul style={{ margin: 0, padding: "12px 14px", listStyle: "none", display: "grid", gap: 7, fontSize: 14, lineHeight: 1.25 }}>
                  {p.perks.map((k) => <li key={k} style={{ display: "flex", gap: 8 }}><b style={{ color: "#15803d" }}>✓</b><span>{perkOf(k)?.label ?? k}</span></li>)}
                  {!p.perks.length && <li style={{ color: MUTED }}>Au choix, selon vos envies</li>}
                </ul>
              </div>))}
          </div>
        )}
        <div style={{ background: "#f3efe6", borderRadius: 16, padding: "16px 20px", fontSize: 17, lineHeight: 1.4, textAlign: "center" }}>
          Une idée, une question ? Parlons-en : <b><NoBreak text={EMAIL} /></b><br /><span style={{ fontSize: 14, color: MUTED }}>Les contreparties se règlent ensemble, sur mesure.</span>
        </div>
      </div>
      <Foot n={2} />
    </Page>,
  ];
}

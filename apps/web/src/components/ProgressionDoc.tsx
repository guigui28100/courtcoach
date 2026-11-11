import { ReactNode } from "react";
import { ClubLogo } from "./ui";
import { BILAN_LEVELS, bilanByDomain, DOMAINS, Group, KIND_LABEL, levelDef, parseSkills, PHASES, phaseOf, seasonLabel, Session, sessionColor, sessionDomain, THEMES } from "../progression";

// Documents A4 du prof : couverture, bilan, vue d'ensemble, puis UNE FICHE PAR SÉANCE. Dessinés ici (aucune image ni police extérieure), imprimables ou enregistrables en PDF.
export const DOC_W = 794, DOC_H = 1123;
const INK = "#16140f", GOLD = "#a8884a", MUT = "#6a645a", PAPER = "#fbf8f1", LINE = "#ddd5c4";
const SERIF = "'Cormorant Garamond', Georgia, serif", SANS = "Archivo, system-ui, sans-serif";

function Frame({ children, n, group, dark = false }: { children: ReactNode; n?: number; group: Group; dark?: boolean }) {
  return (
    <div style={{ width: DOC_W, height: DOC_H, position: "relative", overflow: "hidden", background: dark ? INK : PAPER, color: dark ? "#f1ece0" : INK, fontFamily: SANS, fontSize: 15, lineHeight: 1.45, boxSizing: "border-box", breakAfter: "page", pageBreakAfter: "always" }}>
      <div style={{ height: 8, background: `linear-gradient(90deg, ${GOLD}, #d8c18a, ${GOLD})` }} />
      {children}
      {n !== undefined && (
        <div style={{ position: "absolute", left: 56, right: 56, bottom: 30, display: "flex", justifyContent: "space-between", fontSize: 11, color: MUT, borderTop: `1px solid ${LINE}`, paddingTop: 8, letterSpacing: ".06em", textTransform: "uppercase" }}>
          <span>Tennis Club Houdan · {group.name}</span><span>Page {n}</span>
        </div>
      )}
    </div>
  );
}
const Eyebrow = ({ children, color = GOLD }: { children: ReactNode; color?: string }) => <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: ".22em", textTransform: "uppercase", color }}>{children}</div>;
const Rule = () => <div style={{ width: 70, height: 3, background: GOLD, margin: "14px 0" }} />;

export function CoverPage({ g }: { g: Group }) {
  const L = levelDef(g.level);
  return (
    <Frame group={g} dark>
      <div style={{ position: "absolute", inset: 0, opacity: 0.07, backgroundImage: "repeating-linear-gradient(135deg,#fff 0 1px,transparent 1px 26px)" }} />
      <div style={{ position: "relative", padding: "70px 64px", height: DOC_H - 8, display: "flex", flexDirection: "column" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <ClubLogo className="size-20" /><div style={{ fontFamily: SERIF, fontSize: 26, letterSpacing: ".2em", textTransform: "uppercase", color: "#d8c18a" }}>Tennis Club Houdan</div>
        </div>
        <div style={{ marginTop: 200 }}>
          <Eyebrow color="#d8c18a">Programmation de la saison {seasonLabel()}</Eyebrow>
          <div style={{ fontFamily: SERIF, fontSize: g.name.length > 22 ? 70 : 92, fontWeight: 700, lineHeight: 1, margin: "22px 0 18px", overflowWrap: "anywhere" }}>{g.name}</div>
          <div style={{ width: 110, height: 4, background: GOLD }} />
          <div style={{ marginTop: 22, fontSize: 24, color: "#d9d2c2" }}>{L.key}</div>
          <div style={{ marginTop: 6, fontSize: 16, color: "#a39c8c" }}>{L.age} · {L.terrain} · {L.ball}</div>
        </div>
        <div style={{ marginTop: "auto", display: "flex", gap: 0, borderTop: "1px solid #3b372c", paddingTop: 28 }}>
          {[[String(g.sessions.length), "séances"], [g.size ? String(g.size) : "—", "joueurs"], [`${g.minutes}'`, "par séance"], [String(g.sessions.filter((s) => s.theme).length), "séances de thème"]].map(([v, l], i) => (
            <div key={l} style={{ flex: 1, paddingLeft: i ? 24 : 0, borderLeft: i ? "1px solid #3b372c" : "none" }}>
              <div style={{ fontFamily: SERIF, fontSize: 52, fontWeight: 700, color: "#d8c18a", lineHeight: 1 }}>{v}</div>
              <div style={{ marginTop: 6, fontSize: 12, letterSpacing: ".14em", textTransform: "uppercase", color: "#a39c8c" }}>{l}</div>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 34, fontSize: 12, color: "#8f8878" }}>Document de travail du professeur · ne pas diffuser · aucun nom d'élève</div>
      </div>
    </Frame>
  );
}

// Roue des 4 domaines : niveau moyen du groupe au départ (centre = à acquérir, bord = point fort)
function Wheel({ g, size = 270 }: { g: Group; size?: number }) {
  const data = bilanByDomain(g), c = size / 2, R = size / 2 - 56;
  const pt = (i: number, r: number) => { const a = -Math.PI / 2 + (i * 2 * Math.PI) / 4; return [c + Math.cos(a) * r, c + Math.sin(a) * r]; };
  const poly = data.map((x, i) => pt(i, R * (0.18 + 0.82 * ((x.avg ?? 0) / 3))).join(",")).join(" ");
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label="Niveau du groupe par domaine au départ">
      {[0.25, 0.5, 0.75, 1].map((k) => <polygon key={k} points={data.map((_, i) => pt(i, R * k).join(",")).join(" ")} fill="none" stroke={LINE} strokeWidth={1} />)}
      {data.map((_, i) => <line key={i} x1={c} y1={c} x2={pt(i, R)[0]} y2={pt(i, R)[1]} stroke={LINE} />)}
      <polygon points={poly} fill={GOLD} fillOpacity={0.28} stroke={GOLD} strokeWidth={2.5} />
      {data.map((x, i) => { const [px, py] = pt(i, R + 22); return <text key={x.d.key} x={px} y={py} textAnchor="middle" dominantBaseline="middle" fontSize={12} fontWeight={800} fill={x.d.color} style={{ textTransform: "uppercase", letterSpacing: ".08em" }}>{x.d.label}</text>; })}
    </svg>
  );
}

export function BilanPage({ g, n }: { g: Group; n: number }) {
  const L = levelDef(g.level), data = bilanByDomain(g);
  const count: Record<string, number> = {}; g.sessions.forEach((s) => { if (s.theme) count[s.theme] = (count[s.theme] || 0) + 1; });
  const top = Object.entries(count).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const any = data.some((x) => x.rated.length);
  return (
    <Frame group={g} n={n}>
      <div style={{ padding: "44px 56px 80px" }}>
        <Eyebrow>Étape 1</Eyebrow>
        <div style={{ fontFamily: SERIF, fontSize: 46, fontWeight: 700, lineHeight: 1.05 }}>Bilan de départ</div>
        <Rule />
        <div style={{ display: "grid", gridTemplateColumns: "270px 1fr", gap: 22, alignItems: "center" }}>
          <Wheel g={g} />
          <div>
            <div style={{ fontWeight: 800, marginBottom: 6 }}>Attendu à ce niveau ({L.age})</div>
            <ul style={{ margin: 0, paddingLeft: 18 }}>{L.att.map((a) => <li key={a} style={{ marginBottom: 3 }}>{a}</li>)}</ul>
            {top.length > 0 && <><div style={{ fontWeight: 800, margin: "14px 0 6px" }}>Priorités de la saison</div><div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>{top.map(([t, c]) => <span key={t} style={{ background: THEMES[t] ? DOMAINS.find((d) => d.key === THEMES[t].d)!.color : GOLD, color: "#fff", padding: "3px 10px", fontSize: 13, fontWeight: 700 }}>{t} · {c}</span>)}</div></>}
          </div>
        </div>
        {g.notes.trim() && <div style={{ marginTop: 22, borderLeft: `4px solid ${GOLD}`, background: "#f3ecdc", padding: "12px 16px", fontFamily: SERIF, fontSize: 19, fontStyle: "italic", whiteSpace: "pre-line" }}>« {g.notes.trim()} »</div>}
        <div style={{ marginTop: 22, display: "grid", gap: 14 }}>
          {any ? data.filter((x) => x.rated.length).map(({ d, rated }) => (
            <div key={d.key} style={{ borderTop: `3px solid ${d.color}`, paddingTop: 8 }}>
              <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: ".14em", textTransform: "uppercase", color: d.color, marginBottom: 6 }}>{d.label}</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "5px 28px" }}>
                {rated.map(([t, v]) => (
                  <div key={t} style={{ display: "grid", gridTemplateColumns: "1fr 108px", alignItems: "center", gap: 8, fontSize: 14 }}>
                    <span>{t}</span>
                    <span style={{ display: "flex", gap: 2 }} aria-label={BILAN_LEVELS[v].label}>{BILAN_LEVELS.map((b, i) => <i key={i} style={{ flex: 1, height: 9, background: i <= v ? BILAN_LEVELS[v].color : "#e8e1d0" }} />)}</span>
                  </div>
                ))}
              </div>
            </div>
          )) : <div style={{ color: MUT }}>Le bilan n'a pas été rempli : la programmation part des bases du niveau.</div>}
        </div>
        <div style={{ display: "flex", gap: 14, marginTop: 14, fontSize: 11, color: MUT }}>{BILAN_LEVELS.map((b) => <span key={b.label}><i style={{ display: "inline-block", width: 10, height: 10, background: b.color, marginRight: 5 }} />{b.label}</span>)}</div>
      </div>
    </Frame>
  );
}

export function OverviewPage({ g, n }: { g: Group; n: number }) {
  const S = g.sessions;
  return (
    <Frame group={g} n={n}>
      <div style={{ padding: "44px 56px 80px" }}>
        <Eyebrow>Étape 2</Eyebrow>
        <div style={{ fontFamily: SERIF, fontSize: 46, fontWeight: 700, lineHeight: 1.05 }}>La saison en un coup d'œil</div>
        <Rule />
        <div style={{ display: "flex", height: 14, marginBottom: 8 }}>{DOMAINS.map((d) => { const k = S.filter((s) => sessionDomain(s) === d.key).length; return <div key={d.key} style={{ width: `${(k / Math.max(1, S.filter((s) => s.theme).length)) * 100}%`, background: d.color }} />; })}</div>
        <div style={{ display: "flex", gap: 16, fontSize: 12, marginBottom: 18 }}>{DOMAINS.map((d) => <span key={d.key}><i style={{ display: "inline-block", width: 10, height: 10, background: d.color, marginRight: 5 }} />{d.label} · {S.filter((s) => sessionDomain(s) === d.key).length}</span>)}</div>
        {PHASES.map((ph, p) => (
          <div key={ph} style={{ marginBottom: 16 }}>
            <div style={{ background: INK, color: "#f1ece0", padding: "5px 12px", fontSize: 11, fontWeight: 800, letterSpacing: ".16em", textTransform: "uppercase" }}>{ph} · séances {p * 10 + 1} à {p * 10 + 10}</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 24px" }}>
              {S.slice(p * 10, p * 10 + 10).map((s, k) => { const i = p * 10 + k; return (
                <div key={i} style={{ display: "grid", gridTemplateColumns: "28px 12px 1fr 16px", alignItems: "center", gap: 8, padding: "6px 0", borderBottom: `1px solid ${LINE}`, fontSize: 13.5 }}>
                  <b style={{ fontFamily: SERIF, fontSize: 20 }}>{i + 1}</b><i style={{ width: 10, height: 10, background: sessionColor(s) }} />
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.theme || s.title}</span>
                  <span style={{ width: 13, height: 13, border: `1.5px solid ${MUT}`, display: "inline-block", textAlign: "center", lineHeight: "11px", fontSize: 11 }}>{s.done ? "✓" : ""}</span>
                </div>); })}
            </div>
          </div>
        ))}
      </div>
    </Frame>
  );
}

// UNE page par séance : numéro, phase, titre, pourquoi, compétences à cocher, fil rouge, cadre, notes
export function SessionPage({ g, i, n }: { g: Group; i: number; n: number }) {
  const s: Session = g.sessions[i], L = levelDef(g.level), col = sessionColor(s), dom = sessionDomain(s), ph = phaseOf(i);
  const skills = parseSkills(s.skills);
  return (
    <Frame group={g} n={n}>
      <div style={{ padding: "36px 56px 80px" }}>
        <div style={{ display: "flex", gap: 3, marginBottom: 26 }} aria-label={`Séance ${i + 1} sur ${g.sessions.length}`}>{g.sessions.map((x, k) => <i key={k} style={{ flex: 1, height: k === i ? 14 : 6, alignSelf: "flex-end", background: k === i ? col : x.done ? INK : "#e2dbc9" }} />)}</div>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 22 }}>
          <div style={{ fontFamily: SERIF, fontSize: 150, fontWeight: 700, lineHeight: 0.8, color: col }}>{i + 1}</div>
          <div style={{ paddingBottom: 4 }}>
            <Eyebrow color={col}>Séance {i + 1} sur {g.sessions.length}</Eyebrow>
            <div style={{ marginTop: 6, fontSize: 14, color: MUT }}>{PHASES[ph]} · {dom ? DOMAINS.find((d) => d.key === dom)!.label : KIND_LABEL[s.kind]}</div>
          </div>
        </div>
        <div style={{ fontFamily: SERIF, fontSize: s.title.length > 40 ? 40 : 50, fontWeight: 700, lineHeight: 1.08, marginTop: 24, overflowWrap: "anywhere" }}>{s.title}</div>
        <div style={{ width: 90, height: 4, background: col, margin: "16px 0 12px" }} />
        {s.why && <div style={{ fontFamily: SERIF, fontStyle: "italic", fontSize: 19, color: MUT }}>Pourquoi cette séance : {s.why}.</div>}
        <div style={{ marginTop: 26, fontSize: 12, fontWeight: 800, letterSpacing: ".18em", textTransform: "uppercase", color: col }}>Compétences à travailler</div>
        <div style={{ marginTop: 8, display: "grid", gap: 8 }}>
          {skills.length ? skills.map((c) => <div key={c} style={{ display: "grid", gridTemplateColumns: "22px 1fr", gap: 12, alignItems: "center", fontSize: 18 }}><span style={{ width: 20, height: 20, border: `2px solid ${col}` }} /><span>{c}</span></div>) : <div style={{ color: MUT }}>À compléter.</div>}
        </div>
        {s.fil && <div style={{ marginTop: 22, borderLeft: `5px solid ${GOLD}`, background: "#f3ecdc", padding: "10px 16px" }}><div style={{ fontSize: 11, fontWeight: 800, letterSpacing: ".16em", textTransform: "uppercase", color: GOLD }}>Fil rouge de la séance</div><div style={{ fontSize: 17, marginTop: 2 }}>{s.fil}</div></div>}
        <div style={{ marginTop: 22, display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
          {[["Groupe", `${g.size ? g.size + " joueurs" : "—"}`], ["Durée", `${g.minutes} minutes`], ["Cadre", `${L.ball} · ${L.terrain.split(",")[0].toLowerCase()}`]].map(([a, b]) => <div key={a} style={{ borderTop: `1px solid ${LINE}`, paddingTop: 6 }}><div style={{ fontSize: 10.5, letterSpacing: ".14em", textTransform: "uppercase", color: MUT, fontWeight: 800 }}>{a}</div><div style={{ fontSize: 14 }}>{b}</div></div>)}
        </div>
        <div style={{ marginTop: 26, fontSize: 12, fontWeight: 800, letterSpacing: ".18em", textTransform: "uppercase", color: MUT }}>Mes notes</div>
        <div style={{ marginTop: 6 }}>{s.note.trim() ? <div style={{ fontSize: 16, whiteSpace: "pre-line", lineHeight: "30px", borderBottom: `1px solid ${LINE}` }}>{s.note}</div> : Array.from({ length: 9 }).map((_, k) => <div key={k} style={{ height: 34, borderBottom: `1px solid ${LINE}` }} />)}</div>
        <div style={{ position: "absolute", left: 56, right: 56, bottom: 62, display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 14 }}>
          <span><span style={{ display: "inline-block", width: 20, height: 20, border: `2px solid ${INK}`, verticalAlign: "-4px", marginRight: 8, textAlign: "center", lineHeight: "16px" }}>{s.done ? "✓" : ""}</span>Séance faite</span>
          <span style={{ color: MUT }}>Date : ……… / ……… / ………</span>
        </div>
      </div>
    </Frame>
  );
}

export type DocChoice = "tout" | "programme" | "fiches" | "une" | "plage";
export function buildPages(g: Group, choice: DocChoice, from = 1, to = 30): ReactNode[] {
  const S = g.sessions, sheets = (a: number, b: number, start: number) => { const out: ReactNode[] = []; for (let i = Math.max(0, a); i <= Math.min(S.length - 1, b); i++) out.push(<SessionPage key={"s" + i} g={g} i={i} n={start + out.length} />); return out; };
  const intro = [<CoverPage key="c" g={g} />, <BilanPage key="b" g={g} n={2} />, <OverviewPage key="o" g={g} n={3} />];
  if (choice === "tout") return [...intro, ...sheets(0, S.length - 1, 4)];
  if (choice === "programme") return intro;
  if (choice === "fiches") return sheets(0, S.length - 1, 1);
  return sheets(from - 1, to - 1, 1);
}

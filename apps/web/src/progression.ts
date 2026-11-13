// Progression des séances : catalogue des thèmes, repères par niveau (Galaxie Tennis et adultes) et génération des 30 séances.
// Tout est calculé dans le navigateur par des règles écrites ici (aucune intelligence artificielle, aucun service extérieur).
// Les âges et terrains de la Galaxie sont des repères indicatifs, variables selon les clubs : à confronter aux documents FFT.

export type Domain = "tech" | "tact" | "phys" | "ment";
export const DOMAINS: { key: Domain; label: string; color: string }[] = [
  { key: "tech", label: "Technique", color: "#8a5a1a" },
  { key: "tact", label: "Tactique", color: "#4a6d8f" },
  { key: "phys", label: "Physique", color: "#3f7a56" },
  { key: "ment", label: "Mental", color: "#6f5588" },
];
export const domainOf = (d: Domain) => DOMAINS.find((x) => x.key === d)!;

type Theme = { d: Domain; kw: RegExp; s: [string[], string[], string[]] };
const T = (d: Domain, kw: RegExp, s: [string[], string[], string[]]): Theme => ({ d, kw, s });

export const THEMES: Record<string, Theme> = {
  "Coup droit": T("tech", /coup droit|\bcd\b|forehand/, [
    ["Prise et position de départ", "Armer tôt, épaules de profil", "Frapper la balle devant soi"],
    ["Finir haut vers l'épaule opposée", "Régularité cross et long de ligne", "Replacement après la frappe"],
    ["Direction et profondeur sous pression", "Coup droit en mouvement", "Coup droit d'attaque sur balle courte"]]),
  "Revers": T("tech", /revers|backhand/, [
    ["Prise, épaules de profil, armé", "Contact devant", "Équilibre à la frappe"],
    ["Accompagner et finir haut", "Régularité cross", "Replacement au centre"],
    ["Revers en mouvement", "Revers sous pression", "Revers slicé pour défendre ou varier"]]),
  "Service": T("tech", /service|\bsert\b|servir|2e balle|deuxieme balle/, [
    ["Lancer de balle et position", "Geste en trois temps : armer, lancer, frapper", "Viser le carré"],
    ["Première balle placée", "Deuxième balle sûre", "Rythme et routine avant le service"],
    ["Service dans le match", "Zones visées : T, centre, extérieur", "Enchaîner service et premier coup"]]),
  "Retour de service": T("tech", /retour/, [
    ["Position d'attente active", "Petit armé", "Bloquer devant soi"],
    ["Retour profond au centre", "Se placer selon le service", "Retour croisé"],
    ["Retour agressif sur seconde balle", "Premier coup après le retour", "Choisir le retour selon le serveur"]]),
  "Volée": T("tech", /volee|filet|monte/, [
    ["Raquette devant, poignet ferme", "Pas de grand armé", "Un pas vers la balle"],
    ["Volée de coup droit et de revers", "Placer la volée", "Volée basse"],
    ["Montée et volée dans le jeu", "Volée d'attaque", "Volée de défense au filet"]]),
  "Smash": T("tech", /smash/, [
    ["Reculer en pas chassés", "Main libre vers la balle", "Armer tôt"],
    ["Frapper au point haut", "Viser le carré adverse", "Se replacer"],
    ["Smash après lob dans les points", "Smash de volée", "Choisir de laisser rebondir"]]),
  "Jeu de jambes": T("tech", /jambe|appui|deplac|bouge|bougent|bouger|replac/, [
    ["Pas chassés et petits appuis", "Genoux fléchis", "Pas d'ajustement avant la frappe"],
    ["Appuis avant chaque frappe", "Replacement au centre", "Premier pas réactif"],
    ["Déplacements dans l'échange", "Changements de direction", "Équilibre à la frappe"]]),
  "Défendre": T("tact", /defen|subit|recul/, [
    ["Revenir au centre", "Lober pour souffler", "Jouer haut et profond"],
    ["Défendre en slice et en lift", "Gagner du temps", "Rester dans le point"],
    ["Passer de la défense à l'attaque", "Reconnaître la balle de relance", "Contre-attaquer"]]),
  "Attaquer": T("tact", /attaq|agress|finir le point|conclure/, [
    ["Repérer la balle courte", "Avancer en deux pas", "Frapper devant"],
    ["Attaquer en long de ligne", "Attaquer en croisé", "Terminer près du filet"],
    ["Construire puis conclure le point", "Choisir la bonne attaque", "Ne pas précipiter"]]),
  "Montées au filet": T("tact", /monte|filet/, [
    ["Choisir le bon moment", "Avancer pendant la frappe", "Raquette devant"],
    ["Montée sur balle courte", "Volée placée", "Se replacer après la volée"],
    ["Monter et conclure le point", "Lire le lob adverse", "Smash de suite"]]),
  "Construire le point (régularité)": T("tact", /regularit|constru|garder la balle|balle en jeu|echanges/, [
    ["Garder la balle en jeu", "Viser large", "Compter les échanges"],
    ["8 balles avant d'attaquer", "Viser profond", "Varier les hauteurs"],
    ["Régularité sous score", "Gagner les points importants", "Reprendre la balle en jeu après une erreur"]]),
  "Variations": T("tact", /variation|varier|rythme/, [
    ["Changer de hauteur", "Changer de vitesse", "Annoncer son intention"],
    ["Changer de direction", "Balle lente puis rapide", "Utiliser le slice"],
    ["Surprendre l'adversaire", "Choisir selon l'adversaire", "Varier dans les points"]]),
  "Lecture du jeu": T("tact", /lecture|lire le jeu|anticip/, [
    ["Regarder l'adversaire", "Repérer sa prise et son épaule", "Anticiper la direction"],
    ["Annoncer où va la balle", "Repérer ses habitudes", "Se placer en conséquence"],
    ["Adapter son jeu à l'adversaire", "Exploiter ses points faibles", "Changer de plan"]]),
  "Endurance": T("phys", /endurance|souffle|cardio|fatigu|physique/, [
    ["Circuits courts, effort mesuré", "Récupération entre les efforts", "Respiration"],
    ["Efforts répétés", "Récupération courte entre les points", "Tenir une série"],
    ["Tenir un match entier", "Gérer son énergie", "Terminer fort"]]),
  "Vitesse": T("phys", /vitesse|explosiv|lent|reactif|reaction/, [
    ["Réaction à un signal", "Départs courts", "Appuis rapides"],
    ["Sprint court avec frappe", "Changement de direction", "Premier pas explosif"],
    ["Vitesse d'exécution dans le jeu", "Vitesse de replacement", "Enchaîner vite"]]),
  "Explosivité": T("phys", /explosiv|puissan|detente/, [
    ["Sauts simples", "Réception amortie", "Gainage de base"],
    ["Sauts avec réaction", "Lancers de médecine-ball légers", "Appuis d'impulsion"],
    ["Explosivité dans le geste", "Service explosif", "Smash explosif"]]),
  "Concentration": T("ment", /concentr|attention|distrait|inattenti/, [
    ["Rester attentif 5 minutes", "Un seul objectif par balle", "Regarder la balle jusqu'à l'impact"],
    ["Routine entre les points", "Revenir vite à l'objectif", "Ne pas se laisser distraire"],
    ["Rester concentré quand le score se complique", "Gérer les moments importants", "Revenir à la routine"]]),
  "Routines": T("ment", /routine/, [
    ["Respirer entre les points", "Se donner une consigne", "Rester calme"],
    ["Routine de service", "Routine de retour", "Routine après une erreur"],
    ["Routines dans le match", "Les adapter aux moments difficiles", "Rester régulier"]]),
  "Gestion des émotions": T("ment", /energ|enerv|emotion|colere|stress|pleur|decourag|frustr/, [
    ["Reconnaître ce qui énerve", "Respirer profondément", "Un mot positif"],
    ["Routine après une faute", "Rester calme quand on perd un point", "Parler positivement à soi-même"],
    ["Rebondir après un point perdu", "Accepter une balle litigieuse", "Garder le même comportement à tous les scores"]]),
  "Confiance": T("ment", /confiance|peur|n'ose|n ose|ose pas|timid|hesit/, [
    ["Réussir des cibles faciles", "Se féliciter", "Compter ses réussites"],
    ["Oser jouer son jeu", "Accepter de rater", "Choisir la solution qu'on maîtrise"],
    ["Prendre des risques mesurés", "Jouer ses points forts dans le match", "Rester audacieux quand on est mené"]]),
  "Combativité": T("ment", /combat|lache|abandon|baisse les bras|motiv/, [
    ["Se fixer un objectif par séance", "Aller au bout de l'exercice", "Ne pas abandonner"],
    ["Aller au bout de chaque point", "Garder l'énergie après une erreur", "Encourager son partenaire"],
    ["Ne rien lâcher quand on est mené", "Rester agressif jusqu'à la fin", "Gagner un point difficile"]]),
};
export const THEME_NAMES = Object.keys(THEMES);

// Niveaux : Galaxie Tennis et adultes. `ok` = thèmes proposés à ce niveau ; `core` = thèmes de base toujours programmés.
export type LevelDef = { key: string; age: string; terrain: string; ball: string; att: [string, string, string]; ok: string[]; core: string[]; kids: boolean };
const NOT = (...x: string[]) => THEME_NAMES.filter((n) => !x.includes(n));
export const LEVELS_FFT: LevelDef[] = [
  { key: "Balle violette · 4-6 ans", age: "4 à 6 ans", terrain: "Terrain de 8 à 10 m, filet très bas", ball: "balle violette ou en mousse", kids: true,
    att: ["Lancer, rattraper et se déplacer vers la balle", "Premiers échanges avec rebond", "Jouer avec les autres en respectant une règle simple"],
    ok: ["Coup droit", "Revers", "Jeu de jambes", "Vitesse", "Confiance", "Concentration"], core: ["Coup droit", "Revers", "Jeu de jambes"] },
  { key: "Balle rouge · 5-7 ans", age: "5 à 7 ans", terrain: "Terrain de 12 à 15 m", ball: "balle rouge", kids: true,
    att: ["Maîtriser les trajectoires", "Frapper après le rebond, coup droit puis revers", "Échanger quelques balles avec un partenaire"],
    ok: ["Coup droit", "Revers", "Service", "Jeu de jambes", "Vitesse", "Construire le point (régularité)", "Confiance", "Concentration", "Combativité"], core: ["Coup droit", "Revers", "Jeu de jambes", "Construire le point (régularité)"] },
  { key: "Balle orange · 7-9 ans", age: "7 à 9 ans", terrain: "Terrain de 18 m, filet de 0,80 m", ball: "balle orange", kids: true,
    att: ["Couvrir le terrain : se déplacer et se replacer", "Coup droit et revers enchaînés, premiers services", "Jouer de petits matchs avec le score"],
    ok: NOT("Smash", "Lecture du jeu", "Explosivité"), core: ["Coup droit", "Revers", "Service", "Jeu de jambes", "Construire le point (régularité)"] },
  { key: "Balle verte · 9-12 ans", age: "9 à 12 ans", terrain: "Terrain de 23,77 m", ball: "balle verte", kids: true,
    att: ["Jouer sur grand terrain : service puis échange", "Varier hauteur et direction", "Jouer des points et des matchs complets"],
    ok: THEME_NAMES, core: ["Coup droit", "Revers", "Service", "Retour de service", "Construire le point (régularité)", "Jeu de jambes"] },
  { key: "Balle jaune · 10-14 ans", age: "10 à 14 ans", terrain: "Terrain de 23,77 m, balle normale", ball: "balle jaune", kids: true,
    att: ["Jeu complet : service, retour, attaquer, défendre", "Choisir la bonne solution selon la situation", "Jouer des matchs en compétition"],
    ok: THEME_NAMES, core: ["Service", "Retour de service", "Attaquer", "Défendre", "Construire le point (régularité)", "Concentration"] },
  { key: "Adultes · débutant", age: "Adultes", terrain: "Terrain entier ; balle verte conseillée au début", ball: "balle verte puis jaune", kids: false,
    att: ["Coup droit et revers de base", "Service simple et échanges réguliers", "Premiers points joués"],
    ok: NOT("Smash", "Lecture du jeu", "Combativité", "Explosivité"), core: ["Coup droit", "Revers", "Service", "Construire le point (régularité)", "Jeu de jambes"] },
  { key: "Adultes · intermédiaire", age: "Adultes", terrain: "Terrain entier", ball: "balle jaune", kids: false,
    att: ["Jeu régulier avec direction", "Service et retour fiables", "Premiers schémas tactiques"],
    ok: THEME_NAMES, core: ["Service", "Retour de service", "Construire le point (régularité)", "Volée", "Variations", "Concentration"] },
  { key: "Adultes · compétition", age: "Adultes", terrain: "Terrain entier", ball: "balle jaune", kids: false,
    att: ["Jeu complet et varié", "Gestion du score et de l'adversaire", "Condition physique et mental"],
    ok: THEME_NAMES, core: ["Service", "Retour de service", "Attaquer", "Montées au filet", "Lecture du jeu", "Gestion des émotions", "Endurance"] },
];
export const levelDef = (key: string) => LEVELS_FFT.find((l) => l.key === key) ?? LEVELS_FFT[2];

export const BILAN_LEVELS = [
  { label: "Non maîtrisé", short: "À acquérir", color: "#d64545" },
  { label: "En cours d'acquisition", short: "En cours", color: "#e8920c" },
  { label: "En maîtrise", short: "Acquis", color: "#2c9a5b" },
  { label: "Point fort", short: "Point fort", color: "#897e67" },
];

export type Session = { kind: "bilan" | "etape" | "jeu" | "theme"; theme: string; title: string; skills: string; fil: string; why: string; note: string; done: boolean };
export type Group = { id: string; name: string; level: string; size: number; minutes: number; bilan: Record<string, number>; notes: string; sessions: Session[] };
export const PHASES = ["Les bases", "La consolidation", "La mise en jeu"] as const;
export const phaseOf = (i: number) => (i < 10 ? 0 : i < 20 ? 1 : 2);
export const newId = () => "g" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
// Thèmes cités dans le texte libre du prof (mots-clés)
export function themesInText(text: string): Record<string, number> {
  const t = norm(text), out: Record<string, number> = {};
  for (const n of THEME_NAMES) { const m = t.match(new RegExp(THEMES[n].kw.source, "g")); if (m) out[n] = m.length; }
  return out;
}

// Analyse du texte du prof : pour chaque thème cité, le niveau qui ressort de la phrase (0 à acquérir · 1 en cours · 2 acquis · 3 point fort) et la phrase elle-même
export type Found = { theme: string; level: number; excerpt: string };
const NEG = /mauvais|faute|rate\b|rates\b|rater|ratent|raté|\bmal\b|difficult|manque|faible|probleme|fragile|\bpeu\b|jamais|insuffisant|\blent|irregulier|hesit|n'ose|ose pas|bloque|oublie|enerv|stress|decourag|souvent|trop \w+ |du mal|pas (acquis|assez|maitris|encore|de )/;
const POS = /\bbon\b|\bbonne|\bbien\b|maitris|solide|point fort|a l'aise|\bacquis|excellent|regulier|facilit|progress|\bfort\b/;
const TOP = /point fort|excellent|tres bon|tres bien/;
export function analyseText(text: string, levelKey: string): Found[] {
  const L = levelDef(levelKey), out = new Map<string, Found>();
  const parts = text.split(/[.!?;\n]+/).map((x) => x.trim()).filter(Boolean);
  for (const raw of parts) {
    const tAll = norm(raw), sentNeg = NEG.test(tAll), sentPos = POS.test(tAll);
    for (const clause of raw.split(/\bmais\b|\bet\b|,/i).map((x) => x.trim()).filter(Boolean)) {
      const t = norm(clause);
      for (const n of THEME_NAMES) {
        if (!L.ok.includes(n) || !new RegExp(THEMES[n].kw.source).test(t)) continue;
        // La polarité vient du morceau de phrase ; s'il n'en a pas, de la phrase entière
        let neg = NEG.test(t), pos = POS.test(t);
        if (!neg && !pos) { neg = sentNeg; pos = sentPos; }
        const level = neg ? (pos ? 1 : 0) : pos ? (TOP.test(t) ? 3 : 2) : 1;
        const prev = out.get(n);
        if (!prev || level < prev.level) out.set(n, { theme: n, level, excerpt: clause.length > 110 ? clause.slice(0, 107) + "…" : clause });
      }
    }
  }
  return [...out.values()].sort((a, b) => a.level - b.level);
}

// Poids d'un thème : ce que le bilan montre comme à acquérir + ce que le texte cite + la base du niveau
export function weights(g: Group): Record<string, number> {
  const L = levelDef(g.level), kw = themesInText(g.notes), seen = Object.fromEntries(analyseText(g.notes, g.level).map((f) => [f.theme, f.level])), w: Record<string, number> = {};
  for (const n of THEME_NAMES) {
    if (!L.ok.includes(n)) continue;
    const b = g.bilan[n] ?? seen[n]; let v = 0;
    if (b === 0) v += 3; else if (b === 1) v += 2; else if (b === 2) v += 0.6; else if (b === 3) v += 0.15;
    v += (kw[n] || 0) * 1.5; if (L.core.includes(n)) v += 1;
    if (v > 0) w[n] = v;
  }
  return w;
}

// Pourquoi ce thème est programmé : ce que le prof a noté au bilan, ce qu'il a écrit, ou la base du niveau
export function whyOf(g: Group, theme: string): string {
  const b = g.bilan[theme], kw = themesInText(g.notes)[theme], L = levelDef(g.level);
  const parts: string[] = [];
  if (b !== undefined && b <= 1) parts.push(`bilan : « ${BILAN_LEVELS[b].label.toLowerCase()} »`);
  else if (b === 2) parts.push("bilan : acquis, à consolider");
  if (kw) parts.push("cité dans tes remarques");
  if (L.core.includes(theme)) parts.push("base de ce niveau");
  return parts.length ? parts.join(" · ") : "complète la progression";
}

export function sessionFor(g: Group, theme: string, phase: number, fil: string): Session {
  const th = THEMES[theme], fr = THEMES[fil];
  const skills = th.s[phase].map((x) => "• " + x).join("\n");
  return { kind: "theme", theme, title: `${theme} : ${th.s[phase][0]}`, skills, fil: fr ? `${fil} : ${fr.s[phase][0]}` : fil, why: whyOf(g, theme), note: "", done: false };
}

export function generate(g: Group): Session[] {
  const w = weights(g);
  let ranked = Object.keys(w).sort((a, b) => w[b] - w[a]);
  const L = levelDef(g.level);
  if (!ranked.length) ranked = L.core.slice();
  const main = ranked.filter((n) => THEMES[n].d !== "ment" || w[n] >= 3).slice(0, 10);
  const pool = main.length ? main : ranked.slice(0, 8);
  const total = pool.reduce((a, n) => a + (w[n] || 1), 0);
  const q: Record<string, number> = {}; let used = 0;
  pool.forEach((n) => { q[n] = Math.max(1, Math.round((24 * (w[n] || 1)) / total)); used += q[n]; });
  let i = 0; while (used > 24 && i < 500) { const n = pool[pool.length - 1 - (i % pool.length)]; if (q[n] > 1) { q[n]--; used--; } i++; }
  i = 0; while (used < 24 && i < 500) { q[pool[i % pool.length]]++; used++; i++; }
  const seq: { n: string; pos: number }[] = [];
  pool.forEach((n) => { for (let k = 0; k < q[n]; k++) seq.push({ n, pos: (k + 0.5) / q[n] - (g.bilan[n] === 0 ? 0.08 : 0) + (THEMES[n].d === "tact" ? 0.1 : 0) + (THEMES[n].d === "tech" ? -0.03 : 0) }); });
  seq.sort((a, b) => a.pos - b.pos || (w[b.n] || 0) - (w[a.n] || 0));
  // Fil rouge : les thèmes physique et mental les plus à travailler, sinon des valeurs par défaut
  const fils = Object.keys(w).filter((n) => THEMES[n].d === "phys" || THEMES[n].d === "ment").sort((a, b) => w[b] - w[a]);
  const defaults = L.ok.filter((n) => n === "Jeu de jambes" || n === "Concentration");
  const fr = fils.length ? fils : defaults.length ? defaults : ["Concentration"];
  const bilanSession = (title: string, skills: string): Session => ({ kind: "bilan", theme: "", title, skills, fil: "", why: "", note: "", done: false });
  const jeu = (t: string, skills: string): Session => ({ kind: "jeu", theme: "", title: t, skills, fil: "", why: "", note: "", done: false });
  // Trame des 30 séances : 1 = départ, 10 / 20 = match à thème, 15 = point d'étape, 25 = mise en match, 30 = bilan ; les 24 autres sont les thèmes
  const special: Record<number, Session> = {
    0: bilanSession("Point de départ", "• Situations de référence : on observe sans corriger\n• Noter ce qui est acquis et ce qui ne l'est pas\n• À refaire à la séance 15 et à la séance 30 pour comparer"),
    9: jeu("Match à thème", "• Jeu libre avec une consigne par joueur\n• On observe, on corrige peu"),
    14: { kind: "etape", theme: "", title: "Point d'étape", skills: "• Refaire les situations de la séance 1\n• Comparer avec le départ et adapter la suite", fil: "", why: "", note: "", done: false },
    19: jeu("Match à thème", "• Mini-matchs avec point bonus quand le thème est réussi"),
    24: jeu("Mise en match", "• Sets courts : appliquer ce qui a été travaillé\n• Le groupe s'auto-évalue à la fin"),
    29: bilanSession("Bilan de fin de saison", "• Refaire les situations de départ\n• Écrire ce qui a progressé et ce qui reste à travailler\n• Chaque joueur dit ce qu'il a réussi"),
  };
  const list: Session[] = []; let k = 0;
  for (let i = 0; i < 30; i++) { if (special[i]) list.push(special[i]); else { const s = seq[k]; list.push(sessionFor(g, s.n, phaseOf(i), fr[k % fr.length])); k++; } }
  return list;
}

// Menus déroulants d'une séance : tout est lié au thème choisi
export const compsOf = (theme: string): string[] => (THEMES[theme] ? [...new Set(THEMES[theme].s.flat())] : []);
export const parseSkills = (text: string): string[] => text.split("\n").map((l) => l.replace(/^\s*•\s*/, "").trim()).filter(Boolean);
export const joinSkills = (list: string[]) => list.map((x) => "• " + x).join("\n");
export const titleOptions = (theme: string) => compsOf(theme).map((c) => `${theme} : ${c}`);
// Fil rouge : une compétence d'un thème physique ou mental
export const filOptions = (): string[] => THEME_NAMES.filter((n) => THEMES[n].d === "phys" || THEMES[n].d === "ment").flatMap((n) => THEMES[n].s[0].concat(THEMES[n].s[1], THEMES[n].s[2]).filter((c, i, a) => a.indexOf(c) === i).map((c) => `${n} : ${c}`));

// ——— V2 : consultation et documents ———
export const seasonLabel = (d = new Date()) => { const y = d.getMonth() >= 6 ? d.getFullYear() : d.getFullYear() - 1; return `${y} – ${y + 1}`; };
export const sessionDomain = (s: Session): Domain | null => (s.theme && THEMES[s.theme] ? THEMES[s.theme].d : null);
export const sessionColor = (s: Session) => { const d = sessionDomain(s); return d ? domainOf(d).color : "#a8884a"; };
export const KIND_LABEL: Record<Session["kind"], string> = { bilan: "Bilan", etape: "Point d'étape", jeu: "Match", theme: "Thème" };
export const nextSession = (g: Group) => { const i = g.sessions.findIndex((s) => !s.done); return i < 0 ? g.sessions.length - 1 : i; };
// Niveau moyen du groupe par domaine, d'après le bilan de départ (0 à 3), ou null si rien n'est noté
export function bilanByDomain(g: Group): { d: (typeof DOMAINS)[number]; rated: [string, number][]; avg: number | null }[] {
  const L = levelDef(g.level);
  return DOMAINS.map((d) => { const rated = THEME_NAMES.filter((n) => THEMES[n].d === d.key && L.ok.includes(n) && g.bilan[n] !== undefined).map((n) => [n, g.bilan[n]] as [string, number]); return { d, rated, avg: rated.length ? rated.reduce((a, [, v]) => a + v, 0) / rated.length : null }; });
}

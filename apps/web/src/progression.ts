import { readyBlocks, specialBlocks } from "./lessonKit";
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
    ["Prise semi-fermée et position d'attente", "Orientation des épaules et préparation par le haut", "Plan de frappe et prise de balle tôt"],
    ["Appuis semi-ouverts ou ouverts selon la balle", "Transfert du poids du corps vers l'avant", "Geste ample et relâchement"],
    ["Effet lifté et hauteur de balle", "Vitesse de la tête de raquette", "Reprise d'appuis après la frappe", "Régularité"]]),
  "Revers": T("tech", /revers|backhand/, [
    ["Prise et orientation des épaules", "Rôle de la main gauche", "Préparation par le haut", "Plan de frappe et prise de balle tôt"],
    ["Appuis en ligne et ancrage au sol", "Passage des bras", "Transfert du poids du corps vers l'avant", "Équilibre à la frappe"],
    ["Revers lifté et revers slicé", "Hauteur de frappe et trajectoire", "Reprise d'appuis après la frappe", "Régularité"]]),
  "Service": T("tech", /service|\bsert\b|servir|2e balle|deuxieme balle/, [
    ["Prise marteau", "Position armée au service", "Lancer de balle et équilibre"],
    ["Projection du coude vers le haut et l'avant", "Pronation et mise à niveau de la tête de raquette", "Poussée de la jambe arrière"],
    ["Effet lifté et effet slicé", "Vitesse de la tête de raquette et relâchement", "Dissociation bas du corps / haut du corps", "Régularité"]]),
  "Retour de service": T("tech", /retour/, [
    ["Saut d'allègement", "Préparation courte et orientation des épaules", "Plan de frappe et prise de balle tôt"],
    ["Appuis ouverts ou semi-ouverts", "Ancrage au sol et transfert du poids du corps vers l'avant", "Retour profond"],
    ["Trajectoire du retour selon le service", "Vitesse de la tête de raquette sur seconde balle", "Reprise d'appuis après le retour", "Régularité"]]),
  "Volée": T("tech", /volee|filet|monte/, [
    ["Raquette devant et mise à niveau de la tête de raquette", "Appuis en ligne", "Plan de frappe et prise de balle tôt"],
    ["Appuis relais vers l'avant", "Équilibre et ancrage au sol", "Hauteur de frappe : volée haute et volée basse"],
    ["Volée de placement et trajectoire", "Relâchement et vitesse de la tête de raquette", "Reprise d'appuis après la volée", "Régularité"]]),
  "Smash": T("tech", /smash/, [
    ["Reprise d'appuis vers l'arrière", "Position armée comme au service", "Prise marteau"],
    ["Plan de frappe et hauteur de frappe", "Pronation", "Projection du coude vers le haut et l'avant"],
    ["Poussée de la jambe arrière et saut", "Trajectoire et placement", "Reprise d'appuis après le smash", "Régularité"]]),
  "Jeu de jambes": T("tech", /jambe|appui|deplac|bouge|bougent|bouger|replac/, [
    ["Saut d'allègement", "Appuis fixes et appuis relais", "Pas chassés, croisés et sautés"],
    ["Reprise d'appuis après chaque frappe", "Appuis ouverts, semi-ouverts et en ligne", "Ancrage au sol"],
    ["Transfert du poids du corps vers l'avant", "Dissociation bas du corps / haut du corps", "Équilibre en déplacement"]]),
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
// Vocabulaire technique du prof, rangé par famille : proposé comme objectifs de technique (« Appuis : Saut d'allègement »)
export const TECH_GROUPS: { label: string; items: string[] }[] = [
  { label: "Appuis", items: ["Saut d'allègement", "Reprise d'appuis", "Appuis ouverts", "Appuis semi-ouverts", "Appuis en ligne", "Appuis relais", "Appuis fixes", "Ancrage au sol", "Poussée de la jambe arrière", "Transfert du poids du corps vers l'avant", "Pas chassés", "Pas croisés", "Pas sautés"] },
  { label: "Prises", items: ["Prise fermée", "Prise semi-fermée", "Prise marteau"] },
  { label: "Préparation et geste", items: ["Orientation des épaules", "Préparation par le haut", "Geste ample", "Position armée au service", "Projection du coude vers le haut et l'avant", "Pronation", "Mise à niveau de la tête de raquette", "Dissociation bas du corps / haut du corps", "Forme gestuelle"] },
  { label: "Frappe", items: ["Plan de frappe", "Hauteur de frappe", "Prise de balle tôt", "Œil sur la balle", "Vitesse de la tête de raquette", "Équilibre", "Relâchement", "Régularité"] },
  { label: "Balle", items: ["Effet lifté", "Effet slicé", "Hauteur de balle", "Volume de jeu", "Trajectoire"] },
];
// Vocabulaire tactique du prof : proposé comme objectifs de tactique (« Construire le point : Contre-pied »)
export const TACT_GROUPS: { label: string; items: string[] }[] = [
  { label: "Construire le point", items: ["Jouer dans l'espace libre", "Contre-pied", "Fixation / débordement", "Changement de rythme et / ou d'effets", "Variation"] },
  { label: "Au filet", items: ["Volée de construction", "Volée de finition"] },
  { label: "Gérer le point", items: ["Neutraliser l'adversaire sur situation défavorable"] },
];
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
  { key: "Performance · 15 ans et plus", age: "15 ans et plus", terrain: "Terrain de 23,77 m, balle normale", ball: "balle jaune", kids: true,
    att: ["Individualiser la technique selon le projet de jeu", "Armes offensives et service +1", "Jouer sous pression, fatigue et conditions variables"],
    ok: THEME_NAMES, core: ["Service", "Retour de service", "Attaquer", "Défendre", "Lecture du jeu", "Gestion des émotions"] },
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

import { baseFor, baseLabel } from "./techBase";
// Objectifs techniques par niveau (référentiel « Objectifs techniques par niveau de tennis », Tennis Club 360 : proposition pédagogique, pas la grille officielle FFT).
// Chaque ligne : [domaine du point de repère, objectif]. Les niveaux « Blanc + Violet » et « Jaune initiation + compétition » sont regroupés.
export const LEVEL_TECH: Record<string, [string, string][]> = {
  "Balle violette · 4-6 ans": [
    ["Motricité", "Courir, s'arrêter, changer de direction, s'équilibrer, lancer et attraper"], ["Raquette et balle", "Tenir et orienter la raquette, faire rouler, pousser, toucher une balle"],
    ["Coup droit et revers", "Découvrir les deux côtés du corps, orienter la face de raquette"], ["Service", "Lancer un ballon ou une balle vers une cible, par-dessus l'épaule"],
    ["Volée", "Intercepter une balle lente sans rebond"], ["Lecture", "Observer la trajectoire et se placer derrière la balle"],
    ["Coup droit", "Position de départ, préparation simple, contact devant le corps, orientation"], ["Revers", "Découvrir une frappe du côté revers, contrôler le geste"],
    ["Service", "Lancer au-dessus de la tête, coordonner lancer et frappe"], ["Déplacements", "Avancer vers la balle, s'ajuster, retrouver une position d'attente"],
    ["Échange", "Renvoyer plusieurs balles lentes avec un partenaire"]],
  "Balle rouge · 5-7 ans": [
    ["Coup droit", "Prise adaptée, préparation, rotation, frappe devant, accompagnement"], ["Revers", "Coordination des bras, préparation, contrôle du contact et de la direction"],
    ["Service", "Position de départ, lancer régulier, frappe haute, direction"], ["Retour", "Position d'attente, réaction, préparation courte"],
    ["Volée et smash", "Prise adaptée, interception, découverte de la frappe au-dessus de la tête"], ["Déplacements", "Reprise d'appuis, déplacement latéral, ajustement, replacement"],
    ["Échange", "Régularité, direction, hauteur au-dessus du filet"]],
  "Balle orange · 7-9 ans": [
    ["Coup droit", "Chaîne de coordination, accélération, trajectoire montante, premières variations d'effet"], ["Revers", "Stabilité, contrôle croisé et long de ligne, gestion des hauteurs"],
    ["Service", "Prise continentale à développer, lancer, coordination, précision, deuxième balle"], ["Retour", "Lecture de direction, reprise d'appuis, contrôle de profondeur"],
    ["Volée et smash", "Positionnement, déplacement vers l'avant, frappe compacte, recul sur lob"], ["Déplacements", "Pas chassés et croisés, freinage, appuis ouverts ou semi-ouverts selon la situation"],
    ["Variations", "Lob, approche, défense, premières balles coupées"]],
  "Balle verte · 9-12 ans": [
    ["Coup droit", "Lift, contrôle de profondeur, accélération, adaptation aux balles hautes et basses"], ["Revers", "Régularité, lift, slice d'initiation, défense et changement de direction"],
    ["Service", "Précision, première et deuxième balle, introduction des effets adaptés"], ["Retour", "Retour bloqué ou frappé, adaptation aux vitesses, placement"],
    ["Volée et smash", "Volées hautes et basses, transition vers le filet, smash en déplacement"], ["Déplacements", "Reprise d'appuis synchronisée, replacement, ajustement fin, défense latérale"],
    ["Coups spécifiques", "Lob offensif et défensif, amortie, passing-shot, demi-volée"]],
  "Balle jaune · 10-14 ans": [
    ["Fond de court", "Régularité sous déplacement, profondeur, directions, gestion des effets"], ["Service", "Lancer stable, coordination complète, zones, deuxième balle fiable"],
    ["Retour", "Adaptation aux services adverses, neutralisation, retour offensif"], ["Jeu vers l'avant", "Approche, volée, smash, enchaînement"],
    ["Défense", "Frappe en extension, balles hautes, slice, lob, replacement"], ["Appuis", "Reprise d'appuis, dissociation, accélération et freinage"],
    ["Variations", "Alternance lift et slice, hauteur, vitesse, longueur"],
    ["Fond de court", "Qualité de balle, lift lourd, changements de rythme, frappe en montée"], ["Service", "Variété des zones, slice et kick progressifs, vitesse, deuxième balle sous pression"],
    ["Retour", "Lecture précoce, position avancée ou reculée, neutralisation et agression"], ["Transitions", "Attaque de balle courte, approche, volée de finition"],
    ["Défense", "Neutralisation profonde, contre-attaque, passing, lob"], ["Déplacements", "Premier pas explosif, glissade selon surface et maîtrise, récupération"],
    ["Précision", "Cibles, trajectoires, contrôle sous pression et fatigue"]],
  "Performance · 15 ans et plus": [
    ["Armes offensives", "Optimisation du coup fort, accélération, précision sous pression"], ["Service", "Variations avancées, camouflage, qualité de deuxième balle, enchaînement service +1"],
    ["Retour", "Lecture des indices, choix de position, retour +1"], ["Fond de court", "Qualité de balle à haute intensité, variation d'effets, prise de balle tôt"],
    ["Jeu complet", "Transitions, volées réflexes, smash complexe, amorties et contre-amorties"], ["Déplacements", "Efficacité des appuis, économie gestuelle, adaptation aux surfaces"],
    ["Adaptation", "Technique sous fatigue, stress, adversaires et conditions variables"]],
};
export const levelTech = (key: string) => LEVEL_TECH[key] ?? [];
export const levelDef = (key: string) => LEVELS_FFT.find((l) => l.key === key) ?? LEVELS_FFT[2];

export const BILAN_LEVELS = [
  { label: "Non maîtrisé", short: "À acquérir", color: "#d64545" },
  { label: "En cours d'acquisition", short: "En cours", color: "#e8920c" },
  { label: "En maîtrise", short: "Acquis", color: "#2c9a5b" },
  { label: "Point fort", short: "Point fort", color: "#897e67" },
];

export type Objectives = Record<Domain, string[]>;
export type Block = { n: string; m: number; t: string; goal?: string; org?: string; instr?: string; ok?: string; vars?: string; mat?: string; vigil?: string };
export type Reach = "oui" | "part" | "non";
export type After = { reach?: Partial<Record<Domain, Reach>>; hard?: string; wins?: string; indiv?: string; best?: string; rework?: string };
export type Session = { kind: "bilan" | "etape" | "jeu" | "theme"; theme: string; title: string; skills: string; fil: string; why: string; note: string; done: boolean; obj?: Objectives; blocks?: Block[]; mat?: string; rating?: 1 | 2 | 3; redo?: boolean; date?: string; ready?: boolean; gl?: string[]; after?: After };
export type Attend = "p" | "a" | "r" | "e"; // présent · absent · en retard · excusé
export type Group = { id: string; name: string; level: string; size: number; minutes: number; players?: string[]; appel?: Record<string, Record<string, Attend>>; bilan: Record<string, number>; notes: string; sessions: Session[];
  teacher?: string; age?: string; slot?: string; days?: CourseDay[]; season?: string; diag?: Record<string, number>; diagObs?: Partial<Record<Domain, string>>; playerObs?: Record<string, string>; goals?: AnnualGoal[]; validated?: boolean; checks?: Record<string, Check> };
export type CourseDay = { d: string; from: string; to: string };
export const WEEKDAYS = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];
export const WEEKS = 30;
export const fmtHour = (t: string) => { const [h, m] = t.split(":"); return `${+h} h${m && m !== "00" ? " " + m : ""}`; };
export const minutesBetween = (from: string, to: string) => { const f = (t: string) => { const [h, m] = t.split(":").map(Number); return h * 60 + m; }; const d = f(to) - f(from); return d > 0 ? d : 0; };
// Jours du cours : 1, 2 ou 3 séances par semaine ; la programmation compte 30 semaines
export const perWeek = (g: Group) => Math.max(1, Math.min(3, g.days?.length || 1));
export const sessionCount = (g: Group) => WEEKS * perWeek(g);
export const slotLabel = (g: Group) => (g.days?.length ? g.days.map((x) => `${x.d} ${fmtHour(x.from)} – ${fmtHour(x.to)}`).join(" · ") : g.slot || "");
export const fmtDuration = (min: number) => (min >= 60 ? `${Math.floor(min / 60)} h${min % 60 ? " " + String(min % 60).padStart(2, "0") : ""}` : `${min} min`);
export type AnnualGoal = { id: string; d: Domain; skill: string; finding: string; expected: string; ok: string; prio: 1 | 2 | 3; evalMode: string; theme?: string };
export type Mark = "acquis" | "cours" | "non";
export type Check = { text: string; marks: Record<string, Mark>; scores: Record<string, number> };
export const PHASES = ["Les bases", "La consolidation", "La mise en jeu"] as const;
export const phaseOf = (i: number, n = 30) => (i < n / 3 ? 0 : i < (2 * n) / 3 ? 1 : 2);
export const phaseRange = (p: number, n: number): [number, number] => [Math.round((p * n) / 3), Math.round(((p + 1) * n) / 3)];
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

export function sessionFor(g: Group, theme: string, phase: number, fil: string, occ = 0): Session {
  const th = THEMES[theme], fr = THEMES[fil];
  const comps = th.s[phase], k = occ % comps.length;
  const ordered = [...comps.slice(k), ...comps.slice(0, k)];
  const skills = ordered.map((x) => "• " + x).join("\n");
  const obj: Objectives = { tech: [], tact: [], phys: [], ment: [] };
  obj[th.d] = ordered.slice();
  if (fr && fr.d !== th.d) obj[fr.d] = [fr.s[phase][occ % fr.s[phase].length]];
  return { kind: "theme", theme, title: `${theme} : ${ordered[0]}`, skills, fil: fr ? `${fil} : ${fr.s[phase][occ % fr.s[phase].length]}` : fil, why: whyOf(g, theme), note: "", done: false, obj };
}

export const SPECIAL_KINDS: Record<string, Session> = {
  bilan: { kind: "bilan", theme: "", title: "Bilan", skills: "• Refaire les situations de départ\n• Écrire ce qui a progressé et ce qui reste à travailler", fil: "", why: "", note: "", done: false },
  etape: { kind: "etape", theme: "", title: "Point d'étape", skills: "• Refaire les situations de la première séance\n• Comparer avec le départ et adapter la suite", fil: "", why: "", note: "", done: false },
  jeu: { kind: "jeu", theme: "", title: "Match à thème", skills: "• Jeu libre avec une consigne par joueur\n• On observe, on corrige peu", fil: "", why: "", note: "", done: false },
};
export function generate(g: Group, n = sessionCount(g)): Session[] {
  const w = weights(g);
  let ranked = Object.keys(w).sort((a, b) => w[b] - w[a]);
  const L = levelDef(g.level);
  if (!ranked.length) ranked = L.core.slice();
  const main = ranked.filter((x) => THEMES[x].d !== "ment" || w[x] >= 3).slice(0, n > 40 ? 14 : 10);
  const pool = main.length ? main : ranked.slice(0, 8);
  const T = n - 6; // 6 séances « repères » : départ, matchs, point d'étape, mise en match, bilan de fin
  const total = pool.reduce((a, x) => a + (w[x] || 1), 0);
  const q: Record<string, number> = {}; let used = 0;
  pool.forEach((x) => { q[x] = Math.max(1, Math.round((T * (w[x] || 1)) / total)); used += q[x]; });
  let i = 0; while (used > T && i < 2000) { const x = pool[pool.length - 1 - (i % pool.length)]; if (q[x] > 1) { q[x]--; used--; } i++; }
  i = 0; while (used < T && i < 2000) { q[pool[i % pool.length]]++; used++; i++; }
  // RÉPÉTITION : un thème se travaille par CYCLES de séances de suite sur le même objectif (on ne change pas d'objectif à chaque cours)
  const cl = Math.max(3, Math.min(6, Math.round(n / 8)));
  type Cyc = { n: string; len: number; occ: number; pos: number; ph?: number };
  const cycles: Cyc[] = [];
  pool.forEach((x) => {
    const c = Math.max(1, Math.round(q[x] / cl)); const base = Math.floor(q[x] / c), extra = q[x] % c;
    for (let j = 0; j < c; j++) cycles.push({ n: x, len: base + (j < extra ? 1 : 0), occ: j, pos: (j + 0.5) / c - (g.bilan[x] === 0 ? 0.08 : 0) + (THEMES[x].d === "tact" ? 0.1 : 0) + (THEMES[x].d === "tech" ? -0.03 : 0) });
  });
  cycles.sort((a, b) => a.pos - b.pos || (w[b.n] || 0) - (w[a.n] || 0));
  // On alterne les thèmes : jamais deux cycles du même thème à la suite si on peut l'éviter (on y revient plus tard)
  const ordered: Cyc[] = []; const rest = cycles.slice();
  while (rest.length) { const k = Math.max(0, rest.findIndex((c) => c.n !== ordered[ordered.length - 1]?.n)); ordered.push(rest.splice(k, 1)[0]); }
  const seq: { c: Cyc; r: number }[] = [];
  ordered.forEach((c) => { for (let r = 0; r < c.len; r++) seq.push({ c, r }); });
  // Fil rouge : les thèmes physique et mental les plus à travailler, sinon des valeurs par défaut
  const fils = Object.keys(w).filter((x) => THEMES[x].d === "phys" || THEMES[x].d === "ment").sort((a, b) => w[b] - w[a]);
  const defaults = L.ok.filter((x) => x === "Jeu de jambes" || x === "Concentration");
  const fr = fils.length ? fils : defaults.length ? defaults : ["Concentration"];
  const at = (f: number) => Math.max(1, Math.min(n - 2, Math.round(n * f) - 1));
  const first: Session = { ...SPECIAL_KINDS.bilan, title: "Point de départ", skills: "• Situations de référence : on observe sans corriger\n• Noter ce qui est acquis et ce qui ne l'est pas\n• À refaire à mi-parcours et à la fin pour comparer" };
  const lastS: Session = { ...SPECIAL_KINDS.bilan, title: "Bilan de fin de saison", skills: "• Refaire les situations de départ\n• Écrire ce qui a progressé et ce qui reste à travailler\n• Chaque joueur dit ce qu'il a réussi" };
  const mids: { t: number; s: Session }[] = [
    { t: at(1 / 3), s: { ...SPECIAL_KINDS.jeu } },
    { t: at(1 / 2), s: { ...SPECIAL_KINDS.etape } },
    { t: at(2 / 3), s: { ...SPECIAL_KINDS.jeu, skills: "• Mini-matchs avec point bonus quand le thème est réussi" } },
    { t: at(5 / 6), s: { ...SPECIAL_KINDS.jeu, title: "Mise en match", skills: "• Sets courts : appliquer ce qui a été travaillé\n• Le groupe s'auto-évalue à la fin" } },
  ];
  // Les séances « repères » se posent ENTRE deux cycles (jamais au milieu d'une répétition), au plus près de leur place idéale
  const bounds: number[] = [0]; ordered.forEach((c) => bounds.push(bounds[bounds.length - 1] + c.len));
  const usedB = new Set<number>(); const slotAt = new Map<number, Session>();
  mids.forEach((m, k) => {
    const want = m.t - 1 - k; let best = -1;
    bounds.forEach((bd, bi) => { if (bi === 0 || bi === bounds.length - 1 || usedB.has(bi)) return; if (best < 0 || Math.abs(bd - want) < Math.abs(bounds[best] - want)) best = bi; });
    if (best < 0) best = bounds.findIndex((_, bi) => bi > 0 && !usedB.has(bi)); if (best < 0) return;
    usedB.add(best); slotAt.set(bounds[best], m.s);
  });
  const prep = (x: Session): Session => ({ ...x, blocks: specialBlocks(g, x), ready: true });
  const list: Session[] = [prep(first)]; let pos = 0; let ci = 0;
  seq.forEach((sq) => {
    if (slotAt.has(pos)) list.push(prep({ ...slotAt.get(pos)! }));
    if (sq.c.ph === undefined) sq.c.ph = phaseOf(list.length, n);
    const se = sessionFor(g, sq.c.n, sq.c.ph, fr[sq.c.occ % fr.length], sq.c.occ + Math.floor(sq.c.ph));
    if (sq.c.len > 1) se.why = `Répétition ${sq.r + 1} sur ${sq.c.len} : même objectif que la séance d'avant, pour qu'il s'installe. ${se.why}`;
    se.blocks = readyBlocks(g, se, sq.r, sq.c.len); se.ready = true;
    list.push(se); pos++; ci++;
  });
  if (slotAt.has(pos)) list.push(prep({ ...slotAt.get(pos)! }));
  list.push(prep(lastS));
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
// Domaine d'une séance : celui de son thème ; pour une séance libre, le domaine qui a le plus d'objectifs
export const sessionDomain = (s: Session): Domain | null => {
  if (s.theme && THEMES[s.theme]) return THEMES[s.theme].d;
  if (s.kind !== "theme" || !s.obj) return null;
  const best = DOMAINS.map((d) => [d.key, s.obj![d.key].length] as const).sort((a, b) => b[1] - a[1])[0];
  return best[1] ? best[0] : null;
};
export const sessionColor = (s: Session) => { const d = sessionDomain(s); return d ? domainOf(d).color : "#a8884a"; };
export const KIND_LABEL: Record<Session["kind"], string> = { bilan: "Bilan", etape: "Point d'étape", jeu: "Match", theme: "Thème" };
export const nextSession = (g: Group) => { const i = g.sessions.findIndex((s) => !s.done); return i < 0 ? g.sessions.length - 1 : i; };
// Niveau moyen du groupe par domaine, d'après le bilan de départ (0 à 3), ou null si rien n'est noté
export function bilanByDomain(g: Group): { d: (typeof DOMAINS)[number]; rated: [string, number][]; avg: number | null }[] {
  const L = levelDef(g.level);
  return DOMAINS.map((d) => { const rated = THEME_NAMES.filter((n) => THEMES[n].d === d.key && L.ok.includes(n) && g.bilan[n] !== undefined).map((n) => [n, g.bilan[n]] as [string, number]); return { d, rated, avg: rated.length ? rated.reduce((a, [, v]) => a + v, 0) / rated.length : null }; });
}

// ——— Objectifs de travail par domaine (technique, tactique, physique, mental) et déroulement de la séance ———
export const emptyObj = (): Objectives => ({ tech: [], tact: [], phys: [], ment: [] });
// Objectifs d'une séance : ceux saisis par domaine ; pour une ancienne séance, les compétences sont rangées dans le domaine de son thème
export function objOf(s: Session): Objectives {
  if (s.obj) return { ...emptyObj(), ...s.obj };
  const o = emptyObj(); const d = s.theme && THEMES[s.theme] ? THEMES[s.theme].d : null;
  if (d) o[d] = parseSkills(s.skills);
  const fr = s.fil.split(" : ")[0]; if (THEMES[fr] && THEMES[fr].d !== d) o[THEMES[fr].d] = [s.fil.slice(fr.length + 3) || s.fil];
  return o;
}
export const objCount = (o: Objectives) => DOMAINS.reduce((a, d) => a + o[d.key].length, 0);
// Les anciens champs (skills, fil) restent à jour pour que les documents et la consultation montrent les mêmes objectifs
export function withObj(s: Session, obj: Objectives): Session {
  const all = DOMAINS.flatMap((d) => obj[d.key]);
  const fil = [...obj.phys, ...obj.ment].join(" · ");
  return { ...s, obj, skills: joinSkills(all).slice(0, 900), fil: fil.slice(0, 160) };
}
// Propositions pour un domaine : les compétences du catalogue de ce domaine, sous la forme « Thème : compétence »
export const objectiveOptions = (d: Domain, level: LevelDef): string[] => [
  ...THEME_NAMES.filter((n) => THEMES[n].d === d && level.ok.includes(n)).flatMap((n) => compsOf(n).map((c) => `${n} : ${c}`)),
  ...(d === "tech" ? baseFor(level.key).map((b) => `Référentiel : ${baseLabel(b)}`) : []),
  ...(d === "tech" ? levelTech(level.key).map(([a, t]) => `Niveau · ${a} : ${t}`) : []),
  ...(d === "tech" ? TECH_GROUPS.flatMap((g) => g.items.map((c) => `${g.label} : ${c}`)) : []),
  ...(d === "tact" ? TACT_GROUPS.flatMap((g) => g.items.map((c) => `${g.label} : ${c}`)) : []),
];
export const BLOCK_NAMES = ["Échauffement", "Situation", "Jeu", "Match", "Retour au calme", "Autre"];
export const defaultBlocks = (minutes: number): Block[] => {
  const e = Math.max(5, Math.round(minutes * 0.15 / 5) * 5), c = Math.max(5, Math.round(minutes * 0.1 / 5) * 5), r = minutes - e - c, a = Math.round(r / 2 / 5) * 5;
  return [{ n: "Échauffement", m: e, t: "" }, { n: "Situation", m: a, t: "" }, { n: "Jeu", m: r - a, t: "" }, { n: "Retour au calme", m: c, t: "" }];
};

// Séance créée librement par le prof : un titre, ses objectifs par domaine et son déroulement, sans thème imposé
export const freeSession = (minutes: number): Session => ({ kind: "theme", theme: "", title: "", skills: "", fil: "", why: "Séance créée par moi", note: "", done: false, obj: emptyObj(), blocks: defaultBlocks(minutes) });

// Courte évaluation après la séance : comment elle s'est passée, et si on la reprend
export const RATINGS: { v: 1 | 2 | 3; label: string; icon: string; color: string }[] = [
  { v: 1, label: "À reprendre", icon: "😕", color: "#c2410c" },
  { v: 2, label: "Correcte", icon: "🙂", color: "#a8884a" },
  { v: 3, label: "Très bien", icon: "😃", color: "#2c9a5b" },
];


// ---------- Diagnostic initial du groupe : 4 domaines, des critères notés de 0 à 4 ----------
export const SCALE = ["Pas acquis", "Très fragile", "En cours", "Acquis", "Acquis sous pression"];
export const SCALE_HELP = "0 pas acquis · 1 très fragile · 2 en cours d'acquisition · 3 acquis · 4 acquis même sous pression (en match)";
export type Criterion = { key: string; label: string; theme?: string };
export const DIAG: Record<Domain, Criterion[]> = {
  tech: [
    { key: "t_cd", label: "Coup droit", theme: "Coup droit" }, { key: "t_rv", label: "Revers", theme: "Revers" }, { key: "t_sv", label: "Service", theme: "Service" }, { key: "t_rt", label: "Retour de service", theme: "Retour de service" },
    { key: "t_vs", label: "Volée et smash", theme: "Volée" }, { key: "t_dp", label: "Déplacements et placements", theme: "Jeu de jambes" }, { key: "t_rg", label: "Régularité, précision et maîtrise des trajectoires", theme: "Construire le point (régularité)" },
  ],
  tact: [
    { key: "a_cp", label: "Construction du point", theme: "Construire le point (régularité)" }, { key: "a_sf", label: "Reconnaissance des situations favorables", theme: "Lecture du jeu" }, { key: "a_zt", label: "Choix des zones et des trajectoires", theme: "Variations" },
    { key: "a_od", label: "Gestion des situations offensives et défensives", theme: "Attaquer" }, { key: "a_pd", label: "Prise de décision et adaptation à l'adversaire", theme: "Lecture du jeu" },
  ],
  ment: [
    { key: "m_co", label: "Concentration", theme: "Concentration" }, { key: "m_cf", label: "Confiance", theme: "Confiance" }, { key: "m_em", label: "Gestion des erreurs et des émotions", theme: "Gestion des émotions" },
    { key: "m_cb", label: "Engagement et combativité", theme: "Combativité" }, { key: "m_au", label: "Autonomie et comportement", theme: "Routines" },
  ],
  phys: [
    { key: "p_co", label: "Coordination", theme: "Vitesse" }, { key: "p_eq", label: "Équilibre", theme: "Jeu de jambes" }, { key: "p_vr", label: "Vitesse de réaction", theme: "Vitesse" },
    { key: "p_ag", label: "Agilité et déplacements", theme: "Jeu de jambes" }, { key: "p_en", label: "Endurance et qualités physiques adaptées à l'âge", theme: "Endurance" },
  ],
};
export const critOf = (key: string): { d: Domain; c: Criterion } | null => { for (const d of DOMAINS) { const c = DIAG[d.key].find((x) => x.key === key); if (c) return { d: d.key, c }; } return null; };
const toBilan = (n: number) => (n <= 1 ? 0 : n === 2 ? 1 : n === 3 ? 2 : 3);
// Le diagnostic nourrit la programmation : le niveau d'un thème = le plus bas de ses critères notés (le bilan écrit à la main reste prioritaire)
export function diagBilan(g: Group): Record<string, number> {
  const out: Record<string, number> = {};
  for (const d of DOMAINS) for (const c of DIAG[d.key]) { const v = g.diag?.[c.key]; if (v === undefined || !c.theme) continue; const b = toBilan(v); out[c.theme] = out[c.theme] === undefined ? b : Math.min(out[c.theme], b); }
  return out;
}
export const withDiag = (g: Group): Group => ({ ...g, bilan: { ...diagBilan(g), ...g.bilan } });
export const diagCount = (g: Group) => Object.keys(g.diag || {}).length;
export const diagTotal = () => DOMAINS.reduce((a, d) => a + DIAG[d.key].length, 0);
export const domainAvg = (scores: Record<string, number> | undefined, d: Domain): number | null => { const v = DIAG[d].map((c) => scores?.[c.key]).filter((x): x is number => x !== undefined); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null; };

// ---------- Objectifs annuels proposés d'après le diagnostic (le prof accepte, modifie, supprime ou ajoute) ----------
const OK_DEFAULT: Record<Domain, string> = {
  tech: "Réussit 6 balles sur 10 en situation dirigée, 5 sur 10 à l'échange et 4 sur 10 en opposition",
  tact: "Choisit la bonne solution dans la majorité des points joués en situation d'opposition",
  ment: "Garde le comportement attendu pendant tout le match, y compris après une erreur",
  phys: "Enchaîne les exercices sans perdre la qualité du mouvement",
};
export const newGoalId = () => "o" + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
export function proposeGoals(g: Group): AnnualGoal[] {
  const out: AnnualGoal[] = [];
  for (const d of DOMAINS) {
    const rated = DIAG[d.key].map((c) => ({ c, v: g.diag?.[c.key] })).filter((x): x is { c: Criterion; v: number } => x.v !== undefined && x.v <= 2).sort((a, b) => a.v - b.v).slice(0, 3);
    for (const { c, v } of rated) {
      const obs = (g.diagObs?.[d.key] || "").trim();
      out.push({ id: newGoalId(), d: d.key, skill: c.label, theme: c.theme, finding: `Diagnostic : ${c.label} évalué ${v} sur 4 (${SCALE[v].toLowerCase()})${obs ? `. ${obs.slice(0, 140)}` : ""}`, expected: `${c.label} : niveau « acquis » (3 sur 4) en situation de jeu`, ok: OK_DEFAULT[d.key], prio: v <= 1 ? 1 : 2, evalMode: "Observation en situation de jeu, bilans après les séances 10, 20 et 30" });
    }
  }
  return out;
}
// Séances qui travaillent un objectif : celles dont le thème (ou le fil rouge) est le sien
export const goalSessions = (g: Group, id: string) => g.sessions.map((s, i) => ({ s, i })).filter(({ s }) => s.gl?.includes(id)).map(({ i }) => i + 1);
export function linkGoals(sessions: Session[], goals: AnnualGoal[]): Session[] {
  return sessions.map((s) => { const gl = goals.filter((o) => o.theme && (s.theme === o.theme || (s.fil || "").startsWith(o.theme))).map((o) => o.id); return gl.length ? { ...s, gl } : s; });
}
// Un objectif choisi dans un menu (« Thème : compétence », « Niveau · Coup droit : … ») ou écrit à la main devient un objectif annuel déjà rempli
export function goalFrom(d: Domain, text: string): AnnualGoal {
  const t = text.trim(); const skill = (t.includes(" : ") ? t.split(" : ").slice(1).join(" : ") : t).slice(0, 120);
  const theme = THEME_NAMES.find((n) => THEMES[n].d === d && t.includes(n));
  return { id: newGoalId(), d, skill, theme, finding: "", expected: `${skill} : niveau « acquis » (3 sur 4) en situation de jeu`, ok: OK_DEFAULT[d], prio: 2, evalMode: "Observation en situation de jeu, bilans après les séances 10, 20 et 30" };
}
// Les 30 séances reprennent les objectifs validés : chaque objectif est ajouté, en tête de son domaine, aux séances de son thème ; sans thème, à trois séances réparties dans l'année
export function applyGoals(sessions: Session[], goals: AnnualGoal[]): Session[] {
  const out = sessions.map((s) => ({ ...s }));
  const themed = out.map((s, i) => ({ s, i })).filter(({ s }) => s.kind === "theme" && s.theme && THEMES[s.theme]);
  const spread = <T,>(a: T[], n: number): T[] => (a.length <= n ? a : Array.from({ length: n }, (_, k) => a[Math.round((k * (a.length - 1)) / (n - 1))]));
  for (const o of [...goals].sort((a, b) => a.prio - b.prio)) {
    let target = o.theme ? themed.filter(({ s }) => s.theme === o.theme).slice(0, 8) : [];
    if (!target.length) target = spread(themed.filter(({ s }) => sessionDomain(s) === o.d), 3);
    if (!target.length) target = spread(themed, 3);
    for (const { i } of target) {
      const obj = objOf(out[i]); if (!obj[o.d].includes(o.skill)) obj[o.d] = [o.skill, ...obj[o.d]].slice(0, 10);
      out[i] = { ...withObj(out[i], obj), gl: [...(out[i].gl || []), o.id] };
    }
  }
  return out;
}
export const sessionStatus = (s: Session): "realisee" | "prete" | "prepare" => (s.done ? "realisee" : s.ready ? "prete" : "prepare");
export const STATUS_LABEL = { prepare: "À préparer", prete: "Prête", realisee: "Réalisée" } as const;
// Ajustements proposés (jamais appliqués tout seuls) d'après le bilan de la dernière séance faite
export function suggestFor(g: Group, i: number): string[] {
  let p = -1; for (let k = i - 1; k >= 0; k--) if (g.sessions[k].done && g.sessions[k].after) { p = k; break; }
  if (p < 0) return [];
  const a = g.sessions[p].after!, o = objOf(g.sessions[p]), out: string[] = [];
  for (const d of DOMAINS) { const r = a.reach?.[d.key]; if ((r === "non" || r === "part") && o[d.key].length) out.push(`${d.label} : « ${o[d.key].slice(0, 2).join(", ")} » ${r === "non" ? "n'a pas été atteint" : "n'a été atteint qu'en partie"} à la séance ${p + 1} : le reprendre ici avec une situation plus simple.`); }
  if (a.rework?.trim()) out.push(`À retravailler (séance ${p + 1}) : ${a.rework.trim()}`);
  if (g.sessions[p].redo) out.push(`Tu avais noté « à refaire » à la séance ${p + 1} : reprendre ce thème.`);
  return out;
}
export const presentRate = (g: Group, name?: string) => { const days = Object.values(g.appel || {}); let t = 0, ok = 0; for (const day of days) { const list = name ? (day[name] ? [day[name]] : []) : Object.values(day); for (const v of list) { if (v === "e") continue; t++; if (v === "p" || v === "r") ok++; } } return t ? Math.round((ok / t) * 100) : null; };


// ADAPTATION : la suite de la programmation se règle sur ce qui est atteint ou non (séances faites, évaluation, bilan par domaine)
export type Outcome = "reprendre" | "acquis" | "neutre";
export const outcomeOf = (s: Session): Outcome => {
  if (!s.done || s.kind !== "theme") return "neutre";
  const r = Object.values(s.after?.reach || {});
  if (s.redo || s.rating === 1 || r.includes("non")) return "reprendre";
  if ((s.rating === 3 && !r.includes("part")) || (r.length > 0 && r.every((x) => x === "oui"))) return "acquis";
  return "neutre";
};
export type Suggestion = { id: string; text: string; sessions: Session[] };
export function adaptSuggestions(g: Group): Suggestion[] {
  const S = g.sessions; let last = -1; S.forEach((s, i) => { if (s.done && s.kind === "theme") last = i; });
  if (last < 0) return [];
  const cur = S[last], o = outcomeOf(cur); const nxt = S.findIndex((s, i) => i > last && !s.done && s.kind === "theme");
  if (nxt < 0) return [];
  const same = (i: number) => S[i].theme === cur.theme;
  const swapWith = (j: number, k: number) => { const c = S.slice(); [c[j], c[k]] = [c[k], c[j]]; return c; };
  if (o === "reprendre" && !same(nxt)) {
    const k = S.findIndex((s, i) => i > nxt && !s.done && s.kind === "theme" && s.theme === cur.theme);
    if (k > 0) return [{ id: "repeat", text: `« ${cur.theme} » n'est pas encore acquis (séance ${last + 1}) : on le reprend à la séance ${nxt + 1}, avant de passer au thème suivant.`, sessions: swapWith(nxt, k) }];
    const m = S.reduce((acc, s, i) => (i > nxt && !s.done && s.kind === "theme" ? i : acc), -1);
    const rep = { ...sessionFor(g, cur.theme, phaseOf(nxt, S.length), cur.fil.split(" : ")[0], 0), obj: cur.obj ? JSON.parse(JSON.stringify(cur.obj)) : undefined, why: "Reprise : l'objectif n'était pas atteint à la séance précédente." };
    const c = S.slice(); const displaced = c[nxt]; c[nxt] = rep; if (m > nxt) c[m] = displaced;
    return [{ id: "repeat", text: `« ${cur.theme} » n'est pas encore acquis (séance ${last + 1}) : on le reprend à la séance ${nxt + 1}.${m > nxt ? " Le thème de la séance " + (nxt + 1) + " passe en fin de programmation." : ""}`, sessions: c }];
  }
  if (o === "acquis" && same(nxt)) {
    const k = S.findIndex((s, i) => i > nxt && !s.done && s.kind === "theme" && s.theme !== cur.theme);
    const prev = S[last - 1];
    if (k > 0 && prev && prev.done && prev.theme === cur.theme && outcomeOf(prev) === "acquis") return [{ id: "advance", text: `« ${cur.theme} » est acquis deux séances de suite : on peut passer à « ${S[k].theme} » dès la séance ${nxt + 1}.`, sessions: swapWith(nxt, k) }];
  }
  return [];
}

// Blocs : séances de suite sur le même thème (un cycle de répétition) ; les séances « repères » sont seules
export type Cycle = { a: number; b: number; theme: string; single: boolean };
export function cyclesOf(S: Session[]): Cycle[] {
  const out: Cycle[] = [];
  S.forEach((s, i) => {
    const t = s.kind === "theme" ? s.theme.trim() || s.title : "";
    const l = out[out.length - 1];
    if (t && l && !l.single && l.theme === t && l.b === i - 1) l.b = i; else out.push({ a: i, b: i, theme: t, single: !t });
  });
  return out;
}

// Change le thème d'une série (ou d'une séance) : titre, objectifs ET déroulement prêt sont refaits ; ce que le prof a déjà noté est gardé
export function retheme(g: Group, S: Session[], a: number, b: number, theme: string): Session[] {
  const n = S.length; const len = b - a + 1;
  return S.map((x, k) => {
    if (k < a || k > b || x.kind !== "theme") return x;
    if (!THEMES[theme]) return { ...x, theme: theme || " ", title: theme.trim() || x.title };
    const se = sessionFor(g, theme, phaseOf(a, n), x.fil.split(" : ")[0], 0);
    se.blocks = readyBlocks(g, se, k - a, len); se.ready = true;
    return { ...se, done: x.done, note: x.note, date: x.date, after: x.after, gl: x.gl, rating: x.rating, redo: x.redo };
  });
}

// Remet les exercices les plus récents dans les séances PAS ENCORE FAITES (thème, objectifs, notes et dates sont gardés)
export function refreshExercises(g: Group): Session[] {
  const S = g.sessions; const out = S.slice();
  for (const c of cyclesOf(S)) {
    for (let k = c.a; k <= c.b; k++) {
      const x = S[k];
      if (x.kind !== "theme" || x.done || !THEMES[x.theme]) continue;
      out[k] = { ...x, blocks: readyBlocks(g, x, k - c.a, c.b - c.a + 1), ready: true };
    }
  }
  return out.map((x, k) => {
    if (x.kind === "theme" || x.done || S[k].done) return x;
    return { ...x, blocks: specialBlocks(g, x), ready: true };
  });
}

// Contenu PRÊT À L'EMPLOI des séances : échauffements, situations, jeux, retours au calme, écrits à l'avance par niveau et par thème.
// Le prof garde la main : tout est modifiable ensuite. Aucun exercice n'est imposé ; ce sont des propositions de départ.
import type { Block, Group, Session } from "./progression";
import { levelDef, THEMES } from "./progression";
import { BASE_CONTEXTS, baseFor, type BaseItem } from "./techBase";

type Tpl = { goal: string; org: string; t: string; ok: string; vars: string; mat?: string; vigil?: string };
type Band = "mini" | "mid" | "ado" | "adulte";
const bandOf = (level: string): Band => (/adulte/i.test(level) ? "adulte" : /violette|rouge/i.test(level) ? "mini" : /orange|verte/i.test(level) ? "mid" : "ado");

const WARM: Record<Band, Tpl[]> = {
  mini: [
    { goal: "Se mettre en mouvement en s'amusant", org: "Parcours de cerceaux et de plots sur la moitié du terrain, un enfant après l'autre.", t: "Sauter, courir, attraper une balle. On change de déplacement à chaque passage (pas chassés, sauts, course arrière).", ok: "Tous les enfants font le parcours sans s'arrêter.", vars: "Plus simple : parcours plus court. Plus dur : on lance et on rattrape la balle en même temps.", mat: "Cerceaux, plots, balles" },
    { goal: "Réveiller la coordination avec la balle", org: "En ligne, chacun avec une balle et une raquette, face à l'enseignant.", t: "Faire rebondir la balle sur le sol, sur la raquette, la lancer et la rattraper. Défi : combien de fois de suite ?", ok: "5 rebonds de suite sur la raquette.", vars: "Plus simple : à deux mains. Plus dur : en marchant.", mat: "Raquettes, balles" },
  ],
  mid: [
    { goal: "Échauffement articulaire et déplacements", org: "Tour du terrain en petit footing, puis deux lignes face à face sur la ligne de fond.", t: "Footing, montées de genoux, talons-fesses, pas chassés le long de la ligne, sauts d'allègement. Rotations d'épaules et de poignets.", ok: "Tout le groupe suit le rythme sans se bousculer.", vars: "Plus simple : moins de répétitions. Plus dur : changer de direction au signal.", mat: "Plots" },
    { goal: "Chauffer la main avec des échanges courts", org: "Deux joueurs par demi-terrain, dans les carrés de service.", t: "Échanges coup droit puis revers en douceur, balle au centre. On cherche la régularité, pas la puissance.", ok: "10 échanges de suite sans faute.", vars: "Plus simple : balle lancée à la main. Plus dur : alterner coup droit et revers.", mat: "Balles, raquettes" },
  ],
  ado: [
    { goal: "Activation du corps et des appuis", org: "Deux lignes sur la ligne de fond, un échelle de rythme ou des plots devant chacune.", t: "Footing, appuis rapides dans l'échelle, pas chassés, sauts d'allègement, accélérations de 5 m. Mobilité des épaules et des hanches.", ok: "Appuis légers et rapides, sans toucher les plots.", vars: "Plus simple : sans échelle. Plus dur : avec une balle à rattraper à la fin.", mat: "Échelle de rythme, plots" },
    { goal: "Mise en route de la frappe", org: "Minitennis à deux dans les carrés de service, puis reculer jusqu'au fond.", t: "Minitennis puis échange fond de court, 2 minutes par coup (coup droit, revers), en reculant d'un mètre à chaque étape.", ok: "20 échanges de suite au fond du court.", vars: "Plus simple : rester en minitennis. Plus dur : en diagonale.", mat: "Balles" },
  ],
  adulte: [
    { goal: "Échauffement général et articulaire", org: "Footing léger autour des courts, puis en ligne sur le terrain.", t: "Footing, mobilité (épaules, hanches, poignets), pas chassés, accélérations courtes. Pas de frappe appuyée avant 5 minutes.", ok: "Corps chaud et souple avant la frappe.", vars: "Adapter l'intensité à chacun.", mat: "" },
    { goal: "Mise en route de la balle", org: "Deux joueurs par demi-terrain, minitennis puis échange fond de court.", t: "Minitennis 3 minutes, puis échanges coup droit et revers à vitesse modérée. On cherche le rythme et le placement.", ok: "15 échanges de suite.", vars: "Plus simple : balle lancée. Plus dur : alterner les directions.", mat: "Balles" },
  ],
};

const COOL: Record<Band, Tpl> = {
  mini: { goal: "Terminer dans le calme et faire le point", org: "Assis en cercle autour de l'enseignant.", t: "Respirer, boire, dire ce qu'on a réussi aujourd'hui. Ranger les balles ensemble.", ok: "Chaque enfant dit une chose réussie.", vars: "" },
  mid: { goal: "Retour au calme et bilan du groupe", org: "En cercle sur le terrain.", t: "Étirements doux (cuisses, épaules, poignets). Chacun dit ce qu'il a réussi et ce qu'il garde pour la prochaine fois.", ok: "Chacun cite une réussite et un point à retravailler.", vars: "" },
  ado: { goal: "Retour au calme, étirements et bilan", org: "En cercle sur le terrain.", t: "Étirements guidés, respiration, boire. Bilan court : une réussite, un point à retravailler, le thème de la prochaine séance.", ok: "Bilan dit à voix haute par chaque joueur.", vars: "" },
  adulte: { goal: "Retour au calme et étirements", org: "Sur le terrain.", t: "Étirements doux (épaules, avant-bras, cuisses, mollets) et échange sur ce qui a bien marché.", ok: "Tout le monde a pu s'étirer.", vars: "" },
};

// Situations tactiques, physiques et mentales (une proposition par thème)
const THEME_TPL: Record<string, Tpl> = {
  "Défendre": { goal: "Remettre la balle en jeu malgré la pression", org: "Un joueur au fond, l'enseignant ou un partenaire le fait courir de gauche à droite.", t: "Balles lentes puis plus rapides, toujours hautes et profondes. Revenir au centre après chaque balle.", ok: "6 balles remises sur 10, profondes ou hautes.", vars: "Plus simple : balles lentes. Plus dur : alterner avec une balle courte." },
  "Attaquer": { goal: "Finir le point quand la balle est courte", org: "Un joueur au fond renvoie, l'autre attend une balle courte pour attaquer.", t: "Dès qu'une balle tombe dans le carré de service, monter, frapper dans le terrain vers un angle ouvert.", ok: "4 attaques réussies sur 10 balles courtes.", vars: "Plus simple : balle lancée à la main. Plus dur : en mouvement." },
  "Montées au filet": { goal: "Monter au filet au bon moment et finir le point", org: "Un joueur au fond joue, l'autre monte après une balle d'approche.", t: "Frapper la balle d'approche sur la ligne, monter, volée de finition dans le grand espace. Reculer ensuite en cas de lob.", ok: "5 montées réussies sur 10.", vars: "Plus simple : balle d'approche lancée. Plus dur : l'adversaire peut lober." },
  "Construire le point (régularité)": { goal: "Rester dans l'échange jusqu'à la bonne balle", org: "Échange en diagonale puis en long de ligne, puis jeu libre à deux.", t: "Cinq balles dans le terrain avant de pouvoir changer de direction. On compte les balles à voix haute.", ok: "Échange de 8 balles réussi 3 fois de suite.", vars: "Plus simple : en minitennis. Plus dur : en point avec score." },
  "Variations": { goal: "Changer le rythme et les effets pour déséquilibrer", org: "Échange fond de court à deux, les balles changent de hauteur et de vitesse.", t: "Alterner balle haute lente, balle plate rapide, balle coupée. Dire à haute voix l'effet choisi.", ok: "3 changements de rythme réussis dans l'échange.", vars: "Plus simple : un seul changement imposé. Plus dur : choisir librement." },
  "Lecture du jeu": { goal: "Lire la trajectoire et le placement de l'adversaire", org: "Un joueur renvoie, l'autre annonce où la balle va tomber avant la frappe.", t: "Observer l'épaule et la raquette, annoncer la direction, se déplacer avant la frappe.", ok: "6 annonces justes sur 10.", vars: "Plus simple : directions limitées. Plus dur : balles variées." },
  "Endurance": { goal: "Tenir l'effort sur plusieurs échanges", org: "Navettes sur la largeur du terrain par séries, avec récupération marchée.", t: "6 séries de 30 secondes d'effort, 30 secondes de repos. Garder les appuis légers.", ok: "Toutes les séries terminées.", vars: "Plus simple : séries de 20 secondes. Plus dur : avec frappe à la fin de chaque série." },
  "Vitesse": { goal: "Réagir et démarrer vite", org: "Départs arrêtés sur 5 m au signal, puis vers une balle lancée.", t: "Réagir au signal, premier pas explosif, arrêt équilibré. 8 départs, repos entre chaque.", ok: "Premier appui immédiat et arrêt équilibré.", vars: "Plus simple : signal visuel. Plus dur : signal surprise." },
  "Explosivité": { goal: "Gagner en puissance dans le geste", org: "Sauts, lancers de balle medecine ou de balle de tennis par séries.", t: "Sauts verticaux, lancers de poitrine et par-dessus l'épaule. 3 séries de 6 répétitions, repos entre les séries.", ok: "Mouvements amples et propres.", vars: "Plus simple : balle de tennis. Plus dur : balle plus lourde." },
  "Concentration": { goal: "Rester concentré sur le point en cours", org: "Échange à deux avec une consigne à tenir à chaque balle.", t: "Dire « oui » quand la balle rebondit et « frappe » à la frappe. On recommence au premier oubli.", ok: "10 échanges de suite sans oubli.", vars: "Plus simple : consigne unique. Plus dur : consigne différente par coup." },
  "Routines": { goal: "Installer une routine entre les points", org: "Jeu de points avec une routine imposée avant chaque service.", t: "Respirer, rebondir la balle, choisir sa zone, jouer. La routine doit être identique à chaque point.", ok: "Routine complète avant 8 services sur 10.", vars: "Plus simple : routine courte. Plus dur : routine tenue même quand on est mené." },
  "Gestion des émotions": { goal: "Rester calme après une erreur", org: "Jeu de points où chaque erreur déclenche un geste de remise à zéro.", t: "Après une faute : souffler, regarder les cordes, passer au point suivant. Le groupe repère les bons réflexes.", ok: "Geste de remise à zéro fait après chaque faute.", vars: "Plus simple : après les fautes importantes seulement. Plus dur : mené au score." },
  "Confiance": { goal: "Oser jouer ses coups", org: "Jeu de points où le premier à tenter son coup préféré marque un bonus.", t: "Choisir son coup avant le point et le jouer franchement, même si on rate. On valorise la tentative.", ok: "Coup tenté à chaque point proposé.", vars: "Plus simple : coup imposé. Plus dur : coup libre sous pression." },
  "Combativité": { goal: "Ne rien lâcher jusqu'au dernier point", org: "Mini-matchs où le joueur mené peut gagner des points bonus à l'effort.", t: "Courir sur toutes les balles, revenir au centre, rester positif en dépit du score.", ok: "Aucune balle abandonnée.", vars: "Plus simple : jeu court. Plus dur : départ à 0-3." },
};

const CTX_FOR = (r: number, len: number) => (len <= 1 ? 1 : r === 0 ? 0 : r >= len - 1 ? 2 : 1);

const baseKey = (theme: string) => (theme === "Retour de service" ? "Retour" : theme === "Jeu de jambes" ? "Déplacements" : theme);

const pick = <T,>(a: T[], k: number) => a[((k % a.length) + a.length) % a.length];

// Une situation d'apprentissage écrite d'après la base pédagogique (critère, consigne et exercice déjà prêts)
function baseTpl(it: BaseItem, ctx: number, g: Group): Tpl {
  const c = BASE_CONTEXTS[ctx];
  const L = levelDef(g.level);
  return {
    goal: `${it.fam} – ${it.sub}`,
    org: `${L.terrain} · ${L.ball}. ${it.ex}${c.add}.`,
    t: `${it.fix}. ${ctx === 0 ? "On travaille d'abord en situation dirigée : balle envoyée par l'enseignant." : ctx === 1 ? "On passe à l'échange : le partenaire varie légèrement les zones." : "On termine en opposition avec un score : le geste doit tenir sous la pression."}`,
    ok: `${it.obs} : ${c.ok}.`,
    vars: ctx === 2 ? "Plus simple : revenir à l'échange. Plus dur : ajouter un temps limité par balle." : "Plus simple : balle plus lente. Plus dur : cible plus petite.",
    mat: "Balles, cibles ou plots",
    vigil: `Défaut possible : ${it.def.toLowerCase()}.`,
  };
}

function minutesSplit(total: number, hasMatch: boolean): number[] {
  const r5 = (x: number) => Math.max(5, Math.round(x / 5) * 5);
  const e = r5(total * 0.15), c = r5(total * 0.1), rest = total - e - c;
  const a = hasMatch ? r5(rest * 0.4) : r5(rest * 0.55), j = hasMatch ? r5(rest * 0.3) : r5(rest * 0.45);
  const m = hasMatch ? rest - a - j : 0;
  const out = hasMatch ? [e, a, j, m, c] : [e, a, j, c];
  const sum = out.reduce((x, y) => x + y, 0); out[out.length - 1 === 0 ? 0 : 1] += total - sum; // le reste va à la situation
  return out;
}

export function readyBlocks(g: Group, s: Session, r: number, len: number): Block[] {
  if (s.kind !== "theme") return [];
  const band = bandOf(g.level); const th = THEMES[s.theme]; const minutes = g.minutes || 60;
  const hasMatch = minutes >= 60; const [e, a, j, m, c] = hasMatch ? minutesSplit(minutes, true) : [...minutesSplit(minutes, false).slice(0, 3), 0, minutesSplit(minutes, false)[3]];
  const ctx = CTX_FOR(r, len);
  const L = levelDef(g.level);
  const warm = pick(WARM[band], r + s.theme.length);
  const dom = th?.d ?? "tech";
  let learn: Tpl; let game: Tpl;
  if (dom === "tech") {
    const fam = baseKey(s.theme); const items = baseFor(g.level).filter((b) => b.fam === fam);
    const comp = (s.obj?.tech?.[0] || s.title).toLowerCase();
    const words = (x: string) => x.toLowerCase().split(/[^a-zàâçéèêëîïôûùüÿœ]+/).filter((w) => w.length > 3);
    const cw = words(comp); const score = (b: BaseItem) => words(b.sub + " " + b.obs).filter((w) => cw.includes(w)).length;
    const best = items.reduce((m, b) => Math.max(m, score(b)), 0);
    const cands = best > 0 ? items.filter((b) => score(b) === best) : items;
    let h = 0; for (const ch of comp) h = (h * 31 + ch.charCodeAt(0)) | 0;
    const it = cands.length ? pick(cands, Math.abs(h)) : undefined; // même objectif = même situation sur toute la série
    learn = it ? baseTpl(it, ctx, g) : { goal: s.title || s.theme, org: `${L.terrain} · ${L.ball}. Panier de balles, cibles.`, t: "L'enseignant montre, les joueurs reproduisent, puis on passe à l'échange.", ok: BASE_CONTEXTS[ctx].ok, vars: "Plus simple : balle lancée. Plus dur : cible plus petite." };
    game = { goal: `Jeu à thème : ${s.theme}`, org: "Deux contre deux ou un contre un sur demi-terrain.", t: `Points joués avec une consigne : le point compte double quand le thème (${s.theme.toLowerCase()}) est réussi.`, ok: "Le thème est réussi dans au moins 3 points sur 10.", vars: "Plus simple : consigne facultative. Plus dur : point perdu si la consigne n'est pas respectée." };
  } else {
    const t = THEME_TPL[s.theme] ?? { goal: s.theme, org: "Selon le groupe.", t: "À préciser.", ok: "", vars: "" };
    learn = { ...t, mat: "Balles, plots" };
    game = { goal: `Jeu à thème : ${s.theme}`, org: "Points joués sur demi-terrain ou terrain entier.", t: `Jouer des points en appliquant le thème (${s.theme.toLowerCase()}). Le groupe observe et donne un retour à la fin.`, ok: "Le thème est appliqué dans la moitié des points.", vars: "Plus simple : thème rappelé avant chaque point. Plus dur : sans rappel." };
  }
  const blocks: Block[] = [
    { n: "Échauffement", m: e, t: warm.t, goal: warm.goal, org: warm.org, ok: warm.ok, vars: warm.vars, mat: warm.mat },
    { n: "Situation", m: a, t: learn.t, goal: learn.goal, org: learn.org, ok: learn.ok, vars: learn.vars, mat: learn.mat, vigil: learn.vigil },
    { n: "Jeu", m: j, t: game.t, goal: game.goal, org: game.org, ok: game.ok, vars: game.vars },
  ];
  if (hasMatch && m > 0) blocks.push({ n: "Match", m, t: "Sets courts ou jeu décisif : on applique ce qu'on a travaillé. Le groupe s'auto-évalue à la fin (une réussite, un point à retravailler).", goal: "Appliquer le thème en match", org: "Terrain entier ou demi-terrain, un contre un ou deux contre deux, en tournant.", ok: "Le thème est tenté dans les points importants.", vars: "Plus simple : jeu à score réduit. Plus dur : on perd le point si le thème n'est pas tenté." });
  blocks.push({ n: "Retour au calme", m: c, t: COOL[band].t, goal: COOL[band].goal, org: COOL[band].org, ok: COOL[band].ok, vars: "" });
  return blocks;
}

// Séances « repères » : un déroulement prêt aussi
export function specialBlocks(g: Group, s: Session): Block[] {
  const minutes = g.minutes || 60; const band = bandOf(g.level); const warm = WARM[band][0];
  const e = Math.max(5, Math.round((minutes * 0.15) / 5) * 5), c = Math.max(5, Math.round((minutes * 0.1) / 5) * 5);
  const mid = minutes - e - c;
  const title = s.title.toLowerCase();
  const body: Tpl = /départ/.test(title)
    ? { goal: "Observer le niveau du groupe sans corriger", org: "Situations de référence (service, échange, point), un groupe après l'autre.", t: "Proposer des situations simples et noter ce qui est acquis ou non. Pas de correction : on observe.", ok: "Chaque joueur a été observé dans les trois situations.", vars: "" }
    : /bilan/.test(title)
      ? { goal: "Refaire les situations de départ et comparer", org: "Mêmes situations que la première séance.", t: "Refaire les situations de départ, comparer avec les notes de la séance 1, dire à chacun ce qui a progressé.", ok: "Chaque joueur a reçu un retour sur sa progression.", vars: "" }
      : /étape/.test(title)
        ? { goal: "Faire le point à mi-parcours", org: "Mêmes situations que la première séance.", t: "Refaire les situations de départ, comparer avec le départ et adapter la suite de la programmation.", ok: "Ce qui est acquis et ce qui reste à travailler est noté.", vars: "" }
        : { goal: "Jouer des points avec une consigne par joueur", org: "Mini-matchs en rotation sur plusieurs terrains.", t: "Chaque joueur reçoit une consigne en lien avec le travail récent. On observe, on corrige peu, on félicite les tentatives.", ok: "La consigne est tentée dans la moitié des points.", vars: "Plus simple : consigne unique pour tous. Plus dur : consigne secrète à deviner." };
  return [
    { n: "Échauffement", m: e, t: warm.t, goal: warm.goal, org: warm.org, ok: warm.ok, vars: warm.vars, mat: warm.mat },
    { n: /match|mise/.test(title) ? "Match" : "Situation", m: mid, t: body.t, goal: body.goal, org: body.org, ok: body.ok, vars: body.vars },
    { n: "Retour au calme", m: c, t: COOL[band].t, goal: COOL[band].goal, org: COOL[band].org, ok: COOL[band].ok, vars: "" },
  ];
}

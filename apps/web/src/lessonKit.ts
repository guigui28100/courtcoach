// Contenu PRÊT À L'EMPLOI des séances : échauffements, situations, jeux, retours au calme, écrits à l'avance par niveau et par thème.
// Le prof garde la main : tout est modifiable ensuite. Aucun exercice n'est imposé ; ce sont des propositions de départ.
import type { Block, Group, Session } from "./progression";
import { levelDef, THEMES } from "./progression";
import { BASE_CONTEXTS, baseFor, type BaseItem } from "./techBase";
import { COOL, GAMES, GAMES_MINI, LADDER, MATCHES, WARM, type Band, type Tpl } from "./lessonBank";

const bandOf = (level: string): Band => (/adulte/i.test(level) ? "adulte" : /violette|rouge/i.test(level) ? "mini" : /orange|verte/i.test(level) ? "mid" : "ado");

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

// Répartition des minutes selon des poids, arrondie à 5 min ; le reste va au plus gros bloc
function minutesSplit(total: number, w: number[]): number[] {
  const sum = w.reduce((x, y) => x + y, 0);
  const out = w.map((x) => Math.max(5, Math.round(((total * x) / sum) / 5) * 5));
  const diff = total - out.reduce((x, y) => x + y, 0);
  out[out.indexOf(Math.max(...out))] += diff;
  return out;
}

const blk = (n: string, m: number, x: Tpl): Block => ({ n, m, t: x.t, goal: x.goal, org: x.org, ok: x.ok, vars: x.vars, mat: x.mat, vigil: x.vigil });

export function readyBlocks(g: Group, s: Session, r: number, len: number): Block[] {
  if (s.kind !== "theme") return [];
  const band = bandOf(g.level); const th = THEMES[s.theme]; const minutes = g.minutes || 60;
  const ctx = CTX_FOR(r, len);
  const L = levelDef(g.level);
  let hh = 0; for (const ch of s.theme + s.title) hh = (hh * 31 + ch.charCodeAt(0)) | 0;
  const vi = Math.abs(hh) + r; // varie d'une séance à l'autre sans jamais changer au rechargement
  const warm = pick(WARM[band], vi);
  const cool = pick(COOL[band], vi);
  const dom = th?.d ?? "tech";
  const ladder = LADDER[s.theme];
  let learn: Tpl; let learn2: Tpl | undefined;
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
    learn2 = ladder?.[ctx];
  } else {
    learn = ladder?.[ctx] ?? { goal: s.theme, org: "Selon le groupe.", t: "À préciser.", ok: "", vars: "" };
    learn2 = ladder?.[ctx === 1 ? 2 : 1];
  }
  const games = band === "mini" ? GAMES_MINI : GAMES;
  const game = pick(games, vi)(s.theme);
  const match = pick(MATCHES, vi + 1);
  const blocks: Block[] = [];
  if (minutes >= 60) {
    const withMatch = minutes >= 75;
    const w = withMatch ? [16, 20, 20, 20, 16, 8] : [18, 24, 24, 26, 8];
    const m = minutesSplit(minutes, w);
    blocks.push(blk("Échauffement", m[0], warm), blk("Situation 1", m[1], learn));
    blocks.push(blk("Situation 2", m[2], learn2 ?? learn));
    blocks.push(blk("Jeu", m[3], game));
    if (withMatch) blocks.push(blk("Match", m[4], match));
    blocks.push(blk("Retour au calme", m[m.length - 1], cool));
  } else {
    const m = minutesSplit(minutes, [15, 40, 33, 12]);
    blocks.push(blk("Échauffement", m[0], warm), blk("Situation", m[1], learn), blk("Jeu", m[2], game), blk("Retour au calme", m[3], cool));
  }
  return blocks;
}

// Séances « repères » : un déroulement prêt aussi
export function specialBlocks(g: Group, s: Session): Block[] {
  const minutes = g.minutes || 60; const band = bandOf(g.level); const warm = WARM[band][0]; const cool = COOL[band][0];
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
    { n: "Retour au calme", m: c, t: cool.t, goal: cool.goal, org: cool.org, ok: cool.ok, vars: "" },
  ];
}

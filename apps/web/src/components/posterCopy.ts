import { ClubEvent, teamCat, tourInfo } from "../clubPlan";

// Texte des affiches d'événement : on REFORMULE ce que le coach a rempli (au lieu de recopier les champs tels quels).
// Tout est calculé ici, sans service extérieur ni intelligence artificielle : des règles simples d'écriture en français.

const cap = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
const low = (s: string) => (s ? s.charAt(0).toLowerCase() + s.slice(1) : s);

// Pas de lettre ou de petit mot seul en bout de ligne : les petits mots (à, de, le, et…), les nombres et leur « h » ou « € », et les deux derniers mots restent collés (espaces insécables)
const NB = "\u00a0";
export function glue(raw: string | undefined | null): string {
  let s = raw ?? "";
  if (!s) return "";
  s = s.replace(/(\d) (h|€|ans|jours?|min)(?![a-zà-ÿ])/gi, `$1${NB}$2`).replace(/\bh (\d{2})\b/g, `h${NB}$1`);
  s = s.replace(/(^|[\s(])(à|a|de|du|des|le|la|les|un|une|et|ou|au|aux|en|sur|par|pour|avec|dans|ce|cet|cette|ne|se|y|d'|l'|qu')\s+(?=\S)/gi, (_m, p, w) => `${p}${w}${NB}`);
  s = s.replace(/\b(équipe|éq\.|court|courts|terrain|n°) (\d{1,2})\b/gi, `$1${NB}$2`); // « équipe 1 », « court 2 »
  s = s.replace(/ ([:;!?»])/g, `${NB}$1`).replace(/(«) /g, `$1${NB}`); // ponctuation française : jamais en début de ligne
  s = s.replace(/(\p{L}{2,})-(?=\p{L}{2,})/gu, `$1\u2011`); // « pique-nique » ne se coupe pas au tiret
  return s;
}

// Nettoyage typographique : espaces, « 14h30 » → « 14 h 30 », « 10h-16h » → « de 10 h à 16 h », majuscule au début
export function tidy(raw: string | undefined | null): string {
  let s = (raw ?? "").replace(/\s+/g, " ").trim();
  if (!s) return "";
  s = s.replace(/(\d)\s*h\s*(\d{2})\b/gi, "$1 h $2").replace(/(\d)\s*h(?![a-zà-ÿ])/gi, "$1 h");
  s = s.replace(/(\d{1,2} h(?: \d{2})?) ?[-–—] ?(\d{1,2} h(?: \d{2})?)/g, (_m, a: string, b: string, off: number, str: string) => {
    const before = str.slice(Math.max(0, off - 7), off);
    if (/\bentre $/i.test(before)) return `${a} et ${b}`;
    if (/\b(de|du) $/i.test(before)) return `${a} à ${b}`;
    return `de ${a} à ${b}`;
  });
  s = s.replace(/\s+([,.;!?])/g, "$1").replace(/([,;])(?=\S)/g, "$1 ").replace(/\.{2,}$/, "").replace(/[ ;,]+$/, "");
  return glue(cap(s));
}

// Prix : « 50 » → « 50 € », « 50euros » → « 50 € », « gratuit » → « Gratuit »
export function priceText(raw: string | undefined | null): string {
  const s = (raw ?? "").replace(/\s+/g, " ").trim();
  if (!s) return "";
  if (/^gratuit(e)?$/i.test(s)) return "Gratuit";
  const m = s.match(/^(\d+(?:[.,]\d+)?)\s*(€|euros?|eur)?$/i);
  if (m) return `${m[1].replace(".", ",")} €`;
  return s.replace(/(\d)\s*€/g, "$1 €");
}

// Inscriptions : une e-mail ou un site seul devient une phrase
export function signupText(raw: string | undefined | null): string {
  const s = tidy(raw);
  if (!s) return "";
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)) return `Écris-nous à ${s.toLowerCase()}`;
  if (/^(https?:\/\/|www\.)\S+$/i.test(s)) return `Inscris-toi sur ${s}`;
  return s;
}

// Surface d'un tournoi : « Terre battue » → « sur terre battue »
const surfacePhrase = (raw: string) => {
  const s = low(tidy(raw));
  if (!s) return "";
  return /^(sur|en|à|au)\b/.test(s) ? s : `sur ${s}`;
};

// Public d'un tournoi, d'après la catégorie choisie dans les cartes du tournoi (« Jeunes · 11/12 ans garçons », « Messieurs (adultes) · +35 ans »)
export function tournoiPublic(audience: string): { text: string; fem: boolean } {
  const [base, ...rest] = (audience ?? "").split(" · ");
  const detail = rest.join(" · ");
  const vet = detail.match(/\+(\d{2}) ans/);
  const years = vet ? ` de plus de ${vet[1]} ans` : "";
  const vets = [...detail.matchAll(/\+(\d{2}) ans/g)].map((m) => `+${m[1]} ans`);
  if (vets.length > 1) return { text: `aux vétérans (${vets.join(", ")})`, fem: /^Dames/i.test(base) };
  if (/^Vétérans/i.test(base)) return { text: "aux vétérans", fem: false };
  if (/^Messieurs/i.test(base)) return { text: `aux joueurs${years}`, fem: false };
  if (/^Dames/i.test(base)) return { text: `aux joueuses${years}`, fem: true };
  if (/^Jeunes/i.test(base)) {
    const f = /filles/i.test(detail), g = /gar[cç]ons/i.test(detail);
    const sex = f && g ? "" : f ? "filles" : g ? "garçons" : "";
    const ageList = [...new Set([...detail.matchAll(/(\d+\/\d+)/g)].map((m) => m[1]))];
    const ages = ageList.length > 1 ? `${ageList.slice(0, -1).join(", ")} et ${ageList[ageList.length - 1]}` : ageList[0];
    const ball = ageList.length > 1 ? undefined : detail.match(/\b(orange|vert)\b/i)?.[1]?.toLowerCase();
    if (!sex && !ages) return { text: "aux jeunes", fem: false };
    return { text: `aux ${sex || "jeunes"}${ages ? ` de ${ages} ans` : ""}${ball ? ` (balle ${ball})` : ""}`, fem: sex === "filles" };
  }
  return { text: "", fem: false };
}

const dayCount = (e: ClubEvent) => Math.round((Date.parse(e.endDate) - Date.parse(e.startDate)) / 86400000) + 1;

// La phrase d'accroche sous le titre. Si elle dit déjà « pour qui », « quel type » ou « quelle surface », ces cartes ne sont pas répétées (voir `covers`).
export function ledeOf(e: ClubEvent) {
  const r = ledeRaw(e);
  return { ...r, text: glue(r.text) };
}
function ledeRaw(e: ClubEvent): { text: string; covers: { audience: boolean; type: boolean; surface: boolean } } {
  const covers = { audience: false, type: false, surface: false };
  const ti = tourInfo(e);
  const aud = tidy(e.audience);
  const days = dayCount(e);
  switch (e.kind) {
    case "TOURNOI": {
      const pub = tournoiPublic(e.audience ?? "");
      const kind = ti ? (ti.type === "TMC" ? "Un tournoi multi-chances (TMC)" : "Un tournoi open") : "Un tournoi";
      let s = kind;
      if (pub.text) { s += ` ouvert ${pub.text}`; covers.audience = true; }
      if (ti) covers.type = true;
      if (ti?.bas && ti?.haut) s += `, ${pub.fem ? "classées" : "classés"} de ${ti.bas} à ${ti.haut}`;
      const surf = surfacePhrase(e.place ?? "");
      if (surf) { s += `, ${surf}`; covers.surface = true; }
      return { text: `${s}.`, covers };
    }
    case "EQUIPES": {
      const home = /domicile/i.test(e.place ?? "");
      const away = /d[ée]placement/i.test(e.place ?? "");
      const club = tidy(e.audience);
      const where = home ? `À domicile${club ? ` face à ${club}` : ""}. Venez nous encourager !` : away ? `En déplacement${club ? ` chez ${club}` : ""}. Un petit mot d'encouragement ?` : `${club ? `Face à ${club}. ` : ""}Venez nous encourager !`;
      return { text: where, covers: { ...covers, audience: true } };
    }
    case "STAGE_ENFANTS":
    case "STAGE_ADULTES": {
      let who = aud ? low(aud) : e.kind === "STAGE_ENFANTS" ? "les enfants" : "les adultes";
      if (/^(enfants|ados|adolescents|adultes|jeunes|débutants|joueurs|tous)\b/.test(who)) who = `les ${who}`.replace("les tous", "tous");
      if (aud) covers.audience = true;
      const len = days > 1 ? `, sur ${days} jours` : "";
      return { text: `Un stage de tennis pour ${who}${len}.`, covers };
    }
    case "ANIMATION":
      if (aud) { covers.audience = true; return { text: `Une animation pour ${low(aud)}.`, covers }; }
      return { text: "Une animation ouverte à tous.", covers };
    case "JUMELAGE": return { text: "Une rencontre amicale entre clubs jumelés.", covers };
    case "FETE": return { text: "Venez fêter ça ensemble !", covers };
    case "FETE_ECOLE": return { text: "Les enfants de l'école de tennis, leurs parents et leurs entraîneurs se retrouvent pour la fête.", covers };
    case "INSCRIPTIONS": return { text: "Venez rencontrer les entraîneurs et vous inscrire pour la nouvelle saison.", covers };
    case "DEBUT_COURS": return { text: "C'est la reprise : les cours recommencent !", covers };
    case "AG": return { text: "Tous les adhérents sont invités à l'assemblée générale du club.", covers };
    case "AGE": return { text: "Tous les adhérents sont invités à une assemblée générale extraordinaire.", covers };
    case "FIN_COURS": return { text: "Dernière séance de la saison : merci à tous !", covers };
    default: return { text: "", covers };
  }
}

// Nom d'équipe écrit comme on le dirait : « Seniors messieurs, équipe 1 », « Filles 13/14 ans, équipe 2 », « Vétérans +45 ans messieurs, équipe 1 » (sans point ni émoticône)
const CAT_TEXT = (key: string): string => {
  const c = teamCat(`${key}#1`); if (!c) return key;
  const l = c.label.replace(/\s*·\s*/g, " ");
  const m = /^(.+?) (garçons|filles)$/.exec(l);
  if (m) return `${m[2] === "filles" ? "Filles" : "Garçons"} ${m[1]}`; // « 13/14 ans filles » → « Filles 13/14 ans »
  if (/^\+\d+ ans/.test(l)) return `Vétérans ${l}`;
  return l; // « Seniors messieurs »
};
export const teamPlain = (t: string) => `${CAT_TEXT(t.split("#")[0])}, équipe ${t.split("#")[1] ?? "1"}`;
export const catPlain = (key: string) => CAT_TEXT(key);
// Une équipe en deux lignes : la catégorie (« Vétérans +45 ans dames »), puis le numéro (« Équipe 1 »)
export const teamParts = (t: string): [string, string] => [CAT_TEXT(t.split("#")[0]), `Équipe ${t.split("#")[1] ?? "1"}`];

// Terrains écrits comme on le dirait : « Court 1 », « Courts 1 et 2 », « Les 4 courts »
export function courtsText(c: number[] | undefined): string {
  const l = [...(c ?? [])].sort();
  if (!l.length) return "";
  if (l.length === 4) return "Les 4 courts";
  if (l.length === 1) return `Court ${l[0]}`;
  return `Courts ${l.slice(0, -1).join(", ")} et ${l[l.length - 1]}`;
}

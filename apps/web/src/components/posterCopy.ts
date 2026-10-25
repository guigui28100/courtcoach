import { ClubEvent, tourInfo } from "../clubPlan";

// Texte des affiches d'événement : on REFORMULE ce que le coach a rempli (au lieu de recopier les champs tels quels).
// Tout est calculé ici, sans service extérieur ni intelligence artificielle : des règles simples d'écriture en français.

const cap = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
const low = (s: string) => (s ? s.charAt(0).toLowerCase() + s.slice(1) : s);

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
  return cap(s);
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
  if (/^Messieurs/i.test(base)) return { text: `aux messieurs${years}`, fem: false };
  if (/^Dames/i.test(base)) return { text: `aux dames${years}`, fem: true };
  if (/^Jeunes/i.test(base)) {
    const sex = /filles/i.test(detail) ? "filles" : /gar[cç]ons/i.test(detail) ? "garçons" : "";
    const ages = detail.match(/(\d+\/\d+)/)?.[1];
    const ball = detail.match(/\b(orange|vert)\b/i)?.[1]?.toLowerCase();
    if (!sex && !ages) return { text: "aux jeunes", fem: false };
    return { text: `aux ${sex || "jeunes"}${ages ? ` de ${ages} ans` : ""}${ball ? ` (balle ${ball})` : ""}`, fem: sex === "filles" };
  }
  return { text: "", fem: false };
}

const dayCount = (e: ClubEvent) => Math.round((Date.parse(e.endDate) - Date.parse(e.startDate)) / 86400000) + 1;

// La phrase d'accroche sous le titre. Si elle dit déjà « pour qui », « quel type » ou « quelle surface », ces cartes ne sont pas répétées (voir `covers`).
export function ledeOf(e: ClubEvent): { text: string; covers: { audience: boolean; type: boolean; surface: boolean } } {
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
      return { text: `${s}, au Tennis Club Houdan.`, covers };
    }
    case "EQUIPES": {
      const home = /domicile/i.test(e.place ?? "");
      const away = /d[ée]placement/i.test(e.place ?? "");
      const club = tidy(e.audience);
      return { text: home ? `Venez encourager nos joueurs à domicile${club ? `, face à ${club}` : ""} !` : away ? `Nos joueurs se déplacent${club ? ` chez ${club}` : ""} : un petit mot d'encouragement ?` : `Nos joueurs sont sur les courts${club ? ` face à ${club}` : ""} !`, covers };
    }
    case "STAGE_ENFANTS":
    case "STAGE_ADULTES": {
      let who = aud ? low(aud) : e.kind === "STAGE_ENFANTS" ? "les enfants" : "les adultes";
      if (/^(enfants|ados|adolescents|adultes|jeunes|débutants|joueurs|tous)\b/.test(who)) who = `les ${who}`.replace("les tous", "tous");
      if (aud) covers.audience = true;
      const len = days > 1 ? `, sur ${days} jours` : "";
      return { text: `Un stage de tennis pour ${who}${len}, au Tennis Club Houdan.`, covers };
    }
    case "ANIMATION":
      if (aud) { covers.audience = true; return { text: `Une animation pour ${low(aud)}, au Tennis Club Houdan.`, covers }; }
      return { text: "Une animation ouverte à tous, au Tennis Club Houdan.", covers };
    case "JUMELAGE": return { text: "Une rencontre amicale entre clubs jumelés.", covers };
    case "FETE": return { text: "Venez fêter ça ensemble, au Tennis Club Houdan !", covers };
    case "FETE_ECOLE": return { text: "Les enfants de l'école de tennis, leurs parents et leurs entraîneurs se retrouvent pour la fête.", covers };
    case "INSCRIPTIONS": return { text: "Venez rencontrer les entraîneurs et vous inscrire pour la nouvelle saison.", covers };
    case "DEBUT_COURS": return { text: "C'est la reprise : les cours recommencent !", covers };
    case "FIN_COURS": return { text: "Dernière séance de la saison : merci à tous !", covers };
    default: return { text: "", covers };
  }
}

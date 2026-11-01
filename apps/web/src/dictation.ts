// Dictée rapide de fin de cours : le coach écrit (ou dicte avec le micro de son clavier) une phrase par joueur,
// le site la découpe en étoiles. Tout se calcule dans le navigateur, rien n'est envoyé nulle part.
// Aucune intelligence artificielle : de simples règles d'écriture.

export interface DictPlayer { id: string; firstName: string }
export interface DictGoal { id: string; title: string; axis: string }
export interface DictLine { goalId?: string; quality?: "attitude" | "objectives"; stars: number; comment: string }
export interface DictResult {
  raw: string;
  playerId: string | null; playerName: string | null;
  label: string;            // ce que le site a compris (mission ou qualité)
  line: DictLine | null;
  warn: string;             // vide si tout est clair
  ok: boolean;              // false = il manque quelque chose, on ne remplit pas
}

const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[’']/g, " ");
const NUM: Record<string, number> = { un: 1, une: 1, deux: 2, trois: 3 };

// Cherche « +2 », « −1 », « plus deux », « moins un »
export function starsIn(text: string): number | null {
  const s = norm(text).replace(/[−–—]/g, "-");
  const m = s.match(/(^|[\s(])([+-])\s?([0-3])(?![0-9])/);
  if (m) return (m[2] === "+" ? 1 : -1) * parseInt(m[3], 10);
  const w = s.match(/\b(plus|moins)\s+(un|une|deux|trois)\b/);
  if (w) return (w[1] === "plus" ? 1 : -1) * NUM[w[2]];
  return null;
}

// Le thème d'une mission est la partie avant « : » (« Revers : ouvrir la raquette » → « revers »)
const topicOf = (title: string) => norm(title.split(":")[0]).trim();

export function parseDictation(text: string, players: DictPlayer[], goalsOf: (playerId: string) => DictGoal[]): DictResult[] {
  const segs = text.split(/[.;\n]+/).map((s) => s.trim()).filter(Boolean);
  const out: DictResult[] = [];
  let last: DictPlayer | null = null;
  for (const raw of segs) {
    const n = norm(raw);
    let who: DictPlayer | null = null;
    for (const p of players) if (new RegExp(`(^|[^a-z])${norm(p.firstName).trim()}($|[^a-z])`).test(n)) { who = p; break; }
    // Un prénom écrit en début de phrase que le site ne connaît pas : on ne le confond pas avec le joueur précédent
    const first = raw.match(/^[A-ZÉÈÀÂÎÔÛÇ][\p{L}-]{2,}/u)?.[0];
    if (!who && first) { out.push({ raw, playerId: null, playerName: null, label: "", line: null, ok: false, warn: `Je ne trouve pas « ${first} » parmi les joueurs de ce cours.` }); continue; }
    if (!who) who = last;
    if (who) last = who;
    const base: DictResult = { raw, playerId: who?.id ?? null, playerName: who?.firstName ?? null, label: "", line: null, warn: "", ok: false };
    if (!who) { out.push({ ...base, warn: "Quel joueur ? Écris son prénom au début de la phrase." }); continue; }

    const d = starsIn(raw);
    // Le mot de la phrase : on retire le prénom, le thème et le nombre d'étoiles
    let note = raw.replace(new RegExp(who.firstName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"), "")
      .replace(/(^|\s)(plus|moins)\s+(un|une|deux|trois)(?=\s|$|,)/i, " ")
      .replace(/(^|\s)[+\-−–—]\s?[0-3](?![0-9])/, " ");

    // 1) une mission du joueur dont le thème est cité
    const goals = goalsOf(who.id);
    const hit = goals.filter((g) => { const t = topicOf(g.title); return t.length > 2 && n.includes(t); });
    let line: DictLine | null = null, label = "", warn = "";
    if (hit.length) {
      const g = hit[0];
      const t = topicOf(g.title);
      note = note.replace(new RegExp(t.split(" ").join("\\s+"), "i"), " ");
      line = { goalId: g.id, stars: d ?? 0, comment: "" };
      label = g.title;
      if (hit.length > 1) warn = `Il y a ${hit.length} missions « ${g.title.split(":")[0].trim()} » : j'ai pris la première (« ${g.title} »). Vérifie.`;
    } else if (/\battitude\b/.test(n)) {
      line = { quality: "attitude", stars: d ?? 0, comment: "" }; label = "Attitude"; note = note.replace(/attitude/i, " ");
    } else if (/\bconcentration\b/.test(n)) {
      line = { quality: "objectives", stars: d ?? 0, comment: "" }; label = "Concentration sur ses objectifs"; note = note.replace(/concentration/i, " ");
    }
    note = note.replace(/\s+/g, " ").replace(/^[\s,:\-–—]+|[\s,:\-–—]+$/g, "").slice(0, 300);
    if (line) line.comment = note;

    let ok = true;
    if (!line) { ok = false; warn = goals.length ? `Je n'ai pas trouvé de quoi parler : dis le thème d'une mission de ${who.firstName} (ex. « ${topicOf(goals[0].title)} »), « attitude » ou « concentration ».` : `${who.firstName} n'a pas de mission ce trimestre : parle d'« attitude » ou de « concentration », ou fixe d'abord une mission.`; }
    else if (d === null) { ok = false; warn = "Combien d'étoiles ? Écris par exemple +2, −1, « plus un » ou « moins deux »."; }
    else if (d === 0) { ok = false; warn = "0 étoile : rien à enregistrer."; }
    else if (d < 0 && note.length < 3) { ok = false; warn = "Une étoile en moins a toujours besoin d'une explication : dis ce qui n'a pas été."; }
    out.push({ ...base, label, line: ok ? line : null, warn, ok });
  }
  return out;
}

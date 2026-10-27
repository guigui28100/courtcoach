import { useEffect, useState } from "react";
import { get } from "../api";
import { useAuth } from "../auth";

// « Prévenir par e-mail » : le site PRÉPARE le message, c'est le coach qui l'envoie depuis sa propre messagerie (lien « mailto: »).
// Aucun service extérieur, aucune pièce jointe, jamais de détail (ni nombre d'étoiles, ni note, ni contenu de vidéo) : seulement le sujet et le lien du site.
const TOPICS: { key: string; label: string; text: (who: string) => string; cta?: string }[] = [
  { key: "etoiles", label: "⭐ De nouvelles étoiles", text: (w) => `${w} a reçu de nouvelles étoiles.` },
  { key: "video", label: "🎬 Une vidéo ou une analyse", text: (w) => `Une vidéo ou une analyse est disponible pour ${w}.` },
  { key: "bulletin", label: "📄 Un bulletin", text: (w) => `Un bulletin est disponible pour ${w}.` },
  { key: "bilan", label: "🏆 Un bilan de tournoi", text: (w) => `Le bilan du dernier tournoi de ${w} est disponible.` },
  { key: "missions", label: "🚀 De nouvelles missions", text: (w) => `De nouvelles missions ont été fixées pour ${w}.` },
  { key: "matchs", label: "🏟️ Matchs et tournois", text: (w) => `Il y a une information sur les matchs et tournois de ${w}.` },
  { key: "autorisations", label: "✅ Autorisations à remplir", text: (w) => `Merci de remplir les autorisations de ${w} dans la rubrique « Mes autorisations » de son espace (une minute suffit). Le rappel disparaît dès que c'est fait.`, cta: "Pour le faire, connectez-vous ici :" },
  { key: "autre", label: "✏️ Autre (j'écris moi-même)", text: () => "" },
];

// « 🏆 Un bilan de tournoi » -> pastille (emoji + libellé) de l'e-mail mis en forme
const topicBadge = (label: string) => { const [emoji, ...r] = label.split(" "); return { emoji, label: r.join(" ").replace(/^(Un|Une|De|Des)\s+/i, "").replace(/^nouvelles?\s+/i, "nouvelles ") || "Message" }; };

export function MailParent({ email, firstName, initialTopic = "etoiles" }: { email: string; firstName: string; initialTopic?: string }) {
  const [open, setOpen] = useState(false);
  const [topic, setTopic] = useState(initialTopic);
  const [withName, setWithName] = useState(false); // prénom du mineur dans le mail : désactivé par défaut
  const who = withName ? firstName : "votre enfant";
  const t = TOPICS.find((x) => x.key === topic)!;
  const lines = ["Bonjour,", "", t.text(who) || "[Écrivez votre message ici]", `${t.cta ?? "Connectez-vous pour le voir :"} ${window.location.origin}`, "", "Bien cordialement,", "Le coach du Tennis Club Houdan"];
  return (
    <span className="grid gap-2">
      <button type="button" className="btn-outline btn-sm" aria-expanded={open} onClick={() => setOpen((o) => !o)}>✉️ Prévenir par e-mail</button>
      {open && (
        <span className="grid gap-2 rounded-xl border-2 border-line bg-white p-3">
          <fieldset className="m-0 grid gap-1 border-0 p-0">
            <legend className="mb-1 font-bold">De quoi veux-tu prévenir ?</legend>
            {TOPICS.map((x) => (
              <label key={x.key} className="flex min-h-10 items-center gap-2"><input type="radio" name={`mail-${email}`} checked={topic === x.key} onChange={() => setTopic(x.key)} />{x.label}</label>
            ))}
          </fieldset>
          <label className="flex min-h-10 items-center gap-2"><input type="checkbox" checked={withName} onChange={(e) => setWithName(e.target.checked)} />Mettre le prénom de l'enfant dans le mail</label>
          <pre className="m-0 whitespace-pre-wrap rounded-lg bg-sand/60 p-2 font-sans text-sm" aria-label="Aperçu du message">{lines.join("\n")}</pre>
          <small className="hint">Choisis comment ouvrir ta messagerie : tu peux modifier le message, puis tu appuies sur « Envoyer ». Rien n'est envoyé par le site.</small>
          <MailLinks to={email} subject="Du nouveau sur CourtCoach" lines={lines} rich={{ title: "Du nouveau sur CourtCoach", topic: topicBadge(t.label), paragraphs: [t.text(who) || "[Écrivez votre message ici]"], button: { label: t.cta ? "Ouvrir mes autorisations →" : "Ouvrir CourtCoach →", url: window.location.origin } }} />
        </span>
      )}
    </span>
  );
}

// Bandeau « Prévenir la famille » placé en haut des onglets Missions et Bulletins de la fiche (coach seulement) : un bouton par compte parent, sujet déjà choisi
export function MailFamilyBar({ playerId, firstName, topic }: { playerId: string; firstName: string; topic: "missions" | "bulletin" | "bilan" }) {
  const isCoach = useAuth().me?.role === "COACH";
  const [parents, setParents] = useState<{ userId: string; email: string; role: string }[] | null>(null);
  useEffect(() => { if (isCoach) get<{ userId: string; email: string; role: string }[]>(`/players/${playerId}/access`).then((l) => setParents(l.filter((a) => a.role === "GUARDIAN"))).catch(() => setParents([])); }, [isCoach, playerId]);
  if (!isCoach || parents === null) return null;
  return (
    <section className="card grid gap-2" aria-label="Prévenir la famille">
      <h3 className="m-0 text-lg">✉️ Prévenir la famille</h3>
      {parents.length === 0
        ? <p className="hint m-0">Aucun compte parent pour l'instant : crée l'accès ou l'invitation dans l'onglet « Accords et famille ».</p>
        : parents.map((a) => (
          <span key={a.userId} className="grid gap-1"><small className="hint">{a.email}</small><MailParent email={a.email} firstName={firstName} initialTopic={topic} /></span>
        ))}
    </section>
  );
}

// Message mis en forme, au style de la PAGE D'ACCUEIL de CourtCoach (choisi par le coach) : en-tête avec la balle, bandeau terre battue avec grand titre, petit court dessiné et gros bouton jaune, cartes sable numérotées, encadré « données protégées », pied bleu nuit. Que du HTML avec styles dans les balises (aucune image, aucun appel à un autre site) : il passe dans Gmail, Outlook et la messagerie Orange quand on le COLLE.
export interface RichMail { title: string; paragraphs: string[]; button: { label: string; url: string }; topic?: { emoji: string; label: string }; about?: { title: string; text: string }; steps?: { title: string; text: string }[]; note?: string }
const esc = (x: string) => x.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
export function richMailHtml(m: RichMail) {
  const url = esc(m.button.url);
  const D = "font-family:'Cormorant Garamond',Georgia,'Times New Roman',serif"; // titres (comme le site)
  const B = "font-family:'Atkinson Hyperlegible',Arial,Helvetica,sans-serif";
  const [sub, ...rest] = m.paragraphs;
  const line = "rgba(255,255,255,.45)";
  // Terrain aux vraies proportions (23,77 × 10,97 m : couloirs 12,5 %, lignes de service à 23 % de chaque bout, filet au milieu), en simple tableau HTML
  const ln = `2px solid ${line}`;
  const court = `<table role="presentation" cellpadding="0" cellspacing="0" width="160" style="width:160px;height:74px;border-collapse:collapse;border:${ln}"><tr><td colspan="4" height="9" style="height:9px;font-size:0;line-height:0;border-bottom:${ln}">&nbsp;</td></tr><tr><td rowspan="2" width="37" style="width:37px;border-right:${ln}">&nbsp;</td><td width="43" height="28" style="width:43px;height:28px;border-bottom:${ln};border-right:4px solid ${line}">&nbsp;</td><td width="43" style="width:43px;border-bottom:${ln};text-align:center;font-size:16px;line-height:18px">&#3a7a56;</td><td rowspan="2" width="37" style="width:37px;border-left:${ln}">&nbsp;</td></tr><tr><td height="28" style="height:28px">&nbsp;</td><td>&nbsp;</td></tr><tr><td colspan="4" height="9" style="height:9px;font-size:0;line-height:0;border-top:${ln}">&nbsp;</td></tr></table>`;
  const ball = `<span style="display:inline-block;width:30px;height:30px;border-radius:15px;background:#c9ad77;border:1px solid #b3925a;text-align:center;line-height:30px;font-size:16px;vertical-align:middle">&#3a7a56;</span>`;
  const topic = m.topic ? `<div style="margin-top:12px"><span style="display:inline-block;background:rgba(255,255,255,.18);border:1px solid rgba(255,255,255,.5);border-radius:14px;padding:4px 12px;${B};font-size:12px;font-weight:bold;letter-spacing:2px;color:#ffffff">${m.topic.emoji} ${esc(m.topic.label.toUpperCase())}</span></div>` : "";
  const about = m.about ? `<tr><td style="padding:26px 28px 6px"><div style="${D};font-weight:900;font-size:22px;color:#17140f">${esc(m.about.title)}</div><div style="font-size:15px;line-height:24px;color:#5e574a;margin-top:6px">${esc(m.about.text)}</div></td></tr>` : "";
  const card = (n: number, x: { title: string; text: string }) => `<tr><td style="padding:5px 0"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#efe8da;border-radius:16px"><tr><td width="64" valign="top" style="padding:16px 0 16px 16px"><div style="width:34px;height:34px;border-radius:17px;background:#17140f;color:#c9ad77;${D};font-weight:900;font-size:17px;line-height:34px;text-align:center">${n}</div></td><td style="padding:14px 18px 14px 4px;${B};font-size:15px;line-height:22px;color:#17140f"><b style="font-size:16px">${esc(x.title)}</b><br><span style="color:#5e574a">${esc(x.text)}</span></td></tr></table></td></tr>`;
  const steps = m.steps?.length ? `<tr><td style="padding:18px 28px 4px"><div style="${D};font-weight:900;font-size:22px;color:#17140f">&Agrave; faire en premier</div></td></tr><tr><td style="padding:6px 28px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0">${m.steps.map((x, i) => card(i + 1, x)).join("")}</table></td></tr>` : "";
  const others = rest.length ? `<tr><td style="padding:18px 28px 0;${B};font-size:15px;line-height:23px;color:#5e574a">${rest.map((x) => esc(x)).join("<br><br>")}</td></tr>` : "";
  const outline = (!m.about && !m.steps) ? `<tr><td style="padding:24px 28px 6px;${B};font-size:15px;line-height:24px;color:#5e574a">Connectez-vous avec votre adresse e-mail et votre mot de passe : tout est dans l&rsquo;espace CourtCoach.</td></tr>` : "";
  const lock = `<tr><td style="padding:16px 28px 22px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff;border:1px solid #ddd3c0;border-radius:14px"><tr><td style="padding:13px 16px;${B};font-size:14px;line-height:21px;color:#17140f">&#3a7a56; Donn&eacute;es prot&eacute;g&eacute;es, aucun suivi publicitaire, jeunes cloisonn&eacute;s des adultes.${m.note ? " " + esc(m.note) : ""}</td></tr></table><div style="${B};font-size:12px;color:#7a7261;margin-top:10px">Si le bouton ne marche pas, copiez ce lien : ${url}</div></td></tr>`;
  return `<div style="background:#faf6ee;padding:0;margin:0;${B}"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;background:#faf6ee">`
    + `<tr><td style="background:#faf6ee;padding:16px 28px;border-bottom:1px solid #ddd3c0"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td>${ball} <span style="${D};font-weight:900;font-size:22px;color:#17140f;vertical-align:middle;margin-left:6px">CourtCoach</span></td><td align="right" style="${B};font-size:12px;letter-spacing:2px;font-weight:bold;color:#5e574a">TENNIS CLUB HOUDAN</td></tr></table></td></tr>`
    + `<tr><td bgcolor="#17140f" style="background:#17140f;background-image:linear-gradient(135deg,#17140f,#2b261d);padding:36px 28px 32px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td valign="middle"><div style="${D};font-weight:900;font-size:34px;line-height:38px;color:#ffffff;letter-spacing:-.5px">${esc(m.title)}</div>${topic}${sub ? `<div style="font-size:16px;line-height:24px;color:#efe5cd;margin-top:12px">${esc(sub)}</div>` : ""}<div style="margin-top:22px"><a href="${url}" style="display:inline-block;background:#c9ad77;color:#17140f;text-decoration:none;${B};font-weight:bold;font-size:17px;padding:15px 28px;border-radius:30px">${esc(m.button.label)}</a></div></td><td width="170" align="right" valign="middle">${court}</td></tr></table></td></tr>`
    + `${about}${steps}${others}${outline}${lock}`
    + `<tr><td bgcolor="#17140f" style="background:#17140f;padding:16px 28px;${B};font-size:12px;line-height:18px;color:#ddd3c0"><b style="color:#ffffff">Tennis Club Houdan</b> &middot; CourtCoach &nbsp; Association &agrave; but non lucratif &middot; Aucun d&eacute;tail personnel dans ce mail<br><span style="color:#ffffff">Bien cordialement, le coach du Tennis Club Houdan</span></td></tr>`
    + `</table></div>`;
}

// Les moyens d'ouvrir le message : messagerie de l'ordinateur / du téléphone (mailto), Gmail, Outlook (sites ouverts SEULEMENT si le coach clique), ou copie du texte à coller dans n'importe quelle messagerie.
// Avec `rich` : un bouton « Copier le message mis en forme » ; Gmail et Outlook s'ouvrent alors avec l'adresse et l'objet, SANS texte (le message mis en forme se colle avec Ctrl+V).
export function MailLinks({ to, subject, lines, rich }: { to: string; subject: string; lines: string[]; rich?: RichMail }) {
  const [copied, setCopied] = useState("");
  const text = lines.join("\n"), q = (x: string) => encodeURIComponent(x);
  const mailto = `mailto:${to}?subject=${q(subject)}&body=${q(lines.join("\r\n"))}`;
  const body = rich ? "" : `&body=${q(text)}`;
  const gmail = `https://mail.google.com/mail/?view=cm&fs=1&to=${q(to)}&su=${q(subject)}${body}`;
  const outlook = `https://outlook.live.com/mail/0/deeplink/compose?to=${q(to)}&subject=${q(subject)}${body}`;
  async function copy(what: string, value: string) {
    try { await navigator.clipboard.writeText(value); setCopied(what); } catch { setCopied("erreur"); }
    setTimeout(() => setCopied(""), 4000);
  }
  async function copyRich() {
    if (!rich) return;
    try {
      const html = richMailHtml(rich);
      if (typeof ClipboardItem !== "undefined" && navigator.clipboard.write) await navigator.clipboard.write([new ClipboardItem({ "text/html": new Blob([html], { type: "text/html" }), "text/plain": new Blob([text], { type: "text/plain" }) })]);
      else await navigator.clipboard.writeText(text);
      setCopied("rich");
    } catch { setCopied("erreur"); }
    setTimeout(() => setCopied(""), 5000);
  }
  return (
    <span className="grid gap-2">
      {rich && <span className="flex flex-wrap gap-2"><button type="button" className="btn-clay btn-sm" onClick={copyRich}>📋 Copier le message mis en forme</button></span>}
      <span className="flex flex-wrap gap-2">
        <a className={rich ? "btn-outline btn-sm" : "btn-clay btn-sm"} href={mailto}>Ouvrir ma messagerie →</a>
        <a className="btn-outline btn-sm" href={gmail} target="_blank" rel="noopener noreferrer">Gmail</a>
        <a className="btn-outline btn-sm" href={outlook} target="_blank" rel="noopener noreferrer">Outlook / Hotmail</a>
      </span>
      <span className="flex flex-wrap gap-2">
        <button type="button" className="btn-outline btn-sm" onClick={() => copy("message", `Objet : ${subject}\n\n${text}`)}>📋 Copier le message (texte simple)</button>
        <button type="button" className="btn-outline btn-sm" onClick={() => copy("adresse", to)}>📋 Copier l'adresse</button>
      </span>
      <small className="hint" role="status">{copied === "erreur" ? "La copie n'a pas marché : sélectionne le texte à la main." : copied === "rich" ? "✅ Message mis en forme copié : ouvre Gmail, Outlook ou Orange (adresse et objet déjà remplis avec Gmail), puis colle avec Ctrl+V." : copied ? `✅ ${copied === "message" ? "Message copié" : "Adresse copiée"} : colle-le dans ta messagerie (Orange, Yahoo, Gmail…).` : rich ? "1) Copie le message mis en forme. 2) Ouvre ta messagerie (Gmail ou Outlook : adresse et objet déjà remplis). 3) Colle avec Ctrl+V, relis, envoie. Le texte simple reste disponible en secours." : "Si ta messagerie ne s'ouvre pas (cas fréquent avec Orange ou Wanadoo), utilise Gmail, Outlook ou la copie."}</small>
    </span>
  );
}

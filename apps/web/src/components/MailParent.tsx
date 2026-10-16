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
          <MailLinks to={email} subject="Du nouveau sur CourtCoach" lines={lines} rich={{ title: "Du nouveau sur CourtCoach", paragraphs: [t.text(who) || "[Écrivez votre message ici]"], button: { label: t.cta ? "Ouvrir mes autorisations →" : "Ouvrir CourtCoach →", url: window.location.origin } }} />
        </span>
      )}
    </span>
  );
}

// Bandeau « Prévenir la famille » placé en haut des onglets Missions et Bulletins de la fiche (coach seulement) : un bouton par compte parent, sujet déjà choisi
export function MailFamilyBar({ playerId, firstName, topic }: { playerId: string; firstName: string; topic: "missions" | "bulletin" | "bilan" }) {
  const isCoach = useAuth().me?.role === "COACH";
  const [parents, setParents] = useState<{ userId: string; email: string; role: string }[] | null>(null);
  useEffect(() => { if (isCoach) get<{ userId: string; email: string; role: string }[]>(`/players/${playerId}/access`).then((l) => setParents(l.filter((a) => a.role !== "YOUTH"))).catch(() => setParents([])); }, [isCoach, playerId]);
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

// Message mis en forme (proposition « court de tennis ») : bandeau vert, gros bouton jaune, pied de page. Que du HTML avec styles dans les balises (aucune image, aucun appel à un autre site) : il passe dans Gmail, Outlook et la messagerie Orange quand on le COLLE.
export interface RichMail { title: string; paragraphs: string[]; button: { label: string; url: string } }
const esc = (x: string) => x.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
export function richMailHtml(m: RichMail) {
  const url = esc(m.button.url);
  return `<div style="background:#dfe7dc;padding:20px;font-family:Arial,Helvetica,sans-serif"><table role="presentation" width="520" align="center" cellpadding="0" cellspacing="0" style="max-width:100%;background:#ffffff;border-radius:14px;overflow:hidden"><tr><td style="background:#1f7a4d;border-bottom:6px solid #dcf247;padding:26px 24px 20px;text-align:center;color:#ffffff"><div style="font-size:38px;line-height:1.2">&#127934;</div><div style="font-size:24px;font-weight:bold">${esc(m.title)}</div><div style="font-size:13px">Tennis Club Houdan</div></td></tr><tr><td style="padding:24px;font-size:16px;line-height:1.6;color:#10203a">Bonjour,<br><br>${m.paragraphs.map((x) => esc(x)).join("<br><br>")}<br><br><a href="${url}" style="display:block;text-align:center;background:#f5c518;color:#10203a;font-weight:bold;text-decoration:none;border-radius:12px;padding:14px;border:3px solid #10203a">${esc(m.button.label)}</a><div style="font-size:12px;color:#51607a;margin-top:8px">Si le bouton ne marche pas, copiez ce lien : ${url}</div><br>Bien cordialement,<br><b>Le coach du Tennis Club Houdan</b></td></tr><tr><td style="background:#10203a;color:#cfd8e8;text-align:center;font-size:12px;padding:14px">Message du Tennis Club Houdan &middot; Aucun d&eacute;tail personnel dans ce mail</td></tr></table></div>`;
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

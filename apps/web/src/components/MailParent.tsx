import { useEffect, useState } from "react";
import { get } from "../api";
import { useAuth } from "../auth";

// « Prévenir par e-mail » : le site PRÉPARE le message, c'est le coach qui l'envoie depuis sa propre messagerie (lien « mailto: »).
// Aucun service extérieur, aucune pièce jointe, jamais de détail (ni nombre d'étoiles, ni note, ni contenu de vidéo) : seulement le sujet et le lien du site.
const TOPICS: { key: string; label: string; text: (who: string) => string; cta?: string }[] = [
  { key: "etoiles", label: "⭐ De nouvelles étoiles", text: (w) => `${w} a reçu de nouvelles étoiles.` },
  { key: "video", label: "🎬 Une vidéo ou une analyse", text: (w) => `Une vidéo ou une analyse est disponible pour ${w}.` },
  { key: "bulletin", label: "📄 Un bulletin", text: (w) => `Un bulletin est disponible pour ${w}.` },
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
          <MailLinks to={email} subject="Du nouveau sur CourtCoach" lines={lines} />
        </span>
      )}
    </span>
  );
}

// Bandeau « Prévenir la famille » placé en haut des onglets Missions et Bulletins de la fiche (coach seulement) : un bouton par compte parent, sujet déjà choisi
export function MailFamilyBar({ playerId, firstName, topic }: { playerId: string; firstName: string; topic: "missions" | "bulletin" }) {
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

// Les moyens d'ouvrir le message : messagerie de l'ordinateur / du téléphone (mailto), Gmail, Outlook (sites ouverts SEULEMENT si le coach clique), ou copie du texte à coller dans n'importe quelle messagerie
export function MailLinks({ to, subject, lines }: { to: string; subject: string; lines: string[] }) {
  const [copied, setCopied] = useState("");
  const text = lines.join("\n"), q = (x: string) => encodeURIComponent(x);
  const mailto = `mailto:${to}?subject=${q(subject)}&body=${q(lines.join("\r\n"))}`;
  const gmail = `https://mail.google.com/mail/?view=cm&fs=1&to=${q(to)}&su=${q(subject)}&body=${q(text)}`;
  const outlook = `https://outlook.live.com/mail/0/deeplink/compose?to=${q(to)}&subject=${q(subject)}&body=${q(text)}`;
  async function copy(what: string, value: string) {
    try { await navigator.clipboard.writeText(value); setCopied(what); } catch { setCopied("erreur"); }
    setTimeout(() => setCopied(""), 3000);
  }
  return (
    <span className="grid gap-2">
      <span className="flex flex-wrap gap-2">
        <a className="btn-clay btn-sm" href={mailto}>Ouvrir ma messagerie →</a>
        <a className="btn-outline btn-sm" href={gmail} target="_blank" rel="noopener noreferrer">Gmail</a>
        <a className="btn-outline btn-sm" href={outlook} target="_blank" rel="noopener noreferrer">Outlook / Hotmail</a>
      </span>
      <span className="flex flex-wrap gap-2">
        <button type="button" className="btn-outline btn-sm" onClick={() => copy("message", `Objet : ${subject}\n\n${text}`)}>📋 Copier le message</button>
        <button type="button" className="btn-outline btn-sm" onClick={() => copy("adresse", to)}>📋 Copier l'adresse</button>
      </span>
      <small className="hint" role="status">{copied === "erreur" ? "La copie n'a pas marché : sélectionne le texte à la main." : copied ? `✅ ${copied === "message" ? "Message copié" : "Adresse copiée"} : colle-le dans ta messagerie (Orange, Yahoo, Gmail…).` : "Si ta messagerie ne s'ouvre pas (cas fréquent avec Orange ou Wanadoo), utilise Gmail, Outlook ou la copie."}</small>
    </span>
  );
}

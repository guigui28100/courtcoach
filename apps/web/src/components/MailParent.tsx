import { useState } from "react";

// « Prévenir par e-mail » : le site PRÉPARE le message, c'est le coach qui l'envoie depuis sa propre messagerie (lien « mailto: »).
// Aucun service extérieur, aucune pièce jointe, jamais de détail (ni nombre d'étoiles, ni note, ni contenu de vidéo) : seulement le sujet et le lien du site.
const TOPICS: { key: string; label: string; text: (who: string) => string }[] = [
  { key: "etoiles", label: "⭐ De nouvelles étoiles", text: (w) => `${w} a reçu de nouvelles étoiles.` },
  { key: "video", label: "🎬 Une vidéo ou une analyse", text: (w) => `Une vidéo ou une analyse est disponible pour ${w}.` },
  { key: "bulletin", label: "📄 Un bulletin", text: (w) => `Un bulletin est disponible pour ${w}.` },
  { key: "missions", label: "🚀 De nouvelles missions", text: (w) => `De nouvelles missions ont été fixées pour ${w}.` },
  { key: "matchs", label: "🏟️ Matchs et tournois", text: (w) => `Il y a une information sur les matchs et tournois de ${w}.` },
  { key: "autre", label: "✏️ Autre (j'écris moi-même)", text: () => "" },
];

export function MailParent({ email, firstName }: { email: string; firstName: string }) {
  const [open, setOpen] = useState(false);
  const [topic, setTopic] = useState("etoiles");
  const [withName, setWithName] = useState(false); // prénom du mineur dans le mail : désactivé par défaut
  const who = withName ? firstName : "votre enfant";
  const t = TOPICS.find((x) => x.key === topic)!;
  const lines = ["Bonjour,", "", t.text(who) || "[Écrivez votre message ici]", `Connectez-vous pour le voir : ${window.location.origin}`, "", "Bien cordialement,", "Le coach du Tennis Club Houdan"];
  const href = `mailto:${email}?subject=${encodeURIComponent("Du nouveau sur CourtCoach")}&body=${encodeURIComponent(lines.join("\r\n"))}`;
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
          <small className="hint">Ta messagerie s'ouvre avec ce message : tu peux le modifier, puis tu appuies sur « Envoyer ». Rien n'est envoyé par le site.</small>
          <a className="btn-clay btn-sm justify-self-start" href={href}>Ouvrir ma messagerie →</a>
        </span>
      )}
    </span>
  );
}

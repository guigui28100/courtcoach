import { FormEvent, useCallback, useEffect, useState } from "react";
import { del, get, post } from "../api";
import { Err } from "./ui";
import { MailLinks } from "./MailParent";

type Access = { users: { id: string; email: string; firstName: string | null; role: "PRESIDENT" | "BUREAU"; createdAt: string }[]; invitations: { id: string; email: string; role: "PRESIDENT" | "BUREAU"; expiresAt: string }[] };
const LABEL = { PRESIDENT: "👔 Président", BUREAU: "📋 Membre du bureau" } as const;

// Message d'invitation préparé (le coach l'envoie lui-même : rien n'est envoyé par le site ; le mot de passe n'y figure jamais)
function inviteLines(url: string, role: "PRESIDENT" | "BUREAU", days: number) {
  const what = role === "PRESIDENT"
    ? "Vous pourrez gérer le planning du club (tournois, animations, stages, affiches) et suivre les cours particuliers des professeurs et les demandes de cours des adhérents."
    : "Vous pourrez consulter le planning du club en lecture seule : vous ne pourrez rien créer ni modifier.";
  return ["Bonjour,", "", `Vous êtes invité(e) à ouvrir votre accès ${role === "PRESIDENT" ? "de président" : "de membre du bureau"} sur CourtCoach, l'application du Tennis Club Houdan.`, "", what, "", `Cliquez sur ce lien personnel pour choisir votre mot de passe (valable ${days} jours, à usage unique) :`, url, "", "Votre identifiant sera cette adresse e-mail. Ne partagez pas ce lien.", "", "Sportivement,"];
}

// Accès du club (coach seulement) : inviter le président et les membres du bureau, voir qui a un accès, le retirer
export function ClubAccess() {
  const [data, setData] = useState<Access | null>(null);
  const [err, setErr] = useState("");
  const [link, setLink] = useState<{ url: string; email: string; role: "PRESIDENT" | "BUREAU"; days: number } | null>(null);
  const load = useCallback(() => { get<Access>("/club-access").then(setData).catch((e) => setErr((e as Error).message)); }, []);
  useEffect(load, [load]);

  async function invite(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); const form = e.currentTarget; const f = new FormData(form); setErr(""); setLink(null);
    const email = String(f.get("email")).trim().toLowerCase(), role = f.get("role") as "PRESIDENT" | "BUREAU";
    try {
      const r = await post<{ token: string; expiresInDays: number }>("/club-access/invitations", { email, role });
      setLink({ url: `${window.location.origin}/invitation/${r.token}`, email, role, days: r.expiresInDays }); form.reset(); load();
    } catch (x) { setErr((x as Error).message); }
  }
  async function removeUser(id: string, name: string) {
    if (!confirm(`Retirer l'accès de ${name} ? Son compte est fermé tout de suite.`)) return;
    setErr(""); try { await del(`/club-access/users/${id}`); load(); } catch (x) { setErr((x as Error).message); }
  }
  async function cancelInvitation(id: string) { setErr(""); try { await del(`/club-access/invitations/${id}`); load(); } catch (x) { setErr((x as Error).message); } }

  return (
    <section className="card grid gap-3" aria-labelledby="s-club">
      <h2 id="s-club" className="m-0">🔑 Accès du club</h2>
      <p className="hint m-0">Le <strong>président</strong> gère le planning du club et voit les cours particuliers (professeurs et demandes de cours). Les <strong>membres du bureau</strong> voient seulement le planning du club : ils ne peuvent rien créer ni modifier. Aucun des deux n'a accès aux jeunes du Centre de compétition ni aux vidéos.</p>
      {data && (data.users.length > 0 || data.invitations.length > 0) && (
        <ul className="m-0 grid list-none gap-2 p-0">
          {data.users.map((u) => (
            <li key={u.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border-2 border-line bg-white px-3 py-2">
              <span><strong>{LABEL[u.role]}</strong> · {u.firstName ? `${u.firstName} · ` : ""}{u.email}</span>
              <button type="button" className="btn-outline btn-sm !border-[#b42318] !text-[#b42318]" onClick={() => removeUser(u.id, u.firstName || u.email)}>Retirer l'accès</button>
            </li>))}
          {data.invitations.map((i) => (
            <li key={i.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border-2 border-dashed border-line bg-[#fbf8f2] px-3 py-2">
              <span>⏳ <strong>{LABEL[i.role]}</strong> · {i.email} · invitation en attente (jusqu'au {new Date(i.expiresAt).toLocaleDateString("fr-FR")})</span>
              <button type="button" className="btn-outline btn-sm" onClick={() => cancelInvitation(i.id)}>Annuler l'invitation</button>
            </li>))}
        </ul>)}
      {data && data.users.length === 0 && data.invitations.length === 0 && <p className="m-0 text-muted">Aucun accès pour l'instant.</p>}
      <form onSubmit={invite} className="grid gap-2 sm:grid-cols-[1fr_auto_auto]" noValidate>
        <input name="email" type="email" required maxLength={254} className="input" placeholder="E-mail de la personne" aria-label="E-mail de la personne à inviter" />
        <select name="role" className="input" aria-label="Rôle"><option value="PRESIDENT">👔 Président (gère)</option><option value="BUREAU">📋 Bureau (voit seulement)</option></select>
        <button className="btn-clay">Inviter</button>
      </form>
      <Err msg={err} />
      {link && (
        <div className="rounded-xl bg-sand p-3">
          <p className="m-0 font-bold">Lien à envoyer (valable {link.days} jours, affiché une seule fois) :</p>
          <input readOnly className="input mt-2" value={link.url} onFocus={(e) => e.currentTarget.select()} aria-label="Lien d'invitation" />
          <div className="mt-3"><MailLinks to={link.email} subject="Votre accès CourtCoach" lines={inviteLines(link.url, link.role, link.days)} /></div>
          <p className="hint m-0 mt-1">Le mot de passe n'est jamais dans le mail : la personne le choisit elle-même en cliquant sur le lien. Rien n'est envoyé par le site : c'est toi qui envoies le message.</p>
        </div>)}
    </section>
  );
}

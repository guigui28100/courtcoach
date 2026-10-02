import { FormEvent, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { post } from "../api";
import { useAuth } from "../auth";
import { homeFor } from "../components/Guard";
import { Err, Field, PageHead } from "../components/ui";

// Première connexion avec un mot de passe provisoire : on choisit son propre mot de passe.
export default function ChangePassword() {
  const { me, reload } = useAuth();
  const nav = useNavigate();
  const [error, setError] = useState("");
  if (!me) return <Navigate to="/connexion" replace />;
  const forced = !!me.mustChangePassword;

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setError("");
    if (f.get("next") !== f.get("again")) { setError("Les deux mots de passe ne sont pas identiques."); return; }
    try {
      await post("/auth/change-password", { currentPassword: String(f.get("current")), newPassword: String(f.get("next")), acceptPolicy: forced ? f.get("policy") === "on" : undefined });
      await reload();
      nav(homeFor(me!.role), { replace: true });
    } catch (err) { setError((err as Error).message); }
  }

  return (
    <>
      <PageHead title={forced ? "Choisis ton mot de passe" : "Changer mon mot de passe"}>
        {forced ? "Le mot de passe que le club t'a donné est provisoire. Choisis-en un que toi seul connais : personne, pas même le coach, ne pourra le lire." : "Choisis un nouveau mot de passe."}
      </PageHead>
      <div className="mx-auto grid max-w-lg gap-4 px-4 py-8">
        <form onSubmit={submit} className="card grid gap-4" noValidate>
          <Field label={forced ? "Mot de passe provisoire" : "Mot de passe actuel"} id="current"><input id="current" name="current" type="password" required maxLength={128} className="input" autoComplete="current-password" /></Field>
          <Field label="Nouveau mot de passe" id="next" hint="10 caractères minimum. Une phrase facile à retenir est idéale."><input id="next" name="next" type="password" required minLength={10} maxLength={128} className="input" autoComplete="new-password" /></Field>
          <Field label="Nouveau mot de passe (encore une fois)" id="again"><input id="again" name="again" type="password" required maxLength={128} className="input" autoComplete="new-password" /></Field>
          {forced && (
            <label className="flex items-start gap-3 text-sm">
              <input type="checkbox" name="policy" required className="mt-1 h-5 w-5 accent-clay" />
              <span>J'ai lu la <Link to="/confidentialite" target="_blank" className="font-bold text-clay underline">politique de confidentialité</Link>.</span>
            </label>
          )}
          <Err msg={error} />
          <button className="btn-clay w-full">Enregistrer mon mot de passe</button>
        </form>
      </div>
    </>
  );
}

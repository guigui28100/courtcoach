import { FormEvent, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { get } from "../api";
import { useAuth } from "../auth";
import { Err, Field, PageHead } from "../components/ui";

export default function Invitation() {
  const { token = "" } = useParams();
  const { acceptInvitation } = useAuth();
  const nav = useNavigate();
  const [info, setInfo] = useState<{ email: string; role: string; playerFirstName: string } | null>(null);
  const [invalid, setInvalid] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => { get(`/auth/invitations/${encodeURIComponent(token)}`).then(setInfo).catch(() => setInvalid(true)); }, [token]);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setError("");
    try {
      await acceptInvitation({ token, password: String(f.get("password")), firstName: String(f.get("firstName") || "") || undefined, acceptPolicy: f.get("policy") === "on" });
      nav("/suivi");
    } catch (err) { setError((err as Error).message); }
  }

  if (invalid) return (<><PageHead title="Invitation introuvable" /><p className="mx-auto max-w-lg p-6">Ce lien a déjà été utilisé ou a expiré. Demande un nouveau lien à ton coach.</p></>);
  if (!info) return <p className="p-8 text-center text-muted">Chargement…</p>;
  return (
    <>
      <PageHead eyebrow="Invitation du coach" title={`Suivi de ${info.playerFirstName}`}>
        Crée ton accès pour consulter, en lecture seule, les objectifs, les évaluations et les bulletins.
      </PageHead>
      <div className="mx-auto grid max-w-lg gap-4 px-4 py-8">
        <form onSubmit={submit} className="card grid gap-4" noValidate>
          <p className="m-0 text-sm text-muted">Compte pour : <strong>{info.email}</strong></p>
          <Field label="Prénom (facultatif)" id="firstName"><input id="firstName" name="firstName" className="input" maxLength={60} autoComplete="given-name" /></Field>
          <Field label="Choisis un mot de passe" id="password" hint="10 caractères minimum."><input id="password" name="password" type="password" required minLength={10} maxLength={128} className="input" autoComplete="new-password" /></Field>
          <label className="flex items-start gap-3 text-sm">
            <input type="checkbox" name="policy" required className="mt-1 h-5 w-5 accent-clay" />
            <span>J'ai lu la <Link to="/confidentialite" target="_blank" className="font-bold text-clay underline">politique de confidentialité</Link>.</span>
          </label>
          <Err msg={error} />
          <button className="btn-clay w-full">Créer mon accès</button>
        </form>
      </div>
    </>
  );
}

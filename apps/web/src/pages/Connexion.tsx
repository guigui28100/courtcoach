import { FormEvent, useState } from "react";
import { Link, Navigate, useLocation, useSearchParams } from "react-router-dom";
import { ApiError } from "../api";
import { useAuth } from "../auth";
import { homeFor } from "../components/Guard";
import { Err, Field, PageHead } from "../components/ui";

export default function Connexion() {
  const { me, login, signup } = useAuth();
  const [params] = useSearchParams();
  const [mode, setMode] = useState<"connexion" | "inscription">(params.get("mode") === "inscription" ? "inscription" : "connexion");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [needCode, setNeedCode] = useState(false); // le coach a la double authentification
  const from = (useLocation().state as { from?: string } | null)?.from;
  if (me) return <Navigate to={from && from !== "/connexion" ? from : homeFor(me.role)} replace />;

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setError(""); setBusy(true);
    try {
      if (mode === "connexion") await login(String(f.get("email")), String(f.get("password")), String(f.get("code") || "") || undefined);
      else await signup({ email: String(f.get("email")), password: String(f.get("password")), firstName: String(f.get("firstName") || "") || undefined, acceptPolicy: f.get("policy") === "on" });
    } catch (err) { if ((err as ApiError).code === "TOTP_REQUIRED") setNeedCode(true); setError((err as Error).message); } finally { setBusy(false); }
  }

  return (
    <>
      <PageHead title={mode === "connexion" ? "Se connecter" : "Créer mon compte"}>
        {mode === "connexion" ? "Content de te revoir !" : "Gratuit pour les adhérents adultes du club."}
      </PageHead>
      <div className="mx-auto grid max-w-lg gap-4 px-4 py-8">
        <div role="tablist" aria-label="Connexion ou inscription" className="grid grid-cols-2 gap-2 rounded-full bg-sand p-1">
          {(["connexion", "inscription"] as const).map((m) => (
            <button key={m} role="tab" aria-selected={mode === m} onClick={() => { setMode(m); setError(""); }}
              className={"min-h-11 rounded-full font-bold " + (mode === m ? "bg-white text-ink shadow" : "text-muted")}>{m === "connexion" ? "J'ai un compte" : "Je suis nouveau"}</button>
          ))}
        </div>

        <form onSubmit={submit} className="card grid gap-4" noValidate>
          {mode === "inscription" && (
            <>
              <p className="alert m-0">Inscription réservée aux <strong>adultes</strong>. Pour un jeune du Centre de compétition, c'est le coach qui crée la fiche puis invite le parent par un lien personnel.</p>
              <Field label="Prénom (facultatif)" id="firstName"><input id="firstName" name="firstName" className="input" autoComplete="given-name" maxLength={60} /></Field>
            </>
          )}
          <Field label="Adresse e-mail" id="email"><input id="email" name="email" type="email" required className="input" autoComplete="email" maxLength={254} /></Field>
          <Field label="Mot de passe" id="password" hint={mode === "inscription" ? "10 caractères minimum. Une phrase facile à retenir est idéale." : undefined}>
            <input id="password" name="password" type="password" required minLength={mode === "inscription" ? 10 : 1} className="input" autoComplete={mode === "inscription" ? "new-password" : "current-password"} maxLength={128} />
          </Field>
          {mode === "connexion" && needCode && (
            <Field label="Code à 6 chiffres (application d'authentification)" id="code" hint="Tu peux aussi utiliser un code de secours.">
              <input id="code" name="code" required autoFocus inputMode="numeric" autoComplete="one-time-code" maxLength={20} className="input" />
            </Field>
          )}
          {mode === "inscription" && (
            <label className="flex items-start gap-3 text-sm">
              <input type="checkbox" name="policy" required className="mt-1 h-5 w-5 accent-clay" />
              <span>J'ai lu la <Link to="/confidentialite" target="_blank" className="font-bold text-clay underline">politique de confidentialité</Link> : mes informations ne servent qu'au suivi au club.</span>
            </label>
          )}
          <Err msg={error} />
          <button className="btn-clay w-full" disabled={busy}>{busy ? "Un instant…" : mode === "connexion" ? "Se connecter" : "Créer mon compte"}</button>
        </form>
      </div>
    </>
  );
}

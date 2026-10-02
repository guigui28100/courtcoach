import { FormEvent, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { get, post } from "../api";
import { Err, Field, PageHead } from "../components/ui";

// Page d'installation : sert une seule fois, pour créer le compte du coach. Elle se ferme ensuite toute seule.
export default function Installation() {
  const [available, setAvailable] = useState<boolean | null>(null);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => { get<{ available: boolean }>("/setup/status").then((r) => setAvailable(r.available)).catch(() => setAvailable(false)); }, []);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setError("");
    if (f.get("password") !== f.get("again")) { setError("Les deux mots de passe ne sont pas identiques."); return; }
    try { await post("/setup/coach", { token: String(f.get("token")), email: String(f.get("email")), password: String(f.get("password")) }); setDone(true); } catch (err) { setError((err as Error).message); }
  }

  if (available === null) return <p className="p-8 text-center text-muted">Chargement…</p>;
  if (done) return (
    <>
      <PageHead title="Installation terminée 🎾">Ton compte coach est créé. Cette page se ferme toute seule : plus personne ne peut s'en servir.</PageHead>
      <div className="mx-auto max-w-lg px-4 py-8"><Link to="/connexion" className="btn-clay no-underline">Me connecter</Link></div>
    </>
  );
  if (!available) return (
    <>
      <PageHead title="Installation" />
      <p className="mx-auto max-w-lg p-6">L'installation n'est pas disponible : le compte coach existe déjà, ou la clé d'installation n'a pas encore été réglée.</p>
    </>
  );
  return (
    <>
      <PageHead title="Installation de CourtCoach">Crée le compte du coach. Il te faut la clé d'installation que tu as choisie sur Vercel.</PageHead>
      <div className="mx-auto grid max-w-lg gap-4 px-4 py-8">
        <form onSubmit={submit} className="card grid gap-4" noValidate>
          <Field label="Clé d'installation" id="token"><input id="token" name="token" type="password" required maxLength={200} className="input" autoComplete="off" /></Field>
          <Field label="Ton adresse e-mail (identifiant)" id="email"><input id="email" name="email" type="email" required maxLength={254} className="input" autoComplete="email" /></Field>
          <Field label="Ton mot de passe" id="password" hint="12 caractères minimum. Une phrase longue et facile à retenir est idéale. Note-la en lieu sûr."><input id="password" name="password" type="password" required minLength={12} maxLength={128} className="input" autoComplete="new-password" /></Field>
          <Field label="Ton mot de passe (encore une fois)" id="again"><input id="again" name="again" type="password" required maxLength={128} className="input" autoComplete="new-password" /></Field>
          <Err msg={error} />
          <button className="btn-clay w-full">Créer mon compte coach</button>
        </form>
      </div>
    </>
  );
}

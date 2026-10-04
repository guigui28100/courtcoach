import { FormEvent, useState } from "react";
import { Link } from "react-router-dom";
import { post } from "../api";
import { useAuth } from "../auth";
import { Err, Field, Page, PageHead } from "../components/ui";

// Sécurité du compte du coach : double authentification (code à 6 chiffres sur le téléphone).
export default function Securite() {
  const { me, reload } = useAuth();
  const [setup, setSetup] = useState<{ secret: string; otpauth: string } | null>(null);
  const [codes, setCodes] = useState<string[] | null>(null);
  const [err, setErr] = useState(""); const [busy, setBusy] = useState(false);
  const on = !!me?.twoFactor;

  async function start() { setErr(""); setBusy(true); try { setSetup(await post("/auth/2fa/setup")); } catch (e) { setErr((e as Error).message); } finally { setBusy(false); } }
  async function enable(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); const form = e.currentTarget; const code = String(new FormData(form).get("code") || "").trim(); setErr(""); setBusy(true);
    try { const r = await post<{ recoveryCodes: string[] }>("/auth/2fa/enable", { code }); setCodes(r.recoveryCodes); setSetup(null); await reload(); } catch (x) { setErr((x as Error).message); } finally { setBusy(false); }
  }
  async function disable(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); const form = e.currentTarget; const f = new FormData(form); setErr(""); setBusy(true);
    try { await post("/auth/2fa/disable", { password: String(f.get("password")), code: String(f.get("code")).trim() }); await reload(); form.reset(); } catch (x) { setErr((x as Error).message); } finally { setBusy(false); }
  }

  return (
    <>
      <PageHead eyebrow="Espace coach" title="Sécurité de mon compte">Ton compte donne accès aux dossiers de tous les jeunes : il mérite une double protection.</PageHead>
      <Page>
        <section className="card grid gap-3" aria-labelledby="s-2fa">
          <h2 id="s-2fa" className="m-0">Double authentification {on ? "✅ activée" : "⚠️ pas encore activée"}</h2>
          <p className="m-0">À chaque connexion, en plus de ton mot de passe, tu entres un code à 6 chiffres qui change toutes les 30 secondes et qui s'affiche sur ton téléphone. Même si quelqu'un devine ton mot de passe, il ne peut pas entrer.</p>

          {codes && (
            <div role="status" className="rounded-2xl border-2 border-ok bg-[#eef8f1] p-4">
              <p className="m-0 font-bold">✅ C'est activé. Note ces 8 codes de secours maintenant : ils ne seront plus affichés.</p>
              <p className="m-0 text-sm">Chaque code ne sert qu'une fois, si tu perds ton téléphone. Garde-les sur papier, dans un endroit sûr (pas dans ton téléphone).</p>
              <ul className="m-0 mt-2 grid list-none grid-cols-2 gap-2 p-0 font-mono text-lg font-bold">{codes.map((c) => <li key={c} className="rounded bg-white px-2 py-1">{c}</li>)}</ul>
              <button className="btn-outline btn-sm mt-3" onClick={() => window.print()}>🖨️ Imprimer</button>
            </div>
          )}

          {!on && !setup && !codes && (
            <div className="grid gap-2">
              <ol className="m-0 grid gap-1 pl-5">
                <li>Installe sur ton téléphone une application d'authentification gratuite (par exemple <em>Google Authenticator</em>, <em>Microsoft Authenticator</em> ou <em>FreeOTP</em>).</li>
                <li>Clique sur le bouton ci-dessous : une clé s'affiche.</li>
                <li>Dans l'application : « Ajouter un compte », puis « Saisir une clé de configuration », et recopie la clé.</li>
                <li>Entre le code à 6 chiffres affiché pour terminer.</li>
              </ol>
              <div><button className="btn-clay" onClick={start} disabled={busy}>Activer la double authentification</button></div>
            </div>
          )}

          {setup && (
            <form onSubmit={enable} className="grid gap-3" noValidate>
              <p className="m-0 font-bold">Ta clé (à recopier dans l'application, sans la partager) :</p>
              <p className="m-0 select-all break-all rounded-xl bg-sand p-3 font-mono text-xl font-bold tracking-widest">{setup.secret.match(/.{1,4}/g)?.join(" ")}</p>
              <p className="hint m-0">Type : « basé sur l'heure ». Nom du compte : CourtCoach.</p>
              <Field label="Code à 6 chiffres affiché dans l'application" id="code"><input id="code" name="code" required inputMode="numeric" autoComplete="one-time-code" maxLength={6} className="input !w-40" autoFocus /></Field>
              <div><button className="btn-clay" disabled={busy}>Vérifier et activer</button></div>
            </form>
          )}

          {on && !codes && (
            <details>
              <summary className="cursor-pointer font-bold text-muted">Désactiver la double authentification</summary>
              <form onSubmit={disable} className="mt-3 grid gap-3 sm:grid-cols-2" noValidate>
                <Field label="Mot de passe" id="d-pwd"><input id="d-pwd" name="password" type="password" required className="input" autoComplete="current-password" /></Field>
                <Field label="Code à 6 chiffres" id="d-code"><input id="d-code" name="code" required inputMode="numeric" maxLength={6} className="input" /></Field>
                <div className="sm:col-span-2"><button className="btn-danger btn-sm" disabled={busy}>Désactiver</button></div>
              </form>
            </details>
          )}
          <Err msg={err} />
        </section>

        <section className="card grid gap-2">
          <h2 className="m-0">Autres bons réflexes</h2>
          <ul className="m-0 grid gap-1 pl-5">
            <li>Choisis une phrase longue comme mot de passe, que tu n'utilises nulle part ailleurs. <Link to="/mot-de-passe">Changer mon mot de passe</Link></li>
            <li>Déconnecte-toi sur un ordinateur partagé (le site le fait aussi après 30 minutes sans activité).</li>
            <li>Mot de passe oublié ? Le propriétaire du site peut en redéfinir un (voir le guide de mise en ligne).</li>
          </ul>
        </section>
      </Page>
    </>
  );
}

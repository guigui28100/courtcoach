import { FormEvent, useCallback, useEffect, useState } from "react";
import { del, get, post, put } from "../api";
import { Avatar, Empty, Err, Field, hueOf } from "./ui";
import { fmtDate, fullName, Player } from "../types";

interface Trainer { id: string; email: string; firstName: string | null; mustChangePassword: boolean; lastLoginAt: string | null; twoFactor: boolean; playerIds: string[]; }

// Cases à cocher : les jeunes que l'entraîneur pourra voir (et eux seulement)
function PlayerPicker({ players, value, onChange, name }: { players: Player[]; value: string[]; onChange: (ids: string[]) => void; name: string }) {
  if (!players.length) return <p className="hint m-0">Aucun jeune pour l'instant : crée d'abord les fiches des jeunes.</p>;
  return (
    <fieldset className="m-0 grid gap-2 border-0 p-0"><legend className="mb-1 font-bold">Jeunes que {name} peut voir</legend>
      <div className="grid gap-2 sm:grid-cols-2">
        {players.map((p) => (
          <label key={p.id} className="flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border-2 border-line bg-white px-3 has-[:checked]:border-clay has-[:checked]:bg-[#fdf1ea]">
            <input type="checkbox" className="h-5 w-5 accent-clay" checked={value.includes(p.id)} onChange={(e) => onChange(e.target.checked ? [...value, p.id] : value.filter((x) => x !== p.id))} />
            <Avatar name={fullName(p)} size={32} /><span className="font-semibold">{fullName(p)}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

// Mot de passe provisoire : montré une seule fois
function Secret({ email, password, onClose }: { email: string; password: string; onClose: () => void }) {
  return (
    <div role="status" className="rounded-2xl border-2 border-ok bg-[#eef8f1] p-4">
      <p className="m-0 font-bold">✅ Note ces informations maintenant : le mot de passe ne sera plus affiché.</p>
      <p className="m-0 mt-2">Identifiant : <strong>{email}</strong></p>
      <p className="m-0">Mot de passe provisoire : <strong className="select-all font-mono text-lg">{password}</strong></p>
      <p className="hint m-0 mt-1">Transmets-les en main propre ou par message privé. L'entraîneur devra choisir son propre mot de passe à la première connexion.</p>
      <button className="btn-outline btn-sm mt-2" onClick={onClose}>C'est noté</button>
    </div>
  );
}

export function TrainersTab({ players }: { players: Player[] }) {
  const [list, setList] = useState<Trainer[] | null>(null);
  const [err, setErr] = useState("");
  const [secret, setSecret] = useState<{ email: string; password: string } | null>(null);
  const [adding, setAdding] = useState(false);
  const [picked, setPicked] = useState<string[]>([]);
  const [edits, setEdits] = useState<Record<string, string[]>>({});
  const [saved, setSaved] = useState("");
  const load = useCallback(() => { get<Trainer[]>("/trainers").then(setList).catch((e) => { setList([]); setErr((e as Error).message); }); }, []);
  useEffect(load, [load]);

  async function create(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); const form = e.currentTarget; const f = new FormData(form); setErr("");
    try {
      const r = await post<{ id: string; email: string; temporaryPassword: string }>("/trainers", { firstName: String(f.get("firstName")), email: String(f.get("email")), playerIds: picked });
      setSecret({ email: r.email, password: r.temporaryPassword }); setAdding(false); setPicked([]); form.reset(); load();
    } catch (x) { setErr((x as Error).message); }
  }
  async function savePlayers(t: Trainer) {
    setErr(""); setSaved("");
    try { await put(`/trainers/${t.id}/players`, { playerIds: edits[t.id] ?? t.playerIds }); setEdits((o) => { const n = { ...o }; delete n[t.id]; return n; }); setSaved(`Jeunes de ${t.firstName ?? t.email} enregistrés ✓`); load(); } catch (x) { setErr((x as Error).message); }
  }
  async function reset(t: Trainer) {
    if (!confirm(`Donner un nouveau mot de passe provisoire à ${t.firstName ?? t.email} ? Il sera déconnecté.`)) return;
    try { const r = await post<{ email: string; temporaryPassword: string }>(`/trainers/${t.id}/reset-password`); setSecret({ email: r.email, password: r.temporaryPassword }); load(); } catch (x) { setErr((x as Error).message); }
  }
  async function remove(t: Trainer) {
    if (!confirm(`Supprimer le compte de ${t.firstName ?? t.email} ? Il n'aura plus aucun accès. (Ce qu'il a saisi pour les jeunes reste dans leurs dossiers.)`)) return;
    try { await del(`/trainers/${t.id}`); load(); } catch (x) { setErr((x as Error).message); }
  }

  return (
    <section className="grid gap-4" aria-labelledby="tr-h">
      <div className="grid gap-1">
        <h2 id="tr-h" className="m-0 text-xl">👥 Entraîneurs du comité</h2>
        <p className="hint m-0">Un entraîneur de comité a son propre compte. Il ne voit <strong>que les jeunes que tu coches</strong> (les autres n'existent pas pour lui), n'a <strong>aucun accès</strong> aux demandes de coaching des adultes, et peut saisir objectifs, missions, bilans, bulletins, étoiles, matchs et analyses de vidéos de ses jeunes. Il ne voit pas la santé ni tes notes privées, et ne peut ni créer ni supprimer un jeune, ni gérer les accords et les comptes des familles.</p>
      </div>
      {secret && <Secret email={secret.email} password={secret.password} onClose={() => setSecret(null)} />}
      {!adding ? <div><button className="btn-clay" onClick={() => setAdding(true)}>+ Ajouter un entraîneur</button></div> : (
        <form onSubmit={create} className="card grid gap-4 border-2 !border-clay" noValidate>
          <h3 className="m-0">Nouvel entraîneur</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Prénom" id="tr-first"><input id="tr-first" name="firstName" required maxLength={60} className="input" autoFocus /></Field>
            <Field label="Adresse e-mail (son identifiant)" id="tr-mail"><input id="tr-mail" name="email" type="email" required maxLength={200} className="input" autoComplete="off" /></Field>
          </div>
          <PlayerPicker players={players} value={picked} onChange={setPicked} name="cet entraîneur" />
          <div className="flex flex-wrap gap-2"><button className="btn-clay">Créer le compte</button><button type="button" className="btn-outline" onClick={() => { setAdding(false); setErr(""); }}>Annuler</button></div>
        </form>
      )}
      <Err msg={err} />
      {saved && <p role="status" className="m-0 font-bold text-ok">{saved}</p>}
      {list === null ? <div className="skeleton h-24" role="status" aria-label="Chargement en cours" /> : list.length === 0 ? <Empty>Aucun entraîneur de comité pour l'instant.</Empty> : (
        <ul className="m-0 grid list-none gap-4 p-0">
          {list.map((t) => { const sel = edits[t.id] ?? t.playerIds; const dirty = !!edits[t.id]; return (
            <li key={t.id} className="card grid gap-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <span className="flex items-center gap-3"><Avatar name={t.firstName ?? t.email} size={44} /><span><strong className="block text-lg">{t.firstName ?? "Entraîneur"}</strong><small className="hint">{t.email} · {t.lastLoginAt ? `dernière connexion le ${fmtDate(t.lastLoginAt)}` : t.mustChangePassword ? "pas encore connecté" : "jamais connecté"}{t.twoFactor ? " · 🔐 double authentification" : ""}</small></span></span>
                <span className="flex flex-wrap gap-2"><button className="btn-outline btn-sm" onClick={() => reset(t)}>Nouveau mot de passe</button><button className="btn-danger btn-sm" onClick={() => remove(t)}>Supprimer le compte</button></span>
              </div>
              <PlayerPicker players={players} value={sel} onChange={(ids) => setEdits((o) => ({ ...o, [t.id]: ids }))} name={t.firstName ?? "lui"} />
              <div className="flex flex-wrap items-center gap-3">
                <button className="btn-clay btn-sm" disabled={!dirty} onClick={() => savePlayers(t)}>Enregistrer ses jeunes</button>
                <span className="hint">{sel.length === 0 ? "Aucun jeune : il ne voit rien." : `${sel.length} jeune${sel.length > 1 ? "s" : ""} visible${sel.length > 1 ? "s" : ""}.`}</span>
              </div>
            </li>
          ); })}
        </ul>
      )}
    </section>
  );
}

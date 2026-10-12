import { FormEvent, useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { get, post } from "../api";
import { Consent, fmtDate, Player } from "../types";
import { infoMissing } from "./FamilyInfo";

// Accords donnés EN LIGNE par le parent (le mot de passe de son compte confirme que c'est bien lui). Le coach garde le formulaire papier en secours.
const KINDS: { kind: Consent["kind"]; icon: string; title: string; text: string }[] = [
  { kind: "FOLLOW_UP", icon: "🎯", title: "Suivi de mon enfant", text: "J'autorise le coach à suivre mon enfant au Centre de compétition jeunes : objectifs, évaluations, étoiles, matchs et bulletins." },
  { kind: "IMAGE", icon: "🎬", title: "Droit à l'image (vidéos)", text: "J'autorise l'enregistrement de vidéos de mon enfant, leur analyse par le coach et leur envoi dans son espace. Les vidéos sont supprimées automatiquement après 12 mois. Si je retire cet accord, toutes ses vidéos sont supprimées." },
  { kind: "HEALTH", icon: "🩺", title: "Informations de santé", text: "J'accepte que le coach garde les informations de santé que j'indique (blessures, points d'attention) pour adapter l'entraînement. Elles ne sont vues que du coach et de ce compte." },
  { kind: "ACCOUNT", icon: "👤", title: "Espace de mon enfant", text: "J'autorise mon enfant à utiliser son espace avec ce compte, sous ma responsabilité." },
  { kind: "PRIVACY_POLICY", icon: "🔒", title: "Politique de confidentialité", text: "J'ai lu la politique de confidentialité du club (données gardées, durée, droits)." },
];
const NEEDED: Consent["kind"][] = ["FOLLOW_UP", "IMAGE"]; // ceux qui débloquent le suivi et les vidéos

function useConsents(p: Player) {
  const [list, setList] = useState<Consent[] | null>(null);
  const load = useCallback(() => { get<Player & { consents?: Consent[] }>(`/players/${p.id}`).then((x) => setList((x.consents ?? []).filter((c) => !c.withdrawnAt))).catch(() => setList([])); }, [p.id]);
  useEffect(load, [load]);
  return [list, load] as const;
}

export function ConsentsTab({ p }: { p: Player }) {
  const [list, load] = useConsents(p);
  const [picked, setPicked] = useState<Record<string, boolean>>({});
  const [name, setName] = useState(""); const [pw, setPw] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null); const [busy, setBusy] = useState(false);
  const given = (k: Consent["kind"]) => list?.find((c) => c.kind === k);
  const todo = KINDS.filter((k) => !given(k.kind));
  const chosen = todo.filter((k) => picked[k.kind]);

  async function submit(e: FormEvent) {
    e.preventDefault(); setMsg(null);
    if (!chosen.length) return setMsg({ ok: false, text: "Coche au moins un accord." });
    if (name.trim().length < 2) return setMsg({ ok: false, text: "Écris ton nom et ton prénom (parent ou responsable légal)." });
    if (!pw) return setMsg({ ok: false, text: "Écris le mot de passe de ce compte : c'est ce qui confirme que c'est bien toi, le parent." });
    setBusy(true);
    try {
      for (const k of chosen) await post(`/players/${p.id}/consents/online`, { kind: k.kind, givenBy: name.trim(), password: pw });
      setPicked({}); setPw(""); setMsg({ ok: true, text: `✅ Merci, ${chosen.length > 1 ? "tes accords sont enregistrés" : "ton accord est enregistré"}. Le coach le voit tout de suite.` }); load();
    } catch (x) { setMsg({ ok: false, text: (x as Error).message }); }
    setBusy(false);
  }
  async function withdraw(c: Consent, title: string) {
    const warn = c.kind === "IMAGE" ? "Retirer le droit à l'image supprime TOUTES les vidéos de ton enfant (les textes d'analyse restent). Continuer ?" : `Retirer l'accord « ${title} » ?`;
    if (!confirm(warn)) return;
    try { await post(`/players/${p.id}/consents/${c.id}/withdraw`); load(); } catch (x) { setMsg({ ok: false, text: (x as Error).message }); }
  }

  return (
    <div className="grid gap-4">
      <section className="card grid gap-2">
        <h2 className="m-0 text-xl">✅ Autorisations pour {p.firstName}</h2>
        <p className="m-0"><strong>Cette rubrique est pour le parent ou le responsable légal.</strong> Tu lis chaque accord, tu coches, tu écris ton nom et le mot de passe de ce compte pour confirmer : c'est enregistré tout de suite, avec la date. Tu peux les retirer quand tu veux. Le coach n'a plus de papier à remplir à ta place.</p>
        <p className="hint m-0">Un papier à signer reste possible si tu préfères : demande-le au coach. <Link to="/confidentialite" className="font-bold text-clay underline">Lire la politique de confidentialité</Link></p>
      </section>

      {list === null && <p className="m-0">Chargement…</p>}
      {list && list.length > 0 && (
        <section className="card grid gap-2" aria-label="Accords déjà donnés">
          <h3 className="m-0">Accords déjà donnés</h3>
          <ul className="m-0 grid list-none gap-2 p-0">
            {list.map((c) => { const k = KINDS.find((x) => x.kind === c.kind); return (
              <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line bg-chalk p-3">
                <span><strong>{k?.icon} {k?.title ?? c.kind}</strong><small className="hint block">Accordé par {c.givenBy} · {c.method === "online" ? "en ligne" : "papier"} · le {fmtDate(c.grantedAt)}</small></span>
                <button type="button" className="btn-outline btn-sm" onClick={() => withdraw(c, k?.title ?? c.kind)}>Retirer</button>
              </li>
            ); })}
          </ul>
        </section>
      )}

      {list && todo.length > 0 && (
        <form onSubmit={submit} className="card grid gap-3" noValidate>
          <h3 className="m-0">Accords à donner</h3>
          <ul className="m-0 grid list-none gap-2 p-0">
            {todo.map((k) => (
              <li key={k.kind}>
                <label className="flex cursor-pointer items-start gap-3 rounded-xl border-2 border-line bg-white p-3 has-[:checked]:border-clay has-[:checked]:bg-[#fdf1ea]">
                  <input type="checkbox" className="mt-1 h-5 w-5 accent-clay" checked={!!picked[k.kind]} onChange={(e) => setPicked((x) => ({ ...x, [k.kind]: e.target.checked }))} />
                  <span><strong>{k.icon} {k.title}</strong>{NEEDED.includes(k.kind) && <span className="badge ml-2">conseillé</span>}<small className="block text-muted">{k.text}</small></span>
                </label>
              </li>
            ))}
          </ul>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="field"><label htmlFor="c-name">Nom et prénom du parent ou responsable légal</label><input id="c-name" className="input" value={name} onChange={(e) => setName(e.target.value)} maxLength={100} autoComplete="name" /></div>
            <div className="field"><label htmlFor="c-pw">Mot de passe de ce compte</label><input id="c-pw" type="password" className="input" value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="current-password" /><small className="hint">Il confirme que c'est bien toi, le parent, qui donnes l'accord.</small></div>
          </div>
          <div className="flex flex-wrap items-center gap-3"><button className="btn-clay" disabled={busy || !chosen.length}>{busy ? "Enregistrement…" : chosen.length > 1 ? `✅ Je donne ces ${chosen.length} accords` : "✅ Je donne cet accord"}</button>{msg && <p role="status" className={"m-0 font-bold " + (msg.ok ? "text-ok" : "text-bad")}>{msg.text}</p>}</div>
        </form>
      )}
      {list && todo.length === 0 && <p className="card m-0 font-bold">🎉 Tous les accords sont donnés. Merci !</p>}
      {msg?.ok && list && todo.length === 0 && <p role="status" className="m-0 font-bold text-ok">{msg.text}</p>}
    </div>
  );
}

// Rappels en haut de l'accueil : accords à donner et fiche de renseignements à compléter (pour le parent)
export function ParentReminders({ p, go }: { p: Player; go: (tab: "autorisations" | "renseignements") => void }) {
  const [list] = useConsents(p);
  const missing = list ? NEEDED.filter((k) => !list.some((c) => c.kind === k)) : [];
  const info = infoMissing(p);
  if (!missing.length && info === 0) return null;
  return (
    <div className="grid gap-3" role="region" aria-label="À faire par le parent">
      {missing.length > 0 && <button type="button" className="card grid gap-1 border-2 !border-clay text-left" onClick={() => go("autorisations")}><strong>✅ Parent : il reste des autorisations à donner pour {p.firstName}</strong><span className="text-sm text-muted">Suivi{missing.includes("IMAGE") ? ", droit à l'image (nécessaire pour les vidéos)" : ""}… Ça prend une minute, directement ici.</span></button>}
      {info > 0 && <button type="button" className="card grid gap-1 border-2 !border-clay text-left" onClick={() => go("renseignements")}><strong>📝 Parent : merci de compléter la fiche de renseignements de {p.firstName}</strong><span className="text-sm text-muted">Club, licence, classement… Rien n'est obligatoire.</span></button>}
    </div>
  );
}

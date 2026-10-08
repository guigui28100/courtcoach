import { FormEvent, useState } from "react";
import { put } from "../api";
import { fmtDate, Player, RANKINGS } from "../types";
import { Field } from "./ui";

// Les renseignements qui manquent encore sur la fiche (pour guider les parents)
export const infoMissing = (p: Player) => [p.sex, p.club, p.licence, p.heightCm, p.ranking, p.hand, p.backhand, p.training, p.availability].filter((v) => v === null || v === undefined || v === "").length;

// Fiche de renseignements remplie par les PARENTS : le coach a créé le compte (prénom, nom, date de naissance) ; le reste est à compléter ici.
export function FamilyInfo({ p, onSaved }: { p: Player; onSaved: (p: Player) => void }) {
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null); const [busy, setBusy] = useState(false);
  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); setMsg(null); setBusy(true);
    const f = Object.fromEntries(new FormData(e.currentTarget).entries());
    const body: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(f)) { if (k === "heightCm") { if (v) body[k] = Number(v); } else body[k] = String(v); }
    try { onSaved(await put<Player>(`/players/${p.id}/renseignements`, body)); setMsg({ ok: true, text: "✅ Merci, c'est enregistré. Le coach le voit tout de suite." }); } catch (x) { setMsg({ ok: false, text: (x as Error).message }); } finally { setBusy(false); }
  }
  const text = (id: keyof Player, label: string, extra?: { hint?: string; type?: string; placeholder?: string }) => (
    <Field label={label} id={id} hint={extra?.hint}><input id={id} name={id} type={extra?.type ?? "text"} defaultValue={(p[id] as string | number | null) ?? ""} className="input" placeholder={extra?.placeholder} /></Field>
  );
  const choice = (id: "sex" | "hand" | "backhand" | "ranking", label: string, options: string[]) => (
    <Field label={label} id={id}><select id={id} name={id} className="input" defaultValue={(p[id] as string | null) ?? ""}><option value="">Choisir…</option>{options.map((o) => <option key={o}>{o}</option>)}</select></Field>
  );
  return (
    <form onSubmit={save} className="grid gap-4" noValidate key={p.id}>
      <section className="card grid gap-2">
        <h2 className="m-0 text-xl">📝 Fiche de renseignements de {p.firstName}</h2>
        <p className="m-0">Le coach a créé la fiche. <strong>C'est à vous de compléter le reste</strong> : cela l'aide à mieux accompagner votre enfant. Rien n'est obligatoire.</p>
        <dl className="m-0 grid gap-1 rounded-xl bg-sand/60 p-3 text-sm sm:grid-cols-3">
          <div><dt className="font-bold">Prénom</dt><dd className="m-0">{p.firstName}</dd></div>
          <div><dt className="font-bold">Nom</dt><dd className="m-0">{p.lastName || "—"}</dd></div>
          <div><dt className="font-bold">Date de naissance</dt><dd className="m-0">{p.birthDate ? fmtDate(p.birthDate) : "—"}</dd></div>
        </dl>
        <p className="hint m-0">Une erreur dans le prénom, le nom ou la date de naissance ? Dites-le au coach : lui seul peut les corriger.</p>
      </section>
      <fieldset className="card grid gap-4 sm:grid-cols-2"><legend className="px-2 font-display font-bold">Identité et club</legend>
        {choice("sex", "Fille ou garçon", ["Fille", "Garçon"])}{text("heightCm", "Taille (cm)", { type: "number" })}{text("club", "Club")}{text("licence", "N° de licence FFT", { hint: "Facultatif" })}
      </fieldset>
      <fieldset className="card grid gap-4 sm:grid-cols-2"><legend className="px-2 font-display font-bold">Tennis</legend>
        {choice("ranking", "Classement actuel", RANKINGS)}{choice("hand", "Main", ["Droitier", "Gaucher"])}{choice("backhand", "Revers", ["À une main", "À deux mains"])}
        {text("training", "Entraînement et compétitions", { placeholder: "Ex. : mardi et jeudi, quelques tournois" })}{text("availability", "Disponibilités", { placeholder: "Ex. : mercredi après-midi, week-end" })}
      </fieldset>
      <fieldset className="card grid gap-4"><legend className="px-2 font-display font-bold">Santé (facultatif)</legend>
        <Field label="Blessures et points d'attention" id="health" hint="Seulement ce qui aide à adapter les exercices, jamais de diagnostic médical. Visible par le coach et par vous.">
          <textarea id="health" name="health" className="input" defaultValue={p.health ?? ""} maxLength={1000} />
        </Field>
      </fieldset>
      <div className="sticky bottom-[72px] z-20 flex flex-wrap items-center gap-3 rounded-2xl border border-line bg-white/95 p-3 shadow-lg backdrop-blur md:bottom-3"><button className="btn-clay" disabled={busy}>Enregistrer les renseignements</button>{msg && <p role="status" className={"m-0 font-bold " + (msg.ok ? "text-ok" : "text-bad")}>{msg.text}</p>}</div>
      <p className="hint m-0">Ces informations sont vues par le coach, par ses entraîneurs et, s'il a un compte, par votre enfant. <strong>La santé reste entre le coach et vous.</strong> Vous pouvez tout modifier quand vous voulez.</p>
    </form>
  );
}

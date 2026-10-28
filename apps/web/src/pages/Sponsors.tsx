import { createPortal } from "react-dom";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { del, get, post, put } from "../api";
import { useAuth } from "../auth";
import { homeFor } from "../components/Guard";
import { buildSponsorDossier, SPONSOR_H, SPONSOR_W } from "../components/SponsorDossier";
import { buildContract, CONTRACT_H, CONTRACT_W } from "../components/SponsorContract";
import { BackLink, Err, Page } from "../components/ui";
import { todayParis, fmtDay } from "../clubPlan";
import { CUSTOM, daysLeft, isCustom, logoFromFile, MAX_CUSTOM, Offer, perkOf, PERKS, Sponsor, STATUSES, statusOf } from "../sponsors";
import { Modal } from "./ClubPlan";

type Tab = "partenaires" | "offre" | "dossier" | "contrat";
const TABS: [Tab, string][] = [["partenaires", "🤝 Mes partenaires"], ["offre", "🎁 Ce que nous proposons"], ["dossier", "📄 Dossier de présentation"], ["contrat", "📝 Contrat à remplir"]];
const Pill = ({ on, onClick, children, color }: { on: boolean; onClick: () => void; children: React.ReactNode; color?: string }) => (
  <button type="button" aria-pressed={on} onClick={onClick} style={on && color ? { background: color, borderColor: color, color: "#fff" } : undefined}
    className={`rounded-xl border-2 px-3 py-2 text-sm font-bold ${on ? (color ? "" : "border-ink bg-ink text-white") : "border-line bg-white text-ink hover:border-ink"}`}>{children}</button>
);
const toggle = <T,>(l: T[], v: T) => (l.includes(v) ? l.filter((x) => x !== v) : [...l, v]);
// Contreparties : les 7 cases habituelles, et en bas un « ＋ Ajouter » pour écrire une ligne en plus (pour ce partenaire)
function PerkPicker({ value, onChange, list = false }: { value: string[]; onChange: (v: string[]) => void; list?: boolean }) {
  const [open, setOpen] = useState(false); const [txt, setTxt] = useState(""); const [msg, setMsg] = useState("");
  const customs = value.filter(isCustom);
  const add = () => {
    const t = txt.trim().replace(/\s+/g, " ");
    if (!t) return;
    if (customs.length >= MAX_CUSTOM && !value.includes(CUSTOM + t)) { setMsg(`${MAX_CUSTOM} lignes en plus au plus.`); return; }
    onChange(value.includes(CUSTOM + t) ? value : [...value, CUSTOM + t]); setTxt(""); setMsg(""); setOpen(false);
  };
  return (
    <div className="grid content-start gap-2">
      <div className={list ? "grid content-start gap-1.5" : "flex flex-wrap gap-2"}>
        {list ? [...PERKS.map((p) => p.key), ...customs].map((k) => { const on = value.includes(k); const c = isCustom(k); return (
          <button key={k} type="button" role="checkbox" aria-checked={on} onClick={() => onChange(toggle(value, k))}
            className={`flex w-full items-center gap-2 rounded-xl border-2 px-2.5 py-1.5 text-left text-sm font-bold ${on ? "border-ink bg-ink text-white" : "border-line bg-white text-ink hover:border-ink"}`}>
            <span aria-hidden className="grid size-4 shrink-0 place-items-center rounded border-2 text-[10px]" style={{ borderColor: on ? "#fff" : "#aaa" }}>{on ? "✔" : ""}</span>
            <span className="min-w-0 flex-1">{perkOf(k)?.icon} {perkOf(k)?.label}</span>{c && <span aria-hidden>✕</span>}
          </button>); }) : null}
        {!list && PERKS.map((p) => <Pill key={p.key} on={value.includes(p.key)} onClick={() => onChange(toggle(value, p.key))}>{p.icon} {p.label}</Pill>)}
        {!list && customs.map((k) => <Pill key={k} on onClick={() => onChange(value.filter((x) => x !== k))}>{perkOf(k)?.icon} {perkOf(k)?.label} ✕</Pill>)}
        {!open && <button type="button" className="rounded-xl border-2 border-dashed border-ink px-3 py-2 text-sm font-bold text-ink hover:bg-ink hover:text-white" onClick={() => setOpen(true)}>＋ Ajouter</button>}
      </div>
      {open && (
        <div className="flex flex-wrap items-center gap-2">
          <input aria-label="Ajouter une ligne de contrepartie" autoFocus className="min-w-0 flex-1 rounded-xl border-2 border-line bg-white px-3 py-2 text-sm" maxLength={60} placeholder="Ma ligne (ex. Logo sur les maillots)" value={txt}
            onChange={(e) => setTxt(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }} />
          <button type="button" className="btn-clay" disabled={!txt.trim()} onClick={add}>✔ Ajouter</button>
          <button type="button" className="btn-outline" onClick={() => { setOpen(false); setTxt(""); setMsg(""); }}>Annuler</button>
        </div>
      )}
      {msg && <p role="status" className="m-0 text-xs font-bold text-[#b45309]">{msg}</p>}
    </div>
  );
}
const field = "mt-1 w-full rounded-xl border-2 border-line bg-white px-3 py-2 text-sm font-normal";

// Partenaires (sponsors) du club : coach et président. Entreprises seulement, aucune donnée d'élève.
export default function SponsorsPage() {
  const { me } = useAuth();
  const [tab, setTab] = useState<Tab>("partenaires");
  const [data, setData] = useState<{ sponsors: Sponsor[]; offer: Offer } | null>(null);
  const [err, setErr] = useState("");
  const [edit, setEdit] = useState<Sponsor | "new" | null>(null);
  const load = useCallback(() => { get<{ sponsors: Sponsor[]; offer: Offer }>("/sponsors").then((d) => { setData(d); setErr(""); }).catch((e) => setErr((e as Error).message)); }, []);
  useEffect(load, [load]);
  const today = todayParis();
  const soon = (data?.sponsors ?? []).filter((s) => s.status !== "TERMINE" && s.status !== "A_CONTACTER" && (daysLeft(s.endDate, today) ?? 999) <= 60);

  return (
    <Page>
      <BackLink fallback={me ? homeFor(me.role) : "/coach"} className="text-sm font-bold text-ink">← Retour</BackLink>
      <header className="rounded border-b-2 border-champagne bg-ink p-5 text-white">
        <p className="m-0 text-xs font-bold uppercase tracking-[0.16em] text-white/80">Coach et président</p>
        <h1 className="m-0 !text-white">🤝 Partenaires du club</h1>
        <p className="m-0 mt-1 text-white/90">Les entreprises qui soutiennent le club : suivi, contreparties, logos sur les affiches et dossier à leur envoyer.</p>
      </header>
      <div role="tablist" aria-label="Partenaires" className="flex flex-wrap gap-2">
        {TABS.map(([k, l]) => <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className={`rounded-xl border-2 px-4 py-2 font-extrabold ${tab === k ? "border-ink bg-ink text-white" : "border-line bg-white text-ink hover:border-ink"}`}>{l}</button>)}
      </div>
      <Err msg={err} />
      {!data && !err && <p className="text-muted">Chargement…</p>}
      {data && tab === "partenaires" && (
        <section className="grid gap-3">
          {soon.length > 0 && <p role="status" className="m-0 rounded-xl bg-[#fff4cc] p-3 font-bold text-[#6b4e00]">⏰ {soon.length === 1 ? "Un contrat se termine" : `${soon.length} contrats se terminent`} bientôt : {soon.map((s) => `${s.name} (${fmtDay(s.endDate)})`).join(", ")}. Pense à en parler avec {soon.length === 1 ? "lui" : "eux"}.</p>}
          <button type="button" className="btn-clay justify-self-start" onClick={() => setEdit("new")}>＋ Ajouter un partenaire</button>
          {data.sponsors.length === 0 && <p className="m-0 rounded-2xl border-2 border-dashed border-line bg-white p-5 text-center text-muted">Aucun partenaire pour l'instant. Ajoute le premier : même une entreprise « à contacter » y a sa place.</p>}
          <ul className="m-0 grid list-none gap-3 p-0 md:grid-cols-2">
            {data.sponsors.map((s) => {
              const st = statusOf(s.status); const left = daysLeft(s.endDate, today);
              return (
                <li key={s.id} className="grid gap-2 rounded-2xl border-2 border-line bg-white p-4">
                  <div className="flex items-start gap-3">
                    <span className="grid size-16 shrink-0 place-items-center overflow-hidden rounded-xl border border-line bg-white">{s.logo ? <img src={s.logo} alt={`Logo ${s.name}`} className="max-h-14 max-w-[3.5rem] object-contain" /> : <span aria-hidden className="text-2xl">🏢</span>}</span>
                    <div className="min-w-0 flex-1">
                      <b className="block text-lg text-ink [overflow-wrap:anywhere]">{s.name}</b>
                      <span className="inline-block rounded-full px-2.5 py-0.5 text-xs font-extrabold text-white" style={{ background: st.color }}>{st.label}</span>
                      {s.pack && <span className="ml-1.5 inline-block rounded-full bg-[#f4c20d] px-2.5 py-0.5 text-xs font-extrabold text-ink">🏅 {s.pack}</span>}
                      {s.amount && <span className="ml-2 text-sm font-bold text-ink">{s.amount}</span>}
                    </div>
                    <button type="button" className="btn-outline btn-sm" onClick={() => setEdit(s)}>✏️ Modifier</button>
                  </div>
                  {(s.contactName || s.phone || s.email) && <p className="m-0 text-sm text-muted">👤 {[s.contactName, s.phone, s.email].filter(Boolean).join(" · ")}</p>}
                  {(s.startDate || s.endDate) && <p className="m-0 text-sm text-muted">📅 {s.startDate ? `du ${fmtDay(s.startDate)}` : ""} {s.endDate ? `au ${fmtDay(s.endDate)}` : ""}{left !== null && s.status !== "TERMINE" && left >= 0 && left <= 60 ? <b className="text-[#b45309]"> · fin dans {left} jour{left > 1 ? "s" : ""}</b> : null}{left !== null && left < 0 && s.status !== "TERMINE" ? <b className="text-[#b91c1c]"> · contrat dépassé</b> : null}</p>}
                  {s.perks.length > 0 && <div className="flex flex-wrap gap-1.5">{s.perks.map((k) => <span key={k} className="rounded-full bg-[#f3efe6] px-2 py-0.5 text-xs font-bold text-ink">{perkOf(k)?.icon} {perkOf(k)?.label ?? k}</span>)}</div>}
                  {(s.perks.includes("AFFICHE_MOIS") || s.perks.includes("AFFICHE_EVENT")) && <p className="m-0 text-sm font-bold" style={{ color: s.logo && s.status !== "TERMINE" && s.status !== "A_CONTACTER" ? "#15803d" : "#b45309" }}>{!s.logo ? "🪧 Logo à ajouter pour les affiches" : s.status === "TERMINE" || s.status === "A_CONTACTER" ? "🪧 Pas encore sur les affiches (partenariat pas en cours)" : `🪧 Logo sur : ${[s.perks.includes("AFFICHE_MOIS") ? "affiche du mois" : "", s.perks.includes("AFFICHE_EVENT") ? "affiches d'événements" : ""].filter(Boolean).join(" et ")}`}</p>}
                </li>);
            })}
          </ul>
        </section>
      )}
      {data && tab === "offre" && <OfferEditor offer={data.offer} onSaved={(o) => setData({ ...data, offer: o })} />}
      {data && tab === "dossier" && <Dossier offer={data.offer} sponsors={data.sponsors} />}
      {data && tab === "contrat" && <Contract offer={data.offer} sponsors={data.sponsors} />}
      {edit && <SponsorForm key={edit === "new" ? "new" : edit.id} offer={data!.offer} initial={edit === "new" ? null : edit} onClose={() => setEdit(null)} onDone={() => { setEdit(null); load(); }} />}
    </Page>
  );
}

// ───────────── Fiche d'un partenaire ─────────────
function SponsorForm({ initial, offer, onClose, onDone }: { initial: Sponsor | null; offer: Offer; onClose: () => void; onDone: () => void }) {
  const [v, setV] = useState<Sponsor>(initial ?? { id: "", name: "", contactName: "", phone: "", email: "", amount: "", startDate: "", endDate: "", status: "A_CONTACTER", perks: [], pack: "", logo: "", note: "" });
  const [logoChanged, setLogoChanged] = useState(false);
  const [err, setErr] = useState(""); const [busy, setBusy] = useState(false);
  const set = (p: Partial<Sponsor>) => setV((o) => ({ ...o, ...p }));
  const pickLogo = async (f?: File) => { if (!f) return; setErr(""); try { set({ logo: await logoFromFile(f) }); setLogoChanged(true); } catch (e) { setErr((e as Error).message); } };
  const save = async () => {
    setBusy(true); setErr("");
    try {
      const body = { name: v.name, contactName: v.contactName, phone: v.phone, email: v.email, amount: v.amount, startDate: v.startDate, endDate: v.endDate, status: v.status, perks: v.perks, pack: v.pack, note: v.note, ...(logoChanged || !initial ? { logo: v.logo } : {}) };
      if (initial) await put(`/sponsors/${initial.id}`, body); else await post("/sponsors", body);
      onDone();
    } catch (e) { setErr((e as Error).message); setBusy(false); }
  };
  const remove = async () => { if (!initial || !window.confirm(`Supprimer « ${initial.name} » de la liste ?`)) return; try { await del(`/sponsors/${initial.id}`); onDone(); } catch (e) { setErr((e as Error).message); } };
  return (
    <Modal title={initial ? `✏️ ${initial.name}` : "＋ Nouveau partenaire"} onClose={onClose}>
      <div className="grid gap-3">
        <label className="text-sm font-bold text-ink">Nom de l'entreprise
          <input aria-label="Nom de l'entreprise" className={field} maxLength={80} value={v.name} onChange={(e) => set({ name: e.target.value })} /></label>
        <div>
          <p className="m-0 mb-1 text-sm font-bold text-ink">Où en est-on ?</p>
          <div className="flex flex-wrap gap-2">{STATUSES.map((s) => <Pill key={s.key} on={v.status === s.key} color={s.color} onClick={() => set({ status: s.key })}>{s.label}</Pill>)}</div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm font-bold text-ink">Montant du soutien <span className="font-normal text-muted">(facultatif)</span>
            <input aria-label="Montant" className={field} maxLength={60} placeholder="ex. 300 € par an" value={v.amount} onChange={(e) => set({ amount: e.target.value })} /></label>
          <label className="text-sm font-bold text-ink">Personne à contacter <span className="font-normal text-muted">(facultatif)</span>
            <input aria-label="Personne à contacter" className={field} maxLength={80} value={v.contactName} onChange={(e) => set({ contactName: e.target.value })} /></label>
          <label className="text-sm font-bold text-ink">Téléphone
            <input aria-label="Téléphone" className={field} inputMode="tel" maxLength={20} value={v.phone} onChange={(e) => set({ phone: e.target.value })} /></label>
          <label className="text-sm font-bold text-ink">E-mail
            <input aria-label="E-mail" className={field} type="email" maxLength={120} value={v.email} onChange={(e) => set({ email: e.target.value })} /></label>
          <label className="text-sm font-bold text-ink">Début du contrat
            <input aria-label="Début du contrat" className={field} type="date" value={v.startDate} onChange={(e) => set({ startDate: e.target.value })} /></label>
          <label className="text-sm font-bold text-ink">Fin du contrat
            <input aria-label="Fin du contrat" className={field} type="date" value={v.endDate} onChange={(e) => set({ endDate: e.target.value })} /></label>
        </div>
        <div className="grid gap-2 rounded-2xl border-2 border-line bg-white p-3">
          <p className="m-0 text-sm font-bold text-ink">🏅 Grade (formule de partenariat)</p>
          <div className="flex flex-wrap gap-2">
            <Pill on={!v.pack} onClick={() => set({ pack: "" })}>✂️ Sur mesure</Pill>
            {offer.packs.map((p) => <Pill key={p.name} on={v.pack === p.name} color="#7b5d2a" onClick={() => set({ pack: p.name, perks: [...p.perks], amount: v.amount || p.price })}>{p.name}{p.price ? ` · ${p.price}` : ""}</Pill>)}
          </div>
          <p className="m-0 mt-1 text-sm font-bold text-ink">Ce que le club lui offre en échange</p>
          <p className="m-0 text-xs text-muted">{v.pack ? `Les contreparties de « ${v.pack} » sont déjà cochées : tu peux en ajouter ou en retirer (le grade reste, la liste devient personnalisée).` : "Choisis un grade pour cocher d'un coup ses contreparties, ou coche à la main."}</p>
          <PerkPicker value={v.perks} onChange={(perks) => set({ perks })} />
          {offer.packs.length === 0 && <p className="m-0 text-xs text-muted">Pour avoir des grades, crée d'abord tes formules dans l'onglet « Ce que nous proposons ».</p>}
        </div>
        <div className="rounded-2xl border-2 border-line bg-white p-3">
          <p className="m-0 mb-2 text-sm font-bold text-ink">🖼️ Logo</p>
          <div className="flex flex-wrap items-center gap-3">
            <span className="grid size-20 place-items-center overflow-hidden rounded-xl border border-line bg-white">{v.logo ? <img src={v.logo} alt="Logo du partenaire" className="max-h-[4.5rem] max-w-[4.5rem] object-contain" /> : <span aria-hidden className="text-3xl">🏢</span>}</span>
            <label className="btn-outline cursor-pointer">Choisir un logo (PNG ou JPEG)<input aria-label="Choisir un logo" type="file" accept="image/png,image/jpeg" className="sr-only" onChange={(e) => { void pickLogo(e.target.files?.[0]); e.target.value = ""; }} /></label>
            {v.logo && <button type="button" className="btn-outline" onClick={() => { set({ logo: "" }); setLogoChanged(true); }}>Retirer</button>}
          </div>
          <p className="m-0 mt-2 text-xs text-muted">{v.perks.includes("AFFICHE_MOIS") || v.perks.includes("AFFICHE_EVENT") ? "🪧 Son logo apparaîtra sur : " + [v.perks.includes("AFFICHE_MOIS") ? "l'affiche du mois" : "", v.perks.includes("AFFICHE_EVENT") ? "les affiches d'événements" : ""].filter(Boolean).join(" et ") + " (selon les contreparties cochées, quand le partenariat est en cours)." : "Son logo ne sera sur aucune affiche (coche « Logo sur l'affiche… » pour l'y mettre)."}</p>
          {!v.logo && <p className="m-0 mt-1 text-xs text-muted">Le logo est réduit automatiquement ; il reste dans l'application du club, rien n'est envoyé ailleurs.</p>}
        </div>
        <label className="text-sm font-bold text-ink">Note <span className="font-normal text-muted">(facultatif, visible du coach et du président seulement)</span>
          <textarea aria-label="Note" rows={2} className={field} maxLength={400} value={v.note} onChange={(e) => set({ note: e.target.value })} /></label>
        <Err msg={err} />
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn-clay" disabled={busy || !v.name.trim()} onClick={save}>✔ Enregistrer</button>
          <button type="button" className="btn-outline" onClick={onClose}>Annuler</button>
          {initial && <button type="button" className="btn-outline ml-auto bg-white hover:bg-[#b91c1c] hover:text-white" onClick={remove}>🗑️ Supprimer</button>}
        </div>
      </div>
    </Modal>
  );
}

// ───────────── Ce que le club propose (sert au dossier de présentation) ─────────────
function OfferEditor({ offer, onSaved }: { offer: Offer; onSaved: (o: Offer) => void }) {
  const [o, setO] = useState<Offer>(offer);
  const [msg, setMsg] = useState(""); const [err, setErr] = useState(""); const [busy, setBusy] = useState(false);
  const save = async () => { setBusy(true); setErr(""); setMsg(""); try { const r = await put<Offer>("/sponsors/offer", o); setO(r); onSaved(r); setMsg("✔ Enregistré : le dossier de présentation est à jour."); } catch (e) { setErr((e as Error).message); } setBusy(false); };
  const setPack = (i: number, p: Partial<Offer["packs"][number]>) => setO({ ...o, packs: o.packs.map((x, j) => (j === i ? { ...x, ...p } : x)) });
  return (
    <section className="grid gap-4">
      <p className="m-0 text-sm text-muted">Écris ici ce que le club propose aux entreprises. Le dossier de présentation reprend exactement ce texte.</p>
      <label className="text-sm font-bold text-ink">Présentation du club (quelques lignes)
        <textarea aria-label="Présentation du club" rows={4} maxLength={600} className={field} value={o.intro} onChange={(e) => setO({ ...o, intro: e.target.value })} /></label>
      <div>
        <p className="m-0 mb-1 text-sm font-bold text-ink">Le club en quelques mots <span className="font-normal text-muted">(6 au plus : nombre de courts, d'adhérents, de stages…)</span></p>
        <div className="grid gap-2">
          {o.facts.map((f, i) => (
            <div key={i} className="flex gap-2"><input aria-label={`Atout ${i + 1}`} className="w-full rounded-xl border-2 border-line bg-white px-3 py-2 text-sm" maxLength={80} value={f} onChange={(e) => setO({ ...o, facts: o.facts.map((x, j) => (j === i ? e.target.value : x)) })} />
              <button type="button" className="btn-outline" aria-label={`Retirer l'atout ${i + 1}`} onClick={() => setO({ ...o, facts: o.facts.filter((_, j) => j !== i) })}>🗑️</button></div>))}
          {o.facts.length < 6 && <button type="button" className="btn-outline justify-self-start" onClick={() => setO({ ...o, facts: [...o.facts, ""] })}>＋ Ajouter un atout</button>}
        </div>
      </div>
      <div>
        <p className="m-0 mb-1 text-sm font-bold text-ink">Les formules proposées <span className="font-normal text-muted">(4 au plus, le prix s'écrit librement ; vide = « à définir ensemble »)</span></p>
        <div className="grid gap-x-3 md:grid-cols-2">{/* cartes de même taille : nom, prix, contreparties et bouton sont alignés d'une carte à l'autre (grille partagée « subgrid ») */}
          {o.packs.map((p, i) => (
            <div key={i} style={{ gridRow: "span 4", gridTemplateRows: "subgrid" }} className="mb-3 grid gap-2 rounded-2xl border-2 border-line bg-white p-3">
              <input aria-label={`Nom de la formule ${i + 1}`} className="w-full rounded-xl border-2 border-line px-3 py-2 text-sm font-bold" maxLength={40} placeholder="Nom (ex. Partenaire or)" value={p.name} onChange={(e) => setPack(i, { name: e.target.value })} />
              <input aria-label={`Prix de la formule ${i + 1}`} className="w-full rounded-xl border-2 border-line px-3 py-2 text-sm" maxLength={40} placeholder="Prix (ex. 500 € par an)" value={p.price} onChange={(e) => setPack(i, { price: e.target.value })} />
              <PerkPicker list value={p.perks} onChange={(v) => setPack(i, { perks: v })} />
              <button type="button" className="btn-outline self-end justify-self-start" onClick={() => setO({ ...o, packs: o.packs.filter((_, j) => j !== i) })}>🗑️ Retirer cette formule</button>
            </div>))}
        </div>
        {o.packs.length < 4 && <button type="button" className="btn-outline mt-2" onClick={() => setO({ ...o, packs: [...o.packs, { name: "", price: "", perks: [] }] })}>＋ Ajouter une formule</button>}
      </div>
      <Err msg={err} />
      <div className="flex flex-wrap items-center gap-3"><button type="button" className="btn-clay" disabled={busy} onClick={save}>✔ Enregistrer</button>{msg && <b role="status" className="text-[#15803d]">{msg}</b>}</div>
    </section>
  );
}

// ───────────── Dossier de présentation à envoyer ─────────────
function Dossier({ offer, sponsors }: { offer: Offer; sponsors: Sponsor[] }) {
  const pages = useMemo(() => buildSponsorDossier(offer, sponsors), [offer, sponsors]);
  const [n, setN] = useState(0); const [scale, setScale] = useState(0.5);
  useEffect(() => { const f = () => setScale(Math.min(0.7, (Math.min(window.innerWidth, 760) - 40) / SPONSOR_W)); f(); window.addEventListener("resize", f); return () => window.removeEventListener("resize", f); }, []);
  // Le texte se tape directement dans les pages : à l'impression on recopie les pages telles qu'elles sont à l'écran (avec ce qui a été tapé)
  const live = useRef<HTMLDivElement>(null); const printBox = useRef<HTMLDivElement>(null);
  const print = () => {
    const box = printBox.current, src = live.current; if (!box || !src) return;
    box.replaceChildren(...Array.from(src.children).map((c) => { const k = c.firstElementChild!.cloneNode(true) as HTMLElement; k.querySelectorAll("[contenteditable]").forEach((e) => e.removeAttribute("contenteditable")); return k; }));
    const st = document.createElement("style"); st.textContent = "@page{size:210mm 297mm;margin:0}";
    document.head.appendChild(st); document.body.classList.add("printing-affiche");
    const done = () => { document.body.classList.remove("printing-affiche"); st.remove(); box.replaceChildren(); window.removeEventListener("afterprint", done); };
    window.addEventListener("afterprint", done); window.print();
  };
  return (
    <section className="grid gap-3">
      <p className="m-0 text-sm text-muted">Un dossier de 2 pages à envoyer aux entreprises. Il reprend « Ce que nous proposons » et les logos des partenaires (déjà engagés). Il est fabriqué sur ton ordinateur : rien n'est envoyé sur Internet, aucun nom d'élève.</p>
      <div className="mx-auto overflow-hidden rounded-lg border border-line shadow-lg" style={{ width: SPONSOR_W * scale, height: SPONSOR_H * scale }}>
        <div style={{ width: SPONSOR_W, height: SPONSOR_H, transform: `scale(${scale})`, transformOrigin: "top left" }}>{pages[n]}</div>
      </div>
      <div className="flex items-center justify-center gap-3">
        <button type="button" className="btn-outline" aria-label="Page précédente" disabled={n === 0} onClick={() => setN(n - 1)}>‹</button>
        <b className="text-ink">Page {n + 1} / {pages.length}</b>
        <button type="button" className="btn-outline" aria-label="Page suivante" disabled={n >= pages.length - 1} onClick={() => setN(n + 1)}>›</button>
      </div>
      <button type="button" className="btn-clay w-full sm:w-auto sm:justify-self-center" onClick={print}>📄 Imprimer ou enregistrer en PDF</button>
      <p className="m-0 text-center text-xs text-muted">Dans la fenêtre d'impression, choisis « Enregistrer au format PDF », format A4, marges : aucune. Tu l'envoies ensuite toi-même par e-mail.</p>
      {createPortal(<div ref={printBox} className="affiche-print" style={{ background: "#fff" }} />, document.body)}
    </section>
  );
}

// Contrat de partenariat (parrainage) à imprimer : prérempli avec le partenaire et son grade, le reste est à remplir au stylo
function Contract({ offer, sponsors }: { offer: Offer; sponsors: Sponsor[] }) {
  const [who, setWho] = useState("");
  const [gradeName, setGradeName] = useState("");
  const sponsor = sponsors.find((s) => s.id === who) ?? null;
  const pack = !sponsor ? offer.packs.find((p) => p.name === gradeName) ?? null : null;
  const pages = useMemo(() => buildContract({ sponsor, pack }), [sponsor, pack]);
  const [n, setN] = useState(0); const [scale, setScale] = useState(0.5);
  useEffect(() => { const f = () => setScale(Math.min(0.9, (Math.min(window.innerWidth, 900) - 40) / CONTRACT_W)); f(); window.addEventListener("resize", f); return () => window.removeEventListener("resize", f); }, []);
  // Le texte se tape directement dans les pages : à l'impression on recopie les pages telles qu'elles sont à l'écran (avec ce qui a été tapé)
  const live = useRef<HTMLDivElement>(null); const printBox = useRef<HTMLDivElement>(null);
  const print = () => {
    const box = printBox.current, src = live.current; if (!box || !src) return;
    box.replaceChildren(...Array.from(src.children).map((c) => { const k = c.firstElementChild!.cloneNode(true) as HTMLElement; k.querySelectorAll("[contenteditable]").forEach((e) => e.removeAttribute("contenteditable")); return k; }));
    const st = document.createElement("style"); st.textContent = "@page{size:210mm 297mm;margin:0}";
    document.head.appendChild(st); document.body.classList.add("printing-affiche");
    const done = () => { document.body.classList.remove("printing-affiche"); st.remove(); box.replaceChildren(); window.removeEventListener("afterprint", done); };
    window.addEventListener("afterprint", done); window.print();
  };
  return (
    <section className="grid gap-3">
      <p className="m-0 text-sm text-muted">Une convention de partenariat (parrainage) de 3 pages, à imprimer et faire signer. Choisis le partenaire : son nom, son grade, ses contreparties, son montant et ses dates sont écrits tout seuls. <b>Tu peux taper directement dans la page</b> : clique dans une ligne pointillée (adresse, SIRET, IBAN…) ou dans n'importe quel texte pour le corriger ; ce que tu écris est conservé quand tu changes de page, mais pas si tu changes de partenaire. Ce qui reste en pointillés se remplit au stylo. Sans partenaire, choisis seulement un grade.</p>
      <div className="grid gap-2 sm:grid-cols-2">
        <label className="grid gap-1 text-sm font-bold">Partenaire
          <select className="rounded-xl border-2 border-line bg-white p-2" value={who} onChange={(e) => { setWho(e.target.value); setN(0); }}>
            <option value="">— Contrat vierge —</option>
            {sponsors.map((s) => <option key={s.id} value={s.id}>{s.name}{s.pack ? ` (${s.pack})` : ""}</option>)}
          </select>
        </label>
        <label className="grid gap-1 text-sm font-bold">Grade (formule) {sponsor && <span className="font-normal text-muted">: celui du partenaire</span>}
          <select className="rounded-xl border-2 border-line bg-white p-2 disabled:opacity-50" disabled={!!sponsor} value={sponsor ? sponsor.pack : gradeName} onChange={(e) => setGradeName(e.target.value)}>
            <option value="">— Aucun —</option>
            {offer.packs.filter((p) => p.name).map((p) => <option key={p.name} value={p.name}>{p.name}</option>)}
          </select>
        </label>
      </div>
      <div className="mx-auto overflow-hidden rounded-lg border border-line shadow-lg" style={{ width: CONTRACT_W * scale, height: CONTRACT_H * scale }}>
        <div ref={live} style={{ width: CONTRACT_W, height: CONTRACT_H, transform: `scale(${scale})`, transformOrigin: "top left" }}>{pages.map((pg, i) => <div key={i} style={{ display: i === n ? "block" : "none" }}>{pg}</div>)}</div>
      </div>
      <div className="flex items-center justify-center gap-3">
        <button type="button" className="btn-outline" aria-label="Page précédente" disabled={n === 0} onClick={() => setN(n - 1)}>‹</button>
        <b className="text-ink">Page {n + 1} / {pages.length}</b>
        <button type="button" className="btn-outline" aria-label="Page suivante" disabled={n >= pages.length - 1} onClick={() => setN(n + 1)}>›</button>
      </div>
      <button type="button" className="btn-clay w-full sm:w-auto sm:justify-self-center" onClick={print}>📄 Imprimer ou enregistrer en PDF</button>
      <p className="m-0 rounded-xl border-2 border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">⚠️ C'est un <b>modèle de départ</b>, pas un conseil juridique. Avant de le faire signer, fais-le relire par la fédération, la mairie (service des associations) ou un juriste, surtout pour la TVA (un parrainage est en général facturé avec TVA, mais le régime dépend de la situation du club) et pour l'adresse, le SIRET et le pouvoir du président. Il faut aussi vérifier que les statuts du club autorisent ce type de partenariat.</p>
      {createPortal(<div ref={printBox} className="affiche-print" style={{ background: "#fff" }} />, document.body)}
    </section>
  );
}

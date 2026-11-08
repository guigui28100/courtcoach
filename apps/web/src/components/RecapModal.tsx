import { FmtItem } from "./FmtPanel";
import { loadOnline, listOnline, OnlineInfo, PhotoAccess, saveOnline } from "./posterOnline";
import { PosterStudio, photoSig, StudioFormat, useAutosave } from "./PosterStudio";
import { DraftsMenu } from "./DraftsMenu";
import { PhotoTuner } from "./PhotoTuner";
import { Fmts } from "./posterFmt";
import { useEffect, useRef, useState } from "react";
import { addDays, ClubEvent, mondayOf, opponentOf, TEAM_CATS, titleOf } from "../clubPlan";
import { usePartnerLogos } from "../sponsors";
import { emptyRecap, matchSentence, photoFromFile, RECAP_SIZES, RecapData, RecapFormat, RecapMatch, RecapPoster, catPlain, teamPlain } from "./RecapPoster";

const field = "w-full rounded-xl border-2 border-line bg-white px-3 py-2 text-sm font-normal";
const Pill = ({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) => (
  <button type="button" aria-pressed={on} onClick={onClick} className={`rounded-xl border-2 px-3 py-2 text-sm font-bold ${on ? "border-ink bg-ink text-white" : "border-line bg-white text-ink hover:border-ink"}`}>{children}</button>
);
const slug = (e: ClubEvent) => titleOf(e).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const MAX_PHOTOS = 8, MAX_RESULTS = 10;
const QUICK = [["🥇 Vainqueur", ""], ["🥈 Finaliste", ""], ["Demi-finalistes", ""], ["👏 Bravo à", ""], ["Match par équipes", "Victoire 4 – 2"]];

// Fenêtre de l'affiche de bilan : on choisit des photos, on écrit les résultats et le déroulement ; RIEN n'est enregistré ni envoyé.
// Matchs par équipes du même week-end (lundi au dimanche de l'événement) : une rencontre par équipe, le club adverse déjà noté est repris
function weekendMatches(e: ClubEvent, events: ClubEvent[]): RecapMatch[] {
  if (e.kind !== "EQUIPES") return [];
  const mon = mondayOf(e.startDate), sun = addDays(mon, 6);
  const list = events.filter((x) => x.kind === "EQUIPES" && x.startDate >= mon && x.startDate <= sun && (x.id === e.id || true));
  list.sort((a, b) => (a.id === e.id ? -1 : b.id === e.id ? 1 : a.startDate.localeCompare(b.startDate) || (a.position ?? 0) - (b.position ?? 0)));
  const out: RecapMatch[] = [];
  for (const x of list) for (const t of x.teams.length ? x.teams : [""]) out.push({ team: t, opponent: opponentOf(x), us: "", them: "", date: x.startDate });
  return out.slice(0, 8);
}

const recapFmtItems: FmtItem[] = [
  { key: "entete", label: "Nom du club (bandeau)", edit: true }, { key: "type", label: "Pastille « Bilan »", edit: true }, { key: "surtitre", label: "Titre en haut", edit: true }, { key: "titre", label: "Nom de l'événement", edit: true },
  { key: "classement", label: "Type et classements" }, { key: "date", label: "Date", edit: true }, { key: "resultats", label: "Résultats" }, { key: "texte", label: "Mot de remerciement", edit: true },
  { key: "partenaires", label: "Mot « partenaires »" }, { key: "pied", label: "« Merci à tous ! » (bas)", edit: true }, { key: "mail", label: "E-mail (bas)", edit: true },
  { key: "tout", label: "Tous les textes", sizeOnly: true },
];
type Saved = { d: RecapData; format: RecapFormat; bg: string; withPartners: boolean };
// Les photos de l'affiche = la mosaïque (tournois, fêtes…) + la photo de chaque rencontre (matchs par équipes)
const recapAccess: PhotoAccess<Saved> = {
  photos: (s) => [...s.d.photos, ...s.d.matches.map((x) => x.photo || "")],
  remap: (s, f) => ({ ...s, d: { ...s.d, photos: s.d.photos.map(f), matches: s.d.matches.map((x) => (x.photo ? { ...x, photo: f(x.photo) } : x)) } }),
  prune: (s) => { const k = s.d.photos.map((p) => !!p); return { ...s, d: { ...s.d, photos: s.d.photos.filter((_, i) => k[i]), focus: s.d.focus?.filter((_, i) => k[i]), zoom: s.d.zoom?.filter((_, i) => k[i]), matches: s.d.matches.map((x) => (x.photo ? x : { ...x, photo: undefined, focus: undefined })) } }; },
};
// Un réglage de texte par rencontre : l'équipe, son numéro, la phrase, le score et « victoire / défaite »
const matchFmtItems = (n: number): FmtItem[] => Array.from({ length: n }, (_, i) => [
  { key: `dt-${i}`, label: `Rencontre ${i + 1} : date`, edit: true }, { key: `eq-${i}`, label: `Rencontre ${i + 1} : équipe`, edit: true }, { key: `nu-${i}`, label: `Rencontre ${i + 1} : numéro`, edit: true },
  { key: `ph-${i}`, label: `Rencontre ${i + 1} : phrase`, edit: true }, { key: `sc-${i}`, label: `Rencontre ${i + 1} : score`, edit: true }, { key: `rs-${i}`, label: `Rencontre ${i + 1} : victoire / défaite`, edit: true },
]).flat();
const FORMATS: StudioFormat[] = [{ id: "CARRE", label: "⬜ Carré", ...RECAP_SIZES.CARRE }, { id: "PORTRAIT", label: "📱 Portrait 4:5", ...RECAP_SIZES.PORTRAIT }];

// Affiche de bilan dans le studio commun. Elle se sauvegarde toute seule en ligne (photos comprises) et se rouvre toute seule à la prochaine visite du même événement.
export function RecapModal({ e, events, onClose }: { e: ClubEvent; events: ClubEvent[]; onClose: () => void }) {
  const [format, setFormat] = useState<RecapFormat>("CARRE");
  const [bg, setBg] = useState("");
  const [rfmt, setRfmtState] = useState<Fmts>(() => { try { return JSON.parse(localStorage.getItem("cc-affiche-bilan-mise-en-forme") || "{}"); } catch { return {}; } });
  const [rsel, setRsel] = useState("titre");
  const setRfmt = (v: Fmts) => { setRfmtState(v); try { localStorage.setItem("cc-affiche-bilan-mise-en-forme", JSON.stringify(v)); } catch { /* sans mémoire du navigateur */ } };
  const [d, setD] = useState<RecapData>(() => ({ ...emptyRecap(), matches: weekendMatches(e, events) }));
  const teamsMode = e.kind === "EQUIPES";
  const lite = !teamsMode && e.kind !== "TOURNOI"; // stages, animations, fêtes… : seulement des photos et du texte
  const logos = usePartnerLogos(); const [withPartners, setWithPartners] = useState(true);
  const [msg, setMsg] = useState("");
  const [selPh, setSelPh] = useState(0);
  const [draftId, setDraftId] = useState<string | null>(null);
  const idRef = useRef<string | null>(null);
  const [rev, setRev] = useState(0);
  const name = `Bilan · ${titleOf(e)} · ${e.startDate}`.slice(0, 80);
  const sig = JSON.stringify({ d: { ...d, photos: d.photos.map(photoSig), matches: d.matches.map((x) => ({ ...x, photo: x.photo ? photoSig(x.photo) : "" })) }, format, bg, withPartners });
  const auto = useAutosave({
    sig,
    save: async () => {
      const id = await saveOnline<Saved>("bilan", idRef.current, name, { d, format, bg, withPartners }, recapAccess, (n, t) => t && auto.setState({ kind: "saving", text: `Envoi des photos : ${n} sur ${t}…` }));
      idRef.current = id; setDraftId(id); setRev((r) => r + 1);
    },
  });
  const open = async (x: OnlineInfo) => {
    await auto.flush();
    const r = await loadOnline<Saved>(x.id, recapAccess);
    auto.skipNext(); idRef.current = x.id; setDraftId(x.id);
    setD(r.saved.d); setFormat(r.saved.format); setBg(r.saved.bg); setWithPartners(r.saved.withPartners); auto.setState({ kind: "saved" });
  };
  // Même événement déjà travaillé : on rouvre son affiche toute seule
  useEffect(() => {
    let off = false;
    (async () => {
      try {
        const mine = (await listOnline("bilan")).find((x) => x.name === name);
        if (!mine || off) return;
        setMsg("Je reprends ton travail précédent…");
        await open(mine);
        if (!off) setMsg("");
      } catch { if (!off) setMsg(""); }
    })();
    return () => { off = true; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const set = (p: Partial<RecapData>) => setD((o) => ({ ...o, ...p }));
  const move = (from: number, to: number) => setD((o) => {
    if (from === to || from < 0 || to < 0 || from >= o.photos.length || to >= o.photos.length) return o;
    const ph = [...o.photos]; const f = [...(o.focus ?? [])]; while (f.length < ph.length) f.push([50, 50]); const z = [...(o.zoom ?? [])]; while (z.length < ph.length) z.push(1);
    const [a] = ph.splice(from, 1); const [b] = f.splice(from, 1); const [c] = z.splice(from, 1); ph.splice(to, 0, a); f.splice(to, 0, b); z.splice(to, 0, c);
    return { ...o, photos: ph, focus: f, zoom: z };
  });
  const remove = (i: number) => setD((o) => ({ ...o, photos: o.photos.filter((_, j) => j !== i), focus: (o.focus ?? []).filter((_, j) => j !== i), zoom: (o.zoom ?? []).filter((_, j) => j !== i) }));
  const addPhotos = async (files: FileList | null) => {
    if (!files) return; setMsg("");
    try { const room = MAX_PHOTOS - d.photos.length; const list = await Promise.all(Array.from(files).slice(0, room).map(photoFromFile)); set({ photos: [...d.photos, ...list] }); if (files.length > room) setMsg(`${MAX_PHOTOS} photos au plus : les autres n'ont pas été ajoutées.`); }
    catch (x) { setMsg((x as Error).message); }
  };
  const content = (<>
    <details className="rounded-md bg-[#fff4cc] p-3 text-sm text-[#6b4e00]">
      <summary role="note" className="cursor-pointer font-bold">⚠️ Seulement les photos d'enfants dont les parents ont donné le droit à l'image</summary>
      <p className="m-0 mt-2">Rubrique « Mes autorisations » de leur famille. Pour les enfants, écris seulement le prénom. L'affiche et ses photos sont gardées sur le serveur du club (visibles seulement par le coach, le président et le bureau) ; tu la retrouves en rouvrant le bilan de cet événement.</p>
    </details>
    {msg && <p className="m-0 text-sm font-bold text-ink" role="status">{msg}</p>}
    {!teamsMode && <section aria-label="Photos" className="rounded-2xl border-2 border-line bg-white p-3">
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <h3 className="m-0 text-base text-ink">📷 Mes photos</h3>
        <span className="text-xs font-bold text-muted">{d.photos.length} sur {MAX_PHOTOS}</span>
      </div>
      {d.photos.length === 0 ? (
        <label onDragOver={(ev) => ev.preventDefault()} onDrop={(ev) => { ev.preventDefault(); void addPhotos(ev.dataTransfer.files); }} className="grid cursor-pointer place-items-center gap-1 rounded-xl border-2 border-dashed border-line bg-[#fbf8f2] px-4 py-8 text-center hover:border-ink">
          <span className="text-3xl" aria-hidden>📷</span>
          <span className="text-base font-extrabold text-ink">Ajouter des photos</span>
          <span className="text-xs text-muted">Touche ici ou glisse tes photos (jusqu'à {MAX_PHOTOS})</span>
          <input aria-label="Ajouter des photos" type="file" multiple accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(x) => { void addPhotos(x.target.files); x.target.value = ""; }} />
        </label>
      ) : (
        <>
          <ul className="m-0 grid list-none grid-cols-3 gap-2 p-0 sm:grid-cols-4">
            {d.photos.map((s, i) => (
              <li key={i} className="group relative" draggable onDragStart={(ev) => ev.dataTransfer.setData("text/plain", String(i))} onDragOver={(ev) => ev.preventDefault()} onDrop={(ev) => { ev.preventDefault(); const f = ev.dataTransfer.getData("text/plain"); if (f !== "") move(Number(f), i); }}>
                <img src={s} alt={`Photo ${i + 1}`} onClick={() => setSelPh(i)} className={`aspect-square w-full cursor-pointer rounded-lg object-cover ${selPh === i ? "ring-4 ring-ink" : ""}`} />
                <span aria-hidden className="absolute left-1 top-1 grid size-6 place-items-center rounded-full bg-ink text-xs font-bold text-white">{i + 1}</span>
                <span className="absolute inset-x-1 bottom-1 flex justify-between gap-1">
                  <button type="button" aria-label={`Avancer la photo ${i + 1}`} disabled={i === 0} className="grid h-8 min-w-8 place-items-center rounded-md bg-white/90 text-sm font-bold text-ink shadow disabled:opacity-30" onClick={() => move(i, i - 1)}>◀</button>
                  <button type="button" aria-label={`Retirer la photo ${i + 1}`} className="grid h-8 min-w-8 place-items-center rounded-md bg-white/90 text-sm shadow" onClick={() => remove(i)}>🗑️</button>
                  <button type="button" aria-label={`Reculer la photo ${i + 1}`} disabled={i === d.photos.length - 1} className="grid h-8 min-w-8 place-items-center rounded-md bg-white/90 text-sm font-bold text-ink shadow disabled:opacity-30" onClick={() => move(i, i + 1)}>▶</button>
                </span>
              </li>))}
            {d.photos.length < MAX_PHOTOS && (
              <li><label className="grid aspect-square cursor-pointer place-items-center rounded-lg border-2 border-dashed border-line bg-[#fbf8f2] text-center text-xs font-bold text-ink hover:border-ink"><span><span className="block text-2xl" aria-hidden>＋</span>Ajouter</span>
                <input aria-label="Ajouter des photos" type="file" multiple accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(x) => { void addPhotos(x.target.files); x.target.value = ""; }} /></label></li>)}
          </ul>
          <p className="m-0 mt-2 text-xs text-muted">👆 Touche une photo pour la <b>régler</b> (déplacer, zoomer). Pour changer l'<b>ordre</b>, utilise ◀ ▶ ou glisse une vignette.</p>
          <div className="mt-2"><PhotoTuner label={`photo ${Math.min(selPh, d.photos.length - 1) + 1}`} value={{ focus: d.focus?.[Math.min(selPh, d.photos.length - 1)], zoom: d.zoom?.[Math.min(selPh, d.photos.length - 1)] }} onChange={(t) => setD((o) => { const j = Math.min(selPh, o.photos.length - 1); const f = o.photos.map((_, n) => o.focus?.[n] ?? ([50, 50] as [number, number])); const z = o.photos.map((_, n) => o.zoom?.[n] ?? 1); if (t.focus) f[j] = t.focus; if (t.zoom) z[j] = t.zoom; return { ...o, focus: f, zoom: z }; })} /></div>
        </>
      )}
    </section>}
    <label className="text-sm font-bold text-ink">Titre en haut <span className="font-normal text-muted">(facultatif, ex. « Résultats du tournoi »)</span>
      <input aria-label="Titre en haut" className={`${field} mt-1`} maxLength={40} placeholder="Résultats du tournoi" value={d.headline} onChange={(x) => set({ headline: x.target.value })} /></label>
    {teamsMode ? (
      <div className="rounded-2xl border-2 border-line bg-white p-3">
        <p className="m-0 mb-1 text-sm font-bold text-ink">🏆 Les rencontres du week-end</p>
        <p className="m-0 mb-2 text-xs text-muted">Une ligne par équipe qui a joué. Écris les scores : « TC Houdan bat… », « perd contre… » ou « fait match nul contre… » s'écrit tout seul.</p>
        <div className="grid gap-3">
          {d.matches.map((m, i) => {
            const [cat, num] = (m.team || "#1").split("#");
            const upd = (p: Partial<RecapMatch>) => set({ matches: d.matches.map((o, j) => (j === i ? { ...o, ...p } : o)) });
            return (
              <div key={i} className="grid gap-2 rounded-xl border border-line bg-[#fbf8f2] p-2">
                <div className="flex flex-wrap gap-2">
                  <select aria-label={`Rencontre ${i + 1} : catégorie`} className={`${field} !w-auto min-w-0 flex-1`} value={cat} onChange={(x) => upd({ team: x.target.value ? `${x.target.value}#${num || "1"}` : "" })}>
                    <option value="">Choisir l'équipe…</option>
                    {TEAM_CATS.map((c) => <option key={c.key} value={c.key}>{catPlain(c.key)}</option>)}
                  </select>
                  <select aria-label={`Rencontre ${i + 1} : numéro de l'équipe`} className={`${field} !w-auto`} value={num || "1"} disabled={!cat} onChange={(x) => upd({ team: `${cat}#${x.target.value}` })}>
                    {[1, 2, 3, 4].map((n) => <option key={n} value={n}>équipe {n}</option>)}
                  </select>
                  <button type="button" className="btn-outline" aria-label={`Retirer la rencontre ${i + 1}`} onClick={() => set({ matches: d.matches.filter((_, j) => j !== i) })}>🗑️</button>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <label className="text-sm font-bold text-ink">Jour du match <input type="date" aria-label={`Rencontre ${i + 1} : jour du match`} className={`${field} !w-auto`} value={m.date ?? ""} onChange={(x) => upd({ date: x.target.value || undefined })} /></label>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <input aria-label={`Rencontre ${i + 1} : club adverse`} className={`${field} min-w-0 flex-1`} maxLength={60} placeholder="Club adverse (ex. TC Guyancourt)" value={m.opponent} onChange={(x) => upd({ opponent: x.target.value })} />
                  <span className="text-sm font-bold text-ink">Houdan</span>
                  <input aria-label={`Rencontre ${i + 1} : points de Houdan`} inputMode="numeric" className={`${field} !w-16 text-center`} maxLength={2} value={m.us} onChange={(x) => upd({ us: x.target.value.replace(/\D/g, "") })} />
                  <span className="font-bold text-ink">/</span>
                  <input aria-label={`Rencontre ${i + 1} : points de l'adversaire`} inputMode="numeric" className={`${field} !w-16 text-center`} maxLength={2} value={m.them} onChange={(x) => upd({ them: x.target.value.replace(/\D/g, "") })} />
                  <span className="text-sm font-bold text-ink">adversaire</span>
                </div>
                <p className="m-0 text-sm font-bold text-ink">→ {matchSentence(m)}{m.us && m.them ? ` ${m.us}/${m.them}` : ""}</p>
                <div className="flex flex-wrap items-center gap-2">
                  {m.photo ? <img src={m.photo} alt={`Photo de la rencontre ${i + 1}`} className="size-16 rounded-lg object-cover" /> : <span className="grid size-16 place-items-center rounded-lg border-2 border-dashed border-line text-2xl" aria-hidden>📷</span>}
                  <label className="btn-outline cursor-pointer">{m.photo ? "Changer la photo de cette équipe" : "📷 Ajouter la photo de cette équipe"}
                    <input aria-label={`Rencontre ${i + 1} : photo de l'équipe`} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={async (x) => { const f = x.target.files?.[0]; x.target.value = ""; if (!f) return; try { setMsg(""); const url = await photoFromFile(f); upd({ photo: url, focus: [50, 50], zoom: 1, size: 1 }); } catch (er) { setMsg((er as Error).message); } }} /></label>
                  {m.photo && <button type="button" className="btn-outline" aria-label={`Retirer la photo de la rencontre ${i + 1}`} onClick={() => upd({ photo: undefined, focus: undefined, zoom: undefined, size: undefined })}>🗑️ Retirer la photo</button>}
                </div>
                {m.photo && <PhotoTuner withSize label={`rencontre ${i + 1}`} value={{ focus: m.focus, zoom: m.zoom, size: m.size }} onChange={(t) => upd(t)} />}
              </div>);
          })}
          {d.matches.length < 8 && <button type="button" className="btn-outline justify-self-start" onClick={() => set({ matches: [...d.matches, { team: "", opponent: "", us: "", them: "" }] })}>＋ Ajouter une rencontre</button>}
        </div>
      </div>
    ) : e.kind !== "TOURNOI" ? null : (
    <div className="rounded-2xl border-2 border-line bg-white p-3">
      <p className="m-0 mb-2 text-sm font-bold text-ink">🏆 Résultats du tournoi</p>
      <div className="grid gap-2">
        {d.results.map((r, i) => (
          <div key={i} className="flex gap-2">
            <input aria-label={`Résultat ${i + 1} : quoi`} className={field} maxLength={40} placeholder="Quoi (ex. Finale)" value={r.what} onChange={(x) => set({ results: d.results.map((o, j) => (j === i ? { ...o, what: x.target.value } : o)) })} />
            <input aria-label={`Résultat ${i + 1} : résultat`} className={field} maxLength={120} placeholder={r.what.includes("Bravo") ? "Les prénoms (ex. Paul, Léa et Tom)" : "Résultat (ex. Paul, 6-4 6-3)"} value={r.result} onChange={(x) => set({ results: d.results.map((o, j) => (j === i ? { ...o, result: x.target.value } : o)) })} />
            <button type="button" className="btn-outline" aria-label={`Retirer le résultat ${i + 1}`} onClick={() => set({ results: d.results.filter((_, j) => j !== i) })}>🗑️</button>
          </div>))}
        {d.results.length < MAX_RESULTS && (
          <div className="flex flex-wrap gap-2">{QUICK.map(([a, b]) => <button key={a} type="button" className="btn-outline" onClick={() => set({ results: [...d.results, { what: a, result: b }] })}>＋ {a}</button>)}<button type="button" className="btn-outline" onClick={() => set({ results: [...d.results, { what: "", result: "" }] })}>＋ Une ligne libre</button></div>)}
      </div>
    </div>
    )}
    <label className="text-sm font-bold text-ink">{lite ? "Texte de l'affiche" : "Un mot de remerciement"} <span className="font-normal text-muted">({lite ? "déroulement, remerciements…" : "facultatif"})</span>
      <textarea aria-label="Mot de remerciement" rows={lite ? 5 : 2} maxLength={lite ? 500 : 200} className={`${field} mt-1`} value={d.message} onChange={(x) => set({ message: x.target.value })} /></label>
  </>);
  const poster = (extra: object = {}) => <RecapPoster e={e} format={format} data={d} partners={withPartners ? logos : []} bg={bg} fmt={rfmt} {...extra} />;
  return (
    <PosterStudio
      title={`📸 Bilan : ${titleOf(e)}`} subtitle={draftId ? "enregistré en ligne" : "pas encore enregistré"} onClose={() => { void auto.flush().finally(onClose); }}
      formats={FORMATS} format={format} onFormat={(f) => setFormat(f as RecapFormat)}
      content={content} bg={bg} onBg={setBg}
      partners={{ count: logos.length, on: withPartners, onChange: setWithPartners, label: "🤝 Remercier les partenaires" }}
      fmt={{ items: teamsMode ? [...recapFmtItems.filter((x) => x.key !== "tout"), ...matchFmtItems(d.matches.length), ...recapFmtItems.filter((x) => x.key === "tout")] : recapFmtItems, value: rfmt, onChange: setRfmt, selected: rsel, onSelect: setRsel }}
      preview={({ pick }) => poster({ onPick: pick, onPanMatch: (i: number, x: number, y: number) => setD((o) => ({ ...o, matches: o.matches.map((mm, j) => (j === i ? { ...mm, focus: [x, y] as [number, number] } : mm)) })), onPan: (i: number, x: number, y: number) => setD((o) => { const f = [...(o.focus ?? [])]; while (f.length < o.photos.length) f.push([50, 50]); f[i] = [x, y]; return { ...o, focus: f }; }) })}
      printNode={poster()}
      fileBase={(f) => `bilan-${slug(e)}-${e.startDate}-${f.toLowerCase()}`}
      save={auto.state.kind === "idle" ? { kind: "idle", text: "Se sauvegarde toute seule, photos comprises" } : auto.state}
      beforeDownload={auto.flush}
      topExtra={<DraftsMenu kind="bilan" currentId={draftId} refreshKey={rev} onOpen={open} onDeleted={(id) => { if (id === idRef.current) { idRef.current = null; setDraftId(null); } }} />}
    />
  );
}

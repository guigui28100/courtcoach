import { ReactNode, useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { BgPicker } from "./PosterBackdrop";
import { FmtFloat, FmtItem, FmtPanel, SelOutline } from "./FmtPanel";
import { Fmts } from "./posterFmt";
import { posterToPdf, posterToPng } from "./exportPoster";

// ─────────────────────────────────────────────────────────────────────────────
// LE STUDIO D'AFFICHE : une seule fenêtre, rangée pareil pour TOUTES les affiches (événement, mois, bilan, résultats).
//   Barre du haut : titre, état de l'enregistrement, UN bouton « Télécharger » (PDF, image, impression), fermer.
//   À gauche, 3 onglets : 1 · Contenu (ce qui est écrit) · 2 · Apparence (modèle, fond, logos) · 3 · Textes (réglages fins).
//   Au centre : le format au-dessus, puis l'affiche entière ; on TOUCHE un texte et une petite barre apparaît juste à côté.
// ─────────────────────────────────────────────────────────────────────────────
export type StudioFormat = { id: string; label: string; w: number; h: number };
export type SaveState = { kind: "idle" | "saving" | "saved" | "error" | "local"; text?: string };
type Tab = "contenu" | "apparence" | "textes";

// Enregistrement automatique : quelques instants après la dernière modification, `save` est appelé (un seul à la fois, le dernier état gagne).
export function useAutosave({ enabled = true, sig, delay = 1500, save }: { enabled?: boolean; sig: string; delay?: number; save: () => Promise<void> }) {
  const [state, setState] = useState<SaveState>({ kind: "idle" });
  const saveRef = useRef(save); saveRef.current = save;
  const running = useRef<Promise<void> | null>(null);
  const again = useRef(false);
  const dirty = useRef(false);
  const skip = useRef(true); // la toute première valeur (ou une affiche qu'on vient de rouvrir) n'est pas une modification
  const timer = useRef<number | undefined>(undefined);
  const run = useCallback((): Promise<void> => {
    if (running.current) { again.current = true; return running.current; }
    const p = (async () => {
      do {
        again.current = false; dirty.current = false; setState({ kind: "saving" });
        try { await saveRef.current(); setState((s) => (dirty.current ? s : { kind: "saved" })); }
        catch (e) { dirty.current = true; setState({ kind: "error", text: (e as Error).message || "Impossible d'enregistrer pour l'instant." }); }
      } while (again.current);
    })().finally(() => { running.current = null; });
    running.current = p;
    return p;
  }, []);
  useEffect(() => {
    if (!enabled) return;
    if (skip.current) { skip.current = false; return; }
    dirty.current = true;
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => { void run(); }, delay);
    return () => window.clearTimeout(timer.current);
  }, [sig, enabled, delay, run]);
  const flush = useCallback(async () => { window.clearTimeout(timer.current); if (running.current) await running.current; if (dirty.current) await run(); }, [run]);
  const skipNext = useCallback(() => { skip.current = true; dirty.current = false; window.clearTimeout(timer.current); }, []);
  return { state, flush, skipNext, setState };
}

// Signature légère d'une affiche (les photos ne sont comptées que par leur début, leur fin et leur longueur : pas de recopie de millions de caractères)
export const photoSig = (p: string) => `${p.length}:${p.slice(0, 24)}:${p.slice(-16)}`;

export const Toggle = ({ on, onChange, label, hint }: { on: boolean; onChange: (v: boolean) => void; label: string; hint?: string }) => (
  <label className="flex cursor-pointer items-center justify-between gap-3 border-t border-line py-2.5 first:border-t-0">
    <span className="text-sm text-ink">{label}{hint && <small className="block text-xs text-muted">{hint}</small>}</span>
    <button type="button" role="switch" aria-checked={on} aria-label={label} onClick={() => onChange(!on)} className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${on ? "bg-[#1f7a45]" : "bg-[#cfc8b6]"}`}>
      <span className={`absolute top-0.5 size-5 rounded-full bg-white shadow transition-all ${on ? "left-[22px]" : "left-0.5"}`} />
    </button>
  </label>
);
export const Seg = <T extends string>({ value, options, onChange, label }: { value: T; options: { id: T; label: string }[]; onChange: (v: T) => void; label: string }) => (
  <div role="group" aria-label={label} className="inline-flex overflow-hidden rounded-md border border-line bg-white">
    {options.map((o, i) => (
      <button key={o.id} type="button" aria-pressed={value === o.id} onClick={() => onChange(o.id)} className={`px-3 py-2 text-sm font-bold ${i > 0 ? "border-l border-line" : ""} ${value === o.id ? "bg-ink text-white" : "text-ink hover:bg-sand"}`}>{o.label}</button>
    ))}
  </div>
);
export const Sec = ({ title, children }: { title: string; children: ReactNode }) => (
  <section className="mb-5"><h3 className="m-0 mb-2 text-[11px] font-extrabold uppercase tracking-[.12em] text-muted">{title}</h3>{children}</section>
);

export interface StudioProps {
  title: string; subtitle?: string; onClose: () => void;
  formats: StudioFormat[]; format: string; onFormat: (id: string) => void;
  content: ReactNode;                     // onglet 1 : ce qui est écrit
  look?: ReactNode;                       // onglet 2 : réglages propres à cette affiche (modèle, cartes…), avant le fond
  bg: string; onBg: (b: string) => void;  // fond de l'affiche
  partners?: { count: number; on: boolean; onChange: (v: boolean) => void; label?: string };
  fmt?: { items: FmtItem[]; value: Fmts; onChange: (f: Fmts) => void; selected: string; onSelect: (k: string) => void };
  textsExtra?: ReactNode;                 // onglet 3 : encart avant le panneau (ex. texte d'un événement de l'affiche du mois)
  preview: (ctx: { pick: (k: string) => void; goTab: (t: Tab) => void }) => ReactNode;
  printNode?: ReactNode;                  // l'affiche à imprimer (même contenu que l'aperçu)
  fileBase: (format: string) => string;   // nom du fichier sans extension
  beforeDownload?: () => Promise<void>;   // ex. enregistrer d'abord
  save?: SaveState;                       // état de l'enregistrement automatique
  topExtra?: ReactNode;                   // ex. « Mes affiches »
  noPrint?: boolean;
  intro?: ReactNode;                      // avertissement (droit à l'image…)
  notice?: ReactNode;                     // alerte au-dessus de l'aperçu (ex. « trop de texte »)
}

export function PosterStudio(p: StudioProps) {
  const [tab, setTab] = useState<Tab>("contenu");
  const [barOn, setBarOn] = useState(false);
  const [menu, setMenu] = useState(false);
  const [msg, setMsg] = useState("");
  const area = useRef<HTMLDivElement>(null); const holder = useRef<HTMLDivElement>(null);
  const cur = p.formats.find((f) => f.id === p.format) ?? p.formats[0];
  const { w, h } = cur;
  const [box, setBox] = useState({ w: 600, h: 600 });
  useLayoutEffect(() => {
    const el = area.current; if (!el) return;
    const f = () => setBox({ w: el.clientWidth, h: el.clientHeight });
    f(); const ro = new ResizeObserver(f); ro.observe(el); return () => ro.disconnect();
  }, []);
  const scale = Math.max(0.1, Math.min((box.w - 24) / w, (box.h - 24) / h, 1.2));
  // Pas de défilement derrière la fenêtre ; Échap ferme (sauf si la petite fenêtre des fonds est ouverte : elle gère son Échap)
  useEffect(() => {
    const old = document.body.style.overflow; document.body.style.overflow = "hidden";
    const k = (e: KeyboardEvent) => { if (e.key !== "Escape") return; if (document.querySelector('[role="dialog"][aria-label="Choisir un fond"]')) return; if (barOn) setBarOn(false); else p.onClose(); };
    window.addEventListener("keydown", k);
    return () => { document.body.style.overflow = old; window.removeEventListener("keydown", k); };
  });
  useEffect(() => { if (!menu) return; const c = () => setMenu(false); document.addEventListener("click", c); return () => document.removeEventListener("click", c); }, [menu]);

  const pick = (k: string) => { p.fmt?.onSelect(k); setTab("textes"); setBarOn(true); };
  const textsShown = !!p.fmt && tab === "textes";

  // Barre d'outils : posée au-dessus (ou dessous) du texte touché
  const [barPos, setBarPos] = useState<React.CSSProperties | null>(null);
  useLayoutEffect(() => {
    if (!barOn || tab !== "textes" || !p.fmt || !area.current || !holder.current) { setBarPos(null); return; }
    const key = p.fmt.selected;
    const el = /^[a-z0-9-]+$/i.test(key) ? holder.current.querySelector<HTMLElement>(`[data-fmt="${key}"]`) : null;
    if (!el) { setBarPos(null); return; }
    const a = area.current.getBoundingClientRect(), r = el.getBoundingClientRect();
    const top = r.top - a.top - 52 >= 4 ? r.top - a.top - 52 : Math.min(a.height - 52, r.bottom - a.top + 8);
    const left = Math.max(6, Math.min(r.left - a.left, a.width - 470));
    setBarPos({ top, left });
  }, [barOn, tab, p.fmt, scale, p.format, box.w, box.h]);

  const download = async (kind: "pdf" | "png") => {
    setMenu(false); setMsg(kind === "png" ? "Je prépare l'image…" : "Je prépare le PDF…");
    try {
      await p.beforeDownload?.();
      const node = holder.current?.firstElementChild as HTMLElement;
      const blob = kind === "png" ? await posterToPng(node, w, h) : await posterToPdf(node, w, h);
      const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `${p.fileBase(p.format)}.${kind}`;
      document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
      setMsg(kind === "png" ? "✔ Image enregistrée dans tes téléchargements : envoie-la sur Facebook, Instagram ou WhatsApp." : "✔ PDF enregistré dans tes téléchargements.");
    } catch (e) { setMsg((e as Error).message && !/Failed|NetworkError/.test((e as Error).message) ? (e as Error).message : "Impossible de faire le fichier sur cet appareil : essaie « Imprimer »."); }
  };
  const print = async () => {
    setMenu(false);
    try { await p.beforeDownload?.(); } catch { /* l'impression marche quand même */ }
    const st = document.createElement("style"); st.textContent = `@page{size:${w}px ${h}px;margin:0}`;
    document.head.appendChild(st); document.body.classList.add("printing-affiche");
    const done = () => { document.body.classList.remove("printing-affiche"); st.remove(); window.removeEventListener("afterprint", done); };
    window.addEventListener("afterprint", done); window.print();
  };

  const tabs: { id: Tab; label: string }[] = [{ id: "contenu", label: "1 · Contenu" }, { id: "apparence", label: "2 · Apparence" }, ...(p.fmt ? [{ id: "textes" as Tab, label: "3 · Textes" }] : [])];
  const s = p.save;
  const status = s?.kind === "saving" ? { t: s.text ?? "Enregistrement…", c: "text-[#e8d9a8]" } : s?.kind === "saved" ? { t: "● Enregistré automatiquement", c: "text-[#9fd8b3]" }
    : s?.kind === "error" ? { t: `⚠ ${s.text ?? "Pas enregistré"}`, c: "text-[#ffb4a8]" } : s?.kind === "local" ? { t: s.text ?? "● Réglages gardés sur cet appareil", c: "text-[#cfc8b6]" } : s?.text ? { t: s.text, c: "text-[#cfc8b6]" } : null;

  return createPortal(
    <div className="studio-root fixed inset-0 z-50 flex flex-col bg-[#ece7da]" role="dialog" aria-modal="true" aria-label={p.title}>
      <header className="flex flex-wrap items-center gap-x-3 gap-y-1 bg-ink px-4 py-2.5 text-white">
        <h2 className="m-0 min-w-0 flex-1 truncate font-serif text-xl font-semibold tracking-wide text-white">{p.title}{p.subtitle && <small className="block truncate font-sans text-xs font-normal tracking-normal text-white/60">{p.subtitle}</small>}</h2>
        {status && <span className={`text-xs ${status.c}`} role="status" aria-live="polite">{status.t}</span>}
        {p.topExtra}
        <div className="relative" onClick={(e) => e.stopPropagation()}>
          <button type="button" aria-haspopup="menu" aria-expanded={menu} onClick={() => setMenu((o) => !o)} className="rounded bg-champagne px-4 py-2 text-xs font-bold uppercase tracking-[.1em] text-white hover:brightness-110">⬇ Télécharger ▾</button>
          {menu && (
            <div role="menu" className="absolute right-0 top-[115%] z-40 w-64 overflow-hidden rounded-lg border border-line bg-white text-ink shadow-2xl">
              <button role="menuitem" type="button" className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-sand" onClick={() => void download("pdf")}><span aria-hidden>📄</span><span className="text-sm font-bold">PDF haute qualité<small className="block text-xs font-normal text-muted">pour l'imprimeur</small></span></button>
              <button role="menuitem" type="button" className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-sand" onClick={() => void download("png")}><span aria-hidden>🖼️</span><span className="text-sm font-bold">Image PNG<small className="block text-xs font-normal text-muted">pour WhatsApp, Facebook, Instagram</small></span></button>
              {!p.noPrint && <button role="menuitem" type="button" className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-sand" onClick={() => void print()}><span aria-hidden>🖨️</span><span className="text-sm font-bold">Imprimer<small className="block text-xs font-normal text-muted">directement</small></span></button>}
            </div>)}
        </div>
        <button type="button" onClick={p.onClose} className="rounded border border-white/30 px-3 py-2 text-xs font-bold uppercase tracking-[.1em] text-white hover:bg-white/10">✕ Fermer</button>
      </header>

      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto md:grid md:grid-cols-[380px_minmax(0,1fr)] md:overflow-hidden">
        <aside className="order-2 flex shrink-0 flex-col md:min-h-0 md:shrink border-t border-line bg-[#fbf8f2] md:order-1 md:border-r md:border-t-0">
          <div role="tablist" aria-label="Réglages de l'affiche" className="flex shrink-0 border-b border-line bg-[#fbf8f2]">
            {tabs.map((t) => (
              <button key={t.id} id={`tab-${t.id}`} role="tab" type="button" aria-selected={tab === t.id} aria-controls={`panel-${t.id}`} onClick={() => setTab(t.id)} className={`flex-1 border-b-[3px] px-2 py-3 text-sm font-bold ${tab === t.id ? "border-champagne bg-white text-ink" : "border-transparent text-muted hover:text-ink"}`}>{t.label}</button>))}
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-4">
            <div role="tabpanel" id="panel-contenu" aria-labelledby="tab-contenu" hidden={tab !== "contenu"}>
              <h3 className="m-0 font-serif text-lg text-ink">Ce qui est écrit</h3>
              {p.intro}
              <div className="mt-3 grid gap-3">{p.content}</div>
            </div>
            <div role="tabpanel" id="panel-apparence" aria-labelledby="tab-apparence" hidden={tab !== "apparence"}>
              <h3 className="m-0 mb-3 font-serif text-lg text-ink">L'allure de l'affiche</h3>
              {p.look}
              <Sec title="Fond"><BgPicker bg={p.bg} onChange={p.onBg} /></Sec>
              {p.partners && p.partners.count > 0 && <Sec title="Logos"><Toggle on={p.partners.on} onChange={p.partners.onChange} label={p.partners.label ?? "🤝 Montrer les partenaires du club"} /></Sec>}
            </div>
            {p.fmt && (
              <div role="tabpanel" id="panel-textes" aria-labelledby="tab-textes" hidden={tab !== "textes"}>
                <h3 className="m-0 font-serif text-lg text-ink">Les textes</h3>
                <p className="mb-3 mt-1 text-sm text-muted">👆 <b>Touche un texte sur l'affiche</b> : une petite barre apparaît juste à côté. Ou choisis-le ici. Gardé dans ce navigateur.</p>
                {p.textsExtra}
                <FmtPanel flat items={p.fmt.items} fmt={p.fmt.value} onChange={p.fmt.onChange} selected={p.fmt.selected} onSelect={(k) => { p.fmt!.onSelect(k); setBarOn(true); }} />
              </div>)}
          </div>
        </aside>

        <main className="order-1 flex min-w-0 shrink-0 flex-col bg-[#d9d3c3] md:order-2 md:min-h-0 md:shrink" style={{ backgroundImage: "radial-gradient(#c9c2ae 1px,transparent 1px)", backgroundSize: "18px 18px" }}>
          <div className="flex shrink-0 flex-wrap items-center justify-center gap-3 px-3 pt-3">
            {p.formats.length > 1 && <Seg label="Format de l'affiche" value={p.format} options={p.formats.map((f) => ({ id: f.id, label: f.label }))} onChange={p.onFormat} />}
            <span className="rounded-full bg-white/70 px-3 py-1 text-xs text-muted">L'aperçu = exactement ce qui sera enregistré</span>
          </div>
          {p.notice && <p role="alert" className="mx-3 mb-0 mt-2 shrink-0 rounded-md border border-[#e6d9a0] bg-[#fff4cc] px-3 py-2 text-center text-sm font-bold text-[#6b4e00]">{p.notice}</p>}
          <div ref={area} onPointerDown={(e) => { if (e.target === e.currentTarget) setBarOn(false); }} className="relative grid h-[58vh] min-h-[320px] place-items-center overflow-hidden md:h-auto md:min-h-0 md:flex-1">
            <SelOutline sel={textsShown && p.fmt ? p.fmt.selected : ""} />
            <div className="overflow-hidden rounded-sm border border-[#cfc7b2] bg-white shadow-[0_14px_40px_rgba(0,0,0,.3)]" style={{ width: w * scale, height: h * scale }}>
              <div className="pf-prev" ref={holder} style={{ width: w, height: h, transform: `scale(${scale})`, transformOrigin: "top left" }}>{p.preview({ pick, goTab: setTab })}</div>
            </div>
            {barOn && tab === "textes" && barPos && p.fmt && <FmtFloat items={p.fmt.items} fmt={p.fmt.value} onChange={p.fmt.onChange} selected={p.fmt.selected} style={barPos} onClose={() => setBarOn(false)} />}
          </div>
          <p className="m-0 min-h-6 shrink-0 px-3 pb-2 text-center text-sm font-bold text-ink" role="status">{msg}</p>
        </main>
      </div>
      {!p.noPrint && p.printNode && createPortal(<div className="affiche-print">{p.printNode}</div>, document.body)}
    </div>,
    document.body,
  );
}

import { useEffect, useRef, useState } from "react";
import { deleteOnline, listOnline, OnlineInfo, PosterKind } from "./posterOnline";

// « 📂 Mes affiches » : la liste des affiches enregistrées en ligne (de ce type) pour les rouvrir ou les supprimer.
// Les affiches se sauvent toutes seules : ce menu sert seulement à en retrouver une autre.
export function DraftsMenu({ kind, currentId, onOpen, onDeleted, local, onUploadLocal, refreshKey }: {
  kind: PosterKind; currentId: string | null; onOpen: (x: OnlineInfo) => Promise<void> | void; onDeleted?: (id: string) => void;
  local?: { id: string; name: string }[]; onUploadLocal?: (id: string) => Promise<void> | void; refreshKey?: number;
}) {
  const [open, setOpen] = useState(false);
  const [list, setList] = useState<OnlineInfo[] | null>(null);
  const [err, setErr] = useState(""); const [busy, setBusy] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const load = async () => { try { setList(await listOnline(kind)); setErr(""); } catch (e) { setList([]); setErr((e as Error).message || "Impossible de lire la liste."); } };
  useEffect(() => { void load(); }, [kind, refreshKey]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!open) return;
    const d = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", d); return () => document.removeEventListener("mousedown", d);
  }, [open]);
  const n = (list?.length ?? 0) + (local?.length ?? 0);
  return (
    <div ref={box} className="relative">
      <button type="button" aria-expanded={open} aria-haspopup="dialog" onClick={() => { setOpen((o) => !o); void load(); }} className="rounded border border-white/30 px-3 py-2 text-xs font-semibold  tracking-[.1em] text-white hover:bg-white/10">📂 Mes affiches{n ? ` (${n})` : ""}</button>
      {open && (
        <div role="dialog" aria-label="Mes affiches enregistrées" className="absolute right-0 top-[115%] z-40 w-[min(92vw,380px)] rounded-lg border border-line bg-white p-3 text-ink shadow-2xl">
          <p className="m-0 mb-2 text-xs text-muted">Enregistrées en ligne (photos comprises), visibles seulement par le coach, le président et le bureau. Effacées après 12 mois sans modification.</p>
          {err && <p className="m-0 mb-2 text-sm font-semibold text-[#b42318]">{err}</p>}
          {list && list.length === 0 && !(local?.length) && <p className="m-0 text-sm text-muted">Aucune affiche enregistrée pour l'instant.</p>}
          <ul className="m-0 grid max-h-72 list-none gap-2 overflow-y-auto p-0">
            {(list ?? []).map((x) => (
              <li key={x.id} className={`flex flex-wrap items-center gap-2 rounded-md border p-2 ${x.id === currentId ? "border-champagne bg-[#faf3df]" : "border-line bg-[#fbf8f2]"}`}>
                <span className="min-w-0 flex-1 [overflow-wrap:anywhere]"><b className="text-sm">{x.name}</b>{x.id === currentId && <span className="ml-1 text-xs text-muted">(ouverte)</span>}<br /><small className="text-muted">{x.photos} photo{x.photos > 1 ? "s" : ""} · {new Date(x.updatedAt).toLocaleString("fr-FR", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" })}{x.authorName ? ` · ${x.authorName}` : ""}</small></span>
                <button type="button" className="btn-clay !px-3 !py-1.5" disabled={busy || x.id === currentId} onClick={async () => { setBusy(true); setErr(""); try { await onOpen(x); setOpen(false); } catch (e) { setErr((e as Error).message || "Impossible de rouvrir cette affiche."); } finally { setBusy(false); } }}>Reprendre</button>
                <button type="button" className="btn-outline !px-2 !py-1.5" aria-label={`Supprimer ${x.name}`} onClick={async () => { if (!confirm(`Supprimer « ${x.name} » ? Elle sera effacée du serveur avec ses photos.`)) return; try { await deleteOnline(x.id); onDeleted?.(x.id); void load(); } catch (e) { setErr((e as Error).message); } }}>🗑️</button>
              </li>))}
            {(local?.length ?? 0) > 0 && <li className="text-sm font-semibold">Gardées seulement sur cet appareil :</li>}
            {(local ?? []).map((x) => (
              <li key={x.id} className="flex flex-wrap items-center gap-2 rounded-md border border-dashed border-line p-2">
                <span className="min-w-0 flex-1 text-sm font-semibold [overflow-wrap:anywhere]">{x.name}</span>
                <button type="button" className="btn-clay !px-3 !py-1.5" disabled={busy} onClick={async () => { setBusy(true); try { await onUploadLocal?.(x.id); void load(); } finally { setBusy(false); } }}>☁️ Mettre en ligne</button>
              </li>))}
          </ul>
        </div>)}
    </div>
  );
}

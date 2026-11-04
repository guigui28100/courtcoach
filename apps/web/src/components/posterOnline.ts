import { del, get, post, put, api, apiBlob } from "../api";

// Affiches enregistrées EN LIGNE (coach, président, bureau) : le texte part en JSON, chaque photo est envoyée à part (une demande par photo).
export interface OnlineInfo { id: string; kind: string; name: string; authorName: string | null; updatedAt: string; photos: number }
export type PosterKind = "resultats" | "bilan";

// Comment trouver (et remplacer) les photos dans les données d'une affiche
export interface PhotoAccess<T> { photos(s: T): string[]; remap(s: T, f: (p: string) => string): T }

const sent = new Map<string, string>(); // « affiche|photo (data:…) » → « srv:<identifiant> » : une photo déjà envoyée n'est pas renvoyée
const REF = /^srv:([A-Za-z0-9]{8,40})$/;

export const listOnline = (kind?: PosterKind) => get<OnlineInfo[]>("/poster-drafts").then((l) => (kind ? l.filter((x) => x.kind === kind) : l));
export const deleteOnline = (id: string) => del(`/poster-drafts/${id}`);

// Une photo « data:… » devient des octets SANS passer par fetch : la sécurité du site (connect-src 'self') interdit fetch sur une adresse data:,
// c'est ce qui empêchait les photos de partir (l'affiche était créée vide, puis l'envoi échouait).
function toBlob(dataUrl: string): Blob {
  const m = /^data:([^;,]+)?(;base64)?,(.*)$/s.exec(dataUrl);
  if (!m) throw new Error("Photo illisible.");
  const bin = m[2] ? atob(m[3]) : decodeURIComponent(m[3]);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: m[1] || "application/octet-stream" });
}
function toDataUrl(b: Blob) { return new Promise<string>((ok, ko) => { const r = new FileReader(); r.onload = () => ok(String(r.result)); r.onerror = () => ko(new Error("Photo illisible.")); r.readAsDataURL(b); }); }

// Enregistre (ou met à jour) : crée l'affiche si besoin, envoie les nouvelles photos une par une, puis le texte avec les références des photos.
// Si quelque chose échoue sur une affiche TOUTE NEUVE, on l'efface pour ne jamais laisser une affiche vide en ligne.
export async function saveOnline<T>(kind: PosterKind, id: string | null, name: string, saved: T, access: PhotoAccess<T>, progress?: (done: number, total: number) => void): Promise<string> {
  let draftId = id;
  const created = !draftId;
  try {
    if (!draftId) draftId = (await post<{ id: string }>("/poster-drafts", { kind, name, data: JSON.stringify(access.remap(saved, () => "")) })).id;
    const did = draftId;
    const todo = [...new Set(access.photos(saved).filter((p) => p && !sent.has(`${did}|${p}`) && !REF.test(p)))];
    let done = 0; progress?.(0, todo.length);
    for (const p of todo) {
      const r = await api<{ id: string }>(`/poster-drafts/${did}/photos`, { method: "POST", body: toBlob(p), headers: { "Content-Type": "application/octet-stream" } });
      sent.set(`${did}|${p}`, `srv:${r.id}`); progress?.(++done, todo.length);
    }
    const body = access.remap(saved, (p) => sent.get(`${did}|${p}`) ?? p);
    await put(`/poster-drafts/${did}`, { name, data: JSON.stringify(body) });
    return did;
  } catch (e) {
    if (created && draftId) { try { await del(`/poster-drafts/${draftId}`); } catch { /* rien de plus à faire */ } }
    throw e;
  }
}

// Rouvre : le texte, puis les photos (rendues comme avant, en data:…)
export async function loadOnline<T>(id: string, access: PhotoAccess<T>): Promise<{ name: string; saved: T }> {
  const r = await get<{ name: string; data: string }>(`/poster-drafts/${id}`);
  const raw = JSON.parse(r.data) as T;
  const urls = new Map<string, string>();
  await Promise.all([...new Set(access.photos(raw))].map(async (p) => {
    const m = REF.exec(p); if (!m) return;
    let blob: Blob;
    try { blob = await apiBlob(`/poster-drafts/${id}/photos/${m[1]}`); } catch { throw new Error("Une photo de cette affiche n'a pas pu être rechargée (elle a peut-être été perdue à l'enregistrement)."); }
    const url = await toDataUrl(blob); sent.set(`${id}|${url}`, p); urls.set(p, url);
  }));
  return { name: r.name, saved: access.remap(raw, (p) => urls.get(p) ?? p) };
}

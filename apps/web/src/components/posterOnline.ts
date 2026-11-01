import { del, get, post, put, api } from "../api";

// Affiches enregistrées EN LIGNE (coach, président, bureau) : le texte part en JSON, chaque photo est envoyée à part (une demande par photo).
export interface OnlineInfo { id: string; name: string; authorName: string | null; updatedAt: string; photos: number }
type WithPhotos = { d: { tournaments: { photos: string[] }[] } };

const sent = new Map<string, string>(); // « affiche|photo (data:…) » → « srv:<identifiant> » : une photo déjà envoyée n'est pas renvoyée
const REF = /^srv:([A-Za-z0-9]{8,40})$/;

export const listOnline = () => get<OnlineInfo[]>("/poster-drafts");
export const deleteOnline = (id: string) => del(`/poster-drafts/${id}`);

async function toBlob(dataUrl: string) { return (await fetch(dataUrl)).blob(); }
function toDataUrl(b: Blob) { return new Promise<string>((ok, ko) => { const r = new FileReader(); r.onload = () => ok(String(r.result)); r.onerror = () => ko(new Error("Photo illisible.")); r.readAsDataURL(b); }); }

// Enregistre (ou met à jour) : crée l'affiche si besoin, envoie les nouvelles photos une par une, puis le texte avec les références des photos
export async function saveOnline<T extends WithPhotos>(id: string | null, name: string, saved: T, progress?: (done: number, total: number) => void): Promise<string> {
  const strip = (x: T) => JSON.stringify({ ...x, d: { ...x.d, tournaments: x.d.tournaments.map((t) => ({ ...t, photos: [] as string[] })) } });
  let draftId = id;
  if (!draftId) draftId = (await post<{ id: string }>("/poster-drafts", { kind: "resultats", name, data: strip(saved) })).id;
  const all = saved.d.tournaments.flatMap((t) => t.photos).filter((p) => !sent.has(`${draftId}|${p}`) && !REF.test(p));
  const todo = [...new Set(all)]; let done = 0; progress?.(0, todo.length);
  for (const p of todo) {
    const r = await api<{ id: string }>(`/poster-drafts/${draftId}/photos`, { method: "POST", body: await toBlob(p), headers: { "Content-Type": "application/octet-stream" } });
    sent.set(`${draftId}|${p}`, `srv:${r.id}`); progress?.(++done, todo.length);
  }
  const ref = (p: string) => sent.get(`${draftId}|${p}`) ?? p;
  const body = { ...saved, d: { ...saved.d, tournaments: saved.d.tournaments.map((t) => ({ ...t, photos: t.photos.map(ref) })) } };
  await put(`/poster-drafts/${draftId}`, { name, data: JSON.stringify(body) });
  return draftId;
}

// Rouvre : le texte, puis les photos (rendues comme avant, en data:…)
export async function loadOnline<T extends WithPhotos>(id: string): Promise<{ name: string; saved: T }> {
  const r = await get<{ name: string; data: string }>(`/poster-drafts/${id}`);
  const saved = JSON.parse(r.data) as T;
  await Promise.all(saved.d.tournaments.flatMap((t) => t.photos.map(async (p, j) => {
    const m = REF.exec(p); if (!m) return;
    const res = await fetch(`/api/poster-drafts/${id}/photos/${m[1]}`, { credentials: "same-origin" });
    if (!res.ok) throw new Error("Une photo n'a pas pu être rechargée.");
    const url = await toDataUrl(await res.blob()); sent.set(`${id}|${url}`, p); t.photos[j] = url;
  })));
  return { name: r.name, saved };
}

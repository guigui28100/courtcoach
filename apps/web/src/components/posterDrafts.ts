// Brouillons d'affiches : gardés SEULEMENT dans le navigateur de cet appareil (IndexedDB), photos comprises.
// Rien n'est envoyé sur Internet : si le coach efface les données du navigateur ou change d'ordinateur, ils n'existent plus.
export interface PosterDraft<T = unknown> { id: string; kind: string; name: string; savedAt: number; data: T }
const DB = "cc-affiches", STORE = "brouillons";

function open(): Promise<IDBDatabase> {
  return new Promise((ok, ko) => {
    if (typeof indexedDB === "undefined") return ko(new Error("Ce navigateur ne peut pas garder de brouillon."));
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => { req.result.createObjectStore(STORE, { keyPath: "id" }); };
    req.onsuccess = () => ok(req.result);
    req.onerror = () => ko(new Error("Impossible d'ouvrir la mémoire du navigateur (navigation privée ?)."));
  });
}
const run = async <R>(mode: IDBTransactionMode, f: (s: IDBObjectStore) => IDBRequest<R>): Promise<R> => {
  const db = await open();
  try {
    return await new Promise<R>((ok, ko) => { const tx = db.transaction(STORE, mode); const r = f(tx.objectStore(STORE)); tx.oncomplete = () => ok(r.result); tx.onerror = () => ko(new Error("Enregistrement impossible : la mémoire du navigateur est peut-être pleine.")); tx.onabort = tx.onerror; });
  } finally { db.close(); }
};

export const newDraftId = () => `d${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
export async function listDrafts<T>(kind: string): Promise<PosterDraft<T>[]> {
  const all = await run<PosterDraft<T>[]>("readonly", (s) => s.getAll() as IDBRequest<PosterDraft<T>[]>);
  return all.filter((d) => d.kind === kind).sort((a, b) => b.savedAt - a.savedAt);
}
export const saveDraft = <T,>(d: PosterDraft<T>) => run("readwrite", (s) => s.put(d)).then(() => undefined);
export const deleteDraft = (id: string) => run("readwrite", (s) => s.delete(id)).then(() => undefined);

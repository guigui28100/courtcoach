// Appels au serveur. Les cookies de connexion sont « httpOnly » : le JavaScript du site ne peut jamais les lire.
export class ApiError extends Error {
  constructor(public status: number, message: string, public code?: string) { super(message); }
}

// Compteur des demandes en cours : le petit voile d'attente (NetLoader) s'affiche tant que le serveur n'a pas répondu.
let pending = 0;
const listeners = new Set<(n: number) => void>();
export const onPending = (fn: (n: number) => void) => { listeners.add(fn); return () => { listeners.delete(fn); }; };
function track(delta: number) { pending = Math.max(0, pending + delta); listeners.forEach((f) => f(pending)); }

async function raw(path: string, init: RequestInit = {}) {
  const quiet = path.includes("/chunks/") || path.includes("/auth/refresh") || path.includes("/ping"); // envois de vidéo et renouvellements : pas de voile
  if (!quiet) track(1);
  try { return await send(path, init); } finally { if (!quiet) track(-1); }
}
async function send(path: string, init: RequestInit) {
  const res = await fetch("/api" + path, {
    credentials: "same-origin",
    ...init,
    headers: { ...(init.body ? { "Content-Type": "application/json" } : {}), ...init.headers },
  });
  return res;
}

async function parse(res: Response) {
  if (res.status === 204) return undefined;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const m = Array.isArray(data.message) ? data.message[0] : data.message;
    throw new ApiError(res.status, m || "Une erreur est survenue.", data.code);
  }
  return data;
}

// Une seule demande de renouvellement à la fois : si plusieurs requêtes échouent en même temps (connexion expirée),
// elles attendent toutes le même renouvellement au lieu d'en lancer chacune un (ce qui fermerait la session).
let refreshing: Promise<boolean> | null = null;
function refreshOnce() {
  refreshing ??= raw("/auth/refresh", { method: "POST" }).then((r) => r.ok).catch(() => false).finally(() => { refreshing = null; });
  return refreshing;
}

// « Voir comme un entraîneur » : le coach regarde sans rien pouvoir modifier (toute demande qui écrit est refusée ici).
let previewOnly = false;
export const setPreviewOnly = (v: boolean) => { previewOnly = v; };

export async function api<T = any>(path: string, init: RequestInit = {}): Promise<T> {
  if (previewOnly && init.method && init.method !== "GET" && !path.startsWith("/auth/") && !path.includes("/ping")) throw new ApiError(0, "Aperçu : rien n'est enregistré. Quitte l'aperçu pour agir.");
  let res = await raw(path, init);
  // Connexion expirée : renouvellement discret, puis on rejoue la demande une fois. On la rejoue même si le renouvellement
  // a échoué : un autre onglet a pu renouveler la session entre-temps (les cookies sont partagés).
  if (res.status === 401 && (!path.startsWith("/auth/") || path === "/auth/me")) {
    await refreshOnce();
    res = await raw(path, init);
  }
  // Double authentification obligatoire (réglage du serveur) : on emmène le coach sur la page Sécurité
  if (res.status === 403) {
    const body = await res.clone().json().catch(() => null);
    if (body?.code === "TWO_FACTOR_REQUIRED" && !location.pathname.startsWith("/coach/securite")) location.assign("/coach/securite");
  }
  return parse(res) as Promise<T>;
}

export const get = <T = any>(p: string) => api<T>(p);
export const post = <T = any>(p: string, body?: unknown) => api<T>(p, { method: "POST", body: body === undefined ? undefined : JSON.stringify(body) });
export const put = <T = any>(p: string, body: unknown) => api<T>(p, { method: "PUT", body: JSON.stringify(body) });
export const patch = <T = any>(p: string, body: unknown) => api<T>(p, { method: "PATCH", body: JSON.stringify(body) });
export const del = <T = any>(p: string) => api<T>(p, { method: "DELETE" });

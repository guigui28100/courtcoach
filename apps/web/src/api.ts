// Appels au serveur. Les cookies de connexion sont « httpOnly » : le JavaScript du site ne peut jamais les lire.
export class ApiError extends Error {
  constructor(public status: number, message: string, public code?: string) { super(message); }
}

async function raw(path: string, init: RequestInit = {}) {
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

export async function api<T = any>(path: string, init: RequestInit = {}): Promise<T> {
  let res = await raw(path, init);
  // Connexion expirée : renouvellement discret, puis on rejoue la demande une fois. On la rejoue même si le renouvellement
  // a échoué : un autre onglet a pu renouveler la session entre-temps (les cookies sont partagés).
  if (res.status === 401 && (!path.startsWith("/auth/") || path === "/auth/me")) {
    await refreshOnce();
    res = await raw(path, init);
  }
  return parse(res) as Promise<T>;
}

export const get = <T = any>(p: string) => api<T>(p);
export const post = <T = any>(p: string, body?: unknown) => api<T>(p, { method: "POST", body: body === undefined ? undefined : JSON.stringify(body) });
export const put = <T = any>(p: string, body: unknown) => api<T>(p, { method: "PUT", body: JSON.stringify(body) });
export const patch = <T = any>(p: string, body: unknown) => api<T>(p, { method: "PATCH", body: JSON.stringify(body) });
export const del = <T = any>(p: string) => api<T>(p, { method: "DELETE" });

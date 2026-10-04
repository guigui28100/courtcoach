import { createContext, ReactNode, useCallback, useContext, useEffect, useRef, useState } from "react";
import { del, get, post } from "./api";
import { Me } from "./types";

interface AuthCtx {
  me: Me | null; loading: boolean;
  login(email: string, password: string, code?: string): Promise<void>;
  signup(v: { email: string; password: string; firstName?: string; acceptPolicy: boolean }): Promise<void>;
  acceptInvitation(v: { token: string; password: string; firstName?: string; acceptPolicy: boolean }): Promise<void>;
  logout(): Promise<void>;
  eraseAccount(): Promise<void>;
  reload(): Promise<void>;
}
const Ctx = createContext<AuthCtx>(null as never);
export const useAuth = () => useContext(Ctx);

const IDLE_MS = 30 * 60 * 1000; // déconnexion après 30 minutes sans activité (appareil partagé)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);
  const timer = useRef<number | undefined>(undefined);

  const reload = useCallback(async () => {
    try { setMe(await get<Me>("/auth/me")); } catch { setMe(null); }
  }, []);
  useEffect(() => { reload().finally(() => setLoading(false)); }, [reload]);

  const logout = useCallback(async () => { try { await post("/auth/logout"); } finally { setMe(null); } }, []);

  useEffect(() => {
    if (!me) return;
    const arm = () => { window.clearTimeout(timer.current); timer.current = window.setTimeout(() => { logout(); }, IDLE_MS); };
    const events = ["pointerdown", "keydown", "scroll", "touchstart"] as const;
    events.forEach((e) => window.addEventListener(e, arm, { passive: true }));
    arm();
    return () => { events.forEach((e) => window.removeEventListener(e, arm)); window.clearTimeout(timer.current); };
  }, [me, logout]);

  const value: AuthCtx = {
    me, loading, reload, logout,
    login: async (email, password, code) => { await post("/auth/login", { email, password, ...(code ? { code } : {}) }); await reload(); },
    signup: async (v) => { await post("/auth/signup", v); await reload(); },
    acceptInvitation: async (v) => { await post("/auth/invitations/accept", v); await reload(); },
    eraseAccount: async () => { await del("/auth/me"); setMe(null); },
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

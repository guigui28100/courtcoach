import { useEffect, useRef, useSyncExternalStore } from "react";

// Une seule barre de navigation : quand la barre de gauche du coach / des entraîneurs est affichée (ordinateur),
// les onglets de la page y viennent se ranger sous leur rubrique au lieu d'avoir leur propre barre.
export interface SubItem { key: string; label: string; count?: number; active: boolean; onSelect?: () => void; to?: string }
interface State { sidebar: boolean; items: SubItem[] | null; owner: number }
let state: State = { sidebar: false, items: null, owner: 0 };
const subs = new Set<() => void>();
const set = (p: Partial<State>) => { state = { ...state, ...p }; subs.forEach((f) => f()); };
const read = () => state;
const sub = (f: () => void) => { subs.add(f); return () => { subs.delete(f); }; };
export const useSubNav = () => useSyncExternalStore(sub, read, read);
export const setSidebar = (on: boolean) => { if (state.sidebar !== on) set({ sidebar: on }); };

let seq = 0;
// Déclare les entrées de la page. Renvoie true quand elles s'affichent dans la barre de gauche (la page cache alors sa propre barre sur ordinateur).
export function useRegisterSubNav(items: SubItem[]): boolean {
  const id = useRef(0); if (!id.current) id.current = ++seq;
  const latest = useRef(items); latest.current = items;
  const sig = JSON.stringify(items.map((i) => [i.key, i.label, i.count ?? 0, i.active, i.to ?? ""]));
  const on = state.sidebar;
  useEffect(() => {
    if (!on) return;
    set({ items: latest.current, owner: id.current });
    return () => { if (state.owner === id.current) set({ items: null, owner: 0 }); };
  }, [on, sig]);
  return useSubNav().sidebar;
}

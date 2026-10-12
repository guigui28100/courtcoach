import { useEffect, useState } from "react";

// Choix du joueur : « auto » suit les réglages de son appareil (clair ou sombre), sinon il impose clair ou sombre.
// Gardé seulement dans son navigateur (aucune donnée envoyée).
export type ThemePref = "auto" | "light" | "dark";
const KEY = "cc-theme";
const MQ = "(prefers-color-scheme: dark)";

function readPref(): ThemePref {
  try { const v = localStorage.getItem(KEY); return v === "light" || v === "dark" ? v : "auto"; } catch { return "auto"; }
}
const resolve = (p: ThemePref) => (p === "auto" ? (window.matchMedia?.(MQ).matches ? "dark" : "light") : p);

export function useThemePref(): [ThemePref, (p: ThemePref) => void] {
  const [pref, setPrefState] = useState<ThemePref>(readPref);
  useEffect(() => { const sync = () => setPrefState(readPref()); window.addEventListener("cc-theme-change", sync); return () => window.removeEventListener("cc-theme-change", sync); }, []);
  const setPref = (p: ThemePref) => {
    try { if (p === "auto") localStorage.removeItem(KEY); else localStorage.setItem(KEY, p); } catch { /* navigateur sans stockage : le choix dure juste cette visite */ }
    setPrefState(p); window.dispatchEvent(new Event("cc-theme-change"));
  };
  return [pref, setPref];
}

// Pose le thème « ados » (plus de 10 ans) et le mode clair / sombre sur toute la page ; tout est retiré quand on quitte l'espace du jeune.
export function useYouthTheme(teen: boolean) {
  const [pref] = useThemePref();
  useEffect(() => {
    const root = document.documentElement;
    if (teen) root.dataset.gal = "teen"; else delete root.dataset.gal;
    return () => { delete root.dataset.gal; };
  }, [teen]);
  useEffect(() => {
    const root = document.documentElement, mq = window.matchMedia?.(MQ);
    const apply = () => { root.dataset.mode = resolve(pref); };
    apply();
    mq?.addEventListener?.("change", apply);
    return () => { mq?.removeEventListener?.("change", apply); delete root.dataset.mode; };
  }, [pref]);
}

// Petit sélecteur : Automatique (réglages de l'appareil) · Clair · Sombre
export const THEME_CHOICES: [ThemePref, string, string][] = [["auto", "🌓", "Automatique"], ["light", "☀️", "Clair"], ["dark", "🌙", "Sombre"]];

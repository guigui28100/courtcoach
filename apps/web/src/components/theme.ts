import { useEffect } from "react";

// Pose le thème « ados » (plus de 10 ans) sur toute la page ; il est retiré quand on quitte l'espace du jeune.
export function useYouthTheme(teen: boolean) {
  useEffect(() => {
    const root = document.documentElement;
    if (teen) root.dataset.gal = "teen"; else delete root.dataset.gal;
    return () => { delete root.dataset.gal; };
  }, [teen]);
}

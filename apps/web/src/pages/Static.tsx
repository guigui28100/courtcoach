import { useEffect } from "react";
import confidentialite from "../legal/confidentialite.html?raw";
import autorisation from "../legal/autorisation.html?raw";

// Textes juridiques écrits par nous (jamais de texte saisi par un visiteur) : affichage direct.
function Legal({ html }: { html: string }) {
  useEffect(() => {
    const onClick = (e: Event) => { if ((e.target as HTMLElement).closest("[data-print]")) window.print(); };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);
  return <article className="legal" dangerouslySetInnerHTML={{ __html: html }} />;
}
export const Privacy = () => <Legal html={confidentialite} />;
export const Authorization = () => <Legal html={autorisation} />;

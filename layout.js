/* En-tête, menu du bas (téléphone) et pied de page des pages de l'application. */
(() => {
  const { h } = CC;

  // Si quelque chose se passe mal, on l'affiche au lieu de rester silencieux
  let problemShown = false;
  function showProblem(text) {
    if (problemShown || /ResizeObserver loop/.test(text)) return;
    problemShown = true;
    document.body.append(h("div", { class: "problem-banner", role: "alert" },
      "Petit problème technique : " + text + ". Recharge la page ; si ça continue, recopie cette phrase pour la donner à ton assistant.",
      h("button", { type: "button", onclick: (e) => e.target.parentElement.remove() }, "Fermer")));
  }
  window.addEventListener("error", (e) => showProblem((e.message || "erreur") + (e.filename ? " (" + e.filename.split("/").pop() + " ligne " + e.lineno + ")" : "")));
  window.addEventListener("unhandledrejection", (e) => showProblem(String((e.reason && e.reason.message) || e.reason || "erreur")));

  const role = CC.role();

  // Sans « connexion » (démo), on renvoie vers la page de compte.
  if (!role) {
    location.replace("compte.html#connexion");
    return;
  }
  const isCoach = role === "coach";
  if (!isCoach) CC.ensureMe(); // en démonstration, un élève existe toujours
  const page = document.body.dataset.page;

  const icon = (paths) => {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("aria-hidden", "true");
    svg.innerHTML = paths; // texte fixe écrit ici, jamais du texte saisi par quelqu'un
    return svg;
  };
  const ICONS = {
    espace: '<path d="M3 11.5 12 4l9 7.5M5.5 10v9.5h13V10"/>',
    videos: '<rect x="2.5" y="5" width="19" height="14" rx="2.5"/><path d="M10 9.2v5.6l4.8-2.8z"/>',
    messages: '<path d="M4 5.5h16a1.5 1.5 0 0 1 1.5 1.5v9a1.5 1.5 0 0 1-1.5 1.5H9l-5 3.5V7A1.5 1.5 0 0 1 4 5.5z"/>',
    profil: '<circle cx="12" cy="8.5" r="3.6"/><path d="M4.5 20c.8-4 3.8-6 7.5-6s6.7 2 7.5 6"/>',
    suivi: '<path d="M8 4h8v5a4 4 0 0 1-8 0zM8 6H5v2a3 3 0 0 0 3 3M16 6h3v2a3 3 0 0 1-3 3M12 13v4M8.5 20h7"/>',
    eleves: '<circle cx="9" cy="8.5" r="3.2"/><path d="M3 20c.6-3.6 3-5.4 6-5.4s5.4 1.8 6 5.4M16 5.6a3.2 3.2 0 0 1 0 5.8M18 14.8c1.8.6 2.9 2.4 3.2 5.2"/>',
  };

  const items = isCoach
    ? [
        ["espace", "espace.html", "Espace"],
        ["eleves", "eleves.html", "Demande de coaching", "Coaching"],
        ["suivi", "suivi.html", "Centre de compétition jeunes", "Centre jeunes"],
        ["videos", "videos.html", "Vidéos"],
      ]
    : [
        ["espace", "espace.html", "Espace"],
        ["videos", "videos.html", "Mes vidéos"],
        ...(CC.read("comp.players", []).some((p) => p.accountId === CC.ensureMe()) ? [["suivi", "mon-suivi.html", "Mon suivi"]] : []),
        ["profil", "profil.html", "Mon profil"],
      ];

  const link = (key, href, label, cls, short) =>
    h("a", { href, class: cls, "aria-current": page === key || (key === "eleves" && (page === "analyse" || page === "discussion")) || (key === "suivi" && (page === "joueur" || page === "bulletin" || page === "mon-suivi")) || (key === "videos" && page === "discussion" && !isCoach) ? "page" : null },
      cls === "tabbar__link" ? icon(ICONS[key]) : null, short ? (cls === "tabbar__link" ? h("span", {}, short) : [h("span", { class: "lbl-long" }, label), h("span", { class: "lbl-short" }, short)]) : h("span", {}, label));

  const switchRole = h("button", {
    type: "button",
    class: "btn btn--small role-switch",
    title: "Démonstration : passer d'un côté à l'autre pour tester les échanges",
    onclick: () => {
      CC.setRole(isCoach ? "eleve" : "coach");
      location.href = "espace.html";
    },
  }, isCoach ? "Mode coach" : "Mode élève", h("span", { "aria-hidden": "true" }, " ⇄"));

  const header = h("header", { class: "topbar" },
    h("div", { class: "wrap topbar__inner" },
      h("a", { class: "brand", href: "espace.html", "aria-label": "CourtCoach, mon espace" },
        (() => {
          const s = icon('<circle cx="16" cy="16" r="15" fill="#dcf247" stroke="none"/><path d="M5 6c6 5 6 15 0 20M27 6c-6 5-6 15 0 20" fill="none" stroke="#10203a" stroke-width="1.8" stroke-linecap="round"/>');
          s.setAttribute("viewBox", "0 0 32 32");
          s.setAttribute("class", "brand__ball");
          return s;
        })(),
        h("span", { class: "brand__name" }, "Court", h("span", {}, "Coach"))),
      h("nav", { class: "topbar__nav", "aria-label": "Menu principal" },
        items.map(([k, href, label, short]) => link(k, href, label, "topbar__link", short))),
      switchRole,
      h("a", { class: "topbar__quit", href: "index.html", onclick: () => CC.setRole(null) }, "Quitter")));

  const tabbar = h("nav", { class: "tabbar", "aria-label": "Menu principal", style: "grid-template-columns: repeat(" + items.length + ", 1fr)" },
    items.map(([k, href, label, short]) => link(k, href, label, "tabbar__link", short)));

  const footer = h("footer", { class: "footer" },
    h("div", { class: "wrap footer__inner" },
      h("p", {}, h("strong", {}, "Tennis Club Houdan"), " · CourtCoach"),
      h("p", {}, "Démonstration : les informations restent sur ton appareil, rien n'est envoyé sur Internet. ",
        h("a", { href: "confidentialite.html" }, "Confidentialité"), " · ", h("a", { href: "diagnostic.html" }, "Un souci ? Lancer le test de fonctionnement"), " · version " + CC.VERSION)));

  document.body.prepend(h("a", { class: "skip-link", href: "#contenu" }, "Aller au contenu"), header);
  document.body.append(footer, tabbar);
  document.body.classList.add("app", isCoach ? "app--coach" : "app--eleve");
  document.dispatchEvent(new CustomEvent("cc:ready", { detail: { role } }));
})();

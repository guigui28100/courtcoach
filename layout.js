/* En-tête, menu du bas (téléphone) et pied de page des pages de l'application. */
(() => {
  const { h } = CC;
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
    eleves: '<circle cx="9" cy="8.5" r="3.2"/><path d="M3 20c.6-3.6 3-5.4 6-5.4s5.4 1.8 6 5.4M16 5.6a3.2 3.2 0 0 1 0 5.8M18 14.8c1.8.6 2.9 2.4 3.2 5.2"/>',
  };

  const items = isCoach
    ? [
        ["espace", "espace.html", "Espace"],
        ["eleves", "eleves.html", "Élèves"],
        ["videos", "videos.html", "Vidéos"],
      ]
    : [
        ["espace", "espace.html", "Espace"],
        ["videos", "videos.html", "Mes vidéos"],
        ["profil", "profil.html", "Mon profil"],
      ];

  const link = (key, href, label, cls) =>
    h("a", { href, class: cls, "aria-current": page === key || (key === "eleves" && (page === "analyse" || page === "discussion")) || (key === "videos" && page === "discussion" && !isCoach) ? "page" : null },
      cls === "tabbar__link" ? icon(ICONS[key]) : null, h("span", {}, label));

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
        items.map(([k, href, label]) => link(k, href, label, "topbar__link"))),
      switchRole,
      h("a", { class: "topbar__quit", href: "index.html", onclick: () => CC.setRole(null) }, "Quitter")));

  const tabbar = h("nav", { class: "tabbar", "aria-label": "Menu principal", style: "grid-template-columns: repeat(" + items.length + ", 1fr)" },
    items.map(([k, href, label]) => link(k, href, label, "tabbar__link")));

  const footer = h("footer", { class: "footer" },
    h("div", { class: "wrap footer__inner" },
      h("p", {}, h("strong", {}, "Tennis Club Houdan"), " · CourtCoach"),
      h("p", {}, "Démonstration : les informations restent sur ton appareil, rien n'est envoyé sur Internet.")));

  document.body.prepend(h("a", { class: "skip-link", href: "#contenu" }, "Aller au contenu"), header);
  document.body.append(footer, tabbar);
  document.body.classList.add("app", isCoach ? "app--coach" : "app--eleve");
  document.dispatchEvent(new CustomEvent("cc:ready", { detail: { role } }));
})();

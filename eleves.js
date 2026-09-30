// Page « Mes élèves » (coach) : la liste des dossiers.
(() => {
  const role = CC.role();
  if (!role) return;
  if (role !== "coach") { location.replace("espace.html"); return; }
  const { h } = CC;

  const videos = CC.videos().filter((v) => v.owner === "eleve");
  const cards = CC.students().map((a) => {
    const p = CC.profile(a.id);
    const mine = videos.filter((v) => v.studentId === a.id);
    const toDo = mine.filter((v) => v.status !== "analysee");
    const fresh = toDo.filter((v) => !v.seen);
    const last = mine.map((v) => v.date).sort().pop() || a.created;
    const age = CC.ageOf(p.naissance);
    const facts = [age !== null ? age + " ans" : null, p.classement, p.lateralite].filter(Boolean).join(" · ");
    return { a, p, mine, toDo, fresh, last, facts };
  }).sort((x, y) => (y.fresh.length - x.fresh.length) || y.last.localeCompare(x.last));

  const box = document.getElementById("liste-eleves");
  cards.forEach(({ a, mine, toDo, fresh, last, facts }) => {
    box.append(h("article", { class: "card" },
      h("h3", {}, CC.studentName(a.id)),
      h("p", { class: "hint" }, facts || "Profil pas encore rempli"),
      fresh.length ? h("p", { style: "margin: 0 0 8px" }, h("span", { class: "badge badge--new" }, fresh.length + (fresh.length > 1 ? " nouvelles vidéos" : " nouvelle vidéo"))) : null,
      h("p", { class: "hint", style: "margin-bottom: var(--s2)" },
        [mine.length + " vidéo" + (mine.length > 1 ? "s" : ""), toDo.length ? toDo.length + " à analyser" : null, "dernière activité le " + CC.fmtDate(last)].filter(Boolean).join(" · ")),
      h("a", { class: "btn btn--clay btn--small", href: "eleve.html?id=" + a.id }, "Ouvrir le dossier")));
  });
  if (!cards.length) {
    box.append(h("div", { class: "empty", style: "grid-column: 1 / -1" },
      "Aucun élève pour l'instant. Les dossiers apparaissent dès qu'un élève crée son compte."));
  }
})();

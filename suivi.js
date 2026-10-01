// Pôle compétition : la liste des jeunes compétiteurs du coach.
(() => {
  const role = CC.role();
  if (!role) return;
  if (role !== "coach") { location.replace("espace.html"); return; }
  const { h } = CC;
  const comp = CC.comp;
  const $ = (id) => document.getElementById(id);
  const cur = comp.current();

  const RANKINGS = ["NC", "40", "30/5", "30/4", "30/3", "30/2", "30/1", "30", "15/5", "15/4", "15/3", "15/2", "15/1", "15", "5/6", "4/6", "3/6", "2/6", "1/6", "0", "-2/6", "-4/6"];
  CC.fill($("a-classement"), h("option", { value: "" }, "Choisir…"), ...RANKINGS.map((r) => h("option", { value: r }, r)));

  // Dernière période évaluée (la période en cours si elle est commencée, sinon la plus récente)
  function referencePeriod(pid) {
    const list = comp.evaluatedPeriods(pid);
    const now = list.find((x) => x.season === cur.season && x.t === cur.t);
    return now || list[0] || null;
  }

  function render() {
    const players = comp.players();

    // ----- Chiffres clés -----
    const goalsAll = players.flatMap((p) => comp.goals(p.id, cur.season));
    const avgGoals = comp.goalsProgress(goalsAll);
    const videosNow = CC.videos().filter((v) => v.playerId && comp.inPeriod(v.date, cur.season, cur.t)).length;
    const toPrepare = players.filter((p) => comp.completion(comp.getEval(p.id, cur.season, cur.t)) < 100);
    CC.fill($("stats"), 
      h("div", { class: "card stat" }, h("b", {}, String(players.length)), h("span", {}, "Joueur" + (players.length > 1 ? "s" : "") + " suivi" + (players.length > 1 ? "s" : ""))),
      h("div", { class: "card stat" }, h("b", {}, avgGoals === null ? "–" : avgGoals + " %"), h("span", {}, "Objectifs de l'année atteints"), h("small", {}, goalsAll.length + " objectif" + (goalsAll.length > 1 ? "s" : "") + " fixé" + (goalsAll.length > 1 ? "s" : ""))),
      h("div", { class: "card stat" }, h("b", {}, String(videosNow)), h("span", {}, "Vidéo" + (videosNow > 1 ? "s" : "") + " ce trimestre"), h("small", {}, comp.periodLabel(cur.season, cur.t))));

    // ----- Bulletins à préparer -----
    $("a-preparer").hidden = !toPrepare.length;
    CC.fill($("liste-prep"), ...toPrepare.map((p) => {
      const pct = comp.completion(comp.getEval(p.id, cur.season, cur.t));
      return h("li", { class: "list__item" },
        h("div", { class: "list__main", style: "display:flex; flex-direction:row; align-items:center; gap:12px" },
          CC.ui.avatar(p, 40),
          h("div", {}, h("strong", {}, comp.fullName(p)), h("small", { style: "display:block" }, comp.periodLabel(cur.season, cur.t) + " · évaluation remplie à " + pct + " %"))),
        h("a", { class: "btn btn--small btn--clay", href: "joueur.html?id=" + p.id + "#evaluations" }, pct ? "Continuer l'évaluation" : "Commencer l'évaluation"));
    }));

    // ----- Cartes des joueurs -----
    const grid = $("joueurs");
    CC.fill(grid, ...players.map((p) => {
      const ref = referencePeriod(p.id);
      const ev = ref ? comp.getEval(p.id, ref.season, ref.t) : comp.getEval(p.id, cur.season, cur.t);
      const values = {};
      comp.AXES.forEach((a) => { values[a.key] = comp.axisAverage(ev, a.key) || 0; });
      const gp = comp.goalsProgress(comp.goals(p.id, cur.season));
      const vids = comp.videosOf(p.id);
      const last = vids[0];
      const facts = [comp.category(p), p.classement ? "Classement " + p.classement : null, p.main].filter(Boolean).join(" · ");
      return h("article", { class: "card player-card" },
        h("a", { class: "player-card__head", href: "joueur.html?id=" + p.id, "aria-label": "Ouvrir le dossier de " + comp.fullName(p) },
          CC.ui.avatar(p, 56),
          h("div", {}, h("h3", {}, comp.fullName(p)), h("p", { class: "hint" }, facts || "Fiche à compléter"))),
        h("div", { class: "player-card__stats" },
          h("div", { class: "player-card__chart" }, CC.ui.miniBars(values), h("small", {}, ref ? "Évaluation " + comp.periodLabel(ref.season, ref.t).replace("Trimestre ", "T").replace(" · ", " ") : "Pas encore évalué")),
          h("div", { class: "player-card__ring" }, CC.ui.ring(gp, "Objectifs de l'année"), h("small", {}, "Objectifs"))),
        h("p", { class: "hint player-card__meta" }, vids.length + " vidéo" + (vids.length > 1 ? "s" : "") + (last ? " · dernière le " + CC.fmtDate(last.date) : "")),
        h("div", { class: "btn-row" },
          h("a", { class: "btn btn--clay btn--small", href: "joueur.html?id=" + p.id }, "Ouvrir le dossier"),
          h("a", { class: "btn btn--outline btn--small", href: "bulletin.html?player=" + p.id + "&season=" + (ref || cur).season + "&t=" + (ref || cur).t }, "Bulletin")));
    }));
    if (!players.length) {
      grid.append(h("div", { class: "empty", style: "grid-column: 1 / -1" },
        "Aucun joueur pour l'instant. Ajoute ton premier joueur, ou charge les joueurs d'exemple pour découvrir l'espace."));
    }
    $("btn-exemples").hidden = players.some((p) => p.example);
  }

  // ----- Ajouter un joueur -----
  const form = $("form-ajout");
  $("btn-ajout").addEventListener("click", () => {
    const open = form.hidden;
    form.hidden = !open;
    $("btn-ajout").setAttribute("aria-expanded", String(open));
    if (open) $("a-prenom").focus();
  });
  $("annuler-ajout").addEventListener("click", () => { form.hidden = true; $("btn-ajout").setAttribute("aria-expanded", "false"); });
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const status = $("ajout-status");
    const data = Object.fromEntries(new FormData(form).entries());
    if (!String(data.prenom || "").trim()) {
      status.className = "status-line is-error";
      status.textContent = "Indique au moins le prénom du joueur.";
      $("a-prenom").focus();
      return;
    }
    const p = comp.addPlayer({ prenom: data.prenom.trim(), nom: String(data.nom || "").trim(), naissance: data.naissance || "", classement: data.classement || "" });
    location.href = "joueur.html?id=" + p.id + "#profil";
  });

  // ----- Libérer de la place (brouillons et images capturées pendant les tests) -----
  function freeSpace() {
    if (!confirm("Supprimer les brouillons d'analyse et les images capturées de test ?")) return;
    Object.keys(localStorage).filter((k) => k.indexOf("courtcoach.draft.") === 0 || k.indexOf("courtcoach.file.ls:") === 0).forEach((k) => localStorage.removeItem(k));
    $("btn-exemples").click();
  }

  // ----- Joueurs d'exemple -----
  $("btn-exemples").addEventListener("click", async () => {
    const button = $("btn-exemples");
    const status = $("exemples-status");
    button.disabled = true;
    status.className = "status-line";
    status.textContent = "Chargement des joueurs d'exemple… (quelques secondes)";
    try {
      const n = await comp.addExamples();
      status.className = "status-line is-ok";
      status.textContent = n + " joueur(s) fictif(s) ajouté(s) ✓";
      render();
      if (CC.comp.players().some((p) => p.example) && !CC.videos().some((v) => v.example === "joueur")) {
        status.textContent += " (les vidéos d'exemple n'ont pas pu être ajoutées sur cet appareil)";
      }
    } catch (e) {
      status.className = "status-line is-error";
      if (e && e.message === "MEMOIRE_PLEINE") {
        status.replaceChildren("Ton navigateur n'a plus de place pour enregistrer de nouvelles données. ",
          h("button", { type: "button", class: "btn btn--small btn--outline", onclick: freeSpace }, "Libérer de la place"),
          " (supprime seulement les brouillons d'analyse et les images capturées pendant les tests, pas les vidéos ni les joueurs).");
      } else {
        status.textContent = "Impossible de charger les joueurs d'exemple : " + CC.describeError(e);
      }
      render();
    }
    button.disabled = false;
  });

  render();
})();

// Dossier d'un joueur du Centre de compétition jeunes : profil, objectifs, évaluations, vidéos & analyses, bulletins.
(() => {
  const role = CC.role();
  if (!role) return;
  if (role !== "coach") { location.replace("espace.html"); return; }
  const { h } = CC;
  const comp = CC.comp;
  const ui = CC.ui;
  const $ = (id) => document.getElementById(id);

  const id = new URLSearchParams(location.search).get("id");
  let player = comp.player(id);
  if (!player) {
    CC.fill($("contenu"), h("div", { class: "wrap app-main" },
      h("p", { class: "empty" }, "Ce joueur est introuvable."),
      h("p", {}, h("a", { class: "btn btn--clay", href: "suivi.html" }, "Retour à mes joueurs"))));
    return;
  }

  const cur = comp.current();
  const RANKINGS = ["NC", "40", "30/5", "30/4", "30/3", "30/2", "30/1", "30", "15/5", "15/4", "15/3", "15/2", "15/1", "15", "5/6", "4/6", "3/6", "2/6", "1/6", "0", "-2/6", "-4/6"];
  const state = { goalSeason: cur.season, evalSeason: cur.season, evalT: cur.t };

  // Enregistrement automatique avec petit message « Enregistré ✓ »
  function autosaver(statusEl) {
    let timer = 0;
    return (action) => {
      action();
      clearTimeout(timer);
      statusEl.className = "status-line";
      statusEl.textContent = "Enregistrement…";
      timer = setTimeout(() => { statusEl.className = "status-line is-ok"; statusEl.textContent = "Enregistré ✓"; }, 350);
    };
  }

  // =====================================================
  // En-tête : nom, informations clés, chiffres
  // =====================================================
  function renderHeader() {
    player = comp.player(id);
    document.title = comp.fullName(player) + " – Centre de compétition jeunes – CourtCoach";
    CC.fill($("avatar"), ui.avatar(player, 72));
    $("nom").textContent = comp.fullName(player);
    const facts = [comp.category(player), player.classement ? "Classement " + player.classement : null,
      player.objectifClassement ? "Objectif : " + player.objectifClassement : null, player.main, player.revers].filter(Boolean);
    CC.fill($("infos"), 
      ...facts.map((t) => h("span", { class: "badge" }, t)),
      (player.sante || "").trim() && !/^rien/i.test(player.sante.trim()) ? h("span", { class: "badge badge--no" }, "⚠ " + player.sante.trim().slice(0, 60)) : null);
    $("btn-bulletin").href = "bulletin.html?player=" + id + "&season=" + cur.season + "&t=" + cur.t;

    const gp = comp.goalsProgress(comp.goals(id, cur.season));
    const periods = comp.evaluatedPeriods(id);
    const last = periods[0];
    const lastEv = last ? comp.getEval(id, last.season, last.t) : null;
    const prevP = last ? comp.previousPeriod(last.season, last.t) : null;
    const prevEv = prevP && comp.hasEval(id, prevP.season, prevP.t) ? comp.getEval(id, prevP.season, prevP.t) : null;
    const avg = lastEv ? comp.overallAverage(lastEv) : null;
    const avgPrev = prevEv ? comp.overallAverage(prevEv) : null;
    const vids = comp.videosOf(id);
    const matchesSeason = comp.matches(id).filter((m) => comp.seasonOf(m.date) === cur.season);
    const wins = matchesSeason.filter((m) => m.bilan === "Victoire").length;
    CC.fill($("kpis"), 
      h("div", { class: "kpi" }, ui.ring(gp, "Objectifs de l'année", 64), h("div", {}, h("b", {}, "Objectifs"), h("span", {}, gp === null ? "Aucun objectif fixé" : "atteints à " + gp + " %"))),
      h("div", { class: "kpi" }, h("span", { class: "kpi__big" }, ui.fmtAvg(avg)), h("div", {}, h("b", {}, "Niveau moyen"), h("span", {}, last ? "sur 5 · " + comp.periodLabel(last.season, last.t).replace("Trimestre ", "T").replace(" · ", " ") + (avgPrev ? " " + ui.trend(avg, avgPrev) : "") : "pas encore évalué"))),
      h("div", { class: "kpi" }, h("span", { class: "kpi__big" }, String(vids.length)), h("div", {}, h("b", {}, "Vidéos"), h("span", {}, comp.analyses(id).length + " analyse(s) enregistrée(s)"))),
      h("div", { class: "kpi" }, h("span", { class: "kpi__big" }, String(matchesSeason.length)), h("div", {}, h("b", {}, "Matchs cette saison"), h("span", {}, matchesSeason.length ? wins + " victoire(s)" : "aucun enregistré"))));
  }

  // =====================================================
  // Onglet 1 : Profil
  // =====================================================
  const PROFILE = [
    ["Identité", [
      ["prenom", "Prénom", "text"], ["nom", "Nom", "text"], ["naissance", "Date de naissance", "date"],
      ["sexe", "Sexe", "radio", [["F", "Fille"], ["H", "Garçon"], ["", "Non précisé"]]],
      ["club", "Club", "text"], ["licence", "N° de licence FFT", "text"], ["taille", "Taille (cm)", "number"]]],
    ["Tennis et compétition", [
      ["classement", "Classement actuel", "select", RANKINGS], ["objectifClassement", "Objectif de classement", "select", RANKINGS],
      ["main", "Main", "radio", [["Droitier", "Droitier"], ["Gauchère", "Gaucher / gauchère"]]],
      ["revers", "Revers", "radio", [["À une main", "Une main"], ["À deux mains", "Deux mains"]]],
      ["style", "Style de jeu", "text", null, "Ex. : agressif, régulier, contre-attaquant…"],
      ["seances", "Entraînement et compétitions", "text", null, "Ex. : 3 entraînements + 1 match par semaine"],
      ["dispos", "Disponibilités", "text"]]],
    ["Santé", [["sante", "Blessures et points d'attention", "textarea", null, "Facultatif. Seulement ce qui aide à adapter les exercices (pas de diagnostic médical)."]]],
    ["Famille (facultatif : ne garde que le nécessaire)", [["parent_nom", "Responsable légal", "text"], ["parent_tel", "Téléphone", "tel"], ["parent_email", "E-mail", "email"]]],
    ["Mes notes", [["notes", "Notes privées du coach", "textarea", null, "Seul toi peux les lire."]]],
  ];

  function renderProfile() {
    const panel = $("p-profil");
    const status = h("p", { class: "status-line", role: "status" });
    const save = autosaver(status);
    const sections = PROFILE.map(([title, fields]) => h("fieldset", { class: "form-section" },
      h("legend", {}, title),
      h("div", { class: "fields-2" }, fields.map(([key, label, type, options, hint]) => {
        const value = player[key] || "";
        const fid = "f-" + key;
        const onChange = (v) => save(() => { comp.updatePlayer(id, { [key]: v }); player = comp.player(id); renderHeader(); });
        if (type === "radio") {
          return h("fieldset", { class: "field" }, h("legend", {}, label),
            h("div", { class: "chips" }, options.map(([val, text]) => h("label", {},
              h("input", { type: "radio", name: key, value: val, checked: value === val ? true : null, onchange: () => onChange(val) }), " " + text))));
        }
        if (type === "select") {
          const sel = h("select", { id: fid, onchange: (e) => onChange(e.target.value) }, h("option", { value: "" }, "Choisir…"), options.map((o) => h("option", { value: o, selected: o === value ? true : null }, o)));
          return h("div", { class: "field" }, h("label", { for: fid }, label), sel);
        }
        const control = type === "textarea"
          ? h("textarea", { id: fid, oninput: (e) => onChange(e.target.value) }, value)
          : h("input", { id: fid, type, value, oninput: (e) => onChange(e.target.value), autocomplete: "off" });
        return h("div", { class: "field" + (type === "textarea" ? " field--wide" : "") }, h("label", { for: fid }, label), control, hint ? h("small", {}, hint) : null);
      }))));
    const accountSelect = h("select", { id: "f-accountId", onchange: (e) => save(() => { comp.updatePlayer(id, { accountId: e.target.value || null }); player = comp.player(id); }) },
      h("option", { value: "" }, "Aucun accès pour l'élève"),
      CC.students().map((a) => h("option", { value: a.id, selected: a.id === player.accountId ? true : null }, CC.studentName(a.id) + (a.example ? " (fictif)" : ""))));
    const access = h("fieldset", { class: "form-section" }, h("legend", {}, "Accès de l'élève"),
      h("p", { class: "hint" }, "Relie ce joueur à un compte élève : il verra alors, en lecture seule, ses objectifs, ses évaluations, ses bulletins et tes analyses (rubrique « Mon suivi »). Il ne voit jamais tes notes privées, ses informations de santé ni les fiches des autres joueurs."),
      h("div", { class: "field" }, h("label", { for: "f-accountId" }, "Compte élève relié"), accountSelect));
    const consent = h("fieldset", { class: "form-section" }, h("legend", {}, "Autorisation des parents"),
      h("p", { class: "hint" }, "Ce joueur est mineur : l'accord écrit de son responsable légal est nécessaire pour le filmer, analyser ses vidéos et suivre ses résultats (droit à l'image et protection des données). Les vidéos ne sont jamais publiées."),
      h("label", { class: "check" }, h("input", { type: "checkbox", checked: player.autorisation ? true : null, onchange: (e) => save(() => {
        comp.updatePlayer(id, { autorisation: e.target.checked ? new Date().toISOString() : null }); player = comp.player(id); rendered.videos = false;
        stamp.textContent = player.autorisation ? "Accord enregistré le " + CC.fmtDate(player.autorisation) + "." : "";
      }) }), h("span", {}, "J'ai reçu l'autorisation écrite du responsable légal (filmer, analyser, suivre).")));
    const stamp = h("p", { class: "hint" }, player.autorisation ? "Accord enregistré le " + CC.fmtDate(player.autorisation) + "." : "");
    consent.append(stamp);
    const exportBtn = h("button", { type: "button", class: "btn btn--outline btn--small", onclick: () => {
      const { notes, ...visible } = player;
      const data = { exporte_le: new Date().toISOString(), fiche: player, objectifs: Object.keys(localStorage).filter((k) => k.indexOf("courtcoach.comp.goals." + id + ".") === 0).map((k) => ({ saison: k.split(".").pop(), objectifs: JSON.parse(localStorage.getItem(k) || "[]") })),
        evaluations: CC.read("comp.evals." + id, {}), matchs: comp.matches(id), analyses: comp.analyses(id), videos: comp.videosOf(id).map((v) => ({ titre: v.title, coup: v.shot, date: v.date })) };
      const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
      const a = h("a", { href: url, download: "dossier-" + (player.prenom || "joueur") + ".json" }); document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 2000);
    } }, "Télécharger le dossier (copie des données)");
    const del = h("button", { type: "button", class: "btn btn--danger btn--small", onclick: async () => {
      if (!confirm("Supprimer définitivement le dossier de " + comp.fullName(player) + " (profil, objectifs, évaluations, vidéos, analyses) ?")) return;
      await comp.deletePlayer(id);
      location.href = "suivi.html";
    } }, "Supprimer ce joueur");
    CC.fill(panel, 
      h("p", { class: "hint" }, "Tout s'enregistre automatiquement. Seul toi vois ce dossier."),
      consent, access, ...sections, status,
      h("div", { class: "danger-zone" }, h("p", { class: "hint" }, "Données : le responsable légal peut demander une copie ou la suppression du dossier à tout moment."), h("div", { class: "btn-row" }, exportBtn, del)));
  }

  // =====================================================
  // Onglet 2 : Objectifs de l'année
  // =====================================================
  function renderGoals() {
    const panel = $("p-objectifs");
    const seasons = [comp.previousPeriod(cur.season, 1).season, cur.season, comp.nextPeriod(cur.season, 3).season];
    const seasonSelect = h("select", { id: "saison-obj", "aria-label": "Saison", onchange: (e) => { state.goalSeason = e.target.value; renderGoals(); } },
      seasons.map((s) => h("option", { value: s, selected: s === state.goalSeason ? true : null }, "Saison " + s.replace("-", "/") + (s === cur.season ? " (en cours)" : ""))));
    const list = comp.goals(id, state.goalSeason);
    const save = () => comp.saveGoals(id, state.goalSeason, list);

    const summary = h("div", { class: "goal-summary" });
    function refreshSummary() {
      const gp = comp.goalsProgress(list);
      const done = list.filter((g) => (g.progress || 0) >= 100).length;
      CC.fill(summary, ui.ring(gp, "Objectifs de la saison", 84),
        h("div", {}, h("strong", {}, gp === null ? "Aucun objectif fixé" : "Objectifs atteints à " + gp + " %"),
          h("p", { class: "hint" }, list.length + " objectif" + (list.length > 1 ? "s" : "") + " · " + done + " atteint" + (done > 1 ? "s" : "") +
            " — fixe 2 ou 3 objectifs par axe, mesurables et datés.")));
      renderHeader();
    }

    const axisCards = comp.GOAL_AXES.map((axis) => {
      const body = h("div", { class: "goal-list" });
      const avgBar = h("span", { class: "axis-card__avg" });
      function refreshAxis() {
        const mine = list.filter((g) => g.axis === axis.key);
        const gp = comp.goalsProgress(mine);
        avgBar.textContent = mine.length ? mine.length + " objectif" + (mine.length > 1 ? "s" : "") + " · " + gp + " %" : "aucun objectif";
      }
      function addGoal(title, indicator) {
        const g = { id: CC.uid(), axis: axis.key, title: title || "", indicator: indicator || "", deadline: "", progress: 0 };
        list.push(g); save(); body.append(goalCard(g)); refreshAxis(); refreshSummary();
        return g;
      }
      function goalCard(g) {
        const pct = h("output", { class: "goal__pct" }, (g.progress || 0) + " %");
        const bar = h("span", { class: "goal__bar" }, h("span", {}));
        const paint = () => { bar.firstChild.style.width = (g.progress || 0) + "%"; bar.firstChild.style.background = axis.color; pct.textContent = (g.progress || 0) + " %"; };
        const card = h("article", { class: "goal" + ((g.progress || 0) >= 100 ? " goal--done" : "") },
          h("div", { class: "field" }, h("label", {}, "Objectif", h("input", { type: "text", value: g.title, placeholder: "Ex. : fiabiliser la première balle de service",
            oninput: (e) => { g.title = e.target.value; save(); } }))),
          h("div", { class: "field" }, h("label", {}, "Comment le mesure-t-on ?", h("input", { type: "text", value: g.indicator || "", placeholder: "Ex. : 60 % de premières balles en match",
            oninput: (e) => { g.indicator = e.target.value; save(); } }))),
          h("div", { class: "goal__row" },
            h("div", { class: "field" }, h("label", {}, "Échéance", h("input", { type: "date", value: g.deadline || "", onchange: (e) => { g.deadline = e.target.value; save(); } }))),
            h("div", { class: "field goal__progress" }, h("label", {}, "Progression ", pct,
              h("input", { type: "range", min: "0", max: "100", step: "5", value: String(g.progress || 0), "aria-label": "Progression de l'objectif",
                oninput: (e) => { g.progress = Number(e.target.value); paint(); card.classList.toggle("goal--done", g.progress >= 100); save(); refreshAxis(); refreshSummary(); } })), bar)),
          (() => {
            const linked = comp.analysesOfGoal(id, g);
            return linked.length ? h("details", { class: "goal__links" }, h("summary", {}, "🎥 " + linked.length + " analyse" + (linked.length > 1 ? "s" : "") + " vidéo liée" + (linked.length > 1 ? "s" : "")),
              h("ul", {}, linked.map((a) => h("li", {}, h("a", { href: "joueur.html?id=" + id + "#videos" }, (a.videoTitle || "Analyse") + " · " + CC.fmtDate(a.date))))))
              : h("p", { class: "hint" }, "Aucune analyse vidéo liée pour l'instant.");
          })(),
          h("button", { type: "button", class: "btn btn--small btn--danger", onclick: () => {
            list.splice(list.indexOf(g), 1); save(); card.remove(); refreshAxis(); refreshSummary();
          } }, "Supprimer"));
        paint();
        return card;
      }
      list.filter((g) => g.axis === axis.key).forEach((g) => body.append(goalCard(g)));
      refreshAxis();
      const ideas = h("details", { class: "ideas" }, h("summary", {}, "Idées d'objectifs"),
        h("div", { class: "exo-lib" }, comp.GOAL_IDEAS[axis.key].map(([t, i]) => h("button", { type: "button", onclick: () => addGoal(t, i) }, "+ " + t))));
      return h("section", { class: "axis-card", style: "--axis:" + axis.color, "aria-label": axis.label },
        h("header", { class: "axis-card__head" }, h("h3", {}, axis.label), avgBar),
        body,
        h("div", { class: "btn-row" }, h("button", { type: "button", class: "btn btn--small btn--outline", onclick: () => { const g = addGoal(); const inputs = body.querySelectorAll(".goal input[type=text]"); inputs[inputs.length - 2].focus(); } }, "+ Ajouter un objectif")),
        ideas);
    });

    refreshSummary();
    CC.fill(panel, 
      h("div", { class: "toolbar-row" }, h("label", { for: "saison-obj", class: "sr-only" }, "Saison"), seasonSelect),
      summary,
      h("div", { class: "axis-grid" }, axisCards));
  }

  // =====================================================
  // Onglet 3 : Évaluations trimestrielles
  // =====================================================
  function renderEvaluations() {
    const panel = $("p-evaluations");
    const { evalSeason: season, evalT: t } = state;
    const ev = comp.getEval(id, season, t);
    const prevP = comp.previousPeriod(season, t);
    const prev = comp.hasEval(id, prevP.season, prevP.t) ? comp.getEval(id, prevP.season, prevP.t) : null;
    const saveStatus = h("p", { class: "status-line", role: "status" });
    const save = autosaver(saveStatus);
    const persist = () => comp.saveEval(id, season, t, ev);

    // --- choix de la période ---
    const seasons = [comp.previousPeriod(comp.previousPeriod(cur.season, 1).season, 1).season, comp.previousPeriod(cur.season, 1).season, cur.season];
    const seasonSelect = h("select", { "aria-label": "Saison", onchange: (e) => { state.evalSeason = e.target.value; renderEvaluations(); } },
      seasons.map((s) => h("option", { value: s, selected: s === season ? true : null }, "Saison " + s.replace("-", "/"))));
    const tButtons = [1, 2, 3].map((n) => {
      const pct = comp.completion(comp.getEval(id, season, n));
      return h("button", { type: "button", class: "period-btn", "aria-pressed": String(n === t), onclick: () => { state.evalT = n; renderEvaluations(); } },
        h("strong", {}, "T" + n), h("small", {}, comp.TRIMESTER_MONTHS[n]), h("span", { class: "period-btn__pct" }, pct + " %"));
    });

    // --- synthèse : toile d'araignée + moyennes ---
    const summary = h("div", { class: "eval-summary" });
    const completionBar = h("div", { class: "completion" });
    function refreshSummary() {
      const values = {}, prevValues = {};
      comp.AXES.forEach((a) => { values[a.key] = comp.axisAverage(ev, a.key) || 0; prevValues[a.key] = prev ? comp.axisAverage(prev, a.key) || 0 : 0; });
      const series = [{ values, color: "#b8471f", label: comp.periodLabel(season, t).replace("Trimestre ", "T").replace(" · ", " ") }];
      if (prev) series.push({ values: prevValues, color: "#10203a", label: comp.periodLabel(prevP.season, prevP.t).replace("Trimestre ", "T").replace(" · ", " "), dashed: true });
      const averages = h("table", { class: "avg-table" }, h("caption", { class: "sr-only" }, "Moyennes par axe"),
        h("tbody", {}, comp.AXES.map((a) => {
          const v = comp.axisAverage(ev, a.key), pv = prev ? comp.axisAverage(prev, a.key) : null;
          return h("tr", {}, h("th", { scope: "row" }, h("span", { class: "dot", style: "background:" + a.color }), a.label),
            h("td", {}, ui.fmtAvg(v) + " / 5"), h("td", { class: "trend" }, ui.trend(v, pv)));
        }),
        h("tr", { class: "avg-table__total" }, h("th", { scope: "row" }, "Moyenne générale"), h("td", {}, ui.fmtAvg(comp.overallAverage(ev)) + " / 5"),
          h("td", { class: "trend" }, ui.trend(comp.overallAverage(ev), prev ? comp.overallAverage(prev) : null)))));
      CC.fill(summary, ui.radar(series), averages);
      const pct = comp.completion(ev);
      CC.fill(completionBar, h("div", { class: "progress", "aria-hidden": "true" }, (() => { const s = h("span", {}); s.style.width = pct + "%"; return s; })()),
        h("small", {}, "Évaluation remplie à " + pct + " %" + (pct === 100 ? " ✓" : " — note les compétences pour compléter le bulletin")));
      tButtons[t - 1].querySelector(".period-btn__pct").textContent = pct + " %";
      renderHeader();
    }

    // --- grille de compétences ---
    const axisCards = comp.AXES.map((axis) => {
      const rows = axis.skills.map(([key, label]) => {
        const group = h("div", { class: "rating", role: "radiogroup", "aria-label": label });
        const trendEl = h("span", { class: "rating__trend" });
        const buttons = [1, 2, 3, 4, 5].map((n) => h("button", { type: "button", role: "radio", class: "rating__btn", "aria-checked": "false",
          "aria-label": label + " : " + n + " sur 5, " + comp.RATING_LABELS[n], title: n + " — " + comp.RATING_LABELS[n],
          onclick: () => {
            ev.ratings[key] = ev.ratings[key] === n ? 0 : n;
            if (!ev.ratings[key]) delete ev.ratings[key];
            save(persist); paint(); refreshSummary();
          } }, String(n)));
        group.append(...buttons);
        function paint() {
          const v = ev.ratings[key] || 0;
          buttons.forEach((b, i) => { b.setAttribute("aria-checked", String(v === i + 1)); b.classList.toggle("is-on", v >= i + 1); });
          const pv = prev ? prev.ratings[key] : 0;
          trendEl.textContent = (pv ? "avant : " + pv : "") + (v && pv ? " " + ui.trend(v, pv) : "");
          trendEl.className = "rating__trend" + (v && pv && v > pv ? " is-up" : v && pv && v < pv ? " is-down" : "");
          group.dataset.label = v ? comp.RATING_LABELS[v] : "Pas encore noté";
        }
        paint();
        return h("div", { class: "skill-row" }, h("span", { class: "skill-row__label" }, label), group, h("span", { class: "rating__word" }), trendEl);
      });
      // Mot de la note (« Solide »…) mis à jour avec la note
      rows.forEach((row) => {
        const group = row.querySelector(".rating");
        const word = row.querySelector(".rating__word");
        const upd = () => { word.textContent = group.dataset.label; };
        upd();
        group.addEventListener("click", () => setTimeout(upd, 0));
      });
      const comment = h("textarea", { rows: "2", "aria-label": "Commentaire " + axis.label, placeholder: "Commentaire sur l'axe « " + axis.label + " »…", oninput: (e) => { ev.comments[axis.key] = e.target.value; save(persist); } }, ev.comments[axis.key] || "");
      return h("section", { class: "axis-card", style: "--axis:" + axis.color }, h("header", { class: "axis-card__head" }, h("h3", {}, axis.label)), ...rows, comment);
    });

    // --- matchs du trimestre ---
    const matchBox = h("div", { class: "matches" });
    function renderMatches() {
      const list = comp.matchesIn(id, season, t);
      CC.fill(matchBox, 
        list.length ? h("ul", { class: "list" }, list.map((m) => h("li", { class: "list__item" },
          h("div", { class: "list__main" }, h("strong", {}, m.tournoi + (m.tour ? " · " + m.tour : "")), h("small", {}, CC.fmtDate(m.date) + " · " + m.bilan + (m.score ? " · " + m.score : "") + (m.remarque ? " — " + m.remarque : ""))),
          h("button", { type: "button", class: "btn btn--small btn--danger", "aria-label": "Supprimer ce match", onclick: () => { comp.saveMatches(id, comp.matches(id).filter((x) => x.id !== m.id)); renderMatches(); renderHeader(); } }, "Supprimer"))))
          : h("p", { class: "hint" }, "Aucun match enregistré sur ce trimestre."));
    }
    const mForm = h("form", { class: "match-form", novalidate: true, onsubmit: (e) => {
      e.preventDefault();
      const f = new FormData(e.target);
      if (!String(f.get("tournoi")).trim()) { e.target.elements.tournoi.focus(); return; }
      const date = f.get("date") || new Date().toISOString().slice(0, 10);
      comp.saveMatches(id, [...comp.matches(id), { id: CC.uid(), date, tournoi: String(f.get("tournoi")).trim(), tour: String(f.get("tour") || "").trim(), bilan: f.get("bilan"), score: String(f.get("score") || "").trim(), remarque: String(f.get("remarque") || "").trim() }]);
      e.target.reset(); e.target.elements.date.value = defaultMatchDate(); renderMatches(); renderHeader();
    } },
      h("div", { class: "fields-2" },
        h("div", { class: "field" }, h("label", {}, "Date", h("input", { type: "date", name: "date", value: "" }))),
        h("div", { class: "field" }, h("label", {}, "Tournoi ou rencontre", h("input", { type: "text", name: "tournoi", placeholder: "Ex. : Tournoi départemental" }))),
        h("div", { class: "field" }, h("label", {}, "Tour atteint", h("input", { type: "text", name: "tour", placeholder: "Ex. : Demi-finale" }))),
        h("div", { class: "field" }, h("label", {}, "Bilan", h("select", { name: "bilan" }, h("option", {}, "Victoire"), h("option", {}, "Défaite")))),
        h("div", { class: "field" }, h("label", {}, "Score", h("input", { type: "text", name: "score", placeholder: "6/3 6/4" }))),
        h("div", { class: "field" }, h("label", {}, "Remarque", h("input", { type: "text", name: "remarque", placeholder: "Ce qui a bien ou mal marché" })))),
      h("button", { class: "btn btn--small btn--clay", type: "submit" }, "+ Ajouter le match"));
    function defaultMatchDate() {
      const [a, b] = comp.trimesterRange(season, t);
      const today = new Date();
      const d = today >= a && today <= b ? today : a;
      return d.toISOString().slice(0, 10);
    }
    mForm.elements.date.value = defaultMatchDate();

    // --- textes + appréciation automatique ---
    const textField = (key, label, placeholder, rows) => h("div", { class: "field" }, h("label", { for: "ev-" + key }, label),
      h("textarea", { id: "ev-" + key, rows: String(rows || 3), placeholder, oninput: (e) => { ev[key] = e.target.value; save(persist); } }, ev[key] || ""));
    const apprText = textField("appreciation", "Appréciation générale du coach", "Quelques lignes pour la famille…", 4);
    const suggestBtn = h("button", { type: "button", class: "btn btn--small btn--outline", onclick: () => {
      const proposal = comp.suggestAppreciation(player, season, t);
      const area = apprText.querySelector("textarea");
      if (area.value.trim() && !confirm("Remplacer l'appréciation actuelle par la proposition ?")) return;
      area.value = proposal; ev.appreciation = proposal; save(persist); area.focus();
    } }, "✨ Proposer une appréciation");

    CC.fill(panel, 
      h("div", { class: "toolbar-row" }, seasonSelect, h("div", { class: "period-bar", role: "group", "aria-label": "Trimestre" }, tButtons)),
      h("p", { class: "hint" }, comp.periodLabel(season, t) + " — note chaque compétence de 1 à 5 (clique une 2ᵉ fois pour retirer la note). Tout s'enregistre automatiquement."),
      completionBar, saveStatus,
      summary,
      h("div", { class: "axis-grid axis-grid--eval" }, axisCards),
      h("section", { class: "form-section" }, h("h3", {}, "Matchs et tournois du trimestre"), matchBox, mForm),
      h("section", { class: "form-section" }, h("h3", {}, "Bilan écrit"),
        textField("strengths", "Points forts", "Ce qui va très bien…", 3),
        textField("improve", "À travailler", "Ce qui doit progresser…", 3),
        textField("next", "Objectifs du trimestre suivant", "Les priorités pour la suite…", 3),
        apprText, h("div", { class: "btn-row" }, suggestBtn)),
      h("div", { class: "btn-row" },
        h("a", { class: "btn btn--clay", href: "bulletin.html?player=" + id + "&season=" + season + "&t=" + t }, "Voir et imprimer le bulletin"),
        h("button", { type: "button", class: "btn btn--outline", onclick: async (e) => {
          const btn = e.target;
          try { await navigator.clipboard.writeText(comp.bulletinText(player, season, t)); btn.textContent = "Copié ✓"; } catch (err) { btn.textContent = "Copie impossible : ouvre le bulletin"; }
          setTimeout(() => { btn.textContent = "Copier le bulletin en texte"; }, 2500);
        } }, "Copier le bulletin en texte")));
    refreshMatchesAndSummary();
    function refreshMatchesAndSummary() { renderMatches(); refreshSummary(); }
  }

  // =====================================================
  // Onglet 4 : Vidéos et analyses
  // =====================================================
  const MAX_VIDEO = 400 * 1024 * 1024;
  function renderVideos() {
    const panel = $("p-videos");
    const vids = comp.videosOf(id);
    const analyses = comp.analyses(id);

    // --- ajouter une vidéo ---
    const status = h("p", { class: "status-line", role: "status" });
    const fileInput = h("input", { id: "pv-fichier", type: "file", accept: "video/*" });
    const shotSelect = h("select", { id: "pv-coup" }, Object.entries(CC.SHOTS).map(([v, l]) => h("option", { value: v }, l)));
    const titleInput = h("input", { id: "pv-titre", type: "text", maxlength: "80", placeholder: "Ex. : Service — séance du mardi" });
    const dateInput = h("input", { id: "pv-date", type: "date", value: new Date().toISOString().slice(0, 10) });
    const submit = h("button", { class: "btn btn--clay", type: "submit" }, "Ajouter la vidéo");
    const upload = h("form", { class: "form-section", novalidate: true, onsubmit: async (e) => {
      e.preventDefault();
      const file = fileInput.files[0];
      const fail = (m) => { status.className = "status-line is-error"; status.textContent = m; };
      if (!file) return fail("Choisis d'abord une vidéo.");
      if (!file.type.startsWith("video/")) return fail("Ce fichier n'est pas une vidéo.");
      if (file.size > MAX_VIDEO) return fail("La vidéo est trop lourde (400 Mo maximum).");
      submit.disabled = true; status.className = "status-line"; status.textContent = "Enregistrement en cours…";
      try {
        const fileId = await CC.putFile(file);
        const when = dateInput.value ? new Date(dateInput.value + "T12:00:00").toISOString() : new Date().toISOString();
        CC.saveVideos([...CC.videos(), { id: CC.uid(), fileId, owner: "coach", playerId: id, studentId: null, title: titleInput.value.trim() || file.name.replace(/\.[^.]+$/, ""),
          shot: shotSelect.value, question: "", date: when, size: file.size, status: "suivi", seen: true }]);
        renderVideos(); renderHeader();
      } catch (err) {
        fail("Impossible d'enregistrer la vidéo (" + CC.describeError(err) + "). Essaie une vidéo plus courte ou libère de l'espace (page « Vidéos »).");
      } finally { submit.disabled = false; }
    } },
      h("h3", {}, "Ajouter une vidéo de " + (player.prenom || "ce joueur")),
      h("div", { class: "field" }, h("label", { for: "pv-fichier" }, "Vidéo"), fileInput),
      h("div", { class: "fields-2" },
        h("div", { class: "field" }, h("label", { for: "pv-titre" }, "Titre (facultatif)"), titleInput),
        h("div", { class: "field" }, h("label", { for: "pv-coup" }, "Quel coup ?"), shotSelect),
        h("div", { class: "field" }, h("label", { for: "pv-date" }, "Date de la vidéo"), dateInput)),
      submit, status);

    // --- comparer deux vidéos ---
    const optionLabel = (v) => v.title + " · " + (CC.SHOTS[v.shot] || "coup") + " · " + CC.fmtDate(v.date);
    let compareBox = null;
    if (vids.length >= 2) {
      const a = h("select", { id: "cmp-a", "aria-label": "Vidéo récente" }, vids.map((v) => h("option", { value: v.id }, optionLabel(v))));
      const b = h("select", { id: "cmp-b", "aria-label": "Vidéo de comparaison" }, vids.map((v, i) => h("option", { value: v.id, selected: i === 1 ? true : null }, optionLabel(v))));
      const go = (mode) => () => { if (a.value === b.value) { status.className = "status-line is-error"; status.textContent = "Choisis deux vidéos différentes."; return; } location.href = "analyse.html?id=" + a.value + "&b=" + b.value + "&mode=" + mode; };
      compareBox = h("section", { class: "form-section" }, h("h3", {}, "Comparer deux vidéos (évolution)"),
        h("div", { class: "fields-2" }, h("div", { class: "field" }, h("label", { for: "cmp-a" }, "Vidéo A"), a), h("div", { class: "field" }, h("label", { for: "cmp-b" }, "Vidéo B"), b)),
        h("div", { class: "btn-row" }, h("button", { type: "button", class: "btn btn--small btn--clay", onclick: go("side") }, "Côte à côte"), h("button", { type: "button", class: "btn btn--small btn--outline", onclick: go("overlay") }, "Superposées")));
    }

    // --- liste des vidéos ---
    const cards = vids.map((v) => {
      const thumb = h("video", { muted: true, playsinline: true, preload: "metadata", "aria-hidden": "true", tabindex: "-1" });
      CC.fileURL(v.fileId).then((url) => { if (url) thumb.src = url + "#t=0.3"; });
      const previous = vids.find((o) => o.shot === v.shot && o.date < v.date);
      const mine = analyses.filter((a) => a.videoId === v.id);
      const per = comp.trimesterOf(v.date), seas = comp.seasonOf(v.date);
      return h("article", { class: "video-card" },
        h("div", { class: "video-card__thumb" }, thumb),
        h("div", { class: "video-card__body" },
          h("h3", {}, v.title),
          h("div", { class: "video-card__meta" }, mine.length ? h("span", { class: "badge badge--ok" }, "Analysée ×" + mine.length) : h("span", { class: "badge badge--wait" }, "À analyser"),
            h("span", {}, CC.SHOTS[v.shot] || "Coup"), h("span", {}, "· " + CC.fmtDate(v.date) + " · T" + per + " " + seas.replace("-", "/"))),
          h("div", { class: "btn-row" },
            h("a", { class: "btn btn--small btn--clay", href: "analyse.html?id=" + v.id }, mine.length ? "Réanalyser" : "Analyser"),
            previous ? h("a", { class: "btn btn--small btn--outline", href: "analyse.html?id=" + v.id + "&b=" + previous.id + "&mode=side" }, "Comparer avec la précédente") : null,
            h("button", { type: "button", class: "btn btn--small btn--danger", "aria-label": "Supprimer la vidéo " + v.title, onclick: async () => {
              if (!confirm("Supprimer cette vidéo ?")) return; await CC.removeVideo(v.id); renderVideos(); renderHeader();
            } }, "Supprimer"))));
    });

    // --- analyses enregistrées ---
    const analysisItems = analyses.slice().sort((x, y) => y.date.localeCompare(x.date)).map((a) => {
      const caps = (a.captures || []).map((cid, i) => {
        const b = h("button", { type: "button", class: "capture__open strip__thumb", "aria-label": "Voir l'image " + (i + 1) + " en grand" });
        CC.fileURL(cid).then((url) => { if (!url) return; b.append(h("img", { src: url, alt: "Image annotée " + (i + 1) })); b.addEventListener("click", () => CC.lightbox(url, "Image annotée " + (i + 1))); });
        return h("figure", { class: "analysis__fig" }, b, (a.captureNotes || {})[cid] ? h("figcaption", {}, a.captureNotes[cid]) : null);
      });
      return h("details", { class: "analysis-item" },
        h("summary", {}, h("strong", {}, a.videoTitle || "Analyse"), " · " + CC.fmtDate(a.date) + " · " + (CC.SHOTS[a.shot] || "")),
        h("div", { class: "analysis" },
          comp.goalsOfAnalysis(id, a).length ? h("div", { class: "chips-info" }, comp.goalsOfAnalysis(id, a).map((g) => h("span", { class: "badge badge--ok" }, "🎯 " + (g.title || "Objectif")))) : null,
          a.observation ? h("div", {}, h("h4", {}, "Observation"), h("p", {}, a.observation)) : null,
          a.strengths ? h("div", {}, h("h4", {}, "Points forts"), h("p", {}, a.strengths)) : null,
          a.improve ? h("div", {}, h("h4", {}, "À améliorer"), h("p", {}, a.improve)) : null,
          caps.length ? h("div", {}, h("h4", {}, "Images annotées"), h("div", { class: "analysis__caps" }, caps)) : null,
          h("button", { type: "button", class: "btn btn--small btn--danger", onclick: () => { if (!confirm("Supprimer cette analyse du dossier ?")) return; comp.saveAnalyses(id, comp.analyses(id).filter((x) => x.id !== a.id)); renderVideos(); renderHeader(); } }, "Supprimer cette analyse")));
    });

    const gate = h("div", { class: "form-section" }, h("h3", {}, "Autorisation des parents requise"),
      h("p", {}, "Avant d'ajouter une vidéo de " + (player.prenom || "ce joueur") + ", enregistre l'accord écrit de son responsable légal (droit à l'image)."),
      h("button", { type: "button", class: "btn btn--clay btn--small", onclick: () => showTab("profil", true) }, "Enregistrer l'autorisation"));
    CC.fill(panel, player.autorisation ? upload : gate, compareBox,
      h("h2", {}, "Vidéos de " + (player.prenom || "ce joueur")),
      vids.length ? h("div", { class: "video-grid" }, cards) : h("p", { class: "empty" }, "Aucune vidéo pour l'instant. Ajoute la première avec le formulaire ci-dessus."),
      h("h2", { style: "margin-top: var(--s4)" }, "Analyses enregistrées"),
      analysisItems.length ? h("div", {}, analysisItems) : h("p", { class: "empty" }, "Les analyses que tu enregistres depuis le studio apparaîtront ici (et dans les bulletins)."));
  }

  // =====================================================
  // Onglet 5 : Bulletins
  // =====================================================
  function renderBulletins() {
    const panel = $("p-bulletins");
    const periods = [];
    const add = (season, t) => { if (!periods.some((p) => p.season === season && p.t === t)) periods.push({ season, t }); };
    add(cur.season, cur.t);
    comp.evaluatedPeriods(id).forEach((p) => add(p.season, p.t));
    periods.sort((a, b) => (b.season + b.t).localeCompare(a.season + a.t));
    const rows = periods.map(({ season, t }) => {
      const ev = comp.getEval(id, season, t);
      const pct = comp.completion(ev);
      const nM = comp.matchesIn(id, season, t).length, nA = comp.analysesIn(id, season, t).length;
      const isNow = season === cur.season && t === cur.t;
      return h("li", { class: "list__item bulletin-row" },
        h("div", { class: "list__main" },
          h("strong", {}, comp.periodLabel(season, t), isNow ? h("span", { class: "badge badge--new", style: "margin-left:8px" }, "En cours") : null),
          h("small", {}, "Évaluation remplie à " + pct + " % · " + nM + " match(s) · " + nA + " analyse(s) vidéo"),
          h("div", { class: "progress", "aria-hidden": "true", style: "max-width: 260px" }, (() => { const s = h("span", {}); s.style.width = pct + "%"; return s; })())),
        h("div", { class: "btn-row" },
          h("a", { class: "btn btn--small btn--clay", href: "bulletin.html?player=" + id + "&season=" + season + "&t=" + t }, "Ouvrir le bulletin"),
          h("a", { class: "btn btn--small btn--outline", href: "joueur.html?id=" + id + "#evaluations", onclick: () => { state.evalSeason = season; state.evalT = t; rendered.evaluations = false; } }, "Modifier l'évaluation")));
    });
    CC.fill(panel, 
      h("p", { class: "hint" }, "Un bulletin se construit tout seul à partir de l'évaluation, des objectifs, des matchs et des analyses vidéo du trimestre. Ouvre-le pour l'imprimer ou l'enregistrer en PDF."),
      h("ul", { class: "list" }, rows));
  }

  // =====================================================
  // Onglets
  // =====================================================
  const TABS = [["profil", "Profil", renderProfile], ["objectifs", "Objectifs", renderGoals], ["evaluations", "Évaluations", renderEvaluations],
    ["videos", "Vidéos et analyses", renderVideos], ["bulletins", "Bulletins", renderBulletins]];
  const rendered = {};
  function showTab(key, push) {
    const tab = TABS.find(([k]) => k === key) || TABS[0];
    TABS.forEach(([k]) => {
      $("t-" + k).setAttribute("aria-selected", String(k === tab[0]));
      $("t-" + k).tabIndex = k === tab[0] ? 0 : -1;
      $("p-" + k).hidden = k !== tab[0];
    });
    if (!rendered[tab[0]] || tab[0] === "bulletins" || tab[0] === "videos") { tab[2](); rendered[tab[0]] = true; }
    if (push) history.replaceState(null, "", "#" + tab[0]);
  }
  CC.fill($("onglets"), ...TABS.map(([k, label]) => h("button", { type: "button", role: "tab", id: "t-" + k, "aria-controls": "p-" + k, "aria-selected": "false", class: "tab",
    onclick: () => showTab(k, true),
    onkeydown: (e) => {
      const i = TABS.findIndex(([x]) => x === k);
      const next = e.key === "ArrowRight" ? TABS[(i + 1) % TABS.length] : e.key === "ArrowLeft" ? TABS[(i + TABS.length - 1) % TABS.length] : null;
      if (next) { e.preventDefault(); showTab(next[0], true); $("t-" + next[0]).focus(); }
    } }, label)));

  renderHeader();
  showTab(location.hash.replace("#", "") || "profil", false);
  window.addEventListener("hashchange", () => showTab(location.hash.replace("#", "") || "profil", false));
})();

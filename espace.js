// Page « Mon espace » : tableau de bord de l'élève et du coach.
(() => {
  const role = CC.role();
  if (!role) return;
  const { h } = CC;
  const $ = (id) => document.getElementById(id);

  const TYPES = { individuel: "Cours individuel", duo: "Cours à deux", video: "Reprise d'une analyse vidéo" };
  const STATUS = {
    attente: ["En attente", "badge--wait"],
    accepte: ["Acceptée", "badge--ok"],
    refuse: ["Refusée", "badge--no"],
  };

  const videos = CC.videos();
  const isAnalysis = (m) => m.from === "coach" && m.analysis;
  const analysesOf = (v) => CC.messages(v.id).filter(isAnalysis);
  const emptyBox = (text) => h("li", { class: "empty" }, text);

  // ---------- Élève ----------
  function renderEleve() {
    const me = CC.ensureMe();
    const prenom = CC.profile(me).prenom;
    $("vue-eleve").hidden = false;
    document.querySelectorAll(".demo-note, .example-box").forEach((el) => $("el-demo").append(el));
    const acc = CC.accounts().find((a) => a.id === me);
    if (acc && acc.kind === "jeune" && !CC.comp.playerOfAccount(me)) {
      $("vue-eleve").prepend(h("p", { class: "demo-note" }, h("strong", {}, "Inscription en attente."), " Ton coach doit valider ton inscription au Centre de compétition jeunes. Dès que c'est fait, l'onglet « Mon suivi » apparaît dans ton menu."));
    }
    $("eyebrow").textContent = "Mon espace élève";
    $("hello").textContent = prenom ? "Bonjour " + prenom + " !" : "Bienvenue sur CourtCoach !";
    $("sub").textContent = "Envoie tes vidéos, reçois les conseils de ton coach et suis tes progrès.";

    const pct = CC.profileCompletion(me);
    $("st-profil").textContent = pct + " %";
    $("st-profil-bar").style.setProperty("--val", pct + "%");

    const mine = videos.filter((v) => v.owner === "eleve" && v.studentId === me);
    $("st-videos").textContent = mine.length;
    const analyses = mine.flatMap((v) => analysesOf(v).map((m) => ({ v, m })));
    $("st-analyses").textContent = analyses.length;

    const listA = $("dernieres-analyses");
    analyses.sort((a, b) => b.m.date.localeCompare(a.m.date)).slice(0, 5).forEach(({ v, m }) => {
      listA.append(h("li", { class: "list__item" },
        h("div", { class: "list__main" }, h("strong", {}, v.title), h("small", {}, "Reçue le " + CC.fmtDate(m.date))),
        h("a", { class: "btn btn--small btn--outline", href: "messages.html?id=" + v.id }, "Lire et répondre")));
    });
    if (!analyses.length) listA.append(emptyBox("Pas encore d'analyse. Envoie ta première vidéo !"));

    renderLessons(me);
    setupLessonToggle();
    setupLessonForm(me);
  }

  // Réponses du coach pas encore vues : bandeau bien visible en haut de l'espace
  function renderAnswers(me) {
    let box = $("reponses-cours");
    if (!box) { box = h("div", { id: "reponses-cours", class: "answers", role: "status", "aria-live": "polite" }); document.querySelector(".app-main").prepend(box); }
    const fresh = CC.lessons().filter((l) => l.studentId === me && l.seenByStudent === false && l.status !== "attente");
    box.replaceChildren(...fresh.map((l) => {
      const ok = l.status === "accepte";
      return h("div", { class: "answer " + (ok ? "answer--ok" : "answer--no") },
        h("div", {}, h("strong", {}, ok ? "✅ Ton coach a accepté ta demande de cours" : "❌ Ton coach ne peut pas donner suite à ta demande"),
          h("p", {}, (TYPES[l.type] || "Cours") + " · " + l.objectif + (l.coachReply ? " — « " + l.coachReply + " »" : ""))),
        h("button", { type: "button", class: "btn btn--small btn--outline", onclick: () => {
          CC.saveLessons(CC.lessons().map((x) => (x.id === l.id ? { ...x, seenByStudent: true } : x)));
          renderAnswers(me); document.dispatchEvent(new CustomEvent("cc:answers-seen"));
        } }, "J'ai vu"));
    }));
  }

  function renderLessons(me) {
    const list = $("mes-cours");
    list.replaceChildren();
    const mine = CC.lessons().filter((l) => l.studentId === me).reverse();
    mine.forEach((l) => {
      const [label, cls] = STATUS[l.status] || STATUS.attente;
      list.append(h("li", { class: "list__item" },
        h("div", { class: "list__main" },
          h("strong", {}, (TYPES[l.type] || "Cours") + " · " + l.objectif),
          h("small", {}, [l.days.length ? l.days.join(", ") : "Jours à définir", l.moment].join(" · ") + " — demandé le " + CC.fmtDate(l.date)),
          l.coachReply ? h("small", { class: "reply" }, "💬 Réponse du coach : « " + l.coachReply + " »") : null),
        h("span", { class: "badge " + cls + " badge--big" }, label)));
    });
    $("mes-demandes").hidden = !mine.length;
    renderAnswers(me);
  }

  // Le formulaire de cours n'apparaît que lorsqu'on clique sur « Demander un cours »
  function setupLessonToggle() {
    const button = $("btn-cours");
    const section = $("cours");
    function setOpen(open, scroll) {
      section.hidden = !open;
      button.setAttribute("aria-expanded", String(open));
      button.textContent = open ? "Masquer le formulaire" : "Demander un cours";
      if (open && scroll) {
        section.scrollIntoView({ behavior: "smooth", block: "start" });
        $("c-type").focus({ preventScroll: true });
      }
    }
    button.addEventListener("click", () => setOpen(section.hidden, true));
    if (location.hash === "#cours") setOpen(true, true);
    window.addEventListener("hashchange", () => { if (location.hash === "#cours") setOpen(true, true); });
  }

  function setupLessonForm(me) {
    const form = $("form-cours");
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const data = new FormData(form);
      const lesson = {
        id: CC.uid(),
        studentId: me,
        date: new Date().toISOString(),
        type: data.get("type"),
        objectif: data.get("objectif"),
        days: data.getAll("jours"),
        moment: data.get("moment"),
        message: String(data.get("message") || "").trim(),
        status: "attente",
      };
      CC.saveLessons([...CC.lessons(), lesson]);

      form.reset();
      const status = $("cours-status");
      status.className = "status-line is-ok";
      status.textContent = "Demande envoyée ! Sa réponse (acceptée ou refusée) s'affichera dans « Mes demandes ».";
      renderLessons(me);
    });
  }

  // ---------- Coach ----------
  function renderCoach() {
    $("vue-coach").hidden = false;
    $("eyebrow").textContent = "Espace coach";
    $("hello").textContent = "Bonjour coach !";
    $("sub").textContent = "Deux espaces distincts : les demandes de coaching des adhérents, et le Centre de compétition jeunes.";

    // Le texte de démonstration et les vidéos d'exemple sont rangés en bas, dans un bloc replié
    const demo = $("co-demo");
    document.querySelectorAll(".demo-note, .example-box").forEach((el) => demo.append(el));

    const lessons = CC.lessons();
    const cur = CC.comp.current();
    const players = CC.comp.players();
    const replies = videos.filter((v) => v.owner === "eleve" && CC.awaitingCoach(v.id));
    const waiting = videos.filter((v) => v.owner === "eleve" && v.status !== "analysee");
    const pendingLessons = lessons.filter((l) => l.status === "attente");
    const toPrepare = players.filter((p) => CC.comp.completion(CC.comp.getEval(p.id, cur.season, cur.t)) < 100);
    const plural = (n, one, many) => n + " " + (n > 1 ? many : one);

    // Vidéos des jeunes du Centre qui attendent une analyse
    const playerVideos = CC.videos().filter((v) => v.playerId && CC.comp.player(v.playerId));
    const unanalysed = playerVideos.filter((v) => !CC.comp.analyses(v.playerId).some((x) => x.videoId === v.id));

    // Deux bandeaux séparés : coaching (adhérents) / Centre de compétition jeunes
    const chip = (n, one, many, on, href) => h("a", { class: "todo-chip" + (on ? " is-on" : ""), href }, h("b", {}, String(n)), " " + (n > 1 ? many : one));
    $("co-resume").replaceChildren(
      chip(waiting.length + replies.length, "à analyser ou lire", "à analyser ou lire", waiting.length + replies.length, "#co-todo-section"),
      chip(pendingLessons.length, "demande de cours", "demandes de cours", pendingLessons.length, "#co-todo-section"));
    $("co-resume-centre").replaceChildren(
      chip(CC.accounts().filter((a) => a.kind === "jeune" && !players.some((p) => p.accountId === a.id)).length, "inscription à valider", "inscriptions à valider", CC.accounts().filter((a) => a.kind === "jeune" && !players.some((p) => p.accountId === a.id)).length, "suivi.html#inscriptions"),
      chip(unanalysed.length, "vidéo à analyser", "vidéos à analyser", unanalysed.length, "suivi.html"),
      chip(toPrepare.length, "bulletin à préparer", "bulletins à préparer", toPrepare.length, "suivi.html"));

    // Liste « Demandes de coaching », triée par urgence
    const todo = [];
    replies.forEach((v) => todo.push(h("li", { class: "list__item" },
      h("div", { class: "list__main" }, h("strong", {}, CC.studentName(v.studentId) + " — " + v.title), h("small", {}, "💬 A répondu à ton analyse")),
      h("a", { class: "btn btn--small btn--clay", href: "messages.html?id=" + v.id }, "Lire et répondre"))));
    waiting.slice().reverse().forEach((v) => todo.push(h("li", { class: "list__item" },
      h("div", { class: "list__main" }, h("strong", {}, CC.studentName(v.studentId) + " — " + v.title),
        h("small", {}, "🎥 " + (CC.SHOTS[v.shot] || "Coup") + " · envoyée le " + CC.fmtDate(v.date))),
      h("div", { class: "btn-row" }, v.seen ? null : h("span", { class: "badge badge--new" }, "Nouveau"),
        h("a", { class: "btn btn--small btn--clay", href: "eleve.html?id=" + v.studentId + "&video=" + v.id }, "Analyser")))));
    pendingLessons.slice().reverse().forEach((l) => {
      const answer = (status, note) => {
        CC.saveLessons(CC.lessons().map((x) => (x.id === l.id ? { ...x, status, coachReply: note.trim(), answeredAt: new Date().toISOString(), seenByStudent: false } : x)));
        location.reload();
      };
      const actions = h("div", { class: "btn-row" });
      const askReply = (status) => {
        const note = h("input", { type: "text", maxlength: "200", "aria-label": "Message pour l'élève (facultatif)", placeholder: status === "accepte" ? "Ex. : Samedi 10h, court 2" : "Ex. : Pas de créneau cette semaine, propose-moi une autre date", style: "flex:1 1 220px;min-height:44px" });
        actions.replaceChildren(note,
          h("button", { type: "button", class: "btn btn--small " + (status === "accepte" ? "btn--clay" : "btn--danger"), onclick: () => answer(status, note.value) }, status === "accepte" ? "Confirmer l'acceptation" : "Confirmer le refus"),
          h("button", { type: "button", class: "btn btn--small btn--outline", onclick: () => { actions.replaceChildren(...buttons); } }, "Annuler"));
        note.focus();
      };
      const buttons = [
        h("button", { type: "button", class: "btn btn--small btn--clay", onclick: () => askReply("accepte") }, "Accepter"),
        h("button", { type: "button", class: "btn btn--small btn--danger", onclick: () => askReply("refuse") }, "Refuser")];
      actions.replaceChildren(...buttons);
      todo.push(h("li", { class: "list__item list__item--wrap" },
        h("div", { class: "list__main" }, h("strong", {}, CC.studentName(l.studentId) + " — " + (TYPES[l.type] || "Cours") + " · " + l.objectif),
          h("small", {}, "📅 " + [l.days.length ? l.days.join(", ") : "Jours à définir", l.moment].join(" · ")),
          l.message ? h("small", {}, "« " + l.message + " »") : null,
          h("small", {}, "L'élève sera prévenu de ta réponse dès sa prochaine visite.")),
        actions));
    });
    const centre = [];
    unanalysed.forEach((v) => {
      const p = CC.comp.player(v.playerId);
      centre.push(h("li", { class: "list__item" },
        h("div", { class: "list__main" }, h("strong", {}, CC.comp.fullName(p) + " — " + v.title), h("small", {}, "🎥 " + (CC.SHOTS[v.shot] || "Coup") + " · ajoutée le " + CC.fmtDate(v.date))),
        h("a", { class: "btn btn--small btn--clay", href: "analyse.html?id=" + v.id }, "Analyser")));
    });
    CC.accounts().filter((a) => a.kind === "jeune" && !players.some((p) => p.accountId === a.id)).forEach((a) => {
      centre.push(h("li", { class: "list__item" },
        h("div", { class: "list__main" }, h("strong", {}, ((CC.profile(a.id).prenom || "").trim() || "Jeune") + " — nouvelle inscription"), h("small", {}, "🆕 Compte créé avec l'accord d'un parent, à valider")),
        h("a", { class: "btn btn--small btn--clay", href: "suivi.html#inscriptions" }, "Valider")));
    });
    toPrepare.forEach((p) => {
      const pct = CC.comp.completion(CC.comp.getEval(p.id, cur.season, cur.t));
      centre.push(h("li", { class: "list__item" },
        h("div", { class: "list__main" }, h("strong", {}, CC.comp.fullName(p)), h("small", {}, "📝 Bulletin " + CC.comp.periodLabel(cur.season, cur.t).replace("Trimestre ", "T").replace(" · ", " ") + " · rempli à " + pct + " %")),
        h("a", { class: "btn btn--small btn--outline", href: "joueur.html?id=" + p.id + "#evaluations" }, pct ? "Continuer" : "Commencer")));
    });
    $("co-todo-centre").replaceChildren(...(centre.length || !players.length ? centre : [emptyBox("Rien à faire pour les jeunes : tout est à jour 🎾")]));
    $("co-todo").replaceChildren(...(todo.length ? todo : [emptyBox("Aucune demande de coaching en attente 🎾")]));

    // Carte du Centre de compétition jeunes
    const goals = players.flatMap((p) => CC.comp.goals(p.id, cur.season));
    const gp = CC.comp.goalsProgress(goals);
    $("co-centre").replaceChildren(players.length
      ? h("div", { class: "centre-card__row" },
          h("p", {}, h("strong", {}, plural(players.length, "jeune suivi", "jeunes suivis")), " · objectifs de l'année atteints à ", h("strong", {}, gp === null ? "–" : gp + " %")),
          h("a", { class: "btn btn--clay btn--small", href: "suivi.html" }, "Ouvrir le Centre"))
      : h("div", { class: "centre-card__row" }, h("p", {}, "Aucun jeune pour l'instant. Ajoute tes jeunes compétiteurs pour suivre leurs objectifs, évaluations et bulletins."),
          h("a", { class: "btn btn--clay btn--small", href: "suivi.html" }, "Ouvrir le Centre")));

    // Historique des demandes déjà traitées
    const done = lessons.filter((l) => l.status !== "attente");
    $("co-demandes-section").hidden = !done.length;
    $("co-demandes").replaceChildren(...done.slice().reverse().map((l) => {
      const [label, cls] = STATUS[l.status] || STATUS.attente;
      return h("li", { class: "list__item" },
        h("div", { class: "list__main" }, h("strong", {}, CC.studentName(l.studentId) + " — " + (TYPES[l.type] || "Cours") + " · " + l.objectif), h("a", { href: "eleve.html?id=" + l.studentId }, "Voir son dossier")),
        h("span", { class: "badge " + cls }, label));
    }));
  }

  if (role === "coach") renderCoach();
  else renderEleve();
})();

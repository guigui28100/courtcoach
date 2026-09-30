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

  function renderLessons(me) {
    const list = $("mes-cours");
    list.replaceChildren();
    const mine = CC.lessons().filter((l) => l.studentId === me).reverse();
    mine.forEach((l) => {
      const [label, cls] = STATUS[l.status] || STATUS.attente;
      list.append(h("li", { class: "list__item" },
        h("div", { class: "list__main" },
          h("strong", {}, (TYPES[l.type] || "Cours") + " · " + l.objectif),
          h("small", {}, [l.days.length ? l.days.join(", ") : "Jours à définir", l.moment].join(" · ") + " — demandé le " + CC.fmtDate(l.date))),
        h("span", { class: "badge " + cls }, label)));
    });
    if (!mine.length) list.append(emptyBox("Aucune demande pour l'instant."));
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
    $("sub").textContent = "Chaque élève a son dossier : sa fiche, ses vidéos, tes analyses et ses demandes.";

    const lessons = CC.lessons();
    const waiting = videos.filter((v) => v.owner === "eleve" && v.status !== "analysee");
    const pendingLessons = lessons.filter((l) => l.status === "attente");
    $("co-eleves").textContent = CC.students().length;
    $("co-attente").textContent = waiting.length;
    $("co-cours").textContent = pendingLessons.length;

    // Élèves qui ont répondu après une analyse : le coach doit répondre
    const replies = videos.filter((v) => v.owner === "eleve" && CC.awaitingCoach(v.id));
    $("co-reponses-section").hidden = !replies.length;
    replies.forEach((v) => {
      $("co-reponses").append(h("li", { class: "list__item" },
        h("div", { class: "list__main" }, h("strong", {}, CC.studentName(v.studentId) + " — " + v.title), h("small", {}, "A répondu à ton analyse")),
        h("a", { class: "btn btn--small btn--clay", href: "messages.html?id=" + v.id }, "Lire et répondre")));
    });

    const vList = $("co-videos");
    waiting.slice().reverse().forEach((v) => {
      vList.append(h("li", { class: "list__item" },
        h("div", { class: "list__main" },
          h("strong", {}, CC.studentName(v.studentId) + " — " + v.title),
          h("small", {}, (CC.SHOTS[v.shot] || "Coup") + " · envoyée le " + CC.fmtDate(v.date))),
        h("div", { class: "btn-row" },
          v.seen ? null : h("span", { class: "badge badge--new" }, "Nouveau"),
          h("a", { class: "btn btn--small btn--clay", href: "eleve.html?id=" + v.studentId + "&video=" + v.id }, "Ouvrir le dossier"))));
    });
    if (!waiting.length) vList.append(emptyBox("Rien à analyser : tout est à jour 🎾"));

    const dList = $("co-demandes");
    lessons.slice().reverse().forEach((l) => {
      const [label, cls] = STATUS[l.status] || STATUS.attente;
      const reply = (status) => () => {
        CC.saveLessons(CC.lessons().map((x) => (x.id === l.id ? { ...x, status } : x)));
        location.reload();
      };
      dList.append(h("li", { class: "list__item" },
        h("div", { class: "list__main" },
          h("strong", {}, CC.studentName(l.studentId) + " — " + (TYPES[l.type] || "Cours") + " · " + l.objectif),
          h("small", {}, [l.days.length ? l.days.join(", ") : "Jours à définir", l.moment].join(" · ")),
          l.message ? h("small", {}, "« " + l.message + " »") : null,
          h("a", { href: "eleve.html?id=" + l.studentId }, "Voir son dossier")),
        l.status === "attente"
          ? h("div", { class: "btn-row" },
              h("button", { type: "button", class: "btn btn--small btn--clay", onclick: reply("accepte") }, "Accepter"),
              h("button", { type: "button", class: "btn btn--small btn--danger", onclick: reply("refuse") }, "Refuser"))
          : h("span", { class: "badge " + cls }, label)));
    });
    if (!lessons.length) dList.append(emptyBox("Aucune demande de cours."));
  }

  if (role === "coach") renderCoach();
  else renderEleve();
})();

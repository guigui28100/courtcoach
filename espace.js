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

  const prenom = CC.profile().prenom;
  const videos = CC.videos();
  const lessons = CC.lessons();

  const isAnalysis = (m) => m.from === "coach" && m.analysis;
  const analysesOf = (v) => CC.messages(v.id).filter(isAnalysis);

  function emptyBox(text) {
    return h("li", { class: "empty" }, text);
  }

  // ---------- Élève ----------
  function renderEleve() {
    $("vue-eleve").hidden = false;
    $("eyebrow").textContent = "Mon espace élève";
    $("hello").textContent = prenom ? "Bonjour " + prenom + " !" : "Bienvenue sur CourtCoach !";
    $("sub").textContent = "Envoie tes vidéos, reçois les conseils de ton coach et suis tes progrès.";

    const pct = CC.profileCompletion();
    $("st-profil").textContent = pct + " %";
    $("st-profil-bar").style.setProperty("--val", pct + "%");

    const mine = videos.filter((v) => v.owner === "eleve");
    $("st-videos").textContent = mine.length;
    const analyses = mine.flatMap((v) => analysesOf(v).map((m) => ({ v, m })));
    $("st-analyses").textContent = analyses.length;

    const listA = $("dernieres-analyses");
    analyses.sort((a, b) => b.m.date.localeCompare(a.m.date)).slice(0, 5).forEach(({ v, m }) => {
      listA.append(h("li", { class: "list__item" },
        h("div", { class: "list__main" }, h("strong", {}, v.title), h("small", {}, "Reçue le " + CC.fmtDate(m.date))),
        h("a", { class: "btn btn--small btn--outline", href: "messages.html?id=" + v.id }, "Lire l'analyse")));
    });
    if (!analyses.length) listA.append(emptyBox("Pas encore d'analyse. Envoie ta première vidéo !"));

    renderLessons();
  }

  function renderLessons() {
    const list = $("mes-cours");
    list.replaceChildren();
    const mine = CC.lessons().slice().reverse();
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

  function setupLessonForm() {
    const form = $("form-cours");
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const data = new FormData(form);
      const lesson = {
        id: CC.uid(),
        date: new Date().toISOString(),
        type: data.get("type"),
        objectif: data.get("objectif"),
        days: data.getAll("jours"),
        moment: data.get("moment"),
        message: String(data.get("message") || "").trim(),
        status: "attente",
      };
      const all = CC.lessons();
      all.push(lesson);
      CC.saveLessons(all);

      // La demande apparaît aussi dans la discussion avec le coach
      const summary = "Demande de cours particulier — " + (TYPES[lesson.type] || "Cours") + " sur : " + lesson.objectif +
        ". Jours : " + (lesson.days.join(", ") || "à définir") + " (" + lesson.moment + ")." +
        (lesson.message ? "\n" + lesson.message : "");
      CC.addMessage("general", { from: "eleve", text: summary });

      form.reset();
      const status = $("cours-status");
      status.className = "status-line is-ok";
      status.textContent = "Demande envoyée ! Ton coach te répondra dans la discussion générale.";
      renderLessons();
    });
  }

  // ---------- Coach ----------
  function renderCoach() {
    $("vue-coach").hidden = false;
    $("eyebrow").textContent = "Espace coach";
    $("hello").textContent = "Bonjour coach !";
    $("sub").textContent = "Les vidéos à analyser et les demandes de cours de tes élèves.";

    const fromStudents = videos.filter((v) => v.owner === "eleve");
    const waiting = fromStudents.filter((v) => v.status !== "analysee");
    const pendingLessons = lessons.filter((l) => l.status === "attente");
    $("co-attente").textContent = waiting.length;
    $("co-faites").textContent = fromStudents.length - waiting.length;
    $("co-cours").textContent = pendingLessons.length;

    const vList = $("co-videos");
    waiting.forEach((v) => {
      vList.append(h("li", { class: "list__item" },
        h("div", { class: "list__main" },
          h("strong", {}, v.title),
          h("small", {}, (CC.SHOTS[v.shot] || "Coup") + " · envoyée le " + CC.fmtDate(v.date))),
        h("a", { class: "btn btn--small btn--clay", href: "analyse.html?id=" + v.id }, "Analyser")));
    });
    if (!waiting.length) vList.append(emptyBox("Rien à analyser : tout est à jour 🎾"));

    const dList = $("co-demandes");
    lessons.slice().reverse().forEach((l) => {
      const [label, cls] = STATUS[l.status] || STATUS.attente;
      const reply = (status, text) => () => {
        CC.saveLessons(CC.lessons().map((x) => (x.id === l.id ? { ...x, status } : x)));
        CC.addMessage("general", { from: "coach", text });
        location.reload();
      };
      dList.append(h("li", { class: "list__item" },
        h("div", { class: "list__main" },
          h("strong", {}, (TYPES[l.type] || "Cours") + " · " + l.objectif),
          h("small", {}, [l.days.length ? l.days.join(", ") : "Jours à définir", l.moment].join(" · ")),
          l.message ? h("small", {}, "« " + l.message + " »") : null),
        l.status === "attente"
          ? h("div", { class: "btn-row" },
              h("button", { type: "button", class: "btn btn--small btn--clay", onclick: reply("accepte", "Super, j'accepte ta demande de cours ! Je te propose un créneau très vite.") }, "Accepter"),
              h("button", { type: "button", class: "btn btn--small btn--danger", onclick: reply("refuse", "Je ne peux pas te prendre sur ces créneaux. Propose-moi d'autres jours ?") }, "Refuser"))
          : h("span", { class: "badge " + cls }, label)));
    });
    if (!lessons.length) dList.append(emptyBox("Aucune demande de cours."));
  }

  if (role === "coach") renderCoach();
  else { renderEleve(); setupLessonToggle(); setupLessonForm(); }
})();

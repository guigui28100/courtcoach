// Dossier d'un élève (coach) : sa fiche, ses vidéos, les analyses envoyées, ses demandes de cours, tes notes.
(() => {
  const role = CC.role();
  if (!role) return;
  if (role !== "coach") { location.replace("espace.html"); return; }
  const { h } = CC;
  const $ = (id) => document.getElementById(id);

  const params = new URLSearchParams(location.search);
  const sid = params.get("id");
  const account = CC.accounts().find((a) => a.id === sid);
  if (!account) {
    $("contenu-dossier").replaceChildren(
      h("p", { class: "empty" }, "Ce dossier est introuvable."),
      h("p", {}, h("a", { class: "btn btn--clay", href: "eleves.html" }, "Retour à mes élèves")));
    $("nom").textContent = "Dossier introuvable";
    return;
  }

  const TYPES = { individuel: "Cours individuel", duo: "Cours à deux", video: "Reprise d'une analyse vidéo" };
  const STATUS = { attente: ["En attente", "badge--wait"], accepte: ["Acceptée", "badge--ok"], refuse: ["Refusée", "badge--no"] };
  const p = CC.profile(sid);
  const name = CC.studentName(sid);
  const wantedVideo = params.get("video");

  // Ses vidéos, de la plus récente à la plus ancienne
  const videos = CC.videos().filter((v) => v.owner === "eleve" && v.studentId === sid).sort((a, b) => b.date.localeCompare(a.date));
  // « Nouvelles » = pas encore ouvertes par le coach ; on les repère avant de les marquer comme vues
  const fresh = videos.filter((v) => !v.seen && v.status !== "analysee");
  videos.filter((v) => !v.seen).forEach((v) => CC.updateVideo(v.id, { seen: true }));

  // ----- En-tête -----
  document.title = "Dossier de " + name + " – CourtCoach";
  $("nom").textContent = name;
  $("lien-discussion").href = "messages.html?id=" + CC.threadGeneral(sid);
  const age = CC.ageOf(p.naissance);
  const infos = [
    age !== null ? age + " ans" : null,
    p.classement ? "Classement : " + p.classement : null,
    p.lateralite, p.revers ? "Revers " + p.revers.toLowerCase() : null,
    p.annees ? p.annees + " an(s) de pratique" : null,
  ].filter(Boolean);
  $("infos").replaceChildren(
    ...infos.map((t) => h("span", { class: "badge" }, t)),
    p.sante && p.sante.trim() ? h("span", { class: "badge badge--no" }, "⚠ Santé : " + p.sante.trim()) : null);
  if (!infos.length && !(p.sante || "").trim()) $("infos").append(h("span", { class: "hint" }, "Cet élève n'a pas encore rempli son profil."));

  // ----- Bandeau « nouvelle vidéo » -----
  if (fresh.length) {
    const v = fresh.find((x) => x.id === wantedVideo) || fresh[0];
    const banner = $("banniere");
    banner.hidden = false;
    banner.append(
      h("div", {}, h("strong", {}, fresh.length > 1 ? fresh.length + " nouvelles vidéos reçues" : "Nouvelle vidéo reçue"),
        h("div", {}, "« " + v.title + " » — " + (CC.SHOTS[v.shot] || "coup") + (v.question ? " · Question : " + v.question : ""))),
      h("a", { class: "btn btn--ball btn--small", href: "analyse.html?id=" + v.id }, "Analyser maintenant"));
  }

  // ----- Vidéos -----
  function videoCard(v) {
    const thumb = h("video", { muted: true, playsinline: true, preload: "metadata", "aria-hidden": "true", tabindex: "-1" });
    CC.fileURL(v.fileId).then((url) => { if (url) thumb.src = url + "#t=0.3"; });
    const badge = v.status === "analysee" ? h("span", { class: "badge badge--ok" }, "Analysée") : h("span", { class: "badge badge--wait" }, "À analyser");
    // Vidéo précédente du même coup : pour comparer l'évolution
    const previous = videos.find((o) => o.shot === v.shot && o.date < v.date);
    return h("article", { class: "video-card" + (v.id === wantedVideo ? " video-card--focus" : ""), id: "video-" + v.id },
      h("div", { class: "video-card__thumb" }, thumb),
      h("div", { class: "video-card__body" },
        h("h3", {}, v.title),
        h("div", { class: "video-card__meta" }, badge, h("span", {}, CC.SHOTS[v.shot] || "Coup"), h("span", {}, "· " + CC.fmtDate(v.date))),
        v.question ? h("p", { class: "hint" }, "« " + v.question + " »") : null,
        h("div", { class: "btn-row" },
          h("a", { class: "btn btn--small btn--clay", href: "analyse.html?id=" + v.id }, v.status === "analysee" ? "Reprendre l'analyse" : "Analyser"),
          h("a", { class: "btn btn--small btn--outline", href: "messages.html?id=" + v.id }, "Discuter"),
          previous ? h("a", { class: "btn btn--small btn--outline", href: "analyse.html?id=" + v.id + "&b=" + previous.id + "&mode=side" }, "Comparer avec la précédente") : null)));
  }
  const vBox = $("videos");
  vBox.replaceChildren(...videos.map(videoCard));
  if (!videos.length) vBox.append(h("div", { class: "empty", style: "grid-column: 1 / -1" }, "Aucune vidéo envoyée pour l'instant."));
  const focus = wantedVideo && document.getElementById("video-" + wantedVideo);
  if (focus) setTimeout(() => focus.scrollIntoView({ behavior: "smooth", block: "center" }), 200);

  // ----- Analyses envoyées -----
  const sent = videos.flatMap((v) => CC.messages(v.id).filter((m) => m.from === "coach" && m.analysis).map((m) => ({ v, m })))
    .sort((a, b) => b.m.date.localeCompare(a.m.date));
  const aList = $("analyses");
  sent.forEach(({ v, m }) => {
    const a = m.analysis;
    const resume = (a.observation || a.improve || "").slice(0, 110);
    aList.append(h("li", { class: "list__item" },
      h("div", { class: "list__main" },
        h("strong", {}, v.title + " — " + CC.fmtDate(m.date)),
        h("small", {}, (resume ? resume + (resume.length >= 110 ? "…" : "") + " · " : "") + (a.exercises || []).length + " exercice(s), " + (a.captures || []).length + " image(s)")),
      h("a", { class: "btn btn--small btn--outline", href: "messages.html?id=" + v.id }, "Relire")));
  });
  if (!sent.length) aList.append(h("li", { class: "empty" }, "Aucune analyse envoyée à cet élève."));

  // ----- Demandes de cours -----
  const lessons = CC.lessons().filter((l) => l.studentId === sid).reverse();
  const cList = $("cours");
  lessons.forEach((l) => {
    const [label, cls] = STATUS[l.status] || STATUS.attente;
    const reply = (status, text) => () => {
      CC.saveLessons(CC.lessons().map((x) => (x.id === l.id ? { ...x, status } : x)));
      CC.addMessage(CC.threadGeneral(sid), { from: "coach", text });
      location.reload();
    };
    cList.append(h("li", { class: "list__item" },
      h("div", { class: "list__main" },
        h("strong", {}, (TYPES[l.type] || "Cours") + " · " + l.objectif),
        h("small", {}, [l.days.length ? l.days.join(", ") : "Jours à définir", l.moment].join(" · ") + " — demandé le " + CC.fmtDate(l.date)),
        l.message ? h("small", {}, "« " + l.message + " »") : null),
      l.status === "attente"
        ? h("div", { class: "btn-row" },
            h("button", { type: "button", class: "btn btn--small btn--clay", onclick: reply("accepte", "Super, j'accepte ta demande de cours ! Je te propose un créneau très vite.") }, "Accepter"),
            h("button", { type: "button", class: "btn btn--small btn--danger", onclick: reply("refuse", "Je ne peux pas te prendre sur ces créneaux. Propose-moi d'autres jours ?") }, "Refuser"))
        : h("span", { class: "badge " + cls }, label)));
  });
  if (!lessons.length) cList.append(h("li", { class: "empty" }, "Aucune demande de cours."));

  // ----- Fiche complète (lecture seule) -----
  const fiche = $("fiche");
  CC.PROFILE_SECTIONS.forEach(([title, fields]) => {
    const rows = fields.map(([key, label]) => {
      let value = p[key];
      if (Array.isArray(value)) value = value.join(", ");
      if (key === "naissance" && value) value = CC.fmtDate(value) + (age !== null ? " (" + age + " ans)" : "");
      if (key === "sexe") value = value === "F" ? "Femme" : value === "H" ? "Homme" : "";
      return [label, value && String(value).trim() ? String(value) : ""];
    });
    // Le bloc « Responsable légal » n'apparaît que s'il est rempli
    if (title === "Responsable légal" && rows.every(([, v]) => !v)) return;
    fiche.append(
      h("h3", { style: "font-size:1rem; margin: var(--s2) 0 6px; text-transform: uppercase; letter-spacing: .06em" }, title),
      h("dl", { class: "profile-mini" }, rows.map(([label, value]) =>
        h("div", {}, h("dt", {}, label), h("dd", {}, value || "—")))));
  });

  // ----- Notes privées -----
  const notesKey = "notes." + sid;
  const notes = $("notes");
  notes.value = CC.read(notesKey, "");
  let timer;
  notes.addEventListener("input", () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      const ok = CC.write(notesKey, notes.value);
      $("notes-status").className = "status-line " + (ok ? "is-ok" : "is-error");
      $("notes-status").textContent = ok ? "Notes enregistrées ✓" : "Impossible d'enregistrer les notes.";
    }, 400);
  });
})();

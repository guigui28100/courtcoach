// Page « Analyse et discussion » : l'analyse du coach pour UNE vidéo, puis l'échange qui suit
// (texte, photos, vidéos). La discussion s'ouvre seulement une fois l'analyse envoyée.
(() => {
  const role = CC.role();
  if (!role) return;
  const { h } = CC;
  const $ = (id) => document.getElementById(id);
  const isCoach = role === "coach";
  const me = isCoach ? null : CC.ensureMe();

  // Il n'y a pas de messagerie libre : on arrive ici depuis une vidéo
  const video = CC.videoById(new URLSearchParams(location.search).get("id"));
  if (!video || video.owner !== "eleve" || (!isCoach && video.studentId !== me)) {
    location.replace(isCoach ? "eleves.html" : "videos.html");
    return;
  }
  const studentName = CC.studentName(video.studentId);
  const studentFirstName = CC.profile(video.studentId).prenom || "Élève";

  // ----- En-tête -----
  $("titre-page").textContent = video.title;
  $("sous-titre").textContent = (CC.SHOTS[video.shot] || "Coup") + " · envoyée le " + CC.fmtDate(video.date) + (isCoach ? " · " + studentName : "");
  if (isCoach) {
    $("lien-retour").href = "eleve.html?id=" + video.studentId + "&video=" + video.id;
    $("lien-retour").textContent = "← Dossier de " + studentName;
  }
  const actions = $("thread-actions");
  if (isCoach) actions.append(h("a", { class: "btn btn--small btn--clay", href: "analyse.html?id=" + video.id }, video.status === "analysee" ? "Reprendre l'analyse" : "Analyser la vidéo"));

  // ----- Affichage d'un message -----
  function attachment(f) {
    const holder = h("div", {});
    CC.fileURL(f.id).then((url) => {
      if (!url) return;
      if (f.type === "image") holder.append(h("a", { href: url, target: "_blank", rel: "noopener" }, h("img", { src: url, alt: "Photo envoyée : " + f.name, loading: "lazy" })));
      else holder.append(h("video", { src: url, controls: true, playsinline: true, preload: "metadata", "aria-label": "Vidéo envoyée : " + f.name }));
    });
    return holder;
  }

  function analysisCard(a) {
    const caps = (a.captures || []).map((id, i) => {
      const holder = h("a", { target: "_blank", rel: "noopener" });
      CC.fileURL(id).then((url) => {
        if (!url) return;
        holder.href = url;
        holder.append(h("img", { src: url, alt: "Image annotée n° " + (i + 1), loading: "lazy" }));
      });
      return holder;
    });
    return h("div", { class: "analysis" },
      h("h3", {}, isCoach ? "Ton analyse" : "Analyse de ton coach"),
      a.observation ? h("div", {}, h("h4", {}, "Observation"), h("p", {}, a.observation)) : null,
      a.strengths ? h("div", {}, h("h4", {}, "Points forts"), h("p", {}, a.strengths)) : null,
      a.improve ? h("div", {}, h("h4", {}, "À améliorer"), h("p", {}, a.improve)) : null,
      caps.length ? h("div", {}, h("h4", {}, "Images annotées"), h("div", { class: "analysis__caps" }, caps)) : null,
      (a.exercises || []).length
        ? h("div", {}, h("h4", {}, "Exercices à faire"),
            h("ol", {}, a.exercises.map((e) => h("li", {}, h("strong", {}, e.title),
              e.reps ? " — " + e.reps : "", e.detail ? h("div", {}, e.detail) : null))))
        : null);
  }

  function bubble(m) {
    const mine = m.from === role;
    const who = m.from === "coach" ? "Coach" : studentFirstName;
    return h("article", { class: "bubble" + (mine ? " bubble--mine" : "") },
      h("span", { class: "bubble__who" }, mine ? "Toi (" + who + ")" : who),
      m.text ? h("p", {}, m.text) : null,
      m.analysis ? analysisCard(m.analysis) : null,
      (m.files || []).map(attachment),
      h("time", { class: "bubble__time", datetime: m.date }, CC.fmtDateTime(m.date)));
  }

  // ----- Affichage de la discussion (ouverte ou fermée) -----
  function render() {
    const open = CC.isDiscussionOpen(video.id);
    const list = CC.messages(video.id);
    const log = $("log");
    log.replaceChildren(...list.map(bubble));
    if (!list.length) log.append(h("p", { class: "hint" }, "Rien pour l'instant."));
    log.scrollTop = log.scrollHeight;

    $("composer").hidden = !open;
    $("verrou").hidden = open;
    if (!open) {
      $("verrou-texte").textContent = isCoach
        ? "La discussion s'ouvrira dès que tu auras envoyé ton analyse à l'élève."
        : "Ton coach n'a pas encore envoyé son analyse. Tu pourras lui répondre ici dès qu'elle sera arrivée.";
      $("verrou-actions").replaceChildren(isCoach
        ? h("a", { class: "btn btn--small btn--clay", href: "analyse.html?id=" + video.id }, "Analyser la vidéo")
        : h("a", { class: "btn btn--small btn--outline", href: "videos.html" }, "Mes vidéos"));
    }
  }

  // ----- Envoi (seulement quand la discussion est ouverte) -----
  let pending = [];
  function renderPending() {
    $("pending").replaceChildren(...pending.map((f, i) =>
      h("span", { class: "composer__file" }, f.name,
        h("button", { type: "button", "aria-label": "Retirer " + f.name, onclick: () => { pending.splice(i, 1); renderPending(); } }, "✕"))));
  }
  $("pieces").addEventListener("change", (e) => {
    pending.push(...Array.from(e.target.files));
    e.target.value = "";
    renderPending();
  });

  $("composer").addEventListener("submit", async (event) => {
    event.preventDefault();
    const status = $("msg-status");
    if (!CC.isDiscussionOpen(video.id)) return;
    const text = $("texte").value.trim();
    if (!text && !pending.length) {
      status.className = "status-line is-error";
      status.textContent = "Écris un message ou ajoute une photo ou une vidéo.";
      return;
    }
    status.className = "status-line";
    status.textContent = "Envoi…";
    try {
      const files = [];
      for (const f of pending) {
        const type = f.type.startsWith("image/") ? "image" : f.type.startsWith("video/") ? "video" : null;
        if (!type) continue;
        files.push({ id: await CC.putFile(f), type, name: f.name });
      }
      CC.addMessage(video.id, { from: role, text, files });
      $("texte").value = "";
      pending = [];
      renderPending();
      status.textContent = "";
      render();
    } catch (e) {
      status.className = "status-line is-error";
      status.textContent = "Envoi impossible (espace insuffisant ?).";
    }
  });

  // Ctrl + Entrée envoie le message
  $("texte").addEventListener("keydown", (e) => {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) $("composer").requestSubmit();
  });

  render();
})();

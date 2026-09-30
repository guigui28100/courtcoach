// Page « Vidéos » : envoi d'une vidéo (élève) et bibliothèque.
(() => {
  const role = CC.role();
  if (!role) return;
  const { h } = CC;
  const isCoach = role === "coach";
  const me = isCoach ? null : CC.ensureMe();
  const $ = (id) => document.getElementById(id);
  const MAX_SIZE = 400 * 1024 * 1024; // 400 Mo

  // ----- Textes selon le rôle -----
  if (isCoach) {
    $("eyebrow").textContent = "Vidéos";
    $("titre").textContent = "Vidéos des élèves";
    $("sous-titre").textContent = "Ouvre une vidéo pour l'analyser, ou ajoute une vidéo de référence (un geste modèle) pour la comparer.";
    $("envoi-titre").textContent = "Ajouter une vidéo de référence";
    $("fichier-label").textContent = "Vidéo de référence";
    $("fichier-aide").textContent = "Un geste modèle : tu pourras la superposer ou la mettre à côté de la vidéo d'un élève.";
    $("btn-envoyer").textContent = "Ajouter la vidéo";
    $("champ-question").hidden = true;
    $("liste-titre").textContent = "Bibliothèque";
  } else {
    $("sous-titre").textContent = "Envoie une vidéo de ton coup et retrouve ici toutes tes vidéos.";
  }

  const shotSelect = $("coup");
  Object.entries(CC.SHOTS).forEach(([value, label]) => shotSelect.append(h("option", { value }, label)));

  // ----- Aperçu de la vidéo choisie -----
  const fileInput = $("fichier");
  const preview = $("apercu");
  let previewUrl = null;
  fileInput.addEventListener("change", () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    const file = fileInput.files[0];
    if (!file) { preview.hidden = true; return; }
    previewUrl = URL.createObjectURL(file);
    preview.src = previewUrl;
    preview.hidden = false;
  });

  // ----- Envoi -----
  const form = $("form-upload");
  const status = $("upload-status");
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const file = fileInput.files[0];
    const fail = (msg) => { status.className = "status-line is-error"; status.textContent = msg; };
    if (!file) return fail("Choisis d'abord une vidéo.");
    if (!file.type.startsWith("video/")) return fail("Ce fichier n'est pas une vidéo.");
    if (file.size > MAX_SIZE) return fail("La vidéo est trop lourde (400 Mo maximum). Essaie une séquence plus courte.");

    const button = $("btn-envoyer");
    button.disabled = true;
    status.className = "status-line";
    status.textContent = "Enregistrement en cours…";
    try {
      const fileId = await CC.putFile(file);
      const video = {
        id: CC.uid(),
        fileId,
        owner: isCoach ? "coach" : "eleve",
        studentId: me,
        title: form.elements.titre.value.trim() || file.name.replace(/\.[^.]+$/, ""),
        shot: form.elements.coup.value,
        question: isCoach ? "" : form.elements.question.value.trim(),
        date: new Date().toISOString(),
        size: file.size,
        status: isCoach ? "reference" : "attente",
      };
      CC.saveVideos([...CC.videos(), video]);
      if (!isCoach) {
        CC.addMessage(video.id, {
          from: "eleve",
          text: "Voici ma vidéo (" + (CC.SHOTS[video.shot] || "coup") + ")." + (video.question ? "\n" + video.question : ""),
        });
      }
      form.reset();
      preview.hidden = true;
      status.className = "status-line is-ok";
      status.textContent = isCoach ? "Vidéo de référence ajoutée ✓" : "Vidéo envoyée ✓ Ton coach va l'analyser.";
      render();
    } catch (e) {
      fail("Impossible d'enregistrer la vidéo (espace insuffisant ?). Essaie une vidéo plus courte.");
    } finally {
      button.disabled = false;
    }
  });

  // ----- Liste -----
  let filter = "toutes";
  const FILTERS = isCoach
    ? [["toutes", "Toutes"], ["attente", "À analyser"], ["analysee", "Analysées"], ["reference", "Références"]]
    : [];

  function visibleVideos() {
    let list = CC.videos();
    if (!isCoach) list = list.filter((v) => v.owner === "eleve" && v.studentId === me);
    if (filter !== "toutes") list = list.filter((v) => v.status === filter);
    return list.slice().reverse();
  }

  function card(v) {
    const thumb = h("video", { muted: true, playsinline: true, preload: "metadata", "aria-hidden": "true", tabindex: "-1" });
    CC.fileURL(v.fileId).then((url) => { if (url) thumb.src = url + "#t=0.3"; });
    const badge = v.status === "reference" ? h("span", { class: "badge badge--ref" }, "Référence")
      : v.status === "analysee" ? h("span", { class: "badge badge--ok" }, "Analysée")
      : h("span", { class: "badge badge--wait" }, "En attente");

    const actions = [];
    if (isCoach && v.status !== "reference") {
      actions.push(h("a", { class: "btn btn--small btn--clay", href: "eleve.html?id=" + v.studentId + "&video=" + v.id }, "Ouvrir le dossier"));
      actions.push(h("a", { class: "btn btn--small btn--outline", href: "analyse.html?id=" + v.id }, v.status === "analysee" ? "Reprendre l'analyse" : "Analyser"));
    }
    if (isCoach && v.status === "reference") {
      actions.push(h("a", { class: "btn btn--small btn--clay", href: "analyse.html?id=" + v.id }, "Ouvrir"));
    }
    // La discussion n'existe qu'après l'analyse
    if (v.status === "analysee") {
      actions.push(h("a", { class: "btn btn--small btn--outline", href: "messages.html?id=" + v.id }, isCoach ? "Discussion" : "Lire l'analyse et répondre"));
    }
    actions.push(h("button", {
      type: "button", class: "btn btn--small btn--danger",
      "aria-label": "Supprimer la vidéo " + v.title,
      onclick: async () => {
        if (!confirm("Supprimer cette vidéo et sa discussion ? Cette action est définitive.")) return;
        await CC.removeVideo(v.id);
        render();
      },
    }, "Supprimer"));

    return h("article", { class: "video-card" },
      h("div", { class: "video-card__thumb" }, thumb),
      h("div", { class: "video-card__body" },
        h("h3", {}, isCoach && v.studentId ? CC.studentName(v.studentId) + " — " + v.title : v.title),
        h("div", { class: "video-card__meta" }, badge, h("span", {}, CC.SHOTS[v.shot] || "Coup"), h("span", {}, "· " + CC.fmtDate(v.date) + " · " + CC.fmtSize(v.size))),
        h("div", { class: "btn-row" }, actions)));
  }

  function render() {
    const list = visibleVideos();
    const box = $("liste");
    box.replaceChildren(...list.map(card));
    if (!list.length) {
      box.append(h("div", { class: "empty", style: "grid-column: 1 / -1" },
        isCoach ? "Aucune vidéo pour l'instant." : "Tu n'as pas encore envoyé de vidéo. Utilise le formulaire ci-dessus !"));
    }
    const filters = $("filtres");
    if (FILTERS.length) {
      filters.hidden = false;
      filters.replaceChildren(...FILTERS.map(([key, label]) =>
        h("button", { type: "button", "aria-pressed": String(filter === key), onclick: () => { filter = key; render(); } }, label)));
    }
  }

  render();
})();

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
    $("sous-titre").textContent = "Ouvre une vidéo pour l'analyser, ou ajoutes-en une : celle d'un élève (filmée pendant un cours) ou un modèle de référence.";
    $("envoi-titre").textContent = "Ajouter une vidéo";
    $("fichier-label").textContent = "Vidéo";
    $("fichier-aide").textContent = "Tu pourras l'analyser (dessins, angles, images annotées) et la comparer à une autre.";
    $("btn-envoyer").textContent = "Ajouter la vidéo";

    // À qui est cette vidéo ? Par défaut : à un élève, s'il y en a
    const students = CC.students();
    const fieldset = $("champ-destinataire");
    fieldset.hidden = false;
    $("eleve-id").replaceChildren(...students.map((a) => h("option", { value: a.id }, CC.studentName(a.id))));
    const radios = Array.from(fieldset.querySelectorAll('input[name="destinataire"]'));
    const forStudent = radios.find((r) => r.value === "eleve");
    const forModel = radios.find((r) => r.value === "reference");
    const forPlayer = radios.find((r) => r.value === "joueur");
    const squad = CC.comp.players();
    $("joueur-id").replaceChildren(...squad.map((p) => h("option", { value: p.id }, CC.comp.fullName(p))));
    if (!squad.length) forPlayer.disabled = true;
    if (!students.length) {
      forStudent.disabled = true;
      forModel.checked = true;
      $("destinataire-aide").textContent = "Il n'y a pas encore d'élève : la vidéo sera un modèle. Pour tester avec un élève, ajoute d'abord les vidéos d'exemple ci-dessus.";
    } else {
      forStudent.checked = true;
    }
    const syncStudentField = () => { $("champ-eleve").hidden = !forStudent.checked; $("champ-joueur").hidden = !forPlayer.checked; };
    radios.forEach((r) => r.addEventListener("change", syncStudentField));
    syncStudentField();
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
      const destination = isCoach ? form.elements.destinataire.value : "eleve";
      const coachForStudent = isCoach && destination === "eleve" && form.elements.eleve.value;
      const squadPlayer = isCoach && destination === "joueur" ? CC.comp.player(form.elements.joueur.value) : null;
      if (isCoach && destination === "joueur" && !squadPlayer) { fail("Choisis un jeune du Centre de compétition jeunes."); return; }
      if (squadPlayer && !squadPlayer.autorisation) {
        status.className = "status-line is-error";
        status.replaceChildren("L'autorisation des parents n'est pas enregistrée pour " + squadPlayer.prenom + " (droit à l'image). ", h("a", { href: "joueur.html?id=" + squadPlayer.id + "#profil" }, "L'enregistrer dans son dossier"));
        button.disabled = false;
        return;
      }
      const fileId = await CC.putFile(file);
      // Coach : la vidéo est celle d'un élève (à analyser) ou un modèle de référence
      const video = squadPlayer ? {
        id: CC.uid(), fileId, owner: "coach", playerId: squadPlayer.id, studentId: null,
        title: form.elements.titre.value.trim() || file.name.replace(/\.[^.]+$/, ""),
        shot: form.elements.coup.value, question: "", date: new Date().toISOString(), size: file.size, status: "suivi", seen: true,
      } : {
        id: CC.uid(),
        fileId,
        owner: isCoach && !coachForStudent ? "coach" : "eleve",
        studentId: isCoach ? (coachForStudent ? form.elements.eleve.value : null) : me,
        title: form.elements.titre.value.trim() || file.name.replace(/\.[^.]+$/, ""),
        shot: form.elements.coup.value,
        question: isCoach ? "" : form.elements.question.value.trim(),
        date: new Date().toISOString(),
        size: file.size,
        status: isCoach && !coachForStudent ? "reference" : "attente",
        seen: Boolean(coachForStudent), // le coach vient de l'ajouter : ce n'est pas une « nouvelle vidéo » à découvrir
      };
      CC.saveVideos([...CC.videos(), video]);
      if (!isCoach) {
        CC.addMessage(video.id, {
          from: "eleve",
          text: "Voici ma vidéo (" + (CC.SHOTS[video.shot] || "coup") + ")." + (video.question ? "\n" + video.question : ""),
        });
      } else if (coachForStudent) {
        CC.addMessage(video.id, { from: "coach", text: "Vidéo ajoutée par ton coach (" + (CC.SHOTS[video.shot] || "coup") + ")." });
      }
      form.reset();
      if (isCoach) {
        // form.reset() remet le choix « élève / modèle » comme au départ
        const wantStudent = CC.students().length > 0;
        form.elements.destinataire.value = destination === "joueur" ? "joueur" : wantStudent ? "eleve" : "reference";
        $("champ-eleve").hidden = form.elements.destinataire.value !== "eleve";
        $("champ-joueur").hidden = form.elements.destinataire.value !== "joueur";
        if (squadPlayer) form.elements.joueur.value = squadPlayer.id;
      }
      preview.hidden = true;
      status.className = "status-line is-ok";
      status.textContent = isCoach
        ? (coachForStudent ? "Vidéo ajoutée au dossier de l'élève ✓ Tu peux l'analyser." : squadPlayer ? "Vidéo ajoutée au dossier de " + squadPlayer.prenom + " ✓ Tu peux l'analyser." : "Vidéo de référence ajoutée ✓")
        : "Vidéo envoyée ✓ Ton coach va l'analyser.";
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
    ? [["toutes", "Toutes"], ["attente", "À analyser"], ["analysee", "Analysées"], ["reference", "Références"], ["joueurs", "Centre de compétition jeunes"]]
    : [];

  function visibleVideos() {
    let list = CC.videos();
    if (!isCoach) list = list.filter((v) => v.owner === "eleve" && v.studentId === me);
    if (filter === "joueurs") list = list.filter((v) => v.playerId);
    else if (filter !== "toutes") list = list.filter((v) => v.status === filter && !v.playerId);
    return list.slice().reverse();
  }

  function card(v) {
    const thumb = h("video", { muted: true, playsinline: true, preload: "metadata", "aria-hidden": "true", tabindex: "-1" });
    CC.fileURL(v.fileId).then((url) => { if (url) thumb.src = url + "#t=0.3"; });
    const squad = v.playerId ? CC.comp.player(v.playerId) : null;
    const badge = squad ? h("span", { class: "badge badge--new" }, "Centre de compétition jeunes")
      : v.status === "reference" ? h("span", { class: "badge badge--ref" }, "Référence")
      : v.status === "analysee" ? h("span", { class: "badge badge--ok" }, "Analysée")
      : h("span", { class: "badge badge--wait" }, "En attente");

    const actions = [];
    if (isCoach && squad) {
      actions.push(h("a", { class: "btn btn--small btn--clay", href: "joueur.html?id=" + squad.id + "#videos" }, "Dossier du joueur"));
      actions.push(h("a", { class: "btn btn--small btn--outline", href: "analyse.html?id=" + v.id }, "Analyser"));
    } else if (isCoach && v.status !== "reference") {
      actions.push(h("a", { class: "btn btn--small btn--clay", href: "eleve.html?id=" + v.studentId + "&video=" + v.id }, "Ouvrir le dossier"));
      actions.push(h("a", { class: "btn btn--small btn--outline", href: "analyse.html?id=" + v.id }, v.status === "analysee" ? "Reprendre l'analyse" : "Analyser"));
    }
    if (isCoach && v.status === "reference") {
      actions.push(h("a", { class: "btn btn--small btn--clay", href: "analyse.html?id=" + v.id }, "Analyser"));
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
        h("h3", {}, isCoach && squad ? CC.comp.fullName(squad) + " — " + v.title : isCoach && v.studentId ? CC.studentName(v.studentId) + " — " + v.title : v.title),
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

  // Espace utilisé : pratique si le navigateur refuse d'enregistrer de nouveaux fichiers
  CC.storageInfo().then((info) => {
    const total = CC.videos().filter((v) => isCoach || (v.owner === "eleve" && v.studentId === me)).reduce((sum, v) => sum + (v.size || 0), 0);
    const parts = ["Tes vidéos pèsent " + CC.fmtSize(total)];
    if (info.quota) parts.push("le navigateur t'accorde environ " + CC.fmtSize(info.quota) + " (déjà utilisé : " + CC.fmtSize(info.usage) + ")");
    $("espace-stockage").textContent = parts.join(" · ") + ".";
  });
})();

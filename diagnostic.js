// Test de fonctionnement : refait chaque étape d'une capture d'image et dit laquelle pose problème.
(() => {
  const { h } = CC;
  const $ = (id) => document.getElementById(id);
  const TEST_KEY = "diagnostic.essai";
  const withTimeout = (promise, ms, label) => Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error(label + " : pas de réponse après " + ms / 1000 + " s")), ms)),
  ]);

  const results = [];
  let failedAt = null;

  function addStep(title) {
    const status = h("span", { class: "badge badge--wait" }, "En cours…");
    const detail = h("small", {}, "");
    const item = h("li", { class: "list__item" },
      h("div", { class: "list__main" }, h("strong", {}, title), detail), status);
    $("etapes").append(item);
    return {
      ok(text) { status.className = "badge badge--ok"; status.textContent = "OK"; detail.textContent = text || ""; results.push("OK    " + title + (text ? " — " + text : "")); },
      info(text) { status.className = "badge"; status.textContent = "Info"; detail.textContent = text || ""; results.push("INFO  " + title + (text ? " — " + text : "")); },
      fail(text) { status.className = "badge badge--no"; status.textContent = "Problème"; detail.textContent = text || ""; results.push("ÉCHEC " + title + (text ? " — " + text : "")); if (!failedAt) failedAt = title; },
    };
  }

  // Exécute une étape : en cas d'erreur, on note le problème et on continue
  async function step(title, action) {
    const s = addStep(title);
    try {
      const text = await action();
      s.ok(typeof text === "string" ? text : "");
      return true;
    } catch (e) {
      s.fail((e && e.name ? e.name + " : " : "") + (e && e.message ? e.message : String(e)));
      return false;
    }
  }

  const decode = (url) => new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve([img.naturalWidth, img.naturalHeight]);
    img.onerror = () => reject(new Error("l'image n'a pas pu être affichée"));
    img.src = url;
  });
  const toBlob = (canvas) => new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("le navigateur n'a pas créé l'image"))), "image/png"));

  async function run() {
    $("lancer").disabled = true;
    $("etapes").replaceChildren();
    $("verdict").hidden = true;
    $("resultat").hidden = true;
    $("copie").hidden = true;
    results.length = 0;
    failedAt = null;
    const createdFiles = [];

    // 1. Le navigateur
    const info = addStep("Ton navigateur");
    const wide = matchMedia("(min-width: 1100px)").matches;
    info.info([
      "version " + CC.VERSION,
      navigator.userAgent,
      "fenêtre " + innerWidth + " × " + innerHeight + " px",
      "zoom/densité " + (window.devicePixelRatio || 1),
      wide ? "mise en page à deux colonnes (vidéo + « Mon analyse » côte à côte)" : "mise en page sur une colonne (« Mon analyse » sous la vidéo)",
    ].join(" · "));

    // 2. Mémoire simple
    await step("Mémoire simple du navigateur (localStorage)", async () => {
      localStorage.setItem("courtcoach." + TEST_KEY, JSON.stringify({ a: 1 }));
      const back = JSON.parse(localStorage.getItem("courtcoach." + TEST_KEY));
      localStorage.removeItem("courtcoach." + TEST_KEY);
      if (!back || back.a !== 1) throw new Error("la valeur relue est différente");
      return "écriture et lecture possibles";
    });

    // 3. Base de données des fichiers
    let canStore = await step("Base de données des images (IndexedDB) : enregistrer puis relire une image", async () => {
      const c = document.createElement("canvas"); c.width = 40; c.height = 30;
      const x = c.getContext("2d"); x.fillStyle = "#b8471f"; x.fillRect(0, 0, 40, 30);
      const blob = await toBlob(c);
      const id = await withTimeout(CC.putFile(blob), 8000, "enregistrement");
      createdFiles.push(id);
      const back = await withTimeout(CC.getFile(id), 8000, "lecture");
      if (!back || !back.size) throw new Error("l'image relue est vide ou absente");
      const url = URL.createObjectURL(back);
      const size = await decode(url);
      URL.revokeObjectURL(url);
      return "image de " + size[0] + "×" + size[1] + " px enregistrée, relue et affichée";
    });

    // 4. La vidéo d'exemple
    let blob = null;
    await step("Chargement de la vidéo d'exemple", async () => {
      const response = await withTimeout(fetch("demo/exemple-eleve.webm"), 15000, "téléchargement");
      if (!response.ok) throw new Error("vidéo introuvable (code " + response.status + ")");
      blob = await response.blob();
      return CC.fmtSize(blob.size);
    });

    // 5. Lecture + capture
    let video = null;
    if (blob) {
      await step("Lecture de la vidéo", async () => {
        video = document.createElement("video");
        video.muted = true; video.playsInline = true; video.preload = "auto";
        const url = URL.createObjectURL(blob);
        video.src = url;
        await withTimeout(new Promise((resolve, reject) => {
          video.onloadeddata = resolve;
          video.onerror = () => reject(new Error("ce navigateur ne sait pas lire cette vidéo"));
        }), 15000, "chargement de la vidéo");
        return video.videoWidth + "×" + video.videoHeight + " px, " + video.duration.toFixed(1) + " s";
      });
    }

    let captureBlob = null;
    if (video) {
      await step("Se placer sur une image précise de la vidéo (1,4 s)", async () => {
        video.currentTime = 1.4;
        await withTimeout(new Promise((resolve) => { video.onseeked = resolve; }), 8000, "positionnement");
        return "position " + video.currentTime.toFixed(2) + " s";
      });
      await step("Photographier l'image de la vidéo (comme le bouton « Capturer »)", async () => {
        const c = document.createElement("canvas");
        c.width = video.videoWidth; c.height = video.videoHeight;
        const x = c.getContext("2d");
        x.drawImage(video, 0, 0);
        x.strokeStyle = "#dcf247"; x.lineWidth = 6; x.beginPath(); x.moveTo(60, 200); x.lineTo(400, 200); x.stroke(); // un trait, comme un dessin du coach
        const data = x.getImageData(0, 0, c.width, c.height).data;
        let sum = 0; for (let i = 0; i < data.length; i += 400) sum += data[i] + data[i + 1] + data[i + 2];
        if (sum === 0) throw new Error("l'image obtenue est entièrement noire");
        captureBlob = await toBlob(c);
        return "image " + c.width + "×" + c.height + " px, " + CC.fmtSize(captureBlob.size);
      });
    }

    // 6. Enregistrement + affichage de la capture
    if (captureBlob) {
      await step("Enregistrer la capture dans l'analyse", async () => {
        const id = await withTimeout(CC.putFile(captureBlob), 8000, "enregistrement");
        createdFiles.push(id);
        return "enregistrée";
      });
      await step("Retrouver et afficher la capture", async () => {
        const id = createdFiles[createdFiles.length - 1];
        const url = await withTimeout(CC.fileURL(id), 8000, "lecture");
        if (!url) throw new Error("la capture n'a pas été retrouvée");
        const size = await decode(url);
        $("apercu").replaceChildren(h("img", { src: url, alt: "Image capturée par le test", style: "width:100%; border-radius:12px; border:1px solid var(--line)" }));
        $("resultat").hidden = false;
        return "affichée (" + size[0] + "×" + size[1] + " px)";
      });
    }

    // Ménage : on supprime les fichiers de test
    for (const id of createdFiles) { try { await CC.deleteFile(id); } catch (e) { /* rien */ } }

    // Verdict
    const verdict = $("verdict");
    verdict.hidden = false;
    if (failedAt) {
      verdict.style.background = "#fdecea"; verdict.style.borderLeftColor = "#b3261e";
      verdict.replaceChildren(h("strong", {}, "Un problème a été trouvé à l'étape « " + failedAt + " »."), " Copie le résultat ci-dessous et envoie-le moi : je saurai quoi corriger.");
    } else {
      verdict.style.background = "#dff3e6"; verdict.style.borderLeftColor = "#1f6b3a";
      verdict.replaceChildren(h("strong", {}, "Tout fonctionne dans ton navigateur ✓"), " La capture, l'enregistrement et l'affichage de l'image marchent. Si l'image n'apparaît pas dans l'application, dis-moi précisément ce que tu vois : la page, la taille de ta fenêtre, et si un message s'affiche.");
    }
    $("texte").value = "CourtCoach — test de fonctionnement (version " + CC.VERSION + ")\n" + new Date().toLocaleString("fr-FR") + "\n\n" + results.join("\n");
    $("copie").hidden = false;
    $("lancer").disabled = false;
    $("lancer").textContent = "Relancer le test";
    verdict.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  $("lancer").addEventListener("click", run);
  $("copier").addEventListener("click", async () => {
    const status = $("copie-status");
    try {
      await navigator.clipboard.writeText($("texte").value);
      status.className = "status-line is-ok"; status.textContent = "Copié ✓ Colle-le maintenant dans ta réponse.";
    } catch (e) {
      $("texte").select();
      status.className = "status-line"; status.textContent = "Le texte est sélectionné : fais Ctrl + C (ou « Copier » sur ton téléphone).";
    }
  });
})();

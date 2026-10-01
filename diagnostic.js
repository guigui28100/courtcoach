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
      warn(text) { status.className = "badge badge--wait"; status.textContent = "Bloqué"; detail.textContent = text || ""; results.push("BLOQUÉ " + title + (text ? " — " + text : "")); },
      fail(text) { status.className = "badge badge--no"; status.textContent = "Problème"; detail.textContent = text || ""; results.push("ÉCHEC " + title + (text ? " — " + text : "")); if (!failedAt) failedAt = title; },
    };
  }

  // Exécute une étape : en cas d'erreur, on note le problème et on continue.
  // « soft » : l'application n'en dépend plus, l'échec est seulement signalé (« Bloqué »).
  async function step(title, action, soft) {
    const s = addStep(title);
    try {
      const text = await action();
      s.ok(typeof text === "string" ? text : "");
      return true;
    } catch (e) {
      const msg = (e && e.name ? e.name + " : " : "") + (e && e.message ? e.message : String(e));
      if (soft) s.warn(msg + " — sans conséquence : l'application n'utilise plus cette méthode pour les captures.");
      else s.fail(msg);
      return false;
    }
  }

  const decode = (url, ms) => withTimeout(new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve([img.naturalWidth, img.naturalHeight]);
    img.onerror = () => reject(new Error("l'image n'a pas pu être affichée"));
    img.src = url;
  }), ms || 6000, "affichage de l'image");

  async function run() {
    $("lancer").disabled = true;
    $("etapes").replaceChildren();
    $("verdict").hidden = true;
    $("resultat").hidden = true;
    $("copie").hidden = true;
    results.length = 0;
    failedAt = null;
    const createdIds = [];

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

    // 3. Espace de stockage
    await step("Espace de stockage accordé par le navigateur à ce site", async () => {
      const info2 = await CC.storageInfo();
      if (info2.quota === null) return "le navigateur ne donne pas cette information · tes vidéos pèsent " + CC.fmtSize(info2.videosSize);
      const pct = info2.quota ? Math.round((info2.usage / info2.quota) * 100) : 0;
      const text = "utilisé " + CC.fmtSize(info2.usage) + " sur " + CC.fmtSize(info2.quota) + " (" + pct + " %) · tes vidéos pèsent " + CC.fmtSize(info2.videosSize);
      if (info2.quota < 150e6 || pct > 85) throw new Error("espace presque plein ou très limité (navigation privée ?) — " + text);
      return text;
    }, true);

    // 4. La méthode utilisée par l'application : l'image sous forme de TEXTE
    await step("Grande mémoire (IndexedDB) : garder puis relire un TEXTE", async () => {
      const id = await withTimeout(CC.putTextIDB("texte d'essai"), 10000, "enregistrement du texte");
      createdIds.push(id);
      return "texte enregistré dans la grande mémoire";
    }, true);

    // 5. Méthodes « fichier » (blob) : seulement pour information
    await step("Grande mémoire : garder un FICHIER (comme les vidéos)", async () => {
      const c = document.createElement("canvas"); c.width = 40; c.height = 30;
      const x = c.getContext("2d"); x.fillStyle = "#b8471f"; x.fillRect(0, 0, 40, 30);
      const blob = await withTimeout(new Promise((resolve, reject) => c.toBlob((b) => (b ? resolve(b) : reject(new Error("le navigateur n'a pas créé le fichier"))), "image/png")), 5000, "création du fichier");
      const id = await withTimeout(CC.putFileIDB(blob), 10000, "enregistrement du fichier");
      createdIds.push(id);
      const back = await withTimeout(CC.getFile(id), 8000, "lecture du fichier");
      if (!back || !back.size) throw new Error("le fichier relu est vide ou absent");
      return "fichier enregistré et relu";
    }, true);
    await step("Afficher une image à partir d'une adresse « blob: »", async () => {
      const c = document.createElement("canvas"); c.width = 20; c.height = 20;
      const blob = await withTimeout(new Promise((resolve, reject) => c.toBlob((b) => (b ? resolve(b) : reject(new Error("pas de fichier"))), "image/png")), 5000, "création du fichier");
      const url = URL.createObjectURL(blob);
      try { await decode(url, 5000); } finally { URL.revokeObjectURL(url); }
      return "affichage possible";
    }, true);

    // 6. La vidéo d'exemple
    let blob = null;
    await step("Chargement de la vidéo d'exemple", async () => {
      const response = await withTimeout(fetch("demo/exemple-eleve.webm"), 15000, "téléchargement");
      if (!response.ok) throw new Error("vidéo introuvable (code " + response.status + ")");
      blob = await response.blob();
      return CC.fmtSize(blob.size);
    });

    let video = null;
    if (blob) {
      await step("Lecture de la vidéo", async () => {
        video = document.createElement("video");
        video.muted = true; video.playsInline = true; video.preload = "auto";
        video.src = URL.createObjectURL(blob);
        await withTimeout(new Promise((resolve, reject) => {
          video.onloadeddata = resolve;
          video.onerror = () => reject(new Error("ce navigateur ne sait pas lire cette vidéo"));
        }), 15000, "chargement de la vidéo");
        return video.videoWidth + "×" + video.videoHeight + " px, " + video.duration.toFixed(1) + " s";
      });
    }

    // 7. La capture, exactement comme l'application
    let dataUrl = null;
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
        dataUrl = c.toDataURL("image/jpeg", 0.92);
        return "image " + c.width + "×" + c.height + " px, " + Math.round(dataUrl.length / 1000) + " Ko";
      });
    }

    if (dataUrl) {
      await step("Afficher l'image photographiée (affichage immédiat)", async () => {
        const size = await decode(dataUrl, 6000);
        $("apercu").replaceChildren(h("img", { src: dataUrl, alt: "Image capturée par le test", style: "width:100%; border-radius:12px; border:1px solid var(--line)" }));
        $("resultat").hidden = false;
        return "affichée (" + size[0] + "×" + size[1] + " px)";
      });
      let savedId = null;
      await step("Sauvegarder l'image (comme le fait l'application)", async () => {
        savedId = await withTimeout(CC.persistImage(dataUrl), 20000, "sauvegarde");
        createdIds.push(savedId);
        return savedId.indexOf("ls:") === 0
          ? "sauvegardée en MODE DE SECOURS (la grande mémoire a refusé : " + CC.describeError(CC.lastStoreError()) + ")"
          : "sauvegardée dans la grande mémoire";
      });
      if (savedId) {
        await step("Retrouver l'image sauvegardée", async () => {
          const url = await withTimeout(CC.fileURL(savedId), 8000, "lecture");
          if (!url) throw new Error("l'image sauvegardée n'a pas été retrouvée");
          const size = await decode(url, 6000);
          return "retrouvée et affichée (" + size[0] + "×" + size[1] + " px)";
        });
      }
    }

    // Ménage : on supprime les éléments de test
    for (const id of createdIds) { try { await withTimeout(CC.deleteFile(id), 4000, "ménage"); } catch (e) { /* rien */ } }

    // Verdict
    const verdict = $("verdict");
    verdict.hidden = false;
    if (failedAt) {
      verdict.style.background = "#fdecea"; verdict.style.borderLeftColor = "#b3261e";
      verdict.replaceChildren(h("strong", {}, "Un problème a été trouvé à l'étape « " + failedAt + " »."), " Copie le résultat ci-dessous et envoie-le moi : je saurai quoi corriger.");
    } else {
      verdict.style.background = "#dff3e6"; verdict.style.borderLeftColor = "#1f6b3a";
      verdict.replaceChildren(h("strong", {}, "La capture fonctionne dans ton navigateur ✓"), " Les étapes marquées « Bloqué » ne gênent plus l'application. Si une image n'apparaît pas dans l'application, dis-moi précisément ce que tu vois.");
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

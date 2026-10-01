/* =========================================================
   CourtCoach – mini « base de données » dans le navigateur.
   VERSION DE DÉMONSTRATION : tout reste sur l'appareil de la personne
   (aucun envoi sur Internet). Les textes sont dans localStorage,
   les vidéos et photos dans IndexedDB.
   ========================================================= */
const CC = (() => {
  const PREFIX = "courtcoach.";

  // ---------- Petits outils ----------
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

  function read(key, fallback) {
    try {
      const raw = localStorage.getItem(PREFIX + key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) {
      return fallback;
    }
  }
  function write(key, value) {
    try {
      localStorage.setItem(PREFIX + key, JSON.stringify(value));
      return true;
    } catch (e) {
      return false;
    }
  }
  function remove(key) {
    try { localStorage.removeItem(PREFIX + key); } catch (e) { /* rien */ }
  }

  const PRIVACY_VERSION = "2026-10";

  // Remplace le contenu d'un élément (les valeurs vides sont ignorées, contrairement à replaceChildren).
  function fill(el, ...kids) {
    el.replaceChildren(...kids.flat().filter((k) => k != null && k !== false));
    return el;
  }

  // Crée un élément HTML sans jamais interpréter le texte comme du code (plus sûr).
  function h(tag, attrs, ...kids) {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (v == null || v === false) continue;
      if (k === "class") el.className = v;
      else if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
      else el.setAttribute(k, v === true ? "" : v);
    }
    for (const kid of kids.flat()) {
      if (kid == null || kid === false) continue;
      el.append(kid.nodeType ? kid : document.createTextNode(kid));
    }
    return el;
  }

  const fmtDate = (iso) =>
    new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
  const fmtDateTime = (iso) =>
    new Date(iso).toLocaleString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
  const fmtSize = (bytes) =>
    bytes > 1e6 ? (bytes / 1e6).toFixed(1).replace(".", ",") + " Mo" : Math.round(bytes / 1e3) + " Ko";

  // ---------- Fichiers (vidéos, photos) dans IndexedDB ----------
  let dbPromise;
  function openDb() {
    if (!dbPromise) {
      dbPromise = new Promise((resolve, reject) => {
        const req = indexedDB.open("courtcoach", 1);
        req.onupgradeneeded = () => req.result.createObjectStore("files");
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
    }
    return dbPromise;
  }
  async function run(mode, action) {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const t = db.transaction("files", mode);
      const req = action(t.objectStore("files"));
      t.oncomplete = () => resolve(req && req.result);
      t.onerror = () => reject(t.error);
      t.onabort = () => reject(t.error);
    });
  }
  const withTimeout = (promise, ms) => Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error("pas de réponse après " + ms / 1000 + " s")), ms)),
  ]);
  const describeError = (e) => (e && e.name ? e.name : "Erreur") + (e && e.message ? " : " + e.message : "");

  // Écriture « normale » dans la grande mémoire du navigateur (IndexedDB)
  async function putFileIDB(blob) {
    const id = uid();
    await withTimeout(run("readwrite", (s) => s.put(blob, id)), 10000);
    return id;
  }

  // Mode de secours : si la grande mémoire refuse (pleine, limitée, navigation privée…), les IMAGES
  // (captures, photos) sont gardées en JPEG dans la mémoire simple du navigateur (localStorage).
  const SPARE_PREFIX = "file.";
  const isSpareId = (id) => typeof id === "string" && id.indexOf("ls:") === 0;
  async function imageToJpegDataUrl(blob) {
    const url = URL.createObjectURL(blob);
    try {
      const img = await new Promise((resolve, reject) => {
        const i = new Image();
        i.onload = () => resolve(i);
        i.onerror = () => reject(new Error("image illisible"));
        i.src = url;
      });
      const scale = Math.min(1, 1000 / img.naturalWidth);
      const c = document.createElement("canvas");
      c.width = Math.max(1, Math.round(img.naturalWidth * scale));
      c.height = Math.max(1, Math.round(img.naturalHeight * scale));
      c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
      return c.toDataURL("image/jpeg", 0.88);
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  let lastStoreError = null;
  async function putFile(blob) {
    try {
      return await putFileIDB(blob);
    } catch (error) {
      lastStoreError = error;
      const isImage = blob.type && blob.type.indexOf("image/") === 0;
      if (!isImage || blob.size > 8e6) throw error;
      let dataUrl;
      try { dataUrl = await withTimeout(imageToJpegDataUrl(blob), 5000); } catch (e) { throw error; }
      const spareId = "ls:" + uid();
      if (!write(SPARE_PREFIX + spareId, dataUrl)) throw error; // la mémoire de secours est pleine aussi
      return spareId;
    }
  }

  // ---------- Images sous forme de TEXTE (data URL) ----------
  // Les captures n'utilisent plus de « fichiers » (blob) : certains navigateurs les bloquent.
  //  mem:  affichée tout de suite, gardée seulement tant que la page est ouverte
  //  im:   enregistrée dans la grande mémoire (IndexedDB), sous forme de texte
  //  ls:   enregistrée dans la mémoire simple (localStorage) si la grande mémoire refuse
  const memImages = new Map();
  const isImageId = (id) => typeof id === "string" && /^(mem|im|ls):/.test(id);
  const memoryImage = (dataUrl) => { const id = "mem:" + uid(); memImages.set(id, dataUrl); return id; };
  const forgetMemoryImage = (id) => { memImages.delete(id); urlCache.delete(id); };
  const cacheImage = (id, dataUrl) => urlCache.set(id, dataUrl);

  async function persistImage(dataUrl) {
    const id = "im:" + uid();
    try {
      await withTimeout(run("readwrite", (s) => s.put(dataUrl, id)), 8000);
      return id;
    } catch (error) {
      lastStoreError = error;
      const spareId = "ls:" + uid();
      if (dataUrl.length < 4e6 && write(SPARE_PREFIX + spareId, dataUrl)) return spareId;
      throw error;
    }
  }

  // (Pour le test de fonctionnement) enregistre un petit texte dans la grande mémoire, sans repli
  async function putTextIDB(text) {
    const id = "im:" + uid();
    await withTimeout(run("readwrite", (s) => s.put(text, id)), 8000);
    return id;
  }

  async function imageData(id) {
    if (urlCache.has(id)) return urlCache.get(id);
    let data = null;
    if (id.indexOf("mem:") === 0) data = memImages.get(id) || null;
    else if (id.indexOf("ls:") === 0) data = read(SPARE_PREFIX + id, null);
    else data = (await withTimeout(run("readonly", (s) => s.get(id)), 8000).catch(() => null)) || null;
    if (data) urlCache.set(id, data);
    return data;
  }

  async function getFile(id) {
    if (isImageId(id)) {
      const data = await imageData(id);
      return data ? (await fetch(data)).blob() : undefined;
    }
    if (isSpareId(id)) {
      const dataUrl = read(SPARE_PREFIX + id, null);
      return dataUrl ? (await fetch(dataUrl)).blob() : undefined;
    }
    return run("readonly", (s) => s.get(id));
  }
  async function deleteFile(id) {
    if (isImageId(id)) {
      urlCache.delete(id);
      if (id.indexOf("mem:") === 0) { memImages.delete(id); return; }
      if (id.indexOf("ls:") === 0) { remove(SPARE_PREFIX + id); return; }
    }
    if (isSpareId(id)) { remove(SPARE_PREFIX + id); return; }
    return run("readwrite", (s) => s.delete(id));
  }

  const urlCache = new Map();
  async function fileURL(id) {
    if (isImageId(id)) return imageData(id);
    if (urlCache.has(id)) return urlCache.get(id);
    const blob = await getFile(id);
    if (!blob) return null;
    const url = URL.createObjectURL(blob);
    urlCache.set(id, url);
    return url;
  }

  // Affiche une image en grand par-dessus la page (sans ouvrir de nouvel onglet)
  function lightbox(url, alt) {
    const onKey = (e) => { if (e.key === "Escape") close(); };
    const close = () => { overlay.remove(); document.removeEventListener("keydown", onKey); };
    const overlay = h("div", { class: "lightbox", role: "dialog", "aria-modal": "true", "aria-label": alt || "Image", onclick: close },
      h("img", { src: url, alt: alt || "" }),
      h("button", { type: "button", class: "lightbox__close", "aria-label": "Fermer l'image", onclick: close }, "✕"));
    document.body.append(overlay);
    document.addEventListener("keydown", onKey);
    overlay.querySelector("button").focus();
  }

  // Espace utilisé par le navigateur pour ce site (si le navigateur sait le dire)
  async function storageInfo() {
    const info = { usage: null, quota: null, videosSize: videos().reduce((sum, v) => sum + (v.size || 0), 0) };
    try {
      if (navigator.storage && navigator.storage.estimate) {
        const est = await navigator.storage.estimate();
        info.usage = est.usage; info.quota = est.quota;
      }
    } catch (e) { /* rien */ }
    return info;
  }

  // ---------- Données ----------
  const SHOTS = {
    coup_droit: "Coup droit",
    revers: "Revers",
    service: "Service",
    retour: "Retour de service",
    volee: "Volée",
    smash: "Smash",
    autre: "Autre",
  };

  const role = () => read("role", null); // "eleve" ou "coach"
  const setRole = (r) => write("role", r);

  // ---------- Élèves (comptes) ----------
  // Chaque élève a un identifiant ; ses vidéos, demandes et messages y sont rattachés.
  const accounts = () => read("accounts", []);
  const me = () => read("me", null);

  // Anciennes données (avant les dossiers d'élèves) : on les rattache au premier élève créé
  function migrateLegacy(id) {
    const legacyProfile = read("profile", null);
    if (legacyProfile) { write("profile." + id, legacyProfile); remove("profile"); }
    saveVideos(videos().map((v) => (v.owner === "eleve" && !v.studentId ? { ...v, studentId: id } : v)));
    write("lessons", lessons().map((l) => (l.studentId ? l : { ...l, studentId: id })));
    remove("msg.general"); // l'ancienne « discussion générale » n'existe plus
  }

  // Crée (ou retrouve, grâce à l'e-mail) un compte élève et en fait l'élève courant
  function signUpStudent(email, consent, extra) {
    const list = accounts();
    const clean = String(email || "").trim().toLowerCase();
    let account = clean ? list.find((a) => a.email === clean) : null;
    if (!account) {
      account = { id: uid(), email: clean, created: new Date().toISOString(), kind: (extra && extra.kind) || "adulte" };
      if (!list.length) migrateLegacy(account.id);
      write("accounts", [...list, account]);
      if (extra && extra.prenom) saveProfile({ ...read("profile." + account.id, {}), prenom: extra.prenom }, account.id);
    }
    // Trace du consentement (politique lue ; accord d'un parent pour les moins de 15 ans)
    if (consent) {
      write("accounts", accounts().map((a) => (a.id === account.id ? { ...a, consent: { ...consent, date: new Date().toISOString(), version: PRIVACY_VERSION } } : a)));
    }
    write("me", account.id);
    return account;
  }

  // ----- Droits sur les données : télécharger (accès, portabilité) et supprimer (effacement) -----
  function exportStudentData(id) {
    const account = accounts().find((a) => a.id === id) || {};
    const myVideos = videos().filter((v) => v.studentId === id);
    const out = {
      exporte_le: new Date().toISOString(),
      compte: { email: account.email || "", cree_le: account.created || "", consentement: account.consent || null },
      profil: read("profile." + id, {}),
      videos: myVideos.map((v) => ({ titre: v.title, coup: v.shot, date: v.date, question: v.question || "", statut: v.status })),
      messages: Object.fromEntries(myVideos.map((v) => [v.title, messages(v.id)])),
      cours: lessons().filter((l) => l.studentId === id),
    };
    const p = read("comp.players", []).find((x) => x.accountId === id);
    if (p) {
      // Suivi du Centre de compétition jeunes : tout sauf les notes privées du coach
      const { notes, ...visible } = p;
      out.suivi_competition = {
        fiche: visible,
        objectifs: Object.keys(localStorage).filter((k) => k.indexOf(PREFIX + "comp.goals." + p.id + ".") === 0).map((k) => ({ saison: k.split(".").pop(), objectifs: JSON.parse(localStorage.getItem(k) || "[]") })),
        evaluations: read("comp.evals." + p.id, {}),
        matchs: read("comp.matches." + p.id, []),
        analyses: read("comp.analyses." + p.id, []),
      };
    }
    return out;
  }

  async function deleteStudent(id) {
    for (const v of videos().filter((x) => x.studentId === id)) await removeVideo(v.id);
    write("lessons", lessons().filter((l) => l.studentId !== id));
    remove("profile." + id);
    // La fiche du Centre de compétition jeunes reste au coach, mais n'est plus reliée au compte supprimé
    const players = read("comp.players", []);
    if (players.some((p) => p.accountId === id)) write("comp.players", players.map((p) => (p.accountId === id ? { ...p, accountId: null } : p)));
    write("accounts", accounts().filter((a) => a.id !== id));
    if (me() === id) remove("me");
  }

  // Élève courant ; en démonstration, on en crée un automatiquement si besoin
  function ensureMe() {
    const id = me();
    if (id && accounts().some((a) => a.id === id)) return id;
    const first = accounts()[0];
    if (first) { write("me", first.id); return first.id; }
    const demo = exampleAccount();
    write("me", demo.id);
    return demo.id;
  }

  // Élève fictif « Alex Exemple » : sert aux vidéos d'exemple (aucune vraie personne)
  function exampleAccount() {
    const list = accounts();
    let account = list.find((a) => a.example);
    if (!account) {
      account = { id: uid(), email: "alex.exemple@exemple.invalid", example: true, created: new Date().toISOString() };
      if (!list.length) migrateLegacy(account.id);
      write("accounts", [...list, account]);
    }
    return account;
  }

  const profile = (id) => read("profile." + (id || ensureMe()), {});
  const saveProfile = (p, id) => write("profile." + (id || ensureMe()), p);

  const students = () => accounts();
  function studentName(id) {
    const p = read("profile." + id, {});
    const full = [p.prenom, p.nom].filter(Boolean).join(" ").trim();
    if (full) return full;
    const a = accounts().find((x) => x.id === id);
    return a && a.email ? a.email.split("@")[0] : "Élève (profil à compléter)";
  }
  function ageOf(dateStr) {
    if (!dateStr) return null;
    const d = new Date(dateStr);
    if (isNaN(d)) return null;
    const now = new Date();
    let a = now.getFullYear() - d.getFullYear();
    if (now < new Date(now.getFullYear(), d.getMonth(), d.getDate())) a -= 1;
    return a;
  }

  // Champs du profil pris en compte pour la jauge « profil complété »
  const PROFILE_KEYS = ["prenom", "nom", "naissance", "email", "telephone", "ville",
    "lateralite", "revers", "classement", "annees", "frequence", "objectifs"];
  function profileCompletion(id) {
    const p = profile(id);
    const filled = PROFILE_KEYS.filter((k) => p[k] !== undefined && String(p[k]).trim() !== "").length;
    return Math.round((filled / PROFILE_KEYS.length) * 100);
  }

  // Les rubriques de la fiche, pour l'affichage en lecture seule (dossier de l'élève)
  const PROFILE_SECTIONS = [
    ["État civil", [["prenom", "Prénom"], ["nom", "Nom"], ["naissance", "Naissance"], ["sexe", "Sexe"], ["email", "E-mail"], ["telephone", "Téléphone"], ["ville", "Ville"]]],
    ["Responsable légal", [["parent_nom", "Nom"], ["parent_tel", "Téléphone"], ["parent_email", "E-mail"]]],
    ["Tennis", [["lateralite", "Main"], ["revers", "Revers"], ["classement", "Classement"], ["licence", "Licence FFT"], ["annees", "Années de pratique"], ["frequence", "Séances / semaine"], ["club", "Club"], ["surface", "Surface préférée"], ["materiel", "Matériel"], ["taille", "Taille (cm)"]]],
    ["Santé et objectifs", [["sante", "Santé"], ["objectifs", "Objectifs"], ["dispos", "Disponibilités"]]],
  ];

  const videos = () => read("videos", []);
  const saveVideos = (list) => write("videos", list);
  const videoById = (id) => videos().find((v) => v.id === id);
  function updateVideo(id, changes) {
    const list = videos().map((v) => (v.id === id ? { ...v, ...changes } : v));
    saveVideos(list);
  }
  async function removeVideo(id) {
    const v = videoById(id);
    if (!v) return;
    saveVideos(videos().filter((x) => x.id !== id));
    // Le fichier n'est supprimé que si aucune autre vidéo ne l'utilise (les vidéos d'exemple partagent leurs fichiers)
    if (!videos().some((x) => x.fileId === v.fileId)) {
      try { await deleteFile(v.fileId); } catch (e) { /* rien */ }
    }
    remove("msg." + id);
    remove("ann." + id);
    remove("draft." + id);
  }

  const messages = (threadId) => read("msg." + threadId, []);
  function addMessage(threadId, msg) {
    const list = messages(threadId);
    const full = { id: uid(), date: new Date().toISOString(), ...msg };
    list.push(full);
    write("msg." + threadId, list);
    return full;
  }

  // La discussion n'existe que rattachée à une vidéo, et seulement une fois l'analyse du coach envoyée
  const isDiscussionOpen = (videoId) => messages(videoId).some((m) => m.from === "coach" && m.analysis);
  // Vrai si, depuis la dernière analyse, le dernier mot est celui de l'élève (le coach doit répondre)
  function awaitingCoach(videoId) {
    const list = messages(videoId);
    const lastAnalysis = list.map((m) => !!m.analysis).lastIndexOf(true);
    return lastAnalysis >= 0 && list.length - 1 > lastAnalysis && list[list.length - 1].from === "eleve";
  }

  // ---------- Vidéos d'exemple pour tester ----------
  // Ajoute une vidéo « envoyée par l'élève » (à analyser) et une vidéo de référence « modèle » du coach.
  // Les fichiers sont dans le dossier demo/. Renvoie le nombre de vidéos ajoutées.
  async function addExamples(studentId, options) {
    const opts = options || {};
    const account = accounts().find((a) => a.id === studentId);
    if (opts.fillProfile && account && account.example && !Object.keys(read("profile." + studentId, {})).length) {
      write("profile." + studentId, {
        prenom: "Alex", nom: "Exemple", naissance: "2011-06-15", lateralite: "Droitier", revers: "À deux mains",
        classement: "30/4", annees: "2", frequence: "2", club: "Tennis Club Houdan",
        objectifs: "Gagner en régularité (profil fictif, pour les tests)", parent_nom: "Parent Exemple",
      });
    }
    const jobs = [
      { flag: "eleve", url: "demo/exemple-eleve.webm", owner: "eleve", studentId, title: "Exemple — coup droit", shot: "coup_droit",
        question: "J'ai l'impression que mon bras est trop collé au corps et que je touche la balle trop tard.", status: "attente", ago: 0 },
      { flag: "modele", url: "demo/exemple-modele.webm", owner: "coach", studentId: null, title: "Exemple — coup droit modèle", shot: "coup_droit",
        question: "", status: "reference", ago: 1000 },
    ];
    let added = 0;
    for (const job of jobs) {
      const exists = videos().some((v) => v.example === job.flag && (job.flag === "modele" || v.studentId === studentId));
      if (exists) continue;
      const response = await fetch(job.url);
      if (!response.ok) throw new Error("Vidéo d'exemple introuvable : " + job.url);
      const blob = await response.blob();
      const fileId = await putFile(blob);
      saveVideos([...videos(), {
        id: uid(), fileId, owner: job.owner, studentId: job.studentId, title: job.title, shot: job.shot, question: job.question,
        date: new Date(Date.now() - job.ago).toISOString(), size: blob.size, status: job.status, example: job.flag,
      }]);
      if (job.owner === "eleve") {
        addMessage(videos().slice(-1)[0].id, { from: "eleve", text: "Voici ma vidéo (" + SHOTS[job.shot] + ").\n" + job.question });
      }
      added += 1;
    }
    return added;
  }

  const lessons = () => read("lessons", []);
  const saveLessons = (list) => write("lessons", list);

  return {
    fill, PRIVACY_VERSION, exportStudentData, deleteStudent,
    VERSION: "34",
    uid, read, write, remove, h, fmtDate, fmtDateTime, fmtSize,
    putFile, putFileIDB, isSpareId, isImageId, memoryImage, forgetMemoryImage, cacheImage, persistImage, putTextIDB, lightbox,
    getFile, deleteFile, fileURL, storageInfo, describeError, withTimeout,
    lastStoreError: () => lastStoreError,
    SHOTS, role, setRole, accounts, me, ensureMe, signUpStudent, exampleAccount, addExamples, students, studentName, ageOf,
    profile, saveProfile, profileCompletion, PROFILE_SECTIONS,
    videos, saveVideos, videoById, updateVideo, removeVideo,
    messages, addMessage, isDiscussionOpen, awaitingCoach, lessons, saveLessons,
  };
})();

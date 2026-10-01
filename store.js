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
  async function putFile(blob) {
    const id = uid();
    await run("readwrite", (s) => s.put(blob, id));
    return id;
  }
  const getFile = (id) => run("readonly", (s) => s.get(id));
  const deleteFile = (id) => run("readwrite", (s) => s.delete(id));

  const urlCache = new Map();
  async function fileURL(id) {
    if (urlCache.has(id)) return urlCache.get(id);
    const blob = await getFile(id);
    if (!blob) return null;
    const url = URL.createObjectURL(blob);
    urlCache.set(id, url);
    return url;
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
  function signUpStudent(email) {
    const list = accounts();
    const clean = String(email || "").trim().toLowerCase();
    let account = clean ? list.find((a) => a.email === clean) : null;
    if (!account) {
      account = { id: uid(), email: clean, created: new Date().toISOString() };
      if (!list.length) migrateLegacy(account.id);
      write("accounts", [...list, account]);
    }
    write("me", account.id);
    return account;
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
    try { await deleteFile(v.fileId); } catch (e) { /* rien */ }
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
    VERSION: "14",
    uid, read, write, remove, h, fmtDate, fmtDateTime, fmtSize,
    putFile, getFile, deleteFile, fileURL,
    SHOTS, role, setRole, accounts, me, ensureMe, signUpStudent, exampleAccount, addExamples, students, studentName, ageOf,
    profile, saveProfile, profileCompletion, PROFILE_SECTIONS,
    videos, saveVideos, videoById, updateVideo, removeVideo,
    messages, addMessage, isDiscussionOpen, awaitingCoach, lessons, saveLessons,
  };
})();

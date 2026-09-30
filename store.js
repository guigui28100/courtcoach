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

  const profile = () => read("profile", {});
  const saveProfile = (p) => write("profile", p);

  // Champs du profil pris en compte pour la jauge « profil complété »
  const PROFILE_KEYS = ["prenom", "nom", "naissance", "email", "telephone", "ville",
    "lateralite", "revers", "classement", "annees", "frequence", "objectifs"];
  function profileCompletion() {
    const p = profile();
    const filled = PROFILE_KEYS.filter((k) => p[k] !== undefined && String(p[k]).trim() !== "").length;
    return Math.round((filled / PROFILE_KEYS.length) * 100);
  }

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

  const lessons = () => read("lessons", []);
  const saveLessons = (list) => write("lessons", list);

  return {
    uid, read, write, remove, h, fmtDate, fmtDateTime, fmtSize,
    putFile, getFile, deleteFile, fileURL,
    SHOTS, role, setRole, profile, saveProfile, profileCompletion,
    videos, saveVideos, videoById, updateVideo, removeVideo,
    messages, addMessage, lessons, saveLessons,
  };
})();

// Page « Messages » : discussions entre l'élève et le coach (texte, photos, vidéos, analyses).
(() => {
  const role = CC.role();
  if (!role) return;
  const { h } = CC;
  const $ = (id) => document.getElementById(id);
  const isCoach = role === "coach";
  if (isCoach) $("titre-page").textContent = "Échanger avec mes élèves";

  const params = new URLSearchParams(location.search);
  let threadId = params.get("id");

  // ----- Liste des discussions -----
  function threads() {
    const list = [{ id: "general", title: "Discussion générale", sub: "Questions, demandes de cours…", video: null }];
    CC.videos().filter((v) => v.owner === "eleve").forEach((v) => {
      list.push({ id: v.id, title: v.title, sub: CC.SHOTS[v.shot] || "Coup", video: v });
    });
    list.forEach((t) => {
      const msgs = CC.messages(t.id);
      t.last = msgs.length ? msgs[msgs.length - 1] : null;
    });
    // Les plus récentes d'abord ; la discussion générale reste en haut
    return [list[0], ...list.slice(1).sort((a, b) => (b.last ? b.last.date : "").localeCompare(a.last ? a.last.date : ""))];
  }

  function renderList() {
    const nav = $("threads");
    nav.replaceChildren(...threads().map((t) =>
      h("a", { class: "thread-link", href: "messages.html?id=" + t.id, "aria-current": String(t.id === threadId) },
        h("b", {}, t.title),
        h("small", {}, t.last ? (t.last.from === role ? "Toi : " : "") + (t.last.text ? t.last.text.slice(0, 60) : t.last.analysis ? "Analyse du coach" : "Pièce jointe") : t.sub))));
  }

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
      h("h3", {}, "Analyse de ton coach"),
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
    const who = m.from === "coach" ? "Coach" : (CC.profile().prenom || "Élève");
    return h("article", { class: "bubble" + (mine ? " bubble--mine" : "") },
      h("span", { class: "bubble__who" }, mine ? "Toi (" + who + ")" : who),
      m.text ? h("p", {}, m.text) : null,
      m.analysis ? analysisCard(m.analysis) : null,
      (m.files || []).map(attachment),
      h("time", { class: "bubble__time", datetime: m.date }, CC.fmtDateTime(m.date)));
  }

  // ----- Discussion ouverte -----
  function renderThread() {
    const chat = $("chat");
    if (!threadId) { chat.dataset.view = "list"; threadId = null; }
    else chat.dataset.view = "thread";
    const t = threads().find((x) => x.id === (threadId || "general")) || threads()[0];
    if (!threadId) threadId = null;
    const id = t.id;

    $("thread-title").textContent = t.title;
    const actions = $("thread-actions");
    actions.replaceChildren();
    if (t.video) {
      if (isCoach) actions.append(h("a", { class: "btn btn--small btn--clay", href: "analyse.html?id=" + id }, "Analyser la vidéo"));
      else actions.append(h("a", { class: "btn btn--small btn--outline", href: "videos.html" }, "Mes vidéos"));
    }

    const log = $("log");
    const list = CC.messages(id);
    log.replaceChildren(...list.map(bubble));
    if (!list.length) log.append(h("p", { class: "hint" }, "Aucun message pour l'instant. Écris le premier !"));
    log.scrollTop = log.scrollHeight;
    $("composer").dataset.thread = id;
  }

  // ----- Envoi -----
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
      const id = $("composer").dataset.thread;
      CC.addMessage(id, { from: role, text, files });
      $("texte").value = "";
      pending = [];
      renderPending();
      status.textContent = "";
      renderThread();
      renderList();
    } catch (e) {
      status.className = "status-line is-error";
      status.textContent = "Envoi impossible (espace insuffisant ?).";
    }
  });

  // Ctrl + Entrée envoie le message
  $("texte").addEventListener("keydown", (e) => {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) $("composer").requestSubmit();
  });

  renderList();
  renderThread();
})();

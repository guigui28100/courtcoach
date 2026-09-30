// Studio d'analyse vidéo : dessins, angles, superposition, côte à côte, image par image.
(() => {
  const role = CC.role();
  if (!role) return;
  const { h } = CC;
  const $ = (id) => document.getElementById(id);
  const params = new URLSearchParams(location.search);
  const video = CC.videoById(params.get("id"));

  // Seul le coach analyse : l'élève est renvoyé vers sa discussion
  if (role !== "coach") {
    location.replace(video ? "messages.html?id=" + video.id : "messages.html");
    return;
  }
  if (!video) {
    $("contenu").replaceChildren(h("div", { class: "app-main" },
      h("p", { class: "empty" }, "Cette vidéo est introuvable."),
      h("p", {}, h("a", { class: "btn btn--clay", href: "videos.html" }, "Retour aux vidéos"))));
    return;
  }

  const studio = $("studio");
  const isReference = video.status === "reference";

  // =====================================================
  // 1. Les deux « volets » vidéo (A = principale, B = comparaison)
  // =====================================================
  function makePane(el, key) {
    const p = { key, el, video: el.querySelector("video"), canvas: el.querySelector("canvas"), shapes: [], draft: null, hover: null, loaded: key === "a" };
    p.ctx = p.canvas.getContext("2d");
    return p;
  }
  const panes = { a: makePane(document.querySelector(".pane--a"), "a"), b: makePane(document.querySelector(".pane--b"), "b") };
  const A = panes.a.video;
  const B = panes.b.video;
  panes.a.shapes = CC.read("ann." + video.id, []);

  $("titre-video").textContent = video.title;
  $("meta-video").textContent = (CC.SHOTS[video.shot] || "Coup") + " · " + CC.fmtDate(video.date);
  panes.a.el.querySelector(".pane__label").textContent = "A · " + video.title;

  let activePane = panes.a;
  const fps = () => Number($("fps").value) || 30;
  const mode = () => studio.dataset.mode;
  const compare = () => mode() !== "single" && panes.b.loaded;

  // =====================================================
  // 2. Dessin : formes, affichage, souris / doigt
  // =====================================================
  const COLORS = [["#dcf247", "Jaune"], ["#ff4d4d", "Rouge"], ["#3ec6ff", "Bleu"], ["#ffffff", "Blanc"], ["#36d17c", "Vert"]];
  const SVG_NS = "http://www.w3.org/2000/svg";
  const svg = (d) => {
    const s = document.createElementNS(SVG_NS, "svg");
    s.setAttribute("viewBox", "0 0 24 24");
    s.setAttribute("aria-hidden", "true");
    s.innerHTML = d;
    return s;
  };
  const TOOLS = [
    ["none", "Main", '<path d="M6 3l12 7-5.5 1.8L10 18z"/>'],
    ["pen", "Crayon", '<path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>'],
    ["line", "Trait", '<path d="M5 19L19 5"/>'],
    ["arrow", "Flèche", '<path d="M5 19L19 5M10 5h9v9"/>'],
    ["circle", "Rond", '<circle cx="12" cy="12" r="8"/>'],
    ["text", "Texte", '<path d="M5 6V4h14v2M12 4v16M9 20h6"/>'],
    ["angle", "Angle", '<path d="M4 20h16M4 20L16 6M10 20a6 6 0 0 0-1.6-4"/>'],
    ["eraser", "Gomme", '<path d="M7 21h12M5 13l7-7a2 2 0 0 1 3 0l3 3a2 2 0 0 1 0 3l-6 6H8l-3-3a2 2 0 0 1 0-2z"/>'],
  ];
  const HINTS = {
    none: "Mode lecture : tu peux faire défiler la page sans dessiner.",
    pen: "Crayon : garde le doigt ou la souris appuyé et dessine à main levée.",
    line: "Trait : appuie, glisse, relâche. Pratique pour la ligne des épaules, des hanches ou de la raquette.",
    arrow: "Flèche : appuie, glisse, relâche. Pratique pour montrer la direction d'un mouvement.",
    circle: "Rond : appuie au centre puis glisse pour choisir la taille.",
    text: "Texte : touche l'endroit voulu, écris puis valide avec Entrée.",
    angle: "Angle : touche 3 points — le bout du 1er segment, l'articulation (le sommet), puis le bout du 2e segment. Les degrés s'affichent.",
    eraser: "Gomme : touche un dessin pour l'effacer.",
  };

  const style = { tool: "line", color: COLORS[0][0], width: 4, always: false };
  const history = [];
  let redoStack = [];

  // Les tailles suivent la surface de l'image : les dessins gardent les mêmes proportions à l'écran et sur les captures
  const unitOf = (w, hh) => Math.sqrt(w * hh) / 500;
  const fontSize = (s, w, hh) => (10 + s.width * 2.5) * unitOf(w, hh);
  const visible = (s, t) => s.always || Math.abs(s.t - t) < 0.5 / fps();

  function outlinedText(ctx, text, x, y, size) {
    ctx.font = "700 " + size + 'px "Atkinson Hyperlegible", system-ui, sans-serif';
    ctx.textBaseline = "top";
    ctx.lineWidth = Math.max(3, size / 5);
    ctx.strokeStyle = "rgba(0,0,0,.8)";
    ctx.strokeText(text, x, y);
    ctx.fillText(text, x, y);
  }

  // Angle (en degrés) entre deux segments qui partent du sommet
  function angleInfo(P) {
    const a1 = Math.atan2(P[0][1] - P[1][1], P[0][0] - P[1][0]);
    const a2 = Math.atan2(P[2][1] - P[1][1], P[2][0] - P[1][0]);
    let diff = a2 - a1;
    while (diff > Math.PI) diff -= 2 * Math.PI;
    while (diff <= -Math.PI) diff += 2 * Math.PI;
    return { a1, a2, diff, deg: Math.abs(diff) * 180 / Math.PI };
  }

  function drawShape(ctx, s, w, hgt) {
    const unit = unitOf(w, hgt);
    const P = s.pts.map(([x, y]) => [x * w, y * hgt]);
    ctx.save();
    ctx.lineWidth = s.width * unit;
    ctx.strokeStyle = s.color;
    ctx.fillStyle = s.color;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    const dot = (pt, r) => { ctx.beginPath(); ctx.arc(pt[0], pt[1], r, 0, Math.PI * 2); ctx.fill(); };

    switch (s.type) {
      case "pen":
        if (P.length === 1) { dot(P[0], s.width * unit / 2); break; }
        ctx.beginPath();
        P.forEach((pt, i) => (i ? ctx.lineTo(pt[0], pt[1]) : ctx.moveTo(pt[0], pt[1])));
        ctx.stroke();
        break;
      case "line":
      case "arrow": {
        if (P.length < 2) break;
        ctx.beginPath(); ctx.moveTo(P[0][0], P[0][1]); ctx.lineTo(P[1][0], P[1][1]); ctx.stroke();
        if (s.type === "arrow") {
          const ang = Math.atan2(P[1][1] - P[0][1], P[1][0] - P[0][0]);
          const len = Math.max(14 * unit, s.width * unit * 4);
          ctx.beginPath();
          ctx.moveTo(P[1][0], P[1][1]);
          ctx.lineTo(P[1][0] - len * Math.cos(ang - 0.45), P[1][1] - len * Math.sin(ang - 0.45));
          ctx.moveTo(P[1][0], P[1][1]);
          ctx.lineTo(P[1][0] - len * Math.cos(ang + 0.45), P[1][1] - len * Math.sin(ang + 0.45));
          ctx.stroke();
        }
        break;
      }
      case "circle": {
        if (P.length < 2) break;
        const r = Math.hypot(P[1][0] - P[0][0], P[1][1] - P[0][1]);
        ctx.beginPath(); ctx.arc(P[0][0], P[0][1], r, 0, Math.PI * 2); ctx.stroke();
        dot(P[0], s.width * unit * 0.6);
        break;
      }
      case "text":
        outlinedText(ctx, s.text, P[0][0], P[0][1], fontSize(s, w, hgt));
        break;
      case "angle": {
        if (P.length >= 2) {
          ctx.beginPath(); ctx.moveTo(P[0][0], P[0][1]); ctx.lineTo(P[1][0], P[1][1]);
          if (P.length >= 3) ctx.lineTo(P[2][0], P[2][1]);
          ctx.stroke();
          P.forEach((pt) => dot(pt, s.width * unit * 1.1));
        } else dot(P[0], s.width * unit * 1.1);
        if (P.length >= 3) {
          const { a1, diff, deg } = angleInfo(P);
          const l1 = Math.hypot(P[0][0] - P[1][0], P[0][1] - P[1][1]);
          const l2 = Math.hypot(P[2][0] - P[1][0], P[2][1] - P[1][1]);
          const radius = Math.max(10, Math.min(48 * unit, 0.45 * Math.min(l1, l2)));
          ctx.beginPath(); ctx.arc(P[1][0], P[1][1], radius, a1, a1 + diff, diff < 0); ctx.stroke();
          const mid = a1 + diff / 2;
          const size = (13 + s.width * 1.8) * unit;
          const tx = P[1][0] + (radius + 10 * unit) * Math.cos(mid);
          const ty = P[1][1] + (radius + 10 * unit) * Math.sin(mid);
          ctx.textAlign = Math.cos(mid) < 0 ? "right" : "left";
          outlinedText(ctx, Math.round(deg) + "°", tx, ty - size / 2, size);
        }
        break;
      }
    }
    ctx.restore();
  }

  function sizeCanvas(p) {
    const r = p.canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const w = Math.max(1, Math.round(r.width * dpr));
    const hh = Math.max(1, Math.round(r.height * dpr));
    if (p.canvas.width !== w || p.canvas.height !== hh) { p.canvas.width = w; p.canvas.height = hh; }
  }

  function render(p) {
    if (!p.loaded) return;
    sizeCanvas(p);
    const { ctx, canvas } = p;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const t = p.video.currentTime;
    p.shapes.forEach((s) => { if (visible(s, t)) drawShape(ctx, s, canvas.width, canvas.height); });
    if (p.draft) {
      const d = p.draft.type === "angle" && p.hover ? { ...p.draft, pts: [...p.draft.pts, p.hover] } : p.draft;
      drawShape(ctx, d, canvas.width, canvas.height);
    }
  }
  const renderAll = () => { render(panes.a); render(panes.b); updateCount(); };

  function updateCount() {
    const t = activePane.video.currentTime;
    const n = activePane.shapes.filter((s) => visible(s, t)).length;
    $("btn-effacer-image").disabled = n === 0;
    $("btn-undo").disabled = history.length === 0;
    $("btn-redo").disabled = redoStack.length === 0;
  }

  function persist() { CC.write("ann." + video.id, panes.a.shapes); }

  function addShape(p, shape) {
    shape.t = p.video.currentTime;
    shape.always = style.always;
    p.shapes.push(shape);
    history.push({ kind: "add", key: p.key, shape });
    redoStack = [];
    persist();
    renderAll();
  }
  function removeShape(p, shape) {
    const index = p.shapes.indexOf(shape);
    if (index < 0) return;
    p.shapes.splice(index, 1);
    history.push({ kind: "remove", key: p.key, shape, index });
    redoStack = [];
    persist();
    renderAll();
  }
  function undo() {
    const a = history.pop();
    if (!a) return;
    const p = panes[a.key];
    if (a.kind === "add") p.shapes.splice(p.shapes.indexOf(a.shape), 1);
    else p.shapes.splice(a.index, 0, a.shape);
    redoStack.push(a);
    persist(); renderAll();
  }
  function redo() {
    const a = redoStack.pop();
    if (!a) return;
    const p = panes[a.key];
    if (a.kind === "add") p.shapes.push(a.shape);
    else p.shapes.splice(p.shapes.indexOf(a.shape), 1);
    history.push(a);
    persist(); renderAll();
  }
  function clearFrame() {
    const p = activePane;
    const t = p.video.currentTime;
    p.shapes.filter((s) => visible(s, t)).forEach((s) => removeShape(p, s));
  }
  function clearAll() {
    if (!confirm("Effacer tous les dessins de cette vidéo ?")) return;
    [panes.a, panes.b].forEach((p) => { p.shapes = []; });
    history.length = 0; redoStack = [];
    persist(); renderAll();
  }

  // ----- Gomme : distance entre le point touché et chaque dessin -----
  function distSeg(px, py, ax, ay, bx, by) {
    const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy;
    let t = l2 ? ((px - ax) * dx + (py - ay) * dy) / l2 : 0;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
  }
  function distanceTo(s, x, y, w, hh) {
    const P = s.pts.map(([a, b]) => [a * w, b * hh]);
    switch (s.type) {
      case "pen": {
        if (P.length === 1) return Math.hypot(x - P[0][0], y - P[0][1]);
        let m = Infinity;
        for (let i = 1; i < P.length; i++) m = Math.min(m, distSeg(x, y, P[i - 1][0], P[i - 1][1], P[i][0], P[i][1]));
        return m;
      }
      case "line": case "arrow": return distSeg(x, y, P[0][0], P[0][1], P[1][0], P[1][1]);
      case "circle": return Math.abs(Math.hypot(x - P[0][0], y - P[0][1]) - Math.hypot(P[1][0] - P[0][0], P[1][1] - P[0][1]));
      case "angle": return Math.min(distSeg(x, y, P[0][0], P[0][1], P[1][0], P[1][1]), distSeg(x, y, P[1][0], P[1][1], P[2][0], P[2][1]));
      case "text": {
        const size = fontSize(s, w, hh), tw = s.text.length * size * 0.55;
        return x >= P[0][0] - 8 && x <= P[0][0] + tw + 8 && y >= P[0][1] - 8 && y <= P[0][1] + size + 8 ? 0 : Infinity;
      }
    }
    return Infinity;
  }

  // ----- Texte : petite zone de saisie posée sur la vidéo -----
  function startText(p, pos) {
    const input = h("input", { type: "text", class: "pane__text", maxlength: "80", "aria-label": "Texte à écrire sur la vidéo" });
    input.style.left = Math.min(pos[0] * 100, 62) + "%";
    input.style.top = Math.min(pos[1] * 100, 88) + "%";
    p.el.append(input);
    input.focus();
    let done = false;
    const finish = (ok) => {
      if (done) return;
      done = true;
      const text = input.value.trim();
      input.remove();
      if (ok && text) addShape(p, { type: "text", color: style.color, width: style.width, pts: [pos], text });
    };
    input.addEventListener("keydown", (e) => {
      e.stopPropagation();
      if (e.key === "Enter") finish(true);
      if (e.key === "Escape") finish(false);
    });
    input.addEventListener("blur", () => finish(true));
  }

  // ----- Souris / doigt sur le canevas -----
  function pointOf(p, e) {
    const r = p.canvas.getBoundingClientRect();
    return [Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)), Math.max(0, Math.min(1, (e.clientY - r.top) / r.height))];
  }
  const newShape = (type, pts) => ({ type, color: style.color, width: style.width, pts });

  function setActive(p) {
    activePane = p;
    Object.values(panes).forEach((q) => { q.el.dataset.active = String(q === p && mode() === "side"); });
    updateCount();
  }

  function attachPointer(p) {
    const c = p.canvas;
    c.addEventListener("pointerdown", (e) => {
      setActive(p);
      const tool = style.tool;
      if (tool === "none" || !p.loaded) return;
      e.preventDefault();
      pause();
      const pos = pointOf(p, e);

      if (tool === "eraser") {
        const r = c.getBoundingClientRect(), t = p.video.currentTime;
        let best = null, bestD = 16;
        p.shapes.forEach((s) => {
          if (!visible(s, t)) return;
          const d = distanceTo(s, pos[0] * r.width, pos[1] * r.height, r.width, r.height);
          if (d <= bestD) { best = s; bestD = d; }
        });
        if (best) removeShape(p, best);
        return;
      }
      if (tool === "text") { startText(p, pos); return; }
      if (tool === "angle") {
        if (!p.draft) p.draft = newShape("angle", [pos]);
        else p.draft.pts.push(pos);
        if (p.draft.pts.length === 3) { const s = p.draft; p.draft = null; p.hover = null; addShape(p, s); }
        else render(p);
        return;
      }
      c.setPointerCapture(e.pointerId);
      p.draft = newShape(tool, tool === "pen" ? [pos] : [pos, pos]);
      render(p);
    });

    c.addEventListener("pointermove", (e) => {
      if (!p.draft) return;
      const pos = pointOf(p, e);
      if (p.draft.type === "angle") p.hover = pos;
      else if (p.draft.type === "pen") p.draft.pts.push(pos);
      else p.draft.pts[1] = pos;
      render(p);
    });

    const finish = () => {
      if (!p.draft || p.draft.type === "angle") return;
      const d = p.draft;
      p.draft = null;
      const r = c.getBoundingClientRect();
      const moved = d.type === "pen" || Math.hypot((d.pts[1][0] - d.pts[0][0]) * r.width, (d.pts[1][1] - d.pts[0][1]) * r.height) > 6;
      if (moved) addShape(p, d); else render(p);
    };
    c.addEventListener("pointerup", finish);
    c.addEventListener("pointercancel", () => { p.draft = null; render(p); });
  }
  attachPointer(panes.a);
  attachPointer(panes.b);

  // Échap annule un angle en cours
  function cancelDraft() {
    Object.values(panes).forEach((p) => { if (p.draft) { p.draft = null; p.hover = null; render(p); } });
  }

  // =====================================================
  // 3. Barre d'outils
  // =====================================================
  const toolbar = $("toolbar");
  const toolButtons = TOOLS.map(([key, label, d]) =>
    h("button", { type: "button", class: "tool", "data-tool": key, "aria-pressed": String(key === style.tool), onclick: () => selectTool(key) }, svg(d), h("span", {}, label)));
  function selectTool(key) {
    style.tool = key;
    cancelDraft();
    studio.dataset.tool = key;
    toolButtons.forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.tool === key)));
    $("tool-hint").textContent = HINTS[key];
  }

  const swatches = COLORS.map(([color, name]) =>
    h("button", { type: "button", class: "swatch", style: "--c:" + color, "data-color": color, "aria-label": name, title: name,
      "aria-pressed": String(color === style.color),
      onclick: () => { style.color = color; swatches.forEach((s) => s.setAttribute("aria-pressed", String(s.dataset.color === color))); } }));

  const widthInput = h("input", { type: "range", min: "2", max: "10", value: String(style.width), id: "epaisseur",
    oninput: (e) => { style.width = Number(e.target.value); } });
  const alwaysInput = h("input", { type: "checkbox", id: "garder", onchange: (e) => { style.always = e.target.checked; } });
  const gridInput = h("input", { type: "checkbox", id: "grille", onchange: (e) => { studio.dataset.grid = String(e.target.checked); } });

  const iconBtn = (id, label, d, onclick) =>
    h("button", { type: "button", class: "tool", id, onclick, "aria-label": label, title: label }, svg(d), h("span", {}, label.split(" ")[0]));

  toolbar.append(
    h("div", { class: "toolbar__group" }, toolButtons),
    h("span", { class: "toolbar__sep", "aria-hidden": "true" }),
    h("div", { class: "toolbar__group", role: "group", "aria-label": "Couleur" }, swatches),
    h("div", { class: "toolbar__group" },
      h("label", { for: "epaisseur" }, "Épaisseur", widthInput),
      h("label", { for: "garder", title: "Sinon le dessin n'apparaît que sur l'image où tu l'as tracé" }, alwaysInput, "Garder pendant la lecture"),
      h("label", { for: "grille" }, gridInput, "Grille")),
    h("span", { class: "toolbar__sep", "aria-hidden": "true" }),
    h("div", { class: "toolbar__group" },
      iconBtn("btn-undo", "Annuler", '<path d="M9 14L4 9l5-5M4 9h10a6 6 0 0 1 0 12h-3"/>', undo),
      iconBtn("btn-redo", "Rétablir", '<path d="M15 14l5-5-5-5M20 9H10a6 6 0 0 0 0 12h3"/>', redo),
      iconBtn("btn-effacer-image", "Effacer l'image", '<path d="M5 7h14M9 7V4h6v3M7 7l1 13h8l1-13"/>', clearFrame),
      iconBtn("btn-effacer-tout", "Tout effacer", '<path d="M4 4l16 16M20 4L4 20"/>', clearAll)),
    h("span", { class: "toolbar__sep", "aria-hidden": "true" }),
    h("div", { class: "toolbar__group" },
      iconBtn("btn-capture", "Capturer l'image", '<path d="M4 8h3l2-3h6l2 3h3v11H4zM12 17a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z"/>', () => capture())));
  selectTool(style.tool);

  // =====================================================
  // 4. Lecture (vidéo A pilote la vidéo B)
  // =====================================================
  let playing = false;
  let raf = 0;
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const offset = () => Number($("decalage").value) / 1000;
  const fmtTime = (t) => Math.floor(t / 60) + ":" + (t % 60).toFixed(2).padStart(5, "0");

  function updateTime() {
    const dur = A.duration || 0;
    $("temps").textContent = fmtTime(A.currentTime) + " / " + fmtTime(dur);
    const scrub = $("scrub");
    scrub.max = String(Math.round(dur * 1000));
    scrub.value = String(Math.round(A.currentTime * 1000));
    scrub.setAttribute("aria-valuetext", fmtTime(A.currentTime) + " sur " + fmtTime(dur));
  }

  function syncB(force) {
    if (!compare() || !B.duration) return;
    const target = A.currentTime + offset();
    const inside = target >= 0 && target <= B.duration;
    if (!inside) {
      if (!B.paused) B.pause();
      B.currentTime = clamp(target, 0, B.duration);
      return;
    }
    if (playing && B.paused) B.play().catch(() => {});
    if (Math.abs(B.currentTime - target) > (playing && !force ? 0.12 : 0.0005)) B.currentTime = target;
  }

  function setPlayingUi() {
    const b = $("lecture");
    b.textContent = playing ? "❚❚ Pause" : "▶︎ Lecture";
    b.setAttribute("aria-label", playing ? "Pause" : "Lecture");
  }
  function loop() {
    updateTime();
    syncB(false);
    renderAll();
    if (playing && !A.paused) raf = requestAnimationFrame(loop);
  }
  function play() {
    if (!A.duration) return;
    if (A.ended || A.currentTime >= A.duration - 0.03) A.currentTime = 0;
    A.playbackRate = B.playbackRate = Number($("vitesse").value);
    playing = true;
    A.play().catch(() => {});
    syncB(true);
    setPlayingUi();
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(loop);
  }
  function pause() {
    playing = false;
    A.pause();
    B.pause();
    cancelAnimationFrame(raf);
    setPlayingUi();
    syncB(true);
    updateTime();
    renderAll();
  }
  const toggle = () => (playing ? pause() : play());
  function step(dir) {
    pause();
    A.currentTime = clamp(A.currentTime + dir / fps(), 0, A.duration || 0);
  }

  $("lecture").addEventListener("click", toggle);
  $("img-moins").addEventListener("click", () => step(-1));
  $("img-plus").addEventListener("click", () => step(1));
  $("vitesse").addEventListener("change", (e) => { A.playbackRate = B.playbackRate = Number(e.target.value); });
  $("fps").addEventListener("change", renderAll);
  $("scrub").addEventListener("input", (e) => { A.currentTime = Number(e.target.value) / 1000; });
  A.addEventListener("ended", pause);
  ["seeked", "loadeddata", "timeupdate"].forEach((ev) => A.addEventListener(ev, () => { updateTime(); if (!playing) { syncB(true); renderAll(); } }));
  B.addEventListener("seeked", () => render(panes.b));
  B.addEventListener("loadeddata", () => render(panes.b));
  A.addEventListener("loadedmetadata", () => { updateTime(); renderAll(); });

  // Raccourcis clavier (inactifs quand on écrit ou qu'un bouton a le focus)
  document.addEventListener("keydown", (e) => {
    const tag = (e.target.tagName || "").toLowerCase();
    const typing = tag === "textarea" || tag === "select" || (tag === "input" && e.target.type === "text");
    if (typing) return;
    const ctrl = e.ctrlKey || e.metaKey;
    const key = e.key.toLowerCase();
    if (ctrl && key === "z") { e.preventDefault(); e.shiftKey ? redo() : undo(); return; }
    if (ctrl && key === "y") { e.preventDefault(); redo(); return; }
    if (e.key === "Escape") { cancelDraft(); return; }
    if (["button", "a", "input"].includes(tag)) return;
    if (e.key === " ") { e.preventDefault(); toggle(); }
    else if (e.key === "ArrowLeft") { e.preventDefault(); step(-1); }
    else if (e.key === "ArrowRight") { e.preventDefault(); step(1); }
  });

  // =====================================================
  // 5. Comparaison : vidéo B, superposition, côte à côte
  // =====================================================
  const selectB = $("video-b");
  function fillSelectB() {
    const others = CC.videos().filter((v) => v.id !== video.id);
    const refs = others.filter((v) => v.status === "reference");
    const mine = others.filter((v) => v.status !== "reference");
    selectB.replaceChildren(h("option", { value: "" }, "— Choisir une vidéo —"));
    const group = (label, list) => list.length && selectB.append(h("optgroup", { label },
      list.map((v) => h("option", { value: v.id }, v.title + " (" + (CC.SHOTS[v.shot] || "coup") + ", " + CC.fmtDate(v.date) + ")"))));
    group("Vidéos de référence", refs);
    group("Vidéos des élèves", mine);
  }

  function loadB(url, title) {
    panes.b.loaded = false;
    panes.b.el.dataset.loaded = "false";
    B.src = url;
    B.addEventListener("loadedmetadata", () => {
      panes.b.loaded = true;
      panes.b.el.dataset.loaded = "true";
      panes.b.el.querySelector(".pane__label").textContent = "B · " + title;
      if (mode() === "single") setMode("side");
      syncB(true);
      renderAll();
    }, { once: true });
  }

  selectB.addEventListener("change", async () => {
    const v = CC.videoById(selectB.value);
    if (!v) return;
    const url = await CC.fileURL(v.fileId);
    if (url) loadB(url, v.title);
  });
  $("fichier-b").addEventListener("change", (e) => {
    const f = e.target.files[0];
    if (f) loadB(URL.createObjectURL(f), f.name);
  });

  function setMode(m) {
    studio.dataset.mode = m;
    document.querySelectorAll(".mode-switch button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.mode === m)));
    if (m === "single") { B.pause(); setActive(panes.a); }
    else setActive(activePane);
    [panes.a, panes.b].forEach((p) => p.el.querySelector(".pane__label").hidden = m === "single");
    requestAnimationFrame(() => { syncB(true); renderAll(); });
  }
  document.querySelectorAll(".mode-switch button").forEach((b) => b.addEventListener("click", () => setMode(b.dataset.mode)));

  $("opacite").addEventListener("input", (e) => { studio.style.setProperty("--overlay", String(Number(e.target.value) / 100)); });
  studio.style.setProperty("--overlay", "0.5");

  function setOffset(ms) {
    const v = clamp(ms, -3000, 3000);
    $("decalage").value = String(v);
    $("decalage-val").textContent = (v / 1000).toFixed(2).replace(".", ",") + " s";
    syncB(true);
  }
  $("decalage").addEventListener("input", (e) => setOffset(Number(e.target.value)));
  $("dec-moins").addEventListener("click", () => setOffset(offset() * 1000 - 1000 / fps()));
  $("dec-plus").addEventListener("click", () => setOffset(offset() * 1000 + 1000 / fps()));

  // Garde les dessins alignés quand la taille de la vidéo change
  const ro = new ResizeObserver(() => renderAll());
  ro.observe(panes.a.el);
  ro.observe(panes.b.el);
  window.addEventListener("resize", renderAll);

  // =====================================================
  // 6. Capture d'une image annotée
  // =====================================================
  const DRAFT_KEY = "draft." + video.id;
  const draft = Object.assign({ observation: "", strengths: "", improve: "", exercises: [], captures: [] }, CC.read(DRAFT_KEY, {}));
  const saveDraft = () => CC.write(DRAFT_KEY, draft);

  function paintPane(ctx, p, x, y, w, hh) {
    ctx.drawImage(p.video, x, y, w, hh);
    ctx.save();
    ctx.translate(x, y);
    const t = p.video.currentTime;
    p.shapes.forEach((s) => { if (visible(s, t)) drawShape(ctx, s, w, hh); });
    ctx.restore();
  }

  async function capture() {
    const status = $("studio-status");
    if (!A.videoWidth) { status.className = "status-line is-error"; status.textContent = "La vidéo n'est pas encore chargée."; return; }
    pause();
    const out = document.createElement("canvas");
    const ctx = out.getContext("2d");
    const ratioOf = (v) => (v.videoWidth || 16) / (v.videoHeight || 9);

    if (mode() === "side" && panes.b.loaded) {
      const H = Math.min(A.videoHeight, 720);
      const wA = Math.round(H * ratioOf(A)), wB = Math.round(H * ratioOf(B)), gap = 8;
      out.width = wA + gap + wB; out.height = H;
      ctx.fillStyle = "#0b1424"; ctx.fillRect(0, 0, out.width, out.height);
      paintPane(ctx, panes.a, 0, 0, wA, H);
      paintPane(ctx, panes.b, wA + gap, 0, wB, H);
    } else {
      const W = Math.min(A.videoWidth, 1280), H = Math.round(W / ratioOf(A));
      out.width = W; out.height = H;
      ctx.drawImage(A, 0, 0, W, H);
      if (mode() === "overlay" && panes.b.loaded) {
        // B est « contenue » dans la zone de A, comme à l'écran
        const k = Math.min(W / B.videoWidth, H / B.videoHeight);
        const bw = B.videoWidth * k, bh = B.videoHeight * k;
        ctx.globalAlpha = Number($("opacite").value) / 100;
        ctx.drawImage(B, (W - bw) / 2, (H - bh) / 2, bw, bh);
        ctx.globalAlpha = 1;
      }
      const t = A.currentTime;
      panes.a.shapes.forEach((s) => { if (visible(s, t)) drawShape(ctx, s, W, H); });
    }

    const blob = await new Promise((resolve) => out.toBlob(resolve, "image/png"));
    if (!blob) { status.className = "status-line is-error"; status.textContent = "La capture a échoué."; return; }
    const id = await CC.putFile(blob);
    draft.captures.push(id);
    saveDraft();
    renderCaptures();
    status.className = "status-line is-ok";
    status.textContent = "Image ajoutée à ton analyse ✓";
  }

  function renderCaptures() {
    const box = $("captures");
    box.replaceChildren();
    draft.captures.forEach((id, i) => {
      const holder = h("div", { class: "capture" });
      CC.fileURL(id).then((url) => {
        if (!url) return;
        holder.prepend(h("a", { href: url, target: "_blank", rel: "noopener", "aria-label": "Voir l'image annotée " + (i + 1) },
          h("img", { src: url, alt: "Image annotée " + (i + 1) })));
      });
      holder.append(h("button", { type: "button", "aria-label": "Retirer l'image " + (i + 1),
        onclick: () => { draft.captures.splice(i, 1); saveDraft(); CC.deleteFile(id).catch(() => {}); renderCaptures(); } }, "✕"));
      box.append(holder);
    });
    if (!draft.captures.length) box.append(h("p", { class: "hint", style: "grid-column:1/-1" }, "Aucune image pour l'instant."));
  }

  // =====================================================
  // 7. Analyse écrite et exercices
  // =====================================================
  const LIBRARY = {
    coup_droit: [
      ["Coup droit au ralenti (sans balle)", "Devant un miroir ou une vitre, reproduis le geste à 50 % de vitesse. Contrôle la position du coude et le point d'impact devant le corps.", "3 × 10 gestes"],
      ["Balle lâchée (drop-feed)", "Un partenaire lâche la balle, tu te concentres uniquement sur un impact devant toi, bras souple.", "3 × 12 balles"],
      ["Coup droit croisé à 3/4 de puissance", "Échange croisé régulier : 10 balles dans le terrain avant d'accélérer.", "5 séries de 10"],
    ],
    revers: [
      ["Préparation d'épaule en revers", "Sans balle, travaille la rotation d'épaules et la position de la raquette en fin de préparation.", "3 × 10 gestes"],
      ["Revers lifté sur balle lâchée", "Drop-feed côté revers : brosse la balle de bas en haut, finition haute.", "3 × 12 balles"],
      ["Revers croisé régulier", "Échange croisé revers contre revers, zone visée entre la ligne de service et le fond.", "5 séries de 10"],
    ],
    service: [
      ["Lancer de balle sans frapper", "Lance la balle dans un cerceau posé au sol : même hauteur, même endroit, à chaque fois.", "20 lancers"],
      ["Service à cible", "Pose des cibles dans les carrés de service. Vise la zone, pas la vitesse.", "10 balles par zone"],
      ["Service en deux temps", "Marque une pause en position « trophée » puis enchaîne le geste pour contrôler l'équilibre.", "3 × 8 services"],
    ],
    retour: [
      ["Retour bloqué prise courte", "Raccourcis le geste : le retour est un bloc, avec un pas en avant (split-step).", "3 × 10 retours"],
      ["Split-step sur le service", "Petit saut au moment où l'adversaire frappe, puis ouverture vers la balle.", "5 séries de 6"],
    ],
    volee: [
      ["Volée de bloc au mur", "Tiens-toi à 3 m d'un mur, raquette devant, poignet ferme : la balle revient sans swing.", "3 × 20 volées"],
      ["Volée-volée à mi-court", "Échange de volées avec un partenaire, sans reculer, en gardant le coude devant.", "4 × 1 minute"],
    ],
    smash: [
      ["Placement sous la balle", "Pas chassés vers l'arrière, bras libre pointé vers la balle, sans frapper.", "3 × 8 placements"],
      ["Smash après lob (panier)", "Panier de balles hautes : frappe en extension complète, vise le milieu du carré.", "3 × 8 smashs"],
    ],
    autre: [],
    general: [
      ["Échelle de rythme (jeu de jambes)", "Pas rapides dans les cases de l'échelle, en restant bas et équilibré.", "5 passages"],
      ["Gainage", "Planche face et côtés pour stabiliser le tronc lors des frappes.", "3 × 30 secondes"],
      ["Échauffement d'épaule", "Rotations avec élastique avant chaque séance pour protéger l'épaule.", "2 × 15"],
    ],
  };

  function renderLibrary() {
    const items = [...(LIBRARY[video.shot] || []), ...LIBRARY.general];
    $("exo-lib").replaceChildren(...items.map(([title, detail, reps]) =>
      h("button", { type: "button", onclick: () => { draft.exercises.push({ title, detail, reps }); saveDraft(); renderExercises(); } }, "+ " + title)));
  }

  function renderExercises() {
    const box = $("exos");
    box.replaceChildren(...draft.exercises.map((ex, i) => {
      const bind = (key) => (e) => { ex[key] = e.target.value; saveDraft(); };
      return h("div", { class: "exo" },
        h("div", { class: "exo__head" },
          h("input", { type: "text", value: ex.title, "aria-label": "Nom de l'exercice " + (i + 1), placeholder: "Nom de l'exercice", oninput: bind("title") }),
          h("button", { type: "button", class: "exo__del", "aria-label": "Supprimer l'exercice " + (i + 1),
            onclick: () => { draft.exercises.splice(i, 1); saveDraft(); renderExercises(); } }, "✕")),
        h("textarea", { "aria-label": "Consignes de l'exercice " + (i + 1), placeholder: "Consignes…", oninput: bind("detail") }, ex.detail),
        h("input", { type: "text", value: ex.reps, "aria-label": "Nombre de séries de l'exercice " + (i + 1), placeholder: "Ex. : 3 × 10 balles", oninput: bind("reps") }));
    }));
  }
  $("exo-ajout").addEventListener("click", () => {
    draft.exercises.push({ title: "", detail: "", reps: "" });
    saveDraft();
    renderExercises();
  });

  [["obs", "observation"], ["forts", "strengths"], ["progres", "improve"]].forEach(([id, key]) => {
    $(id).value = draft[key];
    $(id).addEventListener("input", (e) => { draft[key] = e.target.value; saveDraft(); });
  });

  $("envoyer").addEventListener("click", () => {
    const status = $("envoi-status");
    const exercises = draft.exercises.filter((e) => e.title.trim());
    if (!draft.observation.trim() && !draft.strengths.trim() && !draft.improve.trim() && !exercises.length && !draft.captures.length) {
      status.className = "status-line is-error";
      status.textContent = "Ajoute au moins une observation, une image ou un exercice avant d'envoyer.";
      return;
    }
    CC.addMessage(video.id, {
      from: "coach",
      text: "",
      analysis: {
        observation: draft.observation.trim(),
        strengths: draft.strengths.trim(),
        improve: draft.improve.trim(),
        exercises: exercises.map((e) => ({ title: e.title.trim(), detail: e.detail.trim(), reps: e.reps.trim() })),
        captures: draft.captures.slice(),
      },
    });
    CC.updateVideo(video.id, { status: "analysee" });
    // Un nouveau brouillon vide pour une éventuelle prochaine analyse
    Object.assign(draft, { observation: "", strengths: "", improve: "", exercises: [], captures: [] });
    saveDraft();
    ["obs", "forts", "progres"].forEach((id) => { $(id).value = ""; });
    renderExercises();
    renderCaptures();
    status.className = "status-line is-ok";
    status.replaceChildren("Analyse envoyée ✓ ", h("a", { href: "messages.html?id=" + video.id }, "Voir dans la discussion"));
  });
  $("lien-messages").href = "messages.html?id=" + video.id;

  // =====================================================
  // 8. Fiche de l'élève
  // =====================================================
  function renderProfile() {
    const p = CC.profile();
    const age = (() => {
      if (!p.naissance) return "";
      const d = new Date(p.naissance), n = new Date();
      let a = n.getFullYear() - d.getFullYear();
      if (n < new Date(n.getFullYear(), d.getMonth(), d.getDate())) a -= 1;
      return isNaN(a) ? "" : a + " ans";
    })();
    const rows = [
      ["Prénom", p.prenom], ["Âge", age], ["Main", p.lateralite], ["Revers", p.revers],
      ["Niveau", p.classement], ["Pratique", p.annees ? p.annees + " an(s)" : ""],
      ["Séances / semaine", p.frequence], ["Santé", p.sante],
    ];
    $("profile-mini").replaceChildren(...rows.map(([k, v]) =>
      h("div", {}, h("dt", {}, k), h("dd", {}, v && String(v).trim() ? v : "—"))));
    if (video.question) { $("question-card").hidden = false; $("question-texte").textContent = video.question; }
  }

  // =====================================================
  // 9. Démarrage
  // =====================================================
  if (isReference) {
    $("feedback").hidden = true;
    $("colonnes").hidden = true;
  }
  fillSelectB();
  renderProfile();
  renderLibrary();
  renderExercises();
  renderCaptures();
  setMode("single");
  setPlayingUi();

  CC.fileURL(video.fileId).then((url) => {
    if (!url) {
      $("studio-status").className = "status-line is-error";
      $("studio-status").textContent = "Cette vidéo n'est plus disponible sur cet appareil.";
      return;
    }
    A.src = url;
  });
})();

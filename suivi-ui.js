/* Composants visuels du pôle compétition (graphiques SVG faits maison, avatars, anneaux). */
CC.ui = (() => {
  const { h } = CC;
  const NS = "http://www.w3.org/2000/svg";
  const svgEl = (html, attrs) => {
    const s = document.createElementNS(NS, "svg");
    Object.entries(attrs || {}).forEach(([k, v]) => s.setAttribute(k, v));
    s.innerHTML = html; // texte construit ici à partir de constantes et de nombres uniquement
    return s;
  };
  const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  // Avatar rond avec les initiales
  function avatar(p, size) {
    const el = h("span", { class: "avatar", "aria-hidden": "true" }, CC.comp.initials(p));
    el.style.setProperty("--avatar", CC.comp.avatarColor(p.id));
    if (size) el.style.setProperty("--size", size + "px");
    return el;
  }

  // Anneau de progression (0-100)
  function ring(percent, label, size) {
    const r = 26, c = 2 * Math.PI * r, v = Math.max(0, Math.min(100, percent || 0));
    const s = svgEl(
      '<circle cx="32" cy="32" r="' + r + '" fill="none" stroke="var(--sand)" stroke-width="8"/>' +
      '<circle cx="32" cy="32" r="' + r + '" fill="none" stroke="var(--clay)" stroke-width="8" stroke-linecap="round" stroke-dasharray="' + (c * v / 100).toFixed(1) + " " + c.toFixed(1) + '" transform="rotate(-90 32 32)"/>' +
      '<text x="32" y="37" text-anchor="middle" font-size="15" font-weight="800" fill="currentColor">' + (percent === null || percent === undefined ? "–" : Math.round(v) + "%") + "</text>",
      { viewBox: "0 0 64 64", class: "ring", role: "img", "aria-label": (label || "Progression") + " : " + (percent === null || percent === undefined ? "pas encore d'objectif" : Math.round(v) + " %") });
    if (size) { s.style.width = size + "px"; s.style.height = size + "px"; }
    return s;
  }

  // Graphique en toile d'araignée. series : [{ values: {technique: 3.2, …}, color, label, dashed }]
  function radar(series, options) {
    const axes = CC.comp.AXES;
    const W = 340, H = 300, cx = W / 2, cy = 150, R = 98, n = axes.length;
    const angle = (i) => -Math.PI / 2 + (i * 2 * Math.PI) / n;
    const point = (i, value) => [cx + Math.cos(angle(i)) * R * (value / 5), cy + Math.sin(angle(i)) * R * (value / 5)];
    let body = "";
    for (let level = 1; level <= 5; level++) {
      body += '<polygon points="' + axes.map((_, i) => point(i, level).map((x) => x.toFixed(1)).join(",")).join(" ") + '" fill="' + (level === 5 ? "rgba(16,32,58,.03)" : "none") + '" stroke="#d9cdbd" stroke-width="' + (level === 5 ? 1.5 : 1) + '"/>';
    }
    axes.forEach((a, i) => {
      const [x, y] = point(i, 5);
      body += '<line x1="' + cx + '" y1="' + cy + '" x2="' + x.toFixed(1) + '" y2="' + y.toFixed(1) + '" stroke="#d9cdbd" stroke-width="1"/>';
      const [lx, ly] = [cx + Math.cos(angle(i)) * (R + 20), cy + Math.sin(angle(i)) * (R + 20) + 4];
      const anchor = Math.abs(Math.cos(angle(i))) < 0.25 ? "middle" : Math.cos(angle(i)) > 0 ? "start" : "end";
      body += '<text x="' + lx.toFixed(1) + '" y="' + ly.toFixed(1) + '" text-anchor="' + anchor + '" font-size="13" font-weight="800" fill="' + a.color + '">' + esc(a.label) + "</text>";
    });
    for (let level = 1; level <= 5; level++) {
      const [x, y] = point(0, level);
      body += '<text x="' + (cx + 4) + '" y="' + (y + 3).toFixed(1) + '" font-size="9" fill="#7b8696">' + level + "</text>";
    }
    series.forEach((s) => {
      const pts = axes.map((a, i) => point(i, s.values[a.key] || 0));
      body += '<polygon points="' + pts.map((p) => p.map((x) => x.toFixed(1)).join(",")).join(" ") + '" fill="' + s.color + '" fill-opacity="' + (s.dashed ? 0 : 0.22) + '" stroke="' + s.color + '" stroke-width="2.5"' + (s.dashed ? ' stroke-dasharray="6 5"' : "") + ' stroke-linejoin="round"/>';
      pts.forEach((p, i) => { if (s.values[axes[i].key]) body += '<circle cx="' + p[0].toFixed(1) + '" cy="' + p[1].toFixed(1) + '" r="3.5" fill="' + s.color + '"/>'; });
    });
    const desc = series.map((s) => s.label + " : " + axes.map((a) => a.label + " " + (s.values[a.key] ? s.values[a.key].toFixed(1).replace(".", ",") : "–")).join(", ")).join(" ; ");
    const svg = svgEl(body, { viewBox: "0 0 " + W + " " + H, class: "radar", role: "img", "aria-label": "Graphique des compétences. " + desc });
    const legend = h("ul", { class: "radar-legend", role: "list" }, series.map((s) =>
      h("li", {}, h("span", { class: "radar-legend__key" + (s.dashed ? " radar-legend__key--dashed" : ""), style: "--c:" + s.color }), s.label)));
    return h("figure", { class: "radar-figure" }, svg, (options && options.noLegend) ? null : legend);
  }

  // Petites barres par axe (pour les cartes de joueurs) : values = {axe: moyenne /5}
  function miniBars(values) {
    return h("div", { class: "minibars", role: "img", "aria-label": CC.comp.AXES.map((a) => a.label + " " + (values[a.key] ? values[a.key].toFixed(1).replace(".", ",") : "–") + " sur 5").join(", ") },
      CC.comp.AXES.map((a) => {
        const v = values[a.key] || 0;
        const bar = h("span", { class: "minibars__bar" }, h("span", { class: "minibars__fill" }));
        bar.firstChild.style.height = (v / 5 * 100) + "%";
        bar.firstChild.style.background = a.color;
        return h("span", { class: "minibars__col", title: a.label + " : " + (v ? v.toFixed(1).replace(".", ",") : "–") + " / 5" }, bar, h("span", { class: "minibars__lbl" }, a.label.slice(0, 3)));
      }));
  }

  const fmtAvg = (v) => (v === null || v === undefined ? "–" : v.toFixed(1).replace(".", ","));
  const trend = (now, before) => {
    if (!now || !before) return "";
    const d = now - before;
    return d > 0 ? "▲ +" + (Math.round(d * 10) / 10).toString().replace(".", ",") : d < 0 ? "▼ " + (Math.round(d * 10) / 10).toString().replace(".", ",") : "＝";
  };

  return { svgEl, avatar, ring, radar, miniBars, fmtAvg, trend, esc };
})();

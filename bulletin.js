// Bulletin trimestriel imprimable d'un joueur du Centre de compétition jeunes.
(() => {
  const role = CC.role();
  if (!role) return;
  const { h } = CC;
  const comp = CC.comp, ui = CC.ui;
  const isCoach = role === "coach";
  const $ = (id) => document.getElementById(id);
  const params = new URLSearchParams(location.search);
  let p = comp.player(params.get("player"));
  if (!isCoach && !(p && p.accountId && p.accountId === CC.me())) p = null; // un élève ne voit que son propre bulletin
  if (!p) {
    CC.fill($("outils"), h("a", { class: "btn btn--clay", href: isCoach ? "suivi.html" : "espace.html" }, isCoach ? "Retour à mes joueurs" : "Retour à mon espace"));
    CC.fill($("bulletin"), h("p", { class: "empty" }, "Ce joueur est introuvable."));
    return;
  }
  const cur = comp.current();
  const season = /^\d{4}-\d{4}$/.test(params.get("season") || "") ? params.get("season") : cur.season;
  const t = [1, 2, 3].includes(Number(params.get("t"))) ? Number(params.get("t")) : cur.t;
  const ev = comp.getEval(p.id, season, t);
  const prevP = comp.previousPeriod(season, t);
  const prev = comp.hasEval(p.id, prevP.season, prevP.t) ? comp.getEval(p.id, prevP.season, prevP.t) : null;
  const short = (s, n) => comp.periodLabel(s, n).replace("Trimestre ", "T").replace(" · ", " ");
  document.title = "Bulletin " + comp.fullName(p) + " – " + short(season, t);
  $("retour").href = isCoach ? "joueur.html?id=" + p.id + "#bulletins" : "mon-suivi.html#bulletins";

  // ----- Outils (non imprimés) -----
  const copyBtn = h("button", { type: "button", class: "btn btn--outline", onclick: async () => {
    try { await navigator.clipboard.writeText(comp.bulletinText(p, season, t)); copyBtn.textContent = "Copié ✓"; } catch (e) { copyBtn.textContent = "Copie impossible"; }
    setTimeout(() => { copyBtn.textContent = "Copier en texte"; }, 2500);
  } }, "Copier en texte");
  CC.fill($("outils"), 
    h("button", { type: "button", class: "btn btn--clay", onclick: () => window.print() }, "Imprimer / Enregistrer en PDF"),
    copyBtn,
    isCoach ? h("a", { class: "btn btn--outline", href: "joueur.html?id=" + p.id + "#evaluations" }, "Modifier l'évaluation") : null,
    h("p", { class: "hint", style: "flex-basis:100%;margin:0" }, "Astuce : dans la fenêtre d'impression, choisis « Enregistrer au format PDF » pour envoyer le bulletin par e-mail."));

  const paper = $("bulletin");
  const values = {}, prevValues = {};
  comp.AXES.forEach((a) => { values[a.key] = comp.axisAverage(ev, a.key) || 0; prevValues[a.key] = prev ? comp.axisAverage(prev, a.key) || 0 : 0; });
  const series = [{ values, color: "#b8471f", label: short(season, t) }];
  if (prev) series.push({ values: prevValues, color: "#10203a", label: short(prevP.season, prevP.t), dashed: true });

  const facts = [["Catégorie", comp.category(p, season)], ["Classement", p.classement], ["Objectif classement", p.objectifClassement],
    ["Main", p.main], ["Revers", p.revers], ["Style de jeu", p.style], ["Entraînement", p.seances]].filter(([, v]) => v);

  // ----- Compétences par axe -----
  const skills = comp.AXES.map((axis) => {
    const avg = comp.axisAverage(ev, axis.key);
    const pavg = prev ? comp.axisAverage(prev, axis.key) : null;
    const rows = axis.skills.filter(([k]) => ev.ratings[k]).map(([k, label]) => {
      const v = ev.ratings[k], pv = prev ? prev.ratings[k] : 0;
      const fill = h("span", {}); fill.style.width = (v / 5 * 100) + "%"; fill.style.background = axis.color;
      return h("div", { class: "skill-bar" }, h("span", {}, label), h("span", { class: "skill-bar__track", "aria-hidden": "true" }, fill),
        h("span", { class: "skill-bar__val" }, v + "/5 ", pv && v !== pv ? h("small", {}, v > pv ? "▲" : "▼") : null));
    });
    if (!rows.length && !ev.comments[axis.key]) return null;
    const box = h("div", { style: "--axis:" + axis.color, class: "b-axis" },
      h("h3", {}, axis.label, h("span", {}, ui.fmtAvg(avg) + " / 5 " + ui.trend(avg, pavg))),
      ...rows, ev.comments[axis.key] ? h("p", { class: "hint" }, ev.comments[axis.key]) : null);
    return box;
  }).filter(Boolean);

  // ----- Objectifs -----
  const goalList = comp.goals(p.id, season);
  const goalsBlock = goalList.length ? h("section", {}, h("h2", {}, "Objectifs de l'année · " + (comp.goalsProgress(goalList)) + " % atteints"),
    h("ul", { class: "b-goals" }, goalList.map((g) => {
      const axis = comp.GOAL_AXES.find((a) => a.key === g.axis) || { label: "", color: "#b8471f" };
      const bar = h("span", { class: "goal__bar" }, h("span", {}));
      bar.firstChild.style.width = (g.progress || 0) + "%"; bar.firstChild.style.background = axis.color;
      return h("li", {}, h("div", {}, h("strong", {}, axis.label + " : "), g.title || "(sans titre)", " — ", h("strong", {}, (g.progress || 0) + " %"), comp.analysesOfGoal(p.id, g).length ? " · " + comp.analysesOfGoal(p.id, g).length + " analyse(s) vidéo" : "",
        g.indicator ? h("div", { class: "hint" }, g.indicator + (g.deadline ? " · avant le " + CC.fmtDate(g.deadline) : "")) : null), bar);
    }))) : null;

  // ----- Matchs -----
  const ms = comp.matchesIn(p.id, season, t);
  const matchBlock = ms.length ? h("section", {}, h("h2", {}, "Compétition"),
    h("table", { class: "b-matches" }, h("thead", {}, h("tr", {}, ["Date", "Rencontre", "Bilan", "Score"].map((x) => h("th", { scope: "col" }, x)))),
      h("tbody", {}, ms.map((m) => h("tr", {}, h("td", {}, CC.fmtDate(m.date)), h("td", {}, m.tournoi + (m.tour ? " · " + m.tour : ""), m.remarque ? h("div", { class: "hint" }, m.remarque) : null), h("td", {}, m.bilan), h("td", {}, m.score || "")))))) : null;

  // ----- Analyses vidéo -----
  const as = comp.analysesIn(p.id, season, t);
  const analysisBlock = as.length ? h("section", {}, h("h2", {}, "Analyses vidéo du trimestre"),
    h("div", { class: "b-analyses" }, as.map((a) => {
      const imgs = h("div", { class: "b-analysis__imgs" });
      (a.captures || []).slice(0, 4).forEach((cid, i) => CC.fileURL(cid).then((url) => { if (url) imgs.append(h("img", { src: url, alt: "Image annotée " + (i + 1) })); }));
      return h("div", { class: "b-analysis" }, h("h3", {}, (a.videoTitle || "Analyse") + " · " + CC.fmtDate(a.date)),
        comp.goalsOfAnalysis(p.id, a).length ? h("p", {}, h("strong", {}, "Objectifs travaillés : "), comp.goalsOfAnalysis(p.id, a).map((g) => g.title).join(" ; ")) : null,
        a.observation ? h("p", {}, a.observation) : null,
        a.strengths ? h("p", {}, h("strong", {}, "Points forts : "), a.strengths) : null,
        a.improve ? h("p", {}, h("strong", {}, "À améliorer : "), a.improve) : null, imgs);
    }))) : null;

  const textBlock = (title, text) => (text || "").trim() ? h("section", { class: "b-text" }, h("h2", {}, title), h("p", {}, text.trim())) : null;
  const pct = comp.completion(ev);

  CC.fill(paper, 
    h("header", { class: "bulletin-head" },
      h("div", { class: "bulletin-id" }, ui.avatar(p, 56), h("div", {}, h("h1", {}, comp.fullName(p)), h("p", {}, "Bulletin de compétences et de progression"))),
      h("div", { class: "bulletin-club" }, h("strong", {}, "Tennis Club Houdan"), h("p", {}, comp.periodLabel(season, t)), h("p", {}, comp.TRIMESTER_MONTHS[t]))),
    facts.length ? h("dl", { class: "bulletin-facts" }, facts.map(([k, v]) => h("div", {}, h("dt", {}, k), h("dd", {}, v)))) : null,
    pct === 0 ? h("p", { class: "empty" }, "Aucune compétence n'est encore notée pour ce trimestre. Remplis l'évaluation pour compléter le bulletin.") : null,
    pct ? h("div", { class: "bulletin-grid" },
      h("section", {}, h("h2", {}, "Vue d'ensemble"), ui.radar(series),
        h("p", { class: "b-mean" }, h("strong", {}, "Moyenne générale : " + ui.fmtAvg(comp.overallAverage(ev)) + " / 5"), prev ? h("span", {}, ui.trend(comp.overallAverage(ev), comp.overallAverage(prev)) + " depuis le " + short(prevP.season, prevP.t)) : null)),
      h("section", { class: "skill-bars" }, h("h2", {}, "Compétences"), ...skills)) : null,
    textBlock("Appréciation du coach", ev.appreciation),
    textBlock("Points forts", ev.strengths), textBlock("À travailler", ev.improve),
    goalsBlock, matchBlock, analysisBlock,
    textBlock("Objectifs du trimestre suivant", ev.next),
    h("div", { class: "b-sign" }, h("div", {}, "Signature du coach"), h("div", {}, "Signature des parents")),
    h("p", { class: "b-foot" }, "Tennis Club Houdan · Bulletin généré avec CourtCoach le " + CC.fmtDate(new Date().toISOString())));
})();

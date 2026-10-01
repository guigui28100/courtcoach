// « Mon suivi » : l'élève voit (en lecture seule) ses objectifs, évaluations, analyses et bulletins.
(() => {
  const role = CC.role();
  if (!role) return;
  if (role === "coach") { location.replace("suivi.html"); return; }
  const { h } = CC;
  const comp = CC.comp, ui = CC.ui;
  const $ = (id) => document.getElementById(id);
  const me = CC.ensureMe();
  const player = comp.playerOfAccount(me);
  if (!player) {
    $("vide").hidden = false;
    CC.fill($("vide"), h("p", { class: "empty" }, "Ton coach n'a pas encore ouvert ton suivi. Quand il l'aura fait, tu verras ici tes objectifs de l'année, tes évaluations et tes bulletins."),
      h("p", {}, h("a", { class: "btn btn--clay", href: "espace.html" }, "Retour à mon espace")));
    return;
  }
  const id = player.id;
  $("contenu-suivi").hidden = false;
  const cur = comp.current();
  const state = { season: cur.season, t: cur.t };
  const short = (s, n) => comp.periodLabel(s, n).replace("Trimestre ", "T").replace(" · ", " ");
  $("nom").textContent = "Mon suivi, " + (player.prenom || "");
  document.title = "Mon suivi – CourtCoach";

  // ----- Chiffres clés -----
  const gp = comp.goalsProgress(comp.goals(id, cur.season));
  const last = comp.evaluatedPeriods(id).find((p) => comp.completion(comp.getEval(id, p.season, p.t)) > 0);
  const lastEv = last ? comp.getEval(id, last.season, last.t) : null;
  const prevP = last ? comp.previousPeriod(last.season, last.t) : null;
  const prevEv = prevP && comp.hasEval(id, prevP.season, prevP.t) ? comp.getEval(id, prevP.season, prevP.t) : null;
  const avg = lastEv ? comp.overallAverage(lastEv) : null;
  CC.fill($("kpis"),
    h("div", { class: "kpi" }, ui.ring(gp, "Objectifs de l'année", 64), h("div", {}, h("b", {}, "Mes objectifs"), h("span", {}, gp === null ? "Pas encore d'objectif" : "atteints à " + gp + " %"))),
    h("div", { class: "kpi" }, h("span", { class: "kpi__big" }, ui.fmtAvg(avg)), h("div", {}, h("b", {}, "Mon niveau"), h("span", {}, last ? "sur 5 · " + short(last.season, last.t) + (prevEv ? " " + ui.trend(avg, comp.overallAverage(prevEv)) : "") : "pas encore évalué"))));

  // ----- Objectifs -----
  function renderGoals() {
    const list = comp.goals(id, cur.season);
    CC.fill($("p-objectifs"),
      h("p", { class: "hint" }, "Les objectifs de la saison " + cur.season.replace("-", "/") + ", fixés avec ton coach. Il met la progression à jour au fil des séances."),
      list.length ? h("div", { class: "axis-grid" }, comp.GOAL_AXES.map((axis) => {
        const mine = list.filter((g) => g.axis === axis.key);
        if (!mine.length) return null;
        return h("section", { class: "axis-card", style: "--axis:" + axis.color },
          h("header", { class: "axis-card__head" }, h("h3", {}, axis.label), h("span", { class: "axis-card__avg" }, comp.goalsProgress(mine) + " %")),
          mine.map((g) => {
            const bar = h("span", { class: "goal__bar" }, h("span", {}));
            bar.firstChild.style.width = (g.progress || 0) + "%"; bar.firstChild.style.background = axis.color;
            return h("article", { class: "goal" + ((g.progress || 0) >= 100 ? " goal--done" : "") },
              h("strong", {}, g.title || "(sans titre)"),
              g.indicator ? h("span", { class: "hint" }, "Comment on le mesure : " + g.indicator) : null,
              g.deadline ? h("span", { class: "hint" }, "À atteindre avant le " + CC.fmtDate(g.deadline)) : null,
              h("span", {}, h("strong", {}, (g.progress || 0) + " %"), (g.progress || 0) >= 100 ? " 🎉 objectif atteint !" : ""), bar);
          }));
      })) : h("p", { class: "empty" }, "Ton coach n'a pas encore fixé d'objectifs pour cette saison."));
  }

  // ----- Évaluations -----
  function renderEval() {
    const { season, t } = state;
    const ev = comp.getEval(id, season, t);
    const pp = comp.previousPeriod(season, t);
    const prev = comp.hasEval(id, pp.season, pp.t) ? comp.getEval(id, pp.season, pp.t) : null;
    const periods = comp.evaluatedPeriods(id).filter((p) => comp.completion(comp.getEval(id, p.season, p.t)) > 0);
    if (!periods.some((p) => p.season === season && p.t === t) && periods[0]) { state.season = periods[0].season; state.t = periods[0].t; return renderEval(); }
    if (!periods.length) { CC.fill($("p-evaluations"), h("p", { class: "empty" }, "Pas encore d'évaluation. Ton coach la remplira à la fin du trimestre.")); return; }
    const select = h("select", { "aria-label": "Période", onchange: (e) => { const [s, n] = e.target.value.split("."); state.season = s; state.t = Number(n); renderEval(); } },
      periods.map((p) => h("option", { value: p.season + "." + p.t, selected: p.season === season && p.t === t ? true : null }, comp.periodLabel(p.season, p.t))));
    const values = {}, pv = {};
    comp.AXES.forEach((a) => { values[a.key] = comp.axisAverage(ev, a.key) || 0; pv[a.key] = prev ? comp.axisAverage(prev, a.key) || 0 : 0; });
    const series = [{ values, color: "#b8471f", label: short(season, t) }];
    if (prev) series.push({ values: pv, color: "#10203a", label: short(pp.season, pp.t), dashed: true });
    const axes = comp.AXES.map((axis) => {
      const rows = axis.skills.filter(([k]) => ev.ratings[k]).map(([k, label]) => {
        const v = ev.ratings[k], before = prev ? prev.ratings[k] : 0;
        const fill = h("span", {}); fill.style.width = (v / 5 * 100) + "%"; fill.style.background = axis.color;
        return h("div", { class: "skill-bar" }, h("span", {}, label), h("span", { class: "skill-bar__track", "aria-hidden": "true" }, fill),
          h("span", { class: "skill-bar__val" }, v + "/5 " + comp.RATING_LABELS[v], before && v !== before ? h("small", {}, v > before ? " ▲" : " ▼") : null));
      });
      if (!rows.length) return null;
      return h("section", { class: "axis-card", style: "--axis:" + axis.color }, h("header", { class: "axis-card__head" }, h("h3", {}, axis.label), h("span", { class: "axis-card__avg" }, ui.fmtAvg(comp.axisAverage(ev, axis.key)) + " / 5 " + ui.trend(comp.axisAverage(ev, axis.key), prev ? comp.axisAverage(prev, axis.key) : null))),
        ...rows, ev.comments[axis.key] ? h("p", { class: "hint" }, ev.comments[axis.key]) : null);
    });
    const text = (title, v) => (v || "").trim() ? h("section", { class: "form-section" }, h("h3", {}, title), h("p", { style: "white-space:pre-line" }, v.trim())) : null;
    CC.fill($("p-evaluations"),
      h("div", { class: "toolbar-row" }, select),
      h("div", { class: "eval-summary" }, ui.radar(series)),
      h("div", { class: "axis-grid axis-grid--eval" }, axes),
      text("Le mot de ton coach", ev.appreciation), text("Mes points forts", ev.strengths), text("Ce que je dois travailler", ev.improve), text("Mes objectifs pour la suite", ev.next));
  }

  // ----- Analyses -----
  function renderAnalyses() {
    const list = comp.analyses(id).slice().sort((a, b) => b.date.localeCompare(a.date));
    CC.fill($("p-analyses"), list.length ? list.map((a) => {
      const caps = (a.captures || []).map((cid, i) => {
        const b = h("button", { type: "button", class: "capture__open strip__thumb", "aria-label": "Voir l'image " + (i + 1) + " en grand" });
        CC.fileURL(cid).then((url) => { if (!url) return; b.append(h("img", { src: url, alt: "Image annotée " + (i + 1) })); b.addEventListener("click", () => CC.lightbox(url, "Image annotée " + (i + 1))); });
        return h("figure", { class: "analysis__fig" }, b, (a.captureNotes || {})[cid] ? h("figcaption", {}, a.captureNotes[cid]) : null);
      });
      return h("details", { class: "analysis-item" }, h("summary", {}, h("strong", {}, a.videoTitle || "Analyse"), " · " + CC.fmtDate(a.date)),
        h("div", { class: "analysis" },
          a.observation ? h("div", {}, h("h4", {}, "Observation"), h("p", {}, a.observation)) : null,
          a.strengths ? h("div", {}, h("h4", {}, "Points forts"), h("p", {}, a.strengths)) : null,
          a.improve ? h("div", {}, h("h4", {}, "À améliorer"), h("p", {}, a.improve)) : null,
          caps.length ? h("div", {}, h("h4", {}, "Images annotées"), h("div", { class: "analysis__caps" }, caps)) : null,
          (a.exercises || []).length ? h("div", {}, h("h4", {}, "Exercices"), h("ol", {}, a.exercises.map((x) => h("li", {}, h("strong", {}, x.title), x.reps ? " — " + x.reps : "", x.detail ? h("div", {}, x.detail) : null)))) : null));
    }) : h("p", { class: "empty" }, "Les analyses vidéo de ton coach apparaîtront ici."));
  }

  // ----- Bulletins -----
  function renderBulletins() {
    const periods = comp.evaluatedPeriods(id).filter((p) => comp.completion(comp.getEval(id, p.season, p.t)) > 0);
    CC.fill($("p-bulletins"), h("p", { class: "hint" }, "Tes bulletins trimestriels. Tu peux les imprimer ou les enregistrer en PDF."),
      periods.length ? h("ul", { class: "list" }, periods.map((p) => h("li", { class: "list__item" },
        h("div", { class: "list__main" }, h("strong", {}, comp.periodLabel(p.season, p.t))),
        h("a", { class: "btn btn--small btn--clay", href: "bulletin.html?player=" + id + "&season=" + p.season + "&t=" + p.t }, "Ouvrir le bulletin"))))
        : h("p", { class: "empty" }, "Pas encore de bulletin."));
  }

  const TABS = [["objectifs", "Mes objectifs", renderGoals], ["evaluations", "Mes évaluations", renderEval], ["analyses", "Mes analyses", renderAnalyses], ["bulletins", "Mes bulletins", renderBulletins]];
  function showTab(key, push) {
    const tab = TABS.find(([k]) => k === key) || TABS[0];
    TABS.forEach(([k]) => { $("t-" + k).setAttribute("aria-selected", String(k === tab[0])); $("t-" + k).tabIndex = k === tab[0] ? 0 : -1; $("p-" + k).hidden = k !== tab[0]; });
    tab[2]();
    if (push) history.replaceState(null, "", "#" + tab[0]);
  }
  CC.fill($("onglets"), TABS.map(([k, label]) => h("button", { type: "button", role: "tab", id: "t-" + k, "aria-controls": "p-" + k, "aria-selected": "false", class: "tab", onclick: () => showTab(k, true),
    onkeydown: (e) => {
      const i = TABS.findIndex(([x]) => x === k);
      const next = e.key === "ArrowRight" ? TABS[(i + 1) % TABS.length] : e.key === "ArrowLeft" ? TABS[(i + TABS.length - 1) % TABS.length] : null;
      if (next) { e.preventDefault(); showTab(next[0], true); $("t-" + next[0]).focus(); }
    } }, label)));
  showTab(location.hash.replace("#", ""), false);
  window.addEventListener("hashchange", () => showTab(location.hash.replace("#", ""), false));
})();

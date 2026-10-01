/* =========================================================
   CourtCoach – Pôle compétition : données des jeunes compétiteurs.
   Tout reste dans le navigateur du coach (démonstration).
   Chargé après store.js ; utilise ses outils (CC.read, CC.write…).
   ========================================================= */
CC.comp = (() => {
  const { read, write, remove, uid } = CC;

  // ---------- Les 4 axes de progression + l'attitude ----------
  // Les objectifs de l'année suivent les 4 premiers axes ; les évaluations trimestrielles ajoutent « Attitude ».
  const AXES = [
    { key: "technique", label: "Technique", color: "#b8471f", skills: [
      ["coup_droit", "Coup droit"], ["revers", "Revers"], ["service", "Service"],
      ["retour", "Retour de service"], ["volee", "Volée et jeu au filet"], ["deplacements", "Jeu de jambes et placements"]] },
    { key: "tactique", label: "Tactique", color: "#2a6fb0", skills: [
      ["lecture", "Lecture du jeu"], ["construction", "Construction du point"],
      ["variations", "Variations (hauteur, effets, directions)"], ["choix", "Choix des schémas en match"]] },
    { key: "physique", label: "Physique", color: "#2f8f5b", skills: [
      ["vitesse", "Vitesse et explosivité"], ["endurance", "Endurance"],
      ["coordination", "Coordination et équilibre"], ["souplesse", "Souplesse et prévention des blessures"]] },
    { key: "mental", label: "Mental", color: "#7a4cc2", skills: [
      ["concentration", "Concentration"], ["emotions", "Gestion des émotions"],
      ["combativite", "Combativité"], ["confiance", "Confiance et autonomie"]] },
    { key: "attitude", label: "Attitude", color: "#c08a00", evalOnly: true, skills: [
      ["assiduite", "Assiduité et ponctualité"], ["etat_esprit", "État d'esprit à l'entraînement"],
      ["esprit_equipe", "Esprit d'équipe et fair-play"]] },
  ];
  const GOAL_AXES = AXES.filter((a) => !a.evalOnly);
  const SKILL_LABEL = {};
  AXES.forEach((a) => a.skills.forEach(([k, l]) => { SKILL_LABEL[k] = l; }));
  const RATING_LABELS = ["", "À travailler", "En progrès", "Acquis", "Solide", "Point fort"];

  // Idées d'objectifs (un clic pour les ajouter)
  const GOAL_IDEAS = {
    technique: [
      ["Service : fiabiliser la première balle", "60 % de premières balles en match"],
      ["Coup droit : accélérer sans perdre en régularité", "10 échanges croisés puis accélération"],
      ["Revers : gagner en profondeur", "70 % des revers retombent dans les 2 derniers mètres"],
      ["Retour de service : être plus agressif sur seconde balle", "Retour placé dans le terrain 8 fois sur 10"],
    ],
    tactique: [
      ["Construire le point en trois temps", "Reconnaître et appliquer le schéma « ouvrir, accélérer, finir »"],
      ["Varier les hauteurs et les effets", "Utiliser au moins 3 variations par match"],
      ["Mieux choisir ses coups sur les points importants", "Moins de fautes directes aux scores clés"],
    ],
    physique: [
      ["Améliorer l'endurance", "Test de course : +1 palier d'ici la fin du trimestre"],
      ["Gagner en vitesse de déplacement", "Split-step systématique sur chaque frappe adverse"],
      ["Renforcer le gainage et l'épaule", "3 séances de préparation physique par semaine"],
    ],
    mental: [
      ["Mettre en place une routine entre les points", "Routine respectée sur 8 points sur 10"],
      ["Gérer la frustration après une faute", "Réagir en 5 secondes, sans geste d'humeur"],
      ["Rester combatif quand le score est défavorable", "Ne jamais baisser les bras avant la fin du match"],
    ],
  };

  // ---------- Saisons et trimestres ----------
  // Saison de septembre à août. T1 : sept.–déc. · T2 : janv.–mars · T3 : avril–août
  function seasonOf(date) {
    const d = date ? new Date(date) : new Date();
    const y = d.getFullYear();
    return d.getMonth() >= 8 ? y + "-" + (y + 1) : (y - 1) + "-" + y;
  }
  function trimesterOf(date) {
    const m = (date ? new Date(date) : new Date()).getMonth();
    return m >= 8 ? 1 : m <= 2 ? 2 : 3;
  }
  const current = () => ({ season: seasonOf(), t: trimesterOf() });
  function previousPeriod(season, t) {
    if (t > 1) return { season, t: t - 1 };
    const start = Number(season.slice(0, 4));
    return { season: (start - 1) + "-" + start, t: 3 };
  }
  function nextPeriod(season, t) {
    if (t < 3) return { season, t: t + 1 };
    const start = Number(season.slice(0, 4));
    return { season: (start + 1) + "-" + (start + 2), t: 1 };
  }
  function trimesterRange(season, t) {
    const y = Number(season.slice(0, 4));
    if (t === 1) return [new Date(y, 8, 1), new Date(y, 11, 31, 23, 59, 59)];
    if (t === 2) return [new Date(y + 1, 0, 1), new Date(y + 1, 2, 31, 23, 59, 59)];
    return [new Date(y + 1, 3, 1), new Date(y + 1, 7, 31, 23, 59, 59)];
  }
  const inPeriod = (date, season, t) => { const [a, b] = trimesterRange(season, t); const d = new Date(date); return d >= a && d <= b; };
  const periodLabel = (season, t) => "Trimestre " + t + " · " + season.replace("-", "/");
  const TRIMESTER_MONTHS = { 1: "septembre – décembre", 2: "janvier – mars", 3: "avril – août" };

  // ---------- Joueurs ----------
  const players = () => read("comp.players", []);
  const savePlayers = (list) => write("comp.players", list);
  const player = (id) => players().find((p) => p.id === id);
  function addPlayer(data) {
    const p = { id: uid(), created: new Date().toISOString(), ...data };
    savePlayers([...players(), p]);
    return p;
  }
  function updatePlayer(id, changes) {
    savePlayers(players().map((p) => (p.id === id ? { ...p, ...changes } : p)));
  }
  async function deletePlayer(id) {
    for (const v of CC.videos().filter((x) => x.playerId === id)) await CC.removeVideo(v.id);
    savePlayers(players().filter((p) => p.id !== id));
    remove("comp.evals." + id); remove("comp.matches." + id); remove("comp.analyses." + id);
    Object.keys(localStorage).filter((k) => k.indexOf("courtcoach.comp.goals." + id + ".") === 0).forEach((k) => localStorage.removeItem(k));
  }
  const fullName = (p) => p ? [p.prenom, p.nom].filter(Boolean).join(" ").trim() || "Joueur sans nom" : "Joueur";
  const initials = (p) => ((p && p.prenom ? p.prenom[0] : "") + (p && p.nom ? p.nom[0] : "")).toUpperCase() || "?";
  function avatarColor(id) {
    const palette = ["#b8471f", "#2a6fb0", "#2f8f5b", "#7a4cc2", "#c08a00", "#c2406f"];
    let n = 0; for (const c of String(id)) n = (n * 31 + c.charCodeAt(0)) >>> 0;
    return palette[n % palette.length];
  }
  // Catégorie d'âge : année de la saison (2e année) moins année de naissance
  function category(p, season) {
    if (!p || !p.naissance) return "";
    const age = Number((season || seasonOf()).slice(5)) - new Date(p.naissance).getFullYear();
    return age <= 8 ? "8 ans et moins" : age + " ans";
  }

  // ---------- Objectifs de l'année ----------
  const goals = (pid, season) => read("comp.goals." + pid + "." + season, []);
  const saveGoals = (pid, season, list) => write("comp.goals." + pid + "." + season, list);
  const goalsProgress = (list) => (list.length ? Math.round(list.reduce((s, g) => s + (g.progress || 0), 0) / list.length) : null);

  // ---------- Évaluations trimestrielles ----------
  const evalsAll = (pid) => read("comp.evals." + pid, {});
  const evalKey = (season, t) => season + "." + t;
  const emptyEval = () => ({ ratings: {}, comments: {}, strengths: "", improve: "", next: "", appreciation: "" });
  const getEval = (pid, season, t) => Object.assign(emptyEval(), evalsAll(pid)[evalKey(season, t)] || {});
  function saveEval(pid, season, t, data) {
    const all = evalsAll(pid);
    all[evalKey(season, t)] = data;
    write("comp.evals." + pid, all);
  }
  const hasEval = (pid, season, t) => !!evalsAll(pid)[evalKey(season, t)];
  const allSkillKeys = () => AXES.flatMap((a) => a.skills.map(([k]) => k));
  const completion = (ev) => Math.round((allSkillKeys().filter((k) => ev.ratings[k]).length / allSkillKeys().length) * 100);
  // Moyenne d'un axe (sur 5) ou null si rien n'est noté
  function axisAverage(ev, axisKey) {
    const axis = AXES.find((a) => a.key === axisKey);
    const vals = axis.skills.map(([k]) => ev.ratings[k]).filter(Boolean);
    return vals.length ? vals.reduce((s, v) => s + v, 0) / vals.length : null;
  }
  function overallAverage(ev) {
    const vals = allSkillKeys().map((k) => ev.ratings[k]).filter(Boolean);
    return vals.length ? vals.reduce((s, v) => s + v, 0) / vals.length : null;
  }
  // Les périodes qui ont des évaluations, de la plus récente à la plus ancienne
  function evaluatedPeriods(pid) {
    return Object.keys(evalsAll(pid)).map((k) => { const [season, t] = k.split("."); return { season, t: Number(t) }; })
      .sort((a, b) => (b.season + b.t).localeCompare(a.season + a.t));
  }

  // ---------- Matchs et tournois ----------
  const matches = (pid) => read("comp.matches." + pid, []);
  const saveMatches = (pid, list) => write("comp.matches." + pid, list);
  const matchesIn = (pid, season, t) => matches(pid).filter((m) => inPeriod(m.date, season, t)).sort((a, b) => a.date.localeCompare(b.date));

  // ---------- Analyses vidéo enregistrées dans le dossier ----------
  const analyses = (pid) => read("comp.analyses." + pid, []);
  const saveAnalyses = (pid, list) => write("comp.analyses." + pid, list);
  function addAnalysis(pid, data) {
    const item = { id: uid(), date: new Date().toISOString(), ...data };
    saveAnalyses(pid, [...analyses(pid), item]);
    return item;
  }
  const analysesIn = (pid, season, t) => analyses(pid).filter((a) => inPeriod(a.date, season, t)).sort((a, b) => a.date.localeCompare(b.date));

  // Vidéos d'un joueur
  const videosOf = (pid) => CC.videos().filter((v) => v.playerId === pid).sort((a, b) => b.date.localeCompare(a.date));

  // ---------- Appréciation proposée automatiquement ----------
  function suggestAppreciation(p, season, t) {
    const ev = getEval(p.id, season, t);
    const prevP = previousPeriod(season, t);
    const prev = hasEval(p.id, prevP.season, prevP.t) ? getEval(p.id, prevP.season, prevP.t) : null;
    const name = p.prenom || "Le joueur";
    const parts = [];
    const overall = overallAverage(ev);
    if (overall === null) return name + " n'a pas encore été évalué(e) ce trimestre : commence par noter quelques compétences.";

    // Bilan général
    const level = overall >= 4 ? "un très bon trimestre" : overall >= 3 ? "un trimestre solide" : overall >= 2 ? "un trimestre de progression" : "un trimestre de mise en route";
    parts.push(name + " a réalisé " + level + ".");

    // Points forts : compétences notées 4-5
    const strong = allSkillKeys().filter((k) => (ev.ratings[k] || 0) >= 4).map((k) => SKILL_LABEL[k].toLowerCase());
    if (strong.length) parts.push("Ses points forts : " + strong.slice(0, 4).join(", ") + ".");

    // Évolution par rapport au trimestre précédent
    if (prev) {
      const up = allSkillKeys().filter((k) => ev.ratings[k] && prev.ratings[k] && ev.ratings[k] > prev.ratings[k]).map((k) => SKILL_LABEL[k].toLowerCase());
      const down = allSkillKeys().filter((k) => ev.ratings[k] && prev.ratings[k] && ev.ratings[k] < prev.ratings[k]).map((k) => SKILL_LABEL[k].toLowerCase());
      if (up.length) parts.push("Progrès notables par rapport au trimestre précédent : " + up.slice(0, 4).join(", ") + ".");
      if (down.length) parts.push("À surveiller : " + down.slice(0, 3).join(", ") + " (en recul).");
    }

    // À travailler : compétences notées 1-2
    const weak = allSkillKeys().filter((k) => ev.ratings[k] && ev.ratings[k] <= 2).map((k) => SKILL_LABEL[k].toLowerCase());
    if (weak.length) parts.push("Axes de travail prioritaires : " + weak.slice(0, 3).join(", ") + ".");

    // Objectifs et compétition
    const g = goals(p.id, season);
    const gp = goalsProgress(g);
    if (gp !== null) parts.push("Objectifs de l'année atteints à " + gp + " % en moyenne.");
    const ms = matchesIn(p.id, season, t);
    if (ms.length) {
      const wins = ms.filter((m) => m.bilan === "Victoire").length;
      parts.push("En compétition : " + ms.length + " match" + (ms.length > 1 ? "s" : "") + " joué" + (ms.length > 1 ? "s" : "") + ", " + wins + " victoire" + (wins > 1 ? "s" : "") + ".");
    }
    const att = axisAverage(ev, "attitude");
    if (att !== null && att >= 4) parts.push("Son état d'esprit et son sérieux à l'entraînement sont exemplaires.");
    parts.push("Bravo pour son investissement, on continue !");
    return parts.join(" ");
  }

  // Texte brut du bulletin (pour le copier dans un e-mail)
  function bulletinText(p, season, t) {
    const ev = getEval(p.id, season, t);
    const lines = [];
    lines.push("BULLETIN TRIMESTRIEL — Tennis Club Houdan");
    lines.push(fullName(p) + " · " + periodLabel(season, t));
    lines.push("");
    AXES.forEach((a) => {
      const avg = axisAverage(ev, a.key);
      lines.push(a.label.toUpperCase() + (avg !== null ? " — " + avg.toFixed(1).replace(".", ",") + " / 5" : ""));
      a.skills.forEach(([k, l]) => { if (ev.ratings[k]) lines.push("  • " + l + " : " + ev.ratings[k] + "/5 (" + RATING_LABELS[ev.ratings[k]] + ")"); });
      if (ev.comments[a.key]) lines.push("  " + ev.comments[a.key]);
      lines.push("");
    });
    const g = goals(p.id, season);
    if (g.length) {
      lines.push("OBJECTIFS DE L'ANNÉE");
      g.forEach((x) => lines.push("  • [" + (GOAL_AXES.find((a) => a.key === x.axis) || {}).label + "] " + x.title + " — " + (x.progress || 0) + " %"));
      lines.push("");
    }
    if (ev.strengths) { lines.push("POINTS FORTS", ev.strengths, ""); }
    if (ev.improve) { lines.push("À TRAVAILLER", ev.improve, ""); }
    if (ev.next) { lines.push("OBJECTIFS DU TRIMESTRE SUIVANT", ev.next, ""); }
    if (ev.appreciation) { lines.push("APPRÉCIATION DU COACH", ev.appreciation); }
    return lines.join("\n");
  }

  // ---------- Joueurs d'exemple (fictifs) ----------
  async function addExamples() {
    if (players().some((p) => p.example)) return 0;
    const cur = current();
    const prev = previousPeriod(cur.season, cur.t);
    const prev2 = previousPeriod(prev.season, prev.t);
    const prev3 = previousPeriod(prev2.season, prev2.t);
    const startY = Number(cur.season.slice(0, 4));
    const defs = [
      { prenom: "Léo", nom: "Exemple", naissance: (startY - 11) + "-03-14", sexe: "H", classement: "30/2", objectifClassement: "30", main: "Droitier", revers: "À deux mains", taille: "148", club: "Tennis Club Houdan", style: "Régulier, bon défenseur", sante: "Rien à signaler", parent_nom: "Parent Exemple", parent_tel: "", parent_email: "", seances: "3 entraînements + 1 match par semaine", dispos: "Mercredi, samedi",
        base: [2, 2, 2, 3, 2, 3, 2, 2, 2, 2, 3, 3, 2, 3, 3, 3, 2, 3, 3, 4, 4, 4] },
      { prenom: "Nina", nom: "Exemple", naissance: (startY - 13) + "-09-02", sexe: "F", classement: "15/4", objectifClassement: "15/2", main: "Gauchère", revers: "À une main", taille: "158", club: "Tennis Club Houdan", style: "Offensive, aime monter au filet", sante: "Épaule droite à surveiller", parent_nom: "Parent Exemple", parent_tel: "", parent_email: "", seances: "4 entraînements + tournois le week-end", dispos: "Mardi, jeudi, samedi",
        base: [3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 4, 3, 3, 4, 3, 3, 3, 4, 4, 4, 5] },
      { prenom: "Hugo", nom: "Exemple", naissance: (startY - 15) + "-05-21", sexe: "H", classement: "15/1", objectifClassement: "5/6", main: "Droitier", revers: "À deux mains", taille: "176", club: "Tennis Club Houdan", style: "Joueur de fond de court, frappe lourde", sante: "Genou gauche : renforcement en cours", parent_nom: "Parent Exemple", parent_tel: "", parent_email: "", seances: "5 entraînements + préparation physique", dispos: "Tous les soirs sauf vendredi",
        base: [4, 3, 4, 3, 3, 4, 3, 4, 4, 3, 4, 4, 4, 3, 4, 4, 3, 4, 3, 4, 5, 4] },
    ];
    const skillKeys = allSkillKeys();
    const mkRatings = (base, bump) => {
      const r = {};
      skillKeys.forEach((k, i) => { r[k] = Math.max(1, Math.min(5, base[i] + (bump(i) || 0))); });
      return r;
    };
    // Les données d'exemple d'évolution : trois trimestres passés, puis le trimestre en cours à moitié rempli
    const periods = [
      { p: prev3, bump: () => -1, text: "Rentrée de la saison précédente : bases à consolider." },
      { p: prev2, bump: (i) => (i % 3 === 0 ? 0 : -1), text: "Bonne dynamique en cours de saison." },
      { p: prev, bump: (i) => (i % 4 === 0 ? 1 : 0), text: "Belle fin de saison, de vrais progrès sur les points travaillés." },
    ];

    // Vidéos d'exemple : les deux petites vidéos fictives (les mêmes fichiers servent à plusieurs vidéos)
    let sharedA = null, sharedB = null;
    try {
      const a = await fetch("demo/exemple-eleve.webm"); const b = await fetch("demo/exemple-modele.webm");
      if (a.ok && b.ok) { sharedA = await CC.putFile(await a.blob()); sharedB = await CC.putFile(await b.blob()); }
    } catch (e) { /* les vidéos d'exemple sont facultatives */ }
    const daysAgo = (n) => new Date(Date.now() - n * 86400000).toISOString();

    let count = 0;
    for (const d of defs) {
      const { base, ...info } = d;
      const p = addPlayer({ ...info, example: true });
      count += 1;
      periods.forEach(({ p: per, bump, text }) => {
        const ev = emptyEval();
        ev.ratings = mkRatings(base, bump);
        AXES.forEach((a) => { ev.comments[a.key] = a.key === "mental" ? "Travail régulier sur la routine entre les points." : ""; });
        ev.strengths = "Sérieux, régularité des frappes, bon esprit d'équipe.";
        ev.improve = "Accélérer les coups gagnants, mieux utiliser les variations.";
        ev.next = "Fiabiliser le service et gagner en profondeur.";
        ev.appreciation = p.prenom + " : " + text;
        saveEval(p.id, per.season, per.t, ev);
      });
      // Trimestre en cours : quelques compétences déjà notées
      const evNow = emptyEval();
      const part = mkRatings(base, (i) => (i % 3 === 0 ? 1 : 0));
      skillKeys.slice(0, 9).forEach((k) => { evNow.ratings[k] = part[k]; });
      saveEval(p.id, cur.season, cur.t, evNow);

      // Objectifs de la saison en cours (progression variée)
      saveGoals(p.id, cur.season, [
        { id: uid(), axis: "technique", title: "Service : fiabiliser la première balle", indicator: "60 % de premières balles en match", deadline: (startY + 1) + "-03-31", progress: 35 },
        { id: uid(), axis: "technique", title: "Revers : gagner en profondeur", indicator: "70 % des revers dans les 2 derniers mètres", deadline: (startY + 1) + "-06-30", progress: 20 },
        { id: uid(), axis: "tactique", title: "Construire le point en trois temps", indicator: "Appliquer « ouvrir, accélérer, finir »", deadline: (startY + 1) + "-02-28", progress: 50 },
        { id: uid(), axis: "physique", title: "Améliorer l'endurance", indicator: "+1 palier au test de course", deadline: (startY + 1) + "-01-31", progress: 65 },
        { id: uid(), axis: "mental", title: "Mettre en place une routine entre les points", indicator: "Routine respectée 8 points sur 10", deadline: (startY + 1) + "-01-31", progress: 40 },
      ]);
      // Matchs
      saveMatches(p.id, [
        { id: uid(), date: daysAgo(160).slice(0, 10), tournoi: "Tournoi du club", tour: "Demi-finale", bilan: "Victoire", score: "6/3 6/4", remarque: "Très bon service." },
        { id: uid(), date: daysAgo(100).slice(0, 10), tournoi: "Tournoi départemental", tour: "Quart de finale", bilan: "Défaite", score: "4/6 6/7", remarque: "Trop de fautes sur les points importants." },
        { id: uid(), date: daysAgo(12).slice(0, 10), tournoi: "Rencontre par équipes", tour: "Poule", bilan: "Victoire", score: "6/2 6/1", remarque: "Match maîtrisé." },
      ]);
      // Vidéos et analyses
      if (sharedA && sharedB) {
        const v1 = { id: uid(), fileId: sharedA, owner: "coach", playerId: p.id, studentId: null, title: "Coup droit — rentrée", shot: "coup_droit", question: "", date: daysAgo(34), size: 535000, status: "suivi", seen: true, example: "joueur" };
        const v2 = { id: uid(), fileId: sharedB, owner: "coach", playerId: p.id, studentId: null, title: "Coup droit — fin septembre", shot: "coup_droit", question: "", date: daysAgo(3), size: 524000, status: "suivi", seen: true, example: "joueur" };
        CC.saveVideos([...CC.videos(), v1, v2]);
        const first = addAnalysis(p.id, { videoId: v1.id, videoTitle: v1.title, shot: "coup_droit", observation: "Préparation un peu tardive, coude trop près du corps à l'impact.", strengths: "Bons appuis, bonne rotation d'épaules.", improve: "Laisser de l'espace entre le coude et le buste, frapper plus devant.", exercises: [{ title: "Balle lâchée (drop-feed)", detail: "Concentre-toi sur un impact devant toi.", reps: "3 × 12 balles" }], captures: [], captureNotes: {} });
        const second = addAnalysis(p.id, { videoId: v2.id, videoTitle: v2.title, shot: "coup_droit", observation: "Net progrès : le point d'impact est plus avancé et le bras plus libre.", strengths: "Impact devant, geste plus fluide.", improve: "Continuer à accompagner le geste vers l'avant.", exercises: [], captures: [], captureNotes: {} });
        const all = analyses(p.id).map((a) => (a.id === first.id ? { ...a, date: daysAgo(33) } : a.id === second.id ? { ...a, date: daysAgo(2) } : a));
        saveAnalyses(p.id, all);
      }
    }
    return count;
  }

  return {
    AXES, GOAL_AXES, SKILL_LABEL, RATING_LABELS, GOAL_IDEAS, TRIMESTER_MONTHS,
    seasonOf, trimesterOf, current, previousPeriod, nextPeriod, trimesterRange, inPeriod, periodLabel,
    players, player, addPlayer, updatePlayer, deletePlayer, fullName, initials, avatarColor, category,
    goals, saveGoals, goalsProgress,
    getEval, saveEval, hasEval, completion, axisAverage, overallAverage, evaluatedPeriods, allSkillKeys,
    matches, saveMatches, matchesIn,
    analyses, saveAnalyses, addAnalysis, analysesIn, videosOf,
    suggestAppreciation, bulletinText, addExamples,
  };
})();

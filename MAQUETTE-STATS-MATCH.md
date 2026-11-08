# Maquette : statistiques d'un match (MIS DE CÔTÉ, à mettre sur le site plus tard)

Décision du coach (7/11/2026) : « garde bien ça, on veut le mettre sur le site plus tard ». Rien à coder avant son feu vert.
Maquette cliquable privée : https://claude.ai/artifact/5QAQbu5s6dEnqEyp54NBHp (le code complet de la maquette est reproduit plus bas pour ne rien perdre).

## À quoi ça sert
Le coach regarde un match d'un joueur du Centre et saisit les points au téléphone. Le site calcule les statistiques et écrit un bilan. Aucune IA, aucun service extérieur : tout est calculé dans le navigateur.

## Saisie (un point à la fois, très gros boutons)
1. **Service** (pour celui qui sert, joueur OU adversaire) : 1re balle : Ace / Dedans / Faute ; après une faute, 2e balle : Ace / Dedans / Double faute. Lien « Je n'ai pas suivi le service : passer ».
2. **Échange** : on touche un terrain de tennis dessiné aux vraies proportions : côté du joueur (vert) ou de l'adversaire (rouge) = qui gagne le point.
3. **Résultat** : coup gagnant, faute directe ou faute provoquée (pour l'adversaire : pas de coup précisé) ; puis, pour le joueur, **quel coup** : retour, coup droit, revers, volée, smash, passing, lob, amorti (pictogrammes).
4. Bouton « 😤 Il s'énerve » toujours visible en bas (compte les moments d'énervement) et bouton « Retour / Annuler ».
5. Le **prénom** du joueur (choisi parmi les jeunes du Centre) remplace « le joueur » partout. Jamais de nom d'adversaire, seulement son classement.
6. Bandeau en direct : % de 1res balles, points gagnés sur 1re balle, aces, doubles fautes.

## Bilan généré
- Score, % de points gagnés, coups gagnants / fautes directes, fautes provoquées, aces / doubles fautes, énervements.
- Tableau coup par coup (vert gagnants, rouge fautes directes, orange fautes provoquées) ; la note d'un coup ne compte que les fautes directes ; ligne « Adversaire » pour information.
- « État d'esprit » : nombre d'énervements et % de points gagnés dans les 3 points qui suivent comparé au reste du match.
- Service et retour **comparés côte à côte** (joueur / adversaire) : 1res balles, points sur 1re et 2e balle, retour, balles de break converties et sauvées, aces, doubles fautes ; pastille Bien / Moyen / À travailler pour le joueur d'après des repères de niveau compétition jeunes (réglables).
- Lecture du match en phrases, points forts, à travailler, courbe du fil du match avec les énervements.

## Règles à respecter quand on le construit
- Données d'un MINEUR : visibles du coach et des entraîneurs de CE joueur seulement ; le jeune et sa famille ne le voient que si le coach le décide ; routes protégées + test dans `apps/api/test` + test « un adulte n'a AUCUN accès » étendu.
- Aucun nom d'adversaire ; effacement avec la fiche du joueur et après 12 mois ; `REGISTRE-TRAITEMENTS.md` et `confidentialite.html` à mettre à jour.
- Première version possible : sans enregistrement (comme les affiches de bilan), puis enregistrement dans la fiche du joueur et comparaison entre deux matchs, puis proposition de mission d'après le coup le plus fragile.
- Idée écartée pour l'instant : différence faute directe / provoquée supprimée puis remise ; durée des échanges et zone du terrain (mode « avancé ») pas faits.

## Code complet de la maquette (HTML, à ouvrir tel quel dans un navigateur)

```html
<title>Stats de match</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@500;600;700&family=Archivo:wght@400;500;600;700;800&display=swap">
<style>
/* Concept : on répond à une question à la fois, avec de très gros boutons. Qui gagne ? Comment ? Quel coup ? */
:root{
  --bg:#f6f2ea; --card:#fffdf8; --fg:#17140f; --muted:#6b6355; --line:#ddd2bc;
  --accent:#8a6a2f; --accent-soft:#efe4cb; --win:#2f6b4a; --win-soft:#dcebe1; --loss:#a3412a; --loss-soft:#f3dcd4;
  --forced:#a15c07; --forced-soft:#f6e3c0; --mid:#9a7416; --mid-soft:#f2e6c2;
  --tilt:#c2410c; --tilt-soft:#fde4d2; --ink:#17140f; --on-ink:#fbf8f2;
  --serif:"Cormorant Garamond",Georgia,serif; --sans:"Archivo",system-ui,-apple-system,"Segoe UI",sans-serif;
}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){
  --bg:#12100c; --card:#1c1913; --fg:#f3ede0; --muted:#a79e8b; --line:#3a3427;
  --accent:#d3b274; --accent-soft:#2c2616; --win:#6fc596; --win-soft:#173325; --loss:#e48a72; --loss-soft:#3a1d15;
  --forced:#e9a94a; --forced-soft:#3a2a10; --mid:#e0bb57; --mid-soft:#352b10;
  --tilt:#fb923c; --tilt-soft:#3d2010; --ink:#0a0907; --on-ink:#f3ede0; color-scheme:dark}}
:root[data-theme="dark"]{
  --bg:#12100c; --card:#1c1913; --fg:#f3ede0; --muted:#a79e8b; --line:#3a3427;
  --accent:#d3b274; --accent-soft:#2c2616; --win:#6fc596; --win-soft:#173325; --loss:#e48a72; --loss-soft:#3a1d15;
  --forced:#e9a94a; --forced-soft:#3a2a10; --mid:#e0bb57; --mid-soft:#352b10;
  --tilt:#fb923c; --tilt-soft:#3d2010; --ink:#0a0907; --on-ink:#f3ede0; color-scheme:dark}
*{box-sizing:border-box}
[hidden]{display:none!important}
body{background:var(--bg);color:var(--fg);font-family:var(--sans);font-size:16px;line-height:1.4;
  padding-block:14px 120px;padding-left:max(16px,env(safe-area-inset-left,0px));padding-right:max(16px,env(safe-area-inset-right,0px))}
.wrap{max-width:720px;margin:0 auto;display:flex;flex-direction:column;gap:12px}
h1,h2,h3{font-family:var(--serif);font-weight:600;margin:0;text-wrap:balance}
h1{font-size:28px;line-height:1.05}h2{font-size:22px}h3{font-size:19px}
.eyebrow{font-size:11px;letter-spacing:.18em;text-transform:uppercase;color:var(--accent);font-weight:600}
.sample{background:var(--accent-soft);border:1px solid var(--line);padding:8px 12px;font-size:13px}
.tabs{display:grid;grid-template-columns:1fr 1fr;border:1px solid var(--line);background:var(--card)}
.tabs button{font:inherit;font-weight:700;padding:12px 6px;border:0;background:transparent;color:var(--muted);cursor:pointer;min-height:50px}
.tabs button[aria-selected="true"]{background:var(--ink);color:var(--on-ink)}
button:focus-visible{outline:3px solid var(--accent);outline-offset:2px}
.card{background:var(--card);border:1px solid var(--line);padding:14px}
.board{background:var(--ink);color:var(--on-ink);padding:12px 14px;display:grid;gap:6px;position:sticky;top:env(safe-area-inset-top,0px);z-index:5}
.board .row{display:grid;grid-template-columns:minmax(0,1fr) auto auto auto auto;gap:4px 10px;align-items:center;font-variant-numeric:tabular-nums}
.board .who{display:flex;align-items:center;gap:8px;min-width:0;font-weight:600}
.board .who span:last-child{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.board .ball{width:10px;height:10px;border-radius:50%;background:#d6e04a;visibility:hidden;flex:none}
.board .ball.on{visibility:visible}
.board .n{font-family:var(--serif);font-size:24px;font-weight:600;text-align:center;min-width:22px}
.board .pt{font-family:var(--serif);font-size:28px;color:#e6cd94;min-width:40px;text-align:center}
.board .meta{font-size:12px;color:#b9b09c;display:flex;justify-content:space-between;gap:8px}
/* assistant de saisie */
.guide{display:flex;flex-direction:column;gap:12px}
.dots{display:flex;gap:6px;align-items:center;font-size:13px;color:var(--muted);font-weight:600}
.dots i{width:26px;height:6px;background:var(--line);display:block}
.dots i.on{background:var(--accent)}
.q{font-family:var(--serif);font-size:26px;font-weight:700;line-height:1.1}
.crumb{font-size:14px;color:var(--muted);min-height:20px}
.crumb b{color:var(--fg)}
.big{display:grid;gap:10px}
.cta{font:inherit;text-align:left;border:2px solid var(--line);background:var(--card);color:var(--fg);padding:14px 16px;min-height:76px;cursor:pointer;display:grid;gap:2px;width:100%}
.cta b{font-size:19px;font-weight:800;line-height:1.15}
.cta span{font-size:14px;font-weight:500;opacity:.9}
.cta.w{background:var(--win-soft);border-color:var(--win);color:var(--win)}
.cta.l{background:var(--loss-soft);border-color:var(--loss);color:var(--loss)}
.cta.o{background:var(--forced-soft);border-color:var(--forced);color:var(--forced)}
.cta:active{transform:translateY(1px)}
.cta.huge{min-height:96px}.cta.huge b{font-size:22px}
.sub{font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:var(--muted);font-weight:700;margin-top:4px}
.seg{display:grid;grid-template-columns:1fr 1fr;border:1px solid var(--line)}
.seg button{font:inherit;font-weight:700;padding:10px;border:0;background:var(--card);color:var(--muted);min-height:48px;cursor:pointer}
.seg button[aria-pressed="true"]{background:var(--accent);color:#fff}
.shotgrid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}
.shotgrid .cta{min-height:70px;text-align:center;padding:10px 6px;align-content:center}
.shotgrid .cta b{font-size:16px}
.memo{font-size:13px;color:var(--muted);border-left:3px solid var(--line);padding-left:10px}
.memo b{color:var(--fg)}
.bar{position:fixed;left:0;right:0;bottom:0;z-index:20;background:var(--card);border-top:1px solid var(--line);
  padding:10px max(16px,env(safe-area-inset-right,0px)) calc(10px + env(safe-area-inset-bottom,0px)) max(16px,env(safe-area-inset-left,0px))}
.bar .in{max-width:720px;margin:0 auto;display:grid;grid-template-columns:1fr auto;gap:8px}
.tilt{font:inherit;font-weight:800;font-size:17px;border:2px solid var(--tilt);background:var(--tilt-soft);color:var(--tilt);min-height:58px;cursor:pointer}
.tilt small{display:block;font-weight:500;font-size:12px}
.undo{font:inherit;font-weight:700;border:1px solid var(--line);background:var(--card);color:var(--fg);min-width:104px;cursor:pointer}
.last{font-size:13px;color:var(--muted);min-height:20px}
.actions{display:flex;gap:8px;flex-wrap:wrap}
.ghost{font:inherit;border:1px solid var(--line);background:var(--card);color:var(--fg);padding:9px 12px;min-height:44px;cursor:pointer}
/* bilan */
.figs{display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:8px}
.fig{border:1px solid var(--line);background:var(--card);padding:10px 12px}
.fig b{display:block;font-family:var(--serif);font-size:30px;line-height:1;font-variant-numeric:tabular-nums}
.fig span{font-size:12px;color:var(--muted)}
.fig.t{border-color:var(--tilt);background:var(--tilt-soft)}.fig.t b{color:var(--tilt)}
.chip{display:inline-block;font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;padding:2px 8px}
.chip.good{background:var(--win-soft);color:var(--win)}.chip.mid{background:var(--mid-soft);color:var(--mid)}.chip.bad{background:var(--loss-soft);color:var(--loss)}.chip.na{background:var(--accent-soft);color:var(--muted)}
.legend{display:flex;gap:12px;flex-wrap:wrap;font-size:13px;margin:4px 0 6px}
.legend span{display:flex;gap:6px;align-items:center}
.legend i{width:12px;height:12px;display:block}
.tr{display:grid;grid-template-columns:minmax(84px,.9fr) 2fr auto;gap:6px 10px;align-items:center;padding:9px 0;border-top:1px solid var(--line)}
.tr:first-child{border-top:0}
.tr .nm{font-weight:700}
.tr .num{font-size:12px;color:var(--muted);font-variant-numeric:tabular-nums}
.split{display:flex;height:12px;background:var(--accent-soft);overflow:hidden}
.split i{display:block;height:100%}
.gw{background:var(--win)}.gu{background:var(--loss)}.gf{background:var(--forced)}
.meter{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:4px 10px;padding:10px 0;border-top:1px solid var(--line)}
.meter:first-of-type{border-top:0}
.meter .lab{font-weight:600}.meter .val{font-variant-numeric:tabular-nums;font-weight:700}
.meter .pbar{grid-column:1/-1;height:8px;background:var(--accent-soft);position:relative}
.meter .pbar i{position:absolute;left:0;top:0;bottom:0;background:var(--accent)}
.meter .pbar u{position:absolute;top:-3px;bottom:-3px;width:2px;background:var(--fg);opacity:.55}
.meter .sm{grid-column:1/-1;font-size:12px;color:var(--muted)}
.two{display:grid;gap:12px;grid-template-columns:repeat(auto-fit,minmax(240px,1fr))}
.two ul{margin:8px 0 0;padding-left:18px;display:flex;flex-direction:column;gap:6px}
.read p{margin:0 0 8px}
.hint{font-size:14px;color:var(--muted);margin:0}
svg{width:100%;height:auto;display:block}
.later{border:1px dashed var(--accent);padding:12px 14px;font-size:13px;color:var(--muted)}
.later b{color:var(--fg)}
.score-big{font-family:var(--serif);font-size:38px;line-height:1;font-variant-numeric:tabular-nums}
@media (max-width:380px){.shotgrid .cta b{font-size:14px}.q{font-size:23px}}
@media (prefers-reduced-motion:reduce){.cta:active{transform:none}}

/* v4 : terrain à toucher, tuiles avec pictogrammes */
.board{border-bottom:3px solid #b8975a}
.courtpick{position:relative;aspect-ratio:2617/1337;width:100%;overflow:hidden;background:#8c3f1c;border:1px solid var(--line)}
.courtpick svg{position:absolute;inset:0;width:100%;height:100%}
.courtpick button{position:absolute;top:0;bottom:0;width:50%;border:0;background:transparent;cursor:pointer;color:#fff;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;padding:0 6px 12px;font:inherit;gap:2px}
.courtpick button.l{left:0;background:linear-gradient(0deg,rgba(24,98,58,.78),rgba(24,98,58,.18) 70%)}
.courtpick button.r{right:0;background:linear-gradient(0deg,rgba(150,40,22,.78),rgba(150,40,22,.18) 70%)}
.courtpick button:active{filter:brightness(1.15)}
.courtpick button b{font-family:var(--serif);font-size:30px;line-height:1;text-shadow:0 1px 6px rgba(0,0,0,.45)}
.courtpick button span{font-size:13px;font-weight:700;letter-spacing:.04em;text-shadow:0 1px 4px rgba(0,0,0,.5)}
.courtpick .chk{font-size:12px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;background:rgba(0,0,0,.28);padding:3px 8px;margin-bottom:4px}
.tip{font-size:14px;color:var(--muted);text-align:center;margin:0}
.who{display:flex;align-items:center;gap:10px;padding:10px 12px;font-weight:800;font-size:17px}
.who.w{background:var(--win);color:#fff}.who.l{background:var(--loss);color:#fff}
.who small{font-weight:500;font-size:13px;opacity:.9;margin-left:auto}
.tile{font:inherit;text-align:left;border:2px solid var(--line);background:var(--card);color:var(--fg);cursor:pointer;display:grid;grid-template-columns:44px 1fr;gap:12px;align-items:center;padding:12px 14px;min-height:78px;width:100%}
.tile .ic{width:44px;height:44px;display:grid;place-items:center;background:var(--accent-soft);color:var(--fg)}
.tile b{font-size:18px;font-weight:800;line-height:1.15;display:block}
.tile span.d{font-size:14px;font-weight:500;opacity:.85}
.tile.w{border-color:var(--win)}.tile.w .ic{background:var(--win);color:#fff}
.tile.l{border-color:var(--loss)}.tile.l .ic{background:var(--loss);color:#fff}
.tile.o{border-color:var(--forced)}.tile.o .ic{background:var(--forced);color:#fff}
.tile:active{transform:translateY(1px)}
.shotgrid .shot{font:inherit;border:2px solid var(--line);background:var(--card);color:var(--fg);cursor:pointer;display:grid;justify-items:center;gap:4px;padding:10px 4px;min-height:98px}
.shotgrid .shot b{font-size:15px;font-weight:800}
.shotgrid .shot svg{width:44px;height:44px;color:inherit}
.shotgrid .shot.w{border-color:var(--win);color:var(--win);background:var(--win-soft)}
.shotgrid .shot.l{border-color:var(--loss);color:var(--loss);background:var(--loss-soft)}
.shotgrid .shot.o{border-color:var(--forced);color:var(--forced);background:var(--forced-soft)}
.shotgrid .shot:active{transform:translateY(1px)}
.back{font:inherit;font-weight:700;background:none;border:0;color:var(--accent);padding:6px 0;text-align:left;cursor:pointer;font-size:14px}
.last{background:var(--win-soft);color:var(--win);padding:8px 12px;font-weight:600;border-left:4px solid var(--win)}
.last:empty{display:none}

/* v6 : service complet (1re et 2e balle) pour les deux joueurs, tableau comparatif */
.phases{display:grid;grid-template-columns:repeat(3,1fr);gap:0;border:1px solid var(--line);font-size:12px;font-weight:800;letter-spacing:.1em;text-transform:uppercase}
.phases span{padding:8px 4px;text-align:center;color:var(--muted);background:var(--card)}
.phases span.on{background:var(--ink);color:var(--on-ink)}
.phases span.done{color:var(--win)}
.svhead{display:flex;align-items:center;gap:12px;background:var(--ink);color:var(--on-ink);padding:12px 14px}
.svhead .num{font-family:var(--serif);font-size:44px;line-height:1;color:#e6cd94;min-width:34px;text-align:center}
.svhead b{display:block;font-size:18px}
.svhead small{display:block;font-size:13px;color:#b9b09c}
.svbtns{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}
.svb{font:inherit;border:2px solid var(--line);background:var(--card);color:var(--fg);cursor:pointer;display:grid;justify-items:center;align-content:center;gap:4px;padding:12px 4px;min-height:112px;text-align:center}
.svb b{font-size:17px;font-weight:800;line-height:1.1}
.svb span{font-size:12px;font-weight:500;opacity:.85}
.svb svg{width:40px;height:40px}
.svb.w{border-color:var(--win);background:var(--win-soft);color:var(--win)}
.svb.l{border-color:var(--loss);background:var(--loss-soft);color:var(--loss)}
.svb.n{border-color:var(--accent);background:var(--accent-soft);color:var(--fg)}
.svb:active{transform:translateY(1px)}
.skip{font:inherit;font-size:13px;background:none;border:0;color:var(--muted);text-decoration:underline;cursor:pointer;padding:6px;justify-self:center}
.live{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:6px}
.live div{background:var(--card);border:1px solid var(--line);padding:6px 8px;text-align:center}
.live b{display:block;font-family:var(--serif);font-size:22px;line-height:1.05;font-variant-numeric:tabular-nums}
.live span{font-size:11px;color:var(--muted);letter-spacing:.04em}
.h2h{display:grid;grid-template-columns:minmax(0,1.5fr) minmax(0,1fr) minmax(0,1fr);gap:0 10px;align-items:center}
.h2h .hd{font-size:12px;letter-spacing:.1em;text-transform:uppercase;font-weight:800;color:var(--muted);padding-bottom:6px;border-bottom:2px solid var(--ink)}
.h2h .lb{padding:10px 0;border-top:1px solid var(--line);font-weight:600;font-size:14px}
.h2h .cell{padding:10px 0;border-top:1px solid var(--line);font-variant-numeric:tabular-nums}
.h2h .cell b{font-size:18px;font-family:var(--serif);display:block;line-height:1}
.h2h .cell .bar2{height:5px;background:var(--accent-soft);margin-top:5px;position:relative}
.h2h .cell .bar2 i{position:absolute;left:0;top:0;bottom:0;background:var(--accent)}
.h2h .cell.o .bar2 i{background:var(--muted)}
.h2h .cell small{font-size:11px;color:var(--muted)}
@media (max-width:380px){.svb b{font-size:15px}.live b{font-size:19px}}
</style>

<div class="wrap">
  <header>
    <div class="eyebrow">Centre de compétition jeunes · Maquette</div>
    <h1>Stats de match</h1>
  </header>
  <div class="sample" id="note" role="note">Match d'exemple inventé : « Joueur Exemple » est fictif et l'adversaire n'a qu'un classement. Saisissez quelques points, puis ouvrez « 2 · Le bilan ».</div>

  <div class="card" style="display:grid;gap:6px">
    <label for="pl" style="font-weight:700">Joueur du Centre suivi pendant ce match</label>
    <select id="pl" style="font:inherit;font-weight:700;padding:12px;border:1px solid var(--line);background:var(--card);color:var(--fg);min-height:48px">
      <option value="Léo">Léo (exemple)</option><option value="Nina">Nina (exemple)</option><option value="Hugo">Hugo (exemple)</option>
    </select>
    <div class="hint pickinfo" style="font-size:13px">Dans le vrai site, la liste reprend les jeunes que vous suivez (prénom seulement). Son prénom remplace partout « le joueur ».</div>
  </div>

  <div class="tabs" role="tablist" aria-label="Étapes">
    <button role="tab" id="t1" aria-selected="true" aria-controls="p1">1 · Pendant le match</button>
    <button role="tab" id="t2" aria-selected="false" aria-controls="p2">2 · Le bilan</button>
  </div>

  <section id="p1" role="tabpanel" aria-labelledby="t1" class="wrap" style="gap:10px">
    <div class="board" id="board" aria-live="polite"></div>
    <div class="live" id="live" aria-label="Statistiques du service en direct"></div>
    <div class="card guide" id="guide"></div>
    <div class="last" id="last"></div>
    <div class="actions">
      <button class="ghost" id="sample">Recharger le match d'exemple</button>
      <button class="ghost" id="reset">Repartir de zéro</button>
    </div>
  </section>

  <section id="p2" role="tabpanel" aria-labelledby="t2" class="wrap" hidden style="gap:12px">
    <div class="card" id="head"></div>
    <div class="figs" id="figs"></div>
    <div class="card">
      <h2>Les coups, un par un</h2>
      <div class="legend">
        <span><i class="gw"></i>Coup gagnant</span>
        <span><i class="gu"></i>Faute directe</span>
        <span><i class="gf"></i>Faute provoquée</span>
      </div>
      <p class="hint" style="margin:0 0 6px">Seules les fautes directes pèsent dans la note d'un coup : une faute provoquée vient de la qualité de l'adversaire.</p>
      <div id="tbl"></div>
    </div>
    <div class="card" id="mental"></div>
    <div class="card">
      <h2>Service et retour</h2>
      <p class="hint" style="margin:4px 0 6px">Le joueur à gauche, l'adversaire à droite. La pastille donne un repère de niveau compétition jeunes pour le joueur ; elle peut se régler.</p>
      <div id="meters"></div>
    </div>
    <div class="card read"><h2>Lecture du match</h2><div id="read" style="margin-top:8px"></div></div>
    <div class="two">
      <div class="card"><h3>Points forts</h3><ul id="good"></ul></div>
      <div class="card"><h3>À travailler</h3><ul id="bad"></ul></div>
    </div>
    <div class="card">
      <h3>Le fil du match</h3>
      <p class="hint" style="margin:2px 0 8px">Écart de points. Les ronds orange marquent les moments d'énervement.</p>
      <div id="chart"></div>
    </div>
    <div class="later"><b>Étape suivante possible :</b> enregistrer le match dans la fiche du joueur (visible du coach et de ses entraîneurs), comparer avec le match précédent et proposer une mission d'après le coup le plus fragile ou l'état d'esprit. Rien n'est enregistré dans cette maquette.</div>
  </section>
</div>

<div class="bar" id="bar"><div class="in">
  <button type="button" class="tilt" id="tilt">😤 Il s'énerve<small id="tiltN"></small></button>
  <button type="button" class="undo" id="undo">← Retour</button>
</div></div>

<script>
(function(){
  var FN="Léo", NAME="Léo Exemple", OPP="Adversaire classé 15/2";
  var SHOTS=[["RE","Retour"],["CD","Coup droit"],["RV","Revers"],["VO","Volée"],["SM","Smash"],["PA","Passing"],["LO","Lob"],["AM","Amorti"]];
  var ALL=[["SV","Service"]].concat(SHOTS);
  var LAB={};ALL.forEach(function(s){LAB[s[0]]=s[1];});
  var pts=[],tilts=[],hist=[],svIn=null,stage="sv1",win=null,how=null;
  // point : {who:'me'|'opp' (auteur du dernier coup), shot, kind:'W'|'U'|'F', sv}
  // W = coup gagnant, U = faute directe, F = faute provoquée
  function meWon(q){return q.kind==="W"?q.who==="me":q.who==="opp";}

  function sim(list){
    function mk(){return {pts:0,first:0,w1:0,s2:0,w2:0,ace:0,df:0};}
    var S={sets:[],g:[0,0],p:[0,0],me:true,setsWon:[0,0],over:false,
      pts:0,won:0,bpOpp:0,bpConv:0,bpFaced:0,bpSaved:0,gamesPlayed:0,diff:[0],by:{},oW:0,oU:0,oF:0,wins:[],
      sv:[mk(),mk()],rt:[{pts:0,won:0},{pts:0,won:0}]};
    ALL.forEach(function(s){S.by[s[0]]={w:0,u:0,f:0};});
    for(var i=0;i<list.length;i++){
      var q=list[i],mw=meWon(q),srv=S.me,pm=S.p[0],po=S.p[1],side=srv?0:1,swon=(side===0)===mw;
      S.pts++;if(mw)S.won++;S.wins.push(mw?1:0);
      if(q.who==="me"){var c=S.by[q.shot];if(q.kind==="W")c.w++;else if(q.kind==="U")c.u++;else c.f++;}
      else{if(q.kind==="W")S.oW++;else if(q.kind==="U")S.oU++;else S.oF++;}
      if(q.sv){
        var m=S.sv[side];m.pts++;
        if(q.sv==="1"||q.sv==="ace1"){m.first++;if(swon)m.w1++;}else{m.s2++;if(swon)m.w2++;}
        if(q.sv==="ace1"||q.sv==="ace2")m.ace++;if(q.sv==="df")m.df++;
      }
      S.rt[1-side].pts++;if(!swon)S.rt[1-side].won++;
      if(srv){if(po>=3&&po>pm){S.bpFaced++;if(mw)S.bpSaved++;}}
      else{if(pm>=3&&pm>po){S.bpOpp++;if(mw)S.bpConv++;}}
      S.diff.push(S.diff[S.diff.length-1]+(mw?1:-1));
      S.p[mw?0:1]++;
      var a=S.p[0],b=S.p[1],gw=-1;
      if(a>=4&&a-b>=2)gw=0;else if(b>=4&&b-a>=2)gw=1;
      if(gw>=0){
        S.g[gw]++;S.gamesPlayed++;S.p=[0,0];S.me=!S.me;
        var x=S.g[0],y=S.g[1];
        if((x>=6&&x-y>=2)||(y>=6&&y-x>=2)||x===7||y===7){
          S.sets.push([x,y]);S.setsWon[x>y?0:1]++;S.g=[0,0];
          if(S.setsWon[0]===2||S.setsWon[1]===2)S.over=true;
        }
      }
    }
    var A=S.sv[0];S.svcPts=A.pts;S.first=A.first;S.w1=A.w1;S.s2=A.s2;S.w2=A.w2;S.ace=A.ace;S.df=A.df;S.retPts=S.rt[0].pts;S.retWon=S.rt[0].won;
    return S;
  }
  function ptLabel(S,i){var v=["0","15","30","40"],a=S.p[i],b=S.p[1-i];
    if(a>=3&&b>=3){return a===b?"40":(a>b?"Av":"–");}return v[Math.min(a,3)];}

  // match d'exemple : à l'aise en coup droit et à la volée, fragile en revers, qui s'énerve après ses fautes
  function seeded(n){
    var s=20260711;function r(){s=(s*1664525+1013904223)>>>0;return s/4294967296;}
    function wsh(a){var t=0,i;for(i=0;i<a.length;i++)t+=a[i][1];var u=r()*t;for(i=0;i<a.length;i++){u-=a[i][1];if(u<=0)return a[i][0];}return a[0][0];}
    var out=[],tl=[],calm=0;
    for(var i=0;i<n;i++){
      var S=sim(out),q=null,me=S.me,pw=(me?.58:.4)-(calm>0?.15:0),u=r(),svx=null;
      if(u<(me?.06:.05))q=me?{who:"me",shot:"SV",kind:"W",sv:(r()<.8?"ace1":"ace2")}:{who:"opp",shot:null,kind:"W",sv:"ace1"};
      else if(u<(me?.11:.1))q=me?{who:"me",shot:"SV",kind:"U",sv:"df"}:{who:"opp",shot:null,kind:"U",sv:"df"};
      else svx=r()<(me?.62:.58)?"1":"2";
      if(!q){
        var win=r()<pw+(svx==="2"?(me?-.1:.1):0);
        if(win){var t=r();
          if(t<.62)q={who:"me",shot:wsh([["CD",5],["VO",3],["SM",2],["PA",2],["RE",me?0:3],["RV",1],["LO",1]]),kind:"W",sv:svx};
          else if(t<.85)q={who:"opp",shot:null,kind:"U",sv:svx};
          else q={who:"opp",shot:null,kind:"F",sv:svx};
        }else{var t2=r();
          if(t2<.42)q={who:"me",shot:wsh([["RV",6],["CD",2],["RE",me?0:3],["AM",1],["LO",1]]),kind:"U",sv:svx};
          else if(t2<.6)q={who:"me",shot:wsh([["RV",3],["RE",me?0:3],["CD",2]]),kind:"F",sv:svx};
          else q={who:"opp",shot:null,kind:"W",sv:svx};
        }
      }
      out.push(q);if(calm>0)calm--;
      if(q.who==="me"&&q.kind==="U"&&(q.shot==="RV"||q.shot==="RE")&&r()<.2&&tl.length<5){tl.push(out.length);calm=3;}
    }
    return {pts:out,tilts:tl};
  }

  var $=function(id){return document.getElementById(id)};
  function el(t,c,h){var e=document.createElement(t);if(c)e.className=c;if(h!=null)e.textContent=h;return e;}
  function cta(cls,title,desc,fn){var b=el("button","cta "+cls);b.type="button";b.appendChild(el("b",null,title));if(desc)b.appendChild(el("span",null,desc));b.onclick=fn;return b;}

  function finish(q){
    q.sv=q.sv||svIn||null;
    pts.push(q);hist.push("p");svIn=null;stage="sv1";win=null;how=null;
    var who=q.who==="me"?"le joueur":"l'adversaire";
    var k=q.kind==="W"?"coup gagnant":q.kind==="U"?"faute directe":"faute provoquée";
    var svt=q.sv==="ace1"||q.sv==="ace2"?"ace":q.sv==="df"?"double faute":"";
    $("last").textContent="✔ Noté : "+(meWon(q)?"pour le joueur":"pour l'adversaire")+" ("+(svt?svt:who+", "+(q.shot?LAB[q.shot].toLowerCase()+", ":"")+k)+").";
    render();
  }

  function renderBoard(S){
    var b=$("board");b.innerHTML="";
    var m=el("div","meta");m.appendChild(el("span",null,S.over?"Match terminé":(S.me?"Le joueur sert":"L'adversaire sert")));m.appendChild(el("span",null,S.pts+" points"));b.appendChild(m);
    function row(name,i,serving){
      var r=el("div","row"),w=el("div","who"),ball=el("span","ball"+(serving?" on":""));ball.setAttribute("aria-hidden","true");
      w.appendChild(ball);w.appendChild(el("span",null,name));r.appendChild(w);
      for(var k=0;k<2;k++){var set=S.sets[k];r.appendChild(el("span","n",set?String(set[i]):"–"));}
      r.appendChild(el("span","n",String(S.g[i])));r.appendChild(el("span","pt",ptLabel(S,i)));return r;}
    b.appendChild(row(NAME,0,S.me&&!S.over));b.appendChild(row(OPP,1,!S.me&&!S.over));
  }

  var ICON={
    CD:'<path d="M8 38C14 16 28 10 40 14" /><circle cx="40" cy="14" r="4"/>',
    RV:'<path d="M40 38C34 16 20 10 8 14" /><circle cx="8" cy="14" r="4"/>',
    VO:'<path d="M24 6V42" stroke-dasharray="3 4"/><path d="M10 32L34 22"/><circle cx="36" cy="21" r="4"/>',
    SM:'<path d="M12 6L34 36"/><circle cx="36" cy="39" r="4"/><path d="M6 44H42"/>',
    PA:'<path d="M20 8V40" stroke-width="5"/><path d="M6 34Q26 36 40 14"/><circle cx="41" cy="12" r="4"/>',
    LO:'<path d="M6 40C10 -2 38 -2 42 40"/><circle cx="42" cy="40" r="4"/>',
    AM:'<path d="M8 30Q16 12 26 28"/><path d="M26 28Q30 20 36 28"/><circle cx="37" cy="29" r="4"/><path d="M24 8V42" stroke-dasharray="3 4"/>',
    RE:'<path d="M6 42H42"/><path d="M40 12C28 12 16 22 10 36"/><circle cx="9" cy="38" r="4"/>',
    check:'<path d="M10 25l9 9 19-21" stroke-width="5"/>',
    star:'<path d="M24 6l5 12 13 1-10 9 3 13-11-7-11 7 3-13-10-9 13-1z" fill="currentColor" stroke="none"/>',
    cross:'<path d="M12 12L36 36M36 12L12 36" stroke-width="5"/>',
    press:'<path d="M6 14H22M6 34H22M42 24H26"/><path d="M18 8l6 6-6 6M18 28l6 6-6 6" /><circle cx="36" cy="24" r="4"/>',
    ace:'<path d="M24 40V14"/><circle cx="24" cy="9" r="5" /><path d="M10 42H38"/>',
    df:'<path d="M12 12L36 36M36 12L12 36" stroke-width="5"/>'
  };
  function ico(k){return '<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+ICON[k]+'</svg>';}
  function tile(cls,icon,title,desc,fn){
    var b=el("button","tile "+cls);b.type="button";
    var i=el("span","ic");i.innerHTML=ico(icon);var t=el("span");t.appendChild(el("b",null,title));if(desc)t.appendChild(el("span","d",desc));
    b.appendChild(i);b.appendChild(t);b.onclick=fn;return b;}
  function courtSVG(meServes){
    var L='stroke="#fff" stroke-width="13" fill="none"',bx=meServes?170:2207;
    return '<svg viewBox="-120 -120 2617 1337" preserveAspectRatio="none" aria-hidden="true">'+
      '<rect x="-120" y="-120" width="2617" height="1337" fill="#8c3f1c"/>'+
      '<rect x="0" y="0" width="2377" height="1097" fill="#b3532a"/>'+
      '<g '+L+'><rect x="0" y="0" width="2377" height="1097"/><line x1="0" y1="137" x2="2377" y2="137"/><line x1="0" y1="960" x2="2377" y2="960"/>'+
      '<line x1="548" y1="137" x2="548" y2="960"/><line x1="1828" y1="137" x2="1828" y2="960"/><line x1="548" y1="548" x2="1828" y2="548"/>'+
      '<line x1="0" y1="548" x2="40" y2="548"/><line x1="2337" y1="548" x2="2377" y2="548"/></g>'+
      '<line x1="1188" y1="-60" x2="1188" y2="1157" stroke="#f4efe4" stroke-width="22"/>'+
      '<circle cx="'+bx+'" cy="'+(meServes?300:800)+'" r="34" fill="#d6e04a" stroke="#6b7a10" stroke-width="6"/>'+
      '<circle cx="230" cy="548" r="46" fill="#fff" stroke="#16603a" stroke-width="14"/>'+
      '<circle cx="2147" cy="548" r="46" fill="#fff" stroke="#8a1f12" stroke-width="14"/></svg>';}

  function renderGuide(S){
    var g=$("guide");g.innerHTML="";
    if(S.over){g.appendChild(el("div","q","Match terminé"));g.appendChild(el("p","hint","Ouvrez l'onglet « 2 · Le bilan »."));return;}
    var me=S.me,srvName=me?"le joueur":"l'adversaire";
    $("tiltN").textContent=tilts.length===0?"Aucune fois pour l'instant":(tilts.length+" fois pour l'instant");
    var ph=el("div","phases"),cur=(stage==="sv1"||stage==="sv2")?0:(stage==="win"?1:2);
    ["1 · Service","2 · Échange","3 · Résultat"].forEach(function(t,i){ph.appendChild(el("span",i===cur?"on":(i<cur?"done":""),t));});
    g.appendChild(ph);
    function back(to){var bk=el("button","back","← Revenir en arrière");bk.type="button";bk.onclick=function(){stage=to;if(to==="sv1"||to==="sv2")svIn=null;if(to==="win")how=null;render();};return bk;}
    function banner(){var wh=el("div","who "+(win==="me"?"w":"l"));wh.appendChild(el("span",null,win==="me"?"Le joueur gagne le point":"L'adversaire gagne le point"));if(how)wh.appendChild(el("small",null,how.t));return wh;}
    function aceDf(second){
      return function(kind){
        if(kind==="ace")finish(me?{who:"me",shot:"SV",kind:"W",sv:second?"ace2":"ace1"}:{who:"opp",shot:null,kind:"W",sv:second?"ace2":"ace1"});
        else finish(me?{who:"me",shot:"SV",kind:"U",sv:"df"}:{who:"opp",shot:null,kind:"U",sv:"df"});};}
    function svb(cls,icon,t,d,fn){var b=el("button","svb "+cls);b.type="button";b.innerHTML=ico(icon)+"<b>"+t+"</b><span>"+d+"</span>";b.onclick=fn;return b;}

    if(stage==="sv1"||stage==="sv2"){
      var second=stage==="sv2";
      if(second)g.appendChild(back("sv1"));
      var hd=el("div","svhead");hd.appendChild(el("div","num",second?"2":"1"));
      var tx=el("div");var bb=el("b",null,(second?"2e balle":"1re balle")+" de "+srvName);tx.appendChild(bb);tx.appendChild(el("small",null,second?"La première balle était faute.":"Que s'est-il passé au service ?"));
      hd.appendChild(tx);g.appendChild(hd);
      var row=el("div","svbtns"),f=aceDf(second);
      row.appendChild(svb("w","ace","Ace","service gagnant",function(){f("ace");}));
      row.appendChild(svb("n","check",second?"Dedans":"Dedans","l'échange commence",function(){svIn=second?"2":"1";stage="win";render();}));
      if(second)row.appendChild(svb("l","df","Double faute","le point est perdu",function(){f("df");}));
      else row.appendChild(svb("l","cross","Faute","on passe à la 2e balle",function(){stage="sv2";render();}));
      g.appendChild(row);
      if(!second){var sk=el("button","skip","Je n'ai pas suivi le service : passer");sk.type="button";sk.onclick=function(){svIn=null;stage="win";render();};g.appendChild(sk);}
    }else if(stage==="win"){
      g.appendChild(back(svIn==="2"?"sv2":"sv1"));
      g.appendChild(el("div","q","Qui a gagné l'échange ? Touchez son côté du terrain."));
      var cp=el("div","courtpick");cp.innerHTML=courtSVG(me);
      var l=el("button","l");l.type="button";l.setAttribute("aria-label","Le joueur gagne le point");l.innerHTML='<span class="chk">Je touche</span><b>Le joueur</b><span>gagne le point</span>';
      l.onclick=function(){win="me";stage="how";render();};
      var r=el("button","r");r.type="button";r.setAttribute("aria-label","L'adversaire gagne le point");r.innerHTML='<span class="chk">Je touche</span><b>L\'adversaire</b><span>gagne le point</span>';
      r.onclick=function(){win="opp";stage="how";render();};
      cp.appendChild(l);cp.appendChild(r);g.appendChild(cp);
      g.appendChild(el("p","tip","La balle jaune montre qui sert : "+srvName+"."));
    }else if(stage==="how"){
      g.appendChild(back("win"));g.appendChild(banner());
      g.appendChild(el("div","q","Comment le point s'est-il fini ?"));
      var b2=el("div","big");
      if(win==="me"){
        b2.appendChild(tile("w","star","Coup gagnant du joueur","Un beau coup, l'adversaire ne touche pas",function(){how={t:"Coup gagnant",k:"W",who:"me"};stage="shot";render();}));
        b2.appendChild(tile("l","cross","Faute directe de l'adversaire","Il rate seul, personne ne l'a gêné",function(){finish({who:"opp",shot:null,kind:"U",sv:null});}));
        b2.appendChild(tile("o","press","Faute provoquée de l'adversaire","Il rate parce que le joueur l'a mis sous pression",function(){finish({who:"opp",shot:null,kind:"F",sv:null});}));
      }else{
        b2.appendChild(tile("l","star","Coup gagnant de l'adversaire","Un beau coup, le joueur ne touche pas",function(){finish({who:"opp",shot:null,kind:"W",sv:null});}));
        b2.appendChild(tile("l","cross","Faute directe du joueur","Il rate seul, personne ne l'a gêné",function(){how={t:"Faute directe",k:"U",who:"me"};stage="shot";render();}));
        b2.appendChild(tile("o","press","Faute provoquée du joueur","Il rate parce que l'adversaire l'a mis sous pression",function(){how={t:"Faute provoquée",k:"F",who:"me"};stage="shot";render();}));
      }
      g.appendChild(b2);
      var mm=el("p","memo");mm.innerHTML="<b>Pour s'en souvenir :</b> directe = il rate seul. Provoquée = la balle était difficile.";g.appendChild(mm);
    }else{
      g.appendChild(back("how"));g.appendChild(banner());
      g.appendChild(el("div","q","Avec quel coup ?"));
      var sg=el("div","shotgrid"),cls=how.k==="W"?"w":how.k==="U"?"l":"o";
      SHOTS.forEach(function(s){
        var b=el("button","shot "+cls);b.type="button";b.innerHTML=ico(s[0])+'<b>'+s[1]+'</b>';
        b.onclick=function(){finish({who:"me",shot:s[0],kind:how.k,sv:null});};sg.appendChild(b);});
      g.appendChild(sg);
    }
  }

  function pct(a,b){return b?Math.round(100*a/b):0;}
  function grade(v,good,mid,inv){if(inv)return v<=good?"good":(v<=mid?"mid":"bad");return v>=good?"good":(v>=mid?"mid":"bad");}
  var CH={good:"Bien",mid:"Moyen",bad:"À travailler"};
  function tiltStats(S){var seen={},a=[0,0],r=[0,0],i;
    tilts.forEach(function(t){for(var k=t;k<t+3&&k<S.wins.length;k++)seen[k]=1;});
    for(i=0;i<S.wins.length;i++){var tg=seen[i]?a:r;tg[0]+=S.wins[i];tg[1]++;}return {after:a,rest:r};}

  function renderReport(S){
    var sets=S.sets.map(function(x){return x[0]+"–"+x[1];}).join("  "),cur=(S.g[0]||S.g[1])?"  ("+S.g[0]+"–"+S.g[1]+" en cours)":"";
    var h=$("head");h.innerHTML="";
    h.appendChild(el("div","eyebrow",S.over?"Match terminé":"Match en cours"));
    h.appendChild(el("h2",null,NAME+" contre "+OPP));
    var sc=el("div","score-big",(sets||"0–0")+cur);sc.style.marginTop="8px";h.appendChild(sc);
    var sub=el("div",null,S.pts+" points joués · "+S.gamesPlayed+" jeux");sub.style.cssText="color:var(--muted);font-size:13px;margin-top:6px";h.appendChild(sub);

    var tw=0,tu=0,tf=0;ALL.forEach(function(s){if(s[0]!=="SV"){tw+=S.by[s[0]].w;tu+=S.by[s[0]].u;tf+=S.by[s[0]].f;}});
    var f=$("figs");f.innerHTML="";
    function fig(v,l,c){var d=el("div","fig"+(c?" "+c:""));d.appendChild(el("b",null,v));d.appendChild(el("span",null,l));f.appendChild(d);}
    fig(pct(S.won,S.pts)+" %","des points gagnés");
    fig(tw+" / "+tu,"coups gagnants / fautes directes");
    fig(String(tf),"fautes provoquées par l'adversaire");
    fig(S.ace+" / "+S.df,"aces / doubles fautes");
    fig(String(tilts.length),"moments d'énervement","t");

    var T=$("tbl");T.innerHTML="";var rated=[];
    ALL.forEach(function(s){
      var c=S.by[s[0]],row=el("div","tr"),isSV=s[0]==="SV",tot=c.w+c.u+c.f;
      row.appendChild(el("div","nm",isSV?"Service":s[1]));
      var mid=el("div"),sp=el("div","split");
      if(tot){[["gw",c.w],["gu",c.u],["gf",c.f]].forEach(function(o){var i=el("i",o[0]);i.style.width=(100*o[1]/tot)+"%";sp.appendChild(i);});}
      mid.appendChild(sp);
      mid.appendChild(el("div","num",isSV?c.w+" ace"+(c.w>1?"s":"")+" · "+c.u+" double"+(c.u>1?"s":"")+" faute"+(c.u>1?"s":""):c.w+" gagnant"+(c.w>1?"s":"")+" · "+c.u+" directe"+(c.u>1?"s":"")+" · "+c.f+" provoquée"+(c.f>1?"s":"")));
      row.appendChild(mid);
      var g=isSV?"na":((c.w+c.u)<3?"na":grade(100*c.u/(c.w+c.u),35,50,true));
      row.appendChild(el("span","chip "+g,isSV?"voir plus bas":g==="na"?"trop peu":g==="good"?"Sûr":g==="mid"?"Moyen":"À travailler"));
      T.appendChild(row);
      if(!isSV&&c.w+c.u>=3)rated.push({lab:s[1],w:c.w,u:c.u,f:c.f,fr:c.u/(c.w+c.u),g:g});
    });
    // adversaire
    var ro=el("div","tr");ro.appendChild(el("div","nm","Adversaire"));
    var tot2=S.oW+S.oU+S.oF,m2=el("div"),sp2=el("div","split");
    if(tot2){[["gw",S.oW],["gu",S.oU],["gf",S.oF]].forEach(function(o){var i=el("i",o[0]);i.style.width=(100*o[1]/tot2)+"%";sp2.appendChild(i);});}
    m2.appendChild(sp2);m2.appendChild(el("div","num",S.oW+" gagnants · "+S.oU+" fautes directes · "+S.oF+" provoquées par le joueur"));
    ro.appendChild(m2);ro.appendChild(el("span","chip na","pour info"));T.appendChild(ro);

    var M=$("mental");M.innerHTML="";M.appendChild(el("h2",null,"État d'esprit"));
    var ts=tiltStats(S),mm=el("div","read");mm.style.marginTop="8px";
    if(!tilts.length)mm.appendChild(el("p",null,"Aucun énervement noté sur ce match. Bon signe."));
    else{
      var pa=pct(ts.after[0],ts.after[1]),pr=pct(ts.rest[0],ts.rest[1]);
      mm.appendChild(el("p",null,tilts.length+" moment"+(tilts.length>1?"s":"")+" d'énervement noté"+(tilts.length>1?"s":"")+", repéré"+(tilts.length>1?"s":"")+" en orange sur le fil du match."));
      if(ts.after[1]>=4)mm.appendChild(el("p",null,"Dans les 3 points qui suivent, le joueur gagne "+pa+" % des points. Le reste du match : "+pr+" %."+(pa+10<pr?" L'énervement coûte des points : c'est un vrai sujet de travail.":(pa>pr+10?" Il sait rebondir.":" Peu d'effet visible sur le score."))));
    }
    M.appendChild(mm);

    var A=S.sv[0],B=S.sv[1],RA=S.rt[0],RB=S.rt[1];
    var first=pct(A.first,A.pts),p1v=pct(A.w1,A.first),p2v=pct(A.w2,A.s2),ret=pct(RA.won,RA.pts);
    var bp=S.bpOpp?pct(S.bpConv,S.bpOpp):null,sv2=S.bpFaced?pct(S.bpSaved,S.bpFaced):null;
    var MT=[
      {lab:"1re balle dedans",v:first,o:pct(B.first,B.pts),g:grade(first,60,50),ok:A.pts>0,ho:B.pts>0,hint:A.first+"/"+A.pts,hint2:B.first+"/"+B.pts},
      {lab:"Points gagnés sur 1re balle",v:p1v,o:pct(B.w1,B.first),g:grade(p1v,70,60),ok:A.first>0,ho:B.first>0,hint:A.w1+"/"+A.first,hint2:B.w1+"/"+B.first},
      {lab:"Points gagnés sur 2e balle",v:p2v,o:pct(B.w2,B.s2),g:grade(p2v,50,40),ok:A.s2>0,ho:B.s2>0,hint:A.w2+"/"+A.s2,hint2:B.w2+"/"+B.s2},
      {lab:"Points gagnés en retour",v:ret,o:pct(RB.won,RB.pts),g:grade(ret,40,30),ok:RA.pts>0,ho:RB.pts>0,hint:RA.won+"/"+RA.pts,hint2:RB.won+"/"+RB.pts},
      {lab:"Balles de break converties",v:bp,o:S.bpFaced?pct(S.bpFaced-S.bpSaved,S.bpFaced):null,g:bp==null?"mid":grade(bp,40,25),ok:S.bpOpp>0,ho:S.bpFaced>0,hint:S.bpConv+"/"+S.bpOpp,hint2:(S.bpFaced-S.bpSaved)+"/"+S.bpFaced},
      {lab:"Balles de break sauvées",v:sv2,o:S.bpOpp?pct(S.bpOpp-S.bpConv,S.bpOpp):null,g:sv2==null?"mid":grade(sv2,60,45),ok:S.bpFaced>0,ho:S.bpOpp>0,hint:S.bpSaved+"/"+S.bpFaced,hint2:(S.bpOpp-S.bpConv)+"/"+S.bpOpp}];
    var m=$("meters");m.innerHTML="";
    var tb=el("div","h2h");tb.setAttribute("role","table");
    tb.appendChild(el("div","hd",""));tb.appendChild(el("div","hd",FN));tb.appendChild(el("div","hd","Adversaire"));
    function cell(val,hint,cls,pctv,chip){var c=el("div","cell"+(cls?" "+cls:""));var b=el("b",null,val);if(chip){b.appendChild(document.createTextNode(" "));b.appendChild(chip);}c.appendChild(b);
      if(pctv!=null){var br=el("div","bar2"),i=document.createElement("i");i.style.width=Math.min(100,pctv)+"%";br.appendChild(i);c.appendChild(br);}
      c.appendChild(el("small",null,hint));return c;}
    MT.forEach(function(x){
      tb.appendChild(el("div","lb",x.lab));
      var chip=el("span","chip "+(x.ok?x.g:"na"),x.ok?CH[x.g]:"–");chip.style.fontSize="10px";
      tb.appendChild(cell(x.ok&&x.v!=null?x.v+" %":"–",x.hint,"",x.ok?x.v:null,x.ok?chip:null));
      tb.appendChild(cell(x.ho&&x.o!=null?x.o+" %":"–",x.hint2,"o",x.ho?x.o:null,null));
    });
    [["Aces",A.ace,B.ace],["Doubles fautes",A.df,B.df]].forEach(function(r){tb.appendChild(el("div","lb",r[0]));tb.appendChild(cell(String(r[1]),"","",null,null));tb.appendChild(cell(String(r[2]),"","o",null,null));});
    m.appendChild(tb);

    var good=[],bad=[];
    rated.forEach(function(x){
      if(x.g==="good")good.push({t:x.lab+" : sûr",d:x.w+" gagnants pour "+x.u+" fautes directes"});
      if(x.g==="bad")bad.push({t:x.lab+" : trop de fautes directes",d:x.u+" fautes pour "+x.w+" gagnants"});});
    MT.forEach(function(x){if(!x.ok||x.v==null)return;if(x.g==="good")good.push({t:x.lab,d:x.v+" %"});if(x.g==="bad")bad.push({t:x.lab,d:x.v+" %"});});
    if(tilts.length>=2&&ts.after[1]>=4&&pct(ts.after[0],ts.after[1])+10<pct(ts.rest[0],ts.rest[1]))bad.push({t:"Gérer l'énervement",d:tilts.length+" moments, points perdus juste après"});
    function fill(id,arr,none){var u=$(id);u.innerHTML="";if(!arr.length){u.appendChild(el("li",null,none));return;}
      arr.forEach(function(x){var li=el("li");li.appendChild(el("b",null,x.t));li.appendChild(document.createTextNode(" ("+x.d+")"));u.appendChild(li);});}
    fill("good",good,"Pas encore assez de points pour dire.");fill("bad",bad,"Rien d'alarmant sur ce match.");

    var r=$("read");r.innerHTML="";function para(t){r.appendChild(el("p",null,t));}
    if(S.pts<8)para("Saisissez quelques points dans l'onglet 1 pour obtenir une lecture.");
    else{
      para(NAME+" a gagné "+pct(S.won,S.pts)+" % des points ("+S.won+" sur "+S.pts+").");
      var best=rated.slice().sort(function(a,b){return a.fr-b.fr})[0],worst=rated.slice().sort(function(a,b){return b.fr-a.fr})[0];
      if(best&&worst&&best!==worst)para("Le coup le plus sûr : "+best.lab.toLowerCase()+" ("+best.w+" gagnants, "+best.u+" fautes directes). Le plus fragile : "+worst.lab.toLowerCase()+" ("+worst.u+" fautes directes pour "+worst.w+" gagnants). C'est une piste de mission pour le prochain trimestre.");
      if(S.oF+tf>0)para("Le joueur a provoqué "+S.oF+" faute"+(S.oF>1?"s":"")+" de l'adversaire et en a subi "+tf+" ("+S.oU+" fautes directes de l'adversaire, "+tu+" du joueur).");
      if(S.svcPts)para("Au service : "+first+" % de premières balles dedans"+(S.df?", "+S.df+" double"+(S.df>1?"s":"")+" faute"+(S.df>1?"s":""):"")+".");
      if(tilts.length)para("Sur le plan mental, "+tilts.length+" moment"+(tilts.length>1?"s":"")+" d'énervement.");
    }

    var dd=S.diff,n=dd.length,W=320,H=130,pad=10;
    var mx=Math.max(6,Math.max.apply(null,dd.map(Math.abs)));
    var X=function(i){return pad+(W-2*pad)*(n>1?i/(n-1):0);},Y=function(v){return H/2-(H/2-pad)*v/mx;};
    var path=dd.map(function(v,i){return (i?"L":"M")+X(i).toFixed(1)+" "+Y(v).toFixed(1);}).join(" ");
    var dots=tilts.map(function(t){var i=Math.min(t,n-1);return '<circle cx="'+X(i).toFixed(1)+'" cy="'+Y(dd[i]).toFixed(1)+'" r="5.5" fill="var(--tilt)" stroke="var(--card)" stroke-width="1.5"/>';}).join("");
    var last=dd[n-1];
    $("chart").innerHTML='<svg viewBox="0 0 '+W+' '+H+'" role="img" aria-label="Écart de points au fil du match, '+(last>=0?"+":"")+last+' à la fin, '+tilts.length+' énervements">'+
      '<line x1="'+pad+'" x2="'+(W-pad)+'" y1="'+H/2+'" y2="'+H/2+'" stroke="var(--line)" stroke-width="1.5"/>'+
      '<text x="'+pad+'" y="14" font-size="10" fill="var(--muted)">Le joueur mène</text>'+
      '<text x="'+pad+'" y="'+(H-4)+'" font-size="10" fill="var(--muted)">L\'adversaire mène</text>'+
      '<path d="'+path+'" fill="none" stroke="var(--accent)" stroke-width="2.2" stroke-linejoin="round"/>'+dots+'</svg>';
  }


  function DE(n){return /^[AEIOUYÉÈÊH]/i.test(n)?"d'"+n:"de "+n;}
  function fix(t){
    return t.replace(/Joueur Exemple/g,FN+" Exemple").replace(/\bdu joueur\b/g,DE(FN)).replace(/\bau joueur\b/g,"à "+FN).replace(/\b[Ll]e joueur\b/g,FN);}
  function polish(){
    $("note").textContent="Match d'exemple inventé : « "+NAME+" » est fictif et l'adversaire n'a qu'un classement. Saisissez quelques points, puis ouvrez « 2 · Le bilan ».";
    var w=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT,null),n,list=[];
    while((n=w.nextNode())){var p=n.parentNode;if(!p)continue;var tg=p.nodeName;
      if(tg==="STYLE"||tg==="SCRIPT"||tg==="OPTION")continue;
      if(p.closest&&(p.closest(".later")||p.closest("#pl")||p.closest(".pickinfo")))continue;
      if(/oueur/.test(n.nodeValue))list.push(n);}
    list.forEach(function(x){x.nodeValue=fix(x.nodeValue);});
    document.querySelectorAll("[aria-label]").forEach(function(e){var a=e.getAttribute("aria-label");if(/oueur/.test(a))e.setAttribute("aria-label",fix(a));});
  }
  function renderLive(S){var A=S.sv[0],L=$("live");L.innerHTML="";
    [[A.pts?pct(A.first,A.pts)+" %":"–","1res balles"],[A.pts?pct(A.w1,A.first)+" %":"–","pts sur 1re"],[String(A.ace),"aces"],[String(A.df),"doubles fautes"]].forEach(function(o){var d=el("div");d.appendChild(el("b",null,o[0]));d.appendChild(el("span",null,o[1]));L.appendChild(d);});}
  function render(){var S=sim(pts);renderBoard(S);renderLive(S);renderGuide(S);renderReport(S);
    $("undo").textContent=stage!=="sv1"?"← Retour":"← Annuler le point";polish();}

  $("pl").onchange=function(){FN=this.value;NAME=FN+" Exemple";render();};
  $("tilt").onclick=function(){tilts.push(pts.length);hist.push("t");$("last").textContent="😤 Énervement noté.";render();};
  $("undo").onclick=function(){
    var prev={sv2:"sv1",win:(svIn==="2"?"sv2":"sv1"),how:"win",shot:"how"};
    if(stage!=="sv1"){var t=prev[stage];stage=t;if(t==="sv1"||t==="sv2")svIn=null;if(t==="win")how=null;render();return;}
    var a=hist.pop();if(a==="p")pts.pop();else if(a==="t")tilts.pop();else return;
    svIn=null;$("last").textContent="Dernière action annulée.";render();};
    function load(){var x=seeded(66);pts=x.pts;tilts=x.tilts;hist=[];pts.forEach(function(){hist.push("p");});svIn=null;stage="sv1";win=null;how=null;$("last").textContent="";render();}
  $("sample").onclick=load;
  $("reset").onclick=function(){pts=[];tilts=[];hist=[];svIn=null;stage="sv1";win=null;how=null;$("last").textContent="";render();};
  function show(n){var one=n===1;$("p1").hidden=!one;$("p2").hidden=one;$("bar").hidden=!one;
    $("t1").setAttribute("aria-selected",one);$("t2").setAttribute("aria-selected",!one);}
  $("t1").onclick=function(){show(1)};$("t2").onclick=function(){show(2)};
  load();
})();
</script>

```

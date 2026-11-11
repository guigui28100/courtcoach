// Progression des séances : catalogue des thèmes, repères par niveau (Galaxie Tennis et adultes) et génération des 30 séances.
// Tout est calculé dans le navigateur par des règles écrites ici (aucune intelligence artificielle, aucun service extérieur).
// Les âges et terrains de la Galaxie sont des repères indicatifs, variables selon les clubs : à confronter aux documents FFT.

export type Domain = "tech" | "tact" | "phys" | "ment";
export const DOMAINS: { key: Domain; label: string; color: string }[] = [
  { key: "tech", label: "Technique", color: "#8a5a1a" },
  { key: "tact", label: "Tactique", color: "#4a6d8f" },
  { key: "phys", label: "Physique", color: "#3f7a56" },
  { key: "ment", label: "Mental", color: "#6f5588" },
];
export const domainOf = (d: Domain) => DOMAINS.find((x) => x.key === d)!;

type Ex = [nom: string, dispositif: string, reussite: string, variables: string];
type Theme = { d: Domain; kw: RegExp; s: [string[], string[], string[]]; e: [Ex, Ex, Ex] };
const T = (d: Domain, kw: RegExp, s: [string[], string[], string[]], e: [Ex, Ex, Ex]): Theme => ({ d, kw, s, e });

export const THEMES: Record<string, Theme> = {
  "Coup droit": T("tech", /coup droit|\bcd\b|forehand/, [
    ["Prise et position de départ", "Armer tôt, épaules de profil", "Frapper la balle devant soi"],
    ["Finir haut vers l'épaule opposée", "Régularité cross et long de ligne", "Replacement après la frappe"],
    ["Direction et profondeur sous pression", "Coup droit en mouvement", "Coup droit d'attaque sur balle courte"]], [
    ["Balles à la main puis au panier", "Le prof lance ou alimente à la main ; l'élève frappe vers un cerceau large. 3 séries de 8 balles.", "5 balles sur 8 passent le filet et retombent dans le terrain.", "+ facile : se rapprocher du filet · + difficile : cible plus petite"],
    ["Cross au panier puis en duo", "Deux cerceaux en cross (mi-court et profond). Le prof alimente au panier, puis duo cross contre cross.", "6 balles sur 10 dans le cerceau profond, puis 8 échanges d'affilée en duo.", "+ difficile : ajouter un replacement au centre entre chaque balle"],
    ["Coup droit en situation", "Le prof joue une balle haute ou courte au hasard ; l'élève choisit entre jouer long ou attaquer en long de ligne.", "7 balles sur 10 avec la bonne direction annoncée avant la frappe.", "+ difficile : enchaîner deux coups droits ; + facile : alimentation prévisible"]]),
  "Revers": T("tech", /revers|backhand/, [
    ["Prise, épaules de profil, armé", "Contact devant", "Équilibre à la frappe"],
    ["Accompagner et finir haut", "Régularité cross", "Replacement au centre"],
    ["Revers en mouvement", "Revers sous pression", "Revers slicé pour défendre ou varier"]], [
    ["Revers lancé puis frappé", "Le prof lance la balle côté revers ; l'élève frappe vers une cible large, 3 séries de 8.", "5 balles sur 8 dans le terrain, contact devant.", "À une main ou à deux mains : on garde celle qui est la plus stable · + facile : balle posée sur le filet"],
    ["Revers cross en duo", "Duo revers contre revers dans le couloir cross, balle derrière la ligne de service.", "8 échanges d'affilée, puis 12.", "+ difficile : profondeur imposée ; + facile : le prof alimente"],
    ["Revers sous pression", "Le prof alterne balle courte et balle longue côté revers ; l'élève se déplace puis revient au centre.", "6 revers sur 10 dans la cible, sans perdre l'équilibre.", "+ difficile : enchaîner avec un coup droit"]]),
  "Service": T("tech", /service|\bsert\b|servir|2e balle|deuxieme balle/, [
    ["Lancer de balle et position", "Geste en trois temps : armer, lancer, frapper", "Viser le carré"],
    ["Première balle placée", "Deuxième balle sûre", "Rythme et routine avant le service"],
    ["Service dans le match", "Zones visées : T, centre, extérieur", "Enchaîner service et premier coup"]], [
    ["Lancer et frapper", "Lancer sans raquette (10 fois à la bonne hauteur), puis frapper depuis la ligne de service. Cible : le carré de service.", "6 services sur 10 dans le carré.", "+ difficile : reculer vers la ligne de fond ; + facile : servir depuis le carré"],
    ["Service aux trois cibles", "Trois cerceaux (T, centre, extérieur) ; 3 séries de 6 services, une cible par série.", "7 services sur 10 dans le carré ; 4 sur 6 dans la cible visée.", "Deuxième balle : kické ou slicé, avec 80 % de la vitesse"],
    ["Service en situation", "Jeu de service au score : on sert, on joue le point. Compter les premières balles dans le carré.", "60 % de premières balles dans le carré sur 10 services.", "+ difficile : deuxième balle obligatoire sur un point sur deux"]]),
  "Retour de service": T("tech", /retour/, [
    ["Position d'attente active", "Petit armé", "Bloquer devant soi"],
    ["Retour profond au centre", "Se placer selon le service", "Retour croisé"],
    ["Retour agressif sur seconde balle", "Premier coup après le retour", "Choisir le retour selon le serveur"]], [
    ["Bloquer le service doux", "Le prof sert doucement depuis le carré ; l'élève bloque vers un grand cerceau au centre.", "6 retours sur 10 dans la cible.", "+ difficile : service plus rapide ; + facile : balle lancée"],
    ["Retour profond", "Cible : 2 m derrière la ligne de service, côté croisé. Le serveur change de zone à chaque balle.", "6 retours profonds sur 10.", "Le serveur annonce la zone ou non selon le niveau"],
    ["Retour puis premier coup", "On joue le point : le retour doit permettre d'attaquer le coup suivant.", "5 points sur 10 gagnés quand le retour est profond.", "+ difficile : relancer en retour agressif sur deuxième balle"]]),
  "Volée": T("tech", /volee|filet|monte/, [
    ["Raquette devant, poignet ferme", "Pas de grand armé", "Un pas vers la balle"],
    ["Volée de coup droit et de revers", "Placer la volée", "Volée basse"],
    ["Montée et volée dans le jeu", "Volée d'attaque", "Volée de défense au filet"]], [
    ["Volée à deux", "Deux joueurs face à face à 2 m du filet ; échanges de volées courtes, on compte.", "15 volées d'affilée, puis 25.", "+ difficile : plus vite ou plus loin du filet ; + facile : un rebond toléré"],
    ["Volée au panier", "Le prof alimente à la main ; volée de coup droit puis de revers vers deux cibles.", "6 volées sur 10 dans la cible.", "+ difficile : volée basse ; + facile : alimentation prévisible"],
    ["Monter et conclure", "Le prof joue une balle courte ; l'élève frappe en avançant puis volée.", "6 montées sur 10 avec volée dans le terrain.", "+ difficile : volée dans un couloir"]]),
  "Smash": T("tech", /smash/, [
    ["Reculer en pas chassés", "Main libre vers la balle", "Armer tôt"],
    ["Frapper au point haut", "Viser le carré adverse", "Se replacer"],
    ["Smash après lob dans les points", "Smash de volée", "Choisir de laisser rebondir"]], [
    ["Smash lancé", "Le prof lance des balles hautes depuis le fond ; l'élève recule et frappe vers le carré.", "5 smashs sur 8 dans le terrain.", "+ difficile : balle plus longue ; + facile : balle plus lente"],
    ["Lob puis smash", "Duo : l'un lobe, l'autre smashe puis change de rôle.", "6 smashs sur 10 dans le terrain.", "+ difficile : viser une cible"],
    ["Smash en situation", "Point joué : le lob du prof arrive au hasard, l'élève décide de smasher ou de laisser rebondir.", "7 décisions justes sur 10.", "+ difficile : le smash doit gagner le point"]]),
  "Jeu de jambes": T("tech", /jambe|appui|deplac|bouge|bougent|bouger|replac/, [
    ["Pas chassés et petits appuis", "Genoux fléchis", "Pas d'ajustement avant la frappe"],
    ["Appuis avant chaque frappe", "Replacement au centre", "Premier pas réactif"],
    ["Déplacements dans l'échange", "Changements de direction", "Équilibre à la frappe"]], [
    ["Parcours de cônes", "Trois cônes en ligne à 3 m ; pas chassés d'un cône à l'autre, aller-retour.", "3 allers-retours sans faute d'appuis.", "+ difficile : ajouter une frappe à chaque cône ; + facile : réduire la distance"],
    ["Frapper et revenir", "Le prof alimente à droite puis à gauche ; l'élève frappe puis revient au centre avant la balle suivante.", "8 balles de suite avec replacement complet.", "+ difficile : alimentation plus rapide"],
    ["Échange en mouvement", "Duo : le prof alterne balles longues et courtes pendant 30 secondes.", "Tenir 30 secondes sans arrêt ni perte d'équilibre.", "+ difficile : 45 secondes"]]),
  "Défendre": T("tact", /defen|subit|recul/, [
    ["Revenir au centre", "Lober pour souffler", "Jouer haut et profond"],
    ["Défendre en slice et en lift", "Gagner du temps", "Rester dans le point"],
    ["Passer de la défense à l'attaque", "Reconnaître la balle de relance", "Contre-attaquer"]], [
    ["Balles hautes", "Le prof attaque ; l'élève défend en balles hautes et profondes pour revenir au centre.", "5 balles hautes profondes d'affilée.", "+ difficile : l'attaquant varie les angles"],
    ["Défense puis relance", "Le prof alterne attaque et balle plus lente ; l'élève défend, puis relance dès que possible.", "4 relances sur 8 qui reprennent l'initiative.", "+ difficile : le prof joue plus fort"],
    ["Point de défense", "Jeu de points : le défenseur joue seulement de la défense jusqu'à une balle courte.", "Gagner 3 points sur 10 en défendant.", "+ difficile : sans erreur directe"]]),
  "Attaquer": T("tact", /attaq|agress|finir le point|conclure/, [
    ["Repérer la balle courte", "Avancer en deux pas", "Frapper devant"],
    ["Attaquer en long de ligne", "Attaquer en croisé", "Terminer près du filet"],
    ["Construire puis conclure le point", "Choisir la bonne attaque", "Ne pas précipiter"]], [
    ["Attaque sur balle courte", "Le prof joue une balle courte ; l'élève avance et attaque vers une cible.", "4 attaques sur 8 dans le terrain.", "+ difficile : balle courte plus basse ; + facile : balle lancée"],
    ["Attaquer en long et en croisé", "Deux cibles ; l'élève annonce la direction avant de frapper.", "6 attaques sur 10 dans la cible annoncée.", "+ difficile : attaque en mouvement"],
    ["Construire puis attaquer", "Point joué : au moins 4 échanges avant d'attaquer.", "Gagner 3 points sur 5 en respectant la règle.", "+ difficile : attaquer seulement sur balle courte"]]),
  "Montées au filet": T("tact", /monte|filet/, [
    ["Choisir le bon moment", "Avancer pendant la frappe", "Raquette devant"],
    ["Montée sur balle courte", "Volée placée", "Se replacer après la volée"],
    ["Monter et conclure le point", "Lire le lob adverse", "Smash de suite"]], [
    ["Frapper en avançant", "Balle courte du prof ; frapper en avançant, finir le pas avant la volée.", "6 montées sur 10 avec volée dans le terrain.", "+ difficile : volée dans un couloir"],
    ["Monter et passer", "Duo : l'un monte, l'autre tente un passing.", "5 montées sur 10 qui gagnent le point.", "Annoncer la direction de la montée"],
    ["Point avec montée", "Point joué : une montée obligatoire après la deuxième balle courte.", "Gagner 3 points sur 5 en montant.", "+ difficile : montée sur balle moyenne"]]),
  "Construire le point (régularité)": T("tact", /regularit|faute|fautes|rater|rate|ratent|en jeu|constru/, [
    ["Garder la balle en jeu", "Viser large", "Compter les échanges"],
    ["8 balles avant d'attaquer", "Viser profond", "Varier les hauteurs"],
    ["Régularité sous score", "Gagner les points importants", "Reprendre la balle en jeu après une erreur"]], [
    ["Échanges comptés", "Duo en fond de court ; on compte les échanges d'affilée.", "8 échanges d'affilée, puis 12.", "+ difficile : cibles réduites ; + facile : 5 échanges"],
    ["Jouer large et profond", "Chaque joueur vise un grand cerceau profond ; 1 point par balle dedans.", "6 balles profondes sur 10.", "+ difficile : changer de cible à chaque balle"],
    ["Points au score", "Jeu en 7 points : 8 échanges minimum avant d'attaquer.", "Gagner 3 points sur 5 avec le minimum respecté.", "+ difficile : 10 échanges minimum"]]),
  "Variations": T("tact", /variation|varier|rythme/, [
    ["Changer de hauteur", "Changer de vitesse", "Annoncer son intention"],
    ["Changer de direction", "Balle lente puis rapide", "Utiliser le slice"],
    ["Surprendre l'adversaire", "Choisir selon l'adversaire", "Varier dans les points"]], [
    ["Lent puis rapide", "Duo : une balle lente et haute, une balle rapide ; on annonce le rythme avant la frappe.", "8 balles dont 4 changements de rythme réussis.", "+ difficile : changer aussi de direction"],
    ["Direction et hauteur", "Alterner cross, long de ligne, balle haute, balle basse selon une consigne écrite.", "10 balles qui respectent la consigne.", "Le partenaire devine la prochaine balle"],
    ["Points avec variation", "Point joué : un changement de rythme obligatoire par échange.", "Gagner 3 points sur 5 avec un changement réussi.", "+ difficile : deux variations par point"]]),
  "Lecture du jeu": T("tact", /lecture|lire le jeu|anticip/, [
    ["Regarder l'adversaire", "Repérer sa prise et son épaule", "Anticiper la direction"],
    ["Annoncer où va la balle", "Repérer ses habitudes", "Se placer en conséquence"],
    ["Adapter son jeu à l'adversaire", "Exploiter ses points faibles", "Changer de plan"]], [
    ["Je devine la direction", "Duo : le frappeur joue, l'autre annonce « droite » ou « gauche » avant la frappe.", "6 annonces justes sur 10.", "+ difficile : annoncer aussi la longueur"],
    ["Ses habitudes", "Observer l'adversaire pendant 10 balles, noter où il joue le plus.", "Trois habitudes repérées et utilisées dans les points.", "Le prof note aussi, on compare"],
    ["Point avec un plan", "Avant le match, chacun annonce un plan ; on le vérifie à la fin.", "Plan appliqué sur 3 points sur 5.", "Changer de plan en cours de jeu"]]),
  "Endurance": T("phys", /endurance|souffle|cardio|fatigu|physique/, [
    ["Circuits courts, effort mesuré", "Récupération entre les efforts", "Respiration"],
    ["Efforts répétés", "Récupération courte entre les points", "Tenir une série"],
    ["Tenir un match entier", "Gérer son énergie", "Terminer fort"]], [
    ["Circuit 30 / 30", "Quatre postes (déplacements, appuis, lancers, gainage) : 30 secondes d'effort, 30 secondes de repos, 3 tours.", "Aller au bout des 3 tours sans arrêt non prévu.", "+ difficile : 40 s d'effort ; + facile : 20 s"],
    ["Échanges longs", "Séries de 6 échanges sans s'arrêter, 20 secondes de récupération, 5 séries.", "Garder la même qualité de frappe de la 1re à la 5e série.", "+ difficile : 8 échanges"],
    ["Match d'endurance", "Un set court sans temps mort ; on note la qualité de frappe à la fin.", "La qualité de frappe se maintient en fin de set.", "+ difficile : deux sets courts"]]),
  "Vitesse": T("phys", /vitesse|explosiv|lent|reactif|reaction/, [
    ["Réaction à un signal", "Départs courts", "Appuis rapides"],
    ["Sprint court avec frappe", "Changement de direction", "Premier pas explosif"],
    ["Vitesse d'exécution dans le jeu", "Vitesse de replacement", "Enchaîner vite"]], [
    ["Départs sur signal", "Départ sur signal visuel ou sonore, sprint de 5 m, frappe sur balle posée.", "5 départs sur 6 sans faux départ.", "+ difficile : signal surprise"],
    ["Navette avec frappe", "Aller chercher une balle à 4 m, revenir, frapper ; 6 répétitions.", "Chaque frappe tombe dans le terrain malgré la vitesse.", "+ difficile : chronométrer"],
    ["Points rapides", "Jeu : le point doit durer moins de 8 secondes.", "Gagner 3 points sur 5 en jeu rapide.", "Imposer un replacement en 3 secondes"]]),
  "Explosivité": T("phys", /explosiv|puissan|detente/, [
    ["Sauts simples", "Réception amortie", "Gainage de base"],
    ["Sauts avec réaction", "Lancers de médecine-ball légers", "Appuis d'impulsion"],
    ["Explosivité dans le geste", "Service explosif", "Smash explosif"]], [
    ["Sauts et réceptions", "Cinq sauts sur place suivis d'une réception amortie, 3 séries.", "Réception sur deux pieds, genoux fléchis, sans déséquilibre.", "+ difficile : sauts en avant"],
    ["Lancers et appuis", "Lancer une balle lestée légère à deux mains puis frapper une balle.", "5 lancers et 5 frappes sans perte de rythme.", "Choisir le poids adapté à l'âge"],
    ["Service ou smash explosif", "Séries de 6 services ou smashs avec impulsion des jambes.", "4 sur 6 dans le terrain avec impulsion visible.", "+ difficile : enchaîner avec un déplacement"]]),
  "Concentration": T("ment", /concentr|attention|distrait|inattenti/, [
    ["Rester attentif 5 minutes", "Un seul objectif par balle", "Regarder la balle jusqu'à l'impact"],
    ["Routine entre les points", "Revenir vite à l'objectif", "Ne pas se laisser distraire"],
    ["Rester concentré quand le score se complique", "Gérer les moments importants", "Revenir à la routine"]], [
    ["Un objectif par balle", "Pendant un échange, chacun annonce à voix haute un objectif simple avant chaque frappe.", "6 objectifs tenus sur 10 balles.", "+ difficile : sans parler, juste montrer"],
    ["Routine entre les points", "Jeu en 7 points : respirer, regarder les cordes, choisir une intention, puis rejouer.", "Routine complète avant au moins 6 points sur 7.", "+ difficile : aussi après un point gagné"],
    ["Points importants", "Jeu où les trois derniers points valent double.", "Appliquer la routine sur chaque point important.", "Annoncer sa routine avant de jouer"]]),
  "Routines": T("ment", /routine/, [
    ["Respirer entre les points", "Se donner une consigne", "Rester calme"],
    ["Routine de service", "Routine de retour", "Routine après une erreur"],
    ["Routines dans le match", "Les adapter aux moments difficiles", "Rester régulier"]], [
    ["Ma routine en 3 temps", "Respirer, fixer les cordes, choisir une intention ; on la répète 10 fois.", "Routine suivie sur 8 points sur 10.", "+ difficile : sous pression"],
    ["Routine de service", "Avant chaque service : trois rebonds, respiration, cible choisie.", "Routine tenue sur 8 services sur 10.", "Adapter la routine selon le score"],
    ["Routine en match", "Match court : la routine est notée par un partenaire.", "Routine complète sur 80 % des points.", "Rappel de la routine en changeant de côté"]]),
  "Gestion des émotions": T("ment", /energ|enerv|emotion|colere|stress|pleur|decourag|frustr/, [
    ["Reconnaître ce qui énerve", "Respirer profondément", "Un mot positif"],
    ["Routine après une faute", "Rester calme quand on perd un point", "Parler positivement à soi-même"],
    ["Rebondir après un point perdu", "Accepter une balle litigieuse", "Garder le même comportement à tous les scores"]], [
    ["Respirer et relancer", "Jeu libre : après chaque faute, trois respirations et un mot positif avant de rejouer.", "La consigne est appliquée à toutes les fautes.", "+ difficile : aussi après une balle litigieuse"],
    ["Rebondir", "Jeu où l'on doit gagner le point qui suit une faute.", "Gagner 3 points sur 5 après une faute.", "Compter les rebonds réussis"],
    ["Rester le même à tous les scores", "Match court : le prof note le comportement à 0-3 et à 3-0.", "Même comportement quel que soit le score.", "L'élève s'auto-évalue après le match"]]),
  "Confiance": T("ment", /confiance|peur|n'ose|n ose|ose pas|timid|hesit/, [
    ["Réussir des cibles faciles", "Se féliciter", "Compter ses réussites"],
    ["Oser jouer son jeu", "Accepter de rater", "Choisir la solution qu'on maîtrise"],
    ["Prendre des risques mesurés", "Jouer ses points forts dans le match", "Rester audacieux quand on est mené"]], [
    ["Série de réussites", "Cibles larges ; on compte les réussites d'affilée et on les note sur une feuille.", "5 réussites d'affilée, puis 8.", "+ difficile : cible plus petite"],
    ["Oser le coup préféré", "Dans un jeu, chacun doit jouer son meilleur coup au moins 5 fois.", "5 coups préférés joués, réussis ou non.", "On félicite l'intention, pas seulement le résultat"],
    ["Match audacieux", "Match court : un point bonus quand l'élève tente son coup fort.", "Au moins 6 tentatives dans le match.", "+ difficile : tenter à 0-3"]]),
  "Combativité": T("ment", /combat|lache|abandon|baisse les bras|motiv/, [
    ["Se fixer un objectif par séance", "Aller au bout de l'exercice", "Ne pas abandonner"],
    ["Aller au bout de chaque point", "Garder l'énergie après une erreur", "Encourager son partenaire"],
    ["Ne rien lâcher quand on est mené", "Rester agressif jusqu'à la fin", "Gagner un point difficile"]], [
    ["Mon objectif du jour", "Au début, chacun annonce un objectif ; on le vérifie à la fin.", "Objectif tenu au moins une fois par séance.", "Le prof note, l'élève s'auto-évalue"],
    ["Aller chercher toutes les balles", "Jeu où chaque balle doit être jouée, même difficile.", "Aucune balle abandonnée sur 10 échanges.", "+ difficile : sous fatigue"],
    ["Match à remonter", "Match court commencé à 0-3 pour l'un des joueurs.", "Le joueur mené reste combatif jusqu'à la fin.", "Alterner les rôles"]]),
};
export const THEME_NAMES = Object.keys(THEMES);

// Niveaux : Galaxie Tennis et adultes. `ok` = thèmes proposés à ce niveau ; `core` = thèmes de base toujours programmés.
export type LevelDef = { key: string; age: string; terrain: string; ball: string; att: [string, string, string]; ok: string[]; core: string[]; kids: boolean };
const NOT = (...x: string[]) => THEME_NAMES.filter((n) => !x.includes(n));
export const LEVELS_FFT: LevelDef[] = [
  { key: "Balle violette · 4-6 ans", age: "4 à 6 ans", terrain: "Terrain de 8 à 10 m, filet très bas", ball: "balle violette ou en mousse", kids: true,
    att: ["Lancer, rattraper et se déplacer vers la balle", "Premiers échanges avec rebond", "Jouer avec les autres en respectant une règle simple"],
    ok: ["Coup droit", "Revers", "Jeu de jambes", "Vitesse", "Confiance", "Concentration"], core: ["Coup droit", "Revers", "Jeu de jambes"] },
  { key: "Balle rouge · 5-7 ans", age: "5 à 7 ans", terrain: "Terrain de 12 à 15 m", ball: "balle rouge", kids: true,
    att: ["Maîtriser les trajectoires", "Frapper après le rebond, coup droit puis revers", "Échanger quelques balles avec un partenaire"],
    ok: ["Coup droit", "Revers", "Service", "Jeu de jambes", "Vitesse", "Construire le point (régularité)", "Confiance", "Concentration", "Combativité"], core: ["Coup droit", "Revers", "Jeu de jambes", "Construire le point (régularité)"] },
  { key: "Balle orange · 7-9 ans", age: "7 à 9 ans", terrain: "Terrain de 18 m, filet de 0,80 m", ball: "balle orange", kids: true,
    att: ["Couvrir le terrain : se déplacer et se replacer", "Coup droit et revers enchaînés, premiers services", "Jouer de petits matchs avec le score"],
    ok: NOT("Smash", "Lecture du jeu", "Explosivité"), core: ["Coup droit", "Revers", "Service", "Jeu de jambes", "Construire le point (régularité)"] },
  { key: "Balle verte · 9-12 ans", age: "9 à 12 ans", terrain: "Terrain de 23,77 m", ball: "balle verte", kids: true,
    att: ["Jouer sur grand terrain : service puis échange", "Varier hauteur et direction", "Jouer des points et des matchs complets"],
    ok: THEME_NAMES, core: ["Coup droit", "Revers", "Service", "Retour de service", "Construire le point (régularité)", "Jeu de jambes"] },
  { key: "Balle jaune · 10-14 ans", age: "10 à 14 ans", terrain: "Terrain de 23,77 m, balle normale", ball: "balle jaune", kids: true,
    att: ["Jeu complet : service, retour, attaquer, défendre", "Choisir la bonne solution selon la situation", "Jouer des matchs en compétition"],
    ok: THEME_NAMES, core: ["Service", "Retour de service", "Attaquer", "Défendre", "Construire le point (régularité)", "Concentration"] },
  { key: "Adultes · débutant", age: "Adultes", terrain: "Terrain entier ; balle verte conseillée au début", ball: "balle verte puis jaune", kids: false,
    att: ["Coup droit et revers de base", "Service simple et échanges réguliers", "Premiers points joués"],
    ok: NOT("Smash", "Lecture du jeu", "Combativité", "Explosivité"), core: ["Coup droit", "Revers", "Service", "Construire le point (régularité)", "Jeu de jambes"] },
  { key: "Adultes · intermédiaire", age: "Adultes", terrain: "Terrain entier", ball: "balle jaune", kids: false,
    att: ["Jeu régulier avec direction", "Service et retour fiables", "Premiers schémas tactiques"],
    ok: THEME_NAMES, core: ["Service", "Retour de service", "Construire le point (régularité)", "Volée", "Variations", "Concentration"] },
  { key: "Adultes · compétition", age: "Adultes", terrain: "Terrain entier", ball: "balle jaune", kids: false,
    att: ["Jeu complet et varié", "Gestion du score et de l'adversaire", "Condition physique et mental"],
    ok: THEME_NAMES, core: ["Service", "Retour de service", "Attaquer", "Montées au filet", "Lecture du jeu", "Gestion des émotions", "Endurance"] },
];
export const levelDef = (key: string) => LEVELS_FFT.find((l) => l.key === key) ?? LEVELS_FFT[2];

export const BILAN_LEVELS = [
  { label: "Non maîtrisé", short: "À acquérir", color: "#d64545" },
  { label: "En cours d'acquisition", short: "En cours", color: "#e8920c" },
  { label: "En maîtrise", short: "Acquis", color: "#2c9a5b" },
  { label: "Point fort", short: "Point fort", color: "#897e67" },
];

export type Session = { kind: "bilan" | "etape" | "jeu" | "theme"; theme: string; title: string; skills: string; exercise: string; fil: string; why: string; note: string; done: boolean };
export type Group = { id: string; name: string; level: string; size: number; minutes: number; bilan: Record<string, number>; notes: string; sessions: Session[] };
export const PHASES = ["Les bases", "La consolidation", "La mise en jeu"] as const;
export const phaseOf = (i: number) => (i < 10 ? 0 : i < 20 ? 1 : 2);
export const newId = () => "g" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
// Thèmes cités dans le texte libre du prof (mots-clés)
export function themesInText(text: string): Record<string, number> {
  const t = norm(text), out: Record<string, number> = {};
  for (const n of THEME_NAMES) { const m = t.match(new RegExp(THEMES[n].kw.source, "g")); if (m) out[n] = m.length; }
  return out;
}

// Poids d'un thème : ce que le bilan montre comme à acquérir + ce que le texte cite + la base du niveau
export function weights(g: Group): Record<string, number> {
  const L = levelDef(g.level), kw = themesInText(g.notes), w: Record<string, number> = {};
  for (const n of THEME_NAMES) {
    if (!L.ok.includes(n)) continue;
    const b = g.bilan[n]; let v = 0;
    if (b === 0) v += 3; else if (b === 1) v += 2; else if (b === 2) v += 0.6; else if (b === 3) v += 0.15;
    v += (kw[n] || 0) * 1.5; if (L.core.includes(n)) v += 1;
    if (v > 0) w[n] = v;
  }
  return w;
}

// Pourquoi ce thème est programmé : ce que le prof a noté au bilan, ce qu'il a écrit, ou la base du niveau
export function whyOf(g: Group, theme: string): string {
  const b = g.bilan[theme], kw = themesInText(g.notes)[theme], L = levelDef(g.level);
  const parts: string[] = [];
  if (b !== undefined && b <= 1) parts.push(`bilan : « ${BILAN_LEVELS[b].label.toLowerCase()} »`);
  else if (b === 2) parts.push("bilan : acquis, à consolider");
  if (kw) parts.push("cité dans tes remarques");
  if (L.core.includes(theme)) parts.push("base de ce niveau");
  return parts.length ? parts.join(" · ") : "complète la progression";
}

const material = (g: Group) => { const L = levelDef(g.level); return `Matériel : ${L.ball}, ${L.terrain.toLowerCase()}.`; };
export function sessionFor(g: Group, theme: string, phase: number, fil: string): Session {
  const th = THEMES[theme], ex = th.e[phase], fr = THEMES[fil];
  const skills = th.s[phase].map((x) => "• " + x).join("\n");
  const exercise = `${ex[0]}\nDispositif : ${ex[1]}\nCritère de réussite : ${ex[2]}\nVariables : ${ex[3]}\n${material(g)}`;
  return { kind: "theme", theme, title: `${theme} · ${PHASES[phase].toLowerCase()}`, skills, exercise, fil: fr ? `${fil} : ${fr.s[phase][0]}` : fil, why: whyOf(g, theme), note: "", done: false };
}

export function generate(g: Group): Session[] {
  const w = weights(g);
  let ranked = Object.keys(w).sort((a, b) => w[b] - w[a]);
  const L = levelDef(g.level);
  if (!ranked.length) ranked = L.core.slice();
  const main = ranked.filter((n) => THEMES[n].d !== "ment" || w[n] >= 3).slice(0, 10);
  const pool = main.length ? main : ranked.slice(0, 8);
  const total = pool.reduce((a, n) => a + (w[n] || 1), 0);
  const q: Record<string, number> = {}; let used = 0;
  pool.forEach((n) => { q[n] = Math.max(1, Math.round((24 * (w[n] || 1)) / total)); used += q[n]; });
  let i = 0; while (used > 24 && i < 500) { const n = pool[pool.length - 1 - (i % pool.length)]; if (q[n] > 1) { q[n]--; used--; } i++; }
  i = 0; while (used < 24 && i < 500) { q[pool[i % pool.length]]++; used++; i++; }
  const seq: { n: string; pos: number }[] = [];
  pool.forEach((n) => { for (let k = 0; k < q[n]; k++) seq.push({ n, pos: (k + 0.5) / q[n] - (g.bilan[n] === 0 ? 0.08 : 0) + (THEMES[n].d === "tact" ? 0.1 : 0) + (THEMES[n].d === "tech" ? -0.03 : 0) }); });
  seq.sort((a, b) => a.pos - b.pos || (w[b.n] || 0) - (w[a.n] || 0));
  // Fil rouge : les thèmes physique et mental les plus à travailler, sinon des valeurs par défaut
  const fils = Object.keys(w).filter((n) => THEMES[n].d === "phys" || THEMES[n].d === "ment").sort((a, b) => w[b] - w[a]);
  const defaults = L.ok.filter((n) => n === "Jeu de jambes" || n === "Concentration");
  const fr = fils.length ? fils : defaults.length ? defaults : ["Concentration"];
  const bilanSession = (title: string, skills: string, exercise: string): Session => ({ kind: "bilan", theme: "", title, skills, exercise, fil: "", why: "", note: "", done: false });
  const jeu = (t: string, d: string): Session => ({ kind: "jeu", theme: "", title: t, skills: "• Appliquer en match ce qui a été travaillé", exercise: d, fil: "", why: "", note: "", done: false });
  // Trame des 30 séances : 1 = départ, 10 / 20 = match à thème, 15 = point d'étape, 25 = mise en match, 30 = bilan ; les 24 autres sont les thèmes
  const special: Record<number, Session> = {
    0: bilanSession("Point de départ", "• Situations de référence : on observe sans corriger\n• Noter ce qui est acquis et ce qui ne l'est pas", `Reprendre des situations simples et toujours les mêmes (échange cross, service, déplacements) pour mesurer le départ. À refaire à la séance 15 et à la séance 30 pour comparer.\n${material(g)}`),
    9: jeu("Match à thème", "Jeu libre avec une consigne par joueur : on observe, on corrige peu."),
    14: { kind: "etape", theme: "", title: "Point d'étape", skills: "• Refaire les situations de la séance 1\n• Comparer avec le départ", exercise: `Mêmes situations qu'à la séance 1. Comparer ce qui a progressé et adapter la suite de la programmation.\n${material(g)}`, fil: "", why: "", note: "", done: false },
    19: jeu("Match à thème", "Mini-matchs avec point bonus quand le thème du cycle est réussi."),
    24: jeu("Mise en match", "Sets courts : on applique ce qu'on a travaillé, le groupe s'auto-évalue à la fin."),
    29: bilanSession("Bilan de fin de saison", "• Refaire les situations de départ\n• Écrire ce qui a progressé et ce qui reste à travailler", `Mêmes situations qu'à la séance 1. Chaque joueur dit ce qu'il a réussi. Servira de point de départ pour la saison suivante.\n${material(g)}`),
  };
  const list: Session[] = []; let k = 0;
  for (let i = 0; i < 30; i++) { if (special[i]) list.push(special[i]); else { const s = seq[k]; list.push(sessionFor(g, s.n, phaseOf(i), fr[k % fr.length])); k++; } }
  return list;
}

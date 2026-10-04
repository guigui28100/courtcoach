# CourtCoach – nouvelle version (React + Nest + Prisma + Tailwind)

Le site actuel (dossier racine, HTML/JS) **reste en ligne et intact** pendant la migration.
Cette nouvelle version, avec de **vrais comptes** et une **base de données**, se construit ici, étape par étape.

```
apps/
  web/   → ce que voient les gens (React + Vite + Tailwind)
  api/   → le serveur (NestJS) + la base de données (Prisma, PostgreSQL)
```

## Où on en est

| Étape | Contenu | État |
|---|---|---|
| 1 | Fondations : comptes sécurisés, rôles, base de données, Centre de compétition (fiches, accords des parents, invitations, objectifs), demandes de cours | ✅ fait |
| 2 | Évaluations trimestrielles (21 compétences, toile d'araignée), matchs, bulletins imprimables / PDF, « Mon suivi » complet pour les familles | ✅ fait |
| 3 | Vidéos (envoi, stockage privé, accord « droit à l'image » obligatoire, suppression après 12 mois), analyses liées aux objectifs, discussion avec le coach | ✅ fait |
| 4 | Studio d'analyse : ralenti et image par image, dessin sur une image figée (ligne, flèche, cercle, trait libre, angle en degrés), images annotées jointes à l'analyse et au bulletin, comparaison de deux vidéos côte à côte | ✅ fait |
| 5 | Reprise de toutes les protections (RGPD) et bascule du site | à faire |

## Ce qui est nouveau côté sécurité et vie privée
- **Vrais comptes** : mots de passe protégés (Argon2), blocage après 5 essais ratés, déconnexion automatique, connexion qui se renouvelle toute seule.
- **Le coach n'est jamais une inscription libre** : son compte est créé par le club (`npm run create-coach`).
- **Les jeunes n'ont pas d'inscription libre** : le coach crée la fiche, enregistre l'accord écrit des parents, puis **crée l'accès** (identifiant = e-mail du parent, **mot de passe provisoire** affiché une seule fois, à changer à la première connexion : le coach ne connaît jamais le mot de passe définitif). Alternative : un **lien d'invitation** à usage unique (7 jours). Le coach peut retirer un accès à tout moment.
- **Cloisonnement** : une famille ne voit que son enfant ; jamais les notes privées du coach. Testé automatiquement (19 tests).
- **Journal** des actions sensibles, **export** et **suppression** des données, **conservation 12 mois** signalée.

## Lancer en local (pour tester)
Il faut Node 22 et une base PostgreSQL.
```bash
cd apps/api
cp .env.example .env        # puis remplir DATABASE_URL et JWT_SECRET
npm install
npx prisma migrate deploy
COACH_EMAIL=moi@exemple.fr COACH_PASSWORD='un-long-mot-de-passe' npm run create-coach
npm run build && npm start   # http://localhost:3000

cd ../web
npm install
npm run dev                  # http://localhost:5173
```
Tests du serveur : `cd apps/api && npm test`.

## Mise en ligne sur Vercel (deux projets)
> 👉 Version pas à pas pour débutant : voir `GUIDE-MISE-EN-LIGNE.md` à la racine. Le compte coach se crée sur la page `/installation` (protégée par la clé `SETUP_TOKEN`, qui ne marche qu'une fois).
1. **Base de données** : dans Vercel → *Storage* → créer une base **Postgres** (Neon) en région **Europe**. Copier `DATABASE_URL`.
2. **Projet « courtcoach-api »** : importer le dépôt, *Root Directory* = `apps/api`. Variables : `DATABASE_URL`, `JWT_SECRET` (`openssl rand -base64 48`), `WEB_ORIGIN` (adresse du site, ex. `https://courtcoach.vercel.app`), `NODE_ENV=production`. Région des fonctions : Paris (cdg1).
3. **Projet « courtcoach » (le site)** : importer le dépôt, *Root Directory* = `apps/web`. Si le projet de l'API n'a pas l'adresse `courtcoach-api.vercel.app`, corriger `apps/web/vercel.json` (ligne `destination`).
4. Créer le compte coach : lancer une fois `npm run create-coach` avec les variables ci-dessus (je te guide).

⚠️ Tant que ces étapes ne sont pas faites, **ne saisis aucune vraie donnée d'enfant**.
Avant l'ouverture : voir `RGPD-A-FAIRE.md` à la racine (registre, analyse d'impact, contrat avec l'hébergeur, relecture par la fédération/CNIL).

## Vidéos (étape 3)
- Le fichier est envoyé par morceaux de 2 Mo et gardé **dans la base de données** (Europe) : pas de service de stockage de plus. Maximum 80 Mo par vidéo (filmer 10 à 30 secondes) ; espace total limité par `VIDEO_QUOTA_MB` (350 par défaut, car la base gratuite fait 512 Mo).
- Lecture par tranches, uniquement pour les personnes autorisées (coach ; l'adulte propriétaire ; la famille du joueur).
- Suppression automatique après 12 mois : une tâche nocturne (`/api/cron/purge`) protégée par la variable `CRON_SECRET` à créer sur Vercel (voir `GUIDE-MISE-EN-LIGNE.md`).
- Retirer l'accord « droit à l'image » supprime les vidéos du joueur ; supprimer son compte supprime celles d'un adulte.

## Studio d'analyse (étape 4)
- Réservé au coach, sur la page d'une vidéo. Les images annotées (JPEG, 700 Ko maximum, 8 par vidéo) sont gardées en base avec la vidéo : elles disparaissent avec elle (12 mois, retrait de l'accord image, suppression du compte) et comptent dans l'espace utilisé.
- L'adhérent ou la famille ne voit les images qu'une fois l'analyse envoyée ; jamais un autre adulte ni une autre famille.
- Outil **Texte** pour écrire sur une image (il reste toujours dans l'image).
- **Comparaison de deux vidéos** du même élève (même joueur, ou même adhérent : aucun mélange adultes / Centre), la plus ancienne à gauche : pour chaque vidéo, le coach marque « le geste démarre ici », puis les deux vidéos se lisent calées sur ce départ (lecture, image par image, ralenti, curseur communs). Il peut figer la comparaison, l'annoter et l'enregistrer comme une image de l'analyse de la première vidéo.

## Espace « galaxie » du jeune
Quand un jeune se connecte, sa page « Mon suivi » devient « Ma galaxie tennis » : fond d'étoiles, une balle de tennis qui flotte, **missions** (ses objectifs) avec une fusée qui avance et une étoile à 100 %, **radar** de la dernière évaluation avec « le mot de ton coach », matchs, vidéos et bulletins. **Navigation par onglets** (un seul sujet à l'écran) : 🏠 Accueil (ce qu'il y a à faire : analyse reçue, bulletin à remplir, missions), 🚀 Missions, ✍️ Mon bulletin, 🎬 Vidéos, 📡 Progrès (radar, bulletins, matchs), 🔒 Compte. Une pastille rose signale du nouveau ; l'onglet est dans l'adresse (`?onglet=videos`), donc le bouton « retour » fonctionne. Les parents gardent la présentation sobre, mais avec les mêmes onglets (🏠 Accueil, 🎯 Objectifs, 📊 Évaluations, 🏟️ Matchs, 🎬 Vidéos, 🔒 Compte). **Au début d'un trimestre, une mission n'a pas de statut** : elle est « 🎯 À travailler » jusqu'à ce que le coach fasse le point (atteint / en progrès / pas atteint). Le bouton « Créer un joueur d'exemple » crée un jeune en début de saison (rien d'évalué) ; « Exemple en fin de trimestre » crée un jeune avec objectifs évalués et bulletin. Rien n'est chargé depuis un autre site.

## Bulletin
Le bulletin d'un trimestre s'ouvre sur un bandeau d'en-tête coloré, puis **les objectifs du trimestre en premier** (bilan des statuts, un encadré par objectif avec son statut, sa barre, la mention « reconduit » et le commentaire du coach) et « pour le trimestre suivant ». Vient ensuite **« 📸 Image du joueur »** : moyenne générale en anneau, radar et compétences par domaine en cartes de couleur, **points forts**, **à travailler** et **mot du coach**. Puis la compétition (victoires), les analyses vidéo avec images annotées et les signatures. À l'impression ou en PDF, le fond étoilé disparaît (page blanche A4) mais les couleurs du bandeau et des cartes sont conservées ; les blocs ne sont jamais coupés en deux.

## Le cycle de suivi de la saison
1. **Bilan de début d'année** (septembre) : le coach note les mêmes 21 compétences que dans les bulletins (technique, tactique, physique, mental, attitude ; « Volée et jeu au filet » reste une seule compétence). C'est le point de départ de la saison (une évaluation « trimestre 0 »), imprimable comme un bulletin.
2. **Objectifs par trimestre** (onglet Objectifs : on les fixe, on les planifie et on prépare le trimestre suivant) : chaque objectif est limité à certains trimestres (rien de coché = toute la saison) et peut viser une compétence du bilan.
3bis. **Auto-évaluation du jeune** : dans sa galaxie, « ✍️ Mon bulletin du trimestre » (météo, missions réussies / en progrès / pas encore, ressenti par domaine, phrases à cocher, mot libre de 300 caractères). Brouillon enregistrable, puis envoi au coach (verrouillé après envoi). Le coach la lit dans l'onglet Évaluations (lecture seule) et elle figure sur le bulletin (« Le regard du joueur »).
3. **Bulletin de fin de trimestre** (onglet Évaluations) : le coach évalue d'abord **les objectifs fixés pour le trimestre** ; les 21 compétences deviennent facultatives (repliées). Il donne pour chaque objectif un **statut** (✅ atteint, 🔄 en progrès, ❌ pas atteint), l'avancement en % et **son commentaire**. Le bulletin montre le radar (trimestre, trimestre précédent, départ de la saison), le détail « départ » par compétence, les objectifs avec statut, commentaire et « 🔁 reconduit depuis le T1 », le mot du coach et les matchs.
4. **Préparer le trimestre suivant** (onglet Objectifs) : pour chaque objectif du trimestre, **clore** (atteint), **reconduire** (pas atteint) ou **remplacer** par un nouveau, plus de nouveaux objectifs libres. Seuls les trimestres suivants sont modifiés : les bulletins déjà faits ne bougent jamais.

L'avancement « actuel » (espace du jeune) suit le dernier trimestre renseigné. L'espace du jeune montre ses missions du trimestre avec leur statut, ce qui est reconduit et son point de départ. Seul le coach modifie ; la famille lit.

## Limites connues (honnêteté)
- Aucun e-mail n'est envoyé par l'application : le coach copie le lien d'invitation et l'envoie lui-même.
- La limitation des essais de connexion tourne « par instance » sur Vercel ; le blocage du compte après 5 échecs, lui, est enregistré en base.
- Le rattachement de Nest à Vercel (`apps/api/api/index.ts`) suit l'usage courant mais n'a pas pu être testé sur Vercel depuis l'environnement de développement : à vérifier au premier déploiement.
- Un avertissement `npm audit` subsiste sur l'outil de développement Prisma (non utilisé en production).

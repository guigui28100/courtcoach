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
- La comparaison de deux vidéos ne propose que des vidéos du même élève (même joueur, ou même adhérent) : aucun mélange adultes / Centre.

## Limites connues (honnêteté)
- Aucun e-mail n'est envoyé par l'application : le coach copie le lien d'invitation et l'envoie lui-même.
- La limitation des essais de connexion tourne « par instance » sur Vercel ; le blocage du compte après 5 échecs, lui, est enregistré en base.
- Le rattachement de Nest à Vercel (`apps/api/api/index.ts`) suit l'usage courant mais n'a pas pu être testé sur Vercel depuis l'environnement de développement : à vérifier au premier déploiement.
- Un avertissement `npm audit` subsiste sur l'outil de développement Prisma (non utilisé en production).

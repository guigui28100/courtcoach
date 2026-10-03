# Règles du projet – Tennis Club Houdan (CourtCoach)

## Qui je suis
- Je suis professeur bénévole au Tennis Club Houdan et grand débutant en informatique.
- Explique-moi tout simplement, en français, sans jargon. Si un mot technique est
  indispensable, explique-le en une phrase.

## Le site
- Site statique simple : HTML, CSS, et un peu de JavaScript seulement si besoin.
- Aucun framework, aucune installation (pas de npm, pas de build).
- `index.html` est à la racine du dépôt (le site est publié par Vercel).
- Il doit être clair, accessible et parfaitement lisible sur téléphone.

## Données personnelles
- Aucune donnée personnelle d'élève sur le site (noms, photos, téléphones, e-mails,
  niveaux, etc.).

## Façon de travailler
- Après chaque modification : faire un commit avec un message clair en français,
  pousser la branche et ouvrir une pull request pour que je voie l'aperçu Vercel
  avant de publier.
- À la fin, résumer en 2 ou 3 phrases ce qui a été changé.

## État de l'application (démonstration)
- Les pages `espace`, `profil`, `videos`, `analyse` et `messages` fonctionnent en **démonstration** :
  tout est enregistré dans le navigateur de la personne (aucun envoi sur Internet).
- Pour recevoir de vraies vidéos d'élèves, il faudra plus tard un service en ligne
  (comptes, stockage des vidéos, messagerie). À décider avec moi avant de le faire,
  car cela touche aux données personnelles, surtout celles des mineurs.
- Il n'y a **pas de messagerie libre** : la discussion entre l'élève et le coach existe seulement
  rattachée à une analyse vidéo, et elle s'ouvre une fois l'analyse envoyée.
- Le dossier `demo/` contient deux vidéos d'exemple **fictives** (un bonhomme qui fait un coup droit) pour tester ;
  l'élève « Alex Exemple » est lui aussi fictif. Aucune vraie personne n'y figure.

## Centre de compétition jeunes (réservé au coach, démonstration)
- Pages `suivi` (liste), `joueur` (dossier : profil, objectifs de l'année, évaluations trimestrielles, vidéos/analyses, bulletins) et `bulletin` (version imprimable / PDF).
- Les joueurs « Léo, Nina, Hugo Exemple » sont **fictifs** (bouton « Charger des joueurs d'exemple »). Ne saisis pas de vraies données d'enfants tant qu'un service en ligne sécurisé n'existe pas.
- Tout est enregistré dans le navigateur du coach (rien n'est envoyé sur Internet).
- Le coach peut relier un joueur à un compte élève (onglet Profil du dossier) : l'élève voit alors en lecture seule la page `mon-suivi` (objectifs, évaluations, analyses, bulletins). Jamais les notes privées, la santé ni les autres joueurs. Dans la démonstration, Léo Exemple est relié à Alex Exemple.

## Vie privée et RGPD (comptes de mineurs)
- Page `confidentialite.html` (politique en français), à garder à jour. Pied de page avec lien « Confidentialité » sur toutes les pages.
- Aucun service extérieur : polices dans `fonts/`, pas de statistiques ni de cookies de suivi. Ne rien ajouter qui appelle un autre site (en-têtes de sécurité dans `vercel.json`, qui bloquent de toute façon).
- Création de compte : trois profils (Adulte, Jeune du Centre de compétition jeunes, Enseignant). Case « politique lue » obligatoire ; pour un jeune : prénom + accord du parent, puis validation par le coach (page `suivi`, « Inscriptions de jeunes à valider »).
- Droits : « Mon profil » permet de télécharger et de supprimer ses données ; le dossier d'un joueur peut être téléchargé / supprimé par le coach. Pas de vidéo d'un joueur sans autorisation des parents enregistrée.
- La liste de ce qui reste à faire avant de vraies données est dans `RGPD-A-FAIRE.md`.
- Sécurité : aucun `innerHTML` avec du texte saisi ; pas de script écrit dans les pages (`script-src 'self'`) ; déconnexion automatique après 30 min (`layout.js`) ; `autorisation.html` = formulaire parental imprimable. La « connexion » reste fictive en démonstration (voir `RGPD-A-FAIRE.md`).

## Migration vers React + Nest + Prisma + Tailwind (décidée avec le coach)
- Les règles « aucun framework / pas de npm / pas de build » **ne valent plus pour le dossier `apps/`** : la nouvelle version y utilise React (Vite) + Tailwind (`apps/web`), NestJS + Prisma + PostgreSQL (`apps/api`), déployée sur Vercel (deux projets). Voir `apps/README.md`.
- Le site actuel (racine) reste en ligne et intact tant que la nouvelle version n'est pas complète ; ne rien casser à la racine. `.vercelignore` (racine) s'applique à TOUS les projets Vercel du dépôt : n'y mets surtout pas `apps` (cela cacherait le code du serveur). Le site actuel redirige `/apps/*` vers l'accueil (`vercel.json` racine).
- Toutes les règles de vie privée et de sécurité continuent de s'appliquer (mineurs, RGPD, pas de service extérieur, cloisonnement, journal). Toute nouvelle route de l'API doit vérifier les droits et avoir un test dans `apps/api/test`.
- Vidéos (étape 3) : gardées en base par morceaux de 2 Mo, jamais d'accès sans vérifier les droits ; accord « droit à l'image » obligatoire pour un jeune (retiré = vidéos supprimées) ; suppression automatique après 12 mois (`/api/cron/purge`, `CRON_SECRET`). Pas d'exercices correctifs pour les jeunes du Centre, mais des liens vers leurs objectifs ; l'inverse pour les adultes.
- Studio d'analyse (étape 4) : images annotées gardées en base avec la vidéo (même suppression), visibles de la personne concernée seulement après l'envoi de l'analyse ; comparaison limitée aux vidéos du même élève.
- Sécurité : la session se ferme après 30 minutes sans activité (jeton de renouvellement de 30 min, côté serveur) ; une seule demande de renouvellement à la fois côté site. `apps/api/test/routes.e2e-spec.ts` liste toutes les routes : une nouvelle route doit être protégée (et ajoutée à la liste des routes publiques seulement si c'est voulu). Revue détaillée : `apps/SECURITE.md`.
- Le coach crée les fiches des jeunes ; pas d'inscription libre pour les jeunes ni pour les coachs.
- Explications au coach toujours simples, en français. Étapes livrées en pull requests séparées.
- **Cloisonnement absolu** : un compte « demande de coaching » (adulte) n'a aucun accès au Centre de compétition jeunes (fiches, objectifs, évaluations, vidéos, accès). Le contrôleur des joueurs est réservé au coach et aux familles invitées ; le test « un adulte n'a AUCUN accès » doit rester vert et être étendu à chaque nouvelle route du Centre.
- Serveur Vercel : les paquets de `apps/api` doivent rester compatibles « CommonJS » (Nest 11, `@nestjs/jwt` 11). Nest 12 est ESM seulement : Vercel n'accepte pas `require()` d'un module ESM (erreur `ERR_REQUIRE_ESM`). Avant de monter de version, tester avec `node --no-experimental-require-module` que `dist/app.factory` se charge.

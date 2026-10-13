# Revue de sécurité de la nouvelle version (octobre 2026)

Ce document résume ce qui a été contrôlé, ce qui a été corrigé, et ce qui reste à faire. Explications simples, sans jargon.

## Ce qui a été contrôlé
- **Toutes les routes du serveur** (une liste automatique, vérifiée à chaque test) : sans connexion, tout est refusé sauf la connexion, l'inscription adulte, l'installation (fermée après le premier coach), l'invitation et le test de santé. Les routes réservées au coach refusent adultes, parents et jeunes. Toutes les routes du Centre refusent les adultes.
- **Auto-évaluation du jeune** : écriture réservée au jeune et à sa famille (le coach et les adultes reçoivent 403), identifiants de phrases validés par un motif strict (pas de texte libre sauf 300 caractères, jamais affiché en HTML brut), verrouillée après envoi, effacée avec la fiche, incluse dans l'export. Testé dans `selfeval.e2e-spec.ts`.
- **Cloisonnement** (adulte / famille / autre famille) pour les fiches, objectifs, évaluations, vidéos, images annotées et discussions : testé dans les deux sens.
- **Mots de passe** : protégés par Argon2 ; blocage 15 minutes après 5 erreurs ; message identique que le compte existe ou non ; mot de passe provisoire à changer à la première connexion.
- **Cookies de connexion** : invisibles du JavaScript, envoyés seulement en HTTPS, limités au site.
- **Attaques par un autre site** (CSRF) : toute action qui modifie des données vérifie l'adresse d'origine.
- **Code** : aucune requête construite à la main avec du texte saisi ; le seul affichage « brut » est celui de nos propres textes juridiques.
- **Vidéos** : le vrai format du fichier est vérifié (pas seulement son nom) ; lecture seulement pour les personnes autorisées ; jamais gardées dans le navigateur (`no-store`).
- **Outils installés** : le site n'a aucune faille connue. Le serveur n'en signale qu'une, dans l'outil Prisma qui sert uniquement à la construction (il ne reçoit jamais de données d'un visiteur) : sans risque réel.

- **Double authentification du coach** (code à 6 chiffres, `Sécurité` dans le menu) : clé chiffrée dans la base, un code ne sert qu'une fois, 8 codes de secours, échecs comptés dans le blocage. Testé dans `security.e2e-spec.ts`.
- **Mots de passe** : 10 caractères minimum, et refus des mots de passe trop faciles (liste courante, caractères répétés, contenant l'adresse e-mail).
- **Journal** : connexions réussies, échecs, blocages, ouverture d'une fiche ou d'une vidéo par le coach, mots de passe réinitialisés ; effacé après 12 mois (tâche de nuit).
- **Mot de passe oublié d'une famille** : bouton sur la fiche du joueur (nouveau mot de passe provisoire, anciennes sessions fermées).
- **Cookies** en mode « strict » (jamais envoyés depuis un autre site) ; réponses du serveur jamais gardées en cache ; le compte du coach ne peut pas être supprimé depuis le site.

## Ce qui a été corrigé pendant la revue
1. **Déconnexions aléatoires du coach** : quand le jeton de 15 minutes expirait, plusieurs requêtes simultanées demandaient chacune un renouvellement ; le serveur croyait à un vol et fermait la session. Désormais une seule demande est faite à la fois, et le serveur tolère 10 secondes de décalage (un vrai vol reste détecté).
2. **Session trop longue** : la session pouvait rester ouverte 30 jours sur un appareil oublié. Elle se ferme maintenant **côté serveur après 30 minutes sans activité** (comme annoncé dans la politique de confidentialité). Recharger la page dans les 30 minutes ne déconnecte plus.
3. Un test automatique garde la liste de toutes les routes : toute nouvelle route sans protection fait échouer les tests.

## Renforcements du 13 octobre 2026 (deuxième passage)
- **Changer ou réinitialiser un mot de passe ferme aussitôt TOUTES les anciennes sessions** (avant : un appareil déjà connecté pouvait rester ouvert jusqu'à 15 minutes). Le jeton de connexion contient une empreinte non réversible du mot de passe ; si le mot de passe change, l'ancien jeton est refusé. Le site renouvelle la session tout seul quand c'est légitime. Tests : `security.e2e-spec.ts`, `trainers.e2e-spec.ts`.
- **Le serveur n'accepte les appels d'un navigateur que depuis le site officiel** (réglage `WEB_ORIGIN`) ; sans ce réglage, tout est refusé (avant : ouvert par défaut). En production, le serveur refuse même de démarrer si `WEB_ORIGIN` manque. Une action envoyée depuis un autre site reste refusée (403). Testé.
- **Double authentification OBLIGATOIRE en option** : en ajoutant le réglage `REQUIRE_STAFF_2FA=true` sur le projet courtcoach-api, le coach et les entraîneurs ne peuvent plus rien faire tant qu'ils n'ont pas activé la double authentification (ils sont envoyés sur la page « Sécurité »). Ne l'activer qu'APRÈS avoir activé la sienne et rangé les codes de secours. Testé.
- Tests : 123 verts (3 nouveaux).

## Ce que SEUL le propriétaire peut faire (hors du code) : liste à cocher
1. **Double authentification sur GitHub, Vercel et Neon** (les trois comptes qui donnent accès au site et à la base). C'est la protection n°1 contre le piratage.
2. **Activer la double authentification du coach** sur CourtCoach (menu Sécurité), ranger les 8 codes de secours sur papier, puis ajouter `REQUIRE_STAFF_2FA=true` dans Vercel (projet courtcoach-api) et redéployer.
3. **GitHub** : protéger la branche `main` (Settings → Branches : « Require a pull request before merging »), et n'inviter personne d'autre sans réfléchir.
4. **Vercel** : marquer les variables `JWT_SECRET`, `DATABASE_URL`, `CRON_SECRET`, `TOTP_KEY` comme « Sensitive » ; ne jamais les copier dans un message, un e-mail ou une capture d'écran.
5. **Changer `JWT_SECRET` et `CRON_SECRET` une fois par an** (cela déconnecte tout le monde une fois : c'est normal). **Ne jamais changer `TOTP_KEY`** : cela casserait la double authentification déjà activée. Supprimer `SETUP_TOKEN` de Vercel une fois le compte coach créé.
6. **Neon** : vérifier que les sauvegardes sont actives et que la base est en Europe ; ne pas partager l'adresse de la base.
7. **Une fois par trimestre** : relire le journal de connexions (page Sécurité) et lancer `npm audit` dans `apps/api` et `apps/web` (je peux le faire pour toi).
8. **Ordinateur et téléphone** : mises à jour faites, verrouillage de l'écran, pas de session coach ouverte sur un appareil prêté.

## Recommandations de Vercel : ce qui s'applique à CourtCoach
| Recommandation | Pour CourtCoach |
| :-- | :-- |
| Ne jamais mettre un secret dans une variable visible du navigateur (`NEXT_PUBLIC_…`, chez nous `VITE_…`) | **Vérifié : rien à corriger.** Le site (`apps/web`) n'utilise AUCUNE variable d'environnement ; tous les secrets (`JWT_SECRET`, `DATABASE_URL`, `CRON_SECRET`, `TOTP_KEY`) restent côté serveur. Règle : ne jamais créer de variable `VITE_…` pour un secret. |
| Protection des déploiements (Deployment Protection) sur les aperçus | **À faire par toi dans Vercel** (Settings → Deployment Protection → « Vercel Authentication » pour les aperçus, sur courtcoach-7kdp et courtcoach-api). Les aperçus ne contiennent que l'interface, et le serveur refuse déjà tout appel venant d'une autre adresse que le site officiel, mais autant qu'ils ne soient pas publics. Tu restes connecté à Vercel, donc tu les ouvres comme avant. |
| Contrôler l'identité dans CHAQUE route, pas seulement dans l'interface | **Déjà le cas** : un garde global exige une connexion sur toutes les routes du serveur, puis un contrôle de rôle et de propriété (famille, entraîneur, coach). Un test automatique (`routes.e2e-spec.ts`) liste toutes les routes et échoue si l'une est ouverte par erreur. |
| Réseau privé (Secure Compute) | **Non applicable** : réservé à l'offre « Enterprise » de Vercel. À la place : la base Neon n'accepte que les connexions chiffrées (`sslmode=require`), avec un mot de passe long jamais partagé. |

## Ce qu'il reste à faire (par ordre d'importance)
1. **Activer la double authentification** sur ton compte coach (menu « Sécurité ») et ranger les codes de secours sur papier.
2. **Mot de passe oublié du coach** : le propriétaire du site le redéfinit avec la commande `create-coach` (voir `GUIDE-MISE-EN-LIGNE.md`). Pas de procédure par e-mail tant qu'aucun service d'envoi n'est choisi.
3. **Limitation des essais derrière deux serveurs Vercel** : à vérifier en conditions réelles (sinon la limite par adresse est partagée). Le blocage du compte après 5 erreurs, lui, fonctionne dans tous les cas.
4. **Sauvegardes et région** : vérifier dans Neon la durée de restauration de l'offre gratuite et que la base et les fonctions sont en Europe.
5. **Confirmation par e-mail de l'accord parental** : aujourd'hui le coach enregistre l'accord papier ; un vrai envoi d'e-mail demande un service d'envoi.
6. **E-mail déjà utilisé à l'inscription** : le message indique qu'un compte existe (risque faible, accepté).
7. **Faille signalée dans l'outil de construction Prisma** : sans risque réel (il ne reçoit jamais de données d'un visiteur) ; à corriger à la prochaine mise à jour majeure.

## Entraîneurs de comité (rôle TRAINER)
- Accès limité par `PlayerAccess` : une fiche, une vidéo ou un objectif d'un jeune non confié répond 404 (on ne révèle pas son existence).
- Réservé au coach : création / suppression / export d'un jeune, accords, comptes des familles, gestion des entraîneurs, dossiers inactifs, stockage.
- Santé et notes privées jamais envoyées à un entraîneur, et ignorées s'il tente de les modifier.
- Routes `/lessons` fermées aux entraîneurs. Test : `apps/api/test/trainers.e2e-spec.ts` et matrice `routes.e2e-spec.ts`.

## Suivi du squelette (studio d'analyse)
- Détecteur de posture MediaPipe exécuté DANS le navigateur ; modèle et fichiers WebAssembly servis par le site lui-même (aucun appel à un autre site, `connect-src 'self'` inchangé).
- La CSP ajoute seulement `'wasm-unsafe-eval'` à `script-src` : nécessaire pour compiler du WebAssembly, ne réactive pas `eval()`.
- Aucune donnée de posture n'est envoyée ni enregistrée : seule l'image annotée choisie par le coach l'est (comme avant).

## Programmations de tournoi (documents)
- Format vérifié sur le contenu du fichier (PDF, JPEG, PNG, docx, xlsx), 3 Mo maximum ; tout autre fichier (exécutable renommé, page web…) est refusé.
- Téléchargement : `X-Content-Type-Options: nosniff`, `Content-Security-Policy: sandbox`, Word et Excel toujours en téléchargement (jamais ouverts dans la page).
- Droits vérifiés à chaque lecture (coach : tout ; entraîneur : ses jeunes ; famille et jeune : seulement les documents partagés pour leur joueur) ; adultes : 403 ; chaque ouverture par le personnel est inscrite au journal.

## Vidéos (13/10/2026)
- Alerte `video-bulk-view` au journal (15 vidéos différentes en 10 min) et limite de 300 lectures/minute sur le fichier. À surveiller dans le journal du coach.

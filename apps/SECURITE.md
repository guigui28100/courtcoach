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

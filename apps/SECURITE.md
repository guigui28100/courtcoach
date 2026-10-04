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

## Ce qui a été corrigé pendant la revue
1. **Déconnexions aléatoires du coach** : quand le jeton de 15 minutes expirait, plusieurs requêtes simultanées demandaient chacune un renouvellement ; le serveur croyait à un vol et fermait la session. Désormais une seule demande est faite à la fois, et le serveur tolère 10 secondes de décalage (un vrai vol reste détecté).
2. **Session trop longue** : la session pouvait rester ouverte 30 jours sur un appareil oublié. Elle se ferme maintenant **côté serveur après 30 minutes sans activité** (comme annoncé dans la politique de confidentialité). Recharger la page dans les 30 minutes ne déconnecte plus.
3. Un test automatique garde la liste de toutes les routes : toute nouvelle route sans protection fait échouer les tests.

## Ce qu'il reste à faire (par ordre d'importance)
1. **Supprimer `SETUP_TOKEN` sur Vercel** (projet `courtcoach-api`, Settings, Environment Variables) : la page d'installation est déjà fermée, mais la clé n'a plus d'utilité.
2. **Double authentification pour le coach** (code à 6 chiffres sur le téléphone) : son compte donne accès aux données de tous les jeunes. Fortement conseillé avant les vraies familles.
3. **Mot de passe oublié** : il n'existe pas encore de procédure. Prévoir un bouton « réinitialiser le mot de passe » pour le coach (nouveau mot de passe provisoire, comme pour les familles).
4. **Limitation des essais derrière deux serveurs Vercel** : vérifier en conditions réelles que chaque visiteur est bien reconnu séparément (sinon la limite est partagée). Le blocage du compte après 5 erreurs, lui, est enregistré en base et fonctionne dans tous les cas.
5. **Sauvegardes** : vérifier dans Neon la durée de restauration proposée par l'offre gratuite, et la région (Europe) de la base et des fonctions.
6. **E-mail inconnu / déjà utilisé à l'inscription** : le message actuel indique qu'un compte existe déjà (risque faible, accepté pour l'instant).

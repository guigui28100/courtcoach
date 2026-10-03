# Protection des données (RGPD) – ce qui est fait et ce qui reste à faire

> Ce fichier est pour toi, coach. Il explique simplement où en est l'application.
> Je ne suis pas juriste : avant d'ouvrir un vrai service avec de vraies familles,
> fais relire ce dossier par la **fédération (FFT / comité)**, ou par la **CNIL**
> (cnil.fr, rubrique « associations »).

## Aujourd'hui : la démonstration
- Tout reste **dans le navigateur** de la personne. Rien n'est envoyé sur Internet : le club ne détient donc aucune donnée.
- **Ne saisis pas de vraies données d'enfants** tant que le service en ligne n'existe pas.

## Déjà prévu dans l'application
- **Aucun service extérieur** : polices hébergées sur le site (plus de connexion à Google), pas de statistiques, pas de cookies de suivi, pas de publicité.
- **Politique de confidentialité** claire en français (`confidentialite.html`), liée depuis le pied de page et la création de compte.
- **Consentement** à la création du compte : politique lue ; pour un **jeune du Centre de compétition jeunes**, accord d'un parent ou responsable légal (la date est enregistrée), puis **validation par le coach** avant d'ouvrir son suivi.
- **Droit à l'image** : pour un jeune du Centre de compétition jeunes, impossible d'ajouter une vidéo sans avoir enregistré l'autorisation écrite des parents.
- **Droits des personnes** : l'élève peut **télécharger** ses données et **supprimer** son compte (page « Mon profil »). Le coach peut télécharger ou supprimer le dossier d'un joueur.
- **Minimisation** : seules les informations utiles sont demandées ; la santé est facultative (« pas de diagnostic médical »).
- **Cloisonnement** : un élève ne voit que son propre suivi, jamais les notes privées du coach ni les autres joueurs.
- **En-têtes de sécurité** (fichier `vercel.json`) : le site ne peut charger que ses propres fichiers, ne peut pas être affiché dans un autre site, n'envoie pas de « référent ».

## Sécurité informatique : ce qui est fait dans le site
- **Aucune faille d'injection connue** : les textes saisis ne sont jamais interprétés comme du code (aucun `innerHTML` avec du texte saisi), et le site interdit les scripts écrits dans les pages ou venant d'ailleurs (en-têtes dans `vercel.json`).
- **Pas d'affichage dans un autre site** (anti-« clickjacking »), connexion chiffrée imposée (HTTPS), aucune information de provenance envoyée, caméra/micro/position bloqués.
- **Aucun mot de passe n'est enregistré** par la démonstration.
- **Déconnexion automatique** après 30 minutes sans activité (ordinateur partagé) ; bouton pour effacer toutes les données du Centre.
- **Longueur des champs limitée** ; seuls les fichiers vidéo (400 Mo max) sont acceptés.
- **Conservation** : les dossiers sans activité depuis plus de 12 mois sont signalés au coach pour suppression.
- **Formulaire d'autorisation parentale** imprimable (`autorisation.html`).

## ⚠️ Limites importantes de la démonstration
- La « connexion » est **fictive** : n'importe qui peut choisir « coach ». Cela ne pose pas de problème tant que tout reste dans le navigateur de chacun, mais **ne doit jamais exister dans un vrai service**.
- Un site sans serveur ne peut **pas** se protéger tout seul contre le piratage de comptes, le vol de mots de passe ou l'accès aux vidéos des autres. Ces protections n'existent que côté serveur.

## À faire AVANT d'utiliser de vraies données (je ne peux pas le faire à ta place)
1. **Décider du service en ligne** (comptes, stockage des vidéos). Choisir un hébergeur **dans l'Union européenne**, avec un contrat de sous-traitance (« DPA ») signé.
2. **Compléter la politique** : adresse e-mail de contact du club, durée de conservation (champs surlignés en jaune dans `confidentialite.html`).
3. **Nommer un responsable** au sein du club (le président est responsable légal ; un « référent données » peut t'aider).
4. **Registre des traitements** : un petit tableau (quelles données, pourquoi, qui y accède, combien de temps). La CNIL fournit un modèle gratuit.
5. **Analyse d'impact (AIPD)** : conseillée car il s'agit de **mineurs**, de **vidéos** et de **données de santé**. À faire avec le comité ou la fédération.
6. **Vérifier l'âge et l'accord parental pour de vrai** (e-mail de confirmation envoyé au parent), car aujourd'hui c'est une simple case à cocher.
7. **Informer les familles** (mail ou affichage au club) et recueillir l'autorisation de droit à l'image sur papier ou formulaire signé.
8. **Sécurité réelle** : mots de passe stockés de façon sécurisée, connexion chiffrée, sauvegardes, journal des accès, suppression automatique après la durée de conservation.
9. **Prévoir la procédure en cas de problème** (fuite de données) : prévenir la CNIL sous 72 heures et les familles concernées.

10. **Inscription « Enseignant »** : en vrai service, ne jamais laisser n'importe qui se déclarer coach. Les comptes coach doivent être créés ou validés par le club.
11. **Sécurité du service en ligne** (à exiger de l'hébergeur ou du prestataire) : mots de passe protégés par un algorithme dédié (Argon2/bcrypt), double authentification pour le coach, limitation des tentatives de connexion, accès aux vidéos par liens privés à durée limitée, chaque famille ne voyant que ses propres données (cloisonnement strict), journal des accès, sauvegardes chiffrées, mises à jour régulières, test d'intrusion avant l'ouverture.
12. **Comptes de coachs** : créés ou validés uniquement par le club ; limiter le nombre de personnes qui voient les dossiers de mineurs, avec un engagement de confidentialité signé.
13. **Charte de bonne pratique avec les mineurs** : échanges uniquement via l'application, jamais en messagerie privée personnelle ; en cas de signalement, une personne référente au club.


## Revue de sécurité de la nouvelle version
Voir `apps/SECURITE.md` (contrôles faits, corrections, et liste de ce qui reste : supprimer `SETUP_TOKEN`, double authentification du coach, mot de passe oublié, sauvegardes).

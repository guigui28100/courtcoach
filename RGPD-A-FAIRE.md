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
- **Consentement** à la création du compte : politique lue, et **accord d'un parent pour les moins de 15 ans** (la date est enregistrée).
- **Droit à l'image** : pour un jeune du Centre de compétition jeunes, impossible d'ajouter une vidéo sans avoir enregistré l'autorisation écrite des parents.
- **Droits des personnes** : l'élève peut **télécharger** ses données et **supprimer** son compte (page « Mon profil »). Le coach peut télécharger ou supprimer le dossier d'un joueur.
- **Minimisation** : seules les informations utiles sont demandées ; la santé est facultative (« pas de diagnostic médical »).
- **Cloisonnement** : un élève ne voit que son propre suivi, jamais les notes privées du coach ni les autres joueurs.
- **En-têtes de sécurité** (fichier `vercel.json`) : le site ne peut charger que ses propres fichiers, ne peut pas être affiché dans un autre site, n'envoie pas de « référent ».

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

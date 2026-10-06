# Registre des traitements de données – Tennis Club Houdan (CourtCoach)

> Document pour toi, coach, et pour le président du club (responsable légal). Brouillon préparé à partir du fonctionnement réel de l'application. À relire, compléter (surlignés ⚠️) et conserver : la CNIL le demande en cas de contrôle. Modèle officiel : cnil.fr, rubrique « registre des activités de traitement ».

**Responsable du traitement** : Tennis Club Houdan, représenté par son président ⚠️ (nom). **Référent données au club** : ⚠️ (nom). **Contact** : ⚠️ (e-mail du club).
**Hébergement** : site et serveur sur Vercel, base de données Neon (PostgreSQL) ⚠️ à confirmer : région Europe pour la base **et** pour les fonctions, contrat de sous-traitance (DPA) accepté.

| Traitement | Pourquoi (finalité) | Qui est concerné | Données | Qui y accède | Combien de temps | Base légale |
|---|---|---|---|---|---|---|
| Comptes adhérents adultes (demandes de coaching) | Recevoir et traiter des demandes de cours, analyser des vidéos | Adultes du club | E-mail, prénom, mot de passe chiffré, demandes, vidéos et analyses | Le coach et la personne | Tant que le compte existe ; vidéos 12 mois | Consentement |
| Centre de compétition jeunes : fiche joueur | Suivre la progression des jeunes compétiteurs | Jeunes (mineurs) | Prénom, nom, naissance, classement, profil de jeu, santé (facultatif), notes du coach | Le coach ; la famille (sauf notes privées) | Saison en cours puis 12 mois après le départ | Accord des parents, mission du club |
| Objectifs, évaluations, bulletins, matchs | Bilan de début d'année, objectifs par trimestre, bulletins | Jeunes | Notes, commentaires, résultats | Le coach ; le jeune et sa famille (lecture seule) | Idem fiche | Idem |
| Matchs déclarés par le jeune | Réfléchir à ses matchs, informer le coach | Jeunes | Date, type de match, résultat, score, niveau de l'adversaire (jamais de nom), ressenti, 2 points forts et 1 point à améliorer, réponse du coach | Le jeune (écriture 7 jours) et le coach ; **pas les parents** | Idem fiche | Idem |
| Étoiles de fin de cours | Encourager l'effort, l'attitude et les progrès | Jeunes | Date du cours, 1 à 3 étoiles, raison positive, court mot du coach | Le coach (écriture) ; le jeune et sa famille (lecture) | Idem fiche | Idem |
| Auto-évaluation du jeune | Faire s'exprimer le jeune en fin de trimestre | Jeunes | Choix proposés, mot libre (300 caractères) | Le jeune, sa famille ; le coach une fois envoyée | Idem fiche | Idem |
| Vidéos et analyses | Analyser les gestes techniques | Jeunes, adultes | Vidéos, images annotées, commentaires | Le coach ; la personne concernée | 12 mois puis suppression automatique | Droit à l'image signé (jeunes), consentement (adultes) |
| Discussion liée à une analyse | Échanger sur une analyse | Jeunes, adultes | Messages | Le coach et la personne concernée | Avec la vidéo | Idem |
| Comptes de connexion des familles | Accès sécurisé en lecture | Parents, jeunes | E-mail, mot de passe chiffré, dernière connexion | Le coach (liste d'accès) | Tant que la fiche existe | Accord des parents |
| Journal de sécurité | Détecter les usages anormaux | Tous les comptes | Qui, quelle action, quand (jamais le contenu) | Le coach / le propriétaire du site | 12 mois | Intérêt légitime (sécurité) |

**Destinataires / sous-traitants** : Vercel (hébergement), Neon (base de données). Aucun autre service, aucune publicité, aucune mesure d'audience, aucune transmission hors de l'Union européenne ⚠️ à confirmer avec les régions choisies.

**Mesures de sécurité** : mots de passe chiffrés (Argon2) ; double authentification du coach ; blocage après 5 erreurs ; session fermée après 30 minutes ; connexion chiffrée imposée ; cloisonnement strict (aucun accès des adultes aux jeunes, chaque famille voit son enfant) ; vidéos servies seulement après vérification des droits ; journal des actions sensibles ; suppression automatique des vidéos après 12 mois ; droits d'accès / effacement par la personne ou le coach. Détails : `apps/SECURITE.md`.

**Droits des personnes** : accès et copie (bouton « télécharger »), effacement (bouton « supprimer »), rectification (le coach), retrait du droit à l'image (les vidéos du jeune sont alors supprimées).

**Entraîneurs de comité** : comptes créés par le coach (e-mail, prénom, mot de passe chiffré). Chacun ne voit que les jeunes que le coach coche ; ni santé, ni notes privées ; aucun accès aux adultes. Ouvertures de fiche et de vidéo inscrites au journal (12 mois). Compte supprimable à tout moment par le coach ; double authentification possible.

**Programmations de tournoi** : document déposé par le coach ou un entraîneur de comité pour des jeunes précis (titre, fichier, jeunes concernés, auteur). Visible du coach et des entraîneurs concernés ; de la famille et du jeune seulement si le déposant l'a partagé. Conservation 12 mois, suppression avec la fiche.

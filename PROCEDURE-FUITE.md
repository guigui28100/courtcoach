# Que faire en cas de problème de sécurité (fuite ou piratage possible)

> Pour toi, coach, et le président du club. À garder sous la main. Ne panique pas : suis les étapes dans l'ordre.

## Quand l'appliquer
- Quelqu'un a pu voir des données qu'il ne devait pas voir (mauvais mail, mot de passe donné à la mauvaise personne, ordinateur volé et ouvert…).
- Une connexion étrange sur ton compte, ou une famille signale qu'elle voit un autre enfant.
- Un message de Vercel ou de Neon annonce un incident.

## Étape 1 – Arrêter l'hémorragie (tout de suite)
1. Change ton mot de passe (Sécurité → *Changer mon mot de passe*). Si tu soupçonnes ton compte, désactive puis réactive la double authentification pour obtenir une nouvelle clé.
2. Pour une famille concernée : sur la fiche du joueur, bouton **Mot de passe oublié** (donne un nouveau mot de passe provisoire et ferme ses connexions) ou **Retirer l'accès**.
3. Si le doute porte sur tout le site : demande-moi (ou au propriétaire du site) de changer la clé `JWT_SECRET` sur Vercel : cela déconnecte tout le monde immédiatement.

## Étape 2 – Noter les faits (le jour même)
Qui, quoi, quand, quelles données (nom des jeunes concernés, vidéos ?), comment c'était possible. Le journal du site garde les connexions et ouvertures de fiches par le coach (12 mois).

## Étape 3 – Prévenir (sous 72 heures)
- **CNIL** : si des données de mineurs ont été exposées, déclarer sur cnil.fr, rubrique « Notifier une violation de données » (obligation : dans les 72 heures après en avoir pris connaissance).
- **Les familles concernées** : message simple, sans jargon : ce qui s'est passé, quelles données, ce qui a été fait, qui contacter. Si le risque est élevé pour les enfants, c'est obligatoire.
- **Le président du club** et, si besoin, la fédération / le comité.

## Étape 4 – Corriger et garder la trace
Corriger la cause, noter la date, les personnes prévenues et les décisions dans un petit « registre des incidents » (même s'il n'y a pas eu d'alerte à la CNIL).

**Contacts** : CNIL cnil.fr · Président du club ⚠️ (tél.) · Référent données ⚠️ (tél.)

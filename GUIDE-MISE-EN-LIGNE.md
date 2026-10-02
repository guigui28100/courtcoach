# Guide : mettre CourtCoach en ligne (pas à pas, pour débutant)

Tu n'as besoin d'aucun terminal ni d'aucun code : tout se fait en cliquant sur le site de Vercel.
Les noms des boutons peuvent légèrement changer ; si tu es perdu, envoie-moi une capture d'écran.

⚠️ **Règle d'or** : ne copie jamais tes clés secrètes (« DATABASE_URL », « JWT_SECRET », « SETUP_TOKEN ») dans une conversation ou un e-mail. Elles se collent **uniquement** dans les réglages Vercel.

⚠️ **Tant que tout n'est pas testé, ne saisis aucune vraie donnée d'enfant.**

---

## Étape A – Fusionner les pull requests en attente
Sur GitHub, ouvre chaque pull request qui t'est donnée dans la conversation, puis clique **Merge pull request** → **Confirm merge**.

## Étape B – Créer la base de données (l'« armoire »)
1. Va sur **vercel.com** et connecte-toi.
2. Menu du haut : **Storage** → **Create Database**.
3. Choisis **Neon** (Postgres) → **Continue**.
4. Région : choisis **Frankfurt** (ou une autre région en **Europe**). Nom : `courtcoach-db`. Valide.

➡️ **Tu n'as rien à copier.** À l'étape D, on « branchera » la base au serveur d'un simple clic : Vercel donne alors tout seul l'adresse secrète au serveur. (Si tu vois un onglet « .env » vide, c'est normal tant que la base n'est branchée à aucun projet.)

## Étape C – Préparer 2 clés secrètes
Ce sont deux longues suites de caractères au hasard. Le plus simple : utilise le **générateur de mot de passe** de ton téléphone ou de ton navigateur (« Suggérer un mot de passe fort », longueur **64**).
- Clé 1 : `JWT_SECRET`
- Clé 2 : `SETUP_TOKEN` (elle servira une seule fois, pour créer ton compte coach)

## Étape D – Créer le projet du serveur (« courtcoach-api »)
1. Vercel → **Add New… → Project** → choisis le dépôt **courtcoach**.
2. **Project Name** : `courtcoach-api`.
3. **Root Directory** : clique **Edit** et choisis **`apps/api`**.
4. **Framework Preset** : **Other**.
5. Ouvre **Environment Variables** et ajoute (nom → valeur) :
   - `JWT_SECRET` → la clé 1
   - `SETUP_TOKEN` → la clé 2
   - `NODE_ENV` → `production` (le serveur installe de lui-même ses outils de construction : tu n'as rien à régler de plus)
   - `WEB_ORIGIN` → `https://courtcoach.vercel.app` (on la corrigera à l'étape F si l'adresse du site est différente)
6. **Ne clique pas encore sur Deploy** : le serveur a d'abord besoin de la base. (Si Vercel a déjà lancé un déploiement et qu'il est rouge, c'est normal : on le relancera.)
7. **Brancher la base** (une fenêtre « Configure courtcoach-api » s'ouvre : laisse **Production** et **Preview** cochés, ne coche pas « Create database branch », et dans « Custom Environment Variable Prefix », tu peux laisser `STORAGE` : le serveur le reconnaît) : va dans **Storage** (menu du haut de Vercel) → ouvre `courtcoach-db` → onglet **Projects** → **Connect Project** → choisis **courtcoach-api** → **Connect**. Vercel ajoute tout seul l'adresse secrète de la base au projet.
8. Retourne dans le projet **courtcoach-api** → **Settings → Environment Variables** et vérifie qu'il y a bien une ligne **`DATABASE_URL`** (ou `POSTGRES_URL`). Tu n'as pas besoin de lire sa valeur.
9. **Deployments** → les trois petits points du dernier déploiement → **Redeploy**. Attends que ce soit vert.
10. Dans **Settings → Functions**, choisis la région **Paris (cdg1)** si elle est proposée.
11. Vérification : ouvre `https://courtcoach-api.vercel.app/api/setup/status` (avec **ton** adresse). Tu dois voir : `{"available":true}`.

➡️ **Envoie-moi l'adresse du serveur** (juste l'adresse, par exemple `https://courtcoach-api.vercel.app`).
Je règle alors le site pour qu'il parle à ce serveur.

## Étape E – Créer le projet du site (« courtcoach »)
1. Vercel → **Add New… → Project** → le dépôt **courtcoach** (encore une fois).
2. **Project Name** : par exemple `courtcoach-nouveau` (le site actuel s'appelle déjà `courtcoach`, ne le touche pas).
3. **Root Directory** : **`apps/web`**. Framework : **Vite** (détecté tout seul).
4. **Deploy**.

➡️ **Envoie-moi l'adresse du site** (par exemple `https://courtcoach-nouveau.vercel.app`).

## Étape F – Relier les deux
1. Dans le projet **courtcoach-api** → **Settings → Environment Variables** : change `WEB_ORIGIN` pour qu'elle soit **exactement** l'adresse du site (sans `/` à la fin).
2. **Deployments** → les trois petits points du dernier déploiement → **Redeploy**.

## Étape G – Créer ton compte coach
1. Ouvre `https://TON-SITE.vercel.app/installation`.
2. Saisis la clé 2 (`SETUP_TOKEN`), ton e-mail et un mot de passe de 12 caractères minimum.
3. La page se ferme ensuite toute seule : personne d'autre ne peut créer de coach.
4. Connecte-toi sur `/connexion`.

## Étape H – Essayer avec de FAUSSES données
Crée un faux joueur, un faux parent, un compte adulte de test, une demande de cours. Dis-moi ce qui ne va pas.

## Étape I – Avant d'ouvrir aux vraies familles
Voir `RGPD-A-FAIRE.md` : adresse e-mail du club, durée de conservation, relecture par la fédération.

## Étape J – Activer les vidéos (après la fusion de l'étape 3)
1. Invente une nouvelle clé (générateur de mot de passe, 32 caractères ou plus) et ajoute-la dans **courtcoach-api → Settings → Environment Variables** sous le nom **`CRON_SECRET`** (Production). Elle sert à la tâche de nettoyage de chaque nuit, qui supprime les vidéos de plus de 12 mois.
2. Facultatif : **`VIDEO_QUOTA_MB`** (par défaut 350) = place maximale pour les vidéos. La base gratuite fait 512 Mo : ne dépasse pas 400.
3. **Redeploy** de `courtcoach-api` (Deployments → ⋯ → Redeploy). La base se met à jour toute seule.
4. Vérifie dans **Settings → Cron Jobs** qu'une tâche `/api/cron/purge` apparaît.

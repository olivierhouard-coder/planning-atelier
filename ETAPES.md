# Planning Atelier — étapes de mise en place

## Étape 1 — ne pas utiliser « Déployer » sur la page de dépôt statique
Cette application a besoin de fonctions serveur pour enregistrer les rendez-vous. Le dépôt statique seul ne suffit pas.

## Étape 2 — créer un nouveau projet Git
Il faudra déposer le contenu de cette archive dans un nouveau dépôt GitHub nommé `planning-atelier`.
Ne jamais y mettre de clés secrètes.

## Étape 3 — créer un projet Cloudflare Pages connecté au dépôt Git
Choisir le dépôt `planning-atelier`. Répertoire de sortie : `public`.
Les fichiers `functions/` doivent rester à la racine du dépôt.

## Étape 4 — créer une base D1 séparée
Créer une nouvelle base appelée `planning-atelier-db` (ou nom équivalent).
Exécuter le contenu de `schema.sql` dans cette nouvelle base. Ne pas choisir une base de la pointeuse.

## Étape 5 — créer un bucket R2 séparé
Créer un bucket `planning-atelier-photos`.

## Étape 6 — ajouter les bindings au projet Pages
Dans Settings / Bindings :
- D1 database : variable `DB`, sélectionner `planning-atelier-db`
- R2 bucket : variable `PHOTOS`, sélectionner `planning-atelier-photos`
Puis redéployer.

## Ce qui n'est pas encore prêt
- Authentification et contrôle d'accès pour Olivier/Christophe.
- Push réel quand l'application est fermée (Web Push/VAPID + Worker Cron).
- Interface de gestion avancée des rappels multiples.
Ces éléments doivent être ajoutés et testés avant d'utiliser l'application pour de vrais rendez-vous.

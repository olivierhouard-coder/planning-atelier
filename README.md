# Planning Atelier — base Cloudflare

Cette archive est une base de projet, pas encore une application déployée.
Elle est prévue pour Cloudflare Pages Functions + D1 + R2. Elle ne touche pas aux Workers existants.

## Important
Le dépôt doit être déployé avec Git ou Wrangler : le dépôt direct de fichiers statiques dans Pages ne déploie pas les fonctions `functions/`.
Les rappels push ne sont pas encore opérationnels dans cette base : il faudra ajouter les abonnements Web Push/VAPID et un Worker Cron, puis les tester sur les téléphones.

## Contenu
- `public/` : interface calendrier simple, responsive.
- `functions/api/slots.js` : API CRUD des rendez-vous sur D1.
- `functions/api/photos.js` : dépôt et lecture de photos via R2.
- `schema.sql` : tables D1.
- `wrangler.toml.example` : exemple de liaisons D1/R2.
- `ETAPES.md` : prochaine marche à suivre.

## Liaisons attendues
- D1 binding : `DB`
- R2 bucket binding : `PHOTOS`

## Schéma
Créer la base D1 puis exécuter `schema.sql` sur cette base avant de tester l'application.
Ne pas utiliser la base de données de la pointeuse.

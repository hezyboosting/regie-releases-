# Régie

Application Windows pour streamers : overlays par liens, éditeur d'overlays, alertes, chaînes multiples (TikTok, Twitch, YouTube), Gift Tracker, classements, Follow = Rank, points, Chat Battle, Boss Battle, commandes, sons, touches simulées, webhooks, Stream Deck, scènes OBS, clips, TTS, Spotify, stats. Trois rôles : Gratuit, Premium et Admin.

## Démarrer

```
npm install
npm test          # tests automatiques
npm start         # lance l'appli
npm run dist      # fabrique le .exe dans dist/ (à lancer sous Windows, ou sous Linux avec Wine)
```

Pour tester sans compte : `npm start -- --demo` fait arriver de faux événements en continu.

## Renommer le produit

Change `name` dans `src/shared/brand.js`, puis `productName` et `shortcutName` dans `package.json`.

## Rôles et licences

- La clé publique est dans `src/shared/build-config.json`, donc dans le .exe.
- La clé privée est dans `private/regie-admin-key.txt`. Elle n'est jamais incluse dans le .exe. Garde-la secrète et sauvegarde-la : sans elle, plus de licences ni de configuration signée. Ne relance jamais `tools/keygen.js` sur une version déjà vendue.
- Pour devenir admin : Réglages, Licence, Ouvrir la clé admin. L'onglet Admin apparaît.
- Sans serveur, une licence se vérifie sur le PC du client : une personne déterminée peut modifier le programme. Les clés signées arrêtent le partage simple et les fausses clés, pas un vrai cracker.

## Diffuser un réglage à tous les utilisateurs

1. Dans Admin, Diffusion, clique sur Publier la configuration.
2. Envoie le fichier obtenu sur une adresse publique (dépôt GitHub par exemple).
3. Mets cette adresse dans `remoteConfigUrl` de `src/shared/build-config.json`, puis refabrique le .exe. Elle doit être gravée avant la première distribution.

Le fichier est signé : personne ne peut le falsifier. Il contient la matrice FREE, PRO et ULTIMATE, l'annonce, la dernière version et les clés désactivées. Il est public : n'y mets aucun secret.

## Identifiants à créer

| Service | Où | À faire |
| --- | --- | --- |
| Twitch | dev.twitch.tv/console | Créer une appli de type Public, redirection `http://localhost`, copier le Client ID dans `defaults.twitchClientId` de `build-config.json` ou dans Admin, Diffusion. Les clients n'ont alors rien à configurer. |
| Spotify | Aucune | Le morceau en cours vient de Windows, sans compte ni Premium, avec Spotify gratuit. Les demandes du chat arrivent dans une liste à lancer d'un clic. Seul l'envoi direct dans la file exige un compte Premium et une appli créée par le streamer sur developer.spotify.com/dashboard. |
| YouTube mode API | console.cloud.google.com | Facultatif. Le mode simple ne demande aucun compte. Le quota de 10 000 unités par jour est partagé par projet Google : chaque streamer doit créer le sien. |
| Création par IA | console.anthropic.com | Facultatif. Chaque utilisateur Premium ajoute sa clé API Claude dans Réglages, Connexions. |
| TikTok | eulerstream.com | Facultatif. Une clé augmente les limites et permet de répondre dans le chat. |

## Connexions

- TikTok, Kick, YouTube : le pseudo suffit pour lire le chat public. La fenêtre de connexion TikTok sert seulement à retrouver le pseudo : aucun mot de passe ni cookie n'est gardé.
- Twitch : le pseudo donne le chat, les subs, les bits et les raids. Les follows et les réponses demandent le Client ID.
- Musique : l'overlay demande l'appli Spotify ouverte sur le PC du streamer. Si PowerShell est bloqué, Régie lit le titre de la fenêtre Spotify, sans pochette ni durée.
- OBS : Régie lit la configuration du serveur WebSocket déjà présente sur le PC.

## Chat unifié

La page `/dock` se colle dans un dock personnalisé d'OBS. Pour les autres logiciels, l'appli ouvre la même page dans une fenêtre qui reste au premier plan.

## Images de rang et manette

Les blasons et la manette dessinés dans Régie sont des créations originales. Aucun logo de jeu ni visuel de fabricant n'est livré dans l'appli. Le streamer peut importer ses propres images : il lui revient de vérifier qu'il a le droit de les utiliser.

## Organisation

- `src/main` : process principal, moteur d'événements, spectateurs, jeux, connecteurs, licences, serveur local.
- `src/renderer` : interface (Preact sans compilation).
- `src/overlays` : pages servies à OBS. `src/shared/overlay-schema.js` décrit les réglages de chaque overlay : ajouter un champ là suffit à l'ajouter dans l'interface.
- `src/shared/features.js` : ce qui est FREE, PRO ou ULTIMATE.
- `src/shared/games.js` : le catalogue des jeux. Les noms de rangs sont des informations publiques, les blasons sont dessinés par Régie.
- `src/main/gamehub.js` : données locales des jeux (Rocket League, Counter-Strike 2, League of Legends, Minecraft).
- `src/main/pads.js` et `src/main/input.js` : manettes XInput et PlayStation.
- `tools` : clés, sons, icône, bibliothèques.

## Modèles de manette en 2D

L'overlay Manette accepte des modèles importés : un SVG en calques ou un dossier de PNG de même taille. Aucun modèle n'est livré avec l'appli, et ceux qui sont importés restent sur le PC.

- Noms de calques reconnus : `coque` ou `shell`, `grips`, `a`, `b`, `x`, `y`, `lb`, `rb`, `lt`, `rt`, `select`, `start`, `stick_l`, `stick_r`, `dpad_up`, `dpad_down`, `dpad_left`, `dpad_right`, `dpad`, `home`, `touchpad`, `light`. Les autres calques s'associent à la main.
- Dossier de PNG : un fichier par pièce, dans l'ordre d'affichage, par exemple `01-coque.png`, `02-a.png`.
- Chaque pièce a sa couleur, le relief du dessin est conservé. Les boutons s'éclairent et s'enfoncent, les sticks se déplacent.
- Un fichier importé est nettoyé avant affichage : ni script, ni élément HTML, ni ressource externe.
- Chaque modèle garde son statut de droits, son origine et la référence de sa licence ou de son accord.

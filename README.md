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

Le dock suit la langue de l'appli (français ou anglais). Quand la traduction du chat est activée, la traduction s'affiche sous chaque message, ou à sa place avec le texte d'origine au survol, selon le réglage choisi. Le bouton 文 masque ou affiche les traductions dans le dock seulement.

## Images de rang et manette

Les blasons dessinés dans Régie sont des créations originales. Les manettes de l'overlay sont des rendus 3D faits à partir des modèles de 3D Controller Overlay (Larf, licence MIT, voir `src/overlays/pads/CREDITS.txt`). Aucun logo de marque n'y figure sur les manettes. Les souris (formes des modèles les plus connus) et les touches du clavier sont modélisées de zéro et rendues de la même façon (voir `src/overlays/devices/CREDITS.txt` et `tools/devices`). Les logos TikTok, Twitch, YouTube et Kick affichés à côté des pseudos viennent de Simple Icons (CC0, voir `src/overlays/BRANDS-CREDITS.txt`). Le streamer peut importer ses propres images : il lui revient de vérifier qu'il a le droit de les utiliser.

## Vrais emblèmes de rang

Dans Mes jeux, Images des rangs, le bouton Installer télécharge les emblèmes officiels du jeu (ou de tous les jeux) et les range rang par rang, divisions comprises quand l'emblème change. Ils ne sont jamais livrés dans l'installateur : ils appartiennent aux éditeurs et sont récupérés à la demande depuis leurs sources publiques (valorant-api.com, tracker.gg, apexlegendsstatus, OpenDota, wikis Fandom et Minecraft Wiki). La liste des liens est dans `src/shared/rank-sources.js`. Counter-Strike 2 n'a pas d'emblème : Régie dessine les plaques de classement Premier. Call of Duty utilise les emblèmes du mode classé (Bronze à Top 250, wiki Call of Duty). EA FC n'a pas de source publique fiable pour ses badges de division Rivals : il garde les blasons Régie ou les images importées, comme les jeux sans rangs officiels.

## Langue de l'interface

Le bouton FR / EN en haut à droite bascule toute l'appli. Les traductions vivent dans `tools/i18n/en.tsv` (texte français, tabulation, texte anglais) ; `node tools/i18n/build.js` en tire `src/renderer/i18n.js`, `src/overlays/i18n.js` et `src/shared/i18n-en.json`. Une entrée peut avoir des trous, `{0}` ou `{user}` : le traducteur (`src/shared/translate.js`) reconnaît alors le texte composé (« Aperçu de Minuteur ») et traduit chaque morceau. `store.js` traduit chaque texte affiché, les attributs title, label, placeholder, aria-label et alt, et les morceaux voisins ensemble. Les réponses du bot dans le chat et l'assistant suivent la langue choisie ; ce qu'écrit le streamer reste tel quel.

Chaque overlay a un réglage « Langue des textes » : comme l'appli, français, anglais, ou les deux à la fois. `boot.js` traduit à la volée les textes posés par l'overlay, jamais les messages des viewers.

Les vrais emblèmes de rang s'installent tout seuls au premier lancement (puis à chaque démarrage tant qu'il en manque), sans écraser une image importée par le streamer.

## Édition des overlays

Chaque overlay se règle en quatre onglets : Contenu, Style, Animation, Position. Le Style propose des looks prêts en un clic (`src/shared/themes.js`, appliqués à un seul overlay ou à tous) et des réglages communs à tous les overlays : opacité, halo, ombre, contour, teinte, saturation, luminosité. L'Animation règle l'apparition, une animation continue et l'arrivée des nouveaux éléments ; la Position, le décalage, la rotation et le miroir. Ces réglages communs sont appliqués par `src/overlays/boot.js`. L'aperçu peut s'afficher sur cinq fonds.

La Scène complète (`views/scene.js`, overlay `scene`) pose les overlays à la souris sur une scène 1920 × 1080, avec aimantation, calques et capture de jeu en fond : une seule source navigateur affiche tout.

## Style Premium verre

Les overlays partagent un verre commun (`--gx-*` à la fin de `src/overlays/shared.css`) : grain fin, reflet, dégradé de surface, bord clair, ombre longue et halo de la couleur d'accent. OBS ne floute pas le jeu derrière une source navigateur, le verre tient donc à sa propre lumière. `countTo` fait défiler les nombres, `replay` relance une animation, `GIFT_ICON` sert de cadeau de secours dans les aperçus (`src/overlays/lib.js`).

Refaits en 2.12 : alertes (type d'événement, vrai cadeau ou photo dans un anneau, pseudo en couleur, temps restant), chat (cartes avec photo, badges colorés), objectif (barre liquide, « encore X », fête à l'arrivée), compteur (« +1 » qui s'envole), minuteur (rouge dans la dernière minute, temps ajouté qui s'envole), spectateurs (tendance), meilleur cadeau et meilleure série, classement en podium, fil et suivi des cadeaux, bandeau d'événements, bulle de synthèse vocale. Les panneaux (sondage, quiz, tirage, file, boutique, course, duel) prennent le même verre. Les aperçus bougent tout seuls pour montrer les animations.

L'appli est rangée en groupes courts : Alertes et sons, Cadeaux et rangs (Cadeaux, Suivi = Rang, Classements, Objectifs, Boutique de points), Jeux avec le chat, Automatisation (avec les packs prêts). Les réglages de Suivi = Rang sont aussi dans l'éditeur de son overlay (champ `rankconfig`).

## Overlays façon TikFinity

Pot à cadeaux, Canon à cadeaux, Fontaine de likes, Derniers événements, Bienvenue, Émojis du chat, Feu d'artifice de cadeaux, File d'attente (!join, !quitter, appeler le suivant depuis Outils) et Réseaux sociaux (logos Simple Icons).

Le pot à cadeaux (`types/coinjar.js`) a deux remplissages : une physique douce (chocs amortis, frottement, objets qui s'endorment une fois posés et se réveillent si leur appui disparaît, grille spatiale) et un mode « rangés » où chaque cadeau rejoint sa place dans un empilement en nid d'abeille. Les arrivées passent par une file à débit limité ; la capacité tient compte de la place prise ; plein, le pot fait fondre les plus anciens ou se vide d'un coup (action « Vider le pot à cadeaux »). Au rechargement, le contenu reprend sa place sans pluie.

Les images des cadeaux viennent de l'événement TikTok (`image.urlList` dans la version actuelle de tiktok-live-connector, anciens formats gardés). Un cadeau sans image la prend dans le catalogue, rechargé tout seul au début d'un live TikTok s'il a plus de trois jours ; les aperçus et les essais utilisent aussi de vrais cadeaux du catalogue.

Le canon à cadeaux (`giftcannon`) tire la photo du spectateur avec le cadeau accroché ; la fontaine de likes (`likefountain`) fait monter des cœurs avec des photos ; Derniers événements (`lastx`, données `lastEvents` gardées dans la config) montre le dernier suivi, cadeau, like, partage et abonné ; Bienvenue (`welcome`) accueille une fois par live, à l'arrivée sur TikTok ou au premier message, selon un filtre (habitués, soutiens, abonnés, top 10).

L'action « Lancer une action Streamer.bot » (`src/main/streamerbot.js`) envoie `DoAction` au serveur WebSocket de Streamer.bot avec le pseudo, le cadeau, le montant et le message.

## Suivi = Rang

Pour chaque jeu, le streamer choisit les rangs qui peuvent sortir et leur chance (`ranks.picks`). Chaque spectateur garde un rang par jeu (`viewer.ranks`) : en changeant de jeu, il reçoit un rang du nouveau jeu. S'il suit à nouveau, on remontre son rang, on en tire un nouveau ou rien (`ranks.again`), dix minutes minimum entre deux révélations. « Donner un rang » et la commande des modos (`!donnerang @pseudo Diamant`) imposent un rang. La révélation façon caisse CS2 (`types/rankcard.js`) fait défiler une bande tirée selon les chances, avec le pourcentage de chaque rang.

La roue se règle entièrement depuis son overlay : palettes, images par case (image importée, vrai cadeau TikTok ou émoji), texte, séparateurs, bordure et ampoules, centre (texte, émoji ou logo), forme et position du pointeur, nombre de tours, arrêt doux, suspense ou rebond, effet d'arrivée, rotation lente au repos. Un réglage d'overlay peut ne s'afficher que pour certains choix d'un autre (`when` dans `overlay-schema.js`).

## Catalogue officiel des cadeaux TikTok

`src/main/giftcatalog.js` récupère la liste officielle des cadeaux (nom, prix en pièces, image) : d'abord par la connexion TikTok en cours, sinon par la bibliothèque (avec `fetchRoomId`), sinon directement par `webcast.tiktok.com/webcast/gift/list`. La liste est gardée dans `giftCache` et les images sont téléchargées dans le dossier `gifts` des données de l'appli, servies par le serveur local sur `/gifts/<id>.png` (sans jeton, pour OBS). Le catalogue se met à jour seul au lancement s'il a plus de trois jours, ou avec « Mettre à jour » dans Cadeaux, Catalogue TikTok. Les images TikTok ne sont pas livrées dans l'installateur : elles viennent de TikTok, sur le PC du streamer.

Chaque cadeau reçu est rapproché du catalogue (par identifiant, puis par nom) : alertes, fil, suivi, pot, canon, feux d'artifice et classements montrent l'image officielle, en local.

## Le chat joue et Paris

Le chat joue (`src/main/play.js`, vue `chatplays`, overlay `chatplays`) : des mots du chat (« avance », « saute »…, avec des alias et un préfixe facultatif) lancent des actions dans le jeu (touche, manette virtuelle, commande serveur, son…). En vote, on compte pendant quelques secondes et le plus demandé gagne ; en chaos, chaque message compte, avec un débit maximum par seconde. Modèles prêts : déplacements, jeu de tir, Minecraft, manette.

Paris (vue `predictions`, overlay `prediction`) : une question et 2 à 4 réponses, les spectateurs misent leurs points avec `!parier 2 100` ou `!parier 2 tout`. Les mises peuvent se fermer seules après un délai. À la bonne réponse, les gagnants se partagent toute la cagnotte au prorata de leur mise (pari mutuel) ; si personne n'a misé dessus, ou si le pari est annulé, tout le monde est remboursé. Un pari ouvert survit à un redémarrage.

## Mises à jour automatiques

`src/main/updater.js` utilise `electron-updater` avec les releases GitHub du dépôt indiqué dans `package.json > build.publish` (`hezyboosting/regie-releases-`). L'installateur vérifie au lancement puis toutes les deux heures, télécharge en fond et installe à la fermeture de Régie (ou tout de suite avec « Redémarrer »). La version Portable ne se met pas à jour. L'option « versions bêta » accepte les releases marquées pré-version (numéro avec un tiret, `2.15.0-beta.1`).

Publier : pousser sur la branche `main` du dépôt de releases. Le workflow `.github/workflows/release.yml` lance les tests sous Linux, puis compile sur une machine Windows et publie `Regie-Setup-x.y.z.exe`, son `.blockmap` et `latest.yml`. Si la version de `package.json` est déjà publiée, le workflow monte le dernier chiffre tout seul.

« Quoi de neuf » (`src/shared/changelog.js`) s'ouvre une fois après chaque mise à jour, avec les versions plus récentes que `settings.lastSeenVersion`. Réglages › Mises à jour et aide › « Signaler un problème » enregistre un JSON (versions, journal, config) dont les jetons, mots de passe, clés et webhooks sont masqués.

## Aide au quotidien

« Prêt pour le live » (`views/help.js`) vérifie sur le tableau de bord les chaînes, OBS, les overlays ouverts, le catalogue des cadeaux, les alertes et la mise à jour prête, avec un bouton pour corriger chaque point. La recherche (Ctrl K) trouve les pages (avec des mots-clés), les actions, les onglets de réglages, les overlays et les cadeaux du catalogue. « Simuler un live » est dans la barre du haut.

## Plinko

`src/main/plinko.js` tire le trajet de chaque balle (une suite gauche/droite par rangée) et l'envoie à l'overlay `plinko`, qui l'anime : le résultat ne dépend pas de l'affichage. Deux modes : « comme une vraie planche » (loi binomiale) ou « chances choisies » (poids par case, puis un trajet qui y mène). Les cadeaux lâchent des balles avec leur image officielle ; `!plinko 100` fait miser des points, multipliés par la case. Les cases par défaut (`src/shared/plinko-bins.js`) suivent la rareté de chaque case et la planche rend environ 90 % des mises. Chaque case peut lancer des actions.

## Discord et téléphone

`src/main/discord.js` poste par un webhook (gardé dans le coffre chiffré) l'annonce du début de live, au plus une fois par demi-heure, et le récap de fin. La télécommande et le chat s'ouvrent sur un téléphone du même Wi-Fi par QR code (`api.phoneLinks`, paquet `qrcode`) ; `api.setLanLive` ouvre le serveur au réseau local sans redémarrer Régie.

## Menu

La barre latérale range les pages en sections repliables : Démarrer, En direct, Overlays, Alertes et sons, Cadeaux, Communauté, Jeux avec le chat, Automatisation. La section de la page ouverte reste dépliée, les autres se souviennent de leur état (`localStorage.navOpen`). Le fil d'Ariane en haut rappelle la section.

## Live interactif et packs prêts

La roue de la fortune (`src/main/interactive.js`, overlay `wheel`) tourne sur un cadeau précis ou un montant, une commande payée en points, un palier de likes, un suivi, un abonnement ou un partage ; les lancers attendent leur tour. Chaque case a sa chance, des points à gagner et des actions (touche dans le jeu, commande Minecraft, son, scène OBS, relance…). La course aux likes (overlay `likerace`) fait avancer les viewers à chaque like, et aussi aux messages, cadeaux, partages ou suivis pour Twitch, YouTube et Kick. Les avatars des viewers (overlay `avatars`) se baladent, parlent en bulles et sautent avec !saute.

La Scène complète peut avoir une disposition par jeu : elle bascule toute seule quand le jeu est détecté. Les packs prêts (`src/shared/packs.js`) installent en un clic roue, course, automatisations, commandes et overlays ; tout ce qu'un pack ajoute porte son identifiant pour être retiré proprement.

## Assistant, actions par cadeau, manette virtuelle, serveurs de jeu

L'assistant de démarrage (`views/setup.js`, `api.runSetup`) pose en cinq questions les chaînes, le jeu, les packs, les overlays, le thème et la scène. Les actions par cadeau (onglet de Cadeaux) sont des automatisations marquées `giftAction`, reconnues par identifiant ou par nom, avec répétition des combos.

La manette virtuelle (`src/main/vpad.js`) branche une manette Xbox 360 par le pilote ViGEmBus, via `koffi` et `src/main/native/ViGEmClient.dll` (compilée depuis ViGEmClient, licence MIT, voir `CREDITS.txt`). Le streamer installe ViGEmBus une fois. Les serveurs de jeu (`src/main/rcon.js`, `src/shared/rcon-presets.js`) parlent RCON Source, WebRCON (Rust) et telnet (7 Days to Die).

Les packs se partagent en fichiers `.regiepack` : `sanitizePack` retire les webhooks, borne les textes et garde seulement les actions connues. Une copie automatique de la config est faite avant chaque pack ou restauration (dix gardées). Le récap de fin de live (`engine.buildRecap`) s'ouvre tout seul et se retrouve dans Stats. Les thèmes de saison ajoutent des particules (`src/overlays/particles.js`).

## Boutique de points, scène verticale, traduction du chat

La boutique (`games.js`, vue `pointshop`, overlay `pointshop`) liste les récompenses numérotées : `!boutique` pour voir, `!acheter 2` (ou le début du nom) pour acheter, texte facultatif après le numéro (`{args}`). Chaque récompense a son prix, son stock par live, sa recharge globale, une attente par spectateur et ses actions. Le stock et le journal des achats repartent à zéro au début de chaque live.

La scène verticale (overlay `scenev`, 1080 × 1920) se règle dans le même éditeur que la scène horizontale, avec ses dispositions par jeu ; `api.autoVertical` la tire de la scène horizontale en empilant les overlays dans l'ordre, centrés.

La traduction du chat (`src/main/chat-translate.js`) passe par Google Traduction sans clé, ou DeepL avec une clé (gratuite si elle finit par `:fx`). Le message part tout de suite ; sa traduction suit dans un message `evx` pour l'overlay de chat et `eventPatch` pour l'appli. Commandes, emojis seuls et messages déjà dans la bonne langue ne sont pas traduits ; les résultats sont mis en cache.

## Clavier et souris

Windows nomme les touches d'après leur inscription : en AZERTY, `keyboard.js` ramène chaque nom reçu à la touche physique dessinée (A/Q, Z/W, M, ponctuation, touche < des claviers ISO). La souris reste immobile : seuls les clics, la molette et la lumière s'animent.

## Organisation

- `src/main` : process principal, moteur d'événements, spectateurs, jeux, connecteurs, licences, serveur local.
- `src/renderer` : interface (Preact sans compilation).
- `src/overlays` : pages servies à OBS. `src/shared/overlay-schema.js` décrit les réglages de chaque overlay : ajouter un champ là suffit à l'ajouter dans l'interface.
- `src/shared/features.js` : ce qui est FREE, PRO ou ULTIMATE.
- `src/shared/games.js` : le catalogue des jeux. Les noms de rangs sont des informations publiques, les blasons sont dessinés par Régie.
- `src/main/gamehub.js` : données locales des jeux (Rocket League, Counter-Strike 2, League of Legends, Minecraft).
- `src/main/pads.js` et `src/main/input.js` : manettes XInput et PlayStation.
- `tools` : clés, sons, icône, bibliothèques.
- `tools/pads` : rendus des manettes. `render_pad.py` se lance avec Blender (paquet Python `bpy`, Python 3.11) sur les modèles de 3dco+, `build_lit.py` assemble les calques dans `src/overlays/pads/`. Les vignettes de l'atelier sont dans `src/renderer/pads/`.

## Atelier manette

Dans Overlays, Manette : choix du modèle (DualSense, DualShock 4, Xbox Series, One, Elite, 360, Switch Pro, 8BitDo, GameSir, ou celui qui est branché), coloris, finition zone par zone (teinte, saturation, luminosité, opacité, brillance), jauges L2 et R2, trace des sticks. L'aperçu est l'overlay lui-même et suit la manette branchée.

## Modèles de manette en 2D

L'overlay Manette accepte aussi des modèles importés : un SVG en calques ou un dossier de PNG de même taille. Aucun modèle n'est livré avec l'appli, et ceux qui sont importés restent sur le PC.

- Noms de calques reconnus : `coque` ou `shell`, `grips`, `a`, `b`, `x`, `y`, `lb`, `rb`, `lt`, `rt`, `select`, `start`, `stick_l`, `stick_r`, `dpad_up`, `dpad_down`, `dpad_left`, `dpad_right`, `dpad`, `home`, `touchpad`, `light`. Les autres calques s'associent à la main.
- Dossier de PNG : un fichier par pièce, dans l'ordre d'affichage, par exemple `01-coque.png`, `02-a.png`.
- Chaque pièce a sa couleur, le relief du dessin est conservé. Les boutons s'éclairent et s'enfoncent, les sticks se déplacent.
- Un fichier importé est nettoyé avant affichage : ni script, ni élément HTML, ni ressource externe.
- Chaque modèle garde son statut de droits, son origine et la référence de sa licence ou de son accord.

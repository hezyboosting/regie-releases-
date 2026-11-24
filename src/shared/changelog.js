// Nouveautés montrées dans « Quoi de neuf » après une mise à jour. La plus récente en premier.
const CHANGELOG = [
  {
    version: '2.25.0',
    title: 'Recherche dans le chat multi',
    items: [
      'Nouvelle loupe en haut du chat multi (ou Ctrl+F) : cherche un pseudo ou un mot dans les derniers messages, sans te soucier des majuscules ni des accents. Les mots trouvés sont surlignés, avec l\'heure de chaque message.',
      'Filtres rapides : mentions de ta chaîne, questions, soutiens (cadeaux, abonnements, bits, dons, raids) et repères (premier message, habitués, gros soutiens).',
      'Clique sur un résultat pour le retrouver à sa place dans le chat. Échap efface la recherche, puis la ferme.',
    ],
  },
  {
    version: '2.24.0',
    title: 'Repères dans le chat, avertissements, modération en raccourci',
    items: [
      'Le chat multi marque le premier message d\'un nouveau venu, les habitués et les gros soutiens, sur leur premier message du live. Seuils et marques se règlent dans la page Chat.',
      'Avertissements : bouton Avertir dans le dock et sur la fiche, ou !avertir pseudo raison dans le chat. Chaque avertissement est annoncé (@pseudo avertissement 1/3) et, au dernier, l\'exclusion ou le ban tombe tout seul. Le compteur repart de zéro après 24 h.',
      'Nouvelles actions pour les commandes, automatisations, la télécommande, le Stream Deck et les raccourcis clavier : mode lent, followers, abonnés ou émotes seulement (activer, couper ou basculer), vider le chat, afficher ou retirer le message à l\'écran.',
      'Une commande comme !question avec l\'action Afficher le message à l\'écran met la question du spectateur en grand sur ton live, sans le mot de la commande.',
    ],
  },
  {
    version: '2.23.0',
    title: 'Fiche spectateur, message à l\'écran, réglages du chat et commandes de modo',
    items: [
      'Clique sur un pseudo dans le chat multi : sa fiche montre ses messages, pièces, cadeaux et likes (ce live et au total), ses points, combien de jours il est venu, ses derniers messages, ses sanctions passées et ta note perso.',
      'Afficher en live (bouton ⋯ d\'un message) : le message s\'affiche en grand sur ton live dans le nouvel overlay Message à l\'écran, avec la photo et le pseudo. Il part tout seul ou reste jusqu\'à ce que tu le retires.',
      'Réglages du chat dans le dock : mode lent, followers seulement, abonnés seulement, émotes seulement, messages uniques et vider le chat, sur Twitch et Kick. Sur Twitch, reconnecte ta chaîne une fois pour donner la permission.',
      'Commandes de modo : tes modos tapent !exclure pseudo 10m, !ban pseudo ou !debannir pseudo dans n\'importe quel chat. Un modo Twitch peut ainsi faire disparaître un troll TikTok. Les mots se changent dans la page Chat.',
    ],
  },
  {
    version: '2.22.0',
    title: 'Modère ton chat depuis le chat multi',
    items: [
      'Dans le chat multi (dock OBS, fenêtre flottante, page Chat), le bouton ⋯ d\'un message ouvre la modération : masquer, supprimer, exclure 1 min, 10 min ou 1 h, bannir (deux clics pour confirmer), répondre.',
      'Twitch : supprimer, exclure, bannir et débannir se font vraiment sur Twitch. Reconnecte ta chaîne une fois dans Connexions pour donner la permission.',
      'YouTube (mode API) : supprimer, exclure et bannir sur YouTube. Kick (compte connecté) : exclure, bannir et débannir avec les commandes du chat.',
      'TikTok ne laisse aucune appli exclure ou bannir : Régie masque la personne chez toi, et le dock te rappelle de la bannir dans TikTok LIVE Studio.',
      'Partout, une personne exclue ou bannie disparaît de tes overlays, de la voix, des commandes et des jeux. Ses cadeaux et abonnements comptent toujours. La liste des bloqués (icône en haut du dock) permet de débloquer.',
    ],
  },
  {
    version: '2.21.1',
    title: 'Nouveau logo',
    items: [
      'Nouvelle icône : une touche de pupitre rétroéclairée, avec le R allumé et le voyant rouge du direct, sur fond transparent. Elle remplace le bouton rouge dans la barre des tâches, l\'installateur et en haut du menu.',
    ],
  },
  {
    version: '2.21.0',
    title: 'Menu plus simple, nouveau design, chaque overlay se place à la main',
    items: [
      'Menu rangé en douze entrées claires (Chat, Overlays, Alertes, Cadeaux, Jeux, Spectateurs, Outils du live…). Les pages d\'un même sujet sont des onglets en haut de la page, et un voyant s\'allume quand quelque chose tourne.',
      'Nouveau design : pupitre graphite, touches qui s\'allument en ambre, vert quand c\'est actif, rouge réservé au direct, titres plus lisibles.',
      'La Disposition libre arrive sur presque tous les overlays (chat, objectifs, classements, menu des pièces, minuteur, Spotify, roue, duels…) : le placement de départ est celui que tu vois, puis tu déplaces chaque élément à la souris.',
      'Beaucoup plus de réglages par élément : fond et dégradé, bordure, arrondi, marge, opacité, flou, contour du texte, ombre colorée, espacement, interligne, italique, une seule ligne, devant ou derrière.',
      'Ajoute tes formes, textes et images directement dans la carte : ils se répètent sur chaque message ou chaque alerte, et un texte peut reprendre le pseudo de la carte. L\'onglet Décor disparaît.',
    ],
  },
  {
    version: '2.20.0',
    title: 'Place chaque texte où tu veux sur tes cartes',
    items: [
      'Nouvel onglet Disposition sur les alertes et les derniers événements : passe en Libre et place toi-même chaque élément de la carte (pseudo, texte, image, montant, message, barre de temps) à la souris dans l\'aperçu.',
      'Chaque élément se règle à part : position, taille, police, graisse, couleur, alignement, majuscules, ombre, rotation, ou masqué.',
      'Une disposition commune, et une disposition à part pour un type précis (suivi, cadeau, partage…) si tu veux. L\'aperçu zoome sur la carte et garde l\'alerte du type choisi à l\'écran.',
      'Menu réorganisé par moment : Démarrer, Pendant le live, Overlays, Alertes & actions, Jeux avec le chat, Défis et points, Mon jeu, Bilan, Intégrations. Chaque page dit en une phrase à quoi elle sert, et le tableau de bord propose des raccourcis.',
    ],
  },
  {
    version: '2.19.0',
    title: 'Change la forme de tes overlays et ajoute ton décor',
    items: [
      'Onglet Décor sur chaque overlay : ajoute des formes (carré, cercle, étoile, cœur, flèche, bannière, bulle…), des textes et des images, derrière ou devant l\'overlay, et place-les à la souris dans l\'aperçu.',
      'Forme des cartes dans l\'onglet Style : silhouette (carré, pilule, coins coupés, penché, flèche, hexagone, onglet), fond uni, dégradé ou verre, motif et bordure, par-dessus le style choisi.',
      'Format de l\'overlay dans l\'onglet Position : horizontal, vertical, carré ou sur mesure.',
      'Les textes du décor peuvent afficher les valeurs du live (spectateurs, dernier suivi…), et l\'éditeur d\'overlays gagne les mêmes formes.',
    ],
  },
  {
    version: '2.18.0',
    title: 'Menu des pièces et filtres pour chaque overlay',
    items: [
      'Nouvel overlay Menu des pièces : ta liste « prix : action » (défis, sons, 1v1…) en 6 styles (pastille, ticket, verre, néon, arcade, texte seul), avec tes couleurs, ta police, une ou deux colonnes ou quelques lignes qui défilent. Le cadeau envoyé allume sa ligne avec le pseudo.',
      'Chaque overlay choisit ce qu\'il montre : quels événements (suivis, likes, partages, cadeaux…) et quelles plateformes (TikTok, Twitch, YouTube, Kick), dans l\'onglet Contenu.',
      'Plusieurs overlays d\'alertes : chacun a sa propre file, un overlay « cadeaux TikTok » n\'attend plus la fin d\'une alerte Twitch. Dans Alertes, les plateformes de chaque alerte se règlent d\'un clic.',
      'TikTok : la lecture avec ton compte démarre même quand TikTok ne dit pas si tu es en live, et Connexions affiche un diagnostic (page, connexion au chat, paquets, messages) pour voir où ça coince.',
    ],
  },
  {
    version: '2.17.0',
    title: 'Tous les messages du chat arrivent',
    items: [
      'TikTok : les messages de certains comptes (récents, privés ou jugés peu fiables) n\'arrivaient jamais, parce que TikTok les garde pour les spectateurs connectés. Connecte ton compte TikTok dans Connexions : Régie lit le chat avec ton compte, dans une fenêtre cachée, et tout arrive.',
      'Chaque message ne s\'affiche qu\'une fois, même s\'il arrive par les deux chemins. Connexions montre combien de messages ton compte a récupérés, et le chat unifié prévient quand des messages TikTok peuvent manquer.',
      'YouTube sans compte : Régie lit « Chat en direct » au lieu de « Chat principal », où YouTube cache des messages. Une horloge de PC décalée ne fait plus perdre de messages.',
      'Un module en erreur (points, statistiques, bienvenue, jeux) ne peut plus faire disparaître un message. Twitch : les messages « /me » s\'affichent proprement.',
    ],
  },
  {
    version: '2.16.1',
    title: 'Les messages TikTok ne se perdent plus',
    items: [
      'Les messages faits d\'une emote ou d\'un autocollant TikTok s\'affichent enfin, et les emotes au milieu d\'un message aussi (chat unifié, dock, overlay de chat).',
      'Le dock rattrape les messages arrivés pendant une coupure (OBS qui recharge, PC chargé) : tout de suite à la reconnexion, et toutes les 10 secondes.',
      'Sur un gros live, les likes et les arrivées ne poussent plus les messages hors de l\'historique.',
      'Connexions › TikTok : « Des messages TikTok n\'apparaissent pas ? » explique comment couper le filtre de commentaires de TikTok, et propose de lire tout le chat avec ton compte.',
    ],
  },
  {
    version: '2.16.0',
    title: 'Suivi = Rang fiable et appli mieux rangée',
    items: [
      'Suivi = Rang : la durée du résultat règle aussi le défilement de la caisse. Changer un réglage n\'empile plus plusieurs ouvertures, et les suivis s\'enchaînent un par un.',
      '« Régler le défilement à part » dans l\'onglet Animation, si tu veux une durée de défilement différente.',
      'Les effets communs qui gênaient la caisse (apparition, animation continue, confettis en double) sont retirés de cet overlay et du cadre webcam.',
      'Menu réorganisé : En direct, Overlays, Alertes et sons, Cadeaux, Spectateurs, Jeux avec le chat, Mon jeu, Automatisation. Chaque page porte le nom du menu.',
      'La roue et la course ont chacune leur page, la traduction du chat est dans Chat unifié, la galerie se filtre par catégorie, et les Réglages passent à 7 onglets.',
    ],
  },
  {
    version: '2.15.0',
    title: 'Le chat unifié écrit partout',
    items: [
      'Le chat unifié écrit sur toutes tes chaînes à la fois, TikTok et Kick compris : connecte ton compte une fois dans Connexions › Écrire dans le chat, sans abonnement.',
      'Si une chaîne coince, les autres reçoivent quand même le message, et Régie dit laquelle et pourquoi. Les chaînes pas encore prêtes restent visibles dans la liste.',
      'Cadre webcam refait : verre, néon, dégradé animé ou coins de visée, pastille LIVE avec les spectateurs, plaque à ton nom, et une bulle « Léna envoie Rose ×5 » à chaque soutien.',
      'Suivi = Rang corrigé : les cases se cochent sans revenir en arrière, et le mode « selon les points » garde les vrais rangs de ton jeu, avec un seuil pour chacun.',
      'Petites corrections : les cadeaux sans quantité ne montrent plus « undefined », les champs des réglages sont bien alignés, la page Stats affiche son chargement.',
    ],
  },
  {
    version: '2.14.0',
    title: 'Mises à jour automatiques, Plinko et Discord',
    items: [
      'Régie se met à jour tout seul : la nouvelle version se télécharge pendant que tu streames et s\'installe quand tu fermes l\'appli.',
      'Plinko : chaque cadeau tombe avec sa vraie image TikTok et rebondit jusqu\'à une case qui donne des points, un son ou une action dans le jeu. Les spectateurs peuvent aussi miser leurs points avec !plinko.',
      'Discord : un message quand tu passes en live, et le récap de fin de live avec tes meilleurs soutiens.',
      'Télécommande sur téléphone : un QR code à scanner, en Wi-Fi.',
      'Prêt pour le live : le tableau de bord vérifie tes connexions, OBS et tes overlays, avec un bouton pour corriger.',
      'Recherche (Ctrl K) : pages, réglages, overlays et cadeaux, en tapant quelques lettres.',
      'Simuler un live en un clic depuis la barre du haut, et Signaler un problème dans Réglages.',
    ],
  },
  {
    version: '2.13.0',
    title: 'Les vrais cadeaux TikTok',
    items: [
      'Catalogue TikTok : tous les cadeaux officiels avec leur image et leur prix. Une Galaxie reçue s\'affiche avec la vraie Galaxie.',
      'Le chat joue : tes spectateurs contrôlent ton personnage en écrivant dans le chat.',
      'Paris : une question, les spectateurs misent leurs points, les gagnants se partagent la cagnotte.',
      'Nouveau menu rangé en sections.',
    ],
  },
  {
    version: '2.12.0',
    title: 'Overlays Premium verre',
    items: ['Alertes, objectifs, compteurs, minuteur, classements et chat redessinés en verre.', 'Suivi = Rang avec la révélation façon caisse CS2.'],
  },
];

// Les versions plus récentes que « seen » (toutes si seen est vide), jusqu'à « current ».
function newerThan(seen, current) {
  const n = (v) => String(v || '0').split(/[.-]/).slice(0, 3).map((x) => parseInt(x, 10) || 0);
  const cmp = (a, b) => { const x = n(a); const y = n(b); for (let i = 0; i < 3; i += 1) if (x[i] !== y[i]) return x[i] - y[i]; return 0; };
  return CHANGELOG.filter((c) => cmp(c.version, current) <= 0 && (!seen || cmp(c.version, seen) > 0));
}

module.exports = { CHANGELOG, newerThan };

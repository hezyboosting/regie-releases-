// Nouveautés montrées dans « Quoi de neuf » après une mise à jour. La plus récente en premier.
const CHANGELOG = [
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

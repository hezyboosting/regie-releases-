// Description de chaque type d'overlay. L'interface génère ses réglages à partir de ce fichier,
// et le serveur s'en sert pour les valeurs par défaut.
const C = (key, label, def, extra = {}) => ({ key, label, type: 'color', default: def, ...extra });
const R = (key, label, def, min, max, step = 1, unit = '', extra = {}) => ({ key, label, type: 'range', default: def, min, max, step, unit, ...extra });
const T = (key, label, def, extra = {}) => ({ key, label, type: 'toggle', default: def, ...extra });
const S = (key, label, def, options, extra = {}) => ({ key, label, type: 'select', default: def, options, ...extra });
const TX = (key, label, def = '', extra = {}) => ({ key, label, type: 'text', default: def, ...extra });

const POSITIONS = [
  { value: 'top-left', label: 'Haut gauche' }, { value: 'top-center', label: 'Haut centre' }, { value: 'top-right', label: 'Haut droite' },
  { value: 'center', label: 'Centre' },
  { value: 'bottom-left', label: 'Bas gauche' }, { value: 'bottom-center', label: 'Bas centre' }, { value: 'bottom-right', label: 'Bas droite' },
];
const FONTS = [
  { value: 'onest', label: 'Onest' }, { value: 'geist', label: 'Geist' }, { value: 'syne', label: 'Syne' }, { value: 'archivo', label: 'Archivo' }, { value: 'system', label: 'Système' },
  { value: 'serif', label: 'Sérif' }, { value: 'rounded', label: 'Arrondie' }, { value: 'impact', label: 'Impact' },
];
const CSS = { key: 'customCss', label: 'CSS personnalisé', type: 'code', default: '', feature: 'customCss' };
const FONT = S('font', 'Police', 'onest', FONTS);
const SCALE = R('scale', 'Taille', 100, 40, 300, 5, ' %');

const OVERLAY_TYPES = {
  alerts: {
    name: 'Alertes', size: [1920, 1080], group: 'Direct', blurb: 'Suivis, abonnements, cadeaux, raids et tout le reste.',
    fields: [
      S('theme', 'Style', 'verre', [
        { value: 'verre', label: 'Pastille de verre' }, { value: 'carte', label: 'Carte de verre' }, { value: 'minimal', label: 'Texte seul', premium: true },
      ], { feature: 'overlayThemes' }),
      S('position', 'Position', 'bottom-left', POSITIONS), C('accent', 'Couleur principale', '#8FD3FF'), C('bg', 'Fond', '#10131A'), C('text', 'Texte', '#F2F5F9'),
      T('platformColor', 'Couleur de la plateforme', true), T('avatar', 'Afficher l\'avatar', true), FONT, SCALE, R('volume', 'Volume', 80, 0, 100, 1, ' %'), CSS,
    ],
  },
  chat: {
    name: 'Chat unifié', size: [420, 720], group: 'Direct', blurb: 'Tous tes chats dans une seule colonne.',
    fields: [
      S('theme', 'Style', 'verre', [
        { value: 'verre', label: 'Bulles de verre' }, { value: 'lignes', label: 'Texte seul' },
      ], { feature: 'overlayThemes' }),
      T('platformTag', 'Afficher la plateforme', true), T('translate', 'Afficher les traductions du chat', true), T('avatar', 'Afficher les avatars', true), T('events', 'Montrer aussi les événements', true), T('badges', 'Afficher les badges', true), T('highlight', 'Mettre en avant modos et abonnés', true),
      T('hideCommands', 'Masquer les commandes', true), TX('blocked', 'Mots masqués (séparés par des virgules)', ''),
      R('maxLines', 'Messages à l\'écran', 14, 3, 40), R('fade', 'Disparition', 0, 0, 120, 5, ' s'), R('fontSize', 'Taille du texte', 18, 11, 40, 1, ' px'), R('bgAlpha', 'Fond', 0, 0, 100, 5, ' %'),
      C('nameColor', 'Pseudos', '#CFE6FF'), C('text', 'Texte', '#F2F5F9'), FONT, CSS,
    ],
  },
  goal: {
    name: 'Objectif', size: [640, 140], group: 'Objectifs', blurb: 'Une barre de progression pour un objectif.',
    fields: [
      { key: 'goalId', label: 'Objectif', type: 'goal', default: '' },
      S('theme', 'Thème', 'barre', [
        { value: 'barre', label: 'Barre' }, { value: 'anneau', label: 'Anneau', premium: true }, { value: 'pile', label: 'Pile de jetons', premium: true }, { value: 'vu', label: 'Vumètre', premium: true },
      ], { feature: 'overlayThemes' }),
      C('accent', 'Couleur de remplissage', '#8FD3FF'), C('track', 'Couleur du rail', '#FFFFFF'), C('text', 'Texte', '#F2F5F9'), T('showNumbers', 'Afficher les chiffres', true), FONT, SCALE, CSS,
    ],
  },
  battle: {
    name: 'Duel', size: [1100, 220], group: 'Objectifs', blurb: 'Les scores en duel, avec le chrono.',
    fields: [
      S('theme', 'Thème', 'duel', [
        { value: 'duel', label: 'Duel' }, { value: 'ring', label: 'Ring', premium: true }, { value: 'tug', label: 'Corde', premium: true },
      ], { feature: 'overlayThemes' }),
      C('bg', 'Fond', '#10131A'), C('text', 'Texte', '#F2F5F9'), T('topSupporters', 'Afficher les meilleurs soutiens', true), FONT, SCALE, CSS,
    ],
  },
  spotify: {
    name: 'Spotify', size: [760, 380], group: 'Musique', blurb: 'Le morceau en cours, avec nos thèmes maison.',
    fields: [
      S('theme', 'Thème', 'capsule', [
        { value: 'capsule', label: 'Capsule' }, { value: 'platine', label: 'Platine', premium: true }, { value: 'cassette', label: 'Cassette', premium: true },
        { value: 'vu', label: 'VU-mètres', premium: true }, { value: 'bandeau', label: 'Bandeau', premium: true },
      ], { feature: 'spotifyThemes' }),
      T('autoColor', 'Couleurs tirées de la pochette', true), C('accent', 'Couleur fixe', '#8FD3FF'), C('text', 'Texte', '#F2F5F9'),
      T('showNext', 'Afficher le morceau suivant', true), T('showRequester', 'Afficher qui a demandé', true), T('hidePaused', 'Masquer en pause', false),
      T('reactive', 'Réagir au son du PC', false, { feature: 'spotifyReactive' }), FONT, SCALE, CSS,
    ],
  },
  gamepad: {
    name: 'Manette', size: [620, 420], group: 'Gaming', blurb: 'Boutons, sticks et gâchettes en direct.',
    fields: [
      S('model', 'Modèle', 'auto', [
        { value: 'auto', label: 'Suit ma manette' },
        { value: 'xbox', label: 'Xbox Series X|S' }, { value: 'xbox_one', label: 'Xbox One' }, { value: 'xbox_elite', label: 'Xbox Elite' }, { value: 'xbox_360', label: 'Xbox 360' },
        { value: 'ps5', label: 'PS5 DualSense' }, { value: 'ps5_edge', label: 'PS5 DualSense Edge' }, { value: 'ps4', label: 'PS4 DualShock 4' },
        { value: 'switch_pro', label: 'Switch Pro' },
        { value: 'gamesir', label: 'GameSir' }, { value: '8bitdo', label: '8BitDo' },
        { value: 'regie', label: 'Régie (classique)' }, { value: 'arcade', label: 'Stick arcade' },
      ], { feature: 'gamepadAllLayouts' }),
      R('pad', 'Manette n°', 1, 1, 4), S('source', 'Lecture', 'auto', [{ value: 'auto', label: 'Automatique' }, { value: 'xinput', label: 'Directe' }, { value: 'browser', label: 'Navigateur' }]),
      { key: 'finish', label: 'Finitions', type: 'padfinish', default: null, feature: 'gamepadCustom' },
      C('pressed', 'Bouton pressé', '#8FD3FF', { feature: 'gamepadCustom' }), C('legend', 'Inscriptions', '#F2F5F9', { feature: 'gamepadCustom' }),
      T('labels', 'Afficher les inscriptions', true), T('trail', 'Trace des sticks', true), T('triggers', 'Barres de gâchettes', true), R('idleFade', 'Fondu au repos', 0, 0, 30, 1, ' s'),
      { key: 'pack', label: 'Modèle de la bibliothèque', type: 'padpack', default: '', feature: 'gamepadSkin' },
      R('packGain', 'Force des couleurs du modèle', 170, 100, 400, 10, ' %', { feature: 'gamepadSkin' }),
      { key: 'skin', label: 'Photo de ta manette', type: 'padskin', default: null, feature: 'gamepadSkin' },
      { key: 'skinPs', label: 'Photo de ta manette PlayStation', type: 'padskin', default: null, feature: 'gamepadSkin' }, SCALE, CSS,
    ],
  },
  keyboard: {
    name: 'Clavier', size: [960, 340], group: 'Entrées', blurb: 'Les touches utilisées, sur un vrai clavier en 3D.',
    fields: [
      S('layout', 'Disposition', 'wasd', [
        { value: 'wasd', label: 'ZQSD compact' }, { value: 'tkl', label: 'Clavier sans pavé' }, { value: 'full', label: 'Clavier complet' },
      ]),
      S('lang', 'Inscriptions', 'azerty', [{ value: 'azerty', label: 'AZERTY (ISO)' }, { value: 'qwerty', label: 'QWERTY (ANSI)' }]),
      C('key', 'Touches', '#ECEAE4'), C('mod', 'Touches de fonction', '#4A4F58'), C('accentKey', 'Échap et Entrée', '#F3D38A'),
      C('case', 'Boîtier', '#2A2D33'), T('showCase', 'Afficher le boîtier', true),
      C('pressed', 'Touche pressée', '#8FD3FF'), R('shine', 'Brillance', 40, 0, 100, 5, ' %'), R('glow', 'Lueur', 45, 0, 100, 5, ' %'), SCALE, CSS,
    ],
  },
  mouse: {
    name: 'Souris', size: [320, 480], group: 'Entrées', blurb: 'Clics et molette sur une vraie souris, vue de dessus.',
    fields: [
      S('model', 'Modèle', 'superlight', [
        { value: 'superlight', label: 'G Pro X Superlight', sub: 'Logitech · symétrique', thumb: 'devices/mouse_superlight.png' },
        { value: 'deathadder', label: 'DeathAdder', sub: 'Razer · droitier', thumb: 'devices/mouse_deathadder.png' },
        { value: 'g502', label: 'G502', sub: 'Logitech · aile de pouce', thumb: 'devices/mouse_g502.png' },
        { value: 'viper', label: 'Viper', sub: 'Razer · ambidextre', thumb: 'devices/mouse_viper.png' },
        { value: 'model_o', label: 'Model O', sub: 'Glorious · nid d\'abeille', thumb: 'devices/mouse_model_o.png' },
        { value: 'regie', label: 'Régie', sub: 'Originale', thumb: 'devices/mouse_regie.png' },
      ]),
      C('body', 'Coque', '#2A2E35'), C('buttons', 'Boutons', '#2A2E35'), C('accent', 'Molette', '#3A3F47'),
      C('light', 'Lumière', '#8FD3FF'), S('lightFx', 'Effet de lumière', 'fixe', [
        { value: 'fixe', label: 'Fixe' }, { value: 'breath', label: 'Respiration' }, { value: 'rgb', label: 'Arc-en-ciel' }, { value: 'click', label: 'S\'allume au clic' },
      ]),
      C('pressed', 'Clic', '#8FD3FF'), R('shine', 'Brillance', 45, 0, 100, 5, ' %'),
SCALE, CSS,
    ],
  },
  ticker: {
    name: 'Bandeau d\'événements', size: [1920, 64], group: 'Direct', blurb: 'Les derniers soutiens qui défilent.',
    fields: [R('speed', 'Vitesse', 60, 20, 200, 5, ' px/s'), R('count', 'Événements gardés', 15, 5, 50), C('bg', 'Fond', '#10131A'), C('text', 'Texte', '#F2F5F9'), C('accent', 'Accent', '#8FD3FF'), FONT, CSS],
  },
  viewers: {
    name: 'Spectateurs', size: [420, 90], group: 'Direct', blurb: 'Le total sur toutes les chaînes.',
    fields: [T('split', 'Détail par plateforme', true), C('text', 'Texte', '#F2F5F9'), C('accent', 'Point', '#8FD3FF'), FONT, SCALE, CSS],
  },
  timer: {
    name: 'Minuteur', size: [460, 140], group: 'Outils', blurb: 'Compte à rebours ou subathon.',
    fields: [{ key: 'timerId', label: 'Minuteur', type: 'timer', default: '' }, S('style', 'Style', 'plein', [{ value: 'plein', label: 'Plein' }, { value: 'contour', label: 'Contour' }]), C('text', 'Texte', '#F2F5F9'), C('accent', 'Accent', '#F3D38A'), FONT, SCALE, CSS],
  },
  counter: {
    name: 'Compteur', size: [360, 120], group: 'Outils', blurb: 'Morts, victoires, ce que tu veux.',
    fields: [{ key: 'counterId', label: 'Compteur', type: 'counter', default: '' }, C('text', 'Texte', '#F2F5F9'), C('accent', 'Accent', '#8FD3FF'), FONT, SCALE, CSS],
  },
  poll: {
    name: 'Sondage', size: [620, 360], group: 'Outils', blurb: 'Les votes de toutes les chaînes.',
    fields: [C('accent', 'Barres', '#8FD3FF'), C('bg', 'Fond', '#10131A'), C('text', 'Texte', '#F2F5F9'), FONT, SCALE, CSS],
  },
  giveaway: {
    name: 'Tirage au sort', size: [620, 360], group: 'Outils', blurb: 'Les participants et le tirage.',
    fields: [C('accent', 'Accent', '#F3D38A'), C('bg', 'Fond', '#10131A'), C('text', 'Texte', '#F2F5F9'), FONT, SCALE, CSS],
  },
  leaderboard: {
    name: 'Classement', size: [420, 420], group: 'Cadeaux et classements', blurb: 'Classement des cadeaux, classement des likes et points.',
    fields: [
      S('style', 'Présentation', 'podium', [{ value: 'podium', label: 'Podium pour le top 3' }, { value: 'liste', label: 'Liste' }]),
      TX('title', 'Titre', 'Meilleurs soutiens'), S('metric', 'Classer par', 'coins', [{ value: 'coins', label: 'Cadeaux' }, { value: 'likes', label: 'Likes' }, { value: 'points', label: 'Points' }, { value: 'messages', label: 'Messages' }, { value: 'shares', label: 'Partages' }, { value: 'subs', label: 'Abonnements' }, { value: 'follows', label: 'Suivis' }]),
      S('scope', 'Période', 'session', [{ value: 'session', label: 'Ce live' }, { value: 'today', label: 'Aujourd\'hui' }, { value: 'week', label: '7 jours' }, { value: 'month', label: '30 jours' }, { value: 'all', label: 'Depuis le début' }]), R('count', 'Places', 5, 3, 10), C('accent', 'Accent', '#F3D38A'), C('text', 'Texte', '#F2F5F9'), C('bg', 'Fond', '#10131A'), FONT, SCALE, CSS,
    ],
  },
  giftfeed: {
    name: 'Fil des cadeaux', size: [460, 620], group: 'Cadeaux et classements', blurb: 'Les cadeaux en direct, avec les combos.',
    fields: [R('maxRows', 'Lignes', 6, 2, 12), R('stay', 'Durée à l\'écran', 12, 3, 60, 1, ' s'), TX('hidden', 'Cadeaux masqués (noms séparés par des virgules)', ''), T('avatars', 'Afficher les avatars', false), C('accent', 'Accent', '#8FD3FF'), C('bg', 'Fond', '#10131A'), C('text', 'Texte', '#F2F5F9'), FONT, SCALE, CSS],
  },
  gifttracker: {
    name: 'Suivi des cadeaux', size: [460, 420], group: 'Cadeaux et classements', blurb: 'Le compte des cadeaux reçus sur ce live.',
    fields: [
      S('mode', 'Affichage', 'total', [{ value: 'total', label: 'Tous les cadeaux' }, { value: 'goal', label: 'Un cadeau et un objectif' }]), { key: 'giftId', label: 'Cadeau suivi', type: 'gift', default: '' }, R('target', 'Objectif', 100, 1, 10000, 1),
      TX('title', 'Titre', 'Cadeaux du live'), R('count', 'Lignes', 6, 3, 12), C('accent', 'Accent', '#F3D38A'), C('bg', 'Fond', '#10131A'), C('text', 'Texte', '#F2F5F9'), FONT, SCALE, CSS],
  },
  topgift: {
    name: 'Meilleur cadeau', size: [640, 150], group: 'Cadeaux et classements', blurb: 'Le plus gros cadeau du live.',
    fields: [TX('title', 'Titre', 'Meilleur cadeau'), C('accent', 'Accent', '#F3D38A'), C('bg', 'Fond', '#10131A'), C('text', 'Texte', '#F2F5F9'), FONT, SCALE, CSS],
  },
  topstreak: {
    name: 'Meilleure série', size: [640, 150], group: 'Cadeaux et classements', blurb: 'La meilleure série de cadeaux.',
    fields: [TX('title', 'Titre', 'Meilleure série'), C('accent', 'Accent', '#8FD3FF'), C('bg', 'Fond', '#10131A'), C('text', 'Texte', '#F2F5F9'), FONT, SCALE, CSS],
  },
  rankcard: {
    name: 'Suivi = Rang', size: [960, 340], group: 'Gaming', fxSkip: ['fxIntro', 'fxIdle', 'fxItems', 'fxItemsAnim', 'fxSpeed', 'fxConfetti'], blurb: 'Chaque personne qui suit la chaîne reçoit son rang à l\'écran, en carte directe ou en ouverture de caisse façon CS2.',
    fields: [
      { key: 'rankSetup', label: 'Rangs', type: 'rankconfig', default: null, tab: 'content' },
      TX('title', 'Texte', 'Nouveau rang'), R('stay', 'Durée du résultat', 6, 2, 20, 1, ' s'),
      T('spinCustom', 'Régler le défilement à part', false, { tab: 'anim' }),
      R('spin', 'Durée du défilement', 6.5, 3, 14, 0.5, ' s', { tab: 'anim', when: { spinCustom: true } }), S('stripMode', 'Rangs dans la bande', 'chance', [{ value: 'chance', label: 'Selon leurs chances (les rares passent rarement)' }, { value: 'mix', label: 'Tous autant' }], { tab: 'anim' }),
      T('showOdds', 'Afficher les chances', true), T('avatars', 'Afficher l\'avatar', true), T('confetti', 'Confettis à l\'arrivée', true, { tab: 'anim' }),
      R('volume', 'Volume', 60, 0, 100, 5, ' %'), C('accent', 'Repère', '#F3C94A'), C('bg', 'Fond', '#10131A'), C('text', 'Texte', '#F2F5F9'), FONT, SCALE, CSS,
    ],
  },
  gamecard: {
    name: 'Carte de jeu', size: [640, 240], group: 'Gaming', blurb: 'Ton jeu, tes rangs, ta progression et ta session.',
    fields: [S('layout', 'Présentation', 'ligne', [{ value: 'ligne', label: 'Ligne' }, { value: 'colonne', label: 'Colonne' }]), T('showMmr', 'Afficher le score', true), T('showBest', 'Afficher le meilleur rang', true), T('showNext', 'Afficher la progression', true), T('showStats', 'Afficher la session', true), C('bg', 'Fond', '#10131A'), C('text', 'Texte', '#F2F5F9'), FONT, SCALE, CSS],
  },
  gamelive: {
    name: 'Score en direct', size: [560, 130], group: 'Gaming', blurb: 'Le score de ta partie, mis à jour par le jeu.',
    fields: [C('bg', 'Fond', '#10131A'), C('text', 'Texte', '#F2F5F9'), C('accent', 'Accent', '#8FD3FF'), T('hideIdle', 'Masquer hors partie', true), FONT, SCALE, CSS],
  },
  minigame: {
    name: 'Mini-jeu', size: [760, 460], group: 'Interactions', blurb: 'Devinette, quiz et roulette.',
    fields: [C('accent', 'Accent', '#8FD3FF'), C('bg', 'Fond', '#10131A'), C('text', 'Texte', '#F2F5F9'), FONT, SCALE, CSS],
  },
  stage: {
    name: 'Scène d\'effets', size: [1920, 1080], group: 'Direct', blurb: 'Textes, images et vidéos lancés par tes automatisations.',
    fields: [S('position', 'Position', 'center', POSITIONS), C('text', 'Texte', '#F2F5F9'), R('size', 'Taille du texte', 64, 20, 160, 2, ' px'), FONT, CSS],
  },
  arena: {
    name: 'Bataille du chat', size: [1100, 620], group: 'Interactions', blurb: 'Les spectateurs s\'affrontent à l\'écran.',
    fields: [S('theme', 'Thème', 'arene', [{ value: 'arene', label: 'Arène' }, { value: 'neon', label: 'Néon' }, { value: 'pixel', label: 'Pixel' }, { value: 'espace', label: 'Espace' }]), FONT, SCALE, CSS],
  },
  boss: {
    name: 'Combat de boss', size: [900, 560], group: 'Interactions', blurb: 'Tout le chat contre un boss.',
    fields: [S('theme', 'Thème', 'arene', [{ value: 'arene', label: 'Arène' }, { value: 'neon', label: 'Néon' }, { value: 'pixel', label: 'Pixel' }, { value: 'espace', label: 'Espace' }]), T('showTop', 'Afficher les meilleurs joueurs', true), FONT, SCALE, CSS],
  },
  webcam: {
    name: 'Cadre webcam', size: [700, 440], group: 'Direct', fxSkip: ['fxIdle', 'fxItems', 'fxItemsAnim', 'fxConfetti'], blurb: 'Un cadre autour de ta caméra : verre, néon ou coins de visée, pastille LIVE, plaque à ton nom, et il réagit aux soutiens.',
    fields: [
      S('style', 'Style', 'verre', [{ value: 'verre', label: 'Verre' }, { value: 'neon', label: 'Néon' }, { value: 'degrade', label: 'Dégradé animé' }, { value: 'coins', label: 'Coins de visée' }, { value: 'simple', label: 'Trait fin' }]),
      R('thickness', 'Épaisseur', 6, 1, 24, 1, ' px', { tab: 'style' }), R('radius', 'Arrondi', 22, 0, 80, 1, ' px', { tab: 'style' }), R('glow', 'Lueur', 60, 0, 100, 5, ' %', { tab: 'style' }),
      TX('label', 'Texte de la plaque', '{viewers} en direct', { tab: 'content' }), S('labelPos', 'Plaque', 'bas-centre', [{ value: 'bas-centre', label: 'En bas, au centre' }, { value: 'bas-gauche', label: 'En bas, à gauche' }, { value: 'haut-centre', label: 'En haut, au centre' }, { value: 'aucun', label: 'Pas de plaque' }], { tab: 'content' }),
      S('livePos', 'Pastille LIVE', 'haut-gauche', [{ value: 'haut-gauche', label: 'En haut à gauche' }, { value: 'haut-droite', label: 'En haut à droite' }, { value: 'aucun', label: 'Cachée' }], { tab: 'content' }), T('liveViewers', 'Spectateurs dans la pastille', true, { tab: 'content', when: { livePos: ['haut-gauche', 'haut-droite'] } }),
      T('react', 'Réagir aux soutiens', true, { tab: 'anim' }), T('showEvents', 'Afficher qui soutient', true, { tab: 'anim' }), R('toastSeconds', 'Durée de la bulle', 4, 2, 10, 1, ' s', { tab: 'anim', when: { showEvents: true } }),
      T('confetti', 'Confettis sur un gros soutien', true, { tab: 'anim' }), R('bigCoins', 'Gros cadeau à partir de', 100, 1, 5000, 1, ' pièces', { tab: 'anim' }),
      C('accent', 'Couleur', '#8FD3FF'), C('accent2', 'Couleur 2', '#B9A7FF'), C('bg', 'Fond de la plaque', '#10131A'), C('text', 'Texte', '#F2F5F9'), FONT, CSS,
    ],
  },
  transition: {
    name: 'Transition', size: [1920, 1080], group: 'Direct', blurb: 'Un volet animé entre deux scènes OBS.', noFx: true,
    fields: [C('accent', 'Couleur', '#8FD3FF'), C('accent2', 'Couleur 2', '#B9A7FF'), TX('label', 'Texte', ''), FONT],
  },
  custom: {
    name: 'Overlay personnalisé', size: [1920, 1080], group: 'Personnalisé', blurb: 'Compose ton overlay librement.', noFx: true, hidden: true,
    fields: [],
  },
  tts: {
    name: 'Bulle de synthèse vocale', size: [700, 180], group: 'Direct', blurb: 'Affiche le message lu à voix haute.',
    fields: [C('accent', 'Accent', '#8FD3FF'), C('bg', 'Fond', '#10131A'), C('text', 'Texte', '#F2F5F9'), T('audio', 'Jouer le son ici (ElevenLabs)', false), FONT, SCALE, CSS],
  },
  scene: {
    name: 'Scène complète', size: [1920, 1080], group: 'Direct', blurb: 'Tous tes overlays placés à la souris, sur une seule source OBS.', noFx: true,
    fields: [{ key: 'items', label: 'Overlays placés', type: 'scene', default: [] }, { key: 'layouts', label: 'Dispositions par jeu', type: 'hidden', default: {} }],
  },
  scenev: {
    name: 'Scène verticale', size: [1080, 1920], group: 'Direct', blurb: 'Tous tes overlays placés dans une seule source 1080 × 1920, pour TikTok LIVE Studio et les lives en vertical.', noFx: true,
    fields: [{ key: 'items', label: 'Overlays placés', type: 'scene', default: [] }, { key: 'layouts', label: 'Dispositions par jeu', type: 'hidden', default: {} }],
  },
  coinjar: {
    name: 'Pot à cadeaux', size: [440, 640], group: 'Cadeaux et classements', blurb: 'Chaque cadeau tombe dans un bocal qui se remplit, avec sa vraie image. Le tas reste calme, même avec des centaines de cadeaux.',
    fields: [
      TX('title', 'Titre', 'Pot à cadeaux'),
      S('mode', 'Remplissage', 'physique', [{ value: 'physique', label: 'Physique douce' }, { value: 'range', label: 'Rangés, ils s\'emboîtent' }]),
      S('shape', 'Récipient', 'bocal', [{ value: 'bocal', label: 'Bocal' }, { value: 'verre', label: 'Grand verre' }, { value: 'tube', label: 'Tube' }, { value: 'rond', label: 'Bocal rond' }]),
      R('size', 'Taille des cadeaux', 20, 12, 40, 1, ' px'), T('sizeByValue', 'Gros cadeaux plus gros', true, { when: { mode: 'physique' } }),
      R('bounce', 'Rebond', 15, 0, 60, 5, ' %', { tab: 'anim', when: { mode: 'physique' } }), R('rate', 'Cadeaux qui tombent par seconde (max)', 8, 1, 30, 1, '', { tab: 'anim' }),
      R('perGift', 'Objets par envoi (max)', 10, 1, 30), R('max', 'Objets dans le pot (max)', 140, 20, 400, 10),
      S('overflow', 'Quand le pot est plein', 'fondu', [{ value: 'fondu', label: 'Les plus anciens disparaissent' }, { value: 'vider', label: 'Le pot se vide d\'un coup' }]),
      R('resetMin', 'Vider le pot après', 0, 0, 240, 5, ' min'),
      T('likes', 'Les likes ajoutent des cœurs', false), R('likesEvery', 'Un cœur tous les', 50, 1, 1000, 1, ' likes', { when: { likes: true } }),
      T('follows', 'Les suivis ajoutent une étoile', true), T('shares', 'Les partages ajoutent une flèche', false),
      S('labelPos', 'Titre et total', 'haut', [{ value: 'haut', label: 'Au-dessus' }, { value: 'etiquette', label: 'Étiquette sur le pot' }, { value: 'cache', label: 'Cachés' }]),
      T('showCount', 'Afficher le total de pièces', true), T('lid', 'Couvercle', true, { tab: 'style', when: { shape: 'bocal' } }), R('glassAlpha', 'Opacité du verre', 14, 0, 60, 2, ' %', { tab: 'style' }),
      C('glass', 'Verre', '#CFE8FF'), C('accent', 'Accent', '#F3D38A'), C('text', 'Texte', '#F2F5F9'), FONT, SCALE, CSS,
    ],
  },
  emojify: {
    name: 'Émojis du chat', size: [1920, 1080], group: 'Interactions', blurb: 'Les émojis du chat s\'envolent sur ton écran.',
    fields: [
      S('mode', 'Mouvement', 'monte', [{ value: 'monte', label: 'Montent comme des bulles' }, { value: 'pluie', label: 'Pluie' }, { value: 'boom', label: 'Explosion' }, { value: 'rebond', label: 'Rebondissent' }]),
      R('size', 'Taille', 64, 24, 160, 2, ' px'), R('max', 'Émojis à l\'écran (max)', 80, 10, 250, 5), R('perMessage', 'Émojis par message (max)', 6, 1, 20),
      T('emotes', 'Émotes Twitch, Kick et TikTok aussi', true), T('gifts', 'Les cadeaux s\'envolent aussi', true), SCALE, CSS,
    ],
  },
  firework: {
    name: 'Feu d\'artifice de cadeaux', size: [1920, 1080], group: 'Cadeaux et classements', blurb: 'Chaque cadeau part en fusée et explose avec son image.',
    fields: [
      R('minCoins', 'À partir de (pièces)', 1, 1, 5000), R('power', 'Puissance', 60, 10, 100, 5, ' %'), T('bigOnly', 'Explosions géantes pour les gros cadeaux', true),
      T('follows', 'Une gerbe pour chaque suivi', false), T('subs', 'Une gerbe pour les abonnements', true), C('accent', 'Couleur des étincelles', '#F3D38A'), SCALE, CSS,
    ],
  },
  queue: {
    name: 'File d\'attente', size: [440, 600], group: 'Interactions', blurb: 'Les spectateurs tapent !join pour jouer avec toi, tu appelles le suivant.',
    fields: [
      TX('title', 'Titre', 'Joue avec moi'), R('show', 'Personnes affichées', 8, 3, 20), T('showCmd', 'Rappeler la commande', true), T('avatars', 'Afficher les avatars', true),
      C('accent', 'Accent', '#8FD3FF'), C('bg', 'Fond', '#10131A'), C('text', 'Texte', '#F2F5F9'), FONT, SCALE, CSS,
    ],
  },
  wheel: {
    name: 'Roue de la fortune', size: [760, 860], group: 'Interactions', blurb: 'Un cadeau, une commande ou un palier de likes fait tourner la roue. Chaque case peut lancer une action dans ton jeu. Tout se règle : couleurs, images, centre, pointeur, arrêt.',
    fields: [
      T('showTitle', 'Afficher le titre', true), T('showUser', 'Afficher qui a lancé la roue', true), T('showQueue', 'Afficher les lancers en attente', true), T('showHint', 'Rappeler comment la lancer', true),
      T('hideIdle', 'Cacher la roue quand personne ne la lance', false),
      S('labelMode', 'Contenu des cases', 'texte-image', [{ value: 'texte-image', label: 'Texte et image' }, { value: 'texte', label: 'Texte seulement' }, { value: 'image', label: 'Image seulement' }]),
      S('resultStyle', 'Résultat', 'bandeau', [{ value: 'bandeau', label: 'Sous la roue' }, { value: 'bulle', label: 'En grand sur la roue' }, { value: 'cache', label: 'Caché' }]),
      S('style', 'Style', 'verre', [{ value: 'verre', label: 'Verre' }, { value: 'neon', label: 'Néon' }, { value: 'casino', label: 'Casino' }, { value: 'bonbon', label: 'Bonbon' }, { value: 'or', label: 'Noir et or' }, { value: 'minimal', label: 'Minimal' }], { tab: 'style' }),
      S('palette', 'Couleurs des cases', '', [{ value: '', label: 'Celles de chaque case' }, { value: 'arcenciel', label: 'Arc-en-ciel' }, { value: 'pastel', label: 'Pastel' }, { value: 'bonbon', label: 'Bonbon' }, { value: 'neon', label: 'Néon' }, { value: 'tiktok', label: 'TikTok' }, { value: 'or', label: 'Noir et or' }], { tab: 'style' }),
      R('textSize', 'Taille du texte', 100, 50, 170, 5, ' %', { tab: 'style' }), R('textPos', 'Position du texte (0 = automatique)', 0, 0, 85, 1, ' %', { tab: 'style' }),
      S('textOrient', 'Sens du texte', 'rayon', [{ value: 'rayon', label: 'Du centre vers le bord' }, { value: 'travers', label: 'En travers de la case' }], { tab: 'style' }),
      S('textColor', 'Couleur du texte des cases', 'auto', [{ value: 'auto', label: 'Automatique (lisible)' }, { value: 'perso', label: 'Au choix' }], { tab: 'style' }), C('segText', 'Texte des cases', '#FFFFFF', { when: { textColor: 'perso' } }),
      R('imageSize', 'Taille des images', 100, 50, 160, 5, ' %', { tab: 'style' }),
      R('sepWidth', 'Séparateurs', 2, 0, 10, 1, ' px', { tab: 'style' }),
      R('rimWidth', 'Épaisseur de la bordure', 16, 0, 34, 1, ' px', { tab: 'style' }), C('rim', 'Bordure', '#F2F5F9'), T('rimCustom', 'Bordure de ma couleur (styles casino et or)', false, { tab: 'style', when: { style: ['casino', 'or'] } }),
      S('bulbs', 'Ampoules sur la bordure', 'auto', [{ value: 'auto', label: 'Selon le style' }, { value: 'oui', label: 'Oui' }, { value: 'non', label: 'Non' }], { tab: 'style' }), R('bulbCount', 'Nombre d\'ampoules', 16, 6, 48, 2, '', { tab: 'style', when: { bulbs: ['auto', 'oui'] } }),
      TX('hubText', 'Centre : texte ou émoji', '★', { tab: 'style' }), { key: 'hubImage', label: 'Centre : ton logo', type: 'media', accept: 'image', default: '', tab: 'style' },
      R('hubSize', 'Taille du centre', 54, 24, 130, 2, ' px', { tab: 'style' }),
      T('customColors', 'Mes couleurs pour le centre, les séparateurs et les ampoules', false, { tab: 'style' }),
      C('hubColor', 'Centre', '#10131A', { when: { customColors: true } }), C('hubTextColor', 'Texte du centre', '#FFFFFF', { when: { customColors: true } }),
      C('sepColor', 'Séparateurs', '#FFFFFF', { when: { customColors: true } }), C('bulbColor', 'Ampoules', '#FFFFFF', { when: { customColors: true } }),
      S('pointer', 'Pointeur', 'triangle', [{ value: 'triangle', label: 'Triangle' }, { value: 'fleche', label: 'Flèche' }, { value: 'goutte', label: 'Goutte' }, { value: 'diamant', label: 'Diamant' }], { tab: 'style' }),
      S('pointerPos', 'Position du pointeur', 'haut', [{ value: 'haut', label: 'En haut' }, { value: 'droite', label: 'À droite' }, { value: 'bas', label: 'En bas' }, { value: 'gauche', label: 'À gauche' }], { tab: 'style' }),
      T('shadow', 'Ombre sous la roue', true, { tab: 'style' }), T('shine', 'Reflet de verre', true, { tab: 'style' }),
      S('ease', 'Arrêt', 'douce', [{ value: 'douce', label: 'Doux' }, { value: 'suspense', label: 'Suspense (fin très lente)' }, { value: 'rebond', label: 'Rebond' }], { tab: 'anim' }),
      R('turns', 'Tours avant l\'arrêt (0 = automatique)', 0, 0, 14, 1, '', { tab: 'anim' }), T('ticks', 'Petit clic à chaque case', true, { tab: 'anim' }),
      S('winFx', 'À l\'arrivée', 'surbrillance', [{ value: 'surbrillance', label: 'La case gagnante brille' }, { value: 'confettis', label: 'Case qui brille et confettis' }, { value: 'aucun', label: 'Rien' }], { tab: 'anim' }),
      T('idleSpin', 'Tourne doucement au repos', false, { tab: 'anim' }), R('idleSpeed', 'Vitesse au repos', 100, 20, 400, 10, ' %', { tab: 'anim', when: { idleSpin: true } }),
      C('accent', 'Pointeur et accent', '#8FD3FF'), C('text', 'Texte', '#F2F5F9'), FONT, SCALE, CSS,
    ],
  },
  giftcannon: {
    name: 'Canon à cadeaux', size: [1920, 1080], group: 'Cadeaux et classements', blurb: 'À chaque cadeau, la photo du spectateur traverse l\'écran en cloche avec le vrai cadeau accroché et son pseudo.',
    fields: [
      S('side', 'Tir depuis', 'alterne', [{ value: 'alterne', label: 'Gauche et droite, à tour de rôle' }, { value: 'gauche', label: 'La gauche' }, { value: 'droite', label: 'La droite' }, { value: 'bas', label: 'Le bas' }]),
      S('mode', 'Plusieurs cadeaux d\'un coup', 'un', [{ value: 'un', label: 'Un seul tir avec « ×5 »' }, { value: 'rafale', label: 'Une rafale, un tir par cadeau' }]),
      R('maxPerGift', 'Tirs par envoi (max)', 10, 1, 30, 1, '', { when: { mode: 'rafale' } }), R('minCoins', 'À partir de (pièces)', 1, 1, 5000),
      R('rate', 'Tirs par seconde (max)', 6, 1, 20), T('names', 'Afficher les pseudos', true), T('avatars', 'Photo du spectateur', true),
      T('showCannon', 'Dessiner les canons', true, { tab: 'style' }), T('trail', 'Traînée d\'étincelles', true, { tab: 'anim' }), T('sizeByValue', 'Gros cadeaux plus gros', true),
      R('size', 'Taille', 90, 40, 200, 2, ' px', { tab: 'style' }), R('speed', 'Vitesse', 100, 50, 180, 5, ' %', { tab: 'anim' }),
      R('volume', 'Volume du tir', 0, 0, 100, 5, ' %'), C('accent', 'Accent', '#FE2C55'), C('ring', 'Contour des photos', '#FFFFFF'), C('text', 'Texte', '#FFFFFF'), FONT, CSS,
    ],
  },
  likefountain: {
    name: 'Fontaine de likes', size: [1920, 1080], group: 'Interactions', blurb: 'Les likes font monter des cœurs du bas de l\'écran, avec la photo de ceux qui likent au milieu.',
    fields: [
      S('origin', 'Les cœurs partent', 'droite', [{ value: 'droite', label: 'En bas à droite' }, { value: 'gauche', label: 'En bas à gauche' }, { value: 'centre', label: 'En bas au centre' }, { value: 'partout', label: 'De tout le bas' }]),
      R('likesPerHeart', 'Un cœur tous les', 1, 1, 100, 1, ' likes'), R('maxBurst', 'Cœurs par salve (max)', 15, 1, 60), R('max', 'Cœurs à l\'écran (max)', 220, 20, 600, 10),
      T('avatars', 'Photos de ceux qui likent', true), R('avatarChance', 'Une photo par salve', 60, 0, 100, 5, ' %', { when: { avatars: true } }),
      T('gifts', 'Les cadeaux font aussi des cœurs', false), T('follows', 'Les suivis font aussi des cœurs', false),
      S('palette', 'Couleurs', 'tiktok', [{ value: 'tiktok', label: 'TikTok' }, { value: 'rose', label: 'Tons roses' }, { value: 'arcenciel', label: 'Arc-en-ciel' }, { value: 'or', label: 'Or' }, { value: 'unie', label: 'Une seule couleur' }], { tab: 'style' }),
      C('accent', 'Couleur', '#FE2C55', { when: { palette: 'unie' } }), TX('emoji', 'À la place des cœurs : un émoji', '', { tab: 'style' }), { key: 'image', label: 'À la place des cœurs : une image', type: 'media', accept: 'image', default: '', tab: 'style' },
      R('size', 'Taille', 46, 16, 140, 2, ' px', { tab: 'style' }), R('avatarSize', 'Taille des photos', 100, 50, 200, 5, ' %', { tab: 'style' }),
      R('speed', 'Vitesse', 100, 40, 250, 5, ' %', { tab: 'anim' }), R('height', 'Hauteur de la fontaine', 80, 20, 100, 5, ' %', { tab: 'anim' }), CSS,
    ],
  },
  lastx: {
    name: 'Derniers événements', size: [560, 620], group: 'Direct', blurb: 'Dernier suivi, dernier cadeau, dernier like, dernier partage, dernier abonné : une carte, un carrousel ou la liste.',
    fields: [
      S('mode', 'Affichage', 'carrousel', [{ value: 'carrousel', label: 'Carrousel (une carte qui tourne)' }, { value: 'un', label: 'Une seule carte' }, { value: 'liste', label: 'Tous, en liste' }]),
      S('kind', 'Carte affichée', 'follow', [{ value: 'follow', label: 'Dernier suivi' }, { value: 'gift', label: 'Dernier cadeau' }, { value: 'like', label: 'Dernier like' }, { value: 'share', label: 'Dernier partage' }, { value: 'sub', label: 'Dernier abonné' }], { when: { mode: 'un' } }),
      R('rotate', 'Change toutes les', 6, 3, 30, 1, ' s', { when: { mode: 'carrousel' } }),
      T('showFollow', 'Dernier suivi', true, { when: { mode: ['carrousel', 'liste'] } }), T('showGift', 'Dernier cadeau', true, { when: { mode: ['carrousel', 'liste'] } }), T('showLike', 'Dernier like', true, { when: { mode: ['carrousel', 'liste'] } }),
      T('showShare', 'Dernier partage', true, { when: { mode: ['carrousel', 'liste'] } }), T('showSub', 'Dernier abonné', true, { when: { mode: ['carrousel', 'liste'] } }),
      T('avatars', 'Afficher l\'avatar', true), T('platform', 'Afficher la plateforme', true),
      S('style', 'Style', 'carte', [{ value: 'carte', label: 'Carte' }, { value: 'pilule', label: 'Pilule' }, { value: 'minimal', label: 'Minimal' }]),
      C('accent', 'Accent', '#FE2C55'), C('bg', 'Fond', '#10131A'), C('text', 'Texte', '#F2F5F9'), FONT, SCALE, CSS,
    ],
  },
  welcome: {
    name: 'Bienvenue', size: [900, 200], group: 'Direct', blurb: 'Une bannière avec sa photo accueille ceux qui arrivent dans le live ou écrivent leur premier message. Tu choisis qui est accueilli.',
    fields: [
      S('who', 'Qui accueillir', 'connus', [{ value: 'tous', label: 'Tout le monde' }, { value: 'connus', label: 'Ceux déjà venus (habitués)' }, { value: 'soutiens', label: 'Ceux qui ont déjà offert des cadeaux' }, { value: 'abonnes', label: 'Les abonnés' }, { value: 'top', label: 'Le top 10 des soutiens' }]),
      R('minCoins', 'Cadeaux déjà offerts (pièces, au moins)', 1, 1, 100000, 1, '', { when: { who: 'soutiens' } }),
      T('onJoin', 'À l\'arrivée dans le live (TikTok)', true), T('onFirstChat', 'Au premier message du live', true),
      TX('template', 'Texte', 'Bienvenue {user} 👋', { hint: '{user} pour le pseudo' }), T('badges', 'Badge (top soutien, abonné, habitué…)', true), T('avatars', 'Afficher l\'avatar', true), T('platform', 'Afficher la plateforme', true),
      R('stay', 'Durée', 4, 2, 15, 1, ' s'), R('maxQueue', 'Bannières en attente (max)', 5, 1, 30), T('confetti', 'Confettis pour le top 10', true, { tab: 'anim' }),
      R('volume', 'Volume', 0, 0, 100, 5, ' %'),
      S('style', 'Style', 'pilule', [{ value: 'pilule', label: 'Pilule' }, { value: 'carte', label: 'Carte' }, { value: 'neon', label: 'Néon' }]),
      C('accent', 'Accent', '#FFD24A'), C('bg', 'Fond', '#10131A'), C('text', 'Texte', '#F2F5F9'), FONT, SCALE, CSS,
    ],
  },
  plinko: {
    name: 'Plinko', size: [720, 860], group: 'Interactions', blurb: 'Chaque cadeau tombe avec sa vraie image et rebondit jusqu\'à une case : points, son ou action dans le jeu. Les spectateurs peuvent aussi miser leurs points.',
    fields: [
      TX('title', 'Titre', 'Plinko'), T('showTitle', 'Afficher le titre', true), T('showHint', 'Rappeler la commande', true),
      R('ballSize', 'Taille des balles', 100, 60, 180, 5, ' %'), T('glow', 'Lueur', true), T('trail', 'Traînée', true),
      T('showFeed', 'Derniers gains', true), R('feedCount', 'Gains affichés', 4, 1, 8),
      T('sound', 'Son des rebonds', true), R('volume', 'Volume', 40, 0, 100, 5, ' %', { when: { sound: true } }),
      C('pegColor', 'Clous', '#FFFFFF'), C('accent', 'Accent', '#3DF0C2'), C('bg', 'Fond', '#10131A'), C('text', 'Texte', '#F2F5F9'), FONT, SCALE, CSS,
    ],
  },
  chatplays: {
    name: 'Le chat joue', size: [520, 560], group: 'Interactions', blurb: 'Le chat contrôle ton jeu : les commandes et leurs votes en direct, ou le fil des actions en mode chaos.',
    fields: [
      TX('title', 'Titre', 'Le chat joue'), T('flash', 'Action lancée en grand', true), R('feed', 'Actions dans le fil (chaos)', 5, 0, 10),
      T('hideIdle', 'Cacher quand personne ne joue', false), C('accent', 'Accent', '#3DF0C2'), C('bg', 'Fond', '#10131A'), C('text', 'Texte', '#F2F5F9'), FONT, SCALE, CSS,
    ],
  },
  prediction: {
    name: 'Pari', size: [640, 440], group: 'Interactions', blurb: 'La question du pari, la part de chaque réponse dans la cagnotte, la cote, le compte à rebours et le résultat.',
    fields: [
      TX('title', 'Titre', 'Pari'), T('hideIdle', 'Cacher quand il n\'y a pas de pari', true), C('accent', 'Accent', '#FFC53D'), C('bg', 'Fond', '#10131A'), C('text', 'Texte', '#F2F5F9'), FONT, SCALE, CSS,
    ],
  },
  likerace: {
    name: 'Course aux likes', size: [960, 540], group: 'Interactions', blurb: 'Les spectateurs qui likent le plus font la course jusqu\'à la ligne d\'arrivée. Le premier arrivé gagne.',
    fields: [
      S('style', 'Style', 'piste', [{ value: 'piste', label: 'Piste de course' }, { value: 'barres', label: 'Barres' }]),
      T('showTitle', 'Afficher le titre', true), T('showTarget', 'Afficher la ligne d\'arrivée', true), T('avatars', 'Afficher les avatars', true), T('hideIdle', 'Cacher quand la course est arrêtée', false),
      C('accent', 'Accent', '#FF4D6D'), C('track', 'Piste', '#10131A'), C('text', 'Texte', '#F2F5F9'), FONT, SCALE, CSS,
    ],
  },
  pointshop: {
    name: 'Boutique de points', size: [560, 760], group: 'Interactions', blurb: 'Le catalogue des récompenses que les spectateurs achètent avec leurs points, et chaque achat en direct.',
    fields: [
      S('style', 'Style', 'liste', [{ value: 'liste', label: 'Liste' }, { value: 'cartes', label: 'Cartes' }, { value: 'achats', label: 'Achats seulement' }]),
      T('showTitle', 'Afficher le titre', true), TX('title', 'Titre', 'Boutique'), T('showHint', 'Rappeler comment acheter', true), R('max', 'Récompenses affichées', 6, 1, 12),
      T('showBuys', 'Annoncer chaque achat', true), C('accent', 'Accent', '#FFD24A'), C('text', 'Texte', '#F2F5F9'), FONT, SCALE, CSS,
    ],
  },
  avatars: {
    name: 'Avatars des spectateurs', size: [1920, 420], group: 'Interactions', blurb: 'Chaque spectateur qui écrit, like ou offre un cadeau devient un petit personnage qui se balade en bas de l\'écran.',
    fields: [
      S('mode', 'Disposition', 'marche', [{ value: 'marche', label: 'Ils se baladent en bas' }, { value: 'flotte', label: 'Bulles qui flottent' }, { value: 'mur', label: 'Mur des spectateurs' }]),
      R('max', 'Avatars à l\'écran', 30, 5, 80), R('size', 'Taille des avatars', 72, 32, 160, 2, ' px'), R('idle', 'Disparaissent après', 5, 1, 30, 1, ' min'), R('speed', 'Vitesse de marche', 100, 30, 250, 5, ' %'),
      T('names', 'Afficher les pseudos', true), T('bubbles', 'Bulles de chat', true),
      T('onChat', 'Apparaît quand il écrit', true), T('onLike', 'Apparaît quand il like', true), T('onGift', 'Apparaît quand il offre un cadeau', true), T('onFollow', 'Apparaît quand il suit', true), T('onJoin', 'Apparaît dès qu\'il arrive', false),
      C('accent', 'Accent', '#8FD3FF'), C('bubble', 'Bulles', '#FFFFFF'), C('text', 'Texte', '#F2F5F9'), FONT, SCALE, CSS,
    ],
  },
  socials: {
    name: 'Réseaux sociaux', size: [640, 120], group: 'Direct', blurb: 'Tes pseudos qui défilent, avec les vrais logos.',
    fields: [
      TX('tiktok', 'TikTok', ''), TX('twitch', 'Twitch', ''), TX('youtube', 'YouTube', ''), TX('kick', 'Kick', ''), TX('instagram', 'Instagram', ''), TX('x', 'X (Twitter)', ''), TX('discord', 'Discord', ''),
      R('seconds', 'Durée par réseau', 6, 2, 30, 1, ' s'), S('style', 'Style', 'pill', [{ value: 'pill', label: 'Pastille' }, { value: 'flat', label: 'Logo et texte' }, { value: 'all', label: 'Tous en ligne' }]),
      C('bg', 'Fond', '#10131A'), C('text', 'Texte', '#F2F5F9'), FONT, SCALE, CSS,
    ],
  },
  brb: {
    name: 'Écran de pause', size: [1920, 1080], group: 'Direct', blurb: 'Un écran « Je reviens » avec chrono.',
    fields: [
      TX('title', 'Titre', 'Je reviens'),
      TX('subtitle', 'Sous-titre', ''),
      S('icon', 'Icône', 'pause', [
        { value: 'pause', label: '⏸ Pause' }, { value: 'coffee', label: '☕ Café' }, { value: 'controller', label: '🎮 Manette' },
        { value: 'moon', label: '🌙 Lune' }, { value: 'clock', label: '⏰ Horloge' }, { value: 'none', label: 'Aucune' },
      ]),
      S('style', 'Style', 'verre', [
        { value: 'verre', label: 'Verre' }, { value: 'minimal', label: 'Minimal' }, { value: 'neon', label: 'Néon' },
      ]),
      T('showTimer', 'Afficher le chrono', true),
      C('accent', 'Accent', '#8FD3FF'), C('bg', 'Fond', '#10131A'), C('text', 'Texte', '#F2F5F9'), FONT, SCALE, CSS,
    ],
  },
};

// Style, animation et position, communs à tous les overlays (appliqués par overlays/boot.js).
// tab : onglet de l'éditeur (content, style, anim, pos).
const st = { group: 'fx', tab: 'style' };
const an = { group: 'fx', tab: 'anim' };
const ps = { group: 'fx', tab: 'pos' };
const COMMON = [
  S('fxParticles', 'Particules', 'none', [{ value: 'none', label: 'Aucune' }, { value: 'neige', label: 'Neige' }, { value: 'coeurs', label: 'Cœurs' }, { value: 'feuilles', label: 'Feuilles' }, { value: 'petales', label: 'Pétales' }, { value: 'citrouilles', label: 'Citrouilles' }, { value: 'confettis', label: 'Confettis' }, { value: 'soleil', label: 'Soleil' }, { value: 'etoiles', label: 'Étoiles' }], { tab: 'anim' }),
  S('lang', 'Langue des textes', 'auto', [{ value: 'auto', label: 'Comme l\'appli' }, { value: 'fr', label: 'Français' }, { value: 'en', label: 'English' }, { value: 'both', label: 'Français + English' }], { tab: 'content' }),
  R('fxOpacity', 'Opacité', 100, 10, 100, 5, ' %', st),
  R('fxGlow', 'Halo lumineux', 0, 0, 60, 1, ' px', st), C('fxGlowColor', 'Couleur du halo', '#8FD3FF', st),
  R('fxShadow', 'Ombre portée', 0, 0, 60, 1, ' px', st), C('fxShadowColor', 'Couleur de l\'ombre', '#000000', st),
  R('fxOutline', 'Contour', 0, 0, 8, 1, ' px', st), C('fxOutlineColor', 'Couleur du contour', '#000000', st),
  R('fxHue', 'Teinte (tout l\'overlay)', 0, -180, 180, 5, '°', st), R('fxSat', 'Saturation', 100, 0, 200, 5, ' %', st), R('fxBright', 'Luminosité', 100, 40, 160, 5, ' %', st),
  S('fxIntro', 'Apparition', 'none', [
    { value: 'none', label: 'Aucune' }, { value: 'fade', label: 'Fondu' }, { value: 'up', label: 'Glisse vers le haut' }, { value: 'down', label: 'Glisse vers le bas' },
    { value: 'left', label: 'Arrive de la droite' }, { value: 'right', label: 'Arrive de la gauche' }, { value: 'zoom', label: 'Zoom' }, { value: 'pop', label: 'Rebond' }, { value: 'flip', label: 'Retournement' },
  ], an),
  S('fxIdle', 'Animation continue', 'none', [
    { value: 'none', label: 'Aucune' }, { value: 'float', label: 'Flotte' }, { value: 'pulse', label: 'Pulse' }, { value: 'sway', label: 'Balance' }, { value: 'breathe', label: 'Respire (halo)' }, { value: 'shake', label: 'Tremble' },
  ], an),
  T('fxItems', 'Animer l\'arrivée des nouveaux éléments', false, an),
  S('fxItemsAnim', 'Style d\'arrivée', 'pop', [{ value: 'pop', label: 'Rebond' }, { value: 'slide', label: 'Glisse' }, { value: 'fade', label: 'Fondu' }, { value: 'zoom', label: 'Zoom' }], an),
  R('fxSpeed', 'Vitesse des animations', 100, 25, 300, 5, ' %', an),
  T('fxConfetti', 'Confettis sur les grands moments', false, an),
  R('offsetX', 'Décalage horizontal', 0, -960, 960, 5, ' px', ps), R('offsetY', 'Décalage vertical', 0, -540, 540, 5, ' px', ps),
  R('fxRotate', 'Rotation', 0, -45, 45, 1, '°', ps), T('fxFlip', 'Miroir horizontal', false, ps),
];
// fxSkip : effets communs retirés d'un overlay qui a déjà sa propre animation (sinon ils se gênent).
const FX_NONE = { fxIntro: 'none', fxIdle: 'none', fxItems: false, fxSpeed: 100, fxConfetti: false };
for (const def of Object.values(OVERLAY_TYPES)) if (!def.noFx) def.fields.push(...COMMON.filter((f) => !(def.fxSkip || []).includes(f.key)));
// Valeurs neutres imposées pour les effets retirés (un ancien réglage ne doit plus s'appliquer).
function fxLocked(type) { const skip = OVERLAY_TYPES[type]?.fxSkip || []; return Object.fromEntries(skip.filter((k) => k in FX_NONE).map((k) => [k, FX_NONE[k]])); }

// Coloris : coque, poignées, boutons, sticks, gâchettes, voyant.
// D'abord des éditions réalistes en deux tons, puis les teintes Régie tirées d'une seule couleur.
const flat = (c1, shine = 40, extra = {}) => ({ fill: 'solid', c1, c2: c1, shine, alpha: 100, ...extra });
const duo = (c1, c2, shine = 55) => ({ fill: 'gradient', c1, c2, shine, alpha: 100 });
const PAD_PRESETS = {
  blanc: { tint: '#F2F2F2', finish: { shell: flat('#F4F4F4', 45), grips: flat('#1C1D21', 35), buttons: flat('#EDEDED', 50), sticks: flat('#1E1F23', 30), triggers: flat('#1C1D21', 40), light: flat('#3B82F6', 0) } },
  minuit: { tint: '#23262E', finish: { shell: duo('#2C2F37', '#1B1D23', 55), grips: flat('#131419', 30), buttons: flat('#1B1D23', 50), sticks: flat('#15161A', 30), triggers: flat('#1B1D23', 40), light: flat('#8FD3FF', 0) } },
  carmin: { tint: '#C8202A', finish: { shell: duo('#D62A33', '#9C141C', 60), grips: flat('#F2F2F2', 40), buttons: flat('#1D1D1F', 50), sticks: flat('#1E1E20', 30), triggers: flat('#F0F0F0', 40), light: flat('#FF4D4D', 0) } },
  cobalt: { tint: '#2F5BD8', finish: { shell: duo('#3A67E0', '#2443A8', 60), grips: flat('#F2F2F2', 40), buttons: flat('#1D1F26', 50), sticks: flat('#1C1E24', 30), triggers: flat('#F0F0F0', 40), light: flat('#8FD3FF', 0) } },
};
const COLORWAYS = {
  ...Object.fromEntries(Object.entries(PAD_PRESETS).map(([k, p]) => [k, p.tint])),
  fume: '#3A4150', encre: '#10131A', verre: '#FFFFFF', bleu: '#8FD3FF', lilas: '#B9A7FF', rose: '#FFB3CC', ambre: '#F3D38A', menthe: '#9FE3C4', rouge: '#FF8A8A',
};
const FINISH_GROUPS = [['shell', 'Coque'], ['grips', 'Poignées'], ['buttons', 'Croix et boutons'], ['sticks', 'Joysticks'], ['triggers', 'Gâchettes'], ['light', 'Lumière']];
const shadeHex = (hex, t) => `#${[1, 3, 5].map((i) => Math.round(parseInt(hex.slice(i, i + 2), 16) * (1 - t)).toString(16).padStart(2, '0')).join('')}`;
const finishFrom = (name) => {
  if (PAD_PRESETS[name]) return JSON.parse(JSON.stringify(PAD_PRESETS[name].finish));
  const tint = COLORWAYS[name] || COLORWAYS.fume;
  const glass = name === 'verre';
  const part = (extra) => ({ fill: 'solid', c1: '#20242D', c2: '#20242D', shine: 40, alpha: 100, ...extra });
  return {
    shell: { fill: 'gradient', c1: tint, c2: glass ? tint : shadeHex(tint, 0.22), shine: 60, alpha: glass ? 26 : 100 },
    grips: { fill: 'gradient', c1: shadeHex(tint, glass ? 0 : 0.34), c2: shadeHex(tint, glass ? 0 : 0.5), shine: 30, alpha: glass ? 16 : 100 },
    buttons: part({ c1: '#262B35', c2: '#262B35' }), sticks: part({ c1: '#1A1E26', c2: '#1A1E26', shine: 50 }),
    triggers: part({ fill: 'gradient', c1: '#2E3440', c2: '#14171D' }), light: { fill: 'solid', c1: '#8FD3FF', c2: '#8FD3FF', shine: 0, alpha: 100 },
  };
};
OVERLAY_TYPES.gamepad.fields.find((f) => f.key === 'finish').default = finishFrom('fume');

// Zones posées sur la photo d'une manette. Le streamer les déplace ensuite sur ses vrais boutons.
const PAD_ZONES = {
  0: { x: 442, y: 188, r: 21 }, 1: { x: 480, y: 150, r: 21 }, 2: { x: 404, y: 150, r: 21 }, 3: { x: 442, y: 112, r: 21 }, 4: { x: 164, y: 72, r: 24 }, 5: { x: 456, y: 72, r: 24 }, 6: { x: 164, y: 36, r: 20 }, 7: { x: 456, y: 36, r: 20 },
  8: { x: 279, y: 145, r: 12 }, 9: { x: 341, y: 145, r: 12 }, 12: { x: 244, y: 196, r: 14 }, 13: { x: 244, y: 256, r: 14 }, 14: { x: 214, y: 226, r: 14 }, 15: { x: 274, y: 226, r: 14 }, 16: { x: 310, y: 104, r: 12 }, 17: { x: 310, y: 174, r: 12 },
  l: { x: 184, y: 150, r: 30 }, r: { x: 376, y: 226, r: 30 },
};
const PAD_ZONE_NAMES = { 0: 'Bas', 1: 'Droite', 2: 'Gauche', 3: 'Haut', 4: 'Bumper gauche', 5: 'Bumper droit', 6: 'Gâchette gauche', 7: 'Gâchette droite', 8: 'Bouton gauche', 9: 'Bouton droit', 12: 'Croix haut', 13: 'Croix bas', 14: 'Croix gauche', 15: 'Croix droite', 16: 'Bouton central', 17: 'Pavé', l: 'Stick gauche', r: 'Stick droit' };

function overlayDefaults(type) {
  const out = {};
  for (const f of OVERLAY_TYPES[type]?.fields || []) out[f.key] = f.default;
  return out;
}

module.exports = { OVERLAY_TYPES, fxLocked, overlayDefaults, COLORWAYS, FINISH_GROUPS, finishFrom, PAD_ZONES, PAD_ZONE_NAMES };

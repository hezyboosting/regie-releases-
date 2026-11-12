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
    name: 'Alertes', size: [1920, 1080], group: 'Direct', blurb: 'Follows, subs, cadeaux, raids et tout le reste.',
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
      T('platformTag', 'Afficher la plateforme', true), T('avatar', 'Afficher les avatars', true), T('events', 'Montrer aussi les événements', true), T('badges', 'Afficher les badges', true), T('highlight', 'Mettre en avant modos et abonnés', true),
      T('hideCommands', 'Masquer les commandes', true), TX('blocked', 'Mots masqués (séparés par des virgules)', ''),
      R('maxLines', 'Messages à l\'écran', 14, 3, 40), R('fade', 'Disparition', 0, 0, 120, 5, ' s'), R('fontSize', 'Taille du texte', 18, 11, 40, 1, ' px'), R('bgAlpha', 'Fond', 0, 0, 100, 5, ' %'),
      C('nameColor', 'Pseudos', '#CFE6FF'), C('text', 'Texte', '#F2F5F9'), FONT, CSS,
    ],
  },
  goal: {
    name: 'Goal', size: [640, 140], group: 'Objectifs', blurb: 'Une barre de progression pour un objectif.',
    fields: [
      { key: 'goalId', label: 'Objectif', type: 'goal', default: '' },
      S('theme', 'Thème', 'barre', [
        { value: 'barre', label: 'Barre' }, { value: 'anneau', label: 'Anneau', premium: true }, { value: 'pile', label: 'Pile de jetons', premium: true }, { value: 'vu', label: 'Vumètre', premium: true },
      ], { feature: 'overlayThemes' }),
      C('accent', 'Couleur de remplissage', '#8FD3FF'), C('track', 'Couleur du rail', '#FFFFFF'), C('text', 'Texte', '#F2F5F9'), T('showNumbers', 'Afficher les chiffres', true), FONT, SCALE, CSS,
    ],
  },
  battle: {
    name: 'Battle', size: [1100, 220], group: 'Objectifs', blurb: 'Les scores en duel, avec le chrono.',
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
      S('layout', 'Modèle', 'auto', [
        { value: 'auto', label: 'Suit ma manette' }, { value: 'abxy', label: 'Quatre boutons ABXY' }, { value: 'symbols', label: 'Quatre symboles' }, { value: 'symbols2', label: 'Symboles, sticks décalés' },
        { value: 'bayx', label: 'Disposition BAYX' }, { value: 'arcade', label: 'Stick arcade' },
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
    name: 'Clavier', size: [760, 300], group: 'Entrées', blurb: 'Les touches utilisées, en jeu.',
    fields: [
      S('layout', 'Disposition', 'wasd', [
        { value: 'wasd', label: 'ZQSD compact' }, { value: 'tkl', label: 'Clavier sans pavé' }, { value: 'full', label: 'Clavier complet' },
      ]),
      S('lang', 'Inscriptions', 'azerty', [{ value: 'azerty', label: 'AZERTY' }, { value: 'qwerty', label: 'QWERTY' }]),
      C('key', 'Touches', '#262C33'), C('pressed', 'Touche pressée', '#F3D38A'), C('legend', 'Inscriptions', '#ECE8DE'), C('legendPressed', 'Inscription pressée', '#10131A'),
      R('radius', 'Arrondi', 7, 0, 22, 1, ' px'), R('glow', 'Lueur', 40, 0, 100, 5, ' %'), SCALE, CSS,
    ],
  },
  mouse: {
    name: 'Souris', size: [320, 420], group: 'Entrées', blurb: 'Clics, molette et mouvement.',
    fields: [
      C('body', 'Coque', '#262C33'), C('pressed', 'Clic', '#8FD3FF'), C('accent', 'Molette', '#F3D38A'), T('trail', 'Trace du mouvement', true), R('sensitivity', 'Sensibilité de la trace', 50, 5, 100, 5), SCALE, CSS,
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
    name: 'Giveaway', size: [620, 360], group: 'Outils', blurb: 'Les participants et le tirage.',
    fields: [C('accent', 'Accent', '#F3D38A'), C('bg', 'Fond', '#10131A'), C('text', 'Texte', '#F2F5F9'), FONT, SCALE, CSS],
  },
  leaderboard: {
    name: 'Classement', size: [420, 420], group: 'Cadeaux et classements', blurb: 'Gift Leaderboard, Like Leaderboard et points.',
    fields: [
      TX('title', 'Titre', 'Meilleurs soutiens'), S('metric', 'Classer par', 'coins', [{ value: 'coins', label: 'Cadeaux' }, { value: 'likes', label: 'Likes' }, { value: 'points', label: 'Points' }, { value: 'messages', label: 'Messages' }, { value: 'shares', label: 'Partages' }, { value: 'subs', label: 'Abonnements' }, { value: 'follows', label: 'Follows' }]),
      S('scope', 'Période', 'session', [{ value: 'session', label: 'Ce live' }, { value: 'today', label: 'Aujourd\'hui' }, { value: 'week', label: '7 jours' }, { value: 'month', label: '30 jours' }, { value: 'all', label: 'Depuis le début' }]), R('count', 'Places', 5, 3, 10), C('accent', 'Accent', '#F3D38A'), C('text', 'Texte', '#F2F5F9'), C('bg', 'Fond', '#10131A'), FONT, SCALE, CSS,
    ],
  },
  giftfeed: {
    name: 'Gift Feed', size: [460, 620], group: 'Cadeaux et classements', blurb: 'Les cadeaux en direct, avec les combos.',
    fields: [R('maxRows', 'Lignes', 6, 2, 12), R('stay', 'Durée à l\'écran', 12, 3, 60, 1, ' s'), TX('hidden', 'Cadeaux masqués (noms séparés par des virgules)', ''), T('avatars', 'Afficher les avatars', false), C('accent', 'Accent', '#8FD3FF'), C('bg', 'Fond', '#10131A'), C('text', 'Texte', '#F2F5F9'), FONT, SCALE, CSS],
  },
  gifttracker: {
    name: 'Gift Tracker', size: [460, 420], group: 'Cadeaux et classements', blurb: 'Le compte des cadeaux reçus sur ce live.',
    fields: [
      S('mode', 'Affichage', 'total', [{ value: 'total', label: 'Tous les cadeaux' }, { value: 'goal', label: 'Un cadeau et un objectif' }]), { key: 'giftId', label: 'Cadeau suivi', type: 'gift', default: '' }, R('target', 'Objectif', 100, 1, 10000, 1),
      TX('title', 'Titre', 'Cadeaux du live'), R('count', 'Lignes', 6, 3, 12), C('accent', 'Accent', '#F3D38A'), C('bg', 'Fond', '#10131A'), C('text', 'Texte', '#F2F5F9'), FONT, SCALE, CSS],
  },
  topgift: {
    name: 'Top Gift', size: [460, 140], group: 'Cadeaux et classements', blurb: 'Le plus gros cadeau du live.',
    fields: [TX('title', 'Titre', 'Top Gift'), C('accent', 'Accent', '#F3D38A'), C('bg', 'Fond', '#10131A'), C('text', 'Texte', '#F2F5F9'), FONT, SCALE, CSS],
  },
  topstreak: {
    name: 'Top Streak', size: [460, 140], group: 'Cadeaux et classements', blurb: 'La meilleure série de cadeaux.',
    fields: [TX('title', 'Titre', 'Top Streak'), C('accent', 'Accent', '#8FD3FF'), C('bg', 'Fond', '#10131A'), C('text', 'Texte', '#F2F5F9'), FONT, SCALE, CSS],
  },
  rankcard: {
    name: 'Follow = Rank', size: [520, 200], group: 'Gaming', blurb: 'Chaque nouveau follower reçoit son rang à l\'écran.',
    fields: [TX('title', 'Texte', 'Nouveau rang'), R('stay', 'Durée', 6, 2, 20, 1, ' s'), R('volume', 'Volume de la roulette', 60, 0, 100, 5, ' %'), C('bg', 'Fond', '#10131A'), C('text', 'Texte', '#F2F5F9'), FONT, SCALE, CSS],
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
    name: 'Chat Battle', size: [1100, 620], group: 'Interactions', blurb: 'Les spectateurs s\'affrontent à l\'écran.',
    fields: [S('theme', 'Thème', 'arene', [{ value: 'arene', label: 'Arène' }, { value: 'neon', label: 'Néon' }, { value: 'pixel', label: 'Pixel' }, { value: 'espace', label: 'Espace' }]), FONT, SCALE, CSS],
  },
  boss: {
    name: 'Boss Battle', size: [900, 560], group: 'Interactions', blurb: 'Tout le chat contre un boss.',
    fields: [S('theme', 'Thème', 'arene', [{ value: 'arene', label: 'Arène' }, { value: 'neon', label: 'Néon' }, { value: 'pixel', label: 'Pixel' }, { value: 'espace', label: 'Espace' }]), T('showTop', 'Afficher les meilleurs joueurs', true), FONT, SCALE, CSS],
  },
  webcam: {
    name: 'Cadre webcam', size: [640, 400], group: 'Direct', blurb: 'Un cadre animé qui réagit aux soutiens.',
    fields: [
      S('style', 'Style', 'degrade', [{ value: 'degrade', label: 'Dégradé' }, { value: 'neon', label: 'Néon' }, { value: 'coins', label: 'Coins' }, { value: 'bandes', label: 'Bandes' }, { value: 'simple', label: 'Simple' }]),
      TX('label', 'Texte', '{viewers} en direct'), R('thickness', 'Épaisseur', 6, 1, 24, 1, ' px'), R('radius', 'Arrondi', 18, 0, 80, 1, ' px'), C('accent', 'Couleur', '#8FD3FF'), C('accent2', 'Couleur 2', '#B9A7FF'), C('text', 'Texte', '#F2F5F9'), T('react', 'Réagir aux soutiens', true), FONT, CSS,
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
    name: 'Bulle TTS', size: [700, 180], group: 'Direct', blurb: 'Affiche le message lu à voix haute.',
    fields: [C('accent', 'Accent', '#8FD3FF'), C('bg', 'Fond', '#10131A'), C('text', 'Texte', '#F2F5F9'), T('audio', 'Jouer le son ici (ElevenLabs)', false), FONT, SCALE, CSS],
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

// Position et effets, communs à tous les overlays.
const COMMON = [
  R('offsetX', 'Décalage horizontal', 0, -960, 960, 5, ' px', { group: 'fx' }), R('offsetY', 'Décalage vertical', 0, -540, 540, 5, ' px', { group: 'fx' }),
  R('fxGlow', 'Glow', 0, 0, 60, 1, ' px', { group: 'fx' }), C('fxGlowColor', 'Couleur du glow', '#8FD3FF', { group: 'fx' }),
  R('fxBlur', 'Blur du fond', 0, 0, 30, 1, ' px', { group: 'fx' }), T('fxConfetti', 'Confettis sur les grands moments', false, { group: 'fx' }),
];
for (const def of Object.values(OVERLAY_TYPES)) if (!def.noFx) def.fields.push(...COMMON);

// Coloris : coque, poignées, boutons, sticks, gâchettes, voyant.
// Coloris : la teinte du verre. Le reste de la manette reste clair et lumineux.
const COLORWAYS = { verre: '#FFFFFF', bleu: '#8FD3FF', lilas: '#B9A7FF', rose: '#FFB3CC', ambre: '#F3D38A', menthe: '#9FE3C4', rouge: '#FF8A8A', fume: '#3A4150', encre: '#10131A' };
const FINISH_GROUPS = [['shell', 'Coque'], ['grips', 'Poignées'], ['buttons', 'Croix et boutons'], ['sticks', 'Joysticks'], ['triggers', 'Gâchettes'], ['light', 'Lumière']];
const shadeHex = (hex, t) => `#${[1, 3, 5].map((i) => Math.round(parseInt(hex.slice(i, i + 2), 16) * (1 - t)).toString(16).padStart(2, '0')).join('')}`;
const finishFrom = (name) => {
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

module.exports = { OVERLAY_TYPES, overlayDefaults, COLORWAYS, FINISH_GROUPS, finishFrom, PAD_ZONES, PAD_ZONE_NAMES };

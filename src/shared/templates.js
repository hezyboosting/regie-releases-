// Modèles d'overlays personnalisés fournis avec Régie (coordonnées sur une scène 1920 × 1080).
let n = 0;
const base = (kind, x, y, w, h, over) => ({
  id: `t${(n += 1)}`, kind, x, y, w, h, rot: 0, opacity: 100, text: '', font: 'onest', size: 40, weight: 700, color: '#FFFFFF', align: 'left', fill: '#10131A', fill2: '', radius: 0,
  stroke: 0, strokeColor: '#FFFFFF', glow: 0, glowColor: '#8FD3FF', blur: 0, backdrop: 0, anim: 'none', src: '', value: 'goal', target: 'goalTarget', ...over,
});
const text = (x, y, w, h, t, over) => base('text', x, y, w, h, { text: t, ...over });
const shape = (x, y, w, h, over) => base('shape', x, y, w, h, over);
const bar = (x, y, w, h, over) => base('bar', x, y, w, h, over);
const GRAD = { fill: '#8FD3FF', fill2: '#B9A7FF' };

const TEMPLATES = [
  {
    id: 'bandeau', name: 'Bandeau du live', blurb: 'Une barre d\'infos en bas de l\'écran.', premium: false,
    elements: [
      shape(40, 960, 1840, 84, { fill: '#10131A', radius: 22, backdrop: 12 }), shape(40, 960, 12, 84, { ...GRAD, radius: 6 }),
      text(84, 982, 420, 44, '{viewers} spectateurs', { size: 30 }), text(520, 982, 640, 44, 'Dernier follow : {lastFollower}', { size: 30, weight: 500 }), text(1180, 982, 680, 44, 'Top don : {topGifter}', { size: 30, weight: 500, align: 'right' }),
    ],
  },
  {
    id: 'bientot', name: 'Ça commence bientôt', blurb: 'Un écran d\'attente plein écran.', premium: false,
    elements: [
      shape(0, 0, 1920, 1080, { fill: '#10131A', fill2: '#1D2C3F' }), shape(620, 150, 680, 680, { fill: '#8FD3FF', radius: 340, blur: 120, opacity: 45, anim: 'breathe' }),
      text(260, 400, 1400, 170, 'Ça commence bientôt', { font: 'onest', size: 92, weight: 600, align: 'center' }), text(460, 590, 1000, 70, 'Installe-toi, on arrive', { size: 44, weight: 500, align: 'center', opacity: 80 }),
    ],
  },
  {
    id: 'pause', name: 'Petite pause', blurb: 'Un écran de pause, avec la musique en cours.', premium: false,
    elements: [
      shape(0, 0, 1920, 1080, { fill: '#141C28', fill2: '#10131A' }), shape(1180, -120, 760, 760, { fill: '#9FE3C4', radius: 380, blur: 130, opacity: 30, anim: 'breathe' }),
      text(160, 380, 1400, 170, 'On revient vite', { font: 'onest', size: 108, weight: 600 }), text(166, 570, 1400, 60, 'En ce moment : {song}, {artist}', { size: 40, weight: 500, opacity: 85 }),
    ],
  },
  {
    id: 'fin', name: 'Fin de live', blurb: 'Le remerciement final avec les meilleurs soutiens.', premium: false,
    elements: [
      shape(0, 0, 1920, 1080, { fill: '#1A1F2B', fill2: '#10131A' }), text(260, 300, 1400, 160, 'Merci d\'être venus', { font: 'onest', size: 92, weight: 600, align: 'center' }),
      text(360, 500, 1200, 64, 'Top don : {topGifter}', { size: 46, align: 'center', color: '#F3D38A' }), text(360, 580, 1200, 64, 'Meilleure série : {topStreakUser}, {topStreak}', { size: 40, weight: 500, align: 'center' }), text(360, 660, 1200, 64, '{follows} nouveaux follows ce soir', { size: 40, weight: 500, align: 'center' }),
    ],
  },
  {
    id: 'cadeaux', name: 'Panneau cadeaux', blurb: 'Le top don, la meilleure série et le total.', premium: false,
    elements: [
      shape(1480, 40, 400, 250, { fill: '#10131A', radius: 24, opacity: 92, backdrop: 14 }), text(1510, 62, 340, 30, 'Cadeaux du live', { size: 22, color: '#F3D38A' }), text(1510, 94, 340, 70, '{coins}', { font: 'onest', size: 58, weight: 600 }),
      text(1510, 176, 340, 40, 'Top : {topGifter}', { size: 26, weight: 600 }), text(1510, 222, 340, 40, 'Série : {topStreakUser} ×{topStreak}', { size: 24, weight: 500, opacity: 85 }),
    ],
  },
  {
    id: 'goal', name: 'Objectif du live', blurb: 'Le nom du goal et sa barre.', premium: false,
    elements: [
      text(560, 40, 800, 44, '{goalName}', { size: 30, align: 'center' }), bar(560, 92, 800, 30, { fill: '#10131A', color: '#8FD3FF', fill2: '#F3D38A', radius: 15 }), text(560, 128, 800, 36, '{goal} sur {goalTarget}', { size: 24, weight: 500, align: 'center' }),
    ],
  },
  {
    id: 'neon', name: 'Néon', blurb: 'Des infos lumineuses, façon enseigne.', premium: true,
    elements: [
      text(60, 40, 700, 80, '{viewers} en ligne', { font: 'onest', size: 58, weight: 600, color: '#FFFFFF', glow: 22, glowColor: '#FF2E97' }), text(60, 124, 900, 50, 'Dernier follow {lastFollower}', { size: 34, color: '#00F0FF', glow: 16, glowColor: '#00F0FF' }),
      shape(60, 184, 520, 4, { fill: '#FF2E97', glow: 18, glowColor: '#FF2E97', anim: 'breathe' }),
    ],
  },
  {
    id: 'cadre', name: 'Cadre de jeu', blurb: 'Un cadre fin avec la musique et les spectateurs.', premium: true,
    elements: [
      shape(24, 24, 1872, 1032, { fill: 'transparent', stroke: 3, strokeColor: '#8FD3FF', radius: 28, glow: 14, glowColor: '#8FD3FF' }), shape(60, 972, 620, 62, { fill: '#10131A', radius: 31, opacity: 90 }),
      text(92, 986, 560, 40, '{song}', { size: 26, weight: 600 }), shape(1560, 972, 300, 62, { ...GRAD, radius: 31 }), text(1560, 986, 300, 40, '{viewers} en direct', { size: 26, align: 'center' }),
    ],
  },
];

// Écrans complets et bandeaux par moment du live. Fond dégradé, halo animé, titre.
const screen = (id, name, blurb, cat, c1, c2, halo, title, sub, premium = false) => ({
  id, name, blurb, cat, premium,
  elements: [
    shape(0, 0, 1920, 1080, { fill: c1, fill2: c2 }), shape(560, 120, 800, 800, { fill: halo, radius: 400, blur: 130, opacity: 40, anim: 'breathe' }),
    text(160, 400, 1600, 170, title, { font: 'onest', size: 96, weight: 600, align: 'center' }), text(360, 590, 1200, 70, sub, { size: 42, weight: 500, align: 'center', opacity: 80 }),
  ],
});
const vertical = (id, name, blurb, els, premium = false) => ({ id, name, blurb, cat: 'Vertical 9:16', format: '9:16', premium, elements: els });

TEMPLATES.push(
  screen('horsligne', 'Hors ligne', 'L\'écran de ta chaîne quand tu ne streames pas.', 'Écrans de live', '#111724', '#10131A', '#8FD3FF', 'Hors ligne', 'À très vite sur le prochain live'),
  screen('chargement', 'Chargement', 'Entre deux parties.', 'Écrans de live', '#10131A', '#1A2230', '#B9A7FF', 'Chargement', '{viewers} personnes attendent avec toi'),
  screen('discussion', 'Just Chatting', 'Un cadre sobre pour discuter.', 'Écrans de live', '#141C28', '#201538', '#9FE3C4', 'Discussion', 'Pose tes questions dans le chat', true),
  screen('match', 'Match qui commence', 'Juste avant le lancement.', 'Gaming', '#1B1620', '#10131A', '#F3D38A', 'Le match commence', 'Bonne chance à tout le monde'),
  screen('victoire', 'Victoire', 'À afficher après une partie gagnée.', 'Gaming', '#12221E', '#111824', '#9FE3C4', 'Victoire', '{goalName}', true),
  screen('defaite', 'Défaite', 'On se refait la prochaine.', 'Gaming', '#201518', '#14111A', '#8FD3FF', 'Défaite', 'La prochaine est pour nous', true),
  {
    id: 'hudjeu', name: 'Bandeau de jeu', blurb: 'Infos discrètes pendant la partie.', cat: 'Gaming', premium: false,
    elements: [
      shape(1420, 24, 476, 120, { fill: '#10131A', radius: 20, backdrop: 10, opacity: 90 }), text(1448, 42, 420, 40, '{viewers} spectateurs', { size: 28 }), text(1448, 90, 420, 36, 'Dernier follow : {lastFollower}', { size: 24, weight: 500, opacity: 80 }),
    ],
  },
  vertical('v-bandeau', 'Bandeau vertical', 'Infos en bas, pour TikTok.', [
    shape(40, 1640, 1000, 220, { fill: '#10131A', radius: 36, backdrop: 12, opacity: 92 }), shape(40, 1640, 14, 220, { ...GRAD, radius: 7 }),
    text(90, 1670, 900, 64, 'Dernier follow : {lastFollower}', { size: 44 }), text(90, 1750, 900, 64, 'Top don : {topGifter}', { size: 44, weight: 500 }),
  ]),
  vertical('v-goal', 'Objectif vertical', 'Une barre d\'objectif en haut.', [
    shape(40, 150, 1000, 150, { fill: '#10131A', radius: 30, opacity: 92 }), text(80, 170, 920, 54, '{goalName}', { size: 38 }), bar(80, 240, 920, 32, { fill: 'rgba(255,255,255,.15)', color: '#8FD3FF', radius: 16 }),
  ], true),
  vertical('v-attente', 'Attente verticale', 'Un écran d\'attente pour TikTok LIVE.', [
    shape(0, 0, 1080, 1920, { fill: '#10131A', fill2: '#1D2C3F' }), shape(140, 560, 800, 800, { fill: '#8FD3FF', radius: 400, blur: 120, opacity: 45, anim: 'breathe' }),
    text(60, 800, 960, 220, 'On arrive', { font: 'onest', size: 110, weight: 600, align: 'center' }), text(60, 1040, 960, 80, 'Reste avec nous', { size: 46, weight: 500, align: 'center', opacity: 80 }),
  ]),
);
for (const t of TEMPLATES) t.cat = t.cat || (t.elements.some((e) => e.w >= 1900 && e.h >= 1000) ? 'Écrans de live' : 'Bandeaux et infos');

module.exports = { TEMPLATES };

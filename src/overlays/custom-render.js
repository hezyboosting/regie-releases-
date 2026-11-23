// Rendu d'un élément d'overlay personnalisé. Utilisé à l'identique par l'overlay et par l'éditeur.
export const VARIABLES = [
  ['viewers', 'Spectateurs'], ['lastFollower', 'Dernier suivi'], ['lastSub', 'Dernier abonné'], ['lastGifter', 'Dernier donateur'], ['lastGift', 'Dernier cadeau'], ['topGifter', 'Meilleur donateur'], ['topGift', 'Meilleur cadeau'],
  ['topGiftValue', 'Valeur du meilleur cadeau'], ['topStreakUser', 'Meilleure série, pseudo'], ['topStreak', 'Meilleure série, nombre'], ['coins', 'Pièces du live'], ['gifts', 'Cadeaux du live'], ['likes', 'Likes du live'], ['follows', 'Suivis du live'],
  ['subs', 'Abonnements du live'], ['messages', 'Messages du live'], ['song', 'Titre en cours'], ['artist', 'Artiste en cours'], ['goal', 'Objectif actuel'], ['goalTarget', 'Cible de l\'objectif'], ['goalName', 'Nom de l\'objectif'], ['uptime', 'Durée du live'],
];

const SAMPLE = {
  viewers: 1284, lastFollower: 'Lena', lastSub: 'Marius', lastGifter: 'kenza.live', lastGift: 'Rose', topGifter: 'Nolan', topGift: 'Fusée', topGiftValue: 12000, topStreakUser: 'Sofia', topStreak: 188,
  coins: 8420, gifts: 133, likes: 24800, follows: 42, subs: 7, messages: 860, song: 'Nuit sur le périph', artist: 'Les Faisceaux', goal: 64, goalTarget: 100, goalName: 'Objectif du live', uptime: '1 h 24',
};

export const sampleVars = () => SAMPLE;

export function fillVars(text, vars = {}) {
  return String(text ?? '').replace(/\{([a-zA-Z]+)\}/g, (m, k) => {
    const v = vars[k];
    if (v === undefined || v === null || v === '') return vars === SAMPLE ? m : '';
    return typeof v === 'number' ? v.toLocaleString(document.documentElement.lang === 'en' ? 'en-US' : 'fr-FR') : String(v);
  });
}

const FONTS = { onest: '"Onest", system-ui, sans-serif', geist: '"Geist", system-ui, sans-serif', syne: '"Syne", "Geist", sans-serif', archivo: '"Archivo", sans-serif', system: 'system-ui, "Segoe UI", sans-serif', serif: 'Georgia, serif', rounded: '"Arial Rounded MT Bold", "Segoe UI", sans-serif', impact: 'Impact, "Arial Narrow Bold", sans-serif' };

// Formes dessinées en SVG (repère 100 × 100 étiré à la taille de l'élément ; le contour garde son épaisseur).
export const SHAPES = [
  ['rect', 'Rectangle'], ['ellipse', 'Cercle'], ['triangle', 'Triangle'], ['losange', 'Losange'], ['hexagone', 'Hexagone'], ['etoile', 'Étoile'],
  ['coeur', 'Cœur'], ['fleche', 'Flèche'], ['banniere', 'Bannière'], ['bulle', 'Bulle'], ['coupe', 'Coins coupés'], ['biseau', 'Penché'],
];
export const SHAPE_PATHS = {
  triangle: 'M50 2 L98 98 L2 98 Z',
  losange: 'M50 2 L98 50 L50 98 L2 50 Z',
  hexagone: 'M25 2 L75 2 L98 50 L75 98 L25 98 L2 50 Z',
  etoile: 'M50 3 L61.8 37 L97.6 37.6 L69 59.4 L79.4 93.7 L50 73.2 L20.6 93.7 L31 59.4 L2.4 37.6 L38.2 37 Z',
  coeur: 'M50 92 C22 72 3 54 3 32 C3 15 16 4 30 4 C40 4 47 10 50 18 C53 10 60 4 70 4 C84 4 97 15 97 32 C97 54 78 72 50 92 Z',
  fleche: 'M2 30 L62 30 L62 6 L98 50 L62 94 L62 70 L2 70 Z',
  banniere: 'M2 6 L98 6 L86 50 L98 94 L2 94 L14 50 Z',
  bulle: 'M8 4 L92 4 Q98 4 98 10 L98 66 Q98 72 92 72 L36 72 L18 96 L22 72 L8 72 Q2 72 2 66 L2 10 Q2 4 8 4 Z',
  coupe: 'M14 2 L86 2 L98 14 L98 86 L86 98 L14 98 L2 86 L2 14 Z',
  biseau: 'M14 2 L98 2 L86 98 L2 98 Z',
};
const hex = (v, def = '#000000') => (/^#[0-9a-f]{3,8}$/i.test(String(v || '')) ? v : def);
const DASH = { plein: '', tirets: ' stroke-dasharray="10 7"', points: ' stroke-dasharray="1 7" stroke-linecap="round"' };

export function shapeSvg(el) {
  const shape = SHAPE_PATHS[el.shape] ? el.shape : 'ellipse';
  const gid = `g${String(el.id || '').replace(/[^a-z0-9]/gi, '')}`;
  const angle = Number(el.angle ?? 120) || 0;
  const grad = el.fill2 ? `<defs><linearGradient id="${gid}" x1="0" y1=".5" x2="1" y2=".5" gradientTransform="rotate(${angle - 90} .5 .5)"><stop offset="0" stop-color="${hex(el.fill)}"/><stop offset="1" stop-color="${hex(el.fill2)}"/></linearGradient></defs>` : '';
  const fill = el.fill === 'transparent' && !el.fill2 ? 'none' : el.fill2 ? `url(#${gid})` : hex(el.fill);
  const sw = Math.max(0, Math.min(40, Number(el.stroke) || 0));
  const stroke = sw ? ` stroke="${hex(el.strokeColor, '#FFFFFF')}" stroke-width="${sw}" vector-effect="non-scaling-stroke" stroke-linejoin="round"${DASH[el.dash] || ''}` : '';
  const body = shape === 'ellipse' ? `<ellipse cx="50" cy="50" rx="49" ry="49" fill="${fill}"${stroke}/>` : `<path d="${SHAPE_PATHS[shape]}" fill="${fill}"${stroke}/>`;
  return `<svg viewBox="0 0 100 100" preserveAspectRatio="none" width="100%" height="100%" style="display:block;overflow:visible">${grad}${body}</svg>`;
}

export const newElement = (kind, over = {}) => ({
  id: `e${Math.random().toString(36).slice(2, 9)}`, kind, x: 760, y: 440, w: kind === 'text' ? 400 : 320, h: kind === 'bar' ? 36 : kind === 'text' ? 80 : 200, rot: 0, opacity: 100,
  text: kind === 'text' ? 'Ton texte' : '', font: 'onest', size: 48, weight: 700, color: '#FFFFFF', align: 'left', fill: kind === 'shape' ? '#FF3D71' : '#171230', fill2: '', radius: kind === 'shape' ? 18 : 8,
  stroke: 0, strokeColor: '#FFFFFF', glow: 0, glowColor: '#8FD3FF', blur: 0, backdrop: 0, anim: 'none', src: '', value: 'goal', target: 'goalTarget', ...over,
});

export function renderElement(el, vars, media = (v) => v) {
  const n = document.createElement('div');
  n.className = `ce ce-${el.kind} anim-${el.anim || 'none'}`;
  n.dataset.id = el.id;
  const st = n.style;
  st.left = `${el.x}px`; st.top = `${el.y}px`; st.width = `${el.w}px`; st.height = `${el.h}px`;
  st.opacity = (el.opacity ?? 100) / 100;
  st.transform = el.rot ? `rotate(${el.rot}deg)` : '';
  const filters = [];
  if (el.shadow) filters.push(`drop-shadow(0 ${Math.round(el.shadow / 3)}px ${el.shadow}px ${el.shadowColor || '#000000'})`);
  if (el.glow) filters.push(`drop-shadow(0 0 ${el.glow}px ${el.glowColor})`);
  if (el.blur) filters.push(`blur(${el.blur}px)`);
  if (filters.length) st.filter = filters.join(' ');
  if (el.backdrop) st.backdropFilter = `blur(${el.backdrop}px)`;
  if (el.kind === 'text') {
    st.fontFamily = FONTS[el.font] || FONTS.onest;
    st.fontSize = `${el.size}px`;
    st.fontWeight = el.weight;
    st.color = el.color;
    st.textAlign = el.align;
    n.textContent = fillVars(el.text, vars);
  } else if (el.kind === 'shape') {
    if (SHAPE_PATHS[el.shape] || el.shape === 'ellipse') n.innerHTML = shapeSvg(el);
    else {
      st.background = el.fill2 ? `linear-gradient(${Number(el.angle ?? 120) || 0}deg, ${el.fill}, ${el.fill2})` : el.fill;
      st.borderRadius = `${el.radius}px`;
      if (el.stroke) st.border = `${el.stroke}px ${{ tirets: 'dashed', points: 'dotted' }[el.dash] || 'solid'} ${el.strokeColor}`;
    }
  } else if (el.kind === 'image') {
    st.borderRadius = `${el.radius}px`;
    st.overflow = 'hidden';
    if (/\.(mp4|webm)$/i.test(el.src || '')) {
      const v = document.createElement('video');
      v.src = media(el.src); v.autoplay = true; v.loop = true; v.muted = true; v.playsInline = true;
      n.append(v);
    } else if (el.src) { const i = document.createElement('img'); i.src = media(el.src); i.alt = ''; n.append(i); } else n.classList.add('ce-empty');
  } else if (el.kind === 'bar') {
    st.background = el.fill;
    st.borderRadius = `${el.radius}px`;
    st.overflow = 'hidden';
    const value = Number(vars?.[el.value]) || 0;
    const target = Number(vars?.[el.target]) || Number(el.target) || 100;
    const i = document.createElement('i');
    i.style.width = `${Math.min(100, (value / target) * 100)}%`;
    i.style.background = el.fill2 ? `linear-gradient(90deg, ${el.color}, ${el.fill2})` : el.color;
    n.append(i);
  }
  return n;
}

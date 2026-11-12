// Rendu d'un élément d'overlay personnalisé. Utilisé à l'identique par l'overlay et par l'éditeur.
export const VARIABLES = [
  ['viewers', 'Spectateurs'], ['lastFollower', 'Dernier follower'], ['lastSub', 'Dernier abonné'], ['lastGifter', 'Dernier donateur'], ['lastGift', 'Dernier cadeau'], ['topGifter', 'Top donateur'], ['topGift', 'Top cadeau'],
  ['topGiftValue', 'Valeur du top cadeau'], ['topStreakUser', 'Top série, pseudo'], ['topStreak', 'Top série, nombre'], ['coins', 'Pièces du live'], ['gifts', 'Cadeaux du live'], ['likes', 'Likes du live'], ['follows', 'Follows du live'],
  ['subs', 'Abonnements du live'], ['messages', 'Messages du live'], ['song', 'Titre en cours'], ['artist', 'Artiste en cours'], ['goal', 'Goal actuel'], ['goalTarget', 'Objectif du goal'], ['goalName', 'Nom du goal'], ['uptime', 'Durée du live'],
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
    return typeof v === 'number' ? v.toLocaleString('fr-FR') : String(v);
  });
}

const FONTS = { onest: '"Onest", system-ui, sans-serif', geist: '"Geist", system-ui, sans-serif', syne: '"Syne", "Geist", sans-serif', archivo: '"Archivo", sans-serif', system: 'system-ui, "Segoe UI", sans-serif', serif: 'Georgia, serif', rounded: '"Arial Rounded MT Bold", "Segoe UI", sans-serif', impact: 'Impact, "Arial Narrow Bold", sans-serif' };

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
    st.background = el.fill2 ? `linear-gradient(120deg, ${el.fill}, ${el.fill2})` : el.fill;
    st.borderRadius = `${el.radius}px`;
    if (el.stroke) st.border = `${el.stroke}px solid ${el.strokeColor}`;
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

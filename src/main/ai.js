// Création d'overlays par IA, avec la clé API de l'utilisateur. La réponse est toujours validée avant usage.
const crypto = require('crypto');

const MODEL = 'claude-sonnet-5-5';
const COLOR = /^#[0-9a-fA-F]{6}$|^transparent$/;
const KINDS = ['text', 'shape', 'bar'];
const FONTS = ['onest', 'geist', 'syne', 'archivo', 'system', 'serif', 'rounded', 'impact'];
const ANIMS = ['none', 'pulse', 'float', 'breathe', 'slide'];
const VARS = 'viewers lastFollower lastSub lastGifter lastGift topGifter topGift topGiftValue topStreakUser topStreak coins gifts likes follows subs messages song artist goal goalTarget goalName uptime';

const SYSTEM = `Tu crées des overlays de stream sur une scène de 1920 par 1080 pixels.
Réponds uniquement avec un objet JSON, sans texte autour : {"name": string, "elements": [...]}. Douze éléments maximum, dans l'ordre d'empilement.
Chaque élément : {"kind": "text"|"shape"|"bar", "x", "y", "w", "h", "rot", "opacity" (0 à 100)}.
Texte : "text", "font" (${FONTS.join(', ')}), "size", "weight", "color", "align" (left, center, right).
Forme : "fill", "fill2" (facultatif, pour un dégradé), "radius", "stroke", "strokeColor".
Barre : "fill" (rail), "color", "fill2", "radius", "value" et "target" (noms de variables).
Effets sur tous les éléments : "glow" (0 à 60), "glowColor", "blur" (0 à 60), "backdrop" (0 à 30), "anim" (${ANIMS.join(', ')}).
Couleurs au format #RRGGBB. Le texte peut contenir ces variables entre accolades : ${VARS}.
Écris en français, garde le texte lisible sur un fond de jeu, et laisse le centre de l'écran libre sauf pour un écran plein.`;

const num = (v, min, max, d) => { const n = Number(v); return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : d; };
const col = (v, d) => (COLOR.test(String(v)) ? v : d);

function sanitize(raw) {
  const list = Array.isArray(raw?.elements) ? raw.elements : [];
  const elements = list.filter((e) => KINDS.includes(e?.kind)).slice(0, 24).map((e) => ({
    id: `e${crypto.randomBytes(4).toString('hex')}`, kind: e.kind, x: num(e.x, -200, 2100, 100), y: num(e.y, -200, 1200, 100), w: num(e.w, 4, 2200, 300), h: num(e.h, 2, 1300, 80),
    rot: num(e.rot, -180, 180, 0), opacity: num(e.opacity, 0, 100, 100), text: String(e.text ?? '').slice(0, 200), font: FONTS.includes(e.font) ? e.font : 'geist', size: num(e.size, 8, 300, 40), weight: num(e.weight, 100, 900, 700),
    color: col(e.color, '#FFFFFF'), align: ['left', 'center', 'right'].includes(e.align) ? e.align : 'left', fill: col(e.fill, '#171230'), fill2: e.fill2 ? col(e.fill2, '') : '', radius: num(e.radius, 0, 1000, 0),
    stroke: num(e.stroke, 0, 40, 0), strokeColor: col(e.strokeColor, '#FFFFFF'), glow: num(e.glow, 0, 60, 0), glowColor: col(e.glowColor, '#FF3D71'), blur: num(e.blur, 0, 60, 0), backdrop: num(e.backdrop, 0, 30, 0),
    anim: ANIMS.includes(e.anim) ? e.anim : 'none', src: '', value: /^\w+$/.test(e.value || '') ? e.value : 'goal', target: /^\w+$/.test(e.target || '') ? e.target : 'goalTarget',
  }));
  if (!elements.length) throw new Error('L\'IA n\'a pas produit d\'overlay exploitable. Reformule ta demande.');
  return { name: String(raw.name || 'Overlay IA').slice(0, 60), elements };
}

function parseJson(text) {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 || end < start) throw new Error('Réponse illisible de l\'IA. Réessaie.');
  try { return JSON.parse(text.slice(start, end + 1)); } catch { throw new Error('Réponse illisible de l\'IA. Réessaie.'); }
}

async function askClaude({ key, system, prompt, maxTokens, fetchImpl }) {
  if (!key) throw new Error('Ajoute ta clé API Claude dans Réglages, Connexions.');
  const res = await fetchImpl('https://api.anthropic.com/v1/messages', {
    method: 'POST', headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model: MODEL, max_tokens: maxTokens, system, messages: [{ role: 'user', content: String(prompt).slice(0, 4000) }] }),
    signal: AbortSignal.timeout(60000),
  });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401) throw new Error('Cette clé API n\'est pas valide.');
  if (!res.ok) throw new Error(`Le service IA a répondu ${res.status}.`);
  return (data.content || []).filter((c) => c.type === 'text').map((c) => c.text).join('');
}

async function generateOverlay({ key, prompt, format = '16:9', fetchImpl = fetch }) {
  if (key && !String(prompt || '').trim()) throw new Error('Décris l\'overlay que tu veux.');
  const system = format === '9:16' ? SYSTEM.replace('1920 par 1080', '1080 par 1920') : SYSTEM;
  return sanitize(parseJson(await askClaude({ key, system, prompt, maxTokens: 2500, fetchImpl })));
}

const ASSIST = {
  analyse: 'Analyse les chiffres de ce streamer et donne trois améliorations concrètes, classées par impact.',
  titres: 'Propose dix titres de live courts et accrocheurs pour ce streamer.',
  commandes: 'Propose cinq commandes de chat utiles, avec leur texte de réponse.',
  idees: 'Propose cinq idées d\'interactions avec le chat, adaptées au jeu du streamer.',
  scenario: 'Propose trois automatisations de la forme SI événement ALORS actions, faciles à reproduire.',
  config: 'Réponds à la question de configuration du streamer, étape par étape.',
};

function assistant({ key, kind, prompt, context, lang = 'fr', fetchImpl = fetch }) {
  const system = `Tu es l'assistant de stream de l'appli Régie. ${lang === 'en' ? 'Réponds en anglais' : 'Réponds en français'}, de façon brève et concrète, sans markdown lourd. ${ASSIST[kind] || ASSIST.config}\nContexte du streamer : ${JSON.stringify(context)}`;
  return askClaude({ key, system, prompt: prompt || 'Vas-y.', maxTokens: 1200, fetchImpl });
}

// Passage 16:9 vers 9:16 et inversement : positions proportionnelles, textes réduits.
function adaptElements(elements, to) {
  const [kx, ky, kSize] = to === '9:16' ? [1080 / 1920, 1920 / 1080, 1080 / 1920] : [1920 / 1080, 1080 / 1920, 1];
  return JSON.parse(JSON.stringify(elements)).map((e) => ({
    ...e, x: Math.round(e.x * kx), w: Math.round(e.w * kx), y: Math.round(e.y * ky), h: Math.round(e.kind === 'shape' && e.w >= 1800 ? e.h * ky : e.h * Math.max(kSize, 0.75)), size: Math.round((e.size || 40) * Math.max(kSize, 0.7)),
  }));
}

module.exports = { generateOverlay, assistant, adaptElements, sanitize, parseJson, MODEL };

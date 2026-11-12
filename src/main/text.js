// Fonctions de texte partagées par le moteur et le TTS.
function renderTemplate(tpl, vars) {
  return String(tpl || '').replace(/\{([a-zA-Z]+)\}/g, (m, k) => (vars[k] !== undefined && vars[k] !== null ? String(vars[k]) : m));
}

function filterText(text, { maxLength = 200, stripLinks = true, stripEmoji = true, blocked = [] } = {}) {
  let t = String(text || '');
  if (stripLinks) t = t.replace(/\b(?:https?:\/\/|www\.)\S+/gi, ' lien ');
  if (stripEmoji) t = t.replace(/[\p{Extended_Pictographic}\u{FE0F}\u{200D}]/gu, '');
  t = t.replace(/(.)\1{4,}/g, '$1$1$1').replace(/\s+/g, ' ').trim();
  const low = t.toLowerCase();
  if (blocked.some((w) => w && low.includes(String(w).toLowerCase()))) return '';
  return t.slice(0, maxLength);
}

module.exports = { renderTemplate, filterText };

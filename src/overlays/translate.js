// Copie générée de src/shared/translate.js par tools/i18n/build.js : modifier l'original.
// Traducteur français → anglais partagé par l'interface, les overlays et le processus principal.
// Une entrée peut avoir des trous : {0}, {1}… ou {user}, {amount}… Le texte affiché est alors reconnu
// par motif, et chaque morceau capturé est traduit à son tour (« Aperçu de Minuteur » → « Preview of Timer »).

function makeTranslator(EN) {
  const exact = EN || {};
  const patterns = [];
  const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  for (const fr of Object.keys(exact)) {
    if (!/\{[\w]+\}/.test(fr)) continue;
    const parts = fr.split(/\{([\w]+)\}/);
    let re = '^';
    const names = [];
    for (let i = 0; i < parts.length; i += 1) {
      if (i % 2 === 0) re += esc(parts[i]);
      else { re += '(.+?)'; names.push(parts[i]); }
    }
    const lits = parts.filter((_, i) => i % 2 === 0).map((s) => s.trim()).filter(Boolean);
    if (!lits.length) continue;
    const longest = lits.sort((a, b) => b.length - a.length)[0];
    const weight = lits.join('').replace(/[^A-Za-zÀ-ÿ]/g, '').length;
    patterns.push({ re: new RegExp(`${re}$`, 's'), names, en: exact[fr], lit: longest, weight });
  }
  // Les motifs les plus précis d'abord.
  patterns.sort((a, b) => b.weight - a.weight);
  const cache = new Map();

  function core(s, depth) {
    const key = s.replace(/\s+/g, ' ').trim();
    if (!key) return s;
    const hit = exact[key];
    if (hit) return s.match(/^\s*/)[0] + hit + s.match(/\s*$/)[0];
    if (depth > 2 || key.length > 400) return s;
    for (const p of patterns) {
      if (!key.includes(p.lit)) continue;
      const m = key.match(p.re);
      if (!m) continue;
      const vals = {};
      let phrase = false;
      p.names.forEach((n, i) => {
        const v = m[i + 1];
        const t = core(v, depth + 1);
        // Motif court (« {0} de {1} ») : refusé si un morceau reste une phrase française non traduite.
        if (p.weight < 8 && t === v && /\S\s+\S/.test(v.trim()) && /[a-zà-ÿ]{2}/.test(v)) phrase = true;
        vals[n] = t;
      });
      if (phrase) continue;
      const out = p.en.replace(/\{([\w]+)\}/g, (all, n) => (vals[n] === undefined ? all : vals[n]));
      return s.match(/^\s*/)[0] + out + s.match(/\s*$/)[0];
    }
    return s;
  }

  return function translate(s) {
    if (typeof s !== 'string' || !s || !/[A-Za-zÀ-ÿ]/.test(s)) return s;
    if (cache.has(s)) return cache.get(s);
    const out = core(s, 0);
    if (cache.size > 5000) cache.clear();
    cache.set(s, out);
    return out;
  };
}

export { makeTranslator };

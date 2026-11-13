// Cases du Plinko, partagées entre les réglages par défaut et le moteur.
// Cases par défaut pour n cases : gros gains sur les bords, petits au centre, comme une vraie planche.
// Le multiplicateur suit la rareté de la case (α règle l'écart) et la planche rend 90 % des mises en moyenne.
const ALPHA = { equilibre: 0.5, gros: 0.7, doux: 0.3 };
const nice = (m) => (m >= 10 ? Math.round(m) : m >= 2 ? Math.round(m * 2) / 2 : Math.max(0.1, Math.round(m * 10) / 10));
function defaultBins(count, preset = 'equilibre') {
  const odds = naturalOdds(count - 1);
  const a = ALPHA[preset] ?? 0.5;
  const raw = odds.map((p) => (1 / p) ** a);
  const k = 0.9 / odds.reduce((n, p, i) => n + p * raw[i], 0);
  const mults = raw.map((r) => nice(r * k));
  const top = Math.max(...mults);
  const colors = ['#FFD84D', '#FFB13D', '#FF8A3D', '#FF5E4D', '#FF3D7F', '#D13DFF'];
  return mults.map((mult) => {
    const lvl = Math.min(colors.length - 1, Math.round((Math.log(mult / Math.min(...mults)) / Math.log(Math.max(1.0001, top / Math.min(...mults)))) * (colors.length - 1)));
    return { label: `×${String(mult).replace('.', ',')}`, mult, points: Math.max(1, Math.round(mult * 20)), color: colors[lvl], weight: 1, actions: [] };
  });
}

// Probabilité de chaque case sur une vraie planche (loi binomiale).
function naturalOdds(rows) {
  const out = [];
  let c = 1;
  for (let k = 0; k <= rows; k += 1) { out.push(c / 2 ** rows); c = (c * (rows - k)) / (k + 1); }
  return out;
}

module.exports = { defaultBins, naturalOdds };

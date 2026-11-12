// Reconnaît un jeu, un rang et une division depuis un nom de dossier ou de fichier.
const norm = (t) => String(t).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '');

const ALIASES = {
  iron: 'fer', silver: 'argent', gold: 'or', platinum: 'platine', diamond: 'diamant', emerald: 'emeraude', master: 'maitre', grandmaster: 'grandmaitre',
  immortal: 'immortel', copper: 'cuivre', ancient: 'ancien', divine: 'divin', legend: 'legende', herald: 'heraut', guardian: 'gardien', crusader: 'croise',
  archon: 'archonte', ash: 'cendres', ashes: 'cendres', celestial: 'celeste', eternity: 'eternite', wood: 'bois', stone: 'pierre', grey: 'gris', gray: 'gris',
  blue: 'bleu', lightblue: 'bleuclair', purple: 'violet', pink: 'rose', red: 'rouge', gc: 'grandchampion', ssl: 'supersoniclegend',
};
const FOLDERS = { rl: 'rocketleague', valo: 'valorant', leagueoflegends: 'lol', cs: 'cs2', csgo: 'cs2', counterstrike: 'cs2' };
const FILLER = new Set(['rank', 'ranks', 'rang', 'rangs', 'ranked', 'tier', 'icon', 'icone', 'logo', 'badge', 'emblem', 'embleme', 'division', 'div']);
const ROMAN = { i: 1, ii: 2, iii: 3, iv: 4, v: 5 };

const findTier = (game, text) => {
  const raw = norm(text);
  const word = ALIASES[raw] || raw;
  return game.ranks.find((t) => norm(t.id) === word || norm(t.name) === word || norm(t.name) === raw);
};

function rankFromFile(game, file) {
  const stem = String(file).replace(/\.[^.]+$/, '');
  const whole = findTier(game, stem);
  if (whole) return { tier: whole.id, division: 0 };
  const skip = new Set([norm(game.id), norm(game.name)]);
  const words = stem.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/([a-z])(\d)/g, '$1 $2').split(/[^a-z0-9]+/).filter((w) => w && !FILLER.has(w) && !skip.has(w) && FOLDERS[w] !== game.id);
  const direct = words.length ? findTier(game, words.join('')) : null;
  if (direct) return { tier: direct.id, division: 0 };
  if (words.length < 2) return null;
  const last = words[words.length - 1];
  const division = ROMAN[last] || (/^\d{1,2}$/.test(last) ? Number(last) : 0);
  const tier = division ? findTier(game, words.slice(0, -1).join('')) : null;
  if (!tier) return null;
  if (!tier.divisions) return { tier: tier.id, division: 0 };
  return division <= tier.divisions ? { tier: tier.id, division } : null;
}

function gameFromFolder(games, folder) {
  const raw = norm(folder);
  const word = FOLDERS[raw] || raw;
  return games.find((g) => norm(g.id) === word || norm(g.name) === word) || null;
}

const rankImage = (images, tier, division) => images?.[`${tier}:${division}`] || images?.[tier] || '';

module.exports = { rankFromFile, gameFromFolder, rankImage };

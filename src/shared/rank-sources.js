// Vrais emblèmes de rang, téléchargés à la demande depuis des sources publiques (jamais livrés dans
// l'installateur : ils appartiennent aux éditeurs). Chaque lien a été vérifié en novembre 2026.
// Clé d'image : « tier » pour l'emblème du rang, « tier:division » quand l'emblème change par division.
'use strict';

const fandom = (wiki, file) => `https://${wiki}.fandom.com/wiki/Special:FilePath/${file}`;
const VAL = (n) => `https://media.valorant-api.com/competitivetiers/03621f52-342b-cf4e-4f86-9350a49c6d04/${n}/largeicon.png`;
const RL = (n) => `https://trackercdn.com/cdn/tracker.gg/rocket-league/ranks/s4-${n}.png`;
const APEX = (f) => `https://api.mozambiquehe.re/assets/ranks/${f}.png`;
const R6 = (f) => `https://trackercdn.com/cdn/r6.tracker.network/ranks/s28/${f}.png`;
const ROMAN = ['I', 'II', 'III', 'IV', 'V'];

// Rang avec divisions : l'emblème du rang = celui de la première division.
const withDivs = (count, urlOf) => {
  const div = {};
  for (let d = 1; d <= count; d += 1) div[d] = urlOf(d);
  return { tier: urlOf(1), div };
};

const SOURCES = {
  valorant: {
    from: 'valorant-api.com (images officielles Riot Games)',
    tiers: {
      fer: withDivs(3, (d) => VAL(2 + d)), bronze: withDivs(3, (d) => VAL(5 + d)), argent: withDivs(3, (d) => VAL(8 + d)),
      or: withDivs(3, (d) => VAL(11 + d)), platine: withDivs(3, (d) => VAL(14 + d)), diamant: withDivs(3, (d) => VAL(17 + d)),
      ascendant: withDivs(3, (d) => VAL(20 + d)), immortel: withDivs(3, (d) => VAL(23 + d)), radiant: VAL(27),
    },
  },
  rocketleague: {
    from: 'tracker.gg (images officielles Psyonix)',
    tiers: {
      bronze: withDivs(3, (d) => RL(d)), argent: withDivs(3, (d) => RL(3 + d)), or: withDivs(3, (d) => RL(6 + d)),
      platine: withDivs(3, (d) => RL(9 + d)), diamant: withDivs(3, (d) => RL(12 + d)), champion: withDivs(3, (d) => RL(15 + d)),
      'grand-champion': withDivs(3, (d) => RL(18 + d)), 'supersonic-legend': RL(22),
    },
  },
  lol: {
    from: 'Wiki League of Legends (emblèmes officiels Riot Games)',
    tiers: Object.fromEntries([['fer', 'Iron'], ['bronze', 'Bronze'], ['argent', 'Silver'], ['or', 'Gold'], ['platine', 'Platinum'], ['emeraude', 'Emerald'],
      ['diamant', 'Diamond'], ['maitre', 'Master'], ['grand-maitre', 'Grandmaster'], ['challenger', 'Challenger']].map(([id, n]) => [id, fandom('leagueoflegends', `Season_2023_-_${n}.png`)])),
  },
  fortnite: {
    from: 'Wiki Fortnite (icônes officielles Epic Games)',
    tiers: {
      ...Object.fromEntries([['bronze', 'Bronze'], ['argent', 'Silver'], ['or', 'Gold'], ['platine', 'Platinum'], ['diamant', 'Diamond']]
        .map(([id, n]) => [id, withDivs(3, (d) => fandom('fortnite', `${n}_${ROMAN[d - 1]}_-_Icon_-_Fortnite.png`))])),
      elite: fandom('fortnite', 'Elite_-_Icon_-_Fortnite.png'), champion: fandom('fortnite', 'Champion_-_Icon_-_Fortnite.png'), unreal: fandom('fortnite', 'Unreal_-_Icon_-_Fortnite.png'),
    },
  },
  apex: {
    from: 'apexlegendsstatus.com (images officielles Respawn)',
    tiers: {
      ...Object.fromEntries([['rookie', 'rookie'], ['bronze', 'bronze'], ['argent', 'silver'], ['or', 'gold'], ['platine', 'platinum'], ['diamant', 'diamond']]
        .map(([id, n]) => [id, { tier: APEX(`${n}4`), div: { 1: APEX(`${n}1`), 2: APEX(`${n}2`), 3: APEX(`${n}3`), 4: APEX(`${n}4`) } }])),
      maitre: APEX('master'), predator: APEX('apexpredator1'),
    },
  },
  r6: {
    from: 'r6.tracker.network (images officielles Ubisoft)',
    tiers: {
      ...Object.fromEntries([['cuivre', 'copper'], ['bronze', 'bronze'], ['argent', 'silver'], ['or', 'gold'], ['platine', 'platinum'], ['emeraude', 'emerald'], ['diamant', 'diamond']]
        .map(([id, n]) => [id, { tier: R6(`${n}-5`), div: Object.fromEntries([1, 2, 3, 4, 5].map((d) => [d, R6(`${n}-${d}`)])) }])),
      champion: R6('champions'),
    },
  },
  cod: {
    from: 'Wiki Call of Duty (emblèmes officiels du mode classé, Activision)',
    tiers: Object.fromEntries([['bronze', 'Bronze'], ['argent', 'Silver'], ['or', 'Gold'], ['platine', 'Platinum'], ['diamant', 'Diamond'], ['crimson', 'Crimson'],
      ['iridescent', 'Iridescent'], ['top-250', 'Top250']].map(([id, n]) => [id, fandom('callofduty', `Season4${n}_Emblem_MWII.png`)])),
  },
  rivals: {
    from: 'Wiki Marvel Rivals (emblèmes officiels NetEase)',
    tiers: Object.fromEntries([['bronze', 'Bronze'], ['argent', 'Silver'], ['or', 'Gold'], ['platine', 'Platinum'], ['diamant', 'Diamond'], ['grand-maitre', 'Grandmaster'],
      ['celeste', 'Celestial'], ['eternite', 'Eternity'], ['one-above-all', 'One_Above_All']].map(([id, n]) => [id, fandom('marvelrivals', `${n}_Rank.png`)])),
  },
  dbd: {
    from: 'Wiki Dead by Daylight (grades officiels Behaviour)',
    tiers: Object.fromEntries([['cendres', 'Ash'], ['bronze', 'Bronze'], ['argent', 'Silver'], ['or', 'Gold'], ['iridescent', 'Iridescent']].map(([id, n]) => [id, fandom('deadbydaylight', `IconGrade_survivor${n}.png`)])),
  },
  overwatch: {
    from: 'Wiki Overwatch (insignes officiels Blizzard)',
    tiers: Object.fromEntries([['bronze', '1_Bronze'], ['argent', '2_Silver'], ['or', '3_Gold'], ['platine', '4_Platinum'], ['diamant', '5_Diamond'], ['maitre', '6_Master'],
      ['grand-maitre', '7_Grandmaster'], ['champion', '8_Champion'], ['top-500', '9_Top_500']].map(([id, n]) => [id, fandom('overwatch', `Badge_${n}.png`)])),
  },
  dota2: {
    from: 'OpenDota (médailles officielles Valve)',
    tiers: Object.fromEntries(['heraut', 'gardien', 'croise', 'archonte', 'legende', 'ancien', 'divin', 'immortel'].map((id, i) => [id, `https://www.opendota.com/assets/images/dota2/rank_icons/rank_icon_${i + 1}.png`])),
  },
  minecraft: {
    from: 'Minecraft Wiki (textures officielles Mojang)',
    tiers: Object.fromEntries([['bois', 'Wooden_Pickaxe_JE3_BE3'], ['pierre', 'Stone_Pickaxe_JE2_BE2'], ['fer', 'Iron_Pickaxe_JE3_BE2'], ['or', 'Golden_Pickaxe_JE4_BE3'],
      ['diamant', 'Diamond_Pickaxe_JE3_BE3'], ['netherite', 'Netherite_Pickaxe_JE3_BE2']].map(([id, f]) => [id, `https://minecraft.wiki/images/${f}.png`])),
  },
};

// Counter-Strike 2 n'a pas d'emblème : le classement Premier s'affiche dans une plaque de couleur.
// Régie dessine ces plaques aux couleurs du jeu.
const CS2 = { gris: ['#B0C3D9', '#6E7F92'], 'bleu-clair': ['#8CC6FF', '#4B8FD6'], bleu: ['#6A7DFF', '#3446C9'], violet: ['#C166FF', '#7D2FC4'], rose: ['#F25CE3', '#B21FA3'], rouge: ['#EB4B4B', '#A81F2B'], or: ['#FFD700', '#C99A12'] };
const CS2_LABEL = { gris: '< 5 000', 'bleu-clair': '5 000', bleu: '10 000', violet: '15 000', rose: '20 000', rouge: '25 000', or: '30 000+' };
function cs2Plate(tier) {
  const [a, b] = CS2[tier] || CS2.gris;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 120"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs>`
    + '<path d="M34 18h190l-18 84H16z" fill="#0E1116" opacity=".55" transform="translate(4 6)"/>'
    + '<path d="M34 18h190l-18 84H16z" fill="url(#g)"/><path d="M34 18h190l-3 14H31z" fill="#fff" opacity=".28"/>'
    + '<path d="M22 22h8l-17 80H5zM8 22h6L-3 102h-6z" fill="url(#g)" opacity=".8" transform="translate(6 -4)"/>'
    + `<text x="122" y="74" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="34" font-weight="800" font-style="italic" fill="#fff" stroke="#000" stroke-opacity=".25" stroke-width="2" paint-order="stroke">${CS2_LABEL[tier] || ''}</text></svg>`;
}

const hasOfficial = (gameId) => Boolean(SOURCES[gameId]) || gameId === 'cs2';

module.exports = { SOURCES, cs2Plate, hasOfficial };

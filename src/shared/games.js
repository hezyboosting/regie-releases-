// Catalogue des jeux. Les noms de rangs sont des informations publiques ; les blasons affichés sont dessinés par Régie.
const ROMAN = ['I', 'II', 'III', 'IV'];

// tiers : [nom, couleur, poids de rareté pour Follow = Rank]
const ladder = (tiers, divisions = 0, desc = false) => tiers.map(([name, color, weight, noDiv]) => ({
  id: name.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-'), name, color, weight, divisions: noDiv ? 0 : divisions, desc,
}));

const sidesOf = (id) => 5 + ([...id].reduce((n, c) => n + c.charCodeAt(0), 0) % 4);

const G = (id, name, opts) => ({ id, name, sides: sidesOf(id), genre: opts.genre, exe: opts.exe || [], modes: opts.modes || [['classe', 'Classé']], ranks: opts.ranks || [], live: opts.live || null, metric: opts.metric || 'MMR', stats: opts.stats || ['wins', 'losses'], widgets: opts.widgets || [] });

const GAMES = [
  G('rocketleague', 'Rocket League', {
    genre: 'Sport', exe: ['RocketLeague.exe'], live: 'rl', metric: 'MMR', stats: ['wins', 'losses', 'goals', 'assists', 'saves', 'demos'], modes: [['1v1', 'Duel 1v1'], ['2v2', 'Double 2v2'], ['3v3', 'Standard 3v3']],
    ranks: ladder([['Bronze', '#C7814F', 30], ['Argent', '#B9C4D0', 26], ['Or', '#FFC53D', 20], ['Platine', '#57E0D6', 14], ['Diamant', '#57B8FF', 8], ['Champion', '#B77DFF', 4], ['Grand Champion', '#FF4D6D', 2], ['Supersonic Legend', '#FFFFFF', 1, true]], 3),
  }),
  G('valorant', 'Valorant', {
    genre: 'FPS', exe: ['VALORANT-Win64-Shipping.exe'], metric: 'RR', stats: ['wins', 'losses', 'kills', 'deaths', 'assists'], modes: [['ranked', 'Compétitif']],
    ranks: ladder([['Fer', '#8A8D91', 24], ['Bronze', '#A9764B', 24], ['Argent', '#BFC8D2', 20], ['Or', '#E5B94A', 14], ['Platine', '#3EC6C9', 9], ['Diamant', '#C58BF5', 5], ['Ascendant', '#3FD08F', 3], ['Immortel', '#E54B6A', 2], ['Radiant', '#FFE08A', 1, true]], 3),
  }),
  G('lol', 'League of Legends', {
    genre: 'MOBA', exe: ['League of Legends.exe'], live: 'lol', metric: 'LP', stats: ['wins', 'losses', 'kills', 'deaths', 'assists'], modes: [['solo', 'Solo/Duo'], ['flex', 'Flex']],
    ranks: ladder([['Fer', '#7A7472', 22], ['Bronze', '#9C6A4A', 22], ['Argent', '#AEB8C2', 20], ['Or', '#D6AE4F', 14], ['Platine', '#4CB7A5', 9], ['Émeraude', '#3BBF7C', 6], ['Diamant', '#6C8CF5', 4], ['Maître', '#B15CE0', 1, true], ['Grand Maître', '#E2554D', 1, true], ['Challenger', '#F4DA6D', 1, true]], 4, true),
  }),
  G('fortnite', 'Fortnite', {
    genre: 'Battle royale', exe: ['FortniteClient-Win64-Shipping.exe'], metric: 'Progression', stats: ['wins', 'matches', 'kills', 'deaths'], modes: [['battle', 'Battle Royale classé'], ['zero', 'Zero Build classé']],
    ranks: ladder([['Bronze', '#B07F52', 28], ['Argent', '#B8C2CC', 24], ['Or', '#E8BC49', 18], ['Platine', '#5BC6E8', 12], ['Diamant', '#6F8CFF', 8], ['Élite', '#C86BFA', 5, true], ['Champion', '#FF7A45', 3, true], ['Unreal', '#FF4FA3', 1, true]], 3),
  }),
  G('cs2', 'Counter-Strike 2', {
    genre: 'FPS', exe: ['cs2.exe'], live: 'cs2', metric: 'Score', stats: ['wins', 'losses', 'kills', 'deaths', 'assists', 'mvps'], modes: [['premier', 'Premier'], ['competitive', 'Compétitif']],
    ranks: ladder([['Gris', '#B7BDC6', 30, true], ['Bleu clair', '#79C1F2', 26, true], ['Bleu', '#4C7DF0', 18, true], ['Violet', '#8E5CF0', 12, true], ['Rose', '#E45CE0', 8, true], ['Rouge', '#EB4B4B', 4, true], ['Or', '#FFD24A', 2, true]]),
  }),
  G('apex', 'Apex Legends', {
    genre: 'Battle royale', exe: ['r5apex.exe', 'r5apex_dx12.exe'], metric: 'RP', stats: ['wins', 'matches', 'kills', 'deaths'], modes: [['ranked', 'Classé']],
    ranks: ladder([['Rookie', '#9B8E7E', 28], ['Bronze', '#A9764B', 24], ['Argent', '#B8C2CC', 20], ['Or', '#E8BC49', 13], ['Platine', '#4FC3D9', 8], ['Diamant', '#6FA8FF', 4], ['Maître', '#B46BFF', 2, true], ['Predator', '#E5413B', 1, true]], 4, true),
  }),
  G('cod', 'Call of Duty', {
    genre: 'FPS', exe: ['cod.exe', 'cod24-cod.exe', 'cod25-cod.exe', 'BlackOps6.exe', 'BlackOpsColdWar.exe'], metric: 'SR', stats: ['wins', 'losses', 'kills', 'deaths'], modes: [['ranked', 'Classé'], ['warzone', 'Warzone classé']],
    ranks: ladder([['Bronze', '#A9764B', 28], ['Argent', '#B8C2CC', 24], ['Or', '#E8BC49', 18], ['Platine', '#58C9C0', 12], ['Diamant', '#6FA8FF', 8], ['Crimson', '#D33A4F', 5], ['Iridescent', '#D874F0', 3, true], ['Top 250', '#FFD24A', 1, true]], 3),
  }),
  G('r6', 'Rainbow Six Siege', {
    genre: 'FPS', exe: ['RainbowSix.exe', 'RainbowSix_BE.exe', 'RainbowSix_Vulkan.exe'], metric: 'RP', stats: ['wins', 'losses', 'kills', 'deaths'], modes: [['ranked', 'Classé']],
    ranks: ladder([['Cuivre', '#B5653A', 24], ['Bronze', '#A9764B', 24], ['Argent', '#B8C2CC', 20], ['Or', '#E8BC49', 14], ['Platine', '#4FC3D9', 9], ['Émeraude', '#3BBF7C', 5], ['Diamant', '#B46BFF', 3], ['Champion', '#E5413B', 1, true]], 5, true),
  }),
  G('rivals', 'Marvel Rivals', {
    genre: 'Hero shooter', exe: ['Marvel-Win64-Shipping.exe', 'MarvelRivals.exe'], metric: 'SR', stats: ['wins', 'losses', 'kills', 'deaths', 'assists'], modes: [['ranked', 'Compétitif']],
    ranks: ladder([['Bronze', '#A9764B', 26], ['Argent', '#B8C2CC', 24], ['Or', '#E8BC49', 18], ['Platine', '#4FC3D9', 12], ['Diamant', '#6FA8FF', 8], ['Grand Maître', '#B46BFF', 5], ['Céleste', '#FF8A5C', 3], ['Éternité', '#E5413B', 2, true], ['One Above All', '#FFD24A', 1, true]], 3, true),
  }),
  G('dbd', 'Dead by Daylight', {
    genre: 'Survie', exe: ['DeadByDaylight-Win64-Shipping.exe'], metric: 'Pips', stats: ['escapes', 'matches', 'sacrifices'], modes: [['survivor', 'Survivant'], ['killer', 'Tueur']],
    ranks: ladder([['Cendres', '#8C8378', 34], ['Bronze', '#A9764B', 28], ['Argent', '#B8C2CC', 20], ['Or', '#E8BC49', 12], ['Iridescent', '#E56BD8', 6]], 4, true),
  }),
  G('overwatch', 'Overwatch 2', {
    genre: 'Hero shooter', exe: ['Overwatch.exe'], metric: 'SR', stats: ['wins', 'losses', 'kills', 'deaths'], modes: [['tank', 'Tank'], ['dps', 'Dégâts'], ['support', 'Soutien']],
    ranks: ladder([['Bronze', '#A9764B', 26], ['Argent', '#B8C2CC', 24], ['Or', '#E8BC49', 18], ['Platine', '#4FC3D9', 12], ['Diamant', '#6FA8FF', 8], ['Maître', '#3BBF7C', 5], ['Grand Maître', '#B46BFF', 3], ['Champion', '#E5413B', 2], ['Top 500', '#FFD24A', 1, true]], 5, true),
  }),
  G('dota2', 'Dota 2', {
    genre: 'MOBA', exe: ['dota2.exe'], metric: 'MMR', stats: ['wins', 'losses', 'kills', 'deaths', 'assists'], modes: [['ranked', 'Classé']],
    ranks: ladder([['Héraut', '#7E8B6A', 22], ['Gardien', '#8C8378', 22], ['Croisé', '#4FC3D9', 20], ['Archonte', '#3BBF7C', 14], ['Légende', '#E8BC49', 10], ['Ancien', '#E57F3C', 7], ['Divin', '#B46BFF', 4], ['Immortel', '#E5413B', 1, true]], 5),
  }),
  G('fc', 'EA Sports FC', {
    genre: 'Sport', exe: ['FC25.exe', 'FC26.exe', 'FC27.exe'], metric: 'Points', stats: ['wins', 'draws', 'losses', 'goals'], modes: [['rivals', 'Division Rivals'], ['ut', 'Champions']],
    ranks: ladder([['Division 10', '#9B8E7E', 22, true], ['Division 8', '#A9764B', 22, true], ['Division 6', '#B8C2CC', 20, true], ['Division 4', '#E8BC49', 16, true], ['Division 2', '#4FC3D9', 10, true], ['Division 1', '#6FA8FF', 6, true], ['Élite', '#E5413B', 2, true]]),
  }),
  G('minecraft', 'Minecraft', {
    genre: 'Bac à sable', exe: ['javaw.exe', 'Minecraft.Windows.exe'], metric: 'Niveau', stats: ['deaths', 'kills'], modes: [['survie', 'Survie']],
    ranks: ladder([['Bois', '#A5794A', 30], ['Pierre', '#9A9A9A', 26], ['Fer', '#D0D0D0', 20], ['Or', '#F2D04A', 12], ['Diamant', '#57E0D6', 8], ['Netherite', '#5B4B5E', 3]]),
  }),
  G('gta', 'GTA RP', {
    genre: 'Roleplay', exe: ['GTA5.exe', 'FiveM.exe', 'GTA5_Enhanced.exe'], metric: 'Niveau', stats: ['arrests', 'deaths'], modes: [['rp', 'Roleplay']],
    ranks: ladder([['Civil', '#B8C2CC', 40], ['Recrue', '#E8BC49', 26], ['Lieutenant', '#6FA8FF', 16], ['Boss', '#B46BFF', 8], ['Parrain', '#E5413B', 2]]),
  }),
  G('chatting', 'Discussion', { genre: 'Sans jeu', stats: ['topics'], modes: [['live', 'Live']], ranks: ladder([['Nouveau', '#B8C2CC', 40], ['Habitué', '#6FA8FF', 30], ['Fidèle', '#B46BFF', 18], ['Légende du chat', '#FFD24A', 4]]) }),
  G('custom', 'Autre jeu', { genre: 'Personnalisé', stats: ['wins', 'losses', 'kills', 'deaths'], modes: [['classe', 'Classé']], ranks: ladder([['Rang 1', '#B8C2CC', 40], ['Rang 2', '#E8BC49', 30], ['Rang 3', '#6FA8FF', 18], ['Rang 4', '#B46BFF', 8], ['Rang 5', '#E5413B', 2]]) }),
];

const STAT_LABEL = {
  wins: 'Victoires', losses: 'Défaites', draws: 'Nuls', kills: 'Kills', deaths: 'Morts', assists: 'Assists', goals: 'Buts', saves: 'Arrêts', demos: 'Démolitions', matches: 'Parties',
  mvps: 'MVP', escapes: 'Fuites', sacrifices: 'Sacrifices', arrests: 'Arrestations', topics: 'Sujets',
};

const gameById = (id) => GAMES.find((g) => g.id === id) || GAMES[GAMES.length - 1];

// Rangs complets, divisions comprises, du plus bas au plus haut.
function fullLadder(game) {
  const out = [];
  game.ranks.forEach((t, tierIndex) => {
    const n = t.divisions || 1;
    // Selon le jeu, on monte de I à III, ou de IV à I.
    for (let i = 1; i <= n; i += 1) {
      const d = t.desc ? n + 1 - i : i;
      out.push({ tier: t.id, tierIndex, name: t.divisions ? `${t.name} ${ROMAN[d - 1] || d}` : t.name, color: t.color, division: t.divisions ? d : 0 });
    }
  });
  return out;
}

const rankLabel = (game, tierId, division) => {
  const t = game.ranks.find((x) => x.id === tierId) || game.ranks[0];
  if (!t) return '';
  return t.divisions ? `${t.name} ${ROMAN[(division || 1) - 1] || division}` : t.name;
};

function nextRank(game, tierId, division) {
  const all = fullLadder(game);
  const i = all.findIndex((r) => r.tier === tierId && (!r.division || r.division === (division || 1)));
  return i >= 0 && i < all.length - 1 ? all[i + 1] : null;
}

const rankScore = (game, tierId, division) => fullLadder(game).findIndex((r) => r.tier === tierId && (!r.division || r.division === (division || 1)));

// Ce que le blason doit montrer : place du rang dans le jeu et division atteinte.
const rankLook = (game, tierId, division = 0) => {
  const step = Math.max(0, game.ranks.findIndex((t) => t.id === tierId));
  const tier = game.ranks[step];
  const divisions = tier?.divisions || 0;
  const d = Math.min(divisions, division || 1);
  return { step, steps: game.ranks.length, divisions, pips: divisions ? (tier.desc ? divisions - d + 1 : d) : 0, sides: game.sides };
};

module.exports = { GAMES, STAT_LABEL, gameById, fullLadder, rankLabel, nextRank, rankScore, rankLook };

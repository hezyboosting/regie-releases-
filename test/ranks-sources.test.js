const test = require('node:test');
const assert = require('node:assert');
const { GAMES } = require('../src/shared/games');
const { SOURCES, cs2Plate, hasOfficial } = require('../src/shared/rank-sources');

test('chaque emblème officiel correspond à un vrai rang du jeu', () => {
  for (const [gameId, src] of Object.entries(SOURCES)) {
    const game = GAMES.find((g) => g.id === gameId);
    assert.ok(game, gameId);
    for (const [tier, v] of Object.entries(src.tiers)) {
      const t = game.ranks.find((r) => r.id === tier);
      assert.ok(t, `${gameId}/${tier}`);
      const urls = typeof v === 'string' ? [v] : [v.tier, ...Object.values(v.div || {})];
      for (const u of urls) assert.match(u, /^https:\/\//);
      if (typeof v !== 'string') for (const d of Object.keys(v.div || {})) assert.ok(Number(d) >= 1 && Number(d) <= t.divisions, `${gameId}/${tier}:${d}`);
    }
  }
});

test('Counter-Strike 2 : plaques dessinées pour chaque rang', () => {
  assert.ok(hasOfficial('cs2'));
  for (const r of GAMES.find((g) => g.id === 'cs2').ranks) assert.match(cs2Plate(r.id), /^<svg/);
});

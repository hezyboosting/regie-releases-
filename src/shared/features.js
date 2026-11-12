// Matrice FREE / PRO / ULTIMATE. L'admin peut la modifier et la diffuser (voir main/roles.js).
// Valeur numérique : limite (-1 = illimité). Valeur booléenne : accès.
const F = (group, label, free, pro, ultimate = pro) => ({ group, label, free, pro, ultimate });

const FEATURES = {
  channelsPerPlatform: F('Multistream', 'Chaînes par plateforme', 1, 2, -1),
  replyAllChannels: F('Multistream', 'Répondre sur toutes les chaînes en même temps', false, false, true),

  customOverlays: F('Overlays', 'Overlays personnalisés enregistrés', 2, -1),
  overlaysTotal: F('Overlays', 'Overlays standards', -1, -1),
  overlayThemes: F('Overlays', 'Thèmes Premium et alertes animées', false, true),
  overlayVersions: F('Overlays', 'Versions d\'un même overlay', false, true),
  removeWatermark: F('Overlays', 'Retirer la signature Régie', false, true),
  customCss: F('Overlays', 'CSS personnalisé', false, true),
  customMedia: F('Overlays', 'Images, vidéos et sons importés', true, true),
  premiumTemplates: F('Overlays', 'Bibliothèque premium', false, true),
  customTransitions: F('Overlays', 'Transitions personnalisées', false, true),

  gamepadAllLayouts: F('Manettes', 'Tous les modèles de manette', true, true),
  gamepadCustom: F('Manettes', 'Finitions et coloris', true, true),
  gamepadSkin: F('Manettes', 'Photo de ta manette avec zones', false, true),

  gameProfiles: F('Jeux', 'Profils de jeux enregistrés', 3, -1),
  gameLive: F('Jeux', 'Données de match en direct', false, true),
  rankRoulette: F('Jeux', 'Follow = Rank en roulette', false, true),
  rcon: F('Jeux', 'Actions dans Minecraft', false, true),
  keystrokes: F('Jeux', 'Touches simulées', true, true),

  alertRulesCustom: F('Alertes', 'Paliers par montant ou cadeau', false, true),
  alertVariants: F('Alertes', 'Alertes aléatoires, rareté et combos', false, true),

  commands: F('Automatisations', 'Commandes de chat', 10, -1),
  triggers: F('Automatisations', 'Automatisations', 5, 25, -1),
  automationAdvanced: F('Automatisations', 'Conditions multiples et délais', false, true),
  obsActions: F('Automatisations', 'Actions OBS', true, true),
  giftTriggers: F('Automatisations', 'Actions par cadeau', true, true),
  webhooks: F('Automatisations', 'Webhooks', false, false, true),
  deckButtons: F('Automatisations', 'Boutons du Stream Deck', 8, -1),
  deckPhone: F('Automatisations', 'Stream Deck sur téléphone', false, true),

  goals: F('Classements', 'Goals actifs', 3, -1),
  leaderboardPeriods: F('Classements', 'Classements jour, semaine et mois', false, true),

  battleAllModes: F('Interactions', 'Tous les modes de battle', true, true),
  bossBattle: F('Interactions', 'Boss Battle', false, true),
  miniGames: F('Interactions', 'Devinette, quiz et roulette', false, true),
  subathon: F('Interactions', 'Giftathon et subathon', true, true),
  giveaway: F('Interactions', 'Giveaways', false, true),
  polls: F('Interactions', 'Sondages multi-chaînes', false, true),

  ttsAllVoices: F('Audio', 'Toutes les voix (sinon une par langue)', false, true),
  ttsPremiumVoices: F('Audio', 'Voix ElevenLabs', false, true),
  ttsPerUserVoice: F('Audio', 'Une voix par spectateur', false, true),
  spotifyThemes: F('Audio', 'Thèmes Platine, Cassette, VU et Bandeau', false, true),
  spotifyReactive: F('Audio', 'Réaction au son du PC', false, true),
  songRequests: F('Audio', 'Demandes de musique par le chat', false, true),

  statsDays: F('Stats', 'Historique des stats (jours)', 7, 90, -1),
  statsExport: F('Stats', 'Export des stats', false, true),
  liveCompare: F('Stats', 'Comparaison entre plusieurs lives', false, false, true),

  aiOverlays: F('IA et clips', 'Création par IA', false, false, true),
  aiAssistant: F('IA et clips', 'Assistant de stream', false, false, true),
  clipsStudio: F('IA et clips', 'Studio de clips', false, false, true),
};

const TIERS = ['free', 'pro', 'ultimate'];
const norm = (role) => (role === 'premium' ? 'pro' : role);

function resolveFeatures(role, overrides = {}) {
  const r = norm(role);
  const out = {};
  for (const [key, def] of Object.entries(FEATURES)) {
    const ov = overrides[key] || {};
    const pick = (t) => (ov[t] !== undefined ? ov[t] : t === 'pro' && ov.premium !== undefined ? ov.premium : def[t]);
    if (r === 'admin') out[key] = typeof def.ultimate === 'number' ? -1 : true;
    else out[key] = pick(TIERS.includes(r) ? r : 'free');
  }
  return out;
}

const withinLimit = (limit, used) => limit === -1 || used < limit;

module.exports = { FEATURES, TIERS, resolveFeatures, withinLimit };

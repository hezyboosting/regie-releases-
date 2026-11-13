// Thèmes de jeu : une palette appliquée d'un coup à tous les overlays.
// fx : effets communs posés en même temps (halo, contour…) ; un thème sans fx les remet à zéro.
const NO_FX = { fxGlow: 0, fxOutline: 0, fxShadow: 0, fxHue: 0, fxSat: 100, fxBright: 100, fxParticles: 'none' };
const theme = (id, name, font, accent, bg, text, extra = {}, fx = {}, season = null) => ({
  id, name, font, swatch: [accent, bg, text], season,
  colors: { accent, bg, text, track: '#FFFFFF', nameColor: accent, pressed: accent, key: bg, legend: text, legendPressed: bg, body: bg, body2: bg, button: accent, mod: bg, accentKey: accent, case: bg, buttons: bg, rim: bg, light: accent, ...extra },
  fx: { ...NO_FX, ...fx },
});

const THEMES = [
  theme('verre', 'Verre', 'onest', '#8FD3FF', '#10131A', '#F2F5F9'),
  theme('clair', 'Verre clair', 'onest', '#2B6CB0', '#F2F5F9', '#14171D'),
  theme('ambre', 'Ambre', 'onest', '#F3D38A', '#17130B', '#FBF5E6'),
  theme('sauge', 'Sauge', 'onest', '#9FE3C4', '#0E1714', '#EEF7F2'),
  theme('lilas', 'Lilas', 'onest', '#C9B8FF', '#13111C', '#F4F1FC'),
  theme('corail', 'Corail', 'onest', '#FFB3A6', '#1A1110', '#FDF1EE'),
  theme('neon', 'Néon', 'syne', '#39FF88', '#07080D', '#EFFFF6', {}, { fxGlow: 14, fxGlowColor: '#39FF88' }),
  theme('cyber', 'Cyber rose', 'archivo', '#FF2E88', '#0B0614', '#FFE9F4', { nameColor: '#2EE6FF' }, { fxGlow: 10, fxGlowColor: '#FF2E88' }),
  theme('or', 'Noir et or', 'serif', '#E9C46A', '#0D0B07', '#FFF7E0', {}, { fxShadow: 18 }),
  theme('blanc', 'Blanc pur', 'geist', '#111318', '#FFFFFF', '#111318', { key: '#F4F4F2', case: '#E6E6E3', body: '#F4F4F2', buttons: '#F4F4F2' }, { fxShadow: 14, fxShadowColor: '#00000055' }),
  theme('arcade', 'Arcade', 'impact', '#FFD23F', '#1B1035', '#FFFFFF', { nameColor: '#FF6B6B' }, { fxOutline: 2, fxOutlineColor: '#000000' }),
  theme('tiktok', 'TikTok', 'onest', '#FE2C55', '#121212', '#FFFFFF', { nameColor: '#25F4EE' }),
  theme('twitch', 'Twitch', 'onest', '#9146FF', '#18181B', '#EFEFF1', { nameColor: '#BF94FF' }),
  theme('kick', 'Kick', 'archivo', '#53FC18', '#0B0E0F', '#FFFFFF', {}, { fxGlow: 6, fxGlowColor: '#53FC18' }),
  theme('youtube', 'YouTube', 'onest', '#FF0033', '#0F0F0F', '#FFFFFF'),
  // Thèmes de saison : couleurs et particules qui tombent derrière les textes. season = [mois de début, mois de fin].
  theme('halloween', 'Halloween', 'archivo', '#FF7A1A', '#120A16', '#FFF1E6', { nameColor: '#B66BFF' }, { fxGlow: 10, fxGlowColor: '#FF7A1A', fxParticles: 'citrouilles' }, [10, 10]),
  theme('noel', 'Noël', 'serif', '#E63946', '#0C1A14', '#FFF8F0', { nameColor: '#F1C27D' }, { fxShadow: 12, fxParticles: 'neige' }, [12, 12]),
  theme('hiver', 'Hiver', 'onest', '#A8DAFF', '#0B1220', '#F1F7FF', {}, { fxGlow: 8, fxGlowColor: '#A8DAFF', fxParticles: 'neige' }, [1, 2]),
  theme('valentin', 'Saint-Valentin', 'onest', '#FF5C8A', '#1A0B12', '#FFF0F5', { nameColor: '#FFB3C7' }, { fxGlow: 8, fxGlowColor: '#FF5C8A', fxParticles: 'coeurs' }, [2, 2]),
  theme('printemps', 'Printemps', 'onest', '#FFB7D5', '#10170F', '#F6FFF2', { nameColor: '#9BE38A' }, { fxParticles: 'petales' }, [3, 5]),
  theme('ete', 'Été', 'archivo', '#FFC93C', '#06202B', '#FFFDF2', { nameColor: '#3ED6C6' }, { fxShadow: 10, fxParticles: 'soleil' }, [6, 8]),
  theme('automne', 'Automne', 'serif', '#E07A2E', '#1A120B', '#FFF4E8', { nameColor: '#F2B134' }, { fxParticles: 'feuilles' }, [9, 11]),
  theme('nouvelan', 'Nouvel an', 'geist', '#F5D76E', '#0A0A12', '#FFFFFF', { nameColor: '#C9B8FF' }, { fxGlow: 12, fxGlowColor: '#F5D76E', fxParticles: 'confettis' }, [12, 1]),
];

module.exports = { THEMES };

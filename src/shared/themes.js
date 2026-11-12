// Thèmes de jeu : une palette appliquée d'un coup à tous les overlays.
const theme = (id, name, font, accent, bg, text, extra = {}) => ({
  id, name, font, swatch: [accent, bg, text],
  colors: { accent, bg, text, track: '#FFFFFF', nameColor: accent, pressed: accent, key: bg, legend: text, legendPressed: bg, body: bg, body2: bg, button: accent, ...extra },
});

const THEMES = [
  theme('verre', 'Verre', 'onest', '#8FD3FF', '#10131A', '#F2F5F9'),
  theme('clair', 'Verre clair', 'onest', '#2B6CB0', '#F2F5F9', '#14171D'),
  theme('ambre', 'Ambre', 'onest', '#F3D38A', '#17130B', '#FBF5E6'),
  theme('sauge', 'Sauge', 'onest', '#9FE3C4', '#0E1714', '#EEF7F2'),
  theme('lilas', 'Lilas', 'onest', '#C9B8FF', '#13111C', '#F4F1FC'),
  theme('corail', 'Corail', 'onest', '#FFB3A6', '#1A1110', '#FDF1EE'),
];

module.exports = { THEMES };

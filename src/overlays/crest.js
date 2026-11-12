// Blasons Régie : une gemme taillée par le code, qui gagne en éclat à chaque rang.
// Aucun dessin de jeu n'est repris. Chaque jeu a sa coupe, chaque rang ajoute une pièce.
const HEX = /^#[0-9a-f]{6}$/i;
const LIGHT = -2.15;
let count = 0;

const channels = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const mix = (hex, to, t) => `rgb(${channels(hex).map((c) => Math.round(c + (to - c) * t)).join(',')})`;
const at = (r, a) => [50 + r * Math.cos(a), 50 + r * Math.sin(a)];
const ring = (n, r, turn = 0) => Array.from({ length: n }, (_, i) => at(r, -Math.PI / 2 + ((i + turn) * 2 * Math.PI) / n));
const points = (list) => list.map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`).join(' ');

// Chaque facette prend la lumière selon son orientation.
function facet(tri, base, spark) {
  const x = tri.reduce((n, p) => n + p[0], 0) / 3 - 50;
  const y = tri.reduce((n, p) => n + p[1], 0) / 3 - 50;
  const lit = Math.cos(Math.atan2(y, x) - LIGHT) + spark;
  const shade = lit > 0 ? mix(base, 255, Math.min(0.78, lit * 0.56)) : mix(base, 0, Math.min(0.62, -lit * 0.46));
  return `<polygon points="${points(tri)}" fill="${shade}" stroke="${shade}" stroke-width=".35"/>`;
}

function stone(base, sides, R) {
  const outer = ring(sides, R);
  const girdle = ring(sides, R * 0.76, 0.5);
  const table = ring(sides, R * 0.47);
  const parts = [];
  for (let i = 0; i < sides; i += 1) {
    const j = (i + 1) % sides;
    parts.push(facet([outer[i], outer[j], girdle[i]], base, 0.1));
    parts.push(facet([girdle[i], girdle[j], outer[j]], base, -0.12));
    parts.push(facet([girdle[i], girdle[j], table[j]], base, 0.26));
    parts.push(facet([table[i], table[j], girdle[i]], base, 0.02));
  }
  return { facets: parts.join(''), table: points(table), edge: points(outer) };
}

export function crest({ color = '#8FD3FF', step = 0, steps = 1, pips = 0, divisions = 0, sides = 6, size = 96 } = {}) {
  const base = HEX.test(color) ? color : '#8FD3FF';
  const p = steps > 1 ? Math.max(0, Math.min(1, step / (steps - 1))) : 0.5;
  count += 1;
  const id = `crest${count}`;
  const R = 25 + p * 7;
  const gem = stone(base, sides, R);
  const out = [`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="${size}" height="${size}" class="emblem" aria-hidden="true"><defs>`];
  out.push(`<radialGradient id="${id}a"><stop offset="0" stop-color="${mix(base, 255, 0.25)}" stop-opacity="${(0.22 + p * 0.5).toFixed(2)}"/><stop offset="1" stop-color="${base}" stop-opacity="0"/></radialGradient>`);
  out.push(`<linearGradient id="${id}b" x1=".1" y1="0" x2=".9" y2="1"><stop offset="0" stop-color="${mix(base, 255, 0.82)}"/><stop offset=".42" stop-color="${mix(base, 0, 0.4)}"/><stop offset=".7" stop-color="${mix(base, 255, 0.32)}"/><stop offset="1" stop-color="${mix(base, 0, 0.66)}"/></linearGradient>`);
  out.push(`<linearGradient id="${id}c" x1=".15" y1="0" x2=".8" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".95"/><stop offset=".5" stop-color="${mix(base, 255, 0.5)}" stop-opacity=".65"/><stop offset="1" stop-color="${mix(base, 255, 0.12)}" stop-opacity=".5"/></linearGradient></defs>`);
  out.push(`<circle cx="50" cy="48" r="49" fill="url(#${id}a)"/>`);

  // Les pièces qui s'ajoutent en montant : rayons, couronne, orbite.
  const crown = p >= 0.84;
  if (p >= 0.5) {
    const count2 = sides * 2;
    const tips = ring(count2, R + (crown ? 19 : 14));
    const feet = ring(count2 * 2, R + 6.5, 0.5);
    for (let i = 0; i < count2; i += 1) {
      const long = i % 2 === 0;
      const tip = long ? tips[i] : ring(count2, R + (crown ? 13 : 10.5))[i];
      out.push(`<polygon points="${points([feet[(i * 2 + count2 * 2 - 1) % (count2 * 2)], tip, feet[i * 2]])}" fill="url(#${id}b)" opacity="${long ? 1 : 0.8}"/>`);
    }
  }
  if (p >= 0.67) out.push(`<circle cx="50" cy="50" r="${(R + 11.5).toFixed(1)}" fill="none" stroke="url(#${id}b)" stroke-width="1.5"/>`);
  if (crown) {
    for (const [x, y] of ring(sides, R + 11.5, 0.5)) out.push(`<circle cx="${x.toFixed(2)}" cy="${y.toFixed(2)}" r="2.3" fill="#fff"/><circle cx="${x.toFixed(2)}" cy="${y.toFixed(2)}" r="3.4" fill="none" stroke="${mix(base, 255, 0.4)}" stroke-width=".7"/>`);
  }

  // Monture puis pierre.
  out.push(`<polygon points="${points(ring(sides, R + 6.5))}" fill="url(#${id}b)"/>`);
  out.push(`<polygon points="${points(ring(sides, R + 2.6))}" fill="${mix(base, 0, 0.72)}"/>`);
  if (p >= 0.2) for (const [x, y] of ring(sides, R + 4.5, 0)) out.push(`<circle cx="${x.toFixed(2)}" cy="${y.toFixed(2)}" r="1.25" fill="${mix(base, 255, 0.78)}"/>`);
  out.push(gem.facets);
  out.push(`<polygon points="${gem.table}" fill="url(#${id}c)"/>`);
  out.push(`<polygon points="${gem.edge}" fill="none" stroke="#fff" stroke-opacity=".45" stroke-width=".7"/>`);
  const [sx, sy] = at(R * 0.38, LIGHT);
  out.push(`<path d="M${sx.toFixed(1)} ${(sy - 6).toFixed(1)}q.8 5.200 6 6q-5.200 .8-6 6q-.8-5.200-6-6q5.200-.8 6-6Z" fill="#fff" opacity=".95"/>`);

  // Divisions : une petite perle allumée par palier.
  for (let i = 0; i < divisions; i += 1) {
    const t = divisions > 1 ? i / (divisions - 1) : 0.5;
    const x = 50 + (t - 0.5) * (divisions - 1) * 9.5;
    const y = 95 - Math.abs(t - 0.5) * 3;
    out.push(`<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="2.7" fill="${i < pips ? mix(base, 255, 0.35) : 'rgba(255,255,255,.14)'}" stroke="rgba(255,255,255,.55)" stroke-width=".6"/>`);
  }
  out.push('</svg>');
  return out.join('');
}

// Modèles de manette en calques : nommer, associer et décrire les pièces d'un fichier importé.
// Aucun visuel n'est livré ici : un modèle vient toujours de l'utilisateur, avec ses droits.
const PACK_PARTS = [
  ['shell', 'Coque', ['shell', 'body', 'coque', 'case', 'base', 'housing', 'front']],
  ['grips', 'Poignées', ['grips', 'grip', 'poignees', 'handles']],
  ['a', 'Bouton bas', ['a', 'btna', 'buttona', 'south', 'cross', 'bas']],
  ['b', 'Bouton droit', ['b', 'btnb', 'buttonb', 'east', 'circle', 'droit']],
  ['x', 'Bouton gauche', ['x', 'btnx', 'buttonx', 'west', 'square', 'gauche']],
  ['y', 'Bouton haut', ['y', 'btny', 'buttony', 'north', 'triangle', 'haut']],
  ['lb', 'Bumper gauche', ['lb', 'l1', 'bumperl', 'bumperleft', 'leftbumper']],
  ['rb', 'Bumper droit', ['rb', 'r1', 'bumperr', 'bumperright', 'rightbumper']],
  ['lt', 'Gâchette gauche', ['lt', 'l2', 'triggerl', 'triggerleft', 'lefttrigger']],
  ['rt', 'Gâchette droite', ['rt', 'r2', 'triggerr', 'triggerright', 'righttrigger']],
  ['select', 'Bouton gauche du centre', ['select', 'back', 'view', 'share']],
  ['start', 'Bouton droit du centre', ['start', 'menu', 'options']],
  ['stickl', 'Stick gauche', ['stickl', 'stickleft', 'leftstick', 'ls', 'l3', 'thumbl', 'joystickl', 'joystickleft']],
  ['stickr', 'Stick droit', ['stickr', 'stickright', 'rightstick', 'rs', 'r3', 'thumbr', 'joystickr', 'joystickright']],
  ['up', 'Croix haut', ['up', 'dpadup', 'dup', 'croixhaut']],
  ['down', 'Croix bas', ['down', 'dpaddown', 'ddown', 'croixbas']],
  ['left', 'Croix gauche', ['left', 'dpadleft', 'dleft', 'croixgauche']],
  ['right', 'Croix droite', ['right', 'dpadright', 'dright', 'croixdroite']],
  ['dpad', 'Croix entière', ['dpad', 'croix', 'cross_pad', 'directional']],
  ['home', 'Bouton central', ['home', 'guide', 'logo']],
  ['pad', 'Pavé central', ['touchpad', 'pad', 'capture', 'pave']],
  ['light', 'Lumière', ['light', 'lightbar', 'led', 'lumiere']],
].map(([key, label, names]) => ({ key, label, names }));

const RIGHTS = [
  { value: 'unverified', label: 'À vérifier' }, { value: 'own', label: 'Création personnelle' },
  { value: 'licence', label: 'Licence achetée ou obtenue' }, { value: 'written', label: 'Autorisation écrite de l\'ayant droit' },
];

const norm = (t) => String(t).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '');

// Identifiants et noms de calques, dans l'ordre du fichier.
function readNames(svg) {
  const out = new Set();
  const tag = /<(?:g|path|rect|circle|ellipse|polygon|polyline|line|image|use)\b[^>]*>/gi;
  for (const [t] of String(svg).matchAll(tag)) {
    for (const m of t.matchAll(/\s(?:id|inkscape:label|data-name)=["']([^"']{1,80})["']/g)) out.add(m[1]);
  }
  return [...out];
}

function autoMap(names) {
  const map = {};
  for (const part of PACK_PARTS) {
    const hit = names.find((n) => part.names.includes(norm(n)));
    if (hit && !Object.values(map).includes(hit)) map[part.key] = hit;
  }
  return map;
}

function pngSize(buf) {
  if (buf.length < 24 || buf.readUInt32BE(0) !== 0x89504e47) return null;
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

// Un dossier de PNG de même taille devient un seul fichier en calques. 01-coque.png donne le calque coque.
function layersToSvg(layers) {
  const size = pngSize(layers[0].data);
  if (!size) throw new Error('Ce fichier n\'est pas un PNG valide.');
  const esc = (t) => String(t).replace(/[^\p{L}\p{N}_ -]/gu, '_');
  const body = layers.map((l) => {
    if (!pngSize(l.data)) throw new Error(`${l.name} n'est pas un PNG valide.`);
    const id = esc(l.name.replace(/\.png$/i, '').replace(/^\d+[-_ ]*/, ''));
    return `<image id="${id}" width="${size.width}" height="${size.height}" href="data:image/png;base64,${l.data.toString('base64')}"/>`;
  }).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size.width} ${size.height}">${body}</svg>`;
}

module.exports = { PACK_PARTS, RIGHTS, readNames, autoMap, pngSize, layersToSvg };

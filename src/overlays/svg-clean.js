// Un fichier importé ne doit rien exécuter ni rien charger : on ne garde que du dessin.
const NS = 'http://www.w3.org/2000/svg';
const TAGS = new Set(['svg', 'g', 'path', 'rect', 'circle', 'ellipse', 'line', 'polyline', 'polygon', 'text', 'tspan', 'image', 'use', 'defs', 'symbol', 'style',
  'lineargradient', 'radialgradient', 'stop', 'clippath', 'mask', 'pattern', 'filter', 'fegaussianblur', 'feoffset', 'feblend', 'fecolormatrix', 'fecomposite', 'feflood', 'femerge', 'femergenode', 'femorphology', 'fedropshadow']);
const SAFE_DATA = /^data:image\/(png|jpeg|webp);base64,/i;

const cleanCss = (css) => String(css).replace(/@import[^;]*;?/gi, '').replace(/url\(\s*(?!["']?#)[^)]*\)/gi, 'none').replace(/expression\s*\(/gi, '');

function cleanNode(node) {
  for (const child of [...node.children]) {
    if (child.namespaceURI !== NS || !TAGS.has(child.localName.toLowerCase())) { child.remove(); continue; }
    cleanNode(child);
  }
  for (const attr of [...node.attributes]) {
    const name = attr.name.toLowerCase();
    const value = attr.value;
    if (name.startsWith('on')) node.removeAttribute(attr.name);
    else if (name === 'href' || name === 'xlink:href') {
      if (!value.startsWith('#') && !SAFE_DATA.test(value)) node.removeAttribute(attr.name);
    } else if (name === 'style') node.setAttribute(attr.name, cleanCss(value));
    else if (/url\(/i.test(value) && !/^\s*url\(\s*["']?#/i.test(value)) node.removeAttribute(attr.name);
  }
  if (node.localName.toLowerCase() === 'style') node.textContent = cleanCss(node.textContent);
}

export function cleanSvg(text) {
  const doc = new DOMParser().parseFromString(text, 'image/svg+xml');
  const root = doc.documentElement;
  if (doc.querySelector('parsererror') || root.localName !== 'svg') return null;
  cleanNode(root);
  return root;
}

// Scène complète : tous les overlays placés dans l'éditeur de scène, dans une seule source 1920 × 1080.
// Chaque overlay garde son propre lien et sa propre connexion ; la scène ne fait que les poser.
import { el, query, isPreview } from '../lib.js';

export function mount(root) {
  const box = el('div', 'sc');
  root.append(box);
  const frames = new Map();
  const key = query.get('k') || '';

  function render(items, known) {
    const keep = new Set();
    for (const it of items) {
      if (it.hidden || !known.has(it.id)) continue;
      keep.add(it.id);
      let f = frames.get(it.id);
      if (!f) {
        f = el('iframe', 'sc-frame');
        f.setAttribute('allowtransparency', 'true');
        f.src = `/o/${encodeURIComponent(it.id)}?k=${encodeURIComponent(key)}${isPreview ? '&preview=1&bare=1' : ''}`;
        frames.set(it.id, f);
        box.append(f);
      }
      const [w, h] = known.get(it.id);
      f.style.cssText = `left:${it.x || 0}px;top:${it.y || 0}px;width:${w}px;height:${h}px;transform:scale(${it.k || 1});z-index:${it.z || 1};`;
    }
    for (const [id, f] of frames) if (!keep.has(id)) { f.remove(); frames.delete(id); }
  }

  return {
    update(s, data) {
      const known = new Map((data?.overlays || []).map((o) => [o.id, o.size]));
      // Disposition propre au jeu en cours si le streamer en a créé une, sinon celle par défaut.
      const own = data?.game && s.layouts?.[data.game];
      render(own || s.items || [], known);
    },
  };
}

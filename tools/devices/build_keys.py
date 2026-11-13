"""Découpe l'atlas de touches rendu par render_keys.py en une image par taille de touche.

python3 build_keys.py <render_dir> <out_dir>
Chaque PNG : R = lumière diffuse (1 = dessus bien éclairé), G = reflets, A = couverture.
"""
import sys, json, os
import numpy as np
from PIL import Image
import imageio.v3 as iio

SRC, OUT = sys.argv[1], sys.argv[2]
os.makedirs(OUT, exist_ok=True)
meta = json.load(open(f'{SRC}/meta.json'))
def rd(n):
    a = iio.imread(f'{SRC}/{n}'); return a.astype(np.float32) / (65535 if a.dtype == np.uint16 else 255)
LUM = np.array([0.2126, 0.7152, 0.0722], np.float32)
D, G = rd('diffuse.png'), rd('gloss.png')
lumD, lumG = D[..., :3] @ LUM, G[..., :3] @ LUM
it = meta['items']['1u']; p = meta['pxu']
# Référence : le centre du dessus d'une touche 1u (zone en cuvette)
cx, cy = int(it['x'] + it['w'] / 2), int(it['y'] + it['h'] / 2)
ref = float(np.percentile(lumD[cy - p // 6: cy + p // 6, cx - p // 6: cx + p // 6], 75))
out = {'pxu': p, 'items': {}}
for k, it in meta['items'].items():
    x0, y0 = int(round(it['x'])), int(round(it['y'])); x1, y1 = x0 + int(round(it['w'])), y0 + int(round(it['h']))
    arr = np.zeros((y1 - y0, x1 - x0, 4), np.float32)
    arr[..., 0] = np.clip(lumD[y0:y1, x0:x1] / ref * (0.92 if k == 'case' else 1), 0, 1)
    arr[..., 1] = np.clip(lumG[y0:y1, x0:x1], 0, 1)
    arr[..., 3] = D[y0:y1, x0:x1, 3]
    Image.fromarray((arr * 255 + 0.5).astype(np.uint8), 'RGBA').save(f'{OUT}/{k}.png', optimize=True)
    out['items'][k] = {'u': it['u'], 'w': x1 - x0, 'h': y1 - y0}
json.dump(out, open(f'{OUT}/keys.json', 'w'))
print('keys', len(out['items']), f'ref={ref:.3f}', sum(os.path.getsize(f'{OUT}/{f}') for f in os.listdir(OUT)) // 1024, 'KB')

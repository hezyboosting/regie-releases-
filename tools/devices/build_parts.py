"""Assemble les rendus Cycles d'un périphérique (souris, touche) en SVG recolorable.

python3 build_parts.py <render_dir> <out.svg> [preview.png]
Même codage que build_lit.py : R = lumière diffuse, G = reflets, A = couverture.
La zone « core » (rainures, puits de molette) est figée en gris très sombre.
"""
import sys, json, io, base64
import numpy as np
from PIL import Image
import imageio.v3 as iio

SRC, OUT = sys.argv[1], sys.argv[2]
meta = json.load(open(f'{SRC}/meta.json')); roles = meta['roles']
def rd(n):
    a = iio.imread(f'{SRC}/{n}'); return a.astype(np.float32) / (65535 if a.dtype == np.uint16 else 255)
LUM = np.array([0.2126, 0.7152, 0.0722], np.float32)
D, G = rd('diffuse.png'), rd('gloss.png'); H, W = D.shape[:2]
lumD, lumG = D[..., :3] @ LUM, G[..., :3] @ LUM
cov = {}
for m in meta['masks']:
    a = rd(m['file'])
    for ch, name in enumerate(m['parts']): cov[name] = np.clip(a[..., ch] * a[..., 3], 0, 1)
shell = sum(c for n, c in cov.items() if roles[n]['zone'] == 'shell')
ref = float(np.percentile(lumD[shell > 0.97], 93))

def layer(cover, r, g):
    out = np.zeros((H, W, 4), np.float32); out[..., 0] = np.clip(r, 0, 1); out[..., 1] = np.clip(g, 0, 1); out[..., 3] = cover; return out
def png_tag(arr, attrs=''):
    im = Image.fromarray((np.clip(arr, 0, 1) * 255 + 0.5).astype(np.uint8), 'RGBA')
    bb = im.getchannel('A').point(lambda v: 255 if v > 2 else 0).getbbox()
    if not bb: return ''
    im = im.crop(bb); buf = io.BytesIO(); im.save(buf, 'PNG', optimize=True); x0, y0, x1, y1 = bb
    return f'<image x="{x0}" y="{y0}" width="{x1 - x0}" height="{y1 - y0}"{attrs} href="data:image/png;base64,{base64.b64encode(buf.getvalue()).decode()}"/>'

ORDER = ['grips', 'core', 'shell', 'buttons', 'light', 'sticks']
out = []
for z in ORDER:
    names = [n for n, r in roles.items() if r['zone'] == z and r.get('btn') is None and n in cov]
    if not names: continue
    c = np.clip(sum(cov[n] for n in names), 0, 1)
    if z == 'core':   # gris anthracite figé, garde le modelé
        sh = np.clip(lumD / ref, 0, 1) * 0.07 + np.clip(lumG, 0, 1) * 0.25
        arr = np.zeros((H, W, 4), np.float32); arr[..., :3] = sh[..., None]; arr[..., 3] = c
        out.append(f'<g data-fixed="core">{png_tag(arr)}</g>')
    else:
        out.append(f'<g data-pad-group="{z}">{png_tag(layer(c, lumD / ref, lumG))}</g>')
for n, r in sorted(((n, r) for n, r in roles.items() if r.get('btn') is not None and n in cov), key=lambda t: (t[1]['zone'] == 'sticks', t[1]['btn'])):
    extra = ''
    if r.get('wheel'):
        w = meta['wheel']; extra = f' data-wheel="1" data-cx="{w["cx"]:.1f}" data-cy="{w["cy"]:.1f}" data-hw="{w["hw"]:.1f}" data-hh="{w["hh"]:.1f}"'
    out.append(f'<g data-btn="{r["btn"]}" data-part="{n}"{extra}><g data-pad-group="{r["zone"]}">{png_tag(layer(cov[n], lumD / ref, lumG))}</g></g>')
svg = f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" data-pad-mode="lit" data-pad-model="{meta["key"]}">' + ''.join(out) + '</svg>'
open(OUT, 'w').write(svg)
print(meta['key'], f'{len(svg) / 1024:.0f} KB', f'ref={ref:.3f}')

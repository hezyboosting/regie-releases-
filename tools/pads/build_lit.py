"""Assemble les rendus Cycles d'une manette en un SVG recolorable pour l'overlay Régie.

python3 build_lit.py <render_dir> <out.svg> [preview.png]

Chaque calque PNG : R = lumière diffuse (1 = surface éclairée), G = reflets, A = couverture.
Les symboles des boutons sont des calques en vraie couleur (data-pad-legend).
"""
import sys, json, io, base64
import numpy as np
from PIL import Image

SRC, OUT = sys.argv[1], sys.argv[2]
PREVIEW = sys.argv[3] if len(sys.argv) > 3 else None
meta = json.load(open(f'{SRC}/meta.json'))
roles = meta['roles']

def load(name):
    return np.asarray(Image.open(f'{SRC}/{name}').convert('RGBA')).astype(np.float32) / 255 if Image.open(f'{SRC}/{name}').mode != 'RGBA' else \
        np.asarray(Image.open(f'{SRC}/{name}')).astype(np.float32) / (65535 if Image.open(f'{SRC}/{name}').getextrema()[0][1] > 255 else 255)

def load16(name):
    im = Image.open(f'{SRC}/{name}')
    arr = np.asarray(im)
    if arr.dtype == np.uint16 or arr.max() > 255:
        return arr.astype(np.float32) / 65535
    return arr.astype(np.float32) / 255

def read_png(name):
    # Pillow lit les PNG RGBA 16 bits en 8 bits ; on passe par imageio s'il est là, sinon Pillow.
    try:
        import imageio.v3 as iio
        a = iio.imread(f'{SRC}/{name}')
        return a.astype(np.float32) / (65535 if a.dtype == np.uint16 else 255)
    except Exception:
        return np.asarray(Image.open(f'{SRC}/{name}').convert('RGBA')).astype(np.float32) / 255

LUM = np.array([0.2126, 0.7152, 0.0722], np.float32)
D = read_png('diffuse.png'); G = read_png('gloss.png')
H, W = D.shape[:2]
lumD = D[..., :3] @ LUM
lumG = G[..., :3] @ LUM

# Couverture de chaque pièce (masques par canal, alpha droit → couverture = canal × alpha)
cov = {}
for m in meta['masks']:
    a = read_png(m['file'])
    for ch, name in enumerate(m['parts']):
        cov[name] = np.clip(a[..., ch] * a[..., 3], 0, 1)

# Référence d'éclairage : une surface de coque bien éclairée vaut 1.
shell = sum(c for n, c in cov.items() if roles[n]['zone'] == 'shell')
ref = float(np.percentile(lumD[shell > 0.97], 93)) if (shell > 0.97).any() else float(np.percentile(lumD[D[..., 3] > 0.9], 90))

def lit_layer(cover, d_lum, g_lum):
    out = np.zeros((H, W, 4), np.float32)
    out[..., 0] = np.clip(d_lum / ref, 0, 1)
    out[..., 1] = np.clip(g_lum, 0, 1)
    out[..., 3] = cover
    return out

def color_layer(cover, rgb):
    out = np.zeros((H, W, 4), np.float32)
    out[..., :3] = np.clip(rgb / ref, 0, 1)
    out[..., 3] = cover
    return out

def png_tag(arr):
    im = Image.fromarray((np.clip(arr, 0, 1) * 255 + 0.5).astype(np.uint8), 'RGBA')
    bb = im.getchannel('A').point(lambda v: 255 if v > 2 else 0).getbbox()
    if not bb: return ''
    im = im.crop(bb); buf = io.BytesIO(); im.save(buf, 'PNG', optimize=True)
    x0, y0, x1, y1 = bb
    return f'<image x="{x0}" y="{y0}" width="{x1 - x0}" height="{y1 - y0}" href="data:image/png;base64,{base64.b64encode(buf.getvalue()).decode()}"/>'

ORDER = ['grips', 'triggers', 'shell', 'sticks', 'light', 'buttons']
zones = {}
parts_svg = []
legend_of = {r['btn']: n for n, r in roles.items() if r.get('legend')}
for name, r in roles.items():
    if name not in cov or r.get('legend') or r.get('stick'): continue
    if r.get('btn') is None:
        zones.setdefault(r['zone'], []).append(name)
for z in ORDER:
    pass

svg_zones = []
for z in ORDER:
    names = zones.get(z, [])
    if not names: continue
    c = np.clip(sum(cov[n] for n in names), 0, 1)
    tag = png_tag(lit_layer(c, lumD, lumG))
    if tag: svg_zones.append(f'<g data-pad-group="{z}">{tag}</g>')

btn_parts = sorted(((r['btn'], n) for n, r in roles.items() if n in cov and r.get('btn') is not None and not r.get('legend') and not r.get('stick')),
                   key=lambda t: (ORDER.index(roles[t[1]]['zone']) if roles[t[1]]['zone'] in ORDER else 9, t[0]))
for b, n in btn_parts:
    z = roles[n]['zone']
    inner = f'<g data-pad-group="{z}">{png_tag(lit_layer(cov[n], lumD, lumG))}</g>'
    ln = legend_of.get(b)
    if ln and ln in cov:
        inner += f'<g data-pad-legend="1">{png_tag(color_layer(cov[ln], D[..., :3]))}</g>'
    parts_svg.append(f'<g data-btn="{b}">{inner}</g>')

# Sticks : rendus seuls, séparés gauche/droite selon le centre le plus proche
SD = read_png('sticks_diffuse.png'); SG = read_png('sticks_gloss.png')
st = meta['sticks']
yy, xx = np.mgrid[0:H, 0:W]
dl = (xx - st['l']['cx']) ** 2 + (yy - st['l']['cy']) ** 2
dr = (xx - st['r']['cx']) ** 2 + (yy - st['r']['cy']) ** 2
for side, sel in (('l', dl <= dr), ('r', dr < dl)):
    a = SD[..., 3] * sel
    lay = lit_layer(a, SD[..., :3] @ LUM, SG[..., :3] @ LUM)
    s = st[side]
    parts_svg.append(f'<g data-stick="{side}" data-btn="{10 if side == "l" else 11}" data-cx="{s["cx"]:.1f}" data-cy="{s["cy"]:.1f}" data-r="{s["r"]:.1f}">'
                     f'<g data-pad-group="sticks">{png_tag(lay)}</g></g>')

svg = (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" data-pad-mode="lit" data-pad-model="{meta["key"]}">'
       + ''.join(svg_zones) + ''.join(parts_svg) + '</svg>')
open(OUT, 'w').write(svg)
print(meta['key'], f'{len(svg) / 1024:.0f} KB', f'ref={ref:.3f}', 'zones', list(zones), 'btns', [b for b, _ in btn_parts])

if PREVIEW:
    # Aperçu brut : diffuse × gris clair + reflets
    rgb = np.clip(lumD / ref, 0, 1)[..., None] * 0.85
    rgb = 1 - (1 - rgb) * (1 - np.clip(lumG, 0, 1)[..., None])
    Image.fromarray((np.dstack([np.repeat(rgb, 3, -1), D[..., 3:]]) * 255).astype(np.uint8), 'RGBA').save(PREVIEW)

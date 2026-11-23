"""Assemble le rendu de la touche (key.html) en icône à fond transparent.

1. Dans tools/icon : npm i three@0.170.0, puis python3 -m http.server 8901
2. Capturer key.html?shadow=0&dist=33&glow=0.75&led=1.3 vers main.png
   et key.html?pass=glow&dist=33 vers glow.png (fond transparent, 1024 × 1024)
3. python3 compose.py main.png glow.png ../../build/icon-source.png, puis node tools/make-icon.js
"""
import sys
from PIL import Image, ImageFilter, ImageChops

main = Image.open(sys.argv[1]).convert('RGBA')
glow = Image.open(sys.argv[2]).convert('RGBA')

def blurred(img, r, k):
    g = img.filter(ImageFilter.GaussianBlur(r))
    rgb = Image.new('RGB', img.size, (0, 0, 0)); rgb.paste(g.convert('RGB'), mask=g.getchannel('A'))
    return rgb.point(lambda v: min(255, int(v * k)))

def halo(img, r, a):
    g = img.filter(ImageFilter.GaussianBlur(r)); g.putalpha(g.getchannel('A').point(lambda v: int(v * a))); return g

# Rétroéclairage : la lumière du R et du voyant déborde sur la touche.
add = ImageChops.add(ImageChops.add(blurred(glow, 5, 0.22), blurred(glow, 20, 0.5)), blurred(glow, 60, 0.4))
lit = main.copy(); lit.paste(ImageChops.add(main.convert('RGB'), add), mask=main.getchannel('A'))
# Ombre portée douce, calculée depuis la silhouette de la touche.
A = main.getchannel('A')
sh = Image.composite(Image.new('RGBA', main.size, (8, 6, 10, 255)), Image.new('RGBA', main.size, (0, 0, 0, 0)), A)
sh = ImageChops.offset(sh, 8, 20).filter(ImageFilter.GaussianBlur(26)); sh.putalpha(sh.getchannel('A').point(lambda v: int(v * 0.55)))
out = Image.new('RGBA', main.size, (0, 0, 0, 0))
for layer in (sh, halo(glow, 34, 0.2), lit): out = Image.alpha_composite(out, layer)
bb = out.getbbox(); crop = out.crop(bb); side = max(crop.size); m = int(side * 0.04)
canvas = Image.new('RGBA', (side + 2 * m, side + 2 * m), (0, 0, 0, 0))
canvas.alpha_composite(crop, ((side + 2 * m - crop.size[0]) // 2, (side + 2 * m - crop.size[1]) // 2))
canvas.resize((1024, 1024), Image.LANCZOS).save(sys.argv[3])

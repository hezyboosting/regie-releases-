# Manette générique Régie : modèle 3D original, sans marque, rendu comme une photo de produit.
import json, math, os, re, sys
import numpy as np
from scipy import ndimage as ndi
from scipy.spatial import cKDTree
from PIL import Image, ImageDraw
import bpy

OUT = sys.argv[1]
SCALE = float(sys.argv[2]) if len(sys.argv) > 2 else 1
SAMPLES = int(sys.argv[3]) if len(sys.argv) > 3 else 32
LAYOUT = sys.argv[4] if len(sys.argv) > 4 else 'offset'
SHELL = tuple(float(v) for v in os.environ.get('SHELL_RGB', '0.034,0.037,0.044').split(','))
GRIP = tuple(float(v) for v in os.environ.get('GRIP_RGB', '0.017,0.018,0.022').split(','))

W, H, S, G = 620, 420, 3, 1.5
STEP = int(S / G)
K = 0.01
BODY = 'M310 92C392 92 436 86 486 88C536 90 570 112 586 156C600 198 610 256 604 304C600 344 566 366 536 350C510 336 490 306 456 294C424 284 372 282 310 282C248 282 196 284 164 294C130 306 110 336 84 350C54 366 20 344 16 304C10 256 20 198 34 156C50 112 84 90 134 88C184 86 228 92 310 92Z'
SEAM_R = 'M596 184C556 200 502 242 456 294'
BUMPER_R = 'M396 96C412 74 468 62 512 66C540 68 556 86 566 118L396 96Z'
TRIGGER_R = 'M424 84C434 54 470 42 502 46C528 49 542 66 550 96L424 84Z'
PETAL = 'M0 -11C-6 -15 -21 -24 -21 -33C-21 -40 -12 -43 0 -43C12 -43 21 -40 21 -33C21 -24 6 -15 0 -11Z'
if LAYOUT == 'offset':
    SPOTS = dict(stickL=(146, 170), dpad=(240, 228), stickR=(380, 228), face=(474, 170))
else:
    SPOTS = dict(stickL=(240, 228), dpad=(146, 170), stickR=(380, 228), face=(474, 170))

def points(d, n=56):
    tok = re.findall(r'[MCLZ]|-?\d+(?:\.\d+)?', d)
    out, i, cur = [], 0, None
    while i < len(tok):
        c = tok[i]
        if c == 'M':
            cur = (float(tok[i + 1]), float(tok[i + 2])); out.append(cur); i += 3
        elif c == 'L':
            cur = (float(tok[i + 1]), float(tok[i + 2])); out.append(cur); i += 3
        elif c == 'C':
            i += 1
            while i < len(tok) and tok[i] not in 'MCLZ':
                p = [float(v) for v in tok[i:i + 6]]; i += 6
                a, b, c2, e = np.array(cur), np.array(p[0:2]), np.array(p[2:4]), np.array(p[4:6])
                for t in np.linspace(0, 1, n)[1:]:
                    out.append(tuple((1 - t) ** 3 * a + 3 * (1 - t) ** 2 * t * b + 3 * (1 - t) * t ** 2 * c2 + t ** 3 * e))
                cur = tuple(e)
        else:
            i += 1
    return out

def mirror(pts): return [(W - x, y) for x, y in pts]
def turn(pts, deg, cx, cy):
    a = math.radians(deg)
    return [(cx + x * math.cos(a) - y * math.sin(a), cy + x * math.sin(a) + y * math.cos(a)) for x, y in pts]

def raster(pts):
    img = Image.new('1', (W * S + 1, H * S + 1), 0)
    ImageDraw.Draw(img).polygon([(x * S, y * S) for x, y in pts], fill=1)
    return np.array(img, dtype=bool)

def line(pts):
    img = Image.new('1', (W * S + 1, H * S + 1), 1)
    ImageDraw.Draw(img).line([(x * S, y * S) for x, y in pts], fill=0, width=1)
    return ndi.distance_transform_edt(np.array(img, dtype=bool)) / S

def inside_dist(mask): return ndi.distance_transform_edt(mask) / S
def smooth(e0, e1, v):
    t = np.clip((v - e0) / (e1 - e0), 0, 1)
    return t * t * (3 - 2 * t)
def rim(d, r): return np.sqrt(np.clip(1 - (1 - np.clip(d / r, 0, 1)) ** 2, 0, 1))

ys, xs = np.mgrid[0:H * S + 1, 0:W * S + 1] / S

def stadium(x0, y0, x1, y1):
    r = (y1 - y0) / 2
    cx = np.clip(xs, x0 + r, x1 - r)
    return np.hypot(xs - cx, ys - (y0 + r)) - r

def mat(name, color, rough, coat=0.0, spec=0.5, emit=None, metal=0.0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = (*color, 1)
    b.inputs['Roughness'].default_value = rough
    b.inputs['Coat Weight'].default_value = coat
    b.inputs['Coat Roughness'].default_value = 0.12
    b.inputs['Metallic'].default_value = metal
    b.inputs['Specular IOR Level'].default_value = spec
    if emit:
        b.inputs['Emission Color'].default_value = (*emit[0], 1)
        b.inputs['Emission Strength'].default_value = emit[1]
    return m

def to_world(x, y, z): return ((x - W / 2) * K, (H / 2 - y) * K, z * K)

def height_object(name, mask, z, material, contour=None, floor=-6):
    sel = lambda a: a[::STEP, ::STEP]
    zg, mg, xg, yg = sel(z), sel(mask), sel(xs), sel(ys)
    rows, cols = mg.shape
    verts_inside = mg.copy()
    idx = -np.ones(mg.shape, dtype=np.int64)
    idx[verts_inside] = np.arange(verts_inside.sum())
    px, py, pz = xg[verts_inside].copy(), yg[verts_inside].copy(), zg[verts_inside].copy()
    if contour is not None:
        edge = verts_inside & ~ndi.binary_erosion(verts_inside)
        e = idx[edge]
        tree = cKDTree(contour)
        _, near = tree.query(np.c_[px[e], py[e]])
        px[e], py[e] = contour[near, 0], contour[near, 1]
    a, b, c, d = idx[:-1, :-1], idx[:-1, 1:], idx[1:, 1:], idx[1:, :-1]
    ok = (a >= 0) & (b >= 0) & (c >= 0) & (d >= 0)
    quads = np.c_[a[ok], d[ok], c[ok], b[ok]]
    co = np.c_[(px - W / 2) * K, (H / 2 - py) * K, pz * K]
    me = bpy.data.meshes.new(name)
    me.vertices.add(len(co)); me.vertices.foreach_set('co', co.ravel())
    n = len(quads)
    me.loops.add(n * 4); me.loops.foreach_set('vertex_index', quads.ravel())
    me.polygons.add(n); me.polygons.foreach_set('loop_start', np.arange(n) * 4)
    me.update(calc_edges=True)
    me.polygons.foreach_set('use_smooth', [True] * n)
    uv = me.uv_layers.new(name='UVMap')
    uvs = np.c_[px / W, 1 - py / H][quads.ravel()]
    uv.uv.foreach_set('vector', uvs.ravel())
    me.update()
    me.materials.append(material)
    ob = bpy.data.objects.new(name, me)
    bpy.context.collection.objects.link(ob)
    return ob

def lathe(name, prof, cx, cy, z0, material, seg=144, lobes=0, amp=0, zone=(0, 0), ridges=0, ridge=(0, 0, 0)):
    rings = []
    for r, z in prof:
        ring = []
        for i in range(seg):
            a = 2 * math.pi * i / seg
            rr = r
            if lobes and zone[0] <= z <= zone[1]:
                rr = r * (1 + amp * math.cos(lobes * a))
            zz = z
            if ridges and ridge[0] <= r <= ridge[1]:
                zz = z + ridge[2] * math.cos(ridges * a)
            ring.append(to_world(cx + rr * math.cos(a), cy + rr * math.sin(a), z0 + zz))
        rings.append(ring)
    verts = [v for ring in rings for v in ring]
    faces = []
    for j in range(len(rings) - 1):
        for i in range(seg):
            k = (i + 1) % seg
            faces.append((j * seg + i, (j + 1) * seg + i, (j + 1) * seg + k, j * seg + k))
    me = bpy.data.meshes.new(name)
    me.from_pydata(verts, [], faces)
    me.update()
    me.polygons.foreach_set('use_smooth', [True] * len(me.polygons))
    me.materials.append(material)
    ob = bpy.data.objects.new(name, me)
    bpy.context.collection.objects.link(ob)
    return ob

def curve(fn, a, b, n=24): return [fn(v) for v in np.linspace(a, b, n)]

# ---------- Scène ----------
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.preferences.addon_enable(module='cycles')
scene = bpy.context.scene

# ---------- Coque ----------
body_pts = points(BODY)
body = raster(body_pts)
contour = np.array(points(BODY, 240))
d = inside_dist(body)
grip_pts = points('M596 184C556 200 502 242 456 294C490 306 510 336 536 350C566 366 600 344 604 304C610 256 604 214 596 184Z')
grip = raster(grip_pts) | raster(mirror(grip_pts))
grip_soft = ndi.gaussian_filter(grip.astype(float), 12 * S)
u, v = (xs - W / 2) / 300, (ys - 200) / 150
z = 26 * rim(d, 42) + 7 * (1 - np.clip(u * u, 0, 1)) * smooth(0, 60, d) + 11 * grip_soft * smooth(0, 44, d)
z -= 5 * smooth(0.2, 1, v) * (1 - grip_soft)

def well(cx, cy, r, depth, lip=1.1):
    global z
    dist = np.hypot(xs - cx, ys - cy)
    z = z - depth * smooth(r + 1.4, r - 1.4, dist) + lip * np.exp(-((dist - (r + 2.6)) / 2.4) ** 2)

def slot(field, depth, lip=0.7):
    global z
    z = z - depth * smooth(1.2, -1.2, field) + lip * np.exp(-((field - 2.2) / 2) ** 2)

sx, sy = SPOTS['stickL']; well(sx, sy, 45, 9)
rx, ry = SPOTS['stickR']; well(rx, ry, 45, 9)
dx, dy = SPOTS['dpad']; well(dx, dy, 47, 5.5)
fx, fy = SPOTS['face']
well(fx, fy, 68, 2.4, 0.5)
FACE = [(0, 39), (39, 0), (-39, 0), (0, -39)]
for ox, oy in FACE: well(fx + ox, fy + oy, 22.6, 6, 0.3)
slot(stadium(240, 106, 380, 142), 2.2)
slot(stadium(264, 158, 294, 168), 3)
slot(stadium(326, 158, 356, 168), 3)
slot(stadium(282, 184, 338, 193), 3)
for s_pts in (points(SEAM_R), mirror(points(SEAM_R))):
    z -= 1.5 * np.exp(-(line(s_pts) / 0.8) ** 2)
hull_z = z.copy()

# Texture : grain fin de la coque, relief des poignées.
tex = Image.fromarray(ndi.zoom(grip.astype(np.uint8) * 255, 2 / S * 2, order=1)).convert('L').resize((W * 4, H * 4))
tex.save('/tmp/padmodel/grip-mask.png')
ty, tx = np.mgrid[0:H * 4, 0:W * 4] / 4
a = math.radians(32)
p = tx * math.cos(a) + ty * math.sin(a)
q = -tx * math.sin(a) + ty * math.cos(a)
bump = (np.cos(p * 2 * math.pi / 5.2) * np.cos(q * 2 * math.pi / 5.2) + 1) / 2
Image.fromarray((bump * 255).astype(np.uint8)).save('/tmp/padmodel/grip-bump.png')

shell = mat('shell', SHELL, 0.36, coat=0.2)
rubber = mat('rubber', (0.018, 0.019, 0.022), 0.72, spec=0.35)
keys = mat('keys', (0.03, 0.033, 0.04), 0.26, coat=0.8)
stickm = mat('stick', (0.016, 0.017, 0.02), 0.6, spec=0.4)
boot = mat('boot', (0.006, 0.0065, 0.008), 0.55)
satin = mat('satin', (0.03, 0.032, 0.038), 0.34, coat=0.3)
glass = mat('glass', (0.004, 0.0045, 0.006), 0.07, coat=1)
led = mat('led', (0.1, 0.3, 0.5), 0.3, emit=((0.22, 0.58, 1.0), 1.1))
chrome = mat('chrome', (0.75, 0.77, 0.8), 0.22, metal=1)

nt = shell.node_tree
bsdf = nt.nodes['Principled BSDF']
noise = nt.nodes.new('ShaderNodeTexNoise'); noise.inputs['Scale'].default_value = 900; noise.inputs['Detail'].default_value = 3
bump_n = nt.nodes.new('ShaderNodeBump'); bump_n.inputs['Strength'].default_value = 0.1; bump_n.inputs['Distance'].default_value = 0.004
nt.links.new(noise.outputs['Fac'], bump_n.inputs['Height'])
gmask = nt.nodes.new('ShaderNodeTexImage'); gmask.image = bpy.data.images.load('/tmp/padmodel/grip-mask.png'); gmask.image.colorspace_settings.name = 'Non-Color'
gtex = nt.nodes.new('ShaderNodeTexImage'); gtex.image = bpy.data.images.load('/tmp/padmodel/grip-bump.png'); gtex.image.colorspace_settings.name = 'Non-Color'
bump_g = nt.nodes.new('ShaderNodeBump'); bump_g.inputs['Strength'].default_value = 0.55; bump_g.inputs['Distance'].default_value = 0.012
nt.links.new(gtex.outputs['Color'], bump_g.inputs['Height'])
mixn = nt.nodes.new('ShaderNodeMix'); mixn.data_type = 'RGBA'
nt.links.new(gmask.outputs['Color'], mixn.inputs[0])
nt.links.new(bump_n.outputs['Normal'], mixn.inputs[6])
nt.links.new(bump_g.outputs['Normal'], mixn.inputs[7])
nt.links.new(mixn.outputs[2], bsdf.inputs['Normal'])
mixc = nt.nodes.new('ShaderNodeMix'); mixc.data_type = 'RGBA'
nt.links.new(gmask.outputs['Color'], mixc.inputs[0])
mixc.inputs[6].default_value = (*SHELL, 1)
mixc.inputs[7].default_value = (*GRIP, 1)
nt.links.new(mixc.outputs[2], bsdf.inputs['Base Color'])
mixr = nt.nodes.new('ShaderNodeMapRange')
nt.links.new(gmask.outputs['Color'], mixr.inputs[0])
mixr.inputs[3].default_value = 0.36; mixr.inputs[4].default_value = 0.66
nt.links.new(mixr.outputs[0], bsdf.inputs['Roughness'])

height_object('hull', body, z, shell, contour)
under = bpy.data.meshes.new('under')
under.from_pydata([to_world(x, y, -2) for x, y in body_pts], [], [list(range(len(body_pts)))])
under.update(); under.materials.append(shell)
bpy.context.collection.objects.link(bpy.data.objects.new('under', under))

# ---------- Épaules ----------
for name, path, top, base in (('trigger', TRIGGER_R, 13, -2), ('bumper', BUMPER_R, 15, 0)):
    for side, pts in (('R', points(path)), ('L', mirror(points(path)))):
        m = raster(pts)
        dd = inside_dist(m)
        zz = base + top * rim(dd, 15)
        zz = np.where(body, np.minimum(zz, hull_z - 1.5), zz)
        height_object(name + side, m, zz, satin, np.array(points(path, 200) if side == 'R' else mirror(points(path, 200))))

# ---------- Visière ----------
field = stadium(242, 108, 378, 140)
m = field < 0
hz = np.max(hull_z[m]) if m.any() else 30
base = np.median(hull_z[m])
height_object('visor', m, base + 1.6 * rim(-field, 3), glass)
for nm, x0 in (('ledL', 258), ('ledR', 336)):
    fl = stadium(x0, 122, x0 + 26, 125.4)
    height_object(nm, fl < 0, np.full_like(z, base + 1.9), led)
lathe('home-ring', [(0.1, 3.4), (11.5, 3.4), (12.5, 3), (12.8, 1.5), (12.8, 0)], 310, 124, base, chrome)
lathe('home', [(0.1, 4.6), (4, 4.5), (8, 4.2), (10, 3.8), (10.6, 3.4), (10.8, 2)], 310, 124, base, keys)

# ---------- Petits boutons ----------
for nm, f in (('view', stadium(265.5, 159.5, 292.5, 166.5)), ('menu', stadium(327.5, 159.5, 354.5, 166.5)), ('share', stadium(283.5, 185.5, 336.5, 191.5))):
    k = f < 0
    b0 = np.median(hull_z[k]) - 3
    height_object(nm, k, b0 + 4.2 * rim(-f, 2.4), keys)

# ---------- Croix en pétales ----------
petal = points(PETAL)
for i, deg in enumerate((0, 90, 180, 270)):
    pts = turn(petal, deg, dx, dy)
    k = raster(pts)
    dd = inside_dist(k)
    b0 = np.median(hull_z[np.hypot(xs - dx, ys - dy) < 40]) 
    height_object(f'petal{i}', k, b0 + 2.8 * rim(dd, 4.2) + 0.2 * smooth(2, 12, dd), keys, np.array(turn(points(PETAL, 120), deg, dx, dy)))
lathe('hub', [(0.1, 1.2), (5, 1.1), (6.4, 0.6), (6.8, -2)], dx, dy, np.median(hull_z[np.hypot(xs - dx, ys - dy) < 40]), satin)

# ---------- Boutons de face ----------
for i, (ox, oy) in enumerate(FACE):
    cx, cy = fx + ox, fy + oy
    b0 = float(hull_z[int(cy * S), int(cx * S)])
    prof = [(r, 3.4 + 1.9 * (1 - (r / 20) ** 2)) for r in np.linspace(0.1, 19, 16)] + [(19.7, 2.7), (20.2, 1.6), (20.3, -3)]
    lathe(f'face{i}', prof, cx, cy, b0, keys)

# ---------- Sticks ----------
for nm, (cx, cy) in (('L', (sx, sy)), ('R', (rx, ry))):
    b0 = float(hull_z[int(cy * S), int(cx * S)])
    lathe(f'boot{nm}', [(0.1, 3.4), (14, 3.4), (24, 2.2), (34, 0.2), (42, -0.4), (45.5, 0.4)], cx, cy, b0, boot)
    lathe(f'ring{nm}', [(40.4, 0.5), (41.4, 0.9), (42.4, 0.5)], cx, cy, b0, led)
    lathe(f'stem{nm}', [(15, 15), (15, 2)], cx, cy, b0, boot)
    top = 24.5
    prof = [(r, top - 4.2 * (1 - (r / 20) ** 2)) for r in np.linspace(0.1, 20, 18)]
    prof += [(20.8, top + 0.35), (21.8, top + 0.75)]
    prof += [(r, top + 0.9 - 0.3 * (r - 22)) for r in np.linspace(22.4, 28.4, 9)]
    prof += [(29.4, top - 1.3), (30.8, top - 2.6), (31.6, top - 4.6), (31.6, top - 7.8), (30.6, top - 9.4), (20, top - 10.4)]
    lathe(f'cap{nm}', prof, cx, cy, b0, stickm, seg=720, lobes=48, amp=0.011, zone=(top - 8.2, top - 4), ridges=60, ridge=(22.8, 28.2, 0.42))

# ---------- Lumière ----------
scene.render.engine = 'CYCLES'
scene.cycles.device = 'CPU'
scene.cycles.samples = SAMPLES
scene.cycles.use_denoising = True
scene.cycles.max_bounces = 6
scene.render.film_transparent = True
scene.render.resolution_x = int(W * SCALE)
scene.render.resolution_y = int(H * SCALE)
scene.render.image_settings.file_format = 'PNG'
scene.render.image_settings.color_mode = 'RGBA'
scene.view_settings.view_transform = 'AgX'
scene.view_settings.look = 'AgX - Punchy'
scene.view_settings.exposure = float(os.environ.get('EXPOSURE', '1.0'))

cam = bpy.data.cameras.new('cam')
cam.type = 'ORTHO'
cam.ortho_scale = W * K
ob = bpy.data.objects.new('cam', cam)
bpy.context.collection.objects.link(ob)
ob.location = (0, 0, 12)
scene.camera = ob

def area(name, size, loc, rot, power, color=(1, 1, 1)):
    l = bpy.data.lights.new(name, 'AREA')
    l.shape = 'RECTANGLE'
    l.size, l.size_y = size
    l.energy = power
    l.color = color
    o = bpy.data.objects.new(name, l)
    bpy.context.collection.objects.link(o)
    o.location = loc
    o.rotation_euler = rot
    return o

area('key', (9, 4), (-2, 5.4, 6), (math.radians(-40), math.radians(-14), 0), 520)
area('strip', (11, 0.7), (0, 5.4, 2.2), (math.radians(-66), 0, 0), 150)
area('side', (0.8, 7), (-7.5, -1, 2.4), (0, math.radians(-70), 0), 90, (0.9, 0.95, 1))
area('fill', (7, 7), (4, -5.5, 5), (math.radians(44), math.radians(24), 0), 80, (0.86, 0.92, 1))
world = bpy.data.worlds.new('w'); world.use_nodes = True
world.node_tree.nodes['Background'].inputs[0].default_value = (0.02, 0.022, 0.026, 1)
world.node_tree.nodes['Background'].inputs[1].default_value = 1
scene.world = world

floor = bpy.data.meshes.new('floor')
floor.from_pydata([(-9, -9, -0.2), (9, -9, -0.2), (9, 9, -0.2), (-9, 9, -0.2)], [], [(0, 1, 2, 3)])
floor.update()
fo = bpy.data.objects.new('floor', floor)
bpy.context.collection.objects.link(fo)
fo.is_shadow_catcher = True

scene.render.filepath = OUT
bpy.ops.render.render(write_still=True)
print('OK', OUT)

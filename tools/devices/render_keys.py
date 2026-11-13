"""Touches de clavier (profil uniforme à cuvette) et boîtier, modélisés de zéro et rendus
en vue de dessus avec Cycles, en calques recolorables (R = lumière, G = reflets, A = couverture).

blender-python render_keys.py -- <out_dir>

Chaque touche est rendue dans sa case (largeur × hauteur en u, 1u = 19,05 mm), écart compris :
l'overlay les pose côte à côte sans calcul. Le boîtier est rendu une fois et découpé en 9 parts.
"""
import bpy, bmesh, json, math, os, sys
from mathutils import Vector

OUT = sys.argv[sys.argv.index('--') + 1]
SAMPLES = int(os.environ.get('SAMPLES', '64'))
PXU = int(os.environ.get('PXU', '112'))   # pixels par u
os.makedirs(OUT, exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene

# ---------- polygones orthogonaux, décalés et arrondis ----------
def normals(poly):
    """Normales intérieures des arêtes d'un polygone orthogonal tourné dans le sens trigonométrique."""
    out = []
    n = len(poly)
    for i in range(n):
        (x1, y1), (x2, y2) = poly[i], poly[(i + 1) % n]
        dx, dy = x2 - x1, y2 - y1; l = math.hypot(dx, dy)
        out.append((-dy / l, dx / l))
    return out

def ring(poly, d, r, seg=6):
    """Contour décalé de d vers l'intérieur, coins arrondis de rayon r (même nombre de points pour tout d)."""
    n = len(poly); nm = normals(poly)
    pts = []
    for i in range(n):
        n0, n1 = nm[i - 1], nm[i]
        vx = poly[i][0] + d * (n0[0] + n1[0]); vy = poly[i][1] + d * (n0[1] + n1[1])
        d0 = (poly[i][0] - poly[i - 1][0], poly[i][1] - poly[i - 1][1]); l0 = math.hypot(*d0); d0 = (d0[0] / l0, d0[1] / l0)
        d1 = (poly[(i + 1) % n][0] - poly[i][0], poly[(i + 1) % n][1] - poly[i][1]); l1 = math.hypot(*d1); d1 = (d1[0] / l1, d1[1] / l1)
        convex = d0[0] * d1[1] - d0[1] * d1[0] > 0
        p1 = (vx - d0[0] * r, vy - d0[1] * r); p2 = (vx + d1[0] * r, vy + d1[1] * r)
        sgn = 1 if convex else -1
        c = (p1[0] + sgn * n0[0] * r, p1[1] + sgn * n0[1] * r)
        a1 = math.atan2(p1[1] - c[1], p1[0] - c[0]); a2 = math.atan2(p2[1] - c[1], p2[0] - c[0])
        da = (a2 - a1 + math.pi) % (2 * math.pi) - math.pi
        for k in range(seg + 1):
            a = a1 + da * k / seg
            pts.append((c[0] + r * math.cos(a), c[1] + r * math.sin(a)))
    return pts

def loft(name, rings, cap_top=True, cap_bottom=True):
    """rings : liste de (points 2D, z). Relie les anneaux successifs, ferme le haut et le bas."""
    bm = bmesh.new()
    vs = [[bm.verts.new((x, y, z)) for x, y in pts] for pts, z in rings]
    m = len(vs[0])
    for a, b in zip(vs, vs[1:]):
        for j in range(m):
            j2 = (j + 1) % m
            bm.faces.new((a[j], a[j2], b[j2], b[j]))
    if cap_bottom: bm.faces.new(vs[0][::-1])
    if cap_top: bm.faces.new(vs[-1])
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
    for p in me.polygons:
        zs = [me.vertices[i].co.z for i in p.vertices]
        p.use_smooth = max(zs) - min(zs) > 1e-5      # faces horizontales en aplat : pas de traînées de lissage
    ob = bpy.data.objects.new(name, me); scene.collection.objects.link(ob)
    return ob

def rect(w, h):
    return [(-w / 2, -h / 2), (w / 2, -h / 2), (w / 2, h / 2), (-w / 2, h / 2)]

def iso_enter():
    # 1,5u en haut, 1,25u en bas, 2u de haut ; repère centré sur la case 1,5 × 2
    return [(-0.5, -1.0), (0.75, -1.0), (0.75, 1.0), (-0.75, 1.0), (-0.75, 0.0), (-0.5, 0.0)]

# ---------- touche ----------
GAP = 0.05          # demi-écart entre touches
WALL = 0.15         # retrait du dessus par rapport au pied
H, DISH = 0.42, 0.035
def keycap(name, poly):
    base = [(x, y) for x, y in poly]
    rings = []
    RR = 0.035                      # arrondi du bord du dessus
    top_d = GAP + WALL
    steps = 8
    for k in range(steps + 1):      # flanc, légèrement bombé
        t = k / steps
        e = 1 - (1 - t) ** 1.5
        rings.append((ring(base, GAP + (WALL - RR) * e, 0.1 - 0.04 * t, 8), (H - RR) * t))
    for k in range(1, 5):           # quart de rond vers le dessus
        a = k / 4 * math.pi / 2
        rings.append((ring(base, top_d - RR * math.cos(a), 0.06, 8), H - RR + RR * math.sin(a)))
    inner = 12
    lim = 0.5 - top_d - 0.05        # toutes les touches ont au moins 1u d'épaisseur
    for k in range(1, inner + 1):   # cuvette douce, sans arête
        t = k / inner
        rings.append((ring(base, top_d + lim * t, max(0.02, 0.06 - 0.04 * t), 8), H - DISH * math.sin(t * math.pi / 2) ** 2))
    return loft(name, rings)

# ---------- boîtier (rendu une fois, découpé en 9 parts par l'overlay) ----------
CASE_W, CASE_H = 4.0, 3.0
def case():
    base = rect(CASE_W, CASE_H)
    R0 = 0.32
    # profil : flanc vertical, quart de rond vers le dessus, bord plat, chanfrein, paroi intérieure, plaque en creux
    prof = [(0.13 * (1 - math.cos(a)), -0.13 + 0.13 * math.sin(a)) for a in [k / 8 * math.pi / 2 for k in range(9)]]
    prof += [(0.14, 0.0), (0.29, 0.0), (0.30, -0.002), (0.33, -0.02), (0.36, -0.20), (0.38, -0.24), (0.40, -0.25), (0.41, -0.25), (1.2, -0.25)]
    rings = [(ring(base, 0.0, R0), -0.6)]
    for d, z in prof:
        rings.append((ring(base, d, max(0.04, R0 - d)), z))
    return loft('case', rings)

# ---------- catalogue ----------
TYPES = {f'{w:g}u': (w, 1.0) for w in (1, 1.25, 1.5, 1.75, 2, 2.25, 2.75, 3.5, 6.25)}
TYPES['tall'] = (1.0, 2.0)
TYPES['iso'] = (1.5, 2.0)
placed = {}
x0, y0, row_h, cursor = 0.0, 0.0, 0.0, 0.0
MAXW = 13.0
order = ['1u', '1.25u', '1.5u', '1.75u', '2u', '2.25u', '2.75u', 'tall', 'iso', '3.5u', '6.25u']
x, y, rh = 0.0, 0.0, 0.0
for key in order:
    w, h = TYPES[key]
    if x + w > MAXW: x = 0.0; y -= rh + 0.3; rh = 0.0
    cx, cy = x + w / 2, y - h / 2
    poly = iso_enter() if key == 'iso' else rect(w, h)
    ob = keycap(key, poly); ob.location = (cx, cy, 0)
    placed[key] = (cx, cy, w, h)
    x += w + 0.3; rh = max(rh, h)
y -= rh + 0.5
cob = case(); cob.location = (CASE_W / 2, y - CASE_H / 2, 0)
placed['case'] = (CASE_W / 2, y - CASE_H / 2, CASE_W, CASE_H)
bpy.context.view_layer.update()

# ---------- matières ----------
def material(mode, kind):
    m = bpy.data.materials.new(f'{kind}_{mode}'); m.use_nodes = True
    nt = m.node_tree; b = nt.nodes['Principled BSDF']
    if mode == 'diffuse':
        b.inputs['Base Color'].default_value = (0.8, 0.8, 0.8, 1); b.inputs['Specular IOR Level'].default_value = 0.0; b.inputs['Roughness'].default_value = 1
    else:
        b.inputs['Base Color'].default_value = (0, 0, 0, 1)
        b.inputs['Roughness'].default_value = 0.38 if kind == 'key' else 0.3
        b.inputs['Coat Weight'].default_value = 0.0 if kind == 'key' else 0.2
    tc = nt.nodes.new('ShaderNodeTexCoord'); tex = nt.nodes.new('ShaderNodeTexNoise')
    tex.inputs['Scale'].default_value = 260 if kind == 'key' else 120
    nt.links.new(tc.outputs['Object'], tex.inputs['Vector'])
    bump = nt.nodes.new('ShaderNodeBump'); bump.inputs['Strength'].default_value = 0.05 if kind == 'key' else 0.03; bump.inputs['Distance'].default_value = 0.004
    nt.links.new(tex.outputs['Fac'], bump.inputs['Height']); nt.links.new(bump.outputs['Normal'], b.inputs['Normal'])
    return m
MATS = {mode: {k: material(mode, k) for k in ('key', 'case')} for mode in ('diffuse', 'gloss')}
def assign(mode):
    for ob in scene.objects:
        if ob.type != 'MESH': continue
        ob.data.materials.clear(); ob.data.materials.append(MATS[mode]['case' if ob.name == 'case' else 'key'])

# ---------- caméra, lumières ----------
xs = [p[0] - p[2] / 2 for p in placed.values()] + [p[0] + p[2] / 2 for p in placed.values()]
ys = [p[1] - p[3] / 2 for p in placed.values()] + [p[1] + p[3] / 2 for p in placed.values()]
minx, maxx, miny, maxy = min(xs) - 0.2, max(xs) + 0.2, min(ys) - 0.2, max(ys) + 0.2
W, Hh = maxx - minx, maxy - miny
cam = bpy.data.cameras.new('cam'); cam.type = 'ORTHO'; cam.ortho_scale = max(W, Hh)
co = bpy.data.objects.new('cam', cam); scene.collection.objects.link(co); scene.camera = co
co.location = ((minx + maxx) / 2, (miny + maxy) / 2, 10)
scene.render.resolution_x = int(round(W * PXU)); scene.render.resolution_y = int(round(Hh * PXU)); scene.render.resolution_percentage = 100
def to_px(x, y): return ((x - minx) * PXU, (maxy - y) * PXU)

CX, CY = (minx + maxx) / 2, (miny + maxy) / 2
def area(name, off, size, power):
    l = bpy.data.lights.new(name, 'AREA'); l.size = size; l.energy = power
    loc = Vector((CX + off[0], CY + off[1], off[2]))
    o = bpy.data.objects.new(name, l); o.location = loc
    o.rotation_euler = (Vector((CX, CY, 0)) - loc).to_track_quat('-Z', 'Y').to_euler(); scene.collection.objects.link(o)
# Lumières lointaines et larges : toutes les touches de l'atlas reçoivent le même éclairage.
area('key', (-30, 40, 38), 24, float(os.environ.get('KEYW', '30000')))
area('fill', (40, -10, 40), 30, 8000)
world = bpy.data.worlds.new('w'); scene.world = world; world.use_nodes = True
bg = world.node_tree.nodes['Background']; bg.inputs['Color'].default_value = (1, 1, 1, 1); bg.inputs['Strength'].default_value = 0.22

scene.render.engine = 'CYCLES'; scene.cycles.device = 'CPU'
scene.render.film_transparent = True
scene.view_settings.view_transform = 'Standard'; scene.view_settings.look = 'None'
scene.view_settings.exposure = float(os.environ.get('EXPO', '-1.0'))
scene.render.image_settings.file_format = 'PNG'; scene.render.image_settings.color_mode = 'RGBA'; scene.render.image_settings.color_depth = '16'
def render(path, samples):
    if os.environ.get('DRY'): return
    scene.cycles.samples = samples; scene.cycles.use_denoising = True; scene.cycles.max_bounces = 6
    scene.render.filepath = os.path.join(OUT, path); bpy.ops.render.render(write_still=True)

assign('diffuse'); render('diffuse.png', SAMPLES)
assign('gloss'); render('gloss.png', SAMPLES)
meta = {'pxu': PXU, 'width': scene.render.resolution_x, 'height': scene.render.resolution_y, 'items': {}}
for k, (cx, cy, w, h) in placed.items():
    x0, y0 = to_px(cx - w / 2, cy + h / 2)
    meta['items'][k] = {'x': x0, 'y': y0, 'w': w * PXU, 'h': h * PXU, 'u': [w, h]}
json.dump(meta, open(os.path.join(OUT, 'meta.json'), 'w'), indent=1)
print('done keys', meta['width'], meta['height'])

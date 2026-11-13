"""Souris modélisées de zéro (aucun modèle tiers, aucun logo), rendues en vue de dessus avec
Cycles, en calques recolorables comme les manettes.

MODEL=<clé> blender-python render_mouse.py -- <out_dir>

Clés : regie, superlight, deathadder, g502, viper, model_o (voir MODELS).
Les silhouettes reprennent les proportions publiées des souris connues (longueur, largeur,
hauteur), normalisées sur une longueur de 1.
Sorties : diffuse.png, gloss.png, mask_XX.png, meta.json (même format que render_pad.py).
"""
import bpy, bmesh, json, math, os, sys
import numpy as np
from mathutils import Vector

OUT = sys.argv[sys.argv.index('--') + 1]
KEY = os.environ.get('MODEL', 'regie')
SAMPLES = int(os.environ.get('SAMPLES', '64'))
WIDTH = int(os.environ.get('WIDTH', '640'))
os.makedirs(OUT, exist_ok=True)

# ---------- catalogue ----------
# hw / hwr : demi-largeur réelle (gauche / droite) le long de v ∈ [-1 arrière, 1 avant]
# crown : hauteur du dessus au milieu ; tilt : le côté droit plus bas (ergonomique droitier)
# split : couture boutons/paume y = s0 - s2·(x/0.3)² ; wheel : centre (v), demi-longueur du puits
# sides : boutons de pouce (côté, v, demi-longueur, bouton, retrait vers l'intérieur)
# caps : petits boutons posés dans un logement (nom, zone, x, v, demi-largeur, demi-hauteur, arrondi)
MODELS = {
    'regie': dict(
        hw=[(-0.6, 0.275), (-0.3, 0.272), (0.0, 0.255), (0.25, 0.238), (0.5, 0.244), (0.7, 0.24)], ends=(-0.5, 2.0, 0.62, 2.4),
        crown=[(-1, 0.2), (-0.5, 0.28), (-0.15, 0.3), (0.3, 0.24), (0.7, 0.19), (1, 0.17)],
        split=(0.035, 0.07), wheel=(0.58, 0.105), a=2.4, b=3.0,
        sides=[(-1, 0.0, 0.054, 5, 0), (-1, -0.25, 0.054, 4, 0)],
        caps=[('dpi', 'buttons', 0, 0.256, 0.0215, 0.0245, 0.009)],
        light=[('bar', 0, -0.63, 0.079, 0.0085)]),
    'superlight': dict(  # 125 × 63,5 × 40 mm
        hw=[(-0.6, 0.25), (-0.35, 0.254), (-0.1, 0.249), (0.2, 0.237), (0.5, 0.237), (0.7, 0.236)], ends=(-0.45, 2.0, 0.6, 2.2),
        crown=[(-1, 0.24), (-0.5, 0.285), (-0.2, 0.296), (0.2, 0.255), (0.6, 0.19), (1, 0.15)],
        split=(0.0, 0.05), wheel=(0.58, 0.1), a=2.3, b=2.6,
        sides=[(-1, 0.07, 0.056, 5, 0), (-1, -0.18, 0.056, 4, 0)]),
    'deathadder': dict(  # 128 × 68 × 44 mm, droitier
        hw=[(-0.6, 0.235), (-0.3, 0.232), (0.0, 0.205), (0.25, 0.205), (0.5, 0.218), (0.7, 0.215)], ends=(-0.45, 2.0, 0.58, 2.2),
        hwr=[(-0.6, 0.28), (-0.3, 0.298), (0.0, 0.285), (0.3, 0.258), (0.5, 0.24), (0.7, 0.232)],
        crown=[(-1, 0.25), (-0.5, 0.33), (-0.15, 0.345), (0.25, 0.285), (0.6, 0.2), (1, 0.15)], tilt=0.22,
        split=(-0.02, 0.085), wheel=(0.56, 0.1), a=2.2, b=2.7,
        sides=[(-1, 0.13, 0.062, 5, 0), (-1, -0.13, 0.062, 4, 0)]),
    'g502': dict(  # 132 × 75 × 40 mm, aile de pouce
        hw=[(-0.6, 0.295), (-0.35, 0.318), (-0.05, 0.31), (0.15, 0.27), (0.35, 0.232), (0.7, 0.222)], ends=(-0.5, 2.2, 0.62, 2.6),
        hwr=[(-0.6, 0.25), (-0.3, 0.258), (0.0, 0.248), (0.4, 0.226), (0.7, 0.216)],
        crown=[(-1, 0.2), (-0.6, 0.27), (-0.3, 0.29), (0.1, 0.25), (0.5, 0.19), (1, 0.13)], tilt=0.12,
        split=(0.03, 0.11), wheel=(0.55, 0.115), wheel_r=0.06, wheel_w=0.046, a=2.0, b=2.8,
        sides=[(-1, 0.12, 0.05, 5, 0.07), (-1, -0.08, 0.05, 4, 0.075), (-1, 0.32, 0.035, None, 0)],
        caps=[('g9', 'buttons', 0, 0.245, 0.02, 0.016, 0.008),
              ('dpi_up', 'buttons', -0.168, 0.56, 0.019, 0.03, 0.01), ('dpi_down', 'buttons', -0.168, 0.43, 0.019, 0.03, 0.01)],
        light=[('dot', -0.168, 0.3, 0.0065, 0.0065), ('dot', -0.168, 0.265, 0.0065, 0.0065), ('dot', -0.168, 0.23, 0.0065, 0.0065)]),
    'viper': dict(  # 127 × 66 × 38 mm, ambidextre
        hw=[(-0.6, 0.258), (-0.35, 0.263), (-0.05, 0.246), (0.2, 0.229), (0.45, 0.238), (0.7, 0.252)], ends=(-0.45, 2.0, 0.66, 2.8),
        crown=[(-1, 0.2), (-0.5, 0.27), (-0.2, 0.28), (0.2, 0.24), (0.6, 0.18), (1, 0.12)],
        split=(0.01, 0.05), wheel=(0.6, 0.1), a=2.5, b=3.4,
        sides=[(-1, 0.13, 0.055, 5, 0), (-1, -0.1, 0.055, 4, 0), (1, 0.13, 0.055, 5, 0), (1, -0.1, 0.055, 4, 0)]),
    'model_o': dict(  # 128 × 66 × 37,5 mm, nid d'abeille
        hw=[(-0.6, 0.252), (-0.35, 0.258), (-0.05, 0.246), (0.25, 0.233), (0.5, 0.236), (0.7, 0.232)], ends=(-0.45, 2.0, 0.6, 2.3),
        crown=[(-1, 0.2), (-0.5, 0.265), (-0.2, 0.275), (0.2, 0.24), (0.6, 0.18), (1, 0.12)],
        split=(0.0, 0.06), wheel=(0.58, 0.1), a=2.4, b=2.9, honeycomb=True, plate='light',
        sides=[(-1, 0.08, 0.055, 5, 0), (-1, -0.16, 0.055, 4, 0)]),
}
M = MODELS[KEY]

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
LIFT = 0.022
L2 = 0.5
A_EXP, B_EXP, K = M.get('a', 2.4), M.get('b', 3.0), 1.35
OY = -0.24          # centre des anneaux du maillage, posé dans la paume, loin des coutures
TILT = M.get('tilt', 0.0)

def spline(points):
    """Courbe lisse (Catmull-Rom) passant par les points, évaluée par interpolation dense."""
    pts = sorted(points)
    P = [(2 * pts[0][0] - pts[1][0], pts[0][1])] + pts + [(2 * pts[-1][0] - pts[-2][0], pts[-1][1])]
    X, Y = [], []
    for i in range(1, len(P) - 2):
        p0, p1, p2, p3 = P[i - 1], P[i], P[i + 1], P[i + 2]
        for t in np.linspace(0, 1, 40, endpoint=False):
            t2, t3 = t * t, t * t * t
            for k, arr in ((0, X), (1, Y)):
                arr.append(0.5 * (2 * p1[k] + (-p0[k] + p2[k]) * t + (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * t2 + (-p0[k] + 3 * p1[k] - 3 * p2[k] + p3[k]) * t3))
    X.append(pts[-1][0]); Y.append(pts[-1][1])
    X, Y = np.array(X), np.array(Y); o = np.argsort(X)
    return lambda v: np.interp(v, X[o], Y[o])

HWL = spline(M['hw']); HWR = spline(M.get('hwr', M['hw'])); CROWN = spline(M['crown'])
VR, PR, VF, PF = M.get('ends', (-0.5, 2.0, 0.62, 2.4))
def endround(v):
    # bouts arrondis : superellipse entre le début de l'arrondi et la pointe
    rear = np.clip((VR - v) / (1 + VR), 0, 1); front = np.clip((v - VF) / (1 - VF), 0, 1)
    t = np.maximum(rear, front); p = np.where(rear > 0, PR, PF)
    return np.clip(1 - t ** p, 0, 1) ** (1 / p)
def hw_actual(x, v):
    vc = np.clip(v, -0.6, 0.7)
    return np.where(x < 0, HWL(vc), HWR(vc)) * endround(v)
def wfun(x, v):
    return hw_actual(x, v) / np.maximum(1 - np.abs(v) ** B_EXP, 1e-6) ** (1 / A_EXP) + 1e-6
def rfun(x, y):
    v = y / L2
    return (np.abs(x) / wfun(x, v)) ** A_EXP + np.abs(v) ** B_EXP
def zcap(x, y, rho):
    return LIFT + CROWN(y / L2) * (1 - TILT * x / 0.3) * np.sqrt(np.clip(1 - np.clip(rho, 0, 1) ** K, 0, 1))
def height(x, y):
    return zcap(x, y, rfun(x, y))
def edge_x(side, y):
    """Demi-largeur réelle du contour à la hauteur y, du côté donné (-1 gauche, 1 droite)."""
    return float(hw_actual(np.array(side * 0.1), np.array(y / L2)))

def ray_t(theta, rho, scale=1.0):
    c, s = np.cos(theta), np.sin(theta)
    lo = np.zeros_like(theta); hi = np.full_like(theta, 0.8)
    for _ in range(40):
        mid = (lo + hi) / 2
        inside = rfun(mid * c / scale, (OY + mid * s) / scale) < rho
        lo = np.where(inside, mid, lo); hi = np.where(inside, hi, mid)
    return (lo + hi) / 2

NT, NR = 320, 72
THETA = np.linspace(0, 2 * np.pi, NT, endpoint=False)

def dome_mesh(name, zoff=0.0, scale=1.0):
    """Anneaux homothétiques du contour autour d'un point de la paume ; la hauteur vient du champ r(x, y)."""
    tb = ray_t(THETA, 0.9999, scale)
    ss = 1 - (1 - np.linspace(0, 1, NR + 1)[1:]) ** 2.2
    def zat(x, y):
        rho = np.clip(rfun(x / scale, y / scale), 0, 1)
        return zcap(x / scale, y / scale, rho) + zoff
    verts = [(0.0, OY, float(zat(np.array(0.0), np.array(OY))))]
    for sv in ss:
        x, y = sv * tb * np.cos(THETA), OY + sv * tb * np.sin(THETA)
        z = np.where(sv >= 0.9999, LIFT + zoff, zat(x, y))
        verts += list(zip(x.tolist(), y.tolist(), z.tolist()))
    faces = [(0, 1 + j, 1 + (j + 1) % NT) for j in range(NT)]
    for i in range(NR - 1):
        a, b = 1 + i * NT, 1 + (i + 1) * NT
        for j in range(NT):
            j2 = (j + 1) % NT
            faces.append((a + j, b + j, b + j2, a + j2))
    outer = 1 + (NR - 1) * NT
    bottom = len(verts); verts.append((0.0, OY, float(LIFT + zoff - 0.002)))
    for j in range(NT):
        faces.append((outer + (j + 1) % NT, outer + j, bottom))
    me = bpy.data.meshes.new(name); me.from_pydata(verts, [], faces); me.update()
    ob = bpy.data.objects.new(name, me); scene.collection.objects.link(ob)
    for p in me.polygons: p.use_smooth = True
    return ob

def outline(offset=0.0, n=NT):
    th = np.linspace(0, 2 * np.pi, n, endpoint=False)
    t = ray_t(th, 0.9999)
    pts = np.stack([t * np.cos(th), OY + t * np.sin(th)], 1)
    if offset:
        nxt, prv = np.roll(pts, -1, 0), np.roll(pts, 1, 0)
        tan = nxt - prv; nrm = np.stack([tan[:, 1], -tan[:, 0]], 1)
        nrm /= np.linalg.norm(nrm, axis=1, keepdims=True)
        pts = pts + nrm * offset
    return pts

def prism_bm(bm, pts, z0, z1):
    lo = [bm.verts.new((float(x), float(y), z0)) for x, y in pts]
    hi = [bm.verts.new((float(x), float(y), z1)) for x, y in pts]
    bm.faces.new(lo[::-1]); bm.faces.new(hi)
    n = len(pts)
    for i in range(n):
        j = (i + 1) % n
        bm.faces.new((lo[i], lo[j], hi[j], hi[i]))

def prism(name, pts, z0=-0.2, z1=0.8, many=False):
    bm = bmesh.new()
    for p in (pts if many else [pts]): prism_bm(bm, p, z0, z1)
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
    ob = bpy.data.objects.new(name, me); scene.collection.objects.link(ob); return ob

def rrect(cx, cy, hw, hh, r, n=10):
    r = min(r, hw, hh)
    pts = []
    for qx, qy, a0 in ((1, 1, 0), (-1, 1, 90), (-1, -1, 180), (1, -1, 270)):
        ox, oy = cx + qx * (hw - r), cy + qy * (hh - r)
        for i in range(n + 1):
            a = math.radians(a0 + 90 * i / n)
            pts.append((ox + r * math.cos(a), oy + r * math.sin(a)))
    return pts

def band(fx, xs, gap):
    top, bot = [], []
    for x in xs:
        y = fx(x); dy = (fx(x + 1e-4) - fx(x - 1e-4)) / 2e-4
        nx, ny = -dy, 1.0; l = math.hypot(nx, ny); nx, ny = nx / l, ny / l
        top.append((x + nx * gap / 2, y + ny * gap / 2)); bot.append((x - nx * gap / 2, y - ny * gap / 2))
    return bot + top[::-1]

def boolean(target, cutter):
    m = target.modifiers.new('cut', 'BOOLEAN'); m.operation = 'DIFFERENCE'; m.object = cutter; m.solver = 'EXACT'
    bpy.context.view_layer.objects.active = target
    bpy.ops.object.select_all(action='DESELECT'); target.select_set(True)
    bpy.ops.object.modifier_apply(modifier=m.name)

# ---------- corps et découpes ----------
body = dome_mesh('body')
GAP = 0.0045
S0, S2 = M['split']
SPLIT = lambda x: S0 - S2 * (x / 0.3) ** 2
WV, WHH = M['wheel']; WY = WV * L2
WR, WW = M.get('wheel_r', 0.054), M.get('wheel_w', 0.038)
WELL_HW = WW / 2 + 0.011
caps = [(n, z, x, v * L2, hw, hh, r) for n, z, x, v, hw, hh, r in M.get('caps', [])]
lights = [(kind, x, v * L2, hw, hh) for kind, x, v, hw, hh in M.get('light', [])]
cutters = [
    prism('c_split', band(SPLIT, np.linspace(-0.45, 0.45, 140), GAP)),
    prism('c_mid', [(-GAP / 2, SPLIT(0) - 0.001), (GAP / 2, SPLIT(0) - 0.001), (GAP / 2, 0.62), (-GAP / 2, 0.62)]),
    prism('c_well', rrect(0, WY, WELL_HW, WR + 0.018, 0.02)),
]
for n, z, x, y, hw, hh, r in caps:
    cutters.append(prism(f'c_{n}', rrect(x, y, hw + 0.0055, hh + 0.0055, r + 0.0055)))
for kind, x, y, hw, hh in lights:
    cutters.append(prism('c_light', rrect(x, y, hw + 0.006, hh + 0.005, hh + 0.005)))
if M.get('honeycomb'):
    holes = []
    pitch, rad = 0.036, 0.0155
    for row in range(-16, 17):
        for col in range(-10, 11):
            x = col * pitch * 0.866; y = row * pitch + (pitch / 2 if col % 2 else 0)
            if rfun(np.array(x), np.array(y)) > 0.6: continue
            if abs(y - SPLIT(x)) < 0.028 or abs(x) < 0.03: continue
            if abs(x) < WELL_HW + 0.03 and abs(y - WY) < WHH + 0.03: continue
            holes.append([(x + rad * math.cos(math.radians(60 * k)), y + rad * math.sin(math.radians(60 * k))) for k in range(6)])
    cutters.append(prism('c_honey', holes, many=True))
    print('honeycomb holes', len(holes))
for c in cutters:
    boolean(body, c); bpy.data.objects.remove(c)

def centroid(ob):
    vs = [ob.matrix_world @ v.co for v in ob.data.vertices]
    return sum(vs, Vector()) / len(vs), len(vs)
bpy.ops.object.select_all(action='DESELECT'); body.select_set(True); bpy.context.view_layer.objects.active = body
bpy.ops.object.mode_set(mode='EDIT'); bpy.ops.mesh.select_all(action='SELECT'); bpy.ops.mesh.separate(type='LOOSE'); bpy.ops.object.mode_set(mode='OBJECT')
pieces = [o for o in scene.objects if o.name.startswith('body')]

objects, roles = {}, {}
for ob in pieces:
    c, n = centroid(ob)
    if n < 30: bpy.data.objects.remove(ob); continue
    if c.y > SPLIT(c.x) and abs(c.x) > 0.02:
        name = 'left_button' if c.x < 0 else 'right_button'; role = dict(zone='buttons', btn=1 if c.x < 0 else 2)
    else:
        name = 'palm'; role = dict(zone='shell')
    if name in objects: name += f'_{len(objects)}'
    ob.name = name; objects[name] = ob; roles[name] = role

core = dome_mesh('core', zoff=-0.013, scale=0.985)
objects['core'] = core; roles['core'] = dict(zone='core')

def plate():
    pts = outline(0.006, 220)
    bm = bmesh.new()
    vs = [bm.verts.new((float(x), float(y), 0.0)) for x, y in pts]
    f = bm.faces.new(vs)
    r = bmesh.ops.extrude_face_region(bm, geom=[f])
    for v in [e for e in r['geom'] if isinstance(e, bmesh.types.BMVert)]: v.co.z = 0.03
    me = bpy.data.meshes.new('plate'); bm.to_mesh(me); bm.free()
    ob = bpy.data.objects.new('plate', me); scene.collection.objects.link(ob)
    bv = ob.modifiers.new('bv', 'BEVEL'); bv.width = 0.012; bv.segments = 6; bv.limit_method = 'ANGLE'
    for p in me.polygons: p.use_smooth = True
    return ob
if M.get('plate') == 'light':   # bande lumineuse sous la coque (Model O)
    objects['plate'] = plate(); roles['plate'] = dict(zone='light')

def wheel():
    bpy.ops.mesh.primitive_cylinder_add(vertices=96, radius=WR, depth=WW, location=(0, WY, 0))
    ob = bpy.context.active_object; ob.rotation_euler = (0, math.radians(90), 0)
    ob.location.z = float(height(np.array(WELL_HW + 0.01), np.array(WY))) + 0.022 - WR
    bv = ob.modifiers.new('bv', 'BEVEL'); bv.width = 0.008; bv.segments = 5; bv.limit_method = 'ANGLE'
    bpy.ops.object.shade_smooth_by_angle(angle=math.radians(35))
    ob.name = 'wheel'; return ob
objects['wheel'] = wheel(); roles['wheel'] = dict(zone='sticks', btn=3, wheel=True)

def cap(name, cx, cy, hw, hh, r, h=0.02, sink=0.003):
    pts = rrect(cx, cy, hw, hh, r)
    z = float(height(np.array(cx + math.copysign(hw * 0.6, cx or 1)), np.array(cy))) - sink
    ob = prism(name, pts, z - h, z)
    bv = ob.modifiers.new('bv', 'BEVEL'); bv.width = min(hw, hh) * 0.45; bv.segments = 5; bv.limit_method = 'ANGLE'
    for p in ob.data.polygons: p.use_smooth = True
    return ob
for n, z, x, y, hw, hh, r in caps:
    objects[n] = cap(n, x, y, hw, hh, r); roles[n] = dict(zone=z)
for i, (kind, x, y, hw, hh) in enumerate(lights):
    n = f'light_{i}'
    objects[n] = cap(n, x, y, hw, hh, hh, h=0.02, sink=0.006); roles[n] = dict(zone='light')

def side(name, sd, cy, length, btn, inset):
    ex = edge_x(sd, cy)
    x = sd * (ex - 0.010 - inset)
    z = LIFT + 0.085 if not inset else float(height(np.array(x), np.array(cy))) - 0.004
    bpy.ops.mesh.primitive_uv_sphere_add(segments=48, ring_count=24, radius=1, location=(x, cy, z))
    ob = bpy.context.active_object; ob.scale = (0.016, length, 0.022)
    bpy.ops.object.shade_smooth()
    ob.name = name; objects[name] = ob
    roles[name] = dict(zone='buttons', btn=btn) if btn else dict(zone='buttons')
for i, (sd, v, length, btn, inset) in enumerate(M.get('sides', [])):
    side(f'side_{i}', sd, v * L2, length, btn, inset)
bpy.context.view_layer.update()

# ---------- matières ----------
FINISH = {
    'shell': (0.42, 0.08, (0.03, 700, 'noise')),
    'grips': (0.6, 0.0, (0.06, 320, 'noise')),
    'buttons': (0.32, 0.18, (0.02, 800, 'noise')),
    'sticks': (0.85, 0.0, (0.0, 1, 'teeth')),
    'light': (0.12, 0.5, (0.0, 1, 'noise')),
    'core': (0.6, 0.0, (0.0, 1, 'noise')),
}
def zone_material(zone, mode):
    rough, coat, (bs, bscale, kind) = FINISH[zone]
    m = bpy.data.materials.new(f'{zone}_{mode}'); m.use_nodes = True
    nt = m.node_tree; b = nt.nodes['Principled BSDF']
    if mode == 'diffuse':
        b.inputs['Base Color'].default_value = (0.8, 0.8, 0.8, 1); b.inputs['Specular IOR Level'].default_value = 0.0
        b.inputs['Roughness'].default_value = 1.0
        if zone == 'light':
            b.inputs['Emission Color'].default_value = (1, 1, 1, 1); b.inputs['Emission Strength'].default_value = 1.6
    else:
        b.inputs['Base Color'].default_value = (0, 0, 0, 1); b.inputs['Roughness'].default_value = rough
        b.inputs['Coat Weight'].default_value = coat; b.inputs['Coat Roughness'].default_value = 0.08
    hnode = None
    if kind == 'teeth':
        tc = nt.nodes.new('ShaderNodeTexCoord'); sep = nt.nodes.new('ShaderNodeSeparateXYZ')
        nt.links.new(tc.outputs['Object'], sep.inputs[0])
        at = nt.nodes.new('ShaderNodeMath'); at.operation = 'ARCTAN2'
        nt.links.new(sep.outputs['Y'], at.inputs[0]); nt.links.new(sep.outputs['X'], at.inputs[1])
        mul = nt.nodes.new('ShaderNodeMath'); mul.operation = 'MULTIPLY'; mul.inputs[1].default_value = 34
        nt.links.new(at.outputs[0], mul.inputs[0])
        sn = nt.nodes.new('ShaderNodeMath'); sn.operation = 'SINE'; nt.links.new(mul.outputs[0], sn.inputs[0])
        hnode = sn.outputs[0]; bs = 0.35
    elif bs > 0:
        tc = nt.nodes.new('ShaderNodeTexCoord'); tex = nt.nodes.new('ShaderNodeTexNoise')
        tex.inputs['Scale'].default_value = bscale; nt.links.new(tc.outputs['Object'], tex.inputs['Vector'])
        hnode = tex.outputs['Fac']
    if hnode is not None:
        bump = nt.nodes.new('ShaderNodeBump'); bump.inputs['Strength'].default_value = bs; bump.inputs['Distance'].default_value = 0.002
        nt.links.new(hnode, bump.inputs['Height']); nt.links.new(bump.outputs['Normal'], b.inputs['Normal'])
        if 'Coat Normal' in b.inputs: nt.links.new(bump.outputs['Normal'], b.inputs['Coat Normal'])
    return m
MATS = {mode: {z: zone_material(z, mode) for z in FINISH} for mode in ('diffuse', 'gloss')}
def assign(mode):
    for n, ob in objects.items():
        ob.data.materials.clear(); ob.data.materials.append(MATS[mode][roles[n]['zone']])

def bbox(ob):
    pts = [ob.matrix_world @ Vector(c) for c in ob.bound_box]
    return Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts))), Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts)))
# Cadre commun à toutes les souris : même échelle, centré sur le corps, pour pouvoir changer de modèle sans saut.
cx, cy, W, H = 0.0, 0.0, 0.72, 1.1
cam = bpy.data.cameras.new('cam'); cam.type = 'ORTHO'; cam.ortho_scale = max(W, H)
co = bpy.data.objects.new('cam', cam); scene.collection.objects.link(co); scene.camera = co
co.location = (cx, cy, 5)
scene.render.resolution_x = WIDTH; scene.render.resolution_y = int(round(WIDTH * H / W)); scene.render.resolution_percentage = 100
PX = scene.render.resolution_y / H
def to_px(v): return ((v.x - (cx - W / 2)) * PX, ((cy + H / 2) - v.y) * PX)

def area(name, loc, size, power, rot):
    l = bpy.data.lights.new(name, 'AREA'); l.size = size; l.energy = power
    o = bpy.data.objects.new(name, l); o.location = loc; o.rotation_euler = rot; scene.collection.objects.link(o)
area('key', (cx - 1.4, cy - 1.6, 3.4), 3.5, float(os.environ.get('KEYW', '150')), (math.radians(28), math.radians(-22), 0))
area('fill', (cx + 2.6, cy - 0.4, 2.4), 3.0, 55, (math.radians(10), math.radians(48), 0))
area('rim', (cx, cy + 3.0, 1.3), 3.0, 70, (math.radians(-62), 0, 0))
area('soft', (cx + 0.3, cy + 0.9, 3.0), 2.2, float(os.environ.get('SOFTW', '90')), (math.radians(-17), math.radians(6), 0))
world = bpy.data.worlds.new('w'); scene.world = world; world.use_nodes = True
bg = world.node_tree.nodes['Background']; bg.inputs['Color'].default_value = (1, 1, 1, 1); bg.inputs['Strength'].default_value = 0.2

scene.render.engine = 'CYCLES'; scene.cycles.device = 'CPU'
scene.render.film_transparent = True
scene.view_settings.view_transform = 'Standard'; scene.view_settings.look = 'None'
scene.render.image_settings.file_format = 'PNG'; scene.render.image_settings.color_mode = 'RGBA'; scene.render.image_settings.color_depth = '16'

def render(path, samples, denoise=True, bounces=None):
    if os.environ.get('DRY'): return
    scene.cycles.samples = samples; scene.cycles.use_denoising = denoise
    if bounces is not None: scene.cycles.max_bounces = bounces
    scene.render.filepath = os.path.join(OUT, path)
    bpy.ops.render.render(write_still=True)

if os.environ.get('DRY'):
    for n, ob in objects.items():
        a, b = bbox(ob); print('BB', n, roles[n], [round(v, 3) for v in a], [round(v, 3) for v in b], len(ob.data.vertices))

EXPO = float(os.environ.get('EXPO', '-1.1'))
scene.view_settings.exposure = EXPO
assign('diffuse'); render('diffuse.png', SAMPLES, bounces=6)
if os.environ.get('ONLY_DIFFUSE'): sys.exit(0)
assign('gloss'); render('gloss.png', SAMPLES, bounces=6)

def flat(color):
    m = bpy.data.materials.new('flat'); m.use_nodes = True; nt = m.node_tree
    for n in list(nt.nodes): nt.nodes.remove(n)
    e = nt.nodes.new('ShaderNodeEmission'); e.inputs['Color'].default_value = (*color, 1); e.inputs['Strength'].default_value = 1
    out = nt.nodes.new('ShaderNodeOutputMaterial'); nt.links.new(e.outputs['Emission'], out.inputs['Surface']); return m
BLACK = flat((0, 0, 0)); CH = [flat((1, 0, 0)), flat((0, 1, 0)), flat((0, 0, 1))]
scene.view_settings.exposure = 0
names = list(objects)
masks = []
for k in range(0, len(names), 3):
    group = names[k:k + 3]
    for n, ob in objects.items():
        ob.data.materials.clear(); ob.data.materials.append(CH[group.index(n)] if n in group else BLACK)
    fname = f'mask_{k // 3:02d}.png'
    render(fname, 24, denoise=False, bounces=0)
    masks.append({'file': fname, 'parts': group})

wa, wb = bbox(objects['wheel']); wc = to_px((wa + wb) / 2)
meta = {'key': f'mouse_{KEY}', 'width': scene.render.resolution_x, 'height': scene.render.resolution_y, 'roles': roles, 'masks': masks,
        'sticks': {}, 'wheel': {'cx': wc[0], 'cy': wc[1], 'hw': (wb.x - wa.x) / 2 * PX, 'hh': (wb.y - wa.y) / 2 * PX}}
json.dump(meta, open(os.path.join(OUT, 'meta.json'), 'w'), indent=1)
print('done', KEY, meta['width'], meta['height'])

"""Rendu « vraie manette » : modèles 3D de 3D Controller Overlay (Larf, MIT) via 3dco+,
rendus en vue de dessus avec Cycles, en calques recolorables.

blender-python render_pad.py -- <model_key> <models_root> <out_dir>

Sorties (out_dir) :
  diffuse.png  lumière diffuse, matière neutre (albédo 0.8), symboles en vraie couleur
  gloss.png    reflets seuls (albédo noir)
  mask_XX.png  couverture anticrénelée de chaque pièce (3 pièces par image, une par canal)
  sticks_diffuse.png / sticks_gloss.png  sticks seuls (ils bougent)
  meta.json    pièces, zones, boutons, géométrie
"""
import bpy, json, math, os, sys
from mathutils import Vector, Matrix

argv = sys.argv[sys.argv.index('--') + 1:]
KEY, ROOT, OUT = argv[0], argv[1], argv[2]
SAMPLES = int(os.environ.get('SAMPLES', '96'))
WIDTH = int(os.environ.get('WIDTH', '1240'))
os.makedirs(OUT, exist_ok=True)

CONFIG = {
    'ps5': dict(dir='DualSense', zones={'top_shell': 'shell', 'bottom_shell': 'grips', 'extra': 'light', 'touchpad': 'shell'}, guide='buttons', legends='ps5'),
    'ps4': dict(dir='DualShock 4', zones={'top_shell': 'shell', 'bottom_shell': 'grips', 'extra': 'light', 'touchpad': 'grips'}, guide='buttons', legends='ps4'),
    'xbox': dict(dir='Xbox One', zones={'top_shell': 'shell', 'bottom_shell': 'grips', 'extra': 'grips'}, guide='light', legends='xbox'),
    'xbox_360': dict(dir='Xbox 360', zones={'top_shell': 'shell', 'bottom_shell': 'grips', 'extra': 'grips'}, guide='light', legends='xbox'),
    'switch_pro': dict(dir='Switch Pro', zones={'top_shell': 'shell', 'bottom_shell': 'grips', 'extra': 'grips', 'misc': 'buttons'}, guide='buttons', legends='switch'),
}[KEY]
MODEL_DIR = os.path.join(ROOT, CONFIG['dir'])
BTN = {'a_button': 0, 'b_button': 1, 'x_button': 2, 'y_button': 3, 'left_bumper': 4, 'right_bumper': 5,
       'left_trigger': 6, 'right_trigger': 7, 'back_button': 8, 'start_button': 9, 'dpad_up': 12, 'dpad_down': 13,
       'dpad_left': 14, 'dpad_right': 15, 'guide_button': 16, 'touchpad': 17, 'misc': 17}
STICK = {'left_stick': 'l', 'left_cap': 'l', 'right_stick': 'r', 'right_cap': 'r'}

# Matières : relief et brillance réalistes, couleur neutre (la couleur est posée dans l'overlay).
FINISH = {  # roughness, coat, bump (strength, scale, kind)
    'shell': (0.36, 0.12, (0.025, 900, 'noise')),
    'grips': (0.55, 0.0, (0.09, 260, 'voronoi')),
    'buttons': (0.2, 0.45, (0.01, 900, 'noise')),
    'sticks': (0.82, 0.0, (0.12, 500, 'noise')),
    'triggers': (0.42, 0.1, (0.02, 900, 'noise')),
    'light': (0.25, 0.3, (0.0, 1, 'noise')),
}

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
info = json.load(open(os.path.join(MODEL_DIR, 'info.json')))
parts = info['parts']

def world_pos(i):
    p = parts[i]; x, y, z = p['position']
    if p.get('parent', -1) >= 0:
        px, py, pz = world_pos(p['parent']); x, y, z = x + px, y + py, z + pz
    return x, y, z

objects = {}   # name -> object
for i, p in enumerate(parts):
    name = p['filename'][:-4]
    if name.startswith('touch_point') or not p.get('visible', True): continue
    before = set(bpy.data.objects)
    bpy.ops.wm.obj_import(filepath=os.path.join(MODEL_DIR, p['filename']), forward_axis='NEGATIVE_Z', up_axis='Y')
    new = list(set(bpy.data.objects) - before)
    if not new: continue
    if len(new) > 1:
        bpy.ops.object.select_all(action='DESELECT')
        for o in new: o.select_set(True)
        bpy.context.view_layer.objects.active = new[0]; bpy.ops.object.join()
    ob = bpy.context.view_layer.objects.active if len(new) > 1 else new[0]
    x, y, z = world_pos(i)
    rx, ry, rz = (math.radians(a) for a in p.get('rotation', [0, 0, 0]))
    ob.location = (x, -z, y)
    ob.rotation_euler = (ob.rotation_euler.x + rx, ob.rotation_euler.y - rz, ob.rotation_euler.z + ry)  # garde la conversion d'axes de l'import
    ob.name = name
    bpy.ops.object.select_all(action='DESELECT'); ob.select_set(True); bpy.context.view_layer.objects.active = ob
    bpy.ops.object.shade_smooth_by_angle(angle=math.radians(40))
    m = ob.modifiers.new('sub', 'SUBSURF'); m.levels = 1; m.render_levels = 2
    objects[name] = ob
bpy.context.view_layer.update()

def bbox(ob):
    pts = [ob.matrix_world @ Vector(c) for c in ob.bound_box]
    return Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts))), Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts)))

# Gâchettes : TRIG=raised (redressées au-dessus), natural (position réelle), flat (à plat derrière), none (masquées)
TRIG = os.environ.get('TRIG', 'raised')
for side in ('left', 'right'):
    t, b = objects.get(f'{side}_trigger'), objects.get(f'{side}_bumper')
    if not t or not b: continue
    if TRIG == 'none':
        bpy.data.objects.remove(t); objects.pop(f'{side}_trigger'); continue
    if TRIG == 'natural': continue
    t.rotation_euler.x = math.radians(-70 if TRIG == 'raised' else float(os.environ.get('TRIG_ANGLE', '15')))
    bpy.context.view_layer.update()
    tmin, tmax = bbox(t); bmin, bmax = bbox(b)
    t.location.y += (bmax.y - (0.05 if TRIG == 'raised' else 0.09)) - tmin.y
    t.location.z -= (tmax.z - bmin.z) + 0.01
    bpy.context.view_layer.update()

# Rôles
def role(name):
    if name in STICK: return dict(zone='sticks', btn=10 if STICK[name] == 'l' else 11, stick=STICK[name])
    zone = CONFIG['zones'].get(name)
    if name == 'guide_button': zone = CONFIG['guide']
    if zone is None:
        zone = 'sticks' if name.endswith('_ring') else 'triggers' if ('trigger' in name or 'bumper' in name) else 'buttons'
    return dict(zone=zone, btn=BTN.get(name))
roles = {n: role(n) for n in objects}

# Symboles des boutons de façade (pas de logos de marque).
LEG = {
    'xbox': {'a_button': ('A', (0.18, 0.62, 0.20)), 'b_button': ('B', (0.80, 0.10, 0.10)), 'x_button': ('X', (0.10, 0.35, 0.85)), 'y_button': ('Y', (0.95, 0.75, 0.05))},
    'switch': {'a_button': ('B', (0.85, 0.85, 0.85)), 'b_button': ('A', (0.85, 0.85, 0.85)), 'x_button': ('Y', (0.85, 0.85, 0.85)), 'y_button': ('X', (0.85, 0.85, 0.85))},
    'ps4': {'a_button': ('cross', (0.35, 0.55, 0.95)), 'b_button': ('circle', (0.95, 0.30, 0.35)), 'x_button': ('square', (0.92, 0.50, 0.78)), 'y_button': ('triangle', (0.25, 0.80, 0.60))},
    'ps5': {'a_button': ('cross', (0.42, 0.42, 0.44)), 'b_button': ('circle', (0.42, 0.42, 0.44)), 'x_button': ('square', (0.42, 0.42, 0.44)), 'y_button': ('triangle', (0.42, 0.42, 0.44))},
}[CONFIG['legends']]

def legend_mat(color):
    m = bpy.data.materials.new('legend'); m.use_nodes = True
    b = m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = (*color, 1)
    b.inputs['Emission Color'].default_value = (*color, 1); b.inputs['Emission Strength'].default_value = 0.35
    b.inputs['Roughness'].default_value = 0.3
    return m

def poly_curve(name, pts, closed, width):
    cu = bpy.data.curves.new(name, 'CURVE'); cu.dimensions = '3D'; cu.bevel_depth = width; cu.bevel_resolution = 2
    sp = cu.splines.new('POLY'); sp.points.add(len(pts) - 1)
    for p, (x, y) in zip(sp.points, pts): p.co = (x, y, 0, 1)
    sp.use_cyclic_u = closed
    ob = bpy.data.objects.new(name, cu); scene.collection.objects.link(ob); return ob

bpy.context.view_layer.update()
legends = {}
for bname, (glyph, color) in LEG.items():
    btn = objects.get(bname)
    if not btn: continue
    mn, mx = bbox(btn); c = (mn + mx) / 2; r = min(mx.x - mn.x, mx.y - mn.y) / 2
    s = r * 0.5; w = r * 0.075
    if glyph == 'circle':
        pts = [(math.cos(a) * s * 0.85, math.sin(a) * s * 0.85) for a in [i * 2 * math.pi / 48 for i in range(48)]]; ob = poly_curve('lg', pts, True, w)
    elif glyph == 'square':
        k = s * 0.72; ob = poly_curve('lg', [(-k, -k), (k, -k), (k, k), (-k, k)], True, w)
    elif glyph == 'triangle':
        ob = poly_curve('lg', [(math.cos(a) * s * 0.95, math.sin(a) * s * 0.95 - s * 0.12) for a in (math.pi / 2, math.pi / 2 + 2 * math.pi / 3, math.pi / 2 + 4 * math.pi / 3)], True, w)
    elif glyph == 'cross':
        k = s * 0.78; a = poly_curve('lg', [(-k, -k), (k, k)], False, w); b2 = poly_curve('lg2', [(-k, k), (k, -k)], False, w)
        bpy.ops.object.select_all(action='DESELECT'); a.select_set(True); b2.select_set(True); bpy.context.view_layer.objects.active = a
        bpy.ops.object.convert(target='MESH'); bpy.ops.object.join(); ob = a
    else:
        cu = bpy.data.curves.new('lg', 'FONT'); cu.body = glyph; cu.align_x = 'CENTER'; cu.align_y = 'CENTER'; cu.size = s * 1.75; cu.extrude = 0.002
        ob = bpy.data.objects.new('lg', cu); scene.collection.objects.link(ob)
    ob.location = (c.x, c.y, mx.z + 0.004)
    ob.data.materials.clear() if hasattr(ob.data, 'materials') else None
    ob.data.materials.append(legend_mat(color))
    ob.name = f'legend_{bname}'
    legends[bname] = ob
    roles[ob.name] = dict(zone='legend', btn=BTN[bname], legend=True)
    objects[ob.name] = ob

# Matières par zone, en deux versions : diffuse neutre et reflets seuls.
def zone_material(zone, mode):
    rough, coat, (bs, bscale, kind) = FINISH.get(zone, FINISH['buttons'])
    m = bpy.data.materials.new(f'{zone}_{mode}'); m.use_nodes = True
    nt = m.node_tree; b = nt.nodes['Principled BSDF']
    if mode == 'diffuse':
        b.inputs['Base Color'].default_value = (0.8, 0.8, 0.8, 1); b.inputs['Specular IOR Level'].default_value = 0.0
        b.inputs['Roughness'].default_value = 1.0
    else:
        b.inputs['Base Color'].default_value = (0, 0, 0, 1); b.inputs['Roughness'].default_value = rough
        b.inputs['Coat Weight'].default_value = coat; b.inputs['Coat Roughness'].default_value = 0.08
    if zone == 'light' and mode == 'diffuse':
        b.inputs['Emission Color'].default_value = (1, 1, 1, 1); b.inputs['Emission Strength'].default_value = 1.4
    if bs > 0:
        tc = nt.nodes.new('ShaderNodeTexCoord')
        tex = nt.nodes.new('ShaderNodeTexNoise' if kind == 'noise' else 'ShaderNodeTexVoronoi')
        tex.inputs['Scale'].default_value = bscale
        nt.links.new(tc.outputs['Object'], tex.inputs['Vector'])
        bump = nt.nodes.new('ShaderNodeBump'); bump.inputs['Strength'].default_value = bs; bump.inputs['Distance'].default_value = 0.002
        nt.links.new(tex.outputs['Fac'] if kind == 'noise' else tex.outputs['Distance'], bump.inputs['Height'])
        nt.links.new(bump.outputs['Normal'], b.inputs['Normal'])
        if 'Coat Normal' in b.inputs: nt.links.new(bump.outputs['Normal'], b.inputs['Coat Normal'])
    return m

MATS = {mode: {z: zone_material(z, mode) for z in FINISH} for mode in ('diffuse', 'gloss')}
leg_mats = {n: ob.data.materials[0] for n, ob in legends.items()}
def leg_gloss():
    m = bpy.data.materials.new('legend_gloss'); m.use_nodes = True; b = m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = (0, 0, 0, 1); b.inputs['Roughness'].default_value = 0.3; return m
LEG_GLOSS = leg_gloss()

def assign(mode):
    for n, ob in objects.items():
        r = roles[n]
        if r.get('legend'): m = leg_mats[n[len('legend_'):]] if mode == 'diffuse' else LEG_GLOSS
        else: m = MATS[mode][r['zone']]
        ob.data.materials.clear(); ob.data.materials.append(m)

# Caméra orthographique, vue de dessus stricte.
mins = Vector((1e9,) * 3); maxs = Vector((-1e9,) * 3)
for n, ob in objects.items():
    if n.startswith('legend_'): continue
    a, b = bbox(ob); mins = Vector(map(min, mins, a)); maxs = Vector(map(max, maxs, b))
pad = 0.04
W, H = (maxs.x - mins.x) + 2 * pad, (maxs.y - mins.y) + 2 * pad
cx, cy = (mins.x + maxs.x) / 2, (mins.y + maxs.y) / 2
cam = bpy.data.cameras.new('cam'); cam.type = 'ORTHO'; cam.ortho_scale = max(W, H)
co = bpy.data.objects.new('cam', cam); scene.collection.objects.link(co); scene.camera = co
co.location = (cx, cy, maxs.z + 5); co.rotation_euler = (0, 0, 0)
scene.render.resolution_x = WIDTH; scene.render.resolution_y = int(round(WIDTH * H / W)); scene.render.resolution_percentage = 100
PX = WIDTH / W  # pixels par unité
def to_px(v): return ((v.x - (cx - W / 2)) * PX, ((cy + H / 2) - v.y) * PX)

# Éclairage studio (boîte à lumière principale, contre-jour pour les arêtes, ambiance douce).
def area(name, loc, size, power, rot):
    l = bpy.data.lights.new(name, 'AREA'); l.size = size; l.energy = power
    o = bpy.data.objects.new(name, l); o.location = loc; o.rotation_euler = rot; scene.collection.objects.link(o)
area('key', (cx - 1.6, cy - 2.2, 4.2), 4.5, float(os.environ.get('KEYW', '230')), (math.radians(28), math.radians(-20), 0))
area('fill', (cx + 3.2, cy - 0.6, 3.0), 3.5, 80, (math.radians(10), math.radians(45), 0))
area('rim', (cx, cy + 3.8, 1.6), 4.0, 110, (math.radians(-62), 0, 0))
world = bpy.data.worlds.new('w'); scene.world = world
world.use_nodes = True
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
        a, b = bbox(ob); print('BB', n, [round(v, 2) for v in a], [round(v, 2) for v in b], 'rot', [round(math.degrees(v)) for v in ob.rotation_euler], 'mats', len(ob.data.materials))
stick_objs = [o for n, o in objects.items() if n in STICK]
body_objs = [o for n, o in objects.items() if n not in STICK]

# 1-2 : corps (sans sticks)
EXPO = float(os.environ.get('EXPO', '-1.3'))
scene.view_settings.exposure = EXPO
for o in stick_objs: o.hide_render = True
assign('diffuse'); render('diffuse.png', SAMPLES, bounces=6)
assign('gloss'); render('gloss.png', SAMPLES, bounces=6)
if os.environ.get('ONLY_BODY'): sys.exit(0)

# 3 : masques, trois pièces par rendu (émission pure, un canal par pièce)
names = [n for n in objects if n not in STICK]
def flat(color):
    m = bpy.data.materials.new('flat'); m.use_nodes = True; nt = m.node_tree
    for n in list(nt.nodes): nt.nodes.remove(n)
    e = nt.nodes.new('ShaderNodeEmission'); e.inputs['Color'].default_value = (*color, 1); e.inputs['Strength'].default_value = 1
    out = nt.nodes.new('ShaderNodeOutputMaterial'); nt.links.new(e.outputs['Emission'], out.inputs['Surface']); return m
BLACK = flat((0, 0, 0)); CH = [flat((1, 0, 0)), flat((0, 1, 0)), flat((0, 0, 1))]
scene.view_settings.view_transform = 'Standard'; scene.view_settings.exposure = 0
masks = []
for k in range(0, len(names), 3):
    group = names[k:k + 3]
    for n, ob in objects.items():
        if n in STICK: continue
        ob.data.materials.clear(); ob.data.materials.append(CH[group.index(n)] if n in group else BLACK)
    fname = f'mask_{k // 3:02d}.png'
    render(fname, 24, denoise=False, bounces=0)
    masks.append({'file': fname, 'parts': group})

# 4 : sticks seuls
for o in body_objs: o.hide_render = True
for o in stick_objs: o.hide_render = False
scene.view_settings.exposure = EXPO
assign('diffuse'); render('sticks_diffuse.png', SAMPLES, bounces=6)
assign('gloss'); render('sticks_gloss.png', SAMPLES, bounces=6)

sticks = {}
for side in ('l', 'r'):
    cap = objects.get(f'{"left" if side == "l" else "right"}_cap') or objects.get(f'{"left" if side == "l" else "right"}_stick')
    a, b = bbox(cap); c = to_px((a + b) / 2)
    sticks[side] = {'cx': c[0], 'cy': c[1], 'r': (b.x - a.x) / 2 * PX}
meta = {'key': KEY, 'width': scene.render.resolution_x, 'height': scene.render.resolution_y,
        'roles': roles, 'masks': masks, 'sticks': sticks,
        'source': info.get('source'), 'model_dir': CONFIG['dir']}
json.dump(meta, open(os.path.join(OUT, 'meta.json'), 'w'), indent=1)
print('done', KEY, meta['width'], meta['height'])

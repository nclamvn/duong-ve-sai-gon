"""
Dựng Thu, nữ thanh niên xung phong (DV-077), bằng MPFB 2.0.18 trong Blender (bpy). Tài sản lõi MakeHuman là CC0
(lưới gốc, target, da, quần áo/tóc của gói hệ thống). Không mua, không asset bên thứ ba ngoài CC0.

  - nữ ~19 tuổi, người Á, dáng gầy vừa, thấp vừa; da young_asian_female; tóc tết braid01; lông mày, mi
  - quần áo: male_casualsuit03 (sơ mi dài tay + quần dài) NHUỘM LẠI: áo xanh bạc mặc lâu ngày, quần vải sẫm (không còn sọc, không jeans)
  - chân trần (lội ngầm)
  - xoá thân dưới quần áo theo khoảng cách (tránh đầu gối/khuỷu tay xuyên vải khi cử động)
  - rig Mixamo (52 xương "mixamorig:*"), xuất GLB có skin, không hoạt ảnh
Chạy: python3 scripts/characters/build-thu.py <thư mục data MPFB đã cài gói hệ thống> <out.glb> <thư mục tạm>
"""
import sys, os, math
import bpy, addon_utils, bmesh
from mathutils.bvhtree import BVHTree
from PIL import Image, ImageFilter
import numpy as np

DATA, OUT, TMP = sys.argv[-3], sys.argv[-2], sys.argv[-1]
os.makedirs(TMP, exist_ok=True)
addon_utils.enable('bl_ext.user_default.mpfb', default_set=True)
from bl_ext.user_default.mpfb.services.humanservice import HumanService
from bl_ext.user_default.mpfb.services.targetservice import TargetService

bpy.ops.wm.read_factory_settings(use_empty=True)
macro = TargetService.get_default_macro_info_dict()
macro.update({'gender': 0.0, 'age': 0.37, 'muscle': 0.5, 'weight': 0.4, 'height': 0.42, 'proportions': 0.62, 'cupsize': 0.4, 'firmness': 0.55})
macro['race'] = {'african': 0.0, 'asian': 1.0, 'caucasian': 0.0}
bm = HumanService.create_human(macro_detail_dict=macro)
P = lambda *a: os.path.join(DATA, *a)
HumanService.set_character_skin(P('skins', 'young_asian_female', 'young_asian_female.mhmat'), bm, skin_type='GAMEENGINE')
for part, f in [('Eyes', P('eyes', 'low-poly', 'low-poly.mhclo')), ('Eyebrows', P('eyebrows', 'eyebrow010', 'eyebrow010.mhclo')),
                ('Eyelashes', P('eyelashes', 'eyelashes02', 'eyelashes02.mhclo')), ('Hair', P('hair', 'braid01', 'braid01.mhclo')),
                ('Clothes', P('clothes', 'male_casualsuit03', 'male_casualsuit03.mhclo'))]:
    HumanService.add_mhclo_asset(f, bm, asset_type=part, subdiv_levels=0, material_type='GAMEENGINE')
rig = HumanService.add_builtin_rig(bm, 'mixamo')
objs = {o.name: o for o in bpy.data.objects}
body = objs['Human']
clothes = objs['Human.male_casualsuit03']
dg = bpy.context.evaluated_depsgraph_get()

# ---- 1. nhuộm lại quần áo (giữ bóng nếp vải bằng độ sáng của texture gốc)
src = P('clothes', 'male_casualsuit03', 'male_casualsuit03_diffuse.png')
im = np.asarray(Image.open(src).convert('RGB')).astype(np.float32) / 255.0
r, g, b = im[..., 0], im[..., 1], im[..., 2]
lum = 0.299 * r + 0.587 * g + 0.114 * b
bg = (im.max(axis=2) < 0.04)
denim = (b > r + 0.08) & ~bg
shirt = ~denim & ~bg
rng = np.random.default_rng(7)
H, W = lum.shape
# vải dệt: nhiễu sợi ngang/dọc + vết bạc màu loang
weave = (rng.random((H, W)) * 0.06) + 0.03 * np.sin(np.arange(W)[None, :] * 1.7) * np.sin(np.arange(H)[:, None] * 1.9)
blot = np.asarray(Image.fromarray((rng.random((H // 64, W // 64)) * 255).astype(np.uint8)).resize((W, H), Image.BICUBIC)).astype(np.float32) / 255.0
out = im.copy()
# áo: xanh bạc (lục xám nhạt), sọc cũ bị xoá — chỉ giữ bóng nếp lớn (làm mờ độ sáng)
lum_blur = np.asarray(Image.fromarray((lum * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(10))).astype(np.float32) / 255.0
shade = np.clip(0.75 + (lum_blur - lum_blur[shirt].mean()) * 1.2, 0.55, 1.15)
shirt_col = np.array([0.43, 0.52, 0.47])
fade = 0.9 + 0.2 * blot
for c in range(3):
    out[..., c] = np.where(shirt, np.clip(shirt_col[c] * shade * fade + weave - 0.03, 0, 1), out[..., c])
# quần: vải kaki sẫm, giữ nếp jeans theo độ sáng
pants_col = np.array([0.20, 0.19, 0.15])
pshade = np.clip(0.7 + (lum - lum[denim].mean()) * 1.6, 0.45, 1.3)
for c in range(3):
    out[..., c] = np.where(denim, np.clip(pants_col[c] * pshade * (0.92 + 0.16 * blot) + weave * 0.6 - 0.02, 0, 1), out[..., c])
recol = os.path.join(TMP, 'thu_clothes_diffuse.png')
Image.fromarray((out * 255).astype(np.uint8)).save(recol)
cm = clothes.material_slots[0].material
for n in cm.node_tree.nodes:
    if n.type == 'TEX_IMAGE' and n.image and 'diffuse' in n.image.filepath:
        n.image = bpy.data.images.load(recol)

# ---- 2. xoá thân dưới quần áo theo khoảng cách (đầu gối, khuỷu tay không xuyên vải)
ce = clothes.evaluated_get(dg)
cmesh = ce.to_mesh()
tree = BVHTree.FromPolygons([v.co.copy() for v in cmesh.vertices], [p.vertices[:] for p in cmesh.polygons])
ce.to_mesh_clear()
be = body.evaluated_get(dg)
bmesh_eval = be.to_mesh()
skip_groups = {'head', 'neck', 'hand.L', 'hand.R', 'foot.L', 'foot.R', 'feet', 'hands'}
gnames = {g.index: g.name for g in body.vertex_groups}
hide = body.vertex_groups.get('Delete.male_casualsuit03') or body.vertex_groups.new(name='Delete.male_casualsuit03')
to_hide = []
for v in body.data.vertices:
    ev = bmesh_eval.vertices[v.index] if v.index < len(bmesh_eval.vertices) else v
    co, n = ev.co, ev.normal
    # vải che kín: tia từ da đi ra theo pháp tuyến chạm áo/quần trong 4 cm (cổ áo mở, cổ tay áo không che → giữ da)
    hit = tree.ray_cast(co - n * 0.004, n, 0.045)
    if hit[0] is None:
        continue
    names = {gnames.get(g.group, '') for g in v.groups if g.weight > 0.3}
    if not any(nm.lower().startswith(('head', 'neck', 'hand', 'finger', 'foot', 'toe', 'eye')) for nm in names):
        to_hide.append(v.index)
be.to_mesh_clear()
hide.add(to_hide, 1.0, 'REPLACE')
print('hidden body verts', len(to_hide))

# ---- 3. alpha cho tóc, lông mày, mi (glTF MASK)
for o in bpy.data.objects:
    if o.type != 'MESH':
        continue
    for s in o.material_slots:
        m = s.material
        if not m or not any(k in o.name for k in ('braid', 'eyebrow', 'eyelash')):
            continue
        nt = m.node_tree
        bsdf = next(n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED')
        tex = next(n for n in nt.nodes if n.type == 'TEX_IMAGE' and n.outputs['Alpha'].is_linked is False or n.type == 'TEX_IMAGE')
        nt.links.new(tex.outputs['Alpha'], bsdf.inputs['Alpha'])
        m.blend_method = 'CLIP' if hasattr(m, 'blend_method') else None
        try:
            m.surface_render_method = 'DITHERED'
        except Exception:
            pass

# ---- 4. chân trần (lội ngầm ban đêm; đế dép tự dựng trông giả, bỏ)

TARGET_H = 1.53  # nữ Việt Nam 1970 (m)
f = TARGET_H / body.dimensions.z
bpy.ops.object.select_all(action='DESELECT')
rig.scale = (f, f, f)
rig.select_set(True)
bpy.context.view_layer.objects.active = rig
bpy.ops.object.transform_apply(location=False, rotation=False, scale=True, properties=False)
for o in bpy.data.objects:
    if o.parent == rig and o.type == 'MESH':
        o.select_set(True)
bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
bpy.context.view_layer.update()
h = max((rig.matrix_world @ b.tail_local).z for b in rig.data.bones if b.name == 'mixamorig:Head')
print('head top z ~', round(h, 3), 'body dims', [round(x, 3) for x in body.dimensions])
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(TMP, 'thu.blend'))
bpy.ops.export_scene.gltf(filepath=OUT, export_format='GLB', export_apply=True, export_skins=True, export_animations=False, export_yup=True)
print('exported', OUT)

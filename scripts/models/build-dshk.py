"""
Đại liên 12,7 ly DShKM (Type 54) trên giá ba càng phòng không, DỰNG BẰNG CODE trong Blender (DV-077). Không có bản miễn phí
đạt chuẩn (Sketchfab: Blockbench/nòng đôi tưởng tượng/rip game; CGTrader free: lưới thô không texture) và ngân sách asset đã
đóng → tự dựng, bản quyền của dự án.

Kích thước theo thông số công bố (dài toàn bộ ~1,63 m, nòng ~1,07 m, cỡ 12,7×108). Cây node (glTF, y lên, súng hướng −z):
  dshk_base (giá ba càng, đứng yên) → dshk_yaw (cổ xoay ngang) → dshk_pitch (súng, ngẩng) → các mốc rỗng:
  muzzle (đầu nòng), sight_eye (mắt người bắn sau thước ngắm vòng), grip_l / grip_r (hai tay cầm).
Chạy: python3 scripts/models/build-dshk.py <out.glb>
"""
import sys, math
import bpy, bmesh
from mathutils import Vector, Matrix

OUT = sys.argv[-1]
bpy.ops.wm.read_factory_settings(use_empty=True)

def mat(name, rgb, rough, metal):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = (*rgb, 1)
    b.inputs['Roughness'].default_value = rough
    b.inputs['Metallic'].default_value = metal
    return m

STEEL = mat('dshk_steel', (0.045, 0.048, 0.052), 0.42, 0.85)
WORN = mat('dshk_steel_worn', (0.11, 0.11, 0.105), 0.35, 0.95)
PAINT = mat('dshk_paint', (0.13, 0.15, 0.10), 0.72, 0.15)
BOX = mat('dshk_ammo_box', (0.17, 0.19, 0.12), 0.65, 0.2)

def empty(name, parent=None, loc=(0, 0, 0)):
    e = bpy.data.objects.new(name, None)
    bpy.context.collection.objects.link(e)
    e.location = loc
    if parent:
        e.parent = parent
    return e

def finish(o, material, parent, bevel=0.0, seg=2, smooth=True):
    o.data.materials.append(material)
    if bevel > 0:
        m = o.modifiers.new('bevel', 'BEVEL')
        m.width = bevel
        m.segments = seg
        m.limit_method = 'ANGLE'
    if smooth:
        for p in o.data.polygons:
            p.use_smooth = True
        try:
            o.data.shade_smooth_by_angle(angle=math.radians(35))
        except Exception:
            pass
    o.parent = parent
    return o

def box(name, size, loc, material, parent, bevel=0.004, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc, rotation=rot)
    o = bpy.context.active_object
    o.name = name
    o.scale = size
    bpy.ops.object.transform_apply(scale=True)
    return finish(o, material, parent, bevel)

def cyl(name, r, depth, loc, material, parent, axis='Y', verts=24, bevel=0.002, r2=None):
    rot = {'X': (0, math.pi / 2, 0), 'Y': (math.pi / 2, 0, 0), 'Z': (0, 0, 0)}[axis]
    if r2 is None:
        bpy.ops.mesh.primitive_cylinder_add(radius=r, depth=depth, vertices=verts, location=loc, rotation=rot)
    else:
        bpy.ops.mesh.primitive_cone_add(radius1=r, radius2=r2, depth=depth, vertices=verts, location=loc, rotation=rot)
    o = bpy.context.active_object
    o.name = name
    bpy.ops.object.transform_apply(rotation=True)
    return finish(o, material, parent, bevel)

# Blender: z lên, súng hướng +y (đổi sang −z khi xuất glTF y-up: +y Blender → −z glTF)
PIVOT_H = 1.18          # cao trục xoay (người đứng bắn máy bay)
base = empty('dshk_base')
yaw = empty('dshk_yaw', base, (0, 0, PIVOT_H))
pitch = empty('dshk_pitch', yaw, (0, 0, 0.13))

# ---- giá ba càng phòng không (sơn ô liu)
cyl('column', 0.035, 0.62, (0, 0, PIVOT_H - 0.33), PAINT, base, 'Z', 20)
cyl('column_collar', 0.05, 0.06, (0, 0, PIVOT_H - 0.05), PAINT, base, 'Z', 20)
cyl('hub', 0.06, 0.09, (0, 0, PIVOT_H - 0.64), PAINT, base, 'Z', 20)
for i in range(3):
    a = math.radians(90 + i * 120)
    foot = Vector((math.cos(a) * 0.95, math.sin(a) * 0.95, 0.03))
    top = Vector((math.cos(a) * 0.06, math.sin(a) * 0.06, PIVOT_H - 0.62))
    mid = (foot + top) / 2
    d = foot - top
    bpy.ops.mesh.primitive_cylinder_add(radius=0.022, depth=d.length, vertices=12, location=mid)
    leg = bpy.context.active_object
    leg.name = f'leg{i}'
    leg.rotation_euler = d.to_track_quat('Z', 'Y').to_euler()
    bpy.ops.object.transform_apply(rotation=True)
    finish(leg, PAINT, base, 0.002)
    box(f'footpad{i}', (0.11, 0.11, 0.012), tuple(foot), PAINT, base, 0.003)
    # thanh giằng
    brace_a = top + (foot - top) * 0.55
    nb = Vector((math.cos(a + math.radians(120)) * 0.06, math.sin(a + math.radians(120)) * 0.06, PIVOT_H - 0.62)) + (Vector((math.cos(a + math.radians(120)) * 0.95, math.sin(a + math.radians(120)) * 0.95, 0.03)) - Vector((math.cos(a + math.radians(120)) * 0.06, math.sin(a + math.radians(120)) * 0.06, PIVOT_H - 0.62))) * 0.55
    d2 = nb - brace_a
    bpy.ops.mesh.primitive_cylinder_add(radius=0.009, depth=d2.length, vertices=8, location=(brace_a + nb) / 2)
    br = bpy.context.active_object
    br.name = f'brace{i}'
    br.rotation_euler = d2.to_track_quat('Z', 'Y').to_euler()
    bpy.ops.object.transform_apply(rotation=True)
    finish(br, PAINT, base, 0)

# ---- cổ xoay + giá đỡ súng (yaw)
cyl('pintle', 0.042, 0.1, (0, 0, 0.0), PAINT, yaw, 'Z', 20)
box('cradle', (0.16, 0.42, 0.05), (0, 0.02, 0.07), PAINT, yaw, 0.006)
for s in (-1, 1):
    box(f'trunnion_cheek{s}', (0.02, 0.14, 0.12), (s * 0.085, 0.0, 0.12), PAINT, yaw, 0.004)
    # tì vai phòng không (hai tay đòn ra sau)
    box(f'shoulder_arm{s}', (0.025, 0.42, 0.025), (s * 0.13, -0.33, 0.1), PAINT, yaw, 0.004)
    box(f'shoulder_pad{s}', (0.09, 0.05, 0.13), (s * 0.15, -0.55, 0.12), BOX, yaw, 0.012)

# ---- súng (pitch). gốc pitch ở trục chốt; nòng hướng +y
G = pitch
# hộp khoá nòng
box('receiver', (0.11, 0.5, 0.15), (0, -0.05, 0.03), STEEL, G, 0.006)
box('feed_cover', (0.125, 0.26, 0.045), (0, 0.02, 0.125), STEEL, G, 0.008)
box('feed_lever', (0.02, 0.16, 0.025), (0.07, 0.05, 0.12), WORN, G, 0.004)
box('feed_tray', (0.06, 0.12, 0.05), (-0.085, 0.02, 0.07), STEEL, G, 0.004)
box('backplate', (0.13, 0.04, 0.17), (0, -0.315, 0.03), STEEL, G, 0.008)
cyl('buffer', 0.035, 0.07, (0, -0.36, 0.04), STEEL, G, 'Y', 20)
# tay cầm hai bên + cò bướm
for s in (-1, 1):
    cyl(f'grip{s}', 0.017, 0.13, (s * 0.075, -0.37, 0.0), WORN, G, 'Z', 14)
    box(f'grip_bracket{s}', (0.03, 0.05, 0.03), (s * 0.06, -0.345, 0.05), STEEL, G, 0.003)
box('butterfly_trigger', (0.07, 0.012, 0.03), (0, -0.37, 0.05), WORN, G, 0.003)
# ống khí + nòng có cánh tản nhiệt
cyl('gas_tube', 0.016, 0.62, (0, 0.47, -0.035), STEEL, G, 'Y', 16)
cyl('gas_block', 0.034, 0.06, (0, 0.78, -0.02), STEEL, G, 'Y', 18)
cyl('barrel', 0.024, 1.07, (0, 0.735, 0.03), STEEL, G, 'Y', 24)
for k in range(15):
    cyl(f'fin{k}', 0.046, 0.008, (0, 0.26 + k * 0.024, 0.03), STEEL, G, 'Y', 24, 0.0008)
cyl('barrel_collar', 0.034, 0.05, (0, 0.24, 0.03), STEEL, G, 'Y', 20)
# chống giật đầu nòng (hai khoang dẹt)
mb = cyl('muzzle_brake', 0.04, 0.11, (0, 1.29, 0.03), STEEL, G, 'Y', 24, 0.003)
for k in range(2):
    box(f'mb_slot{k}', (0.1, 0.018, 0.03), (0, 1.27 + k * 0.035, 0.03), WORN, G, 0.002)
# thước ngắm phòng không: vòng lớn ở trước + điểm ngắm sau
for rr, nm in ((0.075, 'ring_outer'), (0.045, 'ring_mid')):
    bpy.ops.mesh.primitive_torus_add(major_radius=rr, minor_radius=0.003, major_segments=40, minor_segments=8, location=(0, 0.16, 0.25), rotation=(math.pi / 2, 0, 0))
    t = bpy.context.active_object
    t.name = nm
    bpy.ops.object.transform_apply(rotation=True)
    finish(t, WORN, G, 0)
box('ring_post', (0.008, 0.008, 0.15), (0, 0.16, 0.14), WORN, G, 0)
box('ring_cross_h', (0.15, 0.003, 0.003), (0, 0.16, 0.25), WORN, G, 0)
box('ring_cross_v', (0.003, 0.003, 0.15), (0, 0.16, 0.25), WORN, G, 0)
box('rear_sight_post', (0.008, 0.008, 0.12), (0, -0.2, 0.17), WORN, G, 0)
cyl('rear_sight_bead', 0.006, 0.01, (0, -0.2, 0.235), WORN, G, 'Y', 12)
# hộp đạn bên trái + dây đạn vào khay
box('ammo_box', (0.13, 0.3, 0.2), (-0.17, 0.0, -0.06), BOX, G, 0.006)
box('ammo_lid', (0.135, 0.31, 0.012), (-0.17, 0.0, 0.045), BOX, G, 0.003)
box('ammo_handle', (0.03, 0.12, 0.012), (-0.17, 0.0, 0.056), STEEL, G, 0.003)
for k in range(5):
    cyl(f'round{k}', 0.011, 0.11, (-0.105 + k * 0.006, -0.05 + k * 0.03, 0.06 + k * 0.004), WORN, G, 'X', 12, 0)

# mốc rỗng cho game
empty('muzzle', G, (0, 1.35, 0.03))
empty('sight_eye', G, (0, -0.5, 0.25))
empty('grip_l', G, (-0.075, -0.37, 0.0))
empty('grip_r', G, (0.075, -0.37, 0.0))

# áp modifier bevel, gộp lưới theo vật liệu trong mỗi node động (base / yaw / pitch) để ít draw call
bpy.context.view_layer.update()
for o in list(bpy.data.objects):
    if o.type == 'MESH':
        bpy.context.view_layer.objects.active = o
        for m in list(o.modifiers):
            bpy.ops.object.modifier_apply(modifier=m.name)
for grp in (base, yaw, pitch):
    meshes = [o for o in bpy.data.objects if o.type == 'MESH' and o.parent == grp]
    by_mat = {}
    for o in meshes:
        by_mat.setdefault(o.data.materials[0].name, []).append(o)
    for mname, objs in by_mat.items():
        bpy.ops.object.select_all(action='DESELECT')
        for o in objs:
            o.select_set(True)
        bpy.context.view_layer.objects.active = objs[0]
        bpy.ops.object.join()
        objs[0].name = f'{grp.name}_{mname}'
tris = sum(sum(len(p.vertices) - 2 for p in o.data.polygons) for o in bpy.data.objects if o.type == 'MESH')
print('tris', tris, 'meshes', len([o for o in bpy.data.objects if o.type == 'MESH']))
bpy.ops.export_scene.gltf(filepath=OUT, export_format='GLB', export_yup=True, export_apply=True)
print('exported', OUT)

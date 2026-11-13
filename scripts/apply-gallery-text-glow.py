"""Apply matching, exportable glow to the gallery subtitle and 16 credits."""

import bpy
from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
TARGET = ROOT / "gallery_output" / "RVASA2_Glow.blend"
LABELS = ["W_Gallery_Subtitle", *(f"W_Credit_{i:02d}" for i in range(1, 17))]


def emissive(name, color, alpha=1.0, strength=1.0):
    material = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    material.use_nodes = True
    material.diffuse_color = (*color, alpha)
    material.surface_render_method = "BLENDED" if alpha < 1 else "DITHERED"
    nodes = material.node_tree.nodes
    nodes.clear()
    output = nodes.new("ShaderNodeOutputMaterial")
    shader = nodes.new("ShaderNodeBsdfPrincipled")
    shader.inputs["Base Color"].default_value = (*color, 1)
    shader.inputs["Emission Color"].default_value = (*color, 1)
    shader.inputs["Emission Strength"].default_value = strength
    shader.inputs["Alpha"].default_value = alpha
    shader.inputs["Metallic"].default_value = 0
    shader.inputs["Roughness"].default_value = 1
    material.node_tree.links.new(shader.outputs["BSDF"], output.inputs["Surface"])
    return material


core = emissive("Gallery text | warm luminous core", (1.0, 0.93, 0.76), strength=2.0)
inner = emissive("Gallery text | inner glow", (1.0, 0.72, 0.38), alpha=0.28, strength=1.0)
outer = emissive("Gallery text | outer glow", (1.0, 0.55, 0.22), alpha=0.12, strength=1.0)

for name in LABELS:
    obj = bpy.data.objects.get(name)
    if obj is None or obj.type != "FONT":
        raise RuntimeError(f"Missing text object: {name}")
    obj.data = obj.data.copy()
    obj.data.size *= 1.15 if name == "W_Gallery_Subtitle" else 1.35
    obj.data.extrude = 0
    obj.data.resolution_u = 8
    # Sit just ahead of the text already flattened into the existing web bake.
    obj.location.z += 0.003
    obj.data.materials.clear()
    obj.data.materials.append(core)
    obj["web_glow_role"] = "core"
    for suffix, scale, depth, material in (
        ("Inner_Glow", 1.09, -0.0007, inner),
        ("Outer_Glow", 1.20, -0.0014, outer),
    ):
        halo = obj.copy()
        halo.data = obj.data.copy()
        halo.name = f"{name}_{suffix}"
        for collection in obj.users_collection:
            collection.objects.link(halo)
        halo.data.size *= scale
        halo.location.z += depth
        halo.data.materials.clear()
        halo.data.materials.append(material)
        halo["web_glow_role"] = "halo"

# Keep the joined gallery walls and their recessed wall trim fixed in the editor.
for name in ("Gallery_Walls", "Gallery_Recessed_Baseboard"):
    wall = bpy.data.objects.get(name)
    if wall is None or wall.type != "MESH":
        raise RuntimeError(f"Missing wall object: {name}")
    wall.lock_location = (True, True, True)
    wall.lock_rotation = (True, True, True)
    wall.lock_scale = (True, True, True)
    wall.hide_select = True

# Close the open entrance span (x 0.125..7.375 at y 5.5). The tour starts
# north of this line and never crosses it, so a closed door fits the route.
architecture = bpy.data.collections["01_Gallery_Architecture"]
plaster = bpy.data.materials["Waneella | blue-gray mineral plaster"]
frame_mat = bpy.data.materials["Waneella | charcoal frames"]
door_mat = emissive("Gallery entrance | slate door", (0.27, 0.38, 0.43), strength=0.08)
hardware_mat = emissive("Gallery entrance | brass hardware", (0.64, 0.41, 0.18), strength=0.18)


def fixed_box(name, minimum, maximum, material):
    x0, y0, z0 = minimum
    x1, y1, z1 = maximum
    mesh = bpy.data.meshes.new(name + " mesh")
    mesh.from_pydata(
        [(x0, y0, z0), (x1, y0, z0), (x1, y1, z0), (x0, y1, z0),
         (x0, y0, z1), (x1, y0, z1), (x1, y1, z1), (x0, y1, z1)],
        [],
        [(0, 3, 2, 1), (4, 5, 6, 7), (0, 1, 5, 4),
         (1, 2, 6, 5), (2, 3, 7, 6), (3, 0, 4, 7)],
    )
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    architecture.objects.link(obj)
    mesh.materials.append(material)
    obj.lock_location = (True, True, True)
    obj.lock_rotation = (True, True, True)
    obj.lock_scale = (True, True, True)
    obj.hide_select = True
    return obj


fixed_box("Gallery_Entrance_Wall_Left", (0.125, 5.375, 0.08), (4.2, 5.625, 4.5), plaster)
fixed_box("Gallery_Entrance_Wall_Right", (5.4, 5.375, 0.08), (7.375, 5.625, 4.5), plaster)
fixed_box("Gallery_Entrance_Wall_Header", (4.2, 5.375, 2.5), (5.4, 5.625, 4.5), plaster)
fixed_box("Gallery_Entrance_Door", (4.24, 5.47, 0.09), (5.36, 5.54, 2.39), door_mat)
fixed_box("Gallery_Entrance_Door_Jamb_Left", (4.18, 5.62, 0.08), (4.24, 5.69, 2.5), frame_mat)
fixed_box("Gallery_Entrance_Door_Jamb_Right", (5.36, 5.62, 0.08), (5.42, 5.69, 2.5), frame_mat)
fixed_box("Gallery_Entrance_Door_Frame_Top", (4.18, 5.62, 2.39), (5.42, 5.69, 2.5), frame_mat)
fixed_box("Gallery_Entrance_Door_Handle", (5.14, 5.54, 1.08), (5.28, 5.61, 1.12), hardware_mat)

import runpy
runpy.run_path(str(ROOT / 'scripts' / 'close-gallery-shell.py'))

bpy.ops.wm.save_as_mainfile(filepath=str(TARGET), compress=True)
print(f"GLOW_SAVED {TARGET} labels={len(LABELS)} halos={len(LABELS) * 2}", flush=True)

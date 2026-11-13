"""Bake the added architecture using gallery lights, then export it with credits."""
import bpy
from pathlib import Path

root = Path(__file__).resolve().parent.parent
out = root / 'public' / 'assets'
scene = bpy.context.scene
credits = [o for o in scene.objects if o.name.startswith('Team_') and o.type == 'FONT']
shell = [o for o in scene.objects if o.type == 'MESH' and o.name.startswith(('Gallery_Entrance_', 'Gallery_Exterior_'))]
if len(credits) != 14 or len(shell) != 10:
    raise RuntimeError(f'Expected 14 credits and 10 wall/door pieces; got {len(credits)} and {len(shell)}')

for obj in bpy.context.selected_objects:
    obj.select_set(False)
copies = []
for obj in shell:
    copy = obj.copy()
    copy.data = obj.data.copy()
    scene.collection.objects.link(copy)
    copy.hide_select = False
    copy.hide_render = False
    copy.hide_set(False)
    copy.select_set(True)
    obj.hide_render = True
    copies.append(copy)
bpy.context.view_layer.objects.active = copies[0]
bpy.ops.object.join()
baked = bpy.context.object
baked.name = 'Gallery_Additions_Baked'
uv = baked.data.uv_layers.new(name='Web_Additions_UV')
baked.data.uv_layers.active = uv
bpy.ops.object.mode_set(mode='EDIT')
bpy.ops.mesh.select_all(action='SELECT')
bpy.ops.uv.smart_project(island_margin=.012)
bpy.ops.object.mode_set(mode='OBJECT')
image = bpy.data.images.new('Gallery_Additions_Lighting', width=2048, height=2048, alpha=False)
for material in baked.data.materials:
    if not material:
        continue
    material.use_nodes = True
    if material.name.startswith('Gallery entrance | slate door'):
        shader = material.node_tree.nodes.get('Principled BSDF')
        shader.inputs['Base Color'].default_value = (.06, .08, .10, 1)
        shader.inputs['Emission Strength'].default_value = 0
    for node in material.node_tree.nodes:
        node.select = False
    tex = material.node_tree.nodes.new('ShaderNodeTexImage')
    tex.image = image
    tex.select = True
    material.node_tree.nodes.active = tex

scene.render.engine = 'CYCLES'
scene.cycles.samples = 64
scene.cycles.use_denoising = True
scene.render.bake.use_pass_direct = True
scene.render.bake.use_pass_indirect = True
scene.render.bake.use_pass_diffuse = True
scene.render.bake.use_pass_glossy = False
scene.render.bake.use_pass_transmission = False
scene.render.bake.use_pass_emit = True
scene.render.bake.margin = 8
print('ADDITIONS_BAKE_START', len(baked.data.polygons), flush=True)
bpy.ops.object.bake(type='COMBINED')
image.filepath_raw = str(out / 'gallery-additions-lighting.png')
image.file_format = 'PNG'
image.save()

material = bpy.data.materials.new('Gallery additions | baked lighting')
material.use_nodes = True
nodes = material.node_tree.nodes
nodes.clear()
output = nodes.new('ShaderNodeOutputMaterial')
emission = nodes.new('ShaderNodeEmission')
tex = nodes.new('ShaderNodeTexImage')
tex.image = image
material.node_tree.links.new(tex.outputs['Color'], emission.inputs['Color'])
material.node_tree.links.new(emission.outputs[0], output.inputs['Surface'])
baked.data.materials.clear()
baked.data.materials.append(material)
for poly in baked.data.polygons:
    poly.material_index = 0
for layer in list(baked.data.uv_layers):
    if layer.name != 'Web_Additions_UV':
        baked.data.uv_layers.remove(layer)

for obj in bpy.context.selected_objects:
    obj.select_set(False)
for obj in [baked] + credits:
    obj.hide_select = False
    obj.hide_set(False)
    obj.select_set(True)
bpy.context.view_layer.objects.active = baked
bpy.ops.export_scene.gltf(filepath=str(out / 'gallery-additions.glb'), export_format='GLB', use_selection=True,
                          export_animations=False, export_cameras=False, export_lights=False, export_yup=True)
print('ADDITIONS_EXPORTED', len(credits), len(baked.data.polygons), flush=True)

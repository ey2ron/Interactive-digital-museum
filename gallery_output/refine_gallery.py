import bpy,os
from mathutils import Vector
walls=sorted([o for o in bpy.context.scene.objects if o.name.startswith('Wall ')],key=lambda o:o.name)
bpy.ops.object.select_all(action='DESELECT')
base=walls[0];base.select_set(True);bpy.context.view_layer.objects.active=base
for w in walls:
 for mod in list(w.modifiers):w.modifiers.remove(mod)
for w in walls[1:]:
 mod=base.modifiers.new('Continuous plaster junction','BOOLEAN');mod.operation='UNION';mod.solver='EXACT';mod.object=w
 bpy.ops.object.modifier_apply(modifier=mod.name)
 bpy.data.objects.remove(w,do_unlink=True)
base.name='Walls | unified nine-segment reference layout'
b=base.modifiers.new('Crisp plaster edges','BEVEL');b.width=.004;b.segments=3
# Leave flat wall face normals for architectural planes.
for o in bpy.context.scene.objects:
 if o.name.startswith('Recessed linear ceiling track'):o.location.z=3.14
em=bpy.data.materials.new('Warm spotlight lens');em.use_nodes=True
p=em.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=(1,.8,.55,1);p.inputs['Emission Color'].default_value=(1,.75,.4,1);p.inputs['Emission Strength'].default_value=3
for o in list(bpy.context.scene.objects):
 if o.name.startswith('Adjustable spotlight housing'):
  bpy.ops.mesh.primitive_cylinder_add(vertices=24,radius=.047,depth=.005,location=(o.location.x,o.location.y,3.012))
  lens=bpy.context.object;lens.name='Warm recessed spotlight lens';lens.data.materials.append(em)
  for c in list(lens.users_collection):c.objects.unlink(lens)
  bpy.data.collections['03 Ceiling and lighting'].objects.link(lens)
cam=bpy.data.objects['01 Interior | entrance perspective'];cam.location=(-7.5,-1.9,1.65);cam.rotation_euler=(Vector((-.3,.6,1.4))-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.lens=24
bpy.context.scene.view_settings.exposure=.05
bpy.ops.wm.save_as_mainfile(filepath=bpy.data.filepath)
result={'walls_unified':True,'saved':bpy.data.filepath}

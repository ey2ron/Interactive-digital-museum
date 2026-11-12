import bpy,os
from mathutils import Quaternion
s=bpy.context.scene
bpy.data.objects['Ceiling | hide for layout view'].hide_set(True)
for m in bpy.data.materials:
 if m.use_nodes:
  p=m.node_tree.nodes.get('Principled BSDF')
  if p:m.diffuse_color=p.inputs['Base Color'].default_value
for screen in bpy.data.screens:
 for a in screen.areas:
  if a.type=='VIEW_3D':
   a.spaces.active.region_3d.view_distance=20
   a.spaces.active.region_3d.view_location=(0,0,.6)
   a.spaces.active.region_3d.view_rotation=bpy.data.objects['02 Layout | axonometric'].rotation_euler.to_quaternion()
   a.spaces.active.shading.type='SOLID'
   a.spaces.active.shading.color_type='MATERIAL'
   a.spaces.active.shading.show_shadows=True
   a.spaces.active.shading.show_cavity=True
bpy.ops.file.pack_all()
bpy.ops.wm.save_as_mainfile(filepath=bpy.data.filepath)
result={'packed_images':[(i.name,i.packed_file is not None) for i in bpy.data.images if i.source=='FILE'],'wall_count':sum(o.name.startswith('Wall ') for o in s.objects)}

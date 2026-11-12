import bpy,os
out=r'C:\Users\aaron\OneDrive\Documents\ChatGPT\RVA\gallery_output'
s=bpy.context.scene
s.render.resolution_x=1000;s.render.resolution_y=667
if s.render.engine=='CYCLES':
 s.cycles.samples=16
 s.cycles.device='CPU'
s.camera=bpy.data.objects['01 Interior | entrance perspective']
s.render.filepath=os.path.join(out,'Gallery_Interior.png')
print('RENDERING',s.render.filepath,flush=True)
bpy.ops.render.render(write_still=True)
bpy.data.objects['Ceiling | hide for layout view'].hide_render=True
for o in bpy.data.collections['03 Ceiling and lighting'].objects:
 if o.type=='MESH':o.hide_render=True
s.world.node_tree.nodes['Background'].inputs[1].default_value=.65
s.camera=bpy.data.objects['02 Layout | axonometric']
s.render.filepath=os.path.join(out,'Gallery_Layout.png')
print('RENDERING',s.render.filepath,flush=True)
bpy.ops.render.render(write_still=True)

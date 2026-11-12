import bpy,os
from mathutils import Vector
s=bpy.context.scene
old=(s.camera,s.render.resolution_x,s.render.resolution_y,s.render.resolution_percentage,s.cycles.samples,s.render.filepath,s.cycles.use_denoising)
d=bpy.data.cameras.new('Fixture inspection TEMP');o=bpy.data.objects.new('Fixture inspection TEMP',d);s.collection.objects.link(o)
try:
    o.location=(9.35,9.5,3.0);o.rotation_euler=(Vector((8,8.83,4.10))-o.location).to_track_quat('-Z','Y').to_euler();d.lens=46
    s.camera=o;s.render.resolution_x=850;s.render.resolution_y=850;s.render.resolution_percentage=100;s.cycles.samples=24;s.cycles.use_denoising=True
    s.render.filepath=r'C:\Users\aaron\OneDrive\Documents\ChatGPT\RVA\gallery_output\RVASA2_Lighting_Fixture.png'
    bpy.ops.render.render(write_still=True)
    result={'fixture_render':s.render.filepath}
finally:
    s.camera,s.render.resolution_x,s.render.resolution_y,s.render.resolution_percentage,s.cycles.samples,s.render.filepath,s.cycles.use_denoising=old
    bpy.data.objects.remove(o,do_unlink=True);bpy.data.cameras.remove(d)

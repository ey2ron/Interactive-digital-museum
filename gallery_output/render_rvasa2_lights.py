import bpy,os,json
from mathutils import Vector
OUT=r'C:\Users\aaron\OneDrive\Documents\ChatGPT\RVA\gallery_output'
s=bpy.context.scene
restore=(s.camera,s.render.resolution_x,s.render.resolution_y,s.render.resolution_percentage,s.cycles.samples,s.render.filepath,s.cycles.use_denoising)
created=None
try:
    s.render.resolution_x=1000;s.render.resolution_y=750;s.render.resolution_percentage=100;s.cycles.samples=24;s.cycles.use_denoising=True
    s.camera=bpy.data.objects['W_Review_Entrance']
    s.render.filepath=os.path.join(OUT,'RVASA2_Lighting_Entrance.png');bpy.ops.render.render(write_still=True)
    d=bpy.data.cameras.new('Lighting fixture detail TEMP');created=bpy.data.objects.new('Lighting fixture detail TEMP',d);s.collection.objects.link(created)
    created.location=(9.6,7.0,3.25);created.rotation_euler=(Vector((8,8.95,4.02))-created.location).to_track_quat('-Z','Y').to_euler();d.lens=52
    s.camera=created;s.render.resolution_x=850;s.render.resolution_y=850
    s.render.filepath=os.path.join(OUT,'RVASA2_Lighting_Fixture.png');bpy.ops.render.render(write_still=True)
    result={'renders':['RVASA2_Lighting_Entrance.png','RVASA2_Lighting_Fixture.png']}
finally:
    s.camera,s.render.resolution_x,s.render.resolution_y,s.render.resolution_percentage,s.cycles.samples,s.render.filepath,s.cycles.use_denoising=restore
    if created:
        d=created.data;bpy.data.objects.remove(created,do_unlink=True);bpy.data.cameras.remove(d)

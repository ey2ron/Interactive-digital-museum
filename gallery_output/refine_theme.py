import bpy,os
from mathutils import Vector
s=bpy.context.scene
s.view_settings.exposure=0
for o in s.objects:
    if o.type!='LIGHT':continue
    if o.name.startswith('Soft ceiling bounce'):o.data.energy=105
    elif o.name=='Daylight from open entrance':o.data.energy=300
    elif o.name.startswith('Art wash'):o.data.energy=45
    elif o.name.startswith('Warm gallery spotlight'):o.data.energy=65
cam=bpy.data.objects['01 Interior | entrance perspective']
cam.rotation_euler=(Vector((-4.6,.7,1.65))-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.lens=23
s.camera=cam
bpy.ops.wm.save_as_mainfile(filepath=bpy.data.filepath)
print('REFINED',flush=True)

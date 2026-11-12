import bpy, json
from pathlib import Path
s=bpy.context.scene
cam=bpy.data.objects['Gallery_Camera']
if cam.type != 'CAMERA':
    raise RuntimeError('Gallery_Camera is not a camera')
original=bpy.data.filepath
if not original:
    raise RuntimeError('The Blender file has no saved path')
backup=Path(bpy.path.abspath('//')) / (Path(original).stem + '_before_camera_fix.blend')
if not backup.exists():
    bpy.ops.wm.save_as_mainfile(filepath=str(backup),copy=True)
s.camera=cam
for screen in bpy.data.screens:
    for area in screen.areas:
        if area.type=='VIEW_3D':
            area.spaces.active.camera=cam
            if screen.name=='Layout':
                area.spaces.active.region_3d.view_perspective='CAMERA'
                area.spaces.active.region_3d.view_camera_zoom=-10
bpy.ops.wm.save_as_mainfile(filepath=original)
print(json.dumps({'saved':bpy.data.filepath,'backup':str(backup),'scene_camera':s.camera.name,'frame':s.frame_current}))

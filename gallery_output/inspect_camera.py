import bpy, json
from mathutils import Vector
s=bpy.context.scene
orig=s.frame_current
cam=bpy.data.objects.get('Gallery_Camera')
rows=[]
for f in (1, 89, 100, 500, 1142, 2303):
    s.frame_set(f)
    dg=bpy.context.evaluated_depsgraph_get()
    ev=cam.evaluated_get(dg)
    loc=ev.matrix_world.translation.copy()
    direction=ev.matrix_world.to_quaternion() @ Vector((0,0,-1))
    hit, pos, normal, face, obj, matrix=s.ray_cast(dg,loc,direction)
    rows.append({'frame':f,'location':list(loc),'direction':list(direction),'first_hit':obj.name if hit else None,'hit_distance':(pos-loc).length if hit else None})
s.frame_set(orig)
views=[]
for screen in bpy.data.screens:
    for area in screen.areas:
        if area.type=='VIEW_3D':
            views.append({'screen':screen.name,'perspective':area.spaces.active.region_3d.view_perspective,'camera':area.spaces.active.camera.name if area.spaces.active.camera else None})
print(json.dumps({'scene_camera':s.camera.name if s.camera else None,'frame':orig,'camera_type':cam.type if cam else None,'camera_action':cam.animation_data.action.name if cam.animation_data and cam.animation_data.action else None,'views':views,'samples':rows}))

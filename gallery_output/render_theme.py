import bpy,os,sys
from mathutils import Vector
out=os.path.dirname(os.path.abspath(__file__));s=bpy.context.scene
args=sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else []
preview='preview' in args
s.render.resolution_x=1000 if preview else 1500;s.render.resolution_y=667 if preview else 1000
s.cycles.samples=16 if preview else 64;s.cycles.use_denoising=True
try:
    prefs=bpy.context.preferences.addons['cycles'].preferences
    prefs.compute_device_type='OPTIX';prefs.get_devices()
    gpu=False
    for dev in prefs.devices:
        dev.use=dev.type=='OPTIX'
        if dev.use:gpu=True
    if gpu:s.cycles.device='GPU'
except Exception as exc:print('CPU_RENDER',exc)
views=['Entrance'] if preview else ['Entrance','Detail','Layout']
for view in views:
    if view=='Entrance':s.camera=bpy.data.objects['01 Interior | entrance perspective']
    elif view=='Detail':s.camera=bpy.data.objects['04 Interior detail']
    else:
        bpy.data.objects['Ceiling | hide for layout view'].hide_render=True
        for o in bpy.data.collections['03 Ceiling and lighting'].objects:
            if o.type=='MESH':o.hide_render=True
        s.camera=bpy.data.objects['02 Layout | axonometric'];s.camera.data.ortho_scale=25
        s.world.node_tree.nodes['Background'].inputs[1].default_value=.45
        d=bpy.data.lights.new('Layout softbox','AREA');o=bpy.data.objects.new('Layout softbox',d);s.collection.objects.link(o);o.location=(0,-3,12);d.energy=2200;d.shape='DISK';d.size=15
    s.render.filepath=os.path.join(out,'Waneella_'+view+('_Preview' if preview else '')+'.png')
    print('RENDER_START',view,flush=True);bpy.ops.render.render(write_still=True);print('RENDER_DONE',view,flush=True)

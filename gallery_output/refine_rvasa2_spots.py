import bpy,math,json,os
s=bpy.context.scene
for o in s.objects:
    if o.type=='LIGHT' and o.name.startswith('W_Artwork_Spot_'):
        o.data.energy=800;o.data.spot_size=math.radians(100);o.data.spot_blend=.65
    elif o.name.startswith('Spot_') and '| ceiling canopy' in o.name:
        o.location.z=4.48;o.dimensions.z=.06
s.view_settings.exposure=0
p=bpy.data.materials['Fixture | matte charcoal metal'].node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=(.045,.055,.07,1)
bpy.data.materials['Fixture | matte charcoal metal'].diffuse_color=(.045,.055,.07,1)
bpy.ops.wm.save_as_mainfile(filepath=bpy.data.filepath)
path=r'C:\Users\aaron\OneDrive\Documents\ChatGPT\RVA\gallery_output\RVASA2_Lighting_Revision.json'
r=json.load(open(path))
for f in r['fixtures']:f['power_w']=800
r['beam_angle_deg']=100;r['ceiling_mounts_flush']=True
json.dump(r,open(path,'w'),indent=2)
result={'saved':bpy.data.filepath,'spotlights':16,'power_w':800,'beam_deg':100,'mounts_flush':True}

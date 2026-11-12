import bpy
from mathutils import Vector
s=bpy.context.scene
root=bpy.data.collections.get('GALLERY | reference layout')
assert root is not None,'Gallery collection not found'
factor=1.15
objects=list(root.all_objects)
plinths={o.name:tuple(o.dimensions) for o in objects if o.name.startswith('Empty display plinth')}
paintings={o.name:tuple(o.scale) for o in objects if o.name.startswith('Painting ') and o.parent is None}
architecture=set(bpy.data.collections['01 Architecture'].objects)
ceiling=bpy.data.objects.get('Ceiling | hide for layout view')
for o in objects:
 if o.parent is not None:continue
 o.location.x*=factor;o.location.y*=factor
 if o in architecture or o==ceiling:
  o.scale.x*=factor;o.scale.y*=factor
 elif o.name.startswith('Recessed linear ceiling track'):
  axis=0 if o.dimensions.x>o.dimensions.y else 1
  o.scale[axis]*=factor
 elif o.type=='CAMERA' and o.data.type=='ORTHO':
  o.location.z*=factor;o.data.ortho_scale*=factor
 elif o.type=='LIGHT':
  o.data.energy*=factor*factor
bpy.context.view_layer.update()
assert all(max(abs(o.dimensions[i]-plinths[o.name][i]) for i in range(3))<.0001 for o in objects if o.name in plinths)
assert all(tuple(bpy.data.objects[name].scale)==scale for name,scale in paintings.items())
for screen in bpy.data.screens:
 for area in screen.areas:
  if area.type=='VIEW_3D' and area.spaces.active.region_3d.view_perspective!='CAMERA':
   area.spaces.active.region_3d.view_distance*=factor
s['Walkway adjustment']='Floor plan expanded 15% in X and Y. Plinth and painting dimensions preserved; mounts, lighting and cameras repositioned.'
s['Reference']='Nine wall segments preserve the supplied sketch proportions. Updated scale 0.02875m/pixel; wall height 3.2m. Open edges preserved.'
bpy.ops.wm.save_as_mainfile(filepath=bpy.data.filepath)
floor=bpy.data.objects['Continuous concrete floor | exact stepped footprint']
result={'saved':bpy.data.filepath,'floor_dimensions_m':[round(v,3) for v in floor.dimensions],'plinth_sizes_preserved':len(plinths),'painting_sizes_preserved':len(paintings),'layout_expansion_percent':15}

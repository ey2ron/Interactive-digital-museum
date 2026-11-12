import bpy, math, os
from mathutils import Vector
s=bpy.context.scene
col=bpy.data.collections.new('05 Framed paintings');bpy.data.collections['GALLERY | reference layout'].children.link(col)
def mat(name,rgb,rough=.6,metal=0):
 m=bpy.data.materials.new(name);m.use_nodes=True;p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=(*rgb,1);p.inputs['Roughness'].default_value=rough;p.inputs['Metallic'].default_value=metal;m.diffuse_color=(*rgb,1);return m
frame=mat('Painting frames | charcoal powdercoat',(.025,.028,.029),.32,.35)
oak=mat('Painting frames | pale oak',(.4,.25,.12),.48)
mount=mat('Archival warm white mount',(.83,.80,.73))
colors=[mat('Pigment | '+n,c) for n,c in [('terracotta',(.4,.095,.05)),('ochre',(.56,.32,.07)),('ink',(.025,.055,.07)),('sage',(.20,.29,.22)),('chalk',(.72,.70,.63)),('deep blue',(.04,.10,.20))]]
def link(o):
 for c in list(o.users_collection):c.objects.unlink(o)
 col.objects.link(o)
def block(name,parent,loc,size,m,bevel=0):
 bpy.ops.mesh.primitive_cube_add(size=1);o=bpy.context.object;o.name=name;link(o);o.parent=parent;o.location=loc;o.dimensions=size;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);o.data.materials.append(m)
 if bevel:
  b=o.modifiers.new('Frame edge','BEVEL');b.width=bevel;b.segments=2
 return o
placements=[('Entrance',(-5.5,1.29,1.7),(0,-1),1.65,1.12),('North alcove',(-2.1,2.99,1.7),(0,-1),1.20,1.45),('North gallery',(.6,2.99,1.7),(0,-1),1.55,1.1),('West partition',(-1.31,-.15,1.7),(-1,0),1.2,1.4),('East partition',(1.31,-.5,1.7),(1,0),1.45,1.05),('South gallery',(-.05,-3.015,1.7),(0,1),1.05,1.3),('East wing',(5.3,-1.01,1.7),(0,-1),1.65,1.05),('End wall',(7.69,-2.0,1.7),(-1,0),1.1,1.35)]
for i,(name,pos,n,w,h) in enumerate(placements):
 root=bpy.data.objects.new('Painting %02d | %s'%(i+1,name),None);col.objects.link(root);root.location=pos;root.rotation_euler.z=math.atan2(-n[0],n[1]);root['mount_height_m']=1.7
 fm=oak if i%3==1 else frame
 block('Backing | '+name,root,(0,.017,0),(w,.032,h),frame)
 block('Archival mount | '+name,root,(0,.037,0),(w-.06,.012,h-.06),mount)
 for x in [-w/2+.016,w/2-.016]:block('Vertical frame | '+name,root,(x,.049,0),(.032,.062,h),fm,.003)
 for z in [-h/2+.016,h/2-.016]:block('Horizontal frame | '+name,root,(0,.049,z),(w-.064,.062,.032),fm,.003)
 aw=w*.76;ah=h*.73
 block('Canvas | '+name,root,(0,.047,0),(aw,.008,ah),colors[4])
 block('Paint field | '+name,root,(-aw*.18,.053,-ah*.1),(aw*.40,.003,ah*.65),colors[i%4])
 block('Paint field B | '+name,root,(aw*.22,.055,-ah*.26),(aw*.36,.003,ah*.23),colors[(i+2)%6])
 bpy.ops.mesh.primitive_cylinder_add(vertices=64,radius=min(aw,ah)*.21,depth=.003)
 disk=bpy.context.object;disk.name='Painted circle | '+name;link(disk);disk.parent=root;disk.location=(aw*.18,.056,ah*.20);disk.rotation_euler=(math.pi/2,0,0);disk.data.materials.append(colors[(i+1)%6])
 # Small gallery caption, deliberately unlettered.
 block('Caption plaque | '+name,root,(w/2+.10,.022,-h/2+.05),(.12,.008,.08),mount,.001)
bpy.ops.wm.save_as_mainfile(filepath=bpy.data.filepath)
result={'paintings_added':len(placements),'areas':[p[0] for p in placements],'saved':bpy.data.filepath}

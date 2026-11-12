import bpy,os,json,math,hashlib,datetime
from mathutils import Vector,Matrix
OUT=r'C:\Users\aaron\OneDrive\Documents\ChatGPT\RVA\gallery_output'
s=bpy.context.scene
assert os.path.basename(bpy.data.filepath).lower()=='rvasa2.blend'
assert not bpy.data.collections.get('09_Modeled_Artwork_Spotlights'),'Spotlights already added'
stamp=datetime.datetime.now().strftime('%Y%m%d_%H%M%S')
backup=os.path.join(OUT,'RVASA2_Before_Lighting_'+stamp+'.blend')
bpy.ops.wm.save_as_mainfile(filepath=backup,copy=True)
frame=s.frame_current;camera=s.camera
def geometry_state(o):
    data={'matrix':[list(r) for r in o.matrix_world]}
    if o.type=='MESH':data['verts']=[list(v.co) for v in o.data.vertices]
    return hashlib.sha256(repr(data).encode()).hexdigest()
protected={o.name:geometry_state(o) for o in s.objects if o.name.startswith(('Gallery_','Artwork_','W_Frame_','W_Credit_','W_Plant_','W_CRT_'))}
def animation_state():
    vals=[]
    for a in bpy.data.actions:
        for layer in a.layers:
            for strip in layer.strips:
                for slot in a.slots:
                    bag=strip.channelbag(slot,ensure=False)
                    if bag:
                        for fc in bag.fcurves:vals.append((a.name,fc.data_path,fc.array_index,[(tuple(k.co),tuple(k.handle_left),tuple(k.handle_right),k.interpolation) for k in fc.keyframe_points]))
    return hashlib.sha256(repr(vals).encode()).hexdigest()
animation_before=animation_state()
remove=[o for o in s.objects if o.name.startswith(('Recessed_Light_','Light_Recess_')) or o.name in ('Area_Entrance','Area_Alcove','Area_Right','Area_Bottom','W_Amber_Bounce','W_Rose_Bounce')]
removed=[o.name for o in remove]
for o in remove:bpy.data.objects.remove(o,do_unlink=True)
col=bpy.data.collections.new('09_Modeled_Artwork_Spotlights');s.collection.children.link(col)
def material(name,rgb,rough=.4,metal=.5,emission=0):
    m=bpy.data.materials.new(name);m.use_nodes=True;m.diffuse_color=(*rgb,1)
    p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=(*rgb,1);p.inputs['Roughness'].default_value=rough;p.inputs['Metallic'].default_value=metal
    if emission:p.inputs['Emission Color'].default_value=(*rgb,1);p.inputs['Emission Strength'].default_value=emission
    return m
housing=material('Fixture | matte charcoal metal',(.022,.029,.038),.36,.6)
inner=material('Fixture | black optical baffle',(.006,.008,.010),.65,.1)
trim=material('Fixture | satin metal trim',(.11,.13,.15),.26,.75)
lens=material('Fixture | warm LED glass',(1,.82,.61),.3,0,2)
def move(o):
    for c in list(o.users_collection):c.objects.unlink(o)
    col.objects.link(o)
def cylinder(name,loc,radius,depth,mat,parent=None,rotation=None):
    bpy.ops.mesh.primitive_cylinder_add(vertices=32,radius=radius,depth=depth)
    o=bpy.context.object;o.name=name;move(o);o.parent=parent;o.location=loc
    if rotation:o.rotation_euler=rotation
    o.data.materials.append(mat)
    b=o.modifiers.new('Soft machined edge','BEVEL');b.width=.003;b.segments=2
    o.modifiers.new('Weighted normals','WEIGHTED_NORMAL')
    return o
def rod(name,a,b,radius,mat,parent=None):
    av,bv=Vector(a),Vector(b);o=cylinder(name,(av+bv)/2,radius,(bv-av).length,mat,parent)
    o.rotation_euler=(bv-av).to_track_quat('Z','Y').to_euler();return o
def shell(name,parent):
    # Hollow body: open aperture, recessed inner barrel and closed back.
    count=48;profile=[(.112,.015),(.112,.265),(.077,.265),(.077,.015)]
    verts=[(r*math.cos(j*math.tau/count),r*math.sin(j*math.tau/count),z) for r,z in profile for j in range(count)]
    faces=[]
    for k in range(4):
        for j in range(count):faces.append((k*count+j,k*count+(j+1)%count,((k+1)%4)*count+(j+1)%count,((k+1)%4)*count+j))
    mesh=bpy.data.meshes.new(name);mesh.from_pydata(verts,[],faces);mesh.update()
    o=bpy.data.objects.new(name,mesh);col.objects.link(o);o.parent=parent;mesh.materials.append(housing);mesh.materials.append(inner)
    for p in mesh.polygons:p.material_index=1 if 2*count<=p.index<3*count else 0;p.use_smooth=True
    bevel=o.modifiers.new('Barrel edge radius','BEVEL');bevel.width=.002;bevel.segments=2
    o.modifiers.new('Weighted normals','WEIGHTED_NORMAL');return o
arts=sorted([o for o in s.objects if o.name.startswith('Artwork_')],key=lambda o:o.name)
assert len(arts)==16
fixtures=[]
for i,art in enumerate(arts,1):
    for m in art.data.materials:
        if m and m.use_nodes:
            for node in m.node_tree.nodes:
                if node.type=='BSDF_PRINCIPLED':
                    node.inputs['Emission Strength'].default_value=0
                    for link in list(node.inputs['Emission Color'].links):m.node_tree.links.remove(link)
                    node.inputs['Emission Color'].default_value=(0,0,0,1)
    normal=(art.matrix_world.to_3x3()@Vector((0,0,1))).normalized()
    target=art.matrix_world.translation.copy()
    # Lens at 3.80 m. Stem/canopy meet the existing ceiling at 4.50 m.
    origin=target+normal*1.15+Vector((0,0,2.0))
    rot=(target-origin).to_track_quat('-Z','Y')
    root=bpy.data.objects.new('Fixture_%02d | %s'%(i,art.get('Title',art.name)),None);col.objects.link(root);root.location=origin;root.rotation_mode='QUATERNION';root.rotation_quaternion=rot;root.empty_display_size=.10
    shell('Spot_%02d | hollow barrel'%i,root)
    cylinder('Spot_%02d | back cap'%i,(0,0,.267),.109,.012,housing,root)
    cylinder('Spot_%02d | LED lens'%i,(0,0,.021),.075,.008,lens,root)
    for sign in [-1,1]:cylinder('Spot_%02d | swivel pin'%i,(sign*.119,0,.18),.03,.024,trim,root,(0,math.pi/2,0))
    pivot=origin+rot@Vector((0,0,.18));side=rot@Vector((1,0,0));top=pivot+Vector((0,0,.16))
    mount=bpy.data.objects.new('Mount_%02d | ceiling bracket'%i,None);col.objects.link(mount)
    cylinder('Spot_%02d | ceiling canopy'%i,(top.x,top.y,4.47),.092,.04,housing,mount)
    rod('Spot_%02d | suspension stem'%i,(top.x,top.y,4.45),top,.012,housing,mount)
    rod('Spot_%02d | yoke crossbar'%i,top-side*.145,top+side*.145,.014,housing,mount)
    for sign in [-1,1]:rod('Spot_%02d | yoke fork'%i,top+side*sign*.145,pivot+side*sign*.145,.013,housing,mount)
    light=bpy.data.objects.get('W_Artwash_%02d'%i)
    assert light and light.type=='LIGHT'
    d=bpy.data.lights.new('Spot_%02d | aimed LED source'%i,'SPOT');d.energy=180;d.color=(1,.89,.75);d.spot_size=math.radians(75);d.spot_blend=.55;d.shadow_soft_size=.055
    light.data=d;light.name='W_Artwork_Spot_%02d'%i
    for c in list(light.users_collection):c.objects.unlink(light)
    col.objects.link(light);light.parent=root;light.matrix_parent_inverse=Matrix.Identity(4);light.location=(0,0,0);light.rotation_euler=(0,0,0);light.scale=(1,1,1)
    light['Illuminates']=art.name;light['Fixture']=root.name
    root['Artwork']=art.name;root['Type']='Ceiling-mounted adjustable LED spotlight'
    fixtures.append({'artwork':art.name,'fixture':root.name,'light':light.name,'power_w':d.energy})
bpy.context.view_layer.update()
assert all(geometry_state(bpy.data.objects[name])==state for name,state in protected.items())
assert animation_state()==animation_before
assert s.camera==camera and s.frame_current==frame
assert not any(o.name.startswith(('Recessed_Light_','Light_Recess_','Area_')) for o in s.objects)
assert all(o.parent and o.parent.name.startswith('Fixture_') for o in s.objects if o.type=='LIGHT')
assert len([o for o in s.objects if o.type=='LIGHT'])==16
for o in arts:assert all(m.node_tree.nodes.get('Principled BSDF').inputs['Emission Strength'].default_value==0 for m in o.data.materials)
bpy.ops.object.select_all(action='DESELECT')
s['Lighting revision']='Recessed light assemblies and duplicate accent bounces removed. Paintings have zero emission. Sixteen modeled ceiling-mounted LED spotlights provide artwork illumination.'
bpy.ops.wm.save_as_mainfile(filepath=bpy.data.filepath)
report={'file':bpy.data.filepath,'backup':backup,'removed':removed,'fixtures':fixtures,'artwork_emission':0,'architecture_and_artwork_geometry_unchanged':True,'animation_unchanged':True,'previous_camera_preserved':camera.name if camera else None,'frame_preserved':frame}
json.dump(report,open(os.path.join(OUT,'RVASA2_Lighting_Revision.json'),'w'),indent=2)
result={'saved':bpy.data.filepath,'backup':backup,'removed_objects':len(removed),'modeled_spotlights':len(fixtures),'painting_emission':0,'camera_and_animation_preserved':True}

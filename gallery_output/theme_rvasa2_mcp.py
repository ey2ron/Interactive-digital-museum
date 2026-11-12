import bpy,os,json,math,hashlib,random
from mathutils import Vector
OUT=r'C:\Users\aaron\OneDrive\Documents\ChatGPT\RVA\gallery_output'
ASSETS=os.path.join(OUT,'waneella_assets')
s=bpy.context.scene
assert os.path.basename(bpy.data.filepath).lower()=='rvasa2.blend'
assert not bpy.data.collections.get('05_Waneella_Frames'), 'Theme already applied'
target=bpy.data.filepath
def geom(o):
    return {'loc':list(o.location),'rot':list(o.rotation_euler),'scale':list(o.scale),'verts':[list(v.co) for v in o.data.vertices]}
architecture={o.name:geom(o) for o in bpy.data.collections['01_Gallery_Architecture'].objects if o.type=='MESH'}
def actions():
    result={}
    for a in bpy.data.actions:
        curves=[]
        for layer in a.layers:
            for strip in layer.strips:
                for slot in a.slots:
                    bag=strip.channelbag(slot,ensure=False)
                    if bag:
                        for f in bag.fcurves:
                            curves.append((f.data_path,f.array_index,[(tuple(k.co),tuple(k.handle_left),tuple(k.handle_right),k.interpolation) for k in f.keyframe_points]))
        result[a.name]=hashlib.sha256(repr(curves).encode()).hexdigest()
    return result
action_before=actions()
slotpos={o.name:tuple(o.location) for o in s.objects if o.name.startswith('Artwork_')}
camera_before=(s.camera.name,s.frame_current,s.frame_start,s.frame_end)
frames=bpy.data.collections.new('05_Waneella_Frames');s.collection.children.link(frames)
urban=bpy.data.collections.new('06_Waneella_Urban_Details');s.collection.children.link(urban)
lights=bpy.data.collections.new('07_Waneella_Accent_Lighting');s.collection.children.link(lights)
def move(o,col):
    for c in list(o.users_collection):c.objects.unlink(o)
    col.objects.link(o)
def mat(name,rgb,rough=.6,metal=0,emit=0):
    m=bpy.data.materials.new(name);m.use_nodes=True;m.diffuse_color=(*rgb,1)
    p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=(*rgb,1);p.inputs['Roughness'].default_value=rough;p.inputs['Metallic'].default_value=metal
    p.inputs['Emission Color'].default_value=(*rgb,1);p.inputs['Emission Strength'].default_value=emit
    return m
def box(name,loc,size,material,col=urban,parent=None,bevel=.008):
    bpy.ops.mesh.primitive_cube_add(size=1);o=bpy.context.object;o.name=name;move(o,col);o.parent=parent;o.location=loc;o.dimensions=size
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);o.data.materials.append(material)
    if bevel:
        b=o.modifiers.new('Manufactured edge','BEVEL');b.width=bevel;b.segments=3;o.modifiers.new('Weighted normals','WEIGHTED_NORMAL')
    return o
def text(name,body,loc,size,material,parent=None,col=frames):
    d=bpy.data.curves.new(name,'FONT');d.body=body;d.size=size;d.align_x='CENTER';d.space_line=1.35;d.extrude=.0002
    o=bpy.data.objects.new(name,d);col.objects.link(o);o.parent=parent;o.location=loc;d.materials.append(material);return o
def tube(name,points,material,radius=.012):
    d=bpy.data.curves.new(name,'CURVE');d.dimensions='3D';d.bevel_depth=radius;d.bevel_resolution=3
    sp=d.splines.new('POLY');sp.points.add(len(points)-1)
    for p,co in zip(sp.points,points):p.co=(*co,1)
    o=bpy.data.objects.new(name,d);urban.objects.link(o);d.materials.append(material);return o
def area(name,loc,aim,power,color,size):
    d=bpy.data.lights.new(name,'AREA');d.energy=power;d.color=color;d.shape='DISK';d.size=size
    o=bpy.data.objects.new(name,d);lights.objects.link(o);o.location=loc;o.rotation_euler=(Vector(aim)-o.location).to_track_quat('-Z','Y').to_euler();return o
wall=mat('Waneella | blue-gray mineral plaster',(.14,.21,.27),.82)
nt=wall.node_tree;noise=nt.nodes.new('ShaderNodeTexNoise');noise.inputs['Scale'].default_value=85;noise.inputs['Detail'].default_value=2
bump=nt.nodes.new('ShaderNodeBump');bump.inputs['Strength'].default_value=.10;bump.inputs['Distance'].default_value=.015;nt.links.new(noise.outputs['Fac'],bump.inputs['Height']);nt.links.new(bump.outputs['Normal'],nt.nodes.get('Principled BSDF').inputs['Normal'])
floor=mat('Waneella | honed charcoal concrete',(.095,.12,.14),.40)
nt=floor.node_tree;noise=nt.nodes.new('ShaderNodeTexNoise');noise.inputs['Scale'].default_value=7
bump=nt.nodes.new('ShaderNodeBump');bump.inputs['Strength'].default_value=.12;bump.inputs['Distance'].default_value=.018;nt.links.new(noise.outputs['Fac'],bump.inputs['Height']);nt.links.new(bump.outputs['Normal'],nt.nodes.get('Principled BSDF').inputs['Normal'])
ceiling=mat('Waneella | slate ceiling',(.12,.16,.205),.85)
charcoal=mat('Waneella | charcoal frames',(.015,.02,.026),.32,.5)
mount=mat('Waneella | archival mount',(.44,.48,.49),.82)
ivory=mat('Waneella | ivory labels',(.73,.77,.75),.65,emit=.18)
metal=mat('Waneella | conduit graphite',(.045,.065,.08),.36,.65)
amber=mat('Waneella | amber lens',(.95,.38,.11),.35,emit=3)
rose=mat('Waneella | rose lens',(.6,.13,.28),.35,emit=2.5)
for name,m in [('Gallery_Walls',wall),('Gallery_Floor',floor),('Gallery_Ceiling',ceiling),('Gallery_Recessed_Baseboard',charcoal)]:
    bpy.data.objects[name].data.materials.clear();bpy.data.objects[name].data.materials.append(m)
sources=json.load(open(os.path.join(ASSETS,'sources.json')))+json.load(open(os.path.join(ASSETS,'rvasa2_extra_sources.json')))
lookup={a['id']:a for a in sources}
sequence=['radiant','tea_time','moon_shine','rainbow','copper','milk_tea','hearth','night_sky','last_morning','shimmer','second_chance','still_night','through_dust','purple_fatigue','breeze','0542']
slots=sorted([o for o in s.objects if o.name.startswith('Artwork_')],key=lambda o:o.name)
assert len(slots)==16
manifest=[]
for i,(o,key) in enumerate(zip(slots,sequence),1):
    a=lookup[key];im=bpy.data.images.load(os.path.join(ASSETS,key+'.png'),check_existing=True);im.name='Waneella | '+a['title'];im.pack()
    ratio=im.size[0]/im.size[1];h=min(1.85,1.6/ratio);w=h*ratio
    if i in (12,13,14):o.rotation_euler=(math.pi/2,0,0)
    mesh=bpy.data.meshes.new(o.name+' | artwork plane');mesh.from_pydata([(-w/2,-h/2,.039),(w/2,-h/2,.039),(w/2,h/2,.039),(-w/2,h/2,.039)],[],[(0,1,2,3)]);mesh.update();o.data=mesh
    uv=mesh.uv_layers.new(name='Uncropped artwork')
    for q,co in zip(uv.data,[(0,0),(1,0),(1,1),(0,1)]):q.uv=co
    m=mat('Waneella art | '+a['title'],(.5,.5,.5),.85);nt=m.node_tree;p=nt.nodes.get('Principled BSDF');p.inputs['Specular IOR Level'].default_value=.1
    tex=nt.nodes.new('ShaderNodeTexImage');tex.image=im;tex.interpolation='Closest';tex.extension='CLIP';nt.links.new(tex.outputs['Color'],p.inputs['Base Color']);nt.links.new(tex.outputs['Color'],p.inputs['Emission Color']);p.inputs['Emission Strength'].default_value=.28;o.data.materials.append(m)
    o['Artist']='Waneella';o['Title']=a['title'];o['Source URL']=a['source'];o['Image aspect ratio']=ratio
    fw=w+.16;fh=h+.16
    box('W_Frame_Back_%02d'%i,(0,0,.01),(fw,fh,.02),charcoal,frames,o)
    box('W_Frame_Mount_%02d'%i,(0,0,.026),(fw-.04,fh-.04,.01),mount,frames,o,0)
    for x in [-fw/2+.014,fw/2-.014]:box('W_Frame_Side_%02d'%i,(x,0,.055),(.028,fh,.065),charcoal,frames,o,.003)
    for y in [-fh/2+.014,fh/2-.014]:box('W_Frame_Rail_%02d'%i,(0,y,.055),(fw-.056,.028,.065),charcoal,frames,o,.003)
    box('W_Credit_Plaque_%02d'%i,(0,-fh/2-.14,.01),(min(.74,fw),.16,.015),charcoal,frames,o,.002)
    text('W_Credit_%02d'%i,a['title']+'\nWANEELLA',(0,-fh/2-.126,.019),.029,ivory,o)
    normal=o.rotation_euler.to_matrix()@Vector((0,0,1));center=o.location.copy()
    area('W_Artwash_%02d'%i,center+normal*1.0+Vector((0,0,1.50)),center,90,(1,.89,.75),.75)
    manifest.append({**a,'slot':o.name,'size_m':[w,h],'pixels':list(im.size)})
for o in bpy.data.collections['03_Lighting'].objects:
    if o.type=='LIGHT':
        o.data.color=(.40,.59,1);o.data.energy*=.85
    elif o.name.startswith('Recessed_Light_'):
        o.data.materials.clear();o.data.materials.append(amber if 'Entrance' in o.name or 'Bottom' in o.name else ivory)
bg=s.world.node_tree.nodes['Background'];bg.inputs[0].default_value=(.12,.19,.32,1);bg.inputs[1].default_value=.25
for j,z in enumerate([3.55,3.65]):
    tube('W_Entrance_Conduit_%d'%j,[(.6,9.83,z),(11.65,9.83,z)],metal)
    tube('W_North_Conduit_%d'%j,[(12.35,14.83,z),(23.65,14.83,z)],metal)
    tube('W_Right_Conduit_%d'%j,[(23.83,.4,z),(23.83,14.6,z)],metal)
for x in [1.5,5,10.5]:box('W_Conduit_Bracket',(x,9.85,3.60),(.045,.05,.18),metal)
box('W_Amber_Accent',(8,9.82,3.22),(3.0,.025,.025),amber)
box('W_Rose_Accent',(23.82,6.4,3.25),(.025,2.0,.025),rose)
area('W_Amber_Bounce',(8,9.4,3.25),(8,9.88,2.7),65,(1,.38,.10),2)
area('W_Rose_Bounce',(23.4,6.4,3.3),(23.88,6.4,2.7),55,(1,.15,.32),1.7)
t=text('W_Gallery_Identity','W A N E E L L A',(8,9.81,3.80),.20,ivory,col=urban);t.rotation_euler=(math.pi/2,0,0)
t=text('W_Gallery_Subtitle','P I X E L S C A P E S  /  A F T E R  H O U R S',(8,9.81,3.43),.052,ivory,col=urban);t.rotation_euler=(math.pi/2,0,0)
# Wall-mounted props retain the broad clear camera route.
shelf=mat('Waneella | shelf slate',(.15,.20,.22),.45)
box('W_Retro_Display_Shelf',(3.5,9.57,1.0),(1.35,.48,.065),shelf)
for x in [3.05,3.95]:box('W_Shelf_Support',(x,9.70,.88),(.04,.20,.21),metal)
crt=bpy.data.objects.new('W_Retro_Monitor',None);urban.objects.link(crt);crt.location=(3.4,9.54,1.04)
casing=mat('Waneella | CRT gray enamel',(.29,.31,.29),.46)
screen=mat('Waneella | CRT phosphor',(.018,.14,.2),.3,emit=1.5)
box('W_CRT_Foot',(0,0,.025),(.37,.30,.05),charcoal,parent=crt)
box('W_CRT_Case',(0,.02,.25),(.50,.40,.40),casing,parent=crt,bevel=.04)
box('W_CRT_Bezel',(0,-.19,.26),(.435,.035,.315),charcoal,parent=crt,bevel=.025)
box('W_CRT_Screen',(-.02,-.212,.27),(.35,.012,.245),screen,parent=crt,bevel=.017)
t=text('W_CRT_Text','AFTER\nHOURS',(-.02,-.221,.29),.042,ivory,crt,urban);t.rotation_euler=(math.pi/2,0,0)
for z in [.18,.25]:box('W_CRT_Knob',(.189,-.216,z),(.026,.02,.028),casing,parent=crt,bevel=.004)
pot=mat('Waneella | clay pots',(.26,.12,.08),.8);leaf=mat('Waneella | dusty jade foliage',(.055,.18,.11),.7)
box('W_Plant_Shelf',(13.25,14.57,1.05),(.65,.45,.065),shelf)
random.seed(47)
for pi,(x,y,z) in enumerate([(3.95,9.55,1.04),(13.25,14.57,1.09)]):
    bpy.ops.mesh.primitive_cone_add(vertices=24,radius1=.075,radius2=.10,depth=.16,location=(x,y,z+.08));o=bpy.context.object;o.name='W_Planter_%d'%pi;move(o,urban);o.data.materials.append(pot)
    for j in range(7):
        a=j*math.tau/7;tip=(x+math.cos(a)*.10,y+math.sin(a)*.10,z+.34+random.random()*.10)
        tube('W_Plant_Stem',[(x,y,z+.15),tip],leaf,.003)
        bpy.ops.mesh.primitive_uv_sphere_add(segments=10,ring_count=6,radius=1,location=tip);o=bpy.context.object;o.name='W_Plant_Leaf';move(o,urban);o.scale=(.035,.018,.09);o.rotation_euler=(.4*math.sin(a),.4*math.cos(a),a);o.data.materials.append(leaf)
# Additional still cameras; the existing animated rig remains active and unchanged.
review=bpy.data.collections.new('08_Waneella_Review_Cameras');s.collection.children.link(review)
for name,loc,aim,lens,ortho in [('W_Review_Entrance',(4.8,6.1,1.7),(8.7,9.8,2.0),24,None),('W_Review_Overview',(-8,-16,29),(12,7.5,0),35,35)]:
    d=bpy.data.cameras.new(name);o=bpy.data.objects.new(name,d);review.objects.link(o);o.location=loc;o.rotation_euler=(Vector(aim)-o.location).to_track_quat('-Z','Y').to_euler();d.lens=lens
    if ortho:d.type='ORTHO';d.ortho_scale=ortho
credits='RVASA2 / WANEELLA AFTER HOURS\n16 actual works by Waneella. Static first frames from public artist posts.\n\n'+'\n\n'.join(f"{a['slot']}: {a['title']} — Waneella\n{a['source']}\n{a['image']}" for a in manifest)
bpy.data.texts.new('Waneella_Artwork_Sources').write(credits)
open(os.path.join(OUT,'RVASA2_Artwork_Sources.txt'),'w',encoding='utf-8').write(credits)
json.dump(manifest,open(os.path.join(OUT,'RVASA2_Artwork_Manifest.json'),'w'),indent=2)
s['Waneella theme']='Applied through Blender MCP to original RVASA2, preserving architecture and camera animation.'
s['Artwork facing repair']='Slots 12, 13 and 14 now face into the bottom corridor. Positions preserved.'
bpy.context.view_layer.update()
assert architecture=={name:geom(bpy.data.objects[name]) for name in architecture}
assert actions()==action_before
assert all(tuple(bpy.data.objects[name].location)==pos for name,pos in slotpos.items())
assert camera_before==(s.camera.name,s.frame_current,s.frame_start,s.frame_end)
for scr in bpy.data.screens:
    for a in scr.areas:
        if a.type=='VIEW_3D':
            a.spaces.active.shading.type='MATERIAL';a.spaces.active.shading.use_scene_lights=True;a.spaces.active.shading.use_scene_world=True
            a.spaces.active.region_3d.view_perspective='CAMERA'
bpy.ops.object.select_all(action='DESELECT')
bpy.ops.file.pack_all()
bpy.ops.wm.save_as_mainfile(filepath=target)
json.dump({'architecture_unchanged':True,'camera_animation_unchanged':True,'camera_action_hashes':action_before,'slot_positions_unchanged':True,'artworks':16,'reoriented_slots':[12,13,14],'active_file':target},open(os.path.join(OUT,'RVASA2_Validation.json'),'w'),indent=2)
result={'saved':target,'artworks':len(manifest),'packed':sum(bool(im.packed_file) for im in bpy.data.images if im.name.startswith('Waneella | ')),'architecture_unchanged':True,'camera_animation_unchanged':True,'active_frame':s.frame_current}

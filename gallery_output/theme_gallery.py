import bpy, math, os, json, hashlib, random
from mathutils import Vector
OUT=os.path.dirname(os.path.abspath(__file__))
ASSETS=os.path.join(OUT,'waneella_assets')
s=bpy.context.scene
original=os.path.join(OUT,'Minimalist_Gallery.blend')
original_hash=hashlib.sha256(open(original,'rb').read()).hexdigest()
root=bpy.data.collections['GALLERY | reference layout']
architecture=bpy.data.collections['01 Architecture']
protected={o.name: {'matrix':[list(r) for r in o.matrix_world], 'vertices':[list(v.co) for v in o.data.vertices] if o.type=='MESH' else []} for o in architecture.objects}
plinth_state={o.name:(tuple(o.location),tuple(o.dimensions)) for o in s.objects if o.name.startswith('Empty display plinth')}
positions={o.name[:11]: (tuple(o.location),tuple(o.rotation_euler)) for o in s.objects if o.name.startswith('Painting ') and o.type=='EMPTY'}
oldcol=bpy.data.collections['05 Framed paintings']
for o in list(oldcol.objects): bpy.data.objects.remove(o,do_unlink=True)
artcol=oldcol
detail=bpy.data.collections.new('06 Urban details');root.children.link(detail)
accent=bpy.data.collections.new('07 Dusk accents');root.children.link(accent)

def move(o,col):
    for c in list(o.users_collection): c.objects.unlink(o)
    col.objects.link(o)
def material(name,rgb,rough=.6,metal=0,emission=0):
    m=bpy.data.materials.new(name);m.use_nodes=True;m.diffuse_color=(*rgb,1)
    p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=(*rgb,1);p.inputs['Roughness'].default_value=rough;p.inputs['Metallic'].default_value=metal
    if emission: p.inputs['Emission Color'].default_value=(*rgb,1);p.inputs['Emission Strength'].default_value=emission
    return m
def box(name,loc,size,mat,col=detail,parent=None,bevel=.008):
    bpy.ops.mesh.primitive_cube_add(size=1);o=bpy.context.object;o.name=name;move(o,col);o.parent=parent;o.location=loc;o.dimensions=size
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);o.data.materials.append(mat)
    if bevel:
        b=o.modifiers.new('Soft edge','BEVEL');b.width=bevel;b.segments=3
        o.modifiers.new('Weighted normals','WEIGHTED_NORMAL')
    return o
def text(name,body,loc,size,mat,col=detail,parent=None):
    d=bpy.data.curves.new(name,'FONT');d.body=body;d.size=size;d.align_x='CENTER';d.space_line=1.4;d.extrude=.0003
    o=bpy.data.objects.new(name,d);col.objects.link(o);o.parent=parent;o.location=loc;o.rotation_euler=(math.pi/2,0,math.pi);d.materials.append(mat);return o
def tube(name,points,radius,mat,col=detail):
    d=bpy.data.curves.new(name,'CURVE');d.dimensions='3D';d.bevel_depth=radius;d.bevel_resolution=3
    sp=d.splines.new('POLY');sp.points.add(len(points)-1)
    for p,co in zip(sp.points,points):p.co=(*co,1)
    o=bpy.data.objects.new(name,d);col.objects.link(o);d.materials.append(mat);return o
def area(name,loc,target,power,color,size,col=accent):
    d=bpy.data.lights.new(name,'AREA');d.energy=power;d.color=color;d.shape='DISK';d.size=size
    o=bpy.data.objects.new(name,d);col.objects.link(o);o.location=loc;o.rotation_euler=(Vector(target)-o.location).to_track_quat('-Z','Y').to_euler();return o

# Reuse the original 8K wall/floor texture nodes, changing only palette and response.
wall=bpy.data.materials['Warm white | matte mineral plaster'];wall.name='Dusk | blue-gray mineral plaster'
for n in wall.node_tree.nodes:
    if n.type=='VALTORGB':
        n.color_ramp.elements[0].color=(.13,.19,.235,1);n.color_ramp.elements[1].color=(.19,.265,.31,1)
wall.diffuse_color=(.17,.235,.28,1)
ceilingmat=material('Dusk | soft slate ceiling',(.19,.235,.28),.85)
bpy.data.objects['Ceiling | hide for layout view'].data.materials[0]=ceilingmat
floor=bpy.data.materials['Seamless honed concrete | 8K PBR'];floor.name='Dusk | subdued honed concrete 8K'
for n in floor.node_tree.nodes:
    if n.type=='VALTORGB':
        n.color_ramp.elements[0].color=(.075,.095,.115,1);n.color_ramp.elements[1].color=(.13,.15,.17,1)
    if n.type=='MAP_RANGE':n.inputs['To Min'].default_value=.32;n.inputs['To Max'].default_value=.43
floor.diffuse_color=(.11,.13,.15,1)
pm=bpy.data.materials['Museum white | satin display lacquer'];pm.name='Dusk | slate display lacquer';pm.node_tree.nodes.get('Principled BSDF').inputs['Base Color'].default_value=(.205,.27,.29,1);pm.diffuse_color=(.205,.27,.29,1)
charcoal=material('Exhibit | charcoal anodized frame',(.017,.023,.03),.32,.45)
mount=material('Exhibit | cool archival mount',(.44,.49,.50),.85)
letters=material('Exhibit | warm ivory lettering',(.72,.76,.73),.6,emission=.15)
amber=material('Accent | amber strip',(.95,.39,.13),.35,emission=3)
pink=material('Accent | muted rose strip',(.55,.13,.28),.35,emission=2)
metal=material('Urban | graphite conduit',(.055,.075,.085),.36,.65)

sources=json.load(open(os.path.join(ASSETS,'sources.json'),encoding='utf-8'))
byid={a['id']:a for a in sources}
# Alternate warm/cool and urban/interior scenes along the existing display route.
sequence=['radiant','tea_time','0542','rainbow','copper','still_night','milk_tea','last_morning']
names=['Entrance','North alcove','North gallery','West partition','East partition','South gallery','East wing','End wall']
manifest=[]
for i,(key,label) in enumerate(zip(sequence,names),1):
    a=byid[key];im=bpy.data.images.load(os.path.join(ASSETS,key+'.png'));im.name='Waneella | '+a['title'];im.pack()
    ratio=im.size[0]/im.size[1];h=1.42 if ratio<.8 else 1.30;w=h*ratio;outerw=w+.16;outerh=h+.16
    parent=bpy.data.objects.new('Painting %02d | %s'%(i,label),None);artcol.objects.link(parent)
    if i==5:parent.location=(1.6375,-.625,1.7);parent.rotation_euler=(0,0,-math.pi/2)
    else:parent.location,parent.rotation_euler=positions['Painting %02d'%i]
    parent['artist']='Waneella';parent['title']=a['title'];parent['source_url']=a['source'];parent['mount_height_m']=1.7
    parent['image_dimensions_px']=list(im.size);parent['display_aspect_ratio']=ratio
    box('Backing | '+label,(0,.017,0),(outerw,.032,outerh),charcoal,artcol,parent)
    box('Archival mount | '+label,(0,.037,0),(outerw-.04,.012,outerh-.04),mount,artcol,parent,0)
    for x in [-outerw/2+.014,outerw/2-.014]:box('Frame upright | '+label,(x,.055,0),(.028,.065,outerh),charcoal,artcol,parent,.003)
    for z in [-outerh/2+.014,outerh/2-.014]:box('Frame rail | '+label,(0,.055,z),(outerw-.056,.065,.028),charcoal,artcol,parent,.003)
    mesh=bpy.data.meshes.new('Full image UV | '+key)
    mesh.from_pydata([(w/2,.046,-h/2),(-w/2,.046,-h/2),(-w/2,.046,h/2),(w/2,.046,h/2)],[],[(0,1,2,3)]);mesh.update()
    uv=mesh.uv_layers.new(name='Full uncropped artwork')
    for loop,co in zip(uv.data,[(0,0),(1,0),(1,1),(0,1)]):loop.uv=co
    obj=bpy.data.objects.new('Artwork | '+a['title'],mesh);artcol.objects.link(obj);obj.parent=parent
    mat=material('Waneella | '+a['title'],(.4,.4,.4),.8)
    nt=mat.node_tree;p=nt.nodes.get('Principled BSDF');p.inputs['Specular IOR Level'].default_value=.12
    tex=nt.nodes.new('ShaderNodeTexImage');tex.image=im;tex.interpolation='Closest';tex.extension='CLIP';nt.links.new(tex.outputs['Color'],p.inputs['Base Color']);nt.links.new(tex.outputs['Color'],p.inputs['Emission Color']);p.inputs['Emission Strength'].default_value=.3
    obj.data.materials.append(mat)
    box('Credit plaque | '+label,(0,.026,-outerh/2-.135),(min(.66,outerw),.012,.15),charcoal,artcol,parent,.002)
    text('Credit | '+label,a['title']+'\nWANEELLA',(0,.034,-outerh/2-.117),.026,letters,artcol,parent)
    bpy.context.view_layer.update()
    center=parent.location.copy();normal=parent.rotation_euler.to_matrix()@Vector((0,1,0))
    area('Art wash %02d'%i,center+normal*.90+Vector((0,0,1.15)),center,65,(1,.9,.77),.65)
    manifest.append({**a,'slot':i,'location':label,'image_pixels':list(im.size),'image_size_m':[w,h],'still_frame':0})

# Neutral exhibit illumination is independent from colored room lighting.
for o in s.objects:
    if o.type!='LIGHT':continue
    if o.name.startswith('Warm gallery spotlight'):o.data.energy=85;o.data.color=(1,.70,.43)
    elif o.name.startswith('Soft ceiling bounce'):o.data.energy=180;o.data.color=(.43,.61,1)
    elif o.name=='Daylight from open entrance':o.data.energy=550;o.data.color=(.32,.50,1)
bg=s.world.node_tree.nodes['Background'];bg.inputs[0].default_value=(.075,.11,.22,1);bg.inputs[1].default_value=.20

# Thin, high-mounted details preserve the floor circulation completely.
for j,z in enumerate([2.94,3.025]):
    tube('Entrance conduit %d'%j,[(-9.2,1.59,z),(-4.4,1.59,z)],.013,metal)
    tube('North conduit %d'%j,[(-3.95,3.71,z),(3.98,3.71,z)],.013,metal)
    tube('East wing conduit %d'%j,[(4.3,-1.29,z),(9.55,-1.29,z)],.013,metal)
for x in [-8.6,-5.1]:box('Conduit bracket',(x,1.565,2.985),(.045,.028,.15),metal)
box('Amber architectural accent',(-5.4,1.58,2.79),(1.55,.025,.018),amber,accent,bevel=.002)
box('Rose architectural accent',(7.95,-1.29,2.78),(1.10,.025,.018),pink,accent,bevel=.002)
area('Amber wall bounce',(-5.4,1.35,2.75),(-5.4,1.7,2.35),30,(1,.38,.12),1.5)
area('Rose wall bounce',(7.95,-1.5,2.75),(7.95,-1.1,2.3),24,(1,.18,.36),1.0)
titleparent=bpy.data.objects.new('Entrance identity',None);detail.objects.link(titleparent);titleparent.location=(-7.35,1.60,2.76);titleparent.rotation_euler.z=math.pi
text('Gallery title','W A N E E L L A',(0,.015,0),.125,letters,parent=titleparent)
text('Gallery subtitle','P I X E L S C A P E S   /   A F T E R   H O U R S',(0,.015,-.105),.034,letters,parent=titleparent)

# Retro CRT, entirely on the existing entrance plinth.
p=bpy.data.objects['Empty display plinth 01'];top=p.location.z+p.dimensions.z/2
crt=bpy.data.objects.new('Retro monitor | on plinth 01',None);detail.objects.link(crt);crt.location=(p.location.x,p.location.y,top);crt.rotation_euler.z=-math.pi/4
casing=material('CRT | warm gray enamel',(.30,.32,.30),.46)
screen=material('CRT | blue phosphor',(.015,.15,.21),.28,emission=1.5)
box('CRT foot',(0,.035,.025),(.37,.30,.05),charcoal,parent=crt)
box('CRT body',(0,.02,.25),(.50,.40,.40),casing,parent=crt,bevel=.045)
box('CRT bezel',(0,-.19,.26),(.435,.035,.315),charcoal,parent=crt,bevel=.025)
box('CRT phosphor glass',(-.022,-.212,.27),(.345,.012,.245),screen,parent=crt,bevel=.018)
for k in range(9):box('CRT cooling vent',(0,.225,.15+k*.022),(.32,.006,.006),charcoal,parent=crt,bevel=.001)
for k in range(2):box('CRT control',(.188,-.215,.18+k*.07),(.025,.015,.028),casing,parent=crt,bevel=.004)
# Screen typography faces local -Y.
tx=text('CRT display','AFTER\nHOURS',(-.022,-.224,.295),.042,letters,parent=crt);tx.rotation_euler=(math.pi/2,0,0)

potmat=material('Plant | terracotta',(.26,.115,.08),.8)
soil=material('Plant | soil',(.025,.018,.013),1)
leafmat=material('Plant | dusty jade',(.055,.19,.115),.65)
random.seed(47)
for pn in [3,8]:
    p=bpy.data.objects['Empty display plinth %02d'%pn];x,y=p.location.x,p.location.y;z=p.location.z+p.dimensions.z/2
    bpy.ops.mesh.primitive_cone_add(vertices=32,radius1=.09,radius2=.125,depth=.20,location=(x,y,z+.10));o=bpy.context.object;o.name='Small planter | plinth %02d'%pn;move(o,detail);o.data.materials.append(potmat)
    bpy.ops.mesh.primitive_cylinder_add(vertices=32,radius=.115,depth=.008,location=(x,y,z+.197));o=bpy.context.object;o.name='Potting soil';move(o,detail);o.data.materials.append(soil)
    for j in range(8):
        a=j*math.tau/8;h=.28+random.random()*.19;tip=(x+math.cos(a)*.14,y+math.sin(a)*.14,z+.18+h)
        tube('Plant stem',[(x,y,z+.19),tip],.004,leafmat)
        bpy.ops.mesh.primitive_uv_sphere_add(segments=12,ring_count=8,radius=1,location=tip);leaf=bpy.context.object;leaf.name='Jade leaf';move(leaf,detail);leaf.scale=(.042,.02,.115);leaf.rotation_euler=(.5*math.sin(a),.5*math.cos(a),a);leaf.data.materials.append(leafmat)

# Explicit camera views; primary camera placement is preserved.
cam=bpy.data.objects['01 Interior | entrance perspective'];cam.rotation_euler=(Vector((-3.6,.55,1.6))-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.lens=25
d=bpy.data.cameras.new('04 Interior detail');detailcam=bpy.data.objects.new('04 Interior detail',d);bpy.data.collections['04 Cameras'].objects.link(detailcam);detailcam.location=(-5.15,-2.7,1.73);detailcam.rotation_euler=(Vector((-6.5,1.15,1.6))-detailcam.location).to_track_quat('-Z','Y').to_euler();d.lens=36
s.camera=cam;s.render.engine='CYCLES';s.cycles.samples=48;s.cycles.use_denoising=True;s.cycles.device='CPU';s.cycles.max_bounces=6
s.render.resolution_x=1500;s.render.resolution_y=1000;s.render.resolution_percentage=100;s.render.image_settings.file_format='PNG';s.render.film_transparent=False
s.view_settings.view_transform='AgX';s.view_settings.exposure=.6
for screenblock in bpy.data.screens:
    for a in screenblock.areas:
        if a.type=='VIEW_3D':
            a.spaces.active.shading.type='MATERIAL';a.spaces.active.shading.use_scene_world=True;a.spaces.active.shading.use_scene_lights=True
            a.spaces.active.region_3d.view_distance=24;a.spaces.active.region_3d.view_location=(0,0,.6);a.spaces.active.region_3d.view_rotation=bpy.data.objects['02 Layout | axonometric'].rotation_euler.to_quaternion()
s['Theme']='Waneella / After Hours — cool dusk gallery with amber and rose accents'
s['Artwork provenance']='Eight actual Waneella artworks from official Tumblr. Static frame 0, uncropped, nearest-neighbor image sampling. See ARTWORK_SOURCES text.'
s['Repair']='Restored missing Painting 05 parent at original east partition position, adjusted for existing 25% plan expansion.'
credits='WANEELLA / AFTER HOURS\nArtwork copyright Waneella. Source: official artist Tumblr, linked from waneella.com.\nStill frames of public animated artworks.\n\n'+ '\n\n'.join(f"{a['slot']:02d}. {a['title']} — Waneella\n{a['source']}\nDisplay: {a['location']}\nImage: {a['image']}" for a in manifest)
bpy.data.texts.new('ARTWORK_SOURCES').write(credits)
open(os.path.join(OUT,'Waneella_Artwork_Sources.txt'),'w',encoding='utf-8').write(credits)
json.dump(manifest,open(os.path.join(ASSETS,'exhibit_manifest.json'),'w'),indent=2)
bpy.context.view_layer.update()
for name,data in protected.items():
    o=bpy.data.objects[name];assert [list(r) for r in o.matrix_world]==data['matrix'],name
    if o.type=='MESH':assert [list(v.co) for v in o.data.vertices]==data['vertices'],name
for name,(loc,dim) in plinth_state.items():
    o=bpy.data.objects[name];assert tuple(o.location)==loc and tuple(o.dimensions)==dim,name
assert len([o for o in artcol.objects if o.name.startswith('Artwork | ')])==8
assert hashlib.sha256(open(original,'rb').read()).hexdigest()==original_hash
bpy.ops.file.pack_all();s.render.filepath=os.path.join(OUT,'Waneella_Entrance.png')
destination=os.path.join(OUT,'Waneella_Gallery.blend');bpy.ops.wm.save_as_mainfile(filepath=destination)
json.dump({'original_sha256':original_hash,'architecture_unchanged':True,'plinths_unchanged':True,'artworks':8,'packed_images':[(im.name,bool(im.packed_file)) for im in bpy.data.images if im.source=='FILE'],'repaired_mount':5},open(os.path.join(OUT,'Waneella_Validation.json'),'w'),indent=2)
print('THEME_COMPLETE',destination,flush=True)

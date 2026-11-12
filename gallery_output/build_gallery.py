import bpy, math, os, json, struct, zlib
import numpy as np
from mathutils import Vector
OUT=r'C:\Users\aaron\OneDrive\Documents\ChatGPT\RVA\gallery_output'
os.makedirs(OUT,exist_ok=True)

# Streaming 8192px grayscale surface maps avoids a large in-memory image buffer.
def map8k(name, seed):
    p=os.path.join(OUT,name+'.png'); n=8192; rng=np.random.default_rng(seed)
    def chunk(f,t,d):
        f.write(struct.pack('>I',len(d))+t+d+struct.pack('>I',zlib.crc32(t+d)&0xffffffff))
    x=np.arange(n,dtype=np.float32)/n
    with open(p,'wb') as f:
        f.write(b'\x89PNG\r\n\x1a\n'); chunk(f,b'IHDR',struct.pack('>IIBBBBB',n,n,8,0,0,0,0))
        c=zlib.compressobj(4)
        for j in range(n):
            y=j/n
            v=128+13*np.sin(x*37+np.sin(y*31)*2)+9*np.sin(x*113+y*89)+5*np.sin(x*337-y*219)+rng.normal(0,8,n)
            d=c.compress(b'\0'+np.clip(v,0,255).astype(np.uint8).tobytes())
            if d: chunk(f,b'IDAT',d)
        chunk(f,b'IDAT',c.flush()); chunk(f,b'IEND',b'')
    return p
maps=[map8k('concrete_surface_8k',17),map8k('plaster_surface_8k',48)]
scene=bpy.context.scene
scene.unit_settings.system='METRIC'
root=bpy.data.collections.new('GALLERY | reference layout'); scene.collection.children.link(root)
groups={}
for name in ['01 Architecture','02 Display plinths','03 Ceiling and lighting','04 Cameras']:
    c=bpy.data.collections.new(name);root.children.link(c);groups[name]=c
def move(o,group):
    for c in list(o.users_collection):c.objects.unlink(o)
    groups[group].objects.link(o)
def simple(name,color,rough,metal=0):
    m=bpy.data.materials.new(name);m.use_nodes=True;p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=(*color,1);p.inputs['Roughness'].default_value=rough;p.inputs['Metallic'].default_value=metal;return m
white=simple('Warm white | matte mineral plaster',(0.79,0.775,0.74),.78)
concrete=simple('Seamless honed concrete | 8K PBR',(0.37,.365,.345),.28)
plinth=simple('Museum white | satin display lacquer',(.83,.815,.78),.34)
black=simple('Recessed track | black anodized metal',(.018,.02,.022),.29,.65)
for mat,path,low,high,strength,scale in [(white,maps[1],(.73,.715,.685),(.80,.785,.75),.055,1.5),(concrete,maps[0],(.30,.295,.28),(.43,.425,.40),.12,.18)]:
    nt=mat.node_tree;p=nt.nodes.get('Principled BSDF');tex=nt.nodes.new('ShaderNodeTexImage');tex.image=bpy.data.images.load(path);tex.image.colorspace_settings.name='Non-Color';tex.projection='BOX';tex.projection_blend=.25
    co=nt.nodes.new('ShaderNodeTexCoord');mp=nt.nodes.new('ShaderNodeVectorMath');mp.operation='SCALE';mp.inputs[3].default_value=scale;nt.links.new(co.outputs['Object'],mp.inputs[0]);nt.links.new(mp.outputs[0],tex.inputs['Vector'])
    ramp=nt.nodes.new('ShaderNodeValToRGB');ramp.color_ramp.elements[0].color=(*low,1);ramp.color_ramp.elements[1].color=(*high,1);nt.links.new(tex.outputs['Color'],ramp.inputs[0]);nt.links.new(ramp.outputs[0],p.inputs['Base Color'])
    bump=nt.nodes.new('ShaderNodeBump');bump.inputs['Strength'].default_value=strength;bump.inputs['Distance'].default_value=.012;nt.links.new(tex.outputs['Color'],bump.inputs['Height']);nt.links.new(bump.outputs[0],p.inputs['Normal'])
    rough=nt.nodes.new('ShaderNodeMapRange');rough.inputs['To Min'].default_value=.22 if mat==concrete else .73;rough.inputs['To Max'].default_value=.35 if mat==concrete else .85;nt.links.new(tex.outputs['Color'],rough.inputs[0]);nt.links.new(rough.outputs[0],p.inputs['Roughness'])
def box(name,loc,size,mat,group='01 Architecture',bevel=.008):
    bpy.ops.mesh.primitive_cube_add(size=1,location=loc);o=bpy.context.object;o.name=name;o.dimensions=size;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);o.data.materials.append(mat);move(o,group)
    if bevel:
        b=o.modifiers.new('Subtle manufactured edge','BEVEL');b.width=bevel;b.segments=3
        o.modifiers.new('Weighted corner normals','WEIGHTED_NORMAL')
    return o
def xy(p):return ((p[0]-394)*.025,(166-p[1])*.025)
outer=[(82,110),(260,110),(260,42),(527,42),(527,202),(706,202),(706,291),(264,291)]
segments=list(zip(outer,outer[1:]))+ [((346,110),(346,234)),((442,110),(442,291))]
for i,(a,b) in enumerate(segments):
    x,y=xy(a);u,v=xy(b);length=math.hypot(u-x,v-y)
    o=box('Wall %02d | traced from reference'%(i+1),((x+u)/2,(y+v)/2,1.6),(length+.18,.18,3.2),white,bevel=.006);o.rotation_euler.z=math.atan2(v-y,u-x)
poly=[xy(p) for p in outer+[(82,291)]]
def slab(name,z,thickness,mat):
    verts=[(x,y,z) for x,y in poly];mesh=bpy.data.meshes.new(name);mesh.from_pydata(verts,[],[list(reversed(range(len(verts))))]);mesh.update();o=bpy.data.objects.new(name,mesh);groups['01 Architecture'].objects.link(o);o.data.materials.append(mat);s=o.modifiers.new('Solid slab','SOLIDIFY');s.thickness=thickness;return o
floor=slab('Continuous concrete floor | exact stepped footprint',0,.18,concrete)
roof=slab('Ceiling | hide for layout view',3.24,.10,white);move(roof,'03 Ceiling and lighting')
for i,(x,y,w,d,h) in enumerate([(-5.5,-.15,.85,.85,.8),(-3.7,-1.85,1.45,.7,.55),(-2.5,.35,.65,.65,1.1),(.1,1.95,1.25,.65,.75),(.1,-1.6,.65,.65,1.05),(2.4,1.5,.65,.65,.9),(5.2,-2.1,1.6,.7,.55),(6.8,-1.8,.6,.6,1.05)]):
    box('Empty display plinth %02d'%(i+1),(x,y,h/2+.025),(w,d,h),plinth,'02 Display plinths',.012)
    box('Recessed plinth foot %02d'%(i+1),(x,y,.022),(w-.09,d-.09,.044),black,'02 Display plinths',.002)
def light(name,loc,energy,color,size=1,target=None,typ='AREA'):
    d=bpy.data.lights.new(name,typ);d.energy=energy;d.color=color;o=bpy.data.objects.new(name,d);groups['03 Ceiling and lighting'].objects.link(o);o.location=loc
    if typ=='AREA':d.shape='DISK';d.size=size
    else:d.spot_size=math.radians(62);d.spot_blend=.65;d.shadow_soft_size=.09
    if target:o.rotation_euler=(Vector(target)-o.location).to_track_quat('-Z','Y').to_euler()
    return o
warm=(1,.79,.57)
for row,(x,y,length,count) in enumerate([(-4.7,-.8,5.2,5),(-2,2.25,2.1,3),(.1,.25,5.0,5),(2.4,.8,4.2,4),(5.3,-2,4.1,4)]):
    # Tracks run along y except the east gallery and entrance gallery.
    alongx=row in (0,4)
    box('Recessed linear ceiling track %02d'%(row+1),(x,y,3.185),(length if alongx else .075,.075 if alongx else length,.045),black,'03 Ceiling and lighting',.002)
    for k in range(count):
        offset=(k/(count-1)-.5)*(length-.35);xx=x+offset if alongx else x;yy=y if alongx else y+offset
        box('Adjustable spotlight housing %d.%d'%(row,k),(xx,yy,3.1),(.13,.14,.17),black,'03 Ceiling and lighting',.015)
        light('Warm gallery spotlight %d.%d'%(row,k),(xx,yy,3.01),100,warm,target=(xx+(.35 if k%2 else -.35),yy,0),typ='SPOT')
for i,(x,y) in enumerate([(-5,-.7),(-2,2.2),(0,-.4),(2.3,1),(5.3,-2)]):light('Soft ceiling bounce %d'%i,(x,y,3.08),150,(1,.88,.74),2.5,target=(x,y,0))
light('Daylight from open entrance',(-7.95,-1,2.2),700,(.78,.87,1),5,target=(-1,0,1.2))
def camera(name,loc,target,lens=24,ortho=None):
    d=bpy.data.cameras.new(name);o=bpy.data.objects.new(name,d);groups['04 Cameras'].objects.link(o);o.location=loc;o.rotation_euler=(Vector(target)-o.location).to_track_quat('-Z','Y').to_euler();d.lens=lens;d.clip_end=200
    if ortho:d.type='ORTHO';d.ortho_scale=ortho
    return o
cam=camera('01 Interior | entrance perspective',(-7.65,-2.7,1.65),(-.4,.6,1.4),21)
overview=camera('02 Layout | axonometric',(-12,-17,19),(0,0,.4),ortho=20)
plan=camera('03 Plan | reference alignment',(0,0,24),(0,0,0),ortho=18)
scene.camera=cam
scene.world.use_nodes=True;scene.world.node_tree.nodes['Background'].inputs[0].default_value=(.70,.77,.85,1);scene.world.node_tree.nodes['Background'].inputs[1].default_value=.25
try:scene.render.engine='CYCLES';scene.cycles.samples=96;scene.cycles.use_denoising=True
except:scene.render.engine='BLENDER_EEVEE'
scene.render.resolution_x=1800;scene.render.resolution_y=1200;scene.render.resolution_percentage=100
scene.render.image_settings.file_format='PNG';scene.render.film_transparent=False
scene.view_settings.view_transform='AgX';scene.view_settings.exposure=.6
scene['Reference']='Wall centerlines traced from user PNG. Scale 0.025m/pixel; wall height 3.2m; thickness 0.18m. Left and lower-left openings preserved.'
scene['Material assets']='8192 x 8192 grayscale PBR surface maps drive albedo variation, roughness and micro-bump.'
scene['Render note']='Octane unavailable; using '+scene.render.engine
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT,'Minimalist_Gallery.blend'))
result={'saved':bpy.data.filepath,'engine':scene.render.engine,'objects':len(scene.objects),'wall_segments':len(segments),'textures':[8192,8192]}

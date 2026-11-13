"""Create the team credits directly in the active gallery scene."""
import bpy, math
from mathutils import Vector

assert bpy.data.filepath.endswith('RVASA2_Glow.blend')
collection = bpy.data.collections.get('10_Team_Credits')
if not collection:
    collection = bpy.data.collections.new('10_Team_Credits')
    bpy.context.scene.collection.children.link(collection)

def material(name, color, strength):
    m=bpy.data.materials.get(name) or bpy.data.materials.new(name)
    m.use_nodes=True
    p=m.node_tree.nodes.get('Principled BSDF')
    p.inputs['Base Color'].default_value=(*color,1)
    p.inputs['Emission Color'].default_value=(*color,1)
    p.inputs['Emission Strength'].default_value=strength
    p.inputs['Roughness'].default_value=.8
    m.diffuse_color=(*color,1)
    return m

ivory=material('Team credits | ivory',(.85,.9,.9),2)
muted=material('Team credits | soft blue',(.42,.62,.7),1.5)
amber=material('Team credits | amber',(.95,.53,.22),1.8)

def text(name, body, x, z, size, mat):
    o=bpy.data.objects.get(name)
    if not o:
        d=bpy.data.curves.new(name,'FONT');o=bpy.data.objects.new(name,d);collection.objects.link(o)
    d=o.data;d.body=body;d.size=size*.62;d.extrude=.0002;d.resolution_u=8
    d.materials.clear();d.materials.append(mat)
    o.location=(.14,6.3024947+(x-.75)*.62,z-.25);o.rotation_euler=(math.pi/2,0,math.pi/2)
    o.lock_location=(True,)*3;o.lock_rotation=(True,)*3;o.lock_scale=(True,)*3
    return o

text('Team_Heading','BUILT BY',.75,3.25,.22,ivory)
text('Team_Subheading','THE PEOPLE BEHIND THIS GALLERY',.75,3.02,.065,muted)
members=[
    ('Aaron Clyde Guiruela','3D Model / Web Dev / Project Lead','ey2ron',.75,2.65),
    ('Jeoffrey Delos Reyes','Web Dev / Researcher','jofwee',3.45,2.65),
    ('Alexander Galedo','Web Dev / Presenter','AlexGaledo',.75,1.98),
    ('John Russel Gallanosa','Web Dev / Presenter','justrussss',3.45,1.98),
]
for i,(name,role,handle,x,z) in enumerate(members,1):
    text(f'Team_Name_{i:02}',name,x,z,.132,ivory)
    text(f'Team_Role_{i:02}',role,x,z-.19,.066,muted)
    link=text(f'Team_GitHub_{i:02}','github.com/'+handle,x,z-.34,.073,amber)
    link['github_url']='https://github.com/'+handle

light=bpy.data.objects.get('Team_Credits_Wallwash')
if light:
    bpy.data.objects.remove(light, do_unlink=True)
for a in bpy.context.screen.areas:
    if a.type=='VIEW_3D':
        sp=a.spaces.active;r=sp.region_3d
        r.view_location=(.14,7.5,2.4)
        r.view_rotation=Vector((-1,0,0)).to_track_quat('-Z','Y')
        r.view_distance=3.5;r.view_perspective='PERSP';sp.lens=35
        sp.shading.type='MATERIAL'
        a.tag_redraw()
bpy.context.view_layer.update()
bpy.ops.wm.save_as_mainfile(filepath=bpy.data.filepath, compress=True)
result={'file':bpy.data.filepath,'members':[m[0] for m in members],'objects':len(collection.objects)}

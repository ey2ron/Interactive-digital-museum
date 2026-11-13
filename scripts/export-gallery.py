"""Run in a background Blender copy. Never saves the source .blend."""
import bpy, json, math, os, sys, time
from pathlib import Path
from mathutils import Matrix

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / 'public' / 'assets'
OUT.mkdir(parents=True, exist_ok=True)
s = bpy.context.scene
cam = bpy.data.objects['Gallery_Camera']
basis = Matrix.Rotation(-math.pi / 2, 4, 'X')
fps = s.render.fps / s.render.fps_base
samples = []
for f in range(s.frame_start, s.frame_end + 1):
    s.frame_set(f)
    world = basis @ cam.evaluated_get(bpy.context.evaluated_depsgraph_get()).matrix_world
    p, q, scale = world.decompose()
    samples.append([round((f-s.frame_start)/fps, 7), *[round(v,7) for v in p], round(q.x,8), round(q.y,8), round(q.z,8), round(q.w,8)])
view = cam.data.view_frame(scene=s)
vertical_fov = math.degrees(2*math.atan(max(abs(v.y/v.z) for v in view)))
tour = {'fps':fps, 'firstFrame':s.frame_start, 'lastFrame':s.frame_end,
        'duration':samples[-1][0], 'verticalFov':vertical_fov,
        'referenceAspect':s.render.resolution_x/s.render.resolution_y,
        'clipNear':cam.data.clip_start, 'clipFar':cam.data.clip_end,
        'samples':samples, 'schedule':json.loads(s.get('cinematic_schedule','{}'))}
(OUT/'camera-tour.json').write_text(json.dumps(tour,separators=(',',':')),encoding='utf-8')
manifest = json.loads((ROOT/'gallery_output'/'RVASA2_Artwork_Manifest.json').read_text(encoding='utf-8'))
for art in manifest:
    obj=bpy.data.objects.get(art['slot'])
    if obj:
        art['position']=list(basis @ obj.matrix_world.translation)
        art['artist']='Waneella'
    # Do not rely on third-party image servers at runtime.
    art.pop('image',None)
(OUT/'artworks.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding='utf-8')
print('CAMERA_EXPORTED',len(samples),flush=True)

s.frame_set(1)
for ob in list(bpy.context.selected_objects): ob.select_set(False)
environment=[]; artworks=[]; glowing_labels=[]
for ob in list(s.objects):
    if ob.hide_render or any(c.name.startswith(('00_','04_','08_')) for c in ob.users_collection): continue
    if ob.name.startswith('W_CRT_'): continue
    if ob.type not in {'MESH','FONT','CURVE','SURFACE'}: continue
    ob.hide_set(False); ob.hide_viewport=False
    if ob.name.startswith('Artwork_') and ob.type=='MESH': artworks.append(ob); continue
    if ob.get('web_glow_role') in {'core', 'halo'}:
        glowing_labels.append(ob)
        continue
    if ob.type!='MESH':
        bpy.context.view_layer.objects.active=ob; ob.select_set(True)
        bpy.ops.object.convert(target='MESH'); ob=bpy.context.object; ob.select_set(False)
    environment.append(ob)
for ob in environment: ob.select_set(True)
bpy.context.view_layer.objects.active=environment[0]
bpy.ops.object.convert(target='MESH')
bpy.ops.object.join()
env=bpy.context.object; env.name='Gallery_Environment'
uv=env.data.uv_layers.new(name='Web_Bake_UV'); env.data.uv_layers.active=uv
bpy.ops.object.mode_set(mode='EDIT'); bpy.ops.mesh.select_all(action='SELECT')
bpy.ops.uv.smart_project(angle_limit=1.15192,island_margin=.006)
bpy.ops.object.mode_set(mode='OBJECT')
image=bpy.data.images.new('Gallery_Baked_Lighting',width=4096,height=4096,alpha=False)
for mat in env.data.materials:
    if not mat or not mat.use_nodes: continue
    for n in mat.node_tree.nodes: n.select=False
    tex=mat.node_tree.nodes.new('ShaderNodeTexImage');tex.image=image;tex.select=True;mat.node_tree.nodes.active=tex
s.render.engine='CYCLES';s.cycles.samples=16;s.cycles.use_denoising=True
s.render.bake.use_pass_direct=True;s.render.bake.use_pass_indirect=True
s.render.bake.use_pass_diffuse=True;s.render.bake.use_pass_glossy=False
s.render.bake.use_pass_transmission=False;s.render.bake.use_pass_emit=True
s.render.bake.margin=12
print('BAKE_START',len(env.data.polygons),flush=True)
bpy.ops.object.bake(type='COMBINED')
image.filepath_raw=str(OUT/'gallery-lighting.png');image.file_format='PNG';image.save()
def unlit(name,img):
    m=bpy.data.materials.new(name);m.use_nodes=True;n=m.node_tree.nodes;n.clear()
    out=n.new('ShaderNodeOutputMaterial');em=n.new('ShaderNodeEmission');tex=n.new('ShaderNodeTexImage');tex.image=img
    m.node_tree.links.new(tex.outputs['Color'],em.inputs['Color']);m.node_tree.links.new(em.outputs[0],out.inputs['Surface'])
    return m
env.data.materials.clear();env.data.materials.append(unlit('Gallery_Baked',image))
for poly in env.data.polygons:poly.material_index=0
# Export the bake UV as TEXCOORD_0, matching the baked material image.
for layer in list(env.data.uv_layers):
    if layer.name!='Web_Bake_UV':env.data.uv_layers.remove(layer)
for ob in artworks:
    for i,mat in enumerate(list(ob.data.materials)):
        img=next((n.image for n in mat.node_tree.nodes if n.type=='TEX_IMAGE' and n.image),None) if mat and mat.use_nodes else None
        if img:
            ob.data.materials[i]=unlit(mat.name+'_Web',img)
            thumb=img.copy();thumb.scale(max(1,int(img.size[0]*min(1,480/max(img.size)))),max(1,int(img.size[1]*min(1,480/max(img.size)))))
            item=next((x for x in manifest if x['slot']==ob.name),None)
            if item:
                thumb.filepath_raw=str(OUT/(item['id']+'.jpg'));thumb.file_format='JPEG';thumb.save()
                item['thumbnail']='assets/'+item['id']+'.jpg'
for ob in list(bpy.context.selected_objects):ob.select_set(False)
for ob in [env]+artworks+glowing_labels:ob.select_set(True)
bpy.context.view_layer.objects.active=env
bpy.ops.export_scene.gltf(filepath=str(OUT/'gallery.glb'),export_format='GLB',use_selection=True,export_animations=False,export_cameras=False,export_lights=False,export_yup=True)
# Lighter mobile variant with reduced textures; identical scene coordinates.
for img in bpy.data.images:
    if img.size[0]>0 and img.name not in {'Render Result','Viewer Node'}:
        ratio=min(1, (2048 if img==image else 1024)/max(img.size))
        if ratio<1:img.scale(max(1,round(img.size[0]*ratio)),max(1,round(img.size[1]*ratio)))
bpy.ops.export_scene.gltf(filepath=str(OUT/'gallery-mobile.glb'),export_format='GLB',use_selection=True,export_animations=False,export_cameras=False,export_lights=False,export_yup=True)
(OUT/'artworks.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding='utf-8')
(OUT/'export-report.json').write_text(json.dumps({'source':bpy.data.filepath,'frames':len(samples),'environmentFaces':len(env.data.polygons),'artworks':len(artworks),'bakedLighting':True,'sourceModified':False},indent=2),encoding='utf-8')
import runpy
runpy.run_path(str(ROOT/'scripts'/'optimize-mobile.py'))
print('EXPORT_COMPLETE',flush=True)

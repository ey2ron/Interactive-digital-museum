import bpy,os,json,hashlib,math
from mathutils import Vector
out=os.path.dirname(os.path.abspath(__file__))
oldpath=os.path.join(out,'Minimalist_Gallery.blend')
report=json.load(open(os.path.join(out,'Waneella_Validation.json')))
assert hashlib.sha256(open(oldpath,'rb').read()).hexdigest()==report['original_sha256']
with bpy.data.libraries.load(oldpath,link=False) as (src,dst):
    dst.objects=[n for n in src.objects if n.startswith(('Walls |','Continuous concrete','Empty display plinth'))]
compare=[]
for old in dst.objects:
    original_name=old.name.rsplit('.',1)[0] if old.name[-4:-3]=='.' else old.name
    current=bpy.context.scene.objects.get(original_name)
    assert current,original_name
    assert old.parent is None and current.parent is None
    assert all(abs(a-b)<1e-6 for attr in ('location','rotation_euler','scale') for a,b in zip(getattr(old,attr),getattr(current,attr))),original_name
    assert len(old.data.vertices)==len(current.data.vertices)
    assert all((a.co-b.co).length<1e-6 for a,b in zip(old.data.vertices,current.data.vertices))
    compare.append(original_name)
art=[]
for o in bpy.context.scene.objects:
    if not o.name.startswith('Artwork | '):continue
    tex=next(n for n in o.data.materials[0].node_tree.nodes if n.type=='TEX_IMAGE')
    im=tex.image
    xs=[v.co.x for v in o.data.vertices];zs=[v.co.z for v in o.data.vertices]
    ratio=(max(xs)-min(xs))/(max(zs)-min(zs));assert abs(ratio-im.size[0]/im.size[1])<1e-5
    assert tex.interpolation=='Closest' and im.packed_file
    assert min((o.matrix_world@v.co).z for v in o.data.vertices)>.5
    assert o.parent.get('artist')=='Waneella' and o.parent.get('source_url')
    assert [tuple(round(v,4) for v in uv.uv) for uv in o.data.uv_layers.active.data]==[(0,0),(1,0),(1,1),(0,1)]
    art.append(o.name)
assert len(art)==8
report.update({'reopened_blend_verified':True,'original_file_unchanged':True,'original_objects_compared':compare,'aspect_ratio_and_uv_verified':8,'credits_verified':8,'nearest_neighbor_textures_verified':8,'artwork_images_packed':8})
json.dump(report,open(os.path.join(out,'Waneella_Validation.json'),'w'),indent=2)
print('VALIDATION_PASSED',json.dumps({'original_objects':len(compare),'artworks':len(art),'packed':True}))

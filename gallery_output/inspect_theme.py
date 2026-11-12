import bpy,json
s=bpy.context.scene
result={'objects':[{'name':o.name,'parent':o.parent.name if o.parent else None,'loc':list(o.location),'rot':list(o.rotation_euler),'dim':list(o.dimensions),'scale':list(o.scale),'hide':o.hide_render,'mats':[m.name for m in o.data.materials] if o.type=='MESH' else []} for o in s.objects if o.name.startswith(('Painting','Canvas','Walls','Ceiling','Continuous','Empty','Warm','Soft','Daylight'))], 'materials':[m.name for m in bpy.data.materials], 'lights':[(o.name,o.data.type,o.data.energy,list(o.data.color)) for o in s.objects if o.type=='LIGHT']}
print('INSPECT',json.dumps(result))

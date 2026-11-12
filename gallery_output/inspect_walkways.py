import bpy
s=bpy.context.scene
result={'file':bpy.data.filepath,'collections':[(c.name,len(c.objects)) for c in bpy.data.collections],'objects':[{'name':o.name,'type':o.type,'parent':o.parent.name if o.parent else None,'location':list(o.location),'scale':list(o.scale),'dimensions':list(o.dimensions)} for o in s.objects if o.type=='CAMERA' or o.name.startswith(('Walls','Continuous','Ceiling','Empty display','Painting 0'))]}

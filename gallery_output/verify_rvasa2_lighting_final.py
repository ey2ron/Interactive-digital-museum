import bpy,json,os
s=bpy.context.scene
assert os.path.basename(bpy.data.filepath).lower()=='rvasa2.blend'
lamps=[o for o in s.objects if o.type=='LIGHT']
assert len(lamps)==16 and all(o.data.type=='SPOT' and o.parent and o.parent.name.startswith('Fixture_') for o in lamps)
assert not any(o.name.startswith(('Recessed_Light_','Light_Recess_')) for o in s.objects)
arts=[o for o in s.objects if o.name.startswith('Artwork_')]
assert len(arts)==16
for o in arts:
    for m in o.data.materials:
        assert m.node_tree.nodes.get('Principled BSDF').inputs['Emission Strength'].default_value==0
        tex=next(n for n in m.node_tree.nodes if n.type=='TEX_IMAGE')
        assert tex.image.packed_file
assert len([o for o in s.objects if o.name.startswith('Spot_') and '| ceiling canopy' in o.name])==16
bpy.ops.wm.save_as_mainfile(filepath=bpy.data.filepath)
result={'saved':bpy.data.filepath,'visible_fixtures':16,'spotlights':16,'painting_self_emission':0,'recessed_lights_remaining':0,'packed_artworks':16,'active_frame':s.frame_current,'camera':s.camera.name if s.camera else None}

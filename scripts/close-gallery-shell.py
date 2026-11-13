"""Close the two missing exterior runs of the L-shaped gallery footprint."""

import bpy

architecture = bpy.data.collections['01_Gallery_Architecture']
plaster = bpy.data.materials['Waneella | blue-gray mineral plaster']


def fixed_wall(name, minimum, maximum):
    existing = bpy.data.objects.get(name)
    if existing is not None:
        return existing
    x0, y0, z0 = minimum
    x1, y1, z1 = maximum
    mesh = bpy.data.meshes.new(name + ' mesh')
    mesh.from_pydata(
        [(x0, y0, z0), (x1, y0, z0), (x1, y1, z0), (x0, y1, z0),
         (x0, y0, z1), (x1, y0, z1), (x1, y1, z1), (x0, y1, z1)],
        [],
        [(0, 3, 2, 1), (4, 5, 6, 7), (0, 1, 5, 4),
         (1, 2, 6, 5), (2, 3, 7, 6), (3, 0, 4, 7)],
    )
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    architecture.objects.link(obj)
    mesh.materials.append(plaster)
    obj.lock_location = (True, True, True)
    obj.lock_rotation = (True, True, True)
    obj.lock_scale = (True, True, True)
    obj.hide_select = True
    return obj


west = fixed_wall('Gallery_Exterior_West_Closure', (-0.125, 5.625, 0.08), (0.125, 9.375, 4.5))
south = fixed_wall('Gallery_Exterior_South_Closure', (0.125, -0.125, 0.08), (7.375, 0.125, 4.5))
result = {'closed': [west.name, south.name], 'filepath': bpy.data.filepath}

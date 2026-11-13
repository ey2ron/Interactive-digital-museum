"""Export the readable Blender text glow independently of the lighting atlas."""

import bpy
from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
OUTPUT = ROOT / "public" / "assets" / "gallery-text-glow.glb"
labels = [obj for obj in bpy.context.scene.objects if obj.get("web_glow_role") in {"core", "halo"}]
if len(labels) != 51:
    raise RuntimeError(f"Expected 17 labels and 34 halos, found {len(labels)} objects")

for obj in bpy.context.selected_objects:
    obj.select_set(False)
for obj in labels:
    obj.select_set(True)
bpy.context.view_layer.objects.active = labels[0]
bpy.ops.export_scene.gltf(
    filepath=str(OUTPUT),
    export_format="GLB",
    use_selection=True,
    export_animations=False,
    export_cameras=False,
    export_lights=False,
    export_yup=True,
)
print(f"GLOW_EXPORTED {OUTPUT} objects={len(labels)}", flush=True)

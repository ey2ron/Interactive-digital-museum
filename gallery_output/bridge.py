import sys,json
from pathlib import Path
from blmcp.tools_helpers.connection import send_code
code=Path(sys.argv[1]).read_text(encoding='utf-8') if len(sys.argv)>1 else "import bpy; result={'objects':list(bpy.data.objects.keys()),'engines':[x.identifier for x in bpy.types.RenderSettings.bl_rna.properties['engine'].enum_items], 'version':bpy.app.version_string}"
print(json.dumps(send_code(code,strict_json=False)))

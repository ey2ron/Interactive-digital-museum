import runpy,sys,json
from pathlib import Path
root=Path(__file__).resolve().parent.parent
connection=runpy.run_path(str(root/'blender_mcp_official/mcp/blmcp/tools_helpers/connection.py'))
code=Path(sys.argv[1]).read_text(encoding='utf-8')
print(json.dumps(connection['send_code'](code,strict_json=False)))

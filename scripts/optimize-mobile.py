"""Repack embedded textures so the mobile GLB contains genuinely smaller images."""
import bpy,json,struct
from pathlib import Path
root=Path(__file__).resolve().parent.parent
source=root/'public/assets/gallery.glb';target=root/'public/assets/gallery-mobile.glb'
temp=root/'.local/mobile-textures';temp.mkdir(parents=True,exist_ok=True)
blob=source.read_bytes();size=struct.unpack_from('<I',blob,12)[0]
doc=json.loads(blob[20:20+size]);binary=blob[28+size:]
replacement={}
for i,item in enumerate(doc['images']):
    view=doc['bufferViews'][item['bufferView']];start=view.get('byteOffset',0)
    raw=temp/(str(i)+'.png');raw.write_bytes(binary[start:start+view['byteLength']])
    image=bpy.data.images.load(str(raw),check_existing=False)
    limit=2048 if 'lighting' in item.get('name','') else 1024
    ratio=min(1,limit/max(image.size))
    image.scale(max(1,round(image.size[0]*ratio)),max(1,round(image.size[1]*ratio)))
    output=temp/(str(i)+'.jpg');image.filepath_raw=str(output);image.file_format='JPEG';image.save()
    replacement[item['bufferView']]=output.read_bytes();item['mimeType']='image/jpeg'
    bpy.data.images.remove(image)
new=bytearray()
for i,view in enumerate(doc['bufferViews']):
    while len(new)%4:new.append(0)
    start=view.get('byteOffset',0);data=replacement.get(i,binary[start:start+view['byteLength']])
    view['byteOffset']=len(new);view['byteLength']=len(data);new.extend(data)
while len(new)%4:new.append(0)
doc['buffers'][0]['byteLength']=len(new)
j=json.dumps(doc,separators=(',',':')).encode()
while len(j)%4:j+=b' '
total=12+8+len(j)+8+len(new)
target.write_bytes(struct.pack('<III',0x46546c67,2,total)+struct.pack('<II',len(j),0x4e4f534a)+j+struct.pack('<II',len(new),0x004e4942)+new)
print('MOBILE_OPTIMIZED',source.stat().st_size,target.stat().st_size)

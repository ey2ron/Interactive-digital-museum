import fs from 'node:fs';

for (const path of ['public/assets/gallery.glb', 'public/assets/gallery-mobile.glb']) {
  const bytes = fs.readFileSync(path);
  const jsonLength = bytes.readUInt32LE(12);
  const gltf = JSON.parse(bytes.subarray(20, 20 + jsonLength));
  const binaryStart = 20 + jsonLength + 8;
  const environment = gltf.nodes.find(node => node.name === 'Gallery_Environment');
  const primitive = gltf.meshes[environment.mesh].primitives[0];
  const positionAccessor = gltf.accessors[primitive.attributes.POSITION];
  const indexAccessor = gltf.accessors[primitive.indices];
  const positionOffset = binaryStart + gltf.bufferViews[positionAccessor.bufferView].byteOffset + (positionAccessor.byteOffset || 0);
  const indexOffset = binaryStart + gltf.bufferViews[indexAccessor.bufferView].byteOffset + (indexAccessor.byteOffset || 0);
  const inMonitor = index => {
    const offset = positionOffset + index * 12;
    const x = bytes.readFloatLE(offset);
    const y = bytes.readFloatLE(offset + 4);
    const z = bytes.readFloatLE(offset + 8);
    return x >= 3.08 && x <= 3.73 && y >= 1.035 && y <= 1.67 && z >= -9.82 && z <= -9.25;
  };
  let removed = 0;
  for (let i = 0; i < indexAccessor.count; i += 3) {
    const offset = indexOffset + i * 4;
    const a = bytes.readUInt32LE(offset);
    const b = bytes.readUInt32LE(offset + 4);
    const c = bytes.readUInt32LE(offset + 8);
    if (inMonitor(a) && inMonitor(b) && inMonitor(c) && (a !== b || b !== c)) {
      bytes.writeUInt32LE(a, offset + 4);
      bytes.writeUInt32LE(a, offset + 8);
      removed++;
    }
  }
  if (removed < 20) throw new Error(`${path}: found only ${removed} monitor triangles`);
  fs.writeFileSync(path, bytes);
  console.log(`${path}: removed ${removed} monitor triangles`);
}

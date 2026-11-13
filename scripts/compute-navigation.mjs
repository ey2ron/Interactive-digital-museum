// Generate a floor collision map from the actual exported gallery geometry and additions.
import fs from 'node:fs';

const assets = new URL('../public/assets/', import.meta.url);
const cellSize = .12, minX = -.24, minZ = -15.24, width = 205, height = 130;
const occupied = new Uint8Array(width * height);

function mark(x, z) {
  const col = Math.floor((x - minX) / cellSize), row = Math.floor((z - minZ) / cellSize);
  if (col >= 0 && row >= 0 && col < width && row < height) occupied[row * width + col] = 1;
}

function processGLB(filename, nodeName) {
  const fileUrl = new URL(filename, assets);
  if (!fs.existsSync(fileUrl)) return;
  const bytes = fs.readFileSync(fileUrl);
  const jsonLength = bytes.readUInt32LE(12), gltf = JSON.parse(bytes.subarray(20, 20 + jsonLength));
  const binaryOffset = 20 + jsonLength + 8;
  const node = gltf.nodes.find(n => n.name === nodeName);
  if (!node || node.mesh === undefined) return;
  const primitives = gltf.meshes[node.mesh].primitives;

  for (const primitive of primitives) {
    const aPos = gltf.accessors[primitive.attributes.POSITION], vPos = gltf.bufferViews[aPos.bufferView];
    const offPos = binaryOffset + (vPos.byteOffset || 0) + (aPos.byteOffset || 0);
    const compPos = aPos.type === 'VEC3' ? 3 : 1, sizePos = aPos.componentType === 5123 ? 2 : 4;
    const stridePos = vPos.byteStride || compPos * sizePos;
    const getPos = (i, c = 0) => {
      const at = offPos + i * stridePos + c * sizePos;
      return aPos.componentType === 5126 ? bytes.readFloatLE(at) : aPos.componentType === 5123 ? bytes.readUInt16LE(at) : bytes.readUInt32LE(at);
    };

    const aInd = gltf.accessors[primitive.indices], vInd = gltf.bufferViews[aInd.bufferView];
    const offInd = binaryOffset + (vInd.byteOffset || 0) + (aInd.byteOffset || 0);
    const is16 = aInd.componentType === 5123;
    const getInd = i => is16 ? bytes.readUInt16LE(offInd + i * 2) : bytes.readUInt32LE(offInd + i * 4);

    const count = aInd.count;
    for (let i = 0; i < count; i += 3) {
      const triangle = [0, 1, 2].map(k => {
        const index = getInd(i + k);
        return [getPos(index, 0), getPos(index, 1), getPos(index, 2)];
      });
      for (const level of [.45, 1.05, 1.7]) {
        const hits = [];
        for (let k = 0; k < 3; k++) {
          const a = triangle[k], b = triangle[(k + 1) % 3];
          if ((a[1] < level && b[1] < level) || (a[1] > level && b[1] > level) || Math.abs(a[1] - b[1]) < 1e-8) continue;
          const t = (level - a[1]) / (b[1] - a[1]);
          if (t >= 0 && t <= 1) hits.push([a[0] + (b[0] - a[0]) * t, a[2] + (b[2] - a[2]) * t]);
        }
        if (hits.length < 2) continue;
        const [a, b] = hits, steps = Math.max(1, Math.ceil(Math.hypot(a[0] - b[0], a[1] - b[1]) / (cellSize * .25)));
        for (let step = 0; step <= steps; step++) mark(a[0] + (b[0] - a[0]) * step / steps, a[1] + (b[1] - a[1]) * step / steps);
      }
    }
  }
}

processGLB('gallery.glb', 'Gallery_Environment');
processGLB('gallery-additions.glb', 'Gallery_Additions_Baked');

const blocked = new Uint8Array(occupied.length);
for (let row = 0; row < height; row++) for (let col = 0; col < width; col++) {
  const x = minX + (col + .5) * cellSize, z = minZ + (row + .5) * cellSize;
  if (x < .22 || x > 23.78 || z < -14.78 || z > -.22) { blocked[row * width + col] = 1; continue; }
  for (let dz = -2; dz <= 2; dz++) for (let dx = -2; dx <= 2; dx++) {
    if (Math.hypot(dx, dz) > 2.1) continue;
    const nx = col + dx, nz = row + dz;
    if (nx >= 0 && nz >= 0 && nx < width && nz < height && occupied[nz * width + nx]) blocked[row * width + col] = 1;
  }
}

const data = { minX, minZ, width, height, cellSize, blocked: Array.from(blocked.keys()).filter(i => blocked[i]) };
fs.writeFileSync(new URL('navigation.json', assets), JSON.stringify(data));
console.log(`Navigation floor: ${width} × ${height} cells; ${data.blocked.length} blocked cells.`);

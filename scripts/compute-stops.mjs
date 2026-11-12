// Builds public/assets/stops.json: one centered viewing stop per painting, ordered along the camera path.
// Run after every Blender export:  node scripts/compute-stops.mjs
// Each stop = camera stands stopDistance(art) in front of the painting (along its surface normal) at eye height,
// looking at the painting's centre. `frame` is the index of the closest camera-path sample, so travel
// between stops can follow the authored route (which avoids walls).
import fs from 'node:fs';
import { Vector3, Quaternion, Matrix4 } from 'three';

// Distance scales with painting height so every work fills ~60% of the view and clears the header/footer.
const stopDistance = art => Math.max(2.4, 1.7 * art.size_m[1]);
const EYE_HEIGHT = 1.7;
const assets = new URL('../public/assets/', import.meta.url);
const tour = JSON.parse(fs.readFileSync(new URL('camera-tour.json', assets)));
const artworks = JSON.parse(fs.readFileSync(new URL('artworks.json', assets)));

// Read painting orientation from the exported GLB (node rotation; the artwork plane's normal is local +Y).
const glb = fs.readFileSync(new URL('gallery.glb', assets));
const gltf = JSON.parse(glb.subarray(20, 20 + glb.readUInt32LE(12)).toString());
const normals = new Map(gltf.nodes.filter(n => n.name?.startsWith('Artwork_'))
  .map(n => [n.name, new Vector3(0, 1, 0).applyQuaternion(new Quaternion(...(n.rotation ?? [0, 0, 0, 1])))]));

const rowPosition = row => new Vector3(row[1], row[2], row[3]);
const stops = artworks.map((art, order) => {
  const target = new Vector3(...art.position);
  const position = target.clone().addScaledVector(normals.get(art.slot), stopDistance(art));
  position.y = EYE_HEIGHT;
  let frame = 0, best = Infinity;
  tour.samples.forEach((row, i) => { const d = rowPosition(row).distanceTo(position); if (d < best) { best = d; frame = i; } });
  const quaternion = new Quaternion().setFromRotationMatrix(new Matrix4().lookAt(position, target, new Vector3(0, 1, 0)));
  return { id: art.id, order, frame, pathGap: +best.toFixed(3), position: position.toArray(), quaternion: quaternion.toArray() };
});
// Path order first; paintings sharing a path frame (facing walls) keep their gallery numbering.
stops.sort((a, b) => a.frame - b.frame || a.order - b.order);
// Finish with the PR's portrait 14, after visiting every other painting.
const finalIndex = stops.findIndex(stop => stop.id === 'second_chance');
if (finalIndex < 0) throw new Error('The final artwork, Second Chance, is missing from the export.');
stops.push(...stops.splice(finalIndex, 1));

const first = tour.samples[0];
const entrance = { id: null, order: -1, frame: 0, pathGap: 0, position: first.slice(1, 4), quaternion: first.slice(4, 8) };
fs.writeFileSync(new URL('stops.json', assets), JSON.stringify([entrance, ...stops.map(({ order, ...s }) => s)], null, 1));
console.table(stops.map(s => ({ id: s.id, frame: s.frame, pathGap_m: s.pathGap })));

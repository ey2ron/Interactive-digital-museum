import { Vector3, Quaternion } from 'three';

/** Shared walkable floor for checkpoint flights and first-person movement. */
export function createNavigation(data) {
  const { minX, minZ, width, height, cellSize } = data;
  const blocked = new Uint8Array(width * height);
  for (const index of data.blocked) blocked[index] = 1;
  const indexAt = (x, z) => {
    const col = Math.floor((x - minX) / cellSize), row = Math.floor((z - minZ) / cellSize);
    return col < 0 || row < 0 || col >= width || row >= height ? -1 : row * width + col;
  };
  const isWalkable = (x, z) => { const i = indexAt(x, z); return i >= 0 && !blocked[i]; };
  const pointAt = index => new Vector3(minX + (index % width + .5) * cellSize, 1.7,
    minZ + (Math.floor(index / width) + .5) * cellSize);
  const clear = (a, b) => {
    if (!isWalkable(a.x, a.z) || !isWalkable(b.x, b.z)) return false;
    let x = Math.floor((a.x - minX) / cellSize), z = Math.floor((a.z - minZ) / cellSize);
    const endX = Math.floor((b.x - minX) / cellSize), endZ = Math.floor((b.z - minZ) / cellSize);
    const dx = b.x - a.x, dz = b.z - a.z, sx = Math.sign(dx), sz = Math.sign(dz);
    const stepX = dx ? cellSize / Math.abs(dx) : Infinity, stepZ = dz ? cellSize / Math.abs(dz) : Infinity;
    let nextX = dx ? (minX + (x + (sx > 0 ? 1 : 0)) * cellSize - a.x) / dx : Infinity;
    let nextZ = dz ? (minZ + (z + (sz > 0 ? 1 : 0)) * cellSize - a.z) / dz : Infinity;
    // Visit every crossed cell, including both neighbors when crossing a corner.
    while (x !== endX || z !== endZ) {
      if (Math.abs(nextX - nextZ) < 1e-10) {
        if (blocked[z * width + x + sx] || blocked[(z + sz) * width + x]) return false;
        x += sx; z += sz; nextX += stepX; nextZ += stepZ;
      } else if (nextX < nextZ) { x += sx; nextX += stepX; }
      else { z += sz; nextZ += stepZ; }
      if (x < 0 || z < 0 || x >= width || z >= height || blocked[z * width + x]) return false;
    }
    return true;
  };
  function findPath(start, end) {
    if (!isWalkable(start.x, start.z) || !isWalkable(end.x, end.z)) return null;
    if (clear(start, end)) return [start.clone(), end.clone()];
    const first = indexAt(start.x, start.z), last = indexAt(end.x, end.z);
    const count = blocked.length, scores = new Float64Array(count).fill(Infinity);
    const parents = new Int32Array(count).fill(-1), closed = new Uint8Array(count);
    const heap = [];
    const heuristic = i => Math.hypot(i % width - last % width, Math.floor(i / width) - Math.floor(last / width));
    function push(index, score) {
      const value = { index, score }; let i = heap.length; heap.push(value);
      while (i > 0) { const parent = (i - 1) >> 1; if (heap[parent].score <= score) break; heap[i] = heap[parent]; i = parent; }
      heap[i] = value;
    }
    function pop() {
      const head = heap[0], tail = heap.pop();
      if (heap.length) {
        let i = 0;
        while (i * 2 + 1 < heap.length) {
          let child = i * 2 + 1;
          if (child + 1 < heap.length && heap[child + 1].score < heap[child].score) child++;
          if (heap[child].score >= tail.score) break;
          heap[i] = heap[child]; i = child;
        }
        heap[i] = tail;
      }
      return head.index;
    }
    scores[first] = 0; push(first, heuristic(first));
    while (heap.length) {
      const current = pop();
      if (closed[current]) continue;
      if (current === last) {
        const path = [end.clone()];
        for (let node = last; node !== first; node = parents[node]) path.push(pointAt(node));
        path.push(start.clone()); path.reverse();
        // Remove all unnecessary corners, keeping only turns required by walls.
        const simple = [path[0]];
        for (let i = 0; i < path.length - 1;) {
          let next = path.length - 1;
          while (next > i + 1 && !clear(path[i], path[next])) next--;
          simple.push(path[next]); i = next;
        }
        const rounded = roundCorners(simple, clear);
        return rounded.every((point, i) => i === 0 || clear(rounded[i - 1], point)) ? rounded : simple;
      }
      closed[current] = 1;
      const x = current % width, z = Math.floor(current / width);
      for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
        if ((!dx && !dz) || x + dx < 0 || x + dx >= width || z + dz < 0 || z + dz >= height) continue;
        const next = current + dz * width + dx;
        if (blocked[next] || closed[next]) continue;
        if (dx && dz && (blocked[current + dx] || blocked[current + dz * width])) continue;
        const score = scores[current] + Math.hypot(dx, dz);
        if (score >= scores[next]) continue;
        parents[next] = current; scores[next] = score; push(next, score + heuristic(next));
      }
    }
    return null;
  }
  function move(position, delta) {
    const next = position.clone();
    const steps = Math.max(1, Math.ceil(Math.hypot(delta.x, delta.z) / (cellSize * .4)));
    for (let i = 0; i < steps; i++) {
      const x = next.x + delta.x / steps, z = next.z + delta.z / steps;
      if (isWalkable(x, z)) { next.x = x; next.z = z; }
      else if (isWalkable(x, next.z)) next.x = x;
      else if (isWalkable(next.x, z)) next.z = z;
    }
    return next;
  }
  return { isWalkable, clear, findPath, move };
}

function roundCorners(points, clear) {
  const result = [points[0]];
  for (let i = 1; i < points.length - 1; i++) {
    const a = points[i - 1], b = points[i], c = points[i + 1];
    const radius = Math.min(.55, a.distanceTo(b) * .25, b.distanceTo(c) * .25);
    const entry = b.clone().lerp(a, radius / a.distanceTo(b));
    const exit = b.clone().lerp(c, radius / b.distanceTo(c));
    const curve = [entry];
    for (let step = 1; step <= 8; step++) {
      const t = step / 8;
      curve.push(entry.clone().multiplyScalar((1 - t) ** 2).addScaledVector(b, 2 * (1 - t) * t).addScaledVector(exit, t * t));
    }
    const previous = result.at(-1);
    if (clear(previous, entry) && clear(exit, c) && curve.every((point, k) => k === 0 || clear(curve[k - 1], point))) result.push(...curve);
    else result.push(b);
  }
  result.push(points.at(-1));
  return result;
}

export const smoothTravel = t => { t = Math.max(0, Math.min(1, t)); return t * t * t * (t * (t * 6 - 15) + 10); };

/** A flight has a position route and only one shortest turn, to the selected portrait. */
export function createPortraitFlight(points, startQuaternion, endQuaternion) {
  const path = points.map(point => point.clone());
  const distance = [0];
  for (let i = 1; i < path.length; i++) distance.push(distance[i - 1] + path[i].distanceTo(path[i - 1]));
  const total = distance.at(-1);
  const start = startQuaternion.clone().normalize(), end = endQuaternion.clone().normalize();
  const angle = start.angleTo(end);
  return {
    length: total, angle,
    duration: Math.max(1500, Math.min(4600, 1250 + total * 150 + angle * 180)),
    sample(elapsed, position = new Vector3(), quaternion = new Quaternion()) {
      const progress = smoothTravel(elapsed), target = total * progress;
      let index = 1;
      while (index < path.length - 1 && distance[index] < target) index++;
      const alpha = (target - distance[index - 1]) / (distance[index] - distance[index - 1] || 1);
      position.copy(path[index - 1]).lerp(path[index], alpha);
      quaternion.copy(start).slerp(end, progress);
      return { position, quaternion };
    }
  };
}

export function nearestViewingStop(stops, position) {
  let nearest = 1, distance = Infinity;
  // Escape returns to a portrait rather than the entrance overview.
  for (let index = 1; index < stops.length; index++) {
    const target = stops[index].position;
    const candidate = Math.hypot(target[0] - position.x, target[2] - position.z);
    if (candidate < distance) { nearest = index; distance = candidate; }
  }
  return nearest;
}

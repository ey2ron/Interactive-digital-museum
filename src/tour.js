import { Quaternion, Vector3 } from 'three';

export function clamp01(value) { return Math.max(0, Math.min(1, value)); }

/** Pure, reversible time lookup: no playback clock or accumulated camera motion. */
export function sampleTour(tour, progress, position = new Vector3(), quaternion = new Quaternion()) {
  const time = clamp01(progress) * tour.duration;
  const rows = tour.samples;
  let low = 0, high = rows.length - 1;
  while (low + 1 < high) {
    const mid = (low + high) >> 1;
    if (rows[mid][0] <= time) low = mid; else high = mid;
  }
  const a = rows[low], b = rows[high];
  const alpha = clamp01((time - a[0]) / (b[0] - a[0] || 1));
  position.set(a[1], a[2], a[3]).lerp(new Vector3(b[1], b[2], b[3]), alpha);
  quaternion.set(a[4], a[5], a[6], a[7]).normalize().slerp(new Quaternion(b[4], b[5], b[6], b[7]).normalize(), alpha);
  return { position, quaternion, time };
}

export function scrollProgress(scrollY, sectionTop, scrollDistance) {
  return clamp01((scrollY - sectionTop) / Math.max(1, scrollDistance));
}

/* ---- Stop-to-stop navigation: one step = one painting ---- */

const smooth = x => { x = clamp01(x); return x * x * (3 - 2 * x); };
const IDENTITY = new Quaternion();

/** Cumulative path length (metres + weighted radians) so travel between stops runs at an even pace, with no stalls. */
export function buildArc(tour) {
  const rows = tour.samples, cum = new Float64Array(rows.length);
  const qa = new Quaternion(), qb = new Quaternion();
  for (let i = 1; i < rows.length; i++) {
    const a = rows[i - 1], b = rows[i];
    qa.set(a[4], a[5], a[6], a[7]); qb.set(b[4], b[5], b[6], b[7]);
    cum[i] = cum[i - 1] + Math.hypot(b[1] - a[1], b[2] - a[2], b[3] - a[3]) + 1.2 * qa.angleTo(qb);
  }
  return cum;
}

/** Travel effort of one segment, used to pick its duration. */
export function segmentLength(arc, stops, k) {
  const a = stops[k], b = stops[k + 1];
  const path = Math.abs(arc[b.frame] - arc[a.frame]);
  if (path > 0) return path;
  return 1.2 * new Quaternion(...a.quaternion).angleTo(new Quaternion(...b.quaternion));
}

/** Camera pose at continuous stop-space coordinate s (0 = entrance, N-1 = last painting). Integer s is exactly the stop pose. */
export function sampleStops(tour, arc, stops, s, position = new Vector3(), quaternion = new Quaternion()) {
  s = Math.max(0, Math.min(stops.length - 1, s));
  const k = Math.min(stops.length - 2, Math.floor(s)), u = s - k;
  const A = stops[k], B = stops[k + 1];
  if (A.frame === B.frame) { // facing walls on the same spot: turn in place
    position.fromArray(A.position).lerp(new Vector3(...B.position), smooth(u));
    quaternion.fromArray(A.quaternion).slerp(new Quaternion(...B.quaternion), smooth(u));
    return { position, quaternion };
  }
  // Follow the authored route between the two path frames at even speed.
  const target = arc[A.frame] + u * (arc[B.frame] - arc[A.frame]);
  let low = Math.min(A.frame, B.frame), high = Math.max(A.frame, B.frame);
  while (low + 1 < high) { const mid = (low + high) >> 1; if (arc[mid] <= target) low = mid; else high = mid; }
  const r0 = tour.samples[low], r1 = tour.samples[high];
  const t = clamp01((target - arc[low]) / (arc[high] - arc[low] || 1));
  position.set(r0[1], r0[2], r0[3]).lerp(new Vector3(r1[1], r1[2], r1[3]), t);
  quaternion.set(r0[4], r0[5], r0[6], r0[7]).normalize().slerp(new Quaternion(r1[4], r1[5], r1[6], r1[7]).normalize(), t);
  // Fade in each stop's small correction (route -> exactly centred on the painting) near its end of the segment.
  const wa = 1 - smooth(u / .4), wb = smooth((u - .6) / .4);
  for (const [stop, w] of [[A, wa], [B, wb]]) {
    if (w <= 0) continue;
    const pathRow = tour.samples[stop.frame];
    const dq = new Quaternion(...stop.quaternion).multiply(new Quaternion(pathRow[4], pathRow[5], pathRow[6], pathRow[7]).normalize().invert());
    position.add(new Vector3(...stop.position).sub(new Vector3(pathRow[1], pathRow[2], pathRow[3])).multiplyScalar(w));
    quaternion.premultiply(IDENTITY.clone().slerp(dq, w));
  }
  return { position, quaternion };
}

export const easeInOut = x => x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;


/** Nearest viewing stop or bar checkpoint in normalized tour space. */
export function nearestStop(stops, progress) {
  return stops.reduce((best, stop, index) =>
    Math.abs(stop - progress) < Math.abs(stops[best] - progress) ? index : best, 0);
}

/** Keep bar checkpoints evenly spaced and aligned to the fill. */
export function checkpointProgress(stops, progress) {
  for (let index = 1; index < stops.length; index++) {
    if (progress <= stops[index]) {
      return (index - 1 + clamp01((progress - stops[index - 1]) /
        (stops[index] - stops[index - 1]))) / (stops.length - 1);
    }
  }
  return 1;
}

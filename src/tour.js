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

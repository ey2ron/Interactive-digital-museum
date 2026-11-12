import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { sampleTour, scrollProgress, buildArc, sampleStops, segmentLength, easeInOut, nearestStop, checkpointProgress } from '../src/tour.js';
import { Vector3 } from 'three';

const tour = JSON.parse(fs.readFileSync(new URL('../public/assets/camera-tour.json', import.meta.url)));
test('export includes the full authored tour with finite, normalized camera samples', () => {
  assert.equal(tour.samples.length, tour.lastFrame-tour.firstFrame+1);
  assert.ok(tour.duration>40 && tour.duration<45);
  for (const row of tour.samples) {
    assert.equal(row.length,8);
    assert.ok(row.every(Number.isFinite));
    assert.ok(Math.abs(Math.hypot(...row.slice(4))-1)<.00001);
    assert.ok(Math.abs(row[2]-1.7)<.00001, 'eye height stays constant after axis conversion');
  }
});
test('scrubbing to either end clamps precisely, and seeking backwards is deterministic', () => {
  for (const [p,index] of [[-1,0],[0,0],[1,tour.samples.length-1],[2,tour.samples.length-1]]) {
    assert.deepEqual(sampleTour(tour,p).position.toArray(),tour.samples[index].slice(1,4));
  }
  const expected=sampleTour(tour,.24).quaternion.toArray();
  sampleTour(tour,.95);sampleTour(tour,.02);
  assert.deepEqual(sampleTour(tour,.24).quaternion.toArray(),expected);
});
test('authored camera pauses stay still at fractional times', () => {
  for (const [a,b] of tour.schedule.holds) {
    const start=sampleTour(tour,(a-tour.firstFrame)/tour.fps/tour.duration);
    const middle=sampleTour(tour,((a+b)/2-tour.firstFrame)/tour.fps/tour.duration);
    assert.ok(start.position.distanceTo(middle.position)<.00001);
    assert.ok(start.quaternion.angleTo(middle.quaternion)<.00001);
  }
});
test('the final approach holds a fixed gaze on the last painting', () => {
  const artworks=JSON.parse(fs.readFileSync(new URL('../public/assets/artworks.json',import.meta.url)));
  const last=artworks.find(a=>a.slot==='Artwork_11_DeadEnd');
  for(const progress of [.88,.92,.96,1]){
    const sample=sampleTour(tour,progress);
    const aim=new Vector3(...last.position).sub(sample.position).normalize();
    const forward=new Vector3(0,0,-1).applyQuaternion(sample.quaternion);
    assert.ok(forward.angleTo(aim)<.002,'camera gaze stays on the artwork as viewing distance changes');
  }
});
test('scroll mapping handles endpoints, resizing, and negative overscroll', () => {
  assert.equal(scrollProgress(-40,0,1000),0);
  assert.equal(scrollProgress(500,0,1000),.5);
  assert.equal(scrollProgress(2000,0,1000),1);
  assert.equal(scrollProgress(0,0,0),0);
});


const stops = JSON.parse(fs.readFileSync(new URL('../public/assets/stops.json', import.meta.url)));
const artworks = JSON.parse(fs.readFileSync(new URL('../public/assets/artworks.json', import.meta.url)));
const arc = buildArc(tour);

test('the PR tour visits every artwork once and ends with its original portrait 14, Second Chance', () => {
  assert.equal(stops.length, artworks.length + 1);
  assert.equal(stops[0].id, null);
  assert.deepEqual(stops.slice(1).map(stop => stop.id).sort(), artworks.map(art => art.id).sort());
  assert.equal(stops.at(-1).id, 'second_chance');
  assert.equal(stops.at(-2).id, 'still_night');
  assert.equal(stops.at(-3).id, 'shimmer');
  assert.ok(stops.every(stop => stop.frame >= 0 && stop.frame < tour.samples.length));
});

test('every portrait has the PR centered framing and a comfortable viewing distance', () => {
  stops.slice(1).forEach((stop, index) => {
    const art = artworks.find(art => art.id === stop.id);
    const { position, quaternion } = sampleStops(tour, arc, stops, index + 1);
    const aim = new Vector3(...art.position).sub(position);
    assert.ok(Math.abs(aim.length() - Math.max(2.4, 1.7 * art.size_m[1])) < .05, `${art.title}: viewing distance`);
    assert.ok(new Vector3(0, 0, -1).applyQuaternion(quaternion).angleTo(aim) < .001, `${art.title}: centered gaze`);
    assert.ok(position.distanceTo(new Vector3(...stop.position)) < .00001);
  });
});

test('the complete reordered tour is continuous forwards and backwards', () => {
  for (const direction of [1, -1]) {
    let previous = sampleStops(tour, arc, stops, direction > 0 ? 0 : stops.length - 1);
    for (let step = 1; step <= 8000; step++) {
      const fraction = step / 8000;
      const coordinate = (direction > 0 ? fraction : 1 - fraction) * (stops.length - 1);
      const next = sampleStops(tour, arc, stops, coordinate);
      assert.ok(next.position.distanceTo(previous.position) < .12, `no position jump at ${coordinate}`);
      assert.ok(next.quaternion.angleTo(previous.quaternion) < .08, `no gaze jump at ${coordinate}`);
      assert.ok(Number.isFinite(next.position.length()));
      previous = next;
    }
  }
});

test('the final return follows the authored path backwards to Second Chance', () => {
  const index = stops.length - 2;
  assert.ok(stops[index].frame > stops[index + 1].frame, 'final leg revisits an earlier path frame');
  assert.ok(segmentLength(arc, stops, index) > 0, 'reverse travel has a positive duration weight');
  const expected = sampleStops(tour, arc, stops, index + .4);
  sampleStops(tour, arc, stops, 1);
  const repeated = sampleStops(tour, arc, stops, index + .4);
  assert.deepEqual(repeated.position.toArray(), expected.position.toArray());
  assert.deepEqual(repeated.quaternion.toArray(), expected.quaternion.toArray());
  assert.ok(sampleStops(tour, arc, stops, stops.length - 1).position.distanceTo(new Vector3(...stops.at(-1).position)) < .00001);
});

test('facing-wall turns sharing a path frame retain smooth motion', () => {
  for (let index = 0; index < stops.length - 1; index++) {
    if (stops[index].frame !== stops[index + 1].frame) continue;
    const start = sampleStops(tour, arc, stops, index);
    const middle = sampleStops(tour, arc, stops, index + .5);
    const end = sampleStops(tour, arc, stops, index + 1);
    assert.ok(start.quaternion.angleTo(end.quaternion) > 1, 'paintings face different directions');
    assert.ok(middle.position.distanceTo(start.position) < start.position.distanceTo(end.position));
    assert.ok(middle.quaternion.angleTo(start.quaternion) < end.quaternion.angleTo(start.quaternion));
    assert.ok(segmentLength(arc, stops, index) > 0);
  }
});

test('all seventeen checkpoint markers align with entrance and portrait progress', () => {
  const checkpoints = stops.map((_, index) => index / (stops.length - 1));
  assert.equal(checkpoints.length, 17);
  checkpoints.forEach((progress, index) => {
    assert.equal(nearestStop(checkpoints, progress), index);
    assert.ok(Math.abs(checkpointProgress(checkpoints, progress) - index / (checkpoints.length - 1)) < .000001);
    if (index) assert.ok(progress > checkpoints[index - 1]);
  });
  assert.equal(checkpointProgress(checkpoints, -1), 0);
  assert.equal(checkpointProgress(checkpoints, 2), 1);
  assert.equal(easeInOut(0), 0);
  assert.equal(easeInOut(.5), .5);
  assert.equal(easeInOut(1), 1);
});

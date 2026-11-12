import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { sampleTour, scrollProgress } from '../src/tour.js';
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

import { buildArc, sampleStops, segmentLength } from '../src/tour.js';
const stops = JSON.parse(fs.readFileSync(new URL('../public/assets/stops.json', import.meta.url)));
const arc = buildArc(tour);
const art = JSON.parse(fs.readFileSync(new URL('../public/assets/artworks.json', import.meta.url)));
test('one stop per painting plus the entrance', () => {
  assert.equal(stops.length, art.length + 1);
  assert.deepEqual(stops.slice(1).map(s => s.id).sort(), art.map(a => a.id).sort());
});
test('every stop is centred on its painting at a comfortable distance', () => {
  for (const stop of stops.slice(1)) {
    const meta = art.find(a => a.id === stop.id), painting = new Vector3(...meta.position);
    const { position, quaternion } = sampleStops(tour, arc, stops, stops.indexOf(stop));
    const aim = painting.clone().sub(position);
    assert.ok(Math.abs(aim.length() - Math.max(2.4, 1.7 * meta.size_m[1])) < .05, `${stop.id} distance`);
    assert.ok(new Vector3(0, 0, -1).applyQuaternion(quaternion).angleTo(aim) < .001, `${stop.id} centred`);
  }
});
test('travel between stops is continuous (no teleports) in both directions', () => {
  let last = sampleStops(tour, arc, stops, 0).position.clone(), farthest = 0;
  for (let s = 0; s <= stops.length - 1; s += .002) {
    const p = sampleStops(tour, arc, stops, s).position;
    farthest = Math.max(farthest, p.distanceTo(last)); last = p.clone();
  }
  assert.ok(farthest < .12, `largest jump per .002 step was ${farthest}`);
  assert.ok(segmentLength(arc, stops, 0) > 0);
});

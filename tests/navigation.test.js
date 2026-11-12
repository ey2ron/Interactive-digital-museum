import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { Vector3, Quaternion } from 'three';
import { createNavigation, createPortraitFlight, smoothTravel, nearestViewingStop } from '../src/navigation.js';

const assets = new URL('../public/assets/', import.meta.url);
const navigation = createNavigation(JSON.parse(fs.readFileSync(new URL('navigation.json', assets))));
const stops = JSON.parse(fs.readFileSync(new URL('stops.json', assets)));

test('every pair of portrait checkpoints has a wall-safe route', () => {
  for (const start of stops) for (const end of stops) {
    const path = navigation.findPath(new Vector3(...start.position), new Vector3(...end.position));
    assert.ok(path, `${start.id} to ${end.id}`);
    assert.ok(path[0].distanceTo(new Vector3(...start.position)) < .00001);
    assert.ok(path.at(-1).distanceTo(new Vector3(...end.position)) < .00001);
    for (let index = 1; index < path.length; index++) assert.ok(navigation.clear(path[index - 1], path[index]));
  }
});

test('long jumps make one shortest turn instead of facing intermediate portraits', () => {
  for (const [from, to] of [[0, 16], [16, 0], [2, 14], [14, 3]]) {
    const a = stops[from], b = stops[to];
    const path = navigation.findPath(new Vector3(...a.position), new Vector3(...b.position));
    const qa = new Quaternion(...a.quaternion).normalize(), qb = new Quaternion(...b.quaternion).normalize();
    const flight = createPortraitFlight(path, qa, qb);
    let previous = qa, totalRotation = 0;
    for (let index = 1; index <= 1000; index++) {
      const sample = flight.sample(index / 1000);
      assert.ok(navigation.isWalkable(sample.position.x, sample.position.z));
      totalRotation += previous.angleTo(sample.quaternion); previous = sample.quaternion;
    }
    assert.ok(totalRotation <= qa.angleTo(qb) + .0001, 'no extra rotations on the way');
    assert.ok(flight.sample(1).position.distanceTo(new Vector3(...b.position)) < .00001);
    assert.ok(flight.sample(1).quaternion.angleTo(qb) < .000001);
  }
});

test('adjacent scroll flights keep exact framing and smooth starts and stops', () => {
  assert.equal(smoothTravel(0), 0); assert.equal(smoothTravel(1), 1);
  assert.ok(smoothTravel(.001) < .0000001);
  assert.ok(1 - smoothTravel(.999) < .0000001);
  for (let index = 0; index < stops.length - 1; index++) {
    const a = stops[index], b = stops[index + 1];
    const path = navigation.findPath(new Vector3(...a.position), new Vector3(...b.position));
    const flight = createPortraitFlight(path, new Quaternion(...a.quaternion), new Quaternion(...b.quaternion));
    const initial = flight.sample(0), final = flight.sample(1);
    assert.ok(initial.position.distanceTo(new Vector3(...a.position)) < .00001);
    assert.ok(final.position.distanceTo(new Vector3(...b.position)) < .00001);
    assert.ok(flight.duration >= 1500 && flight.duration <= 4600);
    const interrupted = flight.sample(.37);
    const nextPath = navigation.findPath(interrupted.position, new Vector3(...stops.at(-1).position));
    const retarget = createPortraitFlight(nextPath, interrupted.quaternion, new Quaternion(...stops.at(-1).quaternion));
    assert.ok(retarget.sample(0).position.distanceTo(interrupted.position) < .00001, 'retargeting does not jump');
    assert.ok(retarget.sample(0).quaternion.angleTo(interrupted.quaternion) < .000001);
  }
});

test('floor movement remains inside the gallery and finds the nearest fixed portrait', () => {
  for (const stop of stops.slice(1)) {
    const start = new Vector3(...stop.position);
    const moved = navigation.move(start, new Vector3(50, 0, -50));
    assert.ok(navigation.isWalkable(moved.x, moved.z), 'large movement cannot tunnel through walls');
    assert.equal(nearestViewingStop(stops, start), stops.indexOf(stop));
  }
});

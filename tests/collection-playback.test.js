import test from 'node:test';
import assert from 'node:assert/strict';
import { createCollectionPlayback } from '../src/collection-playback.js';

function fixture(reducedMotion = false) {
  const observers = [];
  class Observer {
    constructor(callback) { this.callback = callback; observers.push(this); }
    observe(target) { this.target = target; }
    emit(visible) { this.callback([{ target: this.target, isIntersecting: visible, intersectionRatio: visible ? 1 : 0 }]); }
  }
  const doc = new EventTarget(); doc.hidden = false;
  const toggle = new EventTarget(); toggle.attributes = {};
  toggle.setAttribute = (key, value) => toggle.attributes[key] = value;
  const status = {};
  const video = new EventTarget();
  Object.assign(video, { hidden: true, playCalls: 0, pauseCalls: 0, loadCalls: 0,
    load() { this.loadCalls++; }, pause() { this.pauseCalls++; },
    play() { this.playCalls++; return this.promise ?? Promise.resolve(); } });
  const playback = createCollectionPlayback({ root: {}, toggle, status, reducedMotion, doc, Observer });
  playback.add(video, '/preview.mp4', {});
  return { playback, video, doc, toggle, status, nearby: observers[0], visible: observers[1] };
}
const settle = () => new Promise(resolve => setImmediate(resolve));

test('closed and offscreen previews do not play; visible previews pause on tab hide and collection close', async () => {
  const f = fixture();
  f.nearby.emit(true); f.visible.emit(true);
  assert.equal(f.video.loadCalls, 0);
  f.playback.setActive(true); await settle();
  assert.equal(f.video.playCalls, 1); assert.equal(f.video.hidden, false);
  f.visible.emit(false);
  const pauses = f.video.pauseCalls;
  f.visible.emit(true); await settle();
  assert.equal(f.video.playCalls, 2);
  f.doc.hidden = true; f.doc.dispatchEvent(new Event('visibilitychange'));
  assert.ok(f.video.pauseCalls > pauses);
  f.doc.hidden = false; f.doc.dispatchEvent(new Event('visibilitychange')); await settle();
  assert.equal(f.video.playCalls, 3);
  f.playback.setActive(false);
  f.visible.emit(false); f.visible.emit(true);
  assert.equal(f.video.playCalls, 3);
});

test('reduced motion waits for explicit play and manual pause survives reopening', async () => {
  const f = fixture(true);
  f.nearby.emit(true); f.visible.emit(true); f.playback.setActive(true);
  assert.equal(f.video.loadCalls, 0); assert.equal(f.video.hidden, true);
  f.toggle.dispatchEvent(new Event('click')); await settle();
  assert.equal(f.video.playCalls, 1); assert.equal(f.video.hidden, false);
  f.toggle.dispatchEvent(new Event('click'));
  assert.equal(f.toggle.attributes['aria-pressed'], 'true');
  f.playback.setActive(false); f.playback.setActive(true);
  assert.equal(f.video.playCalls, 1);
});

test('blocked autoplay keeps the poster and allows a user retry; media failure preserves the poster', async () => {
  const f = fixture(); f.video.promise = Promise.reject(new Error('NotAllowedError'));
  f.nearby.emit(true); f.visible.emit(true); f.playback.setActive(true); await settle();
  assert.equal(f.video.hidden, true); assert.equal(f.toggle.textContent, 'Play animations');
  f.video.promise = Promise.resolve(); f.toggle.dispatchEvent(new Event('click')); await settle();
  assert.equal(f.video.hidden, false);
  f.video.dispatchEvent(new Event('error'));
  assert.equal(f.video.hidden, true);
  f.playback.setActive(false); f.playback.setActive(true);
  assert.equal(f.video.playCalls, 2);
});

test('a late play promise cannot reveal or restart a closed preview', async () => {
  const f = fixture(); let finish;
  f.video.promise = new Promise(resolve => finish = resolve);
  f.nearby.emit(true); f.visible.emit(true); f.playback.setActive(true);
  f.playback.setActive(false); const pauses = f.video.pauseCalls;
  finish(); await settle();
  assert.equal(f.video.hidden, true); assert.ok(f.video.pauseCalls > pauses);
});

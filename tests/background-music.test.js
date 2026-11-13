import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createBackgroundMusic } from '../src/background-music.js';

function setup({ saved, blocked = false, rejectFetch = false, deferred = false, storageThrows = false } = {}) {
  const doc = new EventTarget(); doc.hidden = false;
  const buttons = [new EventTarget(), new EventTarget()];
  for (const b of buttons) { b.dataset = {}; b.attributes = {}; b.setAttribute = (key,value) => b.attributes[key] = value; }
  const statuses = [{}, {}], contexts = [], values = {};
  let resolveFetch, requests = 0;
  class Context extends EventTarget {
    constructor() { super(); this.state = 'suspended'; this.currentTime = 0; this.nodes = []; contexts.push(this); }
    createGain() { this.output = { connect() {}, gain: { value: 0, ramps: [], cancelScheduledValues() {}, setValueAtTime() {}, linearRampToValueAtTime(value,time) { this.ramps.push([value,time]); } } }; return this.output; }
    resume() { this.resumes = (this.resumes || 0) + 1; if (blocked) return new Promise(resolve => this.unblock = () => { this.state='running'; this.dispatchEvent(new Event('statechange')); resolve(); }); this.state='running'; this.dispatchEvent(new Event('statechange')); return Promise.resolve(); }
    decodeAudioData() { return Promise.resolve({ duration: 120 }); }
    createBufferSource() { const node = { connect() {}, start(time,offset) { this.offset=offset; }, stop() { this.stopped=true; } }; this.nodes.push(node); return node; }
  }
  const response = { ok: true, arrayBuffer: () => Promise.resolve(new ArrayBuffer(1)) };
  const fetchAudio = () => { requests++; return rejectFetch ? Promise.reject(new Error('Missing music')) : deferred ? new Promise(resolve => resolveFetch = () => resolve(response)) : Promise.resolve(response); };
  const storage = { getItem() { if (storageThrows) throw new Error('Storage unavailable'); return saved; }, setItem(k,v) { if (storageThrows) throw new Error('Storage unavailable'); values[k]=v; } };
  const music = createBackgroundMusic({ buttons, statuses, url:'/music.mp3', doc, storage, Context, fetchAudio });
  return { music, buttons, statuses, doc, contexts, values, requests: () => requests, finishFetch: () => resolveFetch(), tap: () => doc.dispatchEvent(new Event('pointerdown')) };
}
const settle = () => new Promise(resolve => setImmediate(resolve));
const click = button => button.dispatchEvent(new Event('click'));

test('music starts when initialized, fades to 20%, and uses one continuous loop', async () => {
  const f = setup(); f.tap(); assert.equal(f.requests(),0);
  f.music.setReady(); await settle();
  assert.equal(f.music.getState().playing,true); assert.equal(f.requests(),1);
  const ctx=f.contexts[0], node=ctx.nodes[0];
  assert.equal(node.loop,true); assert.equal(node.offset,0);
  assert.deepEqual(ctx.output.gain.ramps,[[.2,.8]]);
  f.music.setReady(); f.tap(); await settle();
  assert.equal(ctx.nodes.length,1); assert.equal(f.requests(),1);
  assert.equal(f.buttons[0].attributes['aria-pressed'],'true');
  assert.equal(f.buttons[1].attributes['aria-pressed'],'true');
});

test('blocked startup waits for an interaction and explicit mute cancels the queued start', async () => {
  const f = setup({ blocked:true }); f.music.setReady(); await settle();
  assert.equal(f.music.getState().playing,false);
  click(f.buttons[0]); f.contexts[0].unblock(); await settle();
  assert.equal(f.music.getState().playing,false); assert.equal(f.contexts[0].nodes[0].stopped,true);
  f.tap(); assert.equal(f.music.getState().enabled,false);
  click(f.buttons[1]); await settle(); assert.equal(f.music.getState().playing,true);
  assert.equal(f.buttons[1].dataset.enabled,'true');
});

test('old saved mute is ignored on a fresh visit; blocked autoplay retains its browser fallback', async () => {
  const fresh=setup({ saved:'off' });
  assert.equal(fresh.music.getState().enabled,true);
  assert.equal(fresh.buttons[0].attributes['aria-pressed'],'true');
  fresh.music.setReady(); await settle();
  assert.equal(fresh.requests(),1); assert.equal(fresh.music.getState().playing,true);
  click(fresh.buttons[0]); assert.equal(fresh.music.getState().enabled,false);
  const reloaded=setup({ saved:'off' }); reloaded.music.setReady(); await settle();
  assert.equal(reloaded.music.getState().playing,true);
  const f=setup({ blocked:true }); f.music.setReady(); await settle(); f.tap();
  assert.equal(f.contexts[0].resumes,2); f.contexts[0].unblock(); await settle();
  assert.equal(f.music.getState().playing,true);
});

test('hidden tabs pause and preserve position; showing the tab respects manual mute', async () => {
  const f=setup(); f.music.setReady(); await settle();
  f.contexts[0].currentTime=17; f.doc.hidden=true; f.doc.dispatchEvent(new Event('visibilitychange'));
  assert.equal(f.music.getState().playing,false); assert.equal(f.music.getState().offset,17);
  f.doc.hidden=false; f.doc.dispatchEvent(new Event('visibilitychange'));
  assert.equal(f.contexts[0].nodes.at(-1).offset,17);
  click(f.buttons[1]); f.doc.hidden=true; f.doc.dispatchEvent(new Event('visibilitychange'));
  f.doc.hidden=false; f.doc.dispatchEvent(new Event('visibilitychange'));
  assert.equal(f.music.getState().playing,false); assert.equal(f.buttons[0].dataset.enabled,'false');
});

test('muting during download prevents late playback and network/storage failures stay contained', async () => {
  const f=setup({ deferred:true }); f.music.setReady(); click(f.buttons[0]); f.finishFetch(); await settle();
  assert.equal(f.music.getState().playing,false); assert.equal(f.contexts[0].nodes.length,0);
  const missing=setup({ rejectFetch:true }); missing.music.setReady(); await settle();
  assert.equal(missing.music.getState().failed,true); assert.equal(missing.buttons[0].attributes['aria-label'],'Retry music');
  const privateMode=setup({ storageThrows:true }); privateMode.music.setReady(); await settle();
  click(privateMode.buttons[1]); assert.equal(privateMode.music.getState().enabled,false);
});

test('music has a local licensed asset and both sound buttons are present', () => {
  const credit=JSON.parse(fs.readFileSync(new URL('../public/assets/audio/music-credit.json',import.meta.url)));
  assert.equal(credit.artist,'Yoiyami'); assert.equal(credit.license,'CC0 1.0 Universal');
  assert.equal(credit.defaultVolume,.2);
  assert.ok(fs.statSync(new URL('../public/'+credit.file,import.meta.url)).size<3_000_000);
  const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
  assert.equal((html.match(/data-music-toggle/g)||[]).length,2);
  assert.ok(html.includes(credit.title) && html.includes(credit.artist), 'Visible music credit matches the active asset');
  const main=fs.readFileSync(new URL('../src/main.js',import.meta.url),'utf8');
  assert.ok(main.includes(credit.file), 'The player loads the credited music file');
  assert.ok(main.indexOf('music.setReady();') < main.indexOf('async function init()'), 'Audio starts independently of gallery loading');
});

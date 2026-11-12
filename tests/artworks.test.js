import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const asset = name => new URL(`../public/assets/${name}`, import.meta.url);
const artworks = JSON.parse(fs.readFileSync(asset('artworks.json')));
const notes = JSON.parse(fs.readFileSync(asset('artwork-notes.json')));

test('every indexed artwork has a local image, visual alternative and attributed description', () => {
  assert.deepEqual(Object.keys(notes).sort(), artworks.map(art => art.id).sort());
  for (const art of artworks) {
    const note = notes[art.id];
    assert.ok(fs.existsSync(new URL(`../public/${art.thumbnail}`, import.meta.url)));
    assert.ok(note.alt.length > 40, `${art.id} needs useful visual alt text`);
    assert.ok(note.description.length > 70, `${art.id} needs a description`);
    assert.ok(note.credit);
    assert.equal(new URL(art.source).hostname, 'waneella.tumblr.com');
    if (note.credit !== 'Gallery description') {
      assert.equal(new URL(note.source).hostname, 'www.harugonomayu.com');
      assert.match(note.credit, /^Adapted from /);
    }
  }
});

test('every artwork can be identified by its mesh in both desktop and mobile museums', () => {
  for (const filename of ['gallery.glb', 'gallery-mobile.glb']) {
    const bytes = fs.readFileSync(asset(filename));
    const gltf = JSON.parse(bytes.subarray(20, 20 + bytes.readUInt32LE(12)).toString());
    for (const art of artworks) {
      const nodes = gltf.nodes.filter(node => node.name === art.slot);
      assert.equal(nodes.length, 1, `${filename}: unique mesh for ${art.title}`);
      assert.ok(Number.isInteger(nodes[0].mesh), `${art.title} has selectable geometry`);
    }
    assert.ok(gltf.nodes.some(node => node.name === 'Gallery_Environment'), 'architecture can block clicks through walls');
  }
});

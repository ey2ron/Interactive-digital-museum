import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const asset = name => new URL(`../public/assets/${name}`, import.meta.url);
const artworks = JSON.parse(fs.readFileSync(asset('artworks.json')));
const notes = JSON.parse(fs.readFileSync(asset('artwork-notes.json')));
const collectionExtras = JSON.parse(fs.readFileSync(asset('collection-artworks.json')));

test('collection additions have complete local assets and remain outside the 3D tour', () => {
  const ids = new Set(artworks.map(art => art.id));
  for (const art of collectionExtras) {
    assert.ok(!ids.has(art.id), `Duplicate collection work: ${art.id}`);
    ids.add(art.id);
    assert.equal(art.slot, undefined, 'Collection additions have no gallery mesh');
    assert.equal(art.position, undefined, 'Collection additions have no tour position');
    assert.equal(art.artist, 'Waneella');
    assert.equal(new URL(art.source).hostname, 'waneella.tumblr.com');
    assert.ok(art.pixels.length === 2 && art.pixels.every(value => Number.isInteger(value) && value > 0));
    const image = fs.readFileSync(new URL(`../public/${art.thumbnail}`, import.meta.url));
    assert.equal(image.readUInt16BE(0), 0xffd8, `${art.id} is a valid JPEG image`);
    assert.ok(image.length > 10000);
    assert.ok(art.note.alt.length > 40);
    assert.ok(art.note.description.length > 70);
    assert.equal(art.note.credit, 'Gallery description');
  }
});

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

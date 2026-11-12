import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { buildArc, sampleStops, segmentLength, easeInOut, clamp01 } from './tour.js';

const $ = id => document.getElementById(id);
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const mobile = matchMedia('(max-width: 760px)').matches;
const base = new URL('.', document.baseURI).pathname;
let tour, stops = [], arc, artworks = [], descriptions = {}, renderer, camera, scene, ready = false;
// One step = one painting. `current` is the stop-space coordinate (0 = entrance, 1..16 = paintings).
let current = 0, tween = null, lastTime = performance.now(), lastDrawn = -1, lastCaption = '', resizePending = true;
const position = new THREE.Vector3(), quaternion = new THREE.Quaternion();
const loading = $('loading');

function openCollection() {
  if (!$('collection').open) $('collection').showModal();
}
for (const id of ['open-collection', 'collection-footer', 'fallback-collection']) $(id).addEventListener('click', openCollection);
$('close-collection').addEventListener('click', () => $('collection').close());
$('collection').addEventListener('click', event => { if (event.target === $('collection')) $('collection').close(); });
document.querySelector('.skip').addEventListener('click', event => { event.preventDefault(); openCollection(); });
document.querySelector('.brand').addEventListener('click', event => { event.preventDefault(); goTo(0); });
$('restart').addEventListener('click', () => goTo(0));
$('enter').addEventListener('click', () => { if (reduced) return openCollection(); step(1); });

/* Description side card: optional fields (medium, year, description) come from public/assets/descriptions.json. */
function setPanel(open) {
  $('art-panel').classList.toggle('open', open); $('art-panel').setAttribute('aria-hidden', String(!open));
  $('info-btn').setAttribute('aria-expanded', String(open)); document.body.classList.toggle('panel-open', open);
  if (open) $('panel-close').focus();
}
function fillPanel(art) {
  const info = descriptions[art.id] || {}, index = artworks.indexOf(art) + 1;
  $('panel-number').textContent = `WORK ${String(index).padStart(2,'0')} / 16`;
  $('panel-title').textContent = art.title;
  $('panel-desc').textContent = info.description || '';
  $('panel-source').href = art.source;
  const meta = $('panel-meta'); meta.replaceChildren();
  for (const [label, value] of [['ARTIST', art.artist || 'Waneella'], ['MEDIUM', info.medium], ['YEAR', info.year]]) {
    if (!value) continue;
    const dt = document.createElement('dt'), dd = document.createElement('dd'); dt.textContent = label; dd.textContent = value; meta.append(dt, dd);
  }
}
$('info-btn').addEventListener('click', () => setPanel(!$('art-panel').classList.contains('open')));
$('panel-close').addEventListener('click', () => { setPanel(false); $('info-btn').focus(); });
addEventListener('keydown', event => { if (event.key === 'Escape' && $('art-panel').classList.contains('open')) { setPanel(false); $('info-btn').focus(); } });

/** Move to a stop with an eased, even-paced glide. Ignored while a glide is running. */
function goTo(index) {
  index = Math.max(0, Math.min(stops.length - 1, index));
  if (!ready || tween || index === Math.round(current)) return;
  let length = 0;
  for (let k = Math.min(index, current) | 0; k < Math.max(index, Math.ceil(current)); k++) length += segmentLength(arc, stops, k);
  setPanel(false);
  tween = { from: current, to: index, start: performance.now(), duration: Math.max(1.4, Math.min(4.2, 1.1 + length * .17)) * 1000 };
}
const step = direction => goTo(Math.round(current) + direction);

// Input: one wheel gesture / swipe / key press = one painting. Wheel inertia is swallowed until the wheel goes quiet.
let wheelQuietTimer = 0, wheelLocked = false;
addEventListener('wheel', event => {
  if ($('collection').open || reduced) return;
  event.preventDefault();
  clearTimeout(wheelQuietTimer);
  wheelQuietTimer = setTimeout(() => { wheelLocked = false; }, 140);
  if (wheelLocked || Math.abs(event.deltaY) < 4) return;
  wheelLocked = true; step(Math.sign(event.deltaY));
}, { passive: false });
let touchY = null;
addEventListener('touchstart', event => { touchY = event.touches[0].clientY; }, { passive: true });
addEventListener('touchend', event => {
  if (touchY === null || $('collection').open) return;
  const dy = touchY - event.changedTouches[0].clientY; touchY = null;
  if (Math.abs(dy) > 36) step(Math.sign(dy));
}, { passive: true });
addEventListener('keydown', event => {
  if ($('collection').open || reduced || event.target.closest?.('button,a')&&event.key===' ') return;
  const map = { ArrowDown: 1, ArrowRight: 1, PageDown: 1, ' ': 1, ArrowUp: -1, ArrowLeft: -1, PageUp: -1 };
  if (event.key in map) { event.preventDefault(); step(map[event.key]); }
  else if (event.key === 'Home') goTo(0);
  else if (event.key === 'End') goTo(stops.length - 1);
});
function showFallback(message) {
  $('loading-message').textContent = message;
  loading.classList.add('loaded'); $('fallback').hidden = false;
  document.body.classList.add('fallback-mode');
  if (reduced) openCollection();
}
function createIndex() {
  for (const art of artworks) {
    const article = document.createElement('article');
    const image = document.createElement('img');
    image.src = base + art.thumbnail; image.alt = `${art.title} by Waneella`; image.loading = 'lazy';
    const number = document.createElement('span'); number.className = 'eyebrow'; number.textContent = String(artworks.indexOf(art) + 1).padStart(2, '0');
    const title = document.createElement('h3'); title.textContent = art.title;
    const source = document.createElement('a'); source.href = art.source; source.target = '_blank'; source.rel = 'noopener noreferrer'; source.textContent = 'Waneella · Original artwork ↗';
    article.append(image, number, title, source); $('art-grid').append(article);
  }
}
function resize() {
  const width = innerWidth, height = innerHeight;
  renderer.setPixelRatio(Math.min(devicePixelRatio, mobile ? 1.35 : 1.75));
  renderer.setSize(width, height);
  camera.aspect = width / height;
  const vFov = THREE.MathUtils.degToRad(tour.verticalFov);
  // Preserve horizontal framing on narrow screens; cap extreme portrait distortion.
  camera.fov = THREE.MathUtils.radToDeg(camera.aspect < tour.referenceAspect
    ? Math.min(THREE.MathUtils.degToRad(110), 2 * Math.atan(Math.tan(vFov / 2) * tour.referenceAspect / camera.aspect))
    : vFov);
  camera.updateProjectionMatrix(); resizePending = false;
}
function updateCaption() {
  // Caption appears once the camera has settled on a painting.
  const settled = Math.abs(current - Math.round(current)) < .002 && Math.round(current) > 0;
  const art = settled ? artworks.find(x => x.id === stops[Math.round(current)].id) : null;
  const key = art?.id || '';
  if (key === lastCaption) return;
  lastCaption = key;
  $('art-caption').classList.toggle('visible', !!art);
  if (art) fillPanel(art);
  if (art) { $('art-number').textContent = `WORK ${String(artworks.indexOf(art)+1).padStart(2,'0')} / 16`; $('art-title').textContent = art.title; }
}
/** Public local controller for previews and deterministic comparison: setStop(n) jumps to stop n (0 = entrance). */
function setStop(index) {
  if (!ready) return;
  tween = null; current = Math.max(0, Math.min(stops.length - 1, index)); lastDrawn = -1;
}
window.galleryTour = { setStop, goTo, step, getStop: () => current, get stops() { return stops; }, get camera() { return camera; } };

function tick(now) {
  requestAnimationFrame(tick);
  if (!ready || document.hidden) { lastTime = now; return; }
  lastTime = now;
  if (tween) {
    const u = clamp01((now - tween.start) / tween.duration);
    current = tween.from + (tween.to - tween.from) * easeInOut(u);
    if (u >= 1) { current = tween.to; tween = null; }
  }
  if (current === lastDrawn && !resizePending) return;
  if (resizePending) resize();
  sampleStops(tour, arc, stops, current, position, quaternion);
  camera.position.copy(position); camera.quaternion.copy(quaternion);
  renderer.render(scene, camera); lastDrawn = current;
  const progress = current / (stops.length - 1);
  $('intro').style.opacity = String(1 - clamp01(current / .6));
  $('intro').style.visibility = current > .65 ? 'hidden' : 'visible';
  $('ending').classList.toggle('visible', !tween && Math.round(current) === stops.length - 1);
  $('progress-fill').style.transform = `scaleX(${progress})`;
  $('progress-total').textContent = String(stops.length - 1);
  $('progress-label').textContent = String(Math.round(current)).padStart(2,'0');
  $('scroll-hint').innerHTML = current < .02 ? 'SCROLL TO EXPLORE <span>↓</span>' : 'ONE SCROLL · NEXT WORK <span>↓</span>';
  updateCaption();
}
addEventListener('resize', () => { resizePending = true; });
async function init() {
  try {
    const responses = await Promise.all([fetch(base+'assets/camera-tour.json'), fetch(base+'assets/artworks.json'), fetch(base+'assets/stops.json')]);
    if (responses.some(r => !r.ok)) throw new Error('Gallery assets are missing. Run the Blender export first.');
    [tour, artworks, stops] = await Promise.all(responses.map(r=>r.json()));
    descriptions = await fetch(base+'assets/descriptions.json').then(r => r.ok ? r.json() : {}).catch(() => ({})); arc = buildArc(tour); createIndex();
    if (reduced) return showFallback('Explore at your own pace');
    renderer = new THREE.WebGLRenderer({ antialias: !mobile, powerPreference: mobile ? 'low-power' : 'high-performance' });
    renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1;
    $('stage').append(renderer.domElement);
    renderer.domElement.addEventListener('webglcontextlost', event => { event.preventDefault(); showFallback('The 3D view was interrupted. The collection is still available.'); });
    scene = new THREE.Scene(); scene.background = new THREE.Color('#161b1b');
    camera = new THREE.PerspectiveCamera(tour.verticalFov, innerWidth/innerHeight, Math.max(.03,tour.clipNear), tour.clipFar);
    const loader = new GLTFLoader();
    const model = await loader.loadAsync(base+'assets/'+(mobile?'gallery-mobile.glb':'gallery.glb'), event => {
      if (event.total) $('loading-fill').style.width = `${Math.round(event.loaded/event.total*100)}%`;
    });
    scene.add(model.scene); ready = true; resize();
    loading.classList.add('loaded');
    requestAnimationFrame(tick);
  } catch (error) { console.error(error); showFallback(error.message); }
}
init();

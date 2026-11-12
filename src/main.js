import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { sampleTour, scrollProgress, clamp01 } from './tour.js';

const $ = id => document.getElementById(id);
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const mobile = matchMedia('(max-width: 760px)').matches;
const base = new URL('.', document.baseURI).pathname;
let tour, artworks = [], renderer, camera, scene, ready = false, current = 0, desired = 0;
let lastTime = performance.now(), lastDrawn = -1, lastCaption = '', resizePending = true;
const position = new THREE.Vector3(), quaternion = new THREE.Quaternion();
const loading = $('loading');

function openCollection() {
  if (!$('collection').open) $('collection').showModal();
}
for (const id of ['open-collection', 'collection-footer', 'fallback-collection']) $(id).addEventListener('click', openCollection);
$('close-collection').addEventListener('click', () => $('collection').close());
$('collection').addEventListener('click', event => { if (event.target === $('collection')) $('collection').close(); });
document.querySelector('.skip').addEventListener('click', event => { event.preventDefault(); openCollection(); });
document.querySelector('.brand').addEventListener('click', event => { event.preventDefault(); window.scrollTo({ top: 0, behavior: reduced ? 'instant' : 'smooth' }); });
$('restart').addEventListener('click', () => window.scrollTo({ top: 0, behavior: reduced ? 'instant' : 'smooth' }));
$('enter').addEventListener('click', () => {
  if (reduced) return openCollection();
  window.scrollTo({ top: innerHeight * .65, behavior: 'smooth' });
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
  const viewingDirection = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
  let chosen = null, best = .92;
  for (const art of artworks) {
    const direction = new THREE.Vector3(...art.position).sub(camera.position), distance = direction.length();
    if (distance > 10 || distance < .2) continue;
    const score = direction.normalize().dot(viewingDirection);
    if (score > best) { best = score; chosen = art; }
  }
  // Captions accompany authored viewing stops, avoiding labels through intervening walls.
  const frame = tour.firstFrame + current * tour.duration * tour.fps;
  const inHold = tour.schedule.holds?.some(([a,b]) => frame >= a && frame <= b);
  if (!inHold || current < .035) chosen = null;
  const key = chosen?.id || '';
  if (key !== lastCaption) {
    lastCaption = key;
    $('art-caption').classList.toggle('visible', !!chosen);
    if (chosen) { $('art-number').textContent = `WORK ${String(artworks.indexOf(chosen)+1).padStart(2,'0')} / 16`; $('art-title').textContent = chosen.title; }
  }
}
/** Public local controller for previews and deterministic comparison with Blender. */
function setProgress(progress) {
  if (!ready) return;
  current = desired = clamp01(progress);
  window.scrollTo({ top: desired * (document.documentElement.scrollHeight - innerHeight), behavior: 'instant' });
  lastDrawn = -1;
}
window.galleryTour = { setProgress, getProgress: () => current, get duration() { return tour?.duration; }, get camera() { return camera; } };

function tick(now) {
  requestAnimationFrame(tick);
  if (!ready || document.hidden) { lastTime = now; return; }
  const dt = Math.min(.05, (now-lastTime)/1000); lastTime = now;
  desired = scrollProgress(scrollY, 0, document.documentElement.scrollHeight - innerHeight);
  current += (desired-current) * (1-Math.exp(-dt/0.12));
  if (Math.abs(desired-current) < .000003) current = desired;
  if (Math.abs(current-lastDrawn) < .0000001 && !resizePending) return;
  if (resizePending) resize();
  sampleTour(tour, current, position, quaternion);
  camera.position.copy(position); camera.quaternion.copy(quaternion);
  renderer.render(scene, camera); lastDrawn = current;
  $('intro').style.opacity = String(1-clamp01(current/.045));
  $('intro').style.visibility = current > .05 ? 'hidden' : 'visible';
  $('ending').classList.toggle('visible', current > .993);
  $('progress-fill').style.transform = `scaleX(${current})`;
  $('progress-label').textContent = String(Math.round(current*100)).padStart(2,'0');
  $('scroll-hint').innerHTML = current < .02 ? 'SCROLL TO EXPLORE <span>↓</span>' : 'TAKE YOUR TIME <span>↓</span>';
  updateCaption();
}
addEventListener('resize', () => { resizePending = true; });
async function init() {
  try {
    const responses = await Promise.all([fetch(base+'assets/camera-tour.json'), fetch(base+'assets/artworks.json')]);
    if (responses.some(r => !r.ok)) throw new Error('Gallery assets are missing. Run the Blender export first.');
    [tour, artworks] = await Promise.all(responses.map(r=>r.json())); createIndex();
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

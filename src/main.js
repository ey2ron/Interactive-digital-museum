import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { buildArc, sampleStops, segmentLength, easeInOut, scrollProgress, clamp01, nearestStop, checkpointProgress } from './tour.js';

const $ = id => document.getElementById(id);
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const mobile = matchMedia('(max-width: 760px)').matches;
const base = new URL('.', document.baseURI).pathname;
let tour, artworks = [], renderer, camera, scene, ready = false, current = 0, desired = 0;
let lastTime = performance.now(), lastDrawn = -1, lastCaption = '', resizePending = true;
const position = new THREE.Vector3(), quaternion = new THREE.Quaternion();
const loading = $('loading');
let stops = [], viewingStops = [], arc, checkpointStops = [], checkpointIndices = [], checkpoints = [], activeStop = 0, transition = null;
let visibleCheckpoint = -1;
let lastWheel = -Infinity, settleTimer, expectedScroll = null, touchStart = null;
let freeRoam = false, captionArt = null, detailIndex = -1, detailOrigin = 'index', indexScroll = 0;
let detailTrigger = null, pointerStart = null;
let viewAnimations = [];
let dismissing = false;
const raycaster = new THREE.Raycaster(), pointer = new THREE.Vector2();
try { freeRoam = localStorage.getItem('gallery-navigation') === 'free'; } catch {}

function setNavigationMode(free) {
  freeRoam = !!free;
  clearTimeout(settleTimer); transition = null; desired = current;
  activeStop = nearestStop(stops, current);
  if (ready) syncScroll(current);
  lastWheel = -Infinity;
  $('toggle-roam').setAttribute('aria-pressed', String(freeRoam));
  $('toggle-roam').title = freeRoam ? 'Switch back to one portrait per scroll' : 'Scroll freely along the gallery path';
  $('gallery-status').textContent = freeRoam
    ? 'Free roam on. Scroll continuously along the gallery path.'
    : 'Guided mode on. Scroll once to move to the next portrait.';
  try { localStorage.setItem('gallery-navigation', freeRoam ? 'free' : 'guided'); } catch {}
  updateCheckpoints(); lastDrawn = -1;
}
$('toggle-roam').addEventListener('click', () => setNavigationMode(!freeRoam));

function moveOneStop(direction) {
  const index = direction > 0 ? stops.findIndex(stop => stop > current + .00001)
    : stops.findLastIndex(stop => stop < current - .00001);
  goToStop(index < 0 ? (direction > 0 ? stops.length - 1 : 0) : index);
}

function scrollingCaption(target) {
  const caption = target.closest?.('#art-caption');
  return caption && caption.scrollHeight > caption.clientHeight + 1;
}

function syncScroll(progress) {
  expectedScroll = progress * (document.documentElement.scrollHeight - innerHeight);
  window.scrollTo({ top: expectedScroll, behavior: 'instant' });
}
function goToStop(index) {
  if (!ready) return;
  clearTimeout(settleTimer);
  activeStop = Math.max(0, Math.min(stops.length - 1, index));
  const target = stops[activeStop];
  const from = current * (stops.length - 1);
  let length = 0;
  for (let k = Math.floor(Math.min(from, activeStop)); k < Math.ceil(Math.max(from, activeStop)); k++) {
    length += segmentLength(arc, viewingStops, k);
  }
  transition = Math.abs(target - current) < .000003 ? null :
    { from: current, to: target, start: performance.now(), duration: Math.max(1.4, Math.min(4.2, 1.1 + length * .17)) * 1000 };
  desired = target;
  updateCheckpoints();
}
function updateCheckpoints() {
  const nearest = nearestStop(checkpointStops, current);
  checkpoints.forEach((button, index) => {
    if (index === nearest) button.setAttribute('aria-current', 'step');
    else button.removeAttribute('aria-current');
    button.classList.toggle('visited', checkpointStops[index] <= current + .000003);
  });
  if (nearest !== visibleCheckpoint && checkpoints[nearest]) {
    visibleCheckpoint = nearest;
    const rail = $('checkpoint-window'), button = checkpoints[nearest];
    rail.scrollTo({ left: button.offsetLeft + 22 - rail.clientWidth / 2, behavior: reduced ? 'instant' : 'smooth' });
  }
}
function createCheckpoints() {
  stops = viewingStops.map((_, index) => index / (viewingStops.length - 1));
  checkpointIndices = viewingStops.map((_, index) => index);
  checkpointStops = checkpointIndices.map(index => stops[index]);
  $('checkpoint-window').style.setProperty('--checkpoint-count', checkpointIndices.length);
  checkpoints = checkpointIndices.map((stopIndex, index) => {
    const button = document.createElement('button');
    button.type = 'button'; button.className = 'checkpoint';
    button.style.left = `${index / (checkpointIndices.length - 1) * 100}%`;
    const art = artworks.find(art => art.id === viewingStops[stopIndex].id);
    button.title = index === 0 ? 'Starting view' : `Portrait ${stopIndex}: ${art.title}`;
    button.setAttribute('aria-label', `Go to ${button.title.toLowerCase()}`);
    button.addEventListener('click', () => goToStop(stopIndex));
    $('checkpoints').append(button);
    return button;
  });
  updateCheckpoints();
}

$('checkpoint-window').addEventListener('wheel', event => {
  if (event.ctrlKey) return;
  const rail = $('checkpoint-window');
  if (rail.scrollWidth <= rail.clientWidth) return;
  event.preventDefault();
  rail.scrollLeft += Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
}, { passive: false });
$('checkpoints').addEventListener('keydown', event => {
  if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
  const index = checkpoints.indexOf(event.target.closest('.checkpoint'));
  if (index < 0) return;
  event.preventDefault(); event.stopPropagation();
  if (event.repeat) return;
  const target = event.key === 'Home' ? 0 : event.key === 'End' ? checkpoints.length - 1
    : Math.max(0, Math.min(checkpoints.length - 1, index + (event.key === 'ArrowRight' ? 1 : -1)));
  checkpoints[target].focus(); goToStop(target);
});

addEventListener('wheel', event => {
  if (event.target.closest?.('#checkpoint-window')) return;
  if (freeRoam && transition && !$('collection').open && !event.ctrlKey && event.deltaY) {
    transition = null; desired = current;
  }
  if (!ready || reduced || freeRoam || $('collection').open || scrollingCaption(event.target) || event.ctrlKey || Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return;
  event.preventDefault();
  const now = performance.now(), freshGesture = now - lastWheel > 250;
  lastWheel = now;
  if (!transition && freshGesture) moveOneStop(Math.sign(event.deltaY));
}, { passive: false });
addEventListener('keydown', event => {
  if (!ready || reduced || freeRoam || $('collection').open || scrollingCaption(event.target) || event.altKey || event.ctrlKey || event.metaKey) return;
  if (event.target.closest('input, textarea, select, [contenteditable], a, button')) return;
  let target;
  if (['ArrowDown', 'ArrowRight', 'PageDown', ' '].includes(event.key)) target = activeStop + (event.shiftKey && event.key === ' ' ? -1 : 1);
  else if (['ArrowUp', 'ArrowLeft', 'PageUp'].includes(event.key)) target = activeStop - 1;
  else if (event.key === 'Home') target = 0;
  else if (event.key === 'End') target = stops.length - 1;
  else return;
  event.preventDefault();
  if (!event.repeat && (!transition || event.key === 'Home' || event.key === 'End')) {
    if (event.key === 'Home' || event.key === 'End') goToStop(target);
    else moveOneStop(Math.sign(target - activeStop));
  }
});
addEventListener('touchstart', event => {
  if (freeRoam && transition && !$('collection').open) { transition = null; desired = current; }
  touchStart = ready && !reduced && !freeRoam && !$('collection').open && !scrollingCaption(event.target) && !event.target.closest?.('#checkpoint-window') && event.touches.length === 1
    ? { x: event.touches[0].clientX, y: event.touches[0].clientY } : null;
}, { passive: true });
addEventListener('touchmove', event => {
  if (touchStart && event.touches.length === 1 && !$('collection').open) event.preventDefault();
  else touchStart = null;
}, { passive: false });
addEventListener('touchend', event => {
  if (!touchStart) return;
  const dx = touchStart.x - event.changedTouches[0].clientX;
  const dy = touchStart.y - event.changedTouches[0].clientY;
  touchStart = null;
  if (!transition && !$('collection').open && Math.abs(dy) > 40 && Math.abs(dy) > Math.abs(dx)) moveOneStop(Math.sign(dy));
}, { passive: true });
addEventListener('touchcancel', () => { touchStart = null; });
addEventListener('scroll', () => {
  if (!ready || reduced || transition || Math.abs(scrollY - expectedScroll) < 2) return;
  desired = scrollProgress(scrollY, 0, document.documentElement.scrollHeight - innerHeight);
  activeStop = nearestStop(stops, desired);
  updateCheckpoints();
  clearTimeout(settleTimer);
  if (!freeRoam) settleTimer = setTimeout(() => goToStop(activeStop), 180);
}, { passive: true });

function openCollection() {
  closeArtwork(false);
  if (!$('collection').open) {
    clearTimeout(settleTimer); transition = null; desired = current;
    syncScroll(current);
    document.body.classList.add('collection-open');
    $('collection').showModal();
    animateIndex();
  }
}
for (const id of ['open-collection', 'collection-footer', 'fallback-collection']) $(id).addEventListener('click', openCollection);
$('close-collection').addEventListener('click', () => dismissView());
$('collection').addEventListener('click', event => {
  if (event.target.closest('button, a, .collection-head, .detail-copy, .detail-toolbar, .collection-note, .credits, #art-grid article')) return;
  if (detailIndex >= 0) {
    const rect = imageRect($('detail-image'), artworks[detailIndex]);
    if (event.clientX >= rect.x && event.clientX <= rect.x + rect.width &&
        event.clientY >= rect.y && event.clientY <= rect.y + rect.height) return;
  }
  dismissView();
});
$('collection').addEventListener('close', () => {
  dismissing = false;
  $('collection').classList.remove('view-exiting', 'closing-overlay');
  stopViewAnimations();
  document.body.classList.remove('collection-open');
  detailIndex = -1; lastWheel = -Infinity;
  if (ready) syncScroll(current);
});
$('collection').addEventListener('cancel', event => {
  event.preventDefault(); dismissView();
});
document.querySelector('.skip').addEventListener('click', event => { event.preventDefault(); openCollection(); });
document.querySelector('.brand').addEventListener('click', event => { event.preventDefault(); goToStop(0); });
$('restart').addEventListener('click', () => goToStop(0));
$('enter').addEventListener('click', () => {
  if (reduced) return openCollection();
  goToStop(1);
});
function showFallback(message) {
  ready = false; transition = null; clearTimeout(settleTimer);
  $('toggle-roam').hidden = true;
  $('loading-message').textContent = message;
  loading.classList.add('loaded'); $('fallback').hidden = false;
  document.body.classList.add('fallback-mode');
  if (reduced) openCollection();
}
function createIndex() {
  for (const art of artworks) {
    const article = document.createElement('article');
    const view = document.createElement('button'); view.type = 'button'; view.className = 'artwork-card';
    view.dataset.artId = art.id;
    view.setAttribute('aria-label', `View ${art.title} by Waneella`);
    const image = document.createElement('img');
    image.src = base + art.thumbnail; image.alt = art.note.alt; image.loading = 'lazy';
    const number = document.createElement('span'); number.className = 'eyebrow'; number.textContent = String(artworks.indexOf(art) + 1).padStart(2, '0');
    const title = document.createElement('h3'); title.textContent = art.title;
    const source = document.createElement('a'); source.href = art.source; source.target = '_blank'; source.rel = 'noopener noreferrer'; source.textContent = 'Waneella · Original artwork ↗';
    view.append(image, number, title); view.addEventListener('click', () => openArtwork(art, 'index', view));
    article.append(view, source); $('art-grid').append(article);
  }
}

function stopViewAnimations() {
  viewAnimations.forEach(animation => animation.cancel());
  viewAnimations = [];
}
function animateView(element, keyframes, options) {
  if (reduced) return;
  const animation = element.animate(keyframes, {
    duration: 450, easing: 'cubic-bezier(.2,.75,.2,1)', ...options
  });
  viewAnimations.push(animation);
  return animation;
}
function animateIndex() {
  stopViewAnimations();
  animateView($('collection'), [{ opacity: 0 }, { opacity: 1 }], { duration: 320 });
  animateView($('index-view'), [{ opacity: 0, transform: 'translateY(10px)' }, { opacity: 1, transform: 'translateY(0)' }]);
}
/** Measure the artwork pixels, excluding object-fit letterboxing and padding. */
function imageRect(image, art) {
  const rect = image.getBoundingClientRect(), style = getComputedStyle(image);
  const left = parseFloat(style.paddingLeft), top = parseFloat(style.paddingTop);
  const width = rect.width - left - parseFloat(style.paddingRight);
  const height = rect.height - top - parseFloat(style.paddingBottom);
  const scale = Math.min(width / art.pixels[0], height / art.pixels[1]);
  const drawnWidth = art.pixels[0] * scale, drawnHeight = art.pixels[1] * scale;
  return { x: rect.x + left + (width - drawnWidth) / 2, y: rect.y + top + (height - drawnHeight) / 2, width: drawnWidth, height: drawnHeight };
}
function portraitRect(art) {
  if (!ready) return null;
  const object = scene.getObjectByName(art.slot);
  if (!object) return null;
  const box = new THREE.Box3().setFromObject(object), corners = [];
  for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) for (const z of [box.min.z, box.max.z]) {
    const point = new THREE.Vector3(x, y, z).project(camera);
    if (point.z < -1 || point.z > 1) return null;
    corners.push({ x: (point.x + 1) * innerWidth / 2, y: (1 - point.y) * innerHeight / 2 });
  }
  const x = Math.min(...corners.map(p => p.x)), y = Math.min(...corners.map(p => p.y));
  return { x, y, width: Math.max(...corners.map(p => p.x)) - x, height: Math.max(...corners.map(p => p.y)) - y };
}
function animateArtwork(art, sourceRect) {
  stopViewAnimations();
  if (reduced) return;
  const target = imageRect($('detail-image'), art);
  let transform = 'translate(0, 8px) scale(.94)';
  if (sourceRect?.width > 0 && target.width > 0) {
    const x = sourceRect.x + sourceRect.width / 2 - target.x - target.width / 2;
    const y = sourceRect.y + sourceRect.height / 2 - target.y - target.height / 2;
    const scale = Math.max(.08, Math.min(1, sourceRect.width / target.width));
    transform = `translate(${x}px, ${y}px) scale(${scale})`;
  }
  animateView($('detail-image'), [{ opacity: .15, transform }, { opacity: 1, transform: 'translate(0, 0) scale(1)' }], { duration: 520 });
  animateView(document.querySelector('.detail-copy'), [{ opacity: 0, transform: 'translateY(8px)' }, { opacity: 1, transform: 'translateY(0)' }], { delay: 80, fill: 'backwards' });
  animateView(document.querySelector('.detail-toolbar'), [{ opacity: 0 }, { opacity: 1 }], { duration: 280 });
}
function renderArtwork(sourceRect) {
  const art = artworks[detailIndex];
  $('detail-image').src = base + art.thumbnail;
  $('detail-image').alt = art.note.alt;
  $('detail-title').textContent = art.title;
  $('detail-number').textContent = `WORK ${String(detailIndex + 1).padStart(2, '0')} / ${artworks.length}`;
  $('detail-description').textContent = art.note.description;
  $('detail-credit').textContent = art.note.credit;
  $('detail-note-source').hidden = !art.note.source;
  if (art.note.source) $('detail-note-source').href = art.note.source;
  else $('detail-note-source').removeAttribute('href');
  $('detail-source').href = art.source;
  $('previous-artwork').disabled = detailIndex === 0;
  $('next-artwork').disabled = detailIndex === artworks.length - 1;
  $('detail-status').textContent = `${art.title}. Artwork ${detailIndex + 1} of ${artworks.length}.`;
  animateArtwork(art, sourceRect);
}
function openArtwork(art, origin = 'tour', trigger = $('view-current-art')) {
  if (dismissing) return;
  const thumbnail = origin === 'index' ? trigger?.querySelector('img') : null;
  const sourceRect = thumbnail ? imageRect(thumbnail, art) : portraitRect(art);
  if (origin === 'index') indexScroll = $('collection').scrollTop;
  else openCollection();
  detailOrigin = origin; detailTrigger = trigger;
  detailIndex = artworks.indexOf(art);
  $('index-view').hidden = true; $('artwork-detail').hidden = false;
  $('collection').classList.add('viewing-artwork');
  $('collection').setAttribute('aria-labelledby', 'detail-title');
  $('close-collection').setAttribute('aria-label', origin === 'index' ? 'Return to artwork index' : 'Return to virtual museum');
  $('collection').scrollTop = 0; renderArtwork(sourceRect);
  $('detail-title').focus({ preventScroll: true });
}
function closeArtwork(restore = true) {
  stopViewAnimations();
  detailIndex = -1;
  $('index-view').hidden = false; $('artwork-detail').hidden = true;
  $('collection').classList.remove('viewing-artwork');
  $('collection').setAttribute('aria-labelledby', 'collection-title');
  $('close-collection').setAttribute('aria-label', 'Close collection and return to virtual museum');
  if (restore) {
    $('collection').scrollTop = detailOrigin === 'index' ? indexScroll : 0;
    const trigger = detailOrigin === 'index' ? detailTrigger : $('close-collection');
    trigger?.focus({ preventScroll: true });
    animateIndex();
  }
}
async function dismissView(destination = detailIndex >= 0 && detailOrigin === 'index' ? 'index' : 'museum') {
  if (dismissing || !$('collection').open) return;
  dismissing = true;
  const target = destination === 'index' ? $('artwork-detail') : $('collection');
  const opacity = getComputedStyle(target).opacity;
  $('collection').style.setProperty('--veil-opacity', getComputedStyle($('collection'), '::backdrop').opacity);
  $('collection').classList.add('view-exiting');
  if (destination === 'museum') $('collection').classList.add('closing-overlay');
  const animation = animateView(target, [{ opacity }, { opacity: 0 }], {
    duration: 220, easing: 'ease-in', fill: 'forwards'
  });
  if (animation) await animation.finished.catch(() => {});
  if (!$('collection').open) { dismissing = false; return; }
  $('collection').classList.remove('view-exiting', 'closing-overlay');
  dismissing = false;
  if (destination === 'index') closeArtwork();
  else $('collection').close();
}
function browseArtwork(direction) {
  if (dismissing) return;
  const index = detailIndex + direction;
  if (index < 0 || index >= artworks.length) return;
  detailIndex = index; renderArtwork();
  // Avoid leaving focus on a button that becomes disabled at an endpoint.
  if (document.activeElement.disabled) $('detail-title').focus({ preventScroll: true });
}
$('back-to-index').addEventListener('click', () => dismissView('index'));
$('previous-artwork').addEventListener('click', () => browseArtwork(-1));
$('next-artwork').addEventListener('click', () => browseArtwork(1));
$('collection').addEventListener('keydown', event => {
  if (dismissing) { event.preventDefault(); return; }
  if (event.key === 'Escape') {
    event.preventDefault(); dismissView(); return;
  }
  if (detailIndex < 0 || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
  if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
    event.preventDefault(); browseArtwork(event.key === 'ArrowRight' ? 1 : -1);
  }
});
$('view-current-art').addEventListener('click', () => { if (captionArt) openArtwork(captionArt); });

function artFromHit(hit) {
  let object = hit?.object;
  while (object) {
    if (object.userData.artId) return artworks.find(art => art.id === object.userData.artId);
    object = object.parent;
  }
  return null;
}
function artworkAt(clientX, clientY) {
  if (!ready || $('collection').open) return null;
  const rect = renderer.domElement.getBoundingClientRect();
  pointer.set((clientX - rect.left) / rect.width * 2 - 1, -(clientY - rect.top) / rect.height * 2 + 1);
  raycaster.setFromCamera(pointer, camera);
  // Include the architecture: a wall in front of a painting blocks selection.
  return artFromHit(raycaster.intersectObjects(scene.children, true)[0]);
}
function connectArtworkPicking() {
  renderer.domElement.addEventListener('pointerdown', event => {
    if (!event.isPrimary) { pointerStart = null; return; }
    if (event.isPrimary && event.button === 0) pointerStart = { x: event.clientX, y: event.clientY, dragged: false };
  });
  renderer.domElement.addEventListener('pointermove', event => {
    if (pointerStart && Math.hypot(event.clientX - pointerStart.x, event.clientY - pointerStart.y) > 8) pointerStart.dragged = true;
    if (event.pointerType === 'mouse') renderer.domElement.style.cursor = artworkAt(event.clientX, event.clientY) ? 'pointer' : '';
  });
  renderer.domElement.addEventListener('pointerup', event => {
    const start = pointerStart; pointerStart = null;
    if (!start || start.dragged || !event.isPrimary || event.button !== 0 || Math.hypot(event.clientX - start.x, event.clientY - start.y) > 8) return;
    const art = artworkAt(event.clientX, event.clientY);
    if (art) openArtwork(art);
  });
  renderer.domElement.addEventListener('pointercancel', () => { pointerStart = null; });
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
  // Guided captions follow the PR's centered stops; free roam follows the gaze.
  if (!freeRoam) {
    const stop = current * (viewingStops.length - 1), index = Math.round(stop);
    chosen = !transition && index > 0 && Math.abs(stop - index) < .002
      ? artworks.find(art => art.id === viewingStops[index].id) : null;
  }
  if (current < .035) chosen = null;
  if (chosen) {
    raycaster.set(camera.position, new THREE.Vector3(...chosen.position).sub(camera.position).normalize());
    if (artFromHit(raycaster.intersectObjects(scene.children, true)[0])?.id !== chosen.id) chosen = null;
  }
  const key = chosen?.id || '';
  if (key !== lastCaption) {
    lastCaption = key;
    captionArt = chosen;
    $('art-caption').classList.toggle('visible', !!chosen);
    $('art-caption').inert = !chosen;
    if (chosen) {
      $('art-number').textContent = `WORK ${String(artworks.indexOf(chosen)+1).padStart(2,'0')} / ${artworks.length}`;
      $('art-title').textContent = chosen.title;
      $('art-description').textContent = chosen.note.description;
      $('art-description-credit').textContent = chosen.note.credit;
      $('view-current-art').setAttribute('aria-label', `View ${chosen.title} and its details`);
    }
  }
}
/** Public local controller for previews and deterministic comparison with Blender. */
function setProgress(progress) {
  if (!ready) return;
  clearTimeout(settleTimer); transition = null;
  current = desired = clamp01(progress);
  activeStop = nearestStop(stops, current); updateCheckpoints();
  syncScroll(current);
  lastDrawn = -1;
}
window.galleryTour = {
  setProgress, goToStop, setNavigationMode,
  setStop: index => setProgress(index / (viewingStops.length - 1)),
  getStop: () => current * (viewingStops.length - 1),
  get mode() { return freeRoam ? 'free' : 'guided'; }, getProgress: () => current,
  get stops() { return [...stops]; }, get viewingStops() { return structuredClone(viewingStops); },
  get duration() { return tour?.duration; }, get camera() { return camera; }
};

function tick(now) {
  requestAnimationFrame(tick);
  if (!ready || document.hidden || $('collection').open) { lastTime = now; return; }
  const dt = Math.min(.05, (now-lastTime)/1000); lastTime = now;
  if (transition) {
    const elapsed = clamp01((now - transition.start) / transition.duration);
    current = transition.from + (transition.to - transition.from) * easeInOut(elapsed);
    syncScroll(current);
    if (elapsed === 1) {
      current = desired = transition.to; transition = null;
      lastDrawn = -1; // Settled captions/ending must update even if the pose already rounded to its target.
      updateCheckpoints();
    }
  } else current += (desired-current) * (1-Math.exp(-dt/0.12));
  if (!transition && Math.abs(desired-current) < .000003) current = desired;
  if (Math.abs(current-lastDrawn) < .0000001 && !resizePending) return;
  if (resizePending) resize();
  sampleStops(tour, arc, viewingStops, current * (viewingStops.length - 1), position, quaternion);
  camera.position.copy(position); camera.quaternion.copy(quaternion);
  renderer.render(scene, camera); lastDrawn = current;
  const stopCoordinate = current * (viewingStops.length - 1);
  $('intro').style.opacity = String(1-clamp01(stopCoordinate/.6));
  $('intro').style.visibility = stopCoordinate > .65 ? 'hidden' : 'visible';
  $('ending').classList.toggle('visible', !transition && current === 1);
  const barProgress = checkpointProgress(checkpointStops, current);
  $('progress-fill').style.transform = `scaleX(${barProgress})`;
  $('progress-label').textContent = String(Math.round(barProgress*100)).padStart(2,'0');
  updateCheckpoints();
  $('scroll-hint').textContent = freeRoam ? 'FREE ROAM · SCROLL TO EXPLORE ↓' : current < .02 ? 'SCROLL TO EXPLORE ↓' : 'SCROLL TO NEXT VIEW ↓';
  updateCaption();
}
addEventListener('resize', () => { resizePending = true; if (ready) syncScroll(current); });
async function init() {
  try {
    const responses = await Promise.all([fetch(base+'assets/camera-tour.json'), fetch(base+'assets/artworks.json'), fetch(base+'assets/artwork-notes.json'), fetch(base+'assets/stops.json')]);
    if (responses.some(r => !r.ok)) throw new Error('Gallery assets are missing. Run the Blender export first.');
    const [tourData, artworkData, notes, stopData] = await Promise.all(responses.map(r=>r.json()));
    tour = tourData; artworks = artworkData.map(art => ({ ...art, note: notes[art.id] }));
    viewingStops = stopData; arc = buildArc(tour);
    createIndex(); createCheckpoints(); setNavigationMode(freeRoam);
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
    const slots = new Map(artworks.map(art => [art.slot, art.id]));
    model.scene.traverse(object => { if (slots.has(object.name)) object.userData.artId = slots.get(object.name); });
    scene.add(model.scene); ready = true; resize(); syncScroll(0); connectArtworkPicking();
    $('toggle-roam').disabled = false;
    loading.classList.add('loaded');
    requestAnimationFrame(tick);
  } catch (error) { console.error(error); showFallback(error.message); }
}
init();

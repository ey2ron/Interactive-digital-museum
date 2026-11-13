import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { buildArc, sampleStops, scrollProgress, clamp01, nearestStop, checkpointProgress } from './tour.js';
import { createNavigation, createPortraitFlight, smoothTravel, nearestViewingStop } from './navigation.js';
import { createFreeRoam } from './free-roam.js';
import { connectJoystick } from './joystick.js';
import { createCollectionPlayback } from './collection-playback.js';
import { createBackgroundMusic } from './background-music.js';
import { connectSwipe } from './swipe.js';

const $ = id => document.getElementById(id);
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const mobile = matchMedia('(max-width: 760px), (pointer: coarse)').matches;
const touchLayout = matchMedia('(pointer: coarse)');
const portraitLayout = matchMedia('(orientation: portrait)');
const compactLayout = matchMedia('(max-width: 1024px), (pointer: coarse) and (max-width: 1366px)');
const base = new URL('.', document.baseURI).pathname;
const music = createBackgroundMusic({ buttons: [...document.querySelectorAll('[data-music-toggle]')], statuses: [...document.querySelectorAll('[data-music-status]')], url: base+'assets/audio/first-light-particles-loop.mp3' });
music.setReady();
let tour, artworks = [], collectionArtworks = [], detailArtworks = [], renderer, camera, scene, ready = false, current = 0, desired = 0;
const collectionPlayback = createCollectionPlayback({ root: $('collection'), toggle: $('toggle-collection-motion'), status: $('collection-motion-status'), reducedMotion: reduced });
let lastTime = performance.now(), lastDrawn = -1, lastCaption = '', resizePending = true;
const position = new THREE.Vector3(), quaternion = new THREE.Quaternion();
const loading = $('loading');
let stops = [], viewingStops = [], arc, checkpointStops = [], checkpointIndices = [], checkpoints = [], activeStop = 0, transition = null;
let visibleCheckpoint = -1;
let lastWheel = -Infinity, settleTimer, expectedScroll = null;
let freeRoam = false, captionArt = null, detailIndex = -1, detailOrigin = 'index', indexScroll = 0;
let detailTrigger = null, pointerStart = null;
let viewAnimations = [];
let dismissing = false;
let resumeRoamLook = false;
let navigation, walker, joystick;
const raycaster = new THREE.Raycaster(), pointer = new THREE.Vector2();
function setNavigationMode(free, returnToNearest = true) {
  if (free && (!ready || (touchLayout.matches && portraitLayout.matches))) return;
  const wasFree = freeRoam;
  freeRoam = !!free;
  resizePending = true;
  clearTimeout(settleTimer); transition = null; desired = current;
  activeStop = ready && wasFree ? nearestViewingStop(viewingStops, camera.position) : nearestStop(stops, current);
  walker?.setActive(freeRoam);
  document.body.classList.toggle('free-roam', freeRoam);
  $('roam-help').hidden = !freeRoam;
  if (ready) syncScroll(current);
  lastWheel = -Infinity;
  $('toggle-roam').setAttribute('aria-pressed', String(freeRoam));
  $('toggle-roam').title = freeRoam ? 'Return to the nearest portrait view' : 'Explore with WASD and mouse look';
  $('gallery-status').textContent = freeRoam
    ? 'Free roam on. WASD to move, mouse or drag to look. Escape returns to the nearest portrait.'
    : 'Guided mode on. Scroll once to move to the next portrait.';
  updateCheckpoints(); lastDrawn = -1;
  if (wasFree && !freeRoam && returnToNearest) goToStop(activeStop);
}
$('toggle-roam').addEventListener('click', () => {
  setNavigationMode(!freeRoam);
  if (freeRoam && !touchLayout.matches) walker.requestLook();
});
function updateRoamAvailability() {
  const portraitPhone = touchLayout.matches && portraitLayout.matches;
  $('toggle-roam').hidden = portraitPhone || reduced || document.body.classList.contains('fallback-mode');
  if (portraitPhone && freeRoam) setNavigationMode(false);
}
touchLayout.addEventListener('change', updateRoamAvailability);
portraitLayout.addEventListener('change', updateRoamAvailability);
updateRoamAvailability();
$('resume-roam').addEventListener('click', () => walker?.requestLook());
$('exit-roam').addEventListener('click', () => setNavigationMode(false));

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
  if (freeRoam) setNavigationMode(false, false);
  clearTimeout(settleTimer);
  activeStop = Math.max(0, Math.min(stops.length - 1, index));
  const target = stops[activeStop];
  const destination = viewingStops[activeStop];
  const path = navigation.findPath(camera.position, new THREE.Vector3(...destination.position));
  if (!path) {
    $('gallery-status').textContent = 'That viewing position cannot be reached from here. Please select another checkpoint.';
    return;
  }
  const flight = createPortraitFlight(path, camera.quaternion, new THREE.Quaternion(...destination.quaternion));
  transition = flight.length < .00001 && flight.angle < .00001 ? null :
    { from: current, to: target, start: performance.now(), duration: flight.duration, flight };
  desired = target;
  lastDrawn = -1;
  updateCheckpoints();
  updateCaption();
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
  const total = $('progress-total');
  if (total) total.textContent = String(artworks.length).padStart(2, '0');
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
  if (freeRoam && !$('collection').open && !event.ctrlKey) { event.preventDefault(); return; }
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
connectSwipe(document, {
  enabled: () => ready && !reduced && !freeRoam && !$('collection').open,
  ignore: target => !!target.closest?.('header, footer, button, a, #roam-help') || scrollingCaption(target),
  onSwipe: direction => { if (!transition) moveOneStop(direction); }
});
connectSwipe($('detail-media'), {
  enabled: () => $('collection').open && detailIndex >= 0 && !dismissing,
  horizontalOnly: true,
  onSwipe: browseArtwork
});
addEventListener('scroll', () => {
  if (!ready || reduced || transition || Math.abs(scrollY - expectedScroll) < 2) return;
  if (freeRoam) { syncScroll(current); return; }
  desired = scrollProgress(scrollY, 0, document.documentElement.scrollHeight - innerHeight);
  activeStop = nearestStop(stops, desired);
  updateCheckpoints();
  clearTimeout(settleTimer);
  if (!freeRoam) settleTimer = setTimeout(() => goToStop(activeStop), 180);
}, { passive: true });

function openCollection() {
  if (!$('collection').open) resumeRoamLook = freeRoam && !!walker?.locked;
  walker?.release();
  closeArtwork(false);
  if (!$('collection').open) {
    clearTimeout(settleTimer); transition = null; desired = current;
    syncScroll(current);
    document.body.classList.add('collection-open');
    $('collection').showModal();
    collectionPlayback.setActive(true);
    animateIndex();
  }
}
for (const id of ['open-collection', 'fallback-collection']) $(id).addEventListener('click', openCollection);
$('close-collection').addEventListener('click', () => dismissView());
$('collection').addEventListener('click', event => {
  if (event.target.closest('button, a, .collection-head, .detail-copy, .detail-toolbar, .collection-note, .credits, #art-grid article, #artist-about')) return;
  if (detailIndex >= 0) {
    const rect = imageRect($('detail-image'), detailArtworks[detailIndex]);
    if (event.clientX >= rect.x && event.clientX <= rect.x + rect.width &&
        event.clientY >= rect.y && event.clientY <= rect.y + rect.height) return;
  }
  dismissView();
});
$('collection').addEventListener('close', () => {
  collectionPlayback.setActive(false);
  dismissing = false;
  $('collection').classList.remove('view-exiting', 'closing-overlay');
  stopViewAnimations();
  document.body.classList.remove('collection-open');
  detailIndex = -1; lastWheel = -Infinity;
  if (ready) syncScroll(current);
  const resume = resumeRoamLook;
  resumeRoamLook = false;
  if (resume && freeRoam && !touchLayout.matches) walker?.requestLook();
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
  walker?.setActive(false);
  freeRoam = false; document.body.classList.remove('free-roam'); $('roam-help').hidden = true;
  ready = false; transition = null; clearTimeout(settleTimer);
  $('toggle-roam').hidden = true;
  const loadingMessage = $('loading-message');
  if (loadingMessage) loadingMessage.textContent = message;
  loading.classList.remove('loading-exiting');
  finishLoading();
  $('fallback').hidden = false;
  document.body.classList.add('fallback-mode');
  if (reduced) openCollection();
}
function createIndex() {
  for (const art of collectionArtworks) {
    const article = document.createElement('article');
    const view = document.createElement('a'); view.className = 'artwork-card-media';
    view.href = art.source; view.target = '_blank'; view.rel = 'noopener noreferrer';
    view.dataset.artId = art.id;
    view.setAttribute('aria-label', `Watch ${art.title} on Waneella’s YouTube channel (opens in a new tab)`);
    const image = document.createElement('img');
    image.src = base + art.thumbnail; image.alt = art.note.alt; image.loading = 'lazy';
    [image.width, image.height] = art.pixels;
    image.decoding = 'async';
    const video = document.createElement('video');
    video.muted = true; video.defaultMuted = true; video.loop = true; video.playsInline = true;
    video.preload = 'none'; video.hidden = true; video.disablePictureInPicture = true;
    video.setAttribute('aria-hidden', 'true'); video.tabIndex = -1;
    video.poster = base + art.thumbnail;
    [video.width, video.height] = art.pixels;
    const copy = document.createElement('div'); copy.className = 'artwork-card-copy';
    const title = document.createElement('h3');
    const titleLink = document.createElement('a'); titleLink.className = 'artwork-card-title'; titleLink.textContent = art.title;
    titleLink.href = art.source; titleLink.target = '_blank'; titleLink.rel = 'noopener noreferrer';
    title.append(titleLink);
    const artist = document.createElement('p'); artist.className = 'artwork-card-artist'; artist.textContent = 'Waneella · Animated pixel art';
    const description = document.createElement('p'); description.className = 'artwork-card-description'; description.textContent = art.note.description;
    const source = document.createElement('a'); source.href = art.source; source.target = '_blank'; source.rel = 'noopener noreferrer'; source.textContent = 'Watch the full film on YouTube ';
    const arrow = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    arrow.setAttribute('class', 'direction-arrow'); arrow.setAttribute('viewBox', '0 0 16 16');
    arrow.setAttribute('aria-hidden', 'true'); arrow.setAttribute('focusable', 'false');
    const arrowPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    arrowPath.setAttribute('d', 'M3 13 13 3M3 3h10v10'); arrow.append(arrowPath); source.append(arrow);
    copy.append(title, artist, description, source);
    view.append(image, video);
    article.append(view, copy); $('art-grid').append(article);
    collectionPlayback.add(video, base + art.preview, view);
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
  const art = detailArtworks[detailIndex];
  $('detail-image').src = base + art.thumbnail;
  $('detail-image').alt = art.note.alt;
  $('detail-title').textContent = art.title;
  $('detail-number').textContent = '';
  $('detail-description').textContent = art.note.description;
  $('detail-credit').textContent = art.note.credit;
  $('detail-note-source').hidden = !art.note.source;
  if (art.note.source) $('detail-note-source').href = art.note.source;
  else $('detail-note-source').removeAttribute('href');
  $('detail-source').href = art.source;
  $('previous-artwork').disabled = detailIndex === 0;
  $('next-artwork').disabled = detailIndex === detailArtworks.length - 1;
  $('detail-status').textContent = art.title;
  animateArtwork(art, sourceRect);
}
function openArtwork(art, origin = 'tour', trigger = $('view-current-art')) {
  if (dismissing) return;
  const thumbnail = origin === 'index' ? trigger?.querySelector('img') : null;
  const sourceRect = thumbnail ? imageRect(thumbnail, art) : portraitRect(art);
  if (origin === 'index') indexScroll = $('collection').scrollTop;
  else openCollection();
  detailOrigin = origin; detailTrigger = trigger;
  detailArtworks = origin === 'index' ? collectionArtworks : artworks;
  detailIndex = detailArtworks.indexOf(art);
  collectionPlayback.setActive(false);
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
  collectionPlayback.setActive($('collection').open);
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
  if (index < 0 || index >= detailArtworks.length) return;
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
    if (freeRoam) return;
    if (!event.isPrimary) { pointerStart = null; return; }
    if (event.isPrimary && event.button === 0) pointerStart = { x: event.clientX, y: event.clientY, dragged: false };
  });
  renderer.domElement.addEventListener('pointermove', event => {
    if (freeRoam) return;
    if (pointerStart && Math.hypot(event.clientX - pointerStart.x, event.clientY - pointerStart.y) > 8) pointerStart.dragged = true;
    if (event.pointerType === 'mouse') renderer.domElement.style.cursor = artworkAt(event.clientX, event.clientY) ? 'pointer' : '';
  });
  renderer.domElement.addEventListener('pointerup', event => {
    if (freeRoam) return;
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
  // Leave room below the painting for the phone/tablet caption in guided mode.
  if (compactLayout.matches && portraitLayout.matches && !freeRoam) {
    camera.setViewOffset(width, height, 0, height * .1, width, height);
  } else if (compactLayout.matches && height <= 650 && !freeRoam) {
    // Short landscape screens need space for both the header and checkpoint bar.
    camera.fov = THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2) * 1.5));
    camera.setViewOffset(width, height, 0, height * .04, width, height);
  } else camera.clearViewOffset();
  camera.updateProjectionMatrix(); resizePending = false;
}
function updateCaption() {
  // The centre of the view must actually hit the painting, with no wall in between.
  const focusY = camera.view?.enabled ? 2 * camera.view.offsetY / camera.view.fullHeight : 0;
  raycaster.setFromCamera(new THREE.Vector2(0, focusY), camera);
  const hit = raycaster.intersectObjects(scene.children, true)[0];
  let chosen = !transition && hit?.distance < 8 ? artFromHit(hit) : null;
  if (chosen && !freeRoam) {
    const stop = current * (viewingStops.length - 1), index = Math.round(stop);
    if (index === 0 || Math.abs(stop - index) >= .002 || viewingStops[index].id !== chosen.id) chosen = null;
  }
  const key = chosen?.id || '';
  if (key !== lastCaption) {
    lastCaption = key;
    captionArt = chosen;
    $('art-caption').classList.toggle('visible', !!chosen);
    $('art-caption').inert = !chosen;
    if (chosen) {
      $('art-title').textContent = chosen.title;
      $('art-description').textContent = chosen.note.description;
      $('view-current-art').setAttribute('aria-label', `View ${chosen.title} and its details`);
    }
  }
}
/** Public local controller for previews and deterministic comparison with Blender. */
function setProgress(progress) {
  if (!ready) return;
  if (freeRoam) setNavigationMode(false, false);
  clearTimeout(settleTimer); transition = null;
  current = desired = clamp01(progress);
  activeStop = nearestStop(stops, current); updateCheckpoints();
  syncScroll(current);
  sampleStops(tour, arc, viewingStops, current * (viewingStops.length - 1), position, quaternion);
  camera.position.copy(position); camera.quaternion.copy(quaternion);
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
    current = transition.from + (transition.to - transition.from) * smoothTravel(elapsed);
    transition.flight.sample(elapsed, position, quaternion);
    camera.position.copy(position); camera.quaternion.copy(quaternion);
    syncScroll(current);
    if (elapsed === 1) {
      current = desired = transition.to; transition = null;
      lastDrawn = -1; // Settled captions/ending must update even if the pose already rounded to its target.
      updateCheckpoints();
    }
  } else if (freeRoam) {
    if (walker.update(dt)) lastDrawn = -1;
    activeStop = nearestViewingStop(viewingStops, camera.position);
    current = desired = stops[activeStop];
  } else current += (desired-current) * (1-Math.exp(-dt/0.12));
  if (!transition && Math.abs(desired-current) < .000003) current = desired;
  // Returning from free roam can move the camera while its checkpoint stays unchanged.
  if (!transition && Math.abs(current-lastDrawn) < .0000001 && !resizePending) return;
  if (resizePending) resize();
  renderer.render(scene, camera); lastDrawn = current;
  const stopCoordinate = current * (viewingStops.length - 1);
  $('intro').style.opacity = String(1-clamp01(stopCoordinate/.6));
  $('intro').style.visibility = freeRoam || stopCoordinate > .65 ? 'hidden' : 'visible';
  $('ending').classList.toggle('visible', !freeRoam && !transition && current === 1);
  const barProgress = checkpointProgress(checkpointStops, current);
  $('progress-fill').style.transform = `scaleX(${barProgress})`;
  const artworkCount = artworks.length || 16;
  const currentArt = Math.min(artworkCount, Math.max(1, Math.round(barProgress * artworkCount)));
  $('progress-label').textContent = String(currentArt).padStart(2, '0');
  updateCheckpoints();
  $('scroll-hint').textContent = freeRoam ? (touchLayout.matches ? 'JOYSTICK TO MOVE / DRAG RIGHT TO LOOK' : 'WASD TO MOVE / MOUSE TO LOOK / ESC TO RETURN / E TO VIEW ARTWORK') : compactLayout.matches || touchLayout.matches ? 'SWIPE TO EXPLORE · LEFT / RIGHT' : current < .02 ? 'SCROLL TO EXPLORE' : 'SCROLL TO NEXT VIEW';
  updateCaption();
}
addEventListener('resize', () => { resizePending = true; if (ready) syncScroll(current); });
function finishLoading() {
  loading.classList.add('loaded');
  loading.setAttribute('aria-hidden', 'true');
  loading.setAttribute('inert', '');
}
function dismissLoading() {
  if (reduced) {
    finishLoading();
    return;
  }
  setTimeout(() => {
    loading.classList.add('loading-exiting');
    setTimeout(() => {
      finishLoading();
    }, 450);
  }, 250);
}

async function init() {
  try {
    const responses = await Promise.all([fetch(base+'assets/camera-tour.json'), fetch(base+'assets/artworks.json'), fetch(base+'assets/artwork-notes.json'), fetch(base+'assets/stops.json'), fetch(base+'assets/navigation.json'), fetch(base+'assets/collection-artworks.json')]);
    if (responses.some(r => !r.ok)) throw new Error('Gallery assets are missing. Run the Blender export first.');
    const [tourData, artworkData, notes, stopData, navigationData, collectionData] = await Promise.all(responses.map(r=>r.json()));
    tour = tourData; artworks = artworkData.map(art => ({ ...art, note: notes[art.id] }));
    collectionArtworks = collectionData;
    viewingStops = stopData; arc = buildArc(tour);
    navigation = createNavigation(navigationData);
    createIndex(); createCheckpoints(); setNavigationMode(freeRoam);
    if (reduced) return showFallback('Explore at your own pace');
    renderer = new THREE.WebGLRenderer({ antialias: !mobile, powerPreference: mobile ? 'low-power' : 'high-performance' });
    renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1;
    $('stage').append(renderer.domElement);
    renderer.domElement.addEventListener('webglcontextlost', event => { event.preventDefault(); showFallback('The 3D view was interrupted. The collection is still available.'); });
    scene = new THREE.Scene(); scene.background = new THREE.Color('#161b1b');
    camera = new THREE.PerspectiveCamera(tour.verticalFov, innerWidth/innerHeight, Math.max(.03,tour.clipNear), tour.clipFar);
    const loader = new GLTFLoader();
    const model = await loader.loadAsync(base+'assets/'+(mobile?'gallery-mobile.glb':'gallery.glb'));
    const slots = new Map(artworks.map(art => [art.slot, art.id]));
    model.scene.traverse(object => { if (slots.has(object.name)) object.userData.artId = slots.get(object.name); });
    scene.add(model.scene);
    // The separate emissive lettering stays sharp while the gallery uses baked light.
    if (!model.scene.getObjectByName('W_Gallery_Subtitle')) {
      const glow = await loader.loadAsync(base+'assets/gallery-text-glow.glb');
      scene.add(glow.scene);
    }
    const additions = await loader.loadAsync(base+'assets/gallery-additions.glb');
    scene.add(additions.scene);
    // Pre-warm WebGL shader programs and GPU textures to avoid first-frame camera hitching
    renderer.compile(scene, camera);
    ready = true; resize(); setProgress(0);
    walker = createFreeRoam(camera, renderer.domElement, navigation, {
      onExit: () => { if (freeRoam) setNavigationMode(false); },
      onPick: (x, y) => { const art = artworkAt(x, y); if (art) openArtwork(art); },
      onClear: () => joystick?.reset(),
      onLockChange: locked => {
        $('resume-roam').hidden = locked;
        $('roam-reticle').hidden = !locked;
      }
    });
    joystick = connectJoystick($('roam-joystick'), (x, z) => walker.setMoveAxis(x, z));
    connectArtworkPicking();
    $('toggle-roam').disabled = false;
    requestAnimationFrame(tick);
    dismissLoading();
  } catch (error) {
    console.error(error);
    showFallback(error.message);
  }
}
init();

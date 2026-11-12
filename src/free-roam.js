import { Euler, Vector3 } from 'three';

/** First-person floor movement, with pointer-lock mouse look and drag fallback. */
export function createFreeRoam(camera, canvas, navigation, { onExit, onPick, onLockChange, onClear }) {
  let active = false, locked = false, drag = null, dirty = false;
  const keys = new Set(), velocity = new Vector3(), delta = new Vector3(), up = new Vector3(0, 1, 0);
  const look = new Euler(0, 0, 0, 'YXZ');
  const moveAxis = { x: 0, z: 0 };
  const isControl = target => target.closest?.('button, a, input, textarea, select, [contenteditable], dialog');
  const clear = () => { keys.clear(); velocity.set(0, 0, 0); moveAxis.x = moveAxis.z = 0; drag = null; onClear?.(); };
  function rotate(x, y) {
    look.y -= x * .002;
    look.x = Math.max(-Math.PI * .47, Math.min(Math.PI * .47, look.x - y * .002));
    camera.quaternion.setFromEuler(look); dirty = true;
  }
  function release() {
    locked = false;
    if (document.pointerLockElement === canvas) document.exitPointerLock();
    clear(); onLockChange(false);
  }
  function requestLook() {
    if (!active || document.querySelector('dialog[open]')) return;
    canvas.focus({ preventScroll: true });
    try { canvas.requestPointerLock?.()?.catch(() => onLockChange(false)); }
    catch { onLockChange(false); }
  }
  canvas.tabIndex = 0;
  canvas.setAttribute('aria-label', 'Gallery view. In free roam, use WASD to move, mouse or drag to look, and Escape to return.');
  document.addEventListener('pointerlockchange', () => {
    const wasLocked = locked;
    locked = document.pointerLockElement === canvas;
    if (!active && locked) { release(); return; }
    onLockChange(locked);
    if (active && wasLocked && !locked) onExit();
  });
  document.addEventListener('pointerlockerror', () => onLockChange(false));
  document.addEventListener('mousemove', event => {
    if (active && locked) rotate(event.movementX, event.movementY);
  });
  addEventListener('keydown', event => {
    if (!active || document.querySelector('dialog[open]')) return;
    if (event.key === 'Escape') { event.preventDefault(); onExit(); return; }
    if (event.altKey || event.ctrlKey || event.metaKey || isControl(event.target)) return;
    if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.code)) {
      event.preventDefault(); keys.add(event.code);
    }
    if (event.code === 'KeyE' && !event.repeat) { event.preventDefault(); onPick(innerWidth / 2, innerHeight / 2); }
  });
  addEventListener('keyup', event => keys.delete(event.code));
  addEventListener('blur', clear);
  document.addEventListener('visibilitychange', clear);
  canvas.addEventListener('pointerdown', event => {
    if (!active || drag || (!event.isPrimary && event.pointerType !== 'touch') || event.button !== 0) return;
    canvas.focus({ preventScroll: true });
    const touch = event.pointerType === 'touch';
    drag = { id: event.pointerId, x: event.clientX, y: event.clientY, moved: 0, touch, canLook: !touch || event.clientX >= innerWidth * .45 };
    // Pointer lock already owns mouse input; browsers reject pointer capture there.
    if (!locked) canvas.setPointerCapture(event.pointerId);
  });
  canvas.addEventListener('pointermove', event => {
    if (!active || locked || !drag || drag.id !== event.pointerId) return;
    const x = event.clientX - drag.x, y = event.clientY - drag.y;
    drag.moved += Math.hypot(x, y); drag.x = event.clientX; drag.y = event.clientY;
    if (drag.canLook) rotate(x, y);
  });
  canvas.addEventListener('pointerup', event => {
    if (!active || !drag || drag.id !== event.pointerId) return;
    const start = drag; drag = null;
    if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
    if (start.moved > 8) return;
    if (locked) onPick(innerWidth / 2, innerHeight / 2);
    else if (start.touch) onPick(event.clientX, event.clientY);
    else requestLook();
  });
  canvas.addEventListener('pointercancel', event => { if (drag?.id === event.pointerId) drag = null; });
  return {
    requestLook, release, clear,
    get locked() { return locked && document.pointerLockElement === canvas; },
    setActive(value) {
      active = value; clear(); dirty = true;
      if (active) { look.setFromQuaternion(camera.quaternion, 'YXZ'); look.z = 0; canvas.focus({ preventScroll: true }); }
      else release();
    },
    setMoveAxis(x, z) { moveAxis.x = x; moveAxis.z = z; },
    update(dt) {
      if (!active) return false;
      const x = Number(keys.has('KeyD') || keys.has('ArrowRight')) - Number(keys.has('KeyA') || keys.has('ArrowLeft'));
      const z = Number(keys.has('KeyS') || keys.has('ArrowDown')) - Number(keys.has('KeyW') || keys.has('ArrowUp'));
      delta.set(x + moveAxis.x, 0, z + moveAxis.z);
      if (delta.lengthSq() > 1) delta.normalize();
      delta.applyAxisAngle(up, look.y).multiplyScalar(2.4);
      velocity.lerp(delta, 1 - Math.exp(-dt / .09));
      if (velocity.lengthSq() < .000001) velocity.set(0, 0, 0);
      const next = navigation.move(camera.position, delta.copy(velocity).multiplyScalar(dt));
      const changed = dirty || next.distanceToSquared(camera.position) > 0;
      camera.position.copy(next); dirty = false;
      return changed;
    }
  };
}

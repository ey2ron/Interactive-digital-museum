// Keep native scrolling and pinch zoom unless this surface owns the gesture.
export function connectSwipe(element, { enabled, onSwipe, horizontalOnly = false, ignore = () => false }) {
  let start = null, suppressClickUntil = 0;
  element.addEventListener('touchstart', event => {
    start = event.touches.length === 1 && enabled() && !ignore(event.target)
      ? { x: event.touches[0].clientX, y: event.touches[0].clientY } : null;
  }, { passive: true });
  element.addEventListener('touchmove', event => {
    if (!start) return;
    if (event.touches.length !== 1 || !enabled()) { start = null; return; }
    const dx = start.x - event.touches[0].clientX;
    const dy = start.y - event.touches[0].clientY;
    if (horizontalOnly && Math.abs(dy) > Math.max(10, Math.abs(dx))) { start = null; return; }
    if (Math.max(Math.abs(dx), Math.abs(dy)) > 10 && event.cancelable) event.preventDefault();
  }, { passive: false });
  element.addEventListener('touchend', event => {
    const origin = start; start = null;
    if (!origin || event.touches.length || !enabled() || !event.changedTouches.length) return;
    const dx = origin.x - event.changedTouches[0].clientX;
    const dy = origin.y - event.changedTouches[0].clientY;
    const horizontal = Math.abs(dx) > Math.abs(dy) * 1.2;
    const vertical = Math.abs(dy) > Math.abs(dx) * 1.2;
    if ((!horizontal && (horizontalOnly || !vertical)) || Math.max(Math.abs(dx), Math.abs(dy)) < 40) return;
    suppressClickUntil = performance.now() + 400;
    onSwipe(Math.sign(horizontal ? dx : dy));
  }, { passive: true });
  element.addEventListener('touchcancel', () => { start = null; }, { passive: true });
  element.addEventListener('click', event => {
    if (performance.now() < suppressClickUntil) { event.preventDefault(); event.stopPropagation(); }
  }, { capture: true });
}

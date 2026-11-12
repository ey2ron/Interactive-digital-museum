/** Radial dead zone and bounded analogue speed, including diagonal movement. */
export function joystickAxes(dx, dy, radius) {
  const distance = Math.hypot(dx, dy), amount = Math.min(1, distance / radius);
  const speed = Math.max(0, (amount - .12) / .88);
  return { x: distance ? dx / distance * speed : 0, z: distance ? dy / distance * speed : 0,
    thumbX: distance ? dx / distance * amount * radius : 0,
    thumbY: distance ? dy / distance * amount * radius : 0 };
}

export function connectJoystick(element, onMove) {
  let pointerId = null;
  const reset = () => {
    const previous = pointerId; pointerId = null;
    element.classList.remove('engaged');
    element.style.setProperty('--stick-x', '0px'); element.style.setProperty('--stick-y', '0px');
    onMove(0, 0);
    if (previous !== null && element.hasPointerCapture(previous)) element.releasePointerCapture(previous);
  };
  function move(event) {
    const rect = element.getBoundingClientRect();
    const axes = joystickAxes(event.clientX - rect.left - rect.width / 2, event.clientY - rect.top - rect.height / 2, rect.width * .32);
    element.style.setProperty('--stick-x', `${axes.thumbX}px`); element.style.setProperty('--stick-y', `${axes.thumbY}px`);
    onMove(axes.x, axes.z);
  }
  element.addEventListener('pointerdown', event => {
    if (pointerId !== null || event.button !== 0) return;
    event.preventDefault(); event.stopPropagation();
    pointerId = event.pointerId; element.setPointerCapture(pointerId);
    element.classList.add('engaged'); move(event);
  });
  element.addEventListener('pointermove', event => { if (event.pointerId === pointerId) { event.preventDefault(); move(event); } });
  for (const name of ['pointerup', 'pointercancel', 'lostpointercapture']) {
    element.addEventListener(name, event => { if (event.pointerId === pointerId) reset(); });
  }
  return { reset };
}

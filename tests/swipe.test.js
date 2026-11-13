import test from 'node:test';
import assert from 'node:assert/strict';
import { connectSwipe } from '../src/swipe.js';

function surface(options = {}) {
  const element = new EventTarget(), directions = [];
  connectSwipe(element, { enabled: () => true, onSwipe: direction => directions.push(direction), ...options });
  const send = (type, x, y, count = 1) => {
    const point = { clientX: x, clientY: y };
    const event = new Event(type, { cancelable: true });
    event.touches = type === 'touchend' ? [] : Array(count).fill(point);
    event.changedTouches = [point];
    element.dispatchEvent(event);
    return event;
  };
  return { directions, send };
}

test('tour swipes advance left/up and go back right/down; taps and diagonals do not navigate', () => {
  const { directions, send } = surface();
  for (const [x, y] of [[20, 100], [180, 100], [100, 20], [100, 180], [98, 100], [40, 40]]) {
    send('touchstart', 100, 100); send('touchmove', x, y); send('touchend', x, y);
  }
  assert.deepEqual(directions, [1, -1, 1, -1]);
});

test('detail swipes leave vertical scrolling native and only browse horizontally', () => {
  const { directions, send } = surface({ horizontalOnly: true });
  send('touchstart', 100, 100);
  assert.equal(send('touchmove', 100, 30).defaultPrevented, false);
  send('touchend', 100, 30);
  send('touchstart', 100, 100);
  assert.equal(send('touchmove', 20, 100).defaultPrevented, true);
  send('touchend', 20, 100);
  assert.deepEqual(directions, [1]);
  assert.equal(send('click').defaultPrevented, true, 'swiping cannot click through and dismiss the detail');
});

test('pinching, cancellation, disabled surfaces and ignored controls never navigate', () => {
  for (const options of [{}, { enabled: () => false }, { ignore: () => true }]) {
    const { directions, send } = surface(options);
    send('touchstart', 100, 100); send('touchmove', 20, 100, 2); send('touchend', 20, 100);
    send('touchstart', 100, 100); send('touchcancel', 20, 100); send('touchend', 20, 100);
    send('touchstart', 100, 100, 2); send('touchend', 20, 100);
    assert.deepEqual(directions, []);
  }
});

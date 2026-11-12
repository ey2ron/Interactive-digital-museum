import test from 'node:test';
import assert from 'node:assert/strict';
import { joystickAxes } from '../src/joystick.js';

test('resting thumb and small touch jitter do not move the visitor', () => {
  for (const [x, y] of [[0, 0], [2, -2], [-3, 0]]) {
    const axes = joystickAxes(x, y, 35);
    assert.equal(Math.hypot(axes.x, axes.z), 0);
  }
});

test('joystick offers slow movement and clamps diagonal and out-of-bounds gestures', () => {
  const slow = joystickAxes(0, -12, 35), fast = joystickAxes(0, -35, 35);
  assert.ok(slow.z < 0 && Math.abs(slow.z) < Math.abs(fast.z));
  for (const [x, y] of [[350, 0], [0, -350], [350, 350]]) {
    const axes = joystickAxes(x, y, 35);
    assert.ok(Math.abs(Math.hypot(axes.x, axes.z) - 1) < 1e-10, 'no diagonal speed boost');
    assert.ok(Math.hypot(axes.thumbX, axes.thumbY) <= 35 + 1e-10, 'thumb stays inside its ring');
  }
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { Window } from 'happy-dom';
import { Vector2 } from 'three';
import { bindWorldInput, bindTouchMovement, renderProfile } from '../src/input.js';

function environment() {
  const window = new Window(), previous = { window: globalThis.window, document: globalThis.document };
  globalThis.window = window; globalThis.document = window.document;
  return { window, restore() { for (const [key, value] of Object.entries(previous)) { if (value === undefined) delete globalThis[key]; else globalThis[key] = value; } window.happyDOM.abort(); } };
}
function pointer(window, element, type, id, x = 50, y = 50) {
  element.dispatchEvent(new window.PointerEvent(type, { pointerId: id, pointerType: 'touch', clientX: x, clientY: y, bubbles: true, cancelable: true }));
}
test('touch tap, drag, pinch, and cancellation stay distinct and use canvas coordinates', () => {
  const { window, restore } = environment();
  try {
    const canvas = window.document.createElement('canvas'); canvas.setPointerCapture = () => {};
    canvas.getBoundingClientRect = () => ({ left: 10, top: 20, width: 200, height: 400 });
    let walked = 0;
    const world = { renderer: { domElement: canvas }, paused: false, keys: new Set(), yaw: 0, distance: 30, pointer: new Vector2(), city: { children: [] },
      ray: { setFromCamera() {}, intersectObjects: () => [], ray: { intersectPlane: (p, target) => target.set(1, 0, 1) } },
      walkTo() { walked++; }, onMove() {}, resetCamera() {},
    };
    bindWorldInput(world);
    pointer(window, canvas, 'pointerdown', 1, 110, 220); pointer(window, canvas, 'pointerup', 1, 110, 220);
    assert.equal(walked, 1); assert.deepEqual(world.pointer.toArray(), [0, 0]);
    pointer(window, canvas, 'pointerdown', 2, 80, 100); pointer(window, canvas, 'pointermove', 2, 120, 100); pointer(window, canvas, 'pointerup', 2, 120, 100);
    assert.notEqual(world.yaw, 0); assert.equal(walked, 1, 'camera drag cannot also walk');
    const yaw = world.yaw;
    pointer(window, canvas, 'pointerdown', 3, 50, 100); pointer(window, canvas, 'pointerdown', 4, 150, 100);
    pointer(window, canvas, 'pointermove', 4, 250, 100); assert.equal(world.distance, 15); assert.equal(world.yaw, yaw);
    pointer(window, canvas, 'pointerup', 4, 250, 100); pointer(window, canvas, 'pointerup', 3, 50, 100);
    assert.equal(walked, 1, 'lifting pinch fingers cannot trigger a walk');
    pointer(window, canvas, 'pointerdown', 5); pointer(window, canvas, 'pointercancel', 5); pointer(window, canvas, 'pointerup', 5);
    assert.equal(walked, 1);
    world.paused = true; pointer(window, canvas, 'pointerdown', 6); pointer(window, canvas, 'pointerup', 6); assert.equal(walked, 1);
    world.keys.add('w'); window.dispatchEvent(new window.Event('blur')); assert.equal(world.keys.size, 0);
  } finally { restore(); }
});
test('multi-touch movement supports diagonals, releases outside the button, and stops on background', () => {
  const { window, restore } = environment();
  try {
    const buttons = ['up', 'right'].map(direction => { const button = window.document.createElement('button'); button.dataset.direction = direction; button.setPointerCapture = () => {}; return button; });
    const world = { keys: new Set() }; let canMove = true;
    bindTouchMovement(buttons, world, () => canMove);
    pointer(window, buttons[0], 'pointerdown', 1); pointer(window, buttons[1], 'pointerdown', 2);
    assert.deepEqual([...world.keys].sort(), ['d', 'w']);
    pointer(window, buttons[0], 'lostpointercapture', 1); assert.deepEqual([...world.keys], ['d']);
    window.document.dispatchEvent(new window.Event('visibilitychange')); assert.equal(world.keys.size, 0); assert.equal(buttons[1].classList.contains('held'), false);
    canMove = false; pointer(window, buttons[0], 'pointerdown', 3); assert.equal(world.keys.size, 0);
  } finally { restore(); }
});
test('phone rendering budget remains low after rotating into landscape', () => {
  for (const width of [320, 390, 667, 844, 1024]) {
    const p = renderProfile(width, true, 3); assert.equal(p.pixelRatio, 1.25); assert.equal(p.shadows, false); assert.equal(p.mobile, true); assert.ok(p.frameInterval >= 33);
  }
  assert.equal(renderProfile(390, false, 2).mobile, true);
  assert.equal(renderProfile(1440, false, 2).pixelRatio, 1.75);
  assert.equal(renderProfile(1440, false, 2).shadows, true);
});

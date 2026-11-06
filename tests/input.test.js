import test from 'node:test';
import assert from 'node:assert/strict';
import { Window } from 'happy-dom';
import { Vector2 } from 'three';
import { bindWorldInput, bindVirtualStick, renderProfile } from '../src/input.js';

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
test('round stick supports analogue 360-degree movement, dead zone and clamping', () => {
  const { window, restore } = environment();
  try {
    const base = window.document.createElement('div'), thumb = window.document.createElement('span');
    base.setPointerCapture = () => {}; base.getBoundingClientRect = () => ({ left: 10, top: 20, width: 140, height: 140 });
    thumb.getBoundingClientRect = () => ({ width: 60 });
    const world = { destination: { x: 1 }, marker: { visible: true } };
    bindVirtualStick(base, thumb, world, () => true);
    pointer(window, base, 'pointerdown', 1, 80, 90);
    assert.equal(world.stick.x, 0); assert.equal(world.stick.y, 0); assert.equal(world.destination, null);
    assert.equal(world.marker.visible, false);
    pointer(window, base, 'pointermove', 1, 83, 90); assert.equal(world.stick.x, 0, 'tiny thumb movement stays inside the dead zone');
    pointer(window, base, 'pointermove', 1, 100, 90);
    assert.ok(world.stick.x > .4 && world.stick.x < .5, 'half displacement gives a slow walk');
    pointer(window, base, 'pointermove', 1, 120, 90); assert.equal(world.stick.x, 1); assert.equal(world.stick.y, 0);
    pointer(window, base, 'pointermove', 1, 200, -30);
    assert.ok(world.stick.x > 0 && world.stick.y < 0);
    assert.ok(Math.abs(Math.hypot(world.stick.x, world.stick.y) - 1) < 1e-10, 'diagonal speed cannot exceed straight movement');
    const before = { ...world.stick };
    pointer(window, base, 'pointerdown', 2, 10, 10); pointer(window, base, 'pointerup', 2);
    assert.deepEqual(world.stick, before, 'another finger cannot take over or release the active stick');
    pointer(window, base, 'pointerup', 1, 200, -30);
    assert.deepEqual(world.stick, { x: 0, y: 0 }); assert.equal(base.classList.contains('active'), false);
    assert.equal(thumb.style.transform, 'translate3d(0px, 0px, 0)');
  } finally { restore(); }
});
test('stick stops on cancellation, lost capture, background, resize, and a gameplay pause', () => {
  const { window, restore } = environment();
  try {
    const base = window.document.createElement('div'), thumb = window.document.createElement('span');
    base.setPointerCapture = () => {}; base.getBoundingClientRect = () => ({ left: 0, top: 0, width: 140, height: 140 });
    thumb.getBoundingClientRect = () => ({ width: 60 });
    const world = { marker: { visible: false } }; let canMove = true;
    const reset = bindVirtualStick(base, thumb, world, () => canMove);
    const press = () => { pointer(window, base, 'pointerdown', 1, 110, 70); assert.equal(world.stick.x, 1); };
    for (const event of ['pointercancel', 'lostpointercapture']) { press(); pointer(window, base, event, 1); assert.equal(world.stick.x, 0); }
    for (const event of ['blur', 'resize']) { press(); window.dispatchEvent(new window.Event(event)); assert.equal(world.stick.x, 0); }
    press(); window.document.dispatchEvent(new window.Event('visibilitychange')); assert.equal(world.stick.x, 0);
    press(); canMove = false; pointer(window, base, 'pointermove', 1, 120, 70); assert.equal(world.stick.x, 0);
    pointer(window, base, 'pointerdown', 2, 120, 70); assert.equal(world.stick.x, 0);
    canMove = true; press(); reset(); assert.equal(world.stick.x, 0);
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

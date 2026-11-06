import * as THREE from 'three';
import { clamp } from './game.js';

// Every pointer owns its gesture; a pinch can never become a walking tap.
export function bindWorldInput(world) {
  const canvas = world.renderer.domElement, pointers = new Map();
  let pinchDistance = 0;
  const separation = () => { const [a, b] = [...pointers.values()]; return Math.hypot(a.x - b.x, a.y - b.y); };
  const reset = () => { pointers.clear(); pinchDistance = 0; world.keys.clear(); };
  canvas.addEventListener('pointerdown', e => {
    if (world.paused || (e.pointerType === 'mouse' && e.button !== 0)) return;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, startX: e.clientX, startY: e.clientY, moved: false });
    canvas.setPointerCapture(e.pointerId);
    if (pointers.size > 1) { pointers.forEach(p => p.moved = true); pinchDistance = separation(); }
  });
  canvas.addEventListener('pointermove', e => {
    const p = pointers.get(e.pointerId); if (!p) return;
    const dx = e.clientX - p.x; p.x = e.clientX; p.y = e.clientY;
    if (pointers.size > 1) {
      const distance = separation(); if (pinchDistance) world.distance = clamp(world.distance * pinchDistance / Math.max(1, distance), 15, 43);
      pinchDistance = distance; return;
    }
    if (Math.hypot(p.x - p.startX, p.y - p.startY) > (e.pointerType === 'touch' ? 12 : 6)) p.moved = true;
    if (p.moved && !world.paused) world.yaw -= dx * .007;
  });
  canvas.addEventListener('pointerup', e => {
    const p = pointers.get(e.pointerId); pointers.delete(e.pointerId); pinchDistance = 0;
    if (!p || p.moved || world.paused) return;
    const rect = canvas.getBoundingClientRect();
    world.pointer.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
    world.ray.setFromCamera(world.pointer, world.camera);
    const person = world.ray.intersectObjects(world.city.children, true).find(h => h.object.userData.npc);
    if (person) { world.onSelect(person.object.userData.npc); return; }
    const pos = new THREE.Vector3();
    if (world.ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), pos)) { world.walkTo(pos); world.onMove(); }
  });
  const cancel = e => { pointers.delete(e.pointerId); pinchDistance = 0; };
  canvas.addEventListener('pointercancel', cancel); canvas.addEventListener('lostpointercapture', cancel);
  canvas.addEventListener('contextmenu', e => e.preventDefault());
  canvas.addEventListener('wheel', e => { e.preventDefault(); world.distance = clamp(world.distance + e.deltaY * .025, 15, 43); }, { passive: false });
  window.addEventListener('keydown', e => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) e.preventDefault();
    if (!world.paused) world.keys.add(e.key.toLowerCase()); if (e.key.toLowerCase() === 'r') world.resetCamera();
  });
  window.addEventListener('keyup', e => world.keys.delete(e.key.toLowerCase()));
  window.addEventListener('blur', reset);
  document.addEventListener('visibilitychange', reset);
  return reset;
}

export function bindTouchMovement(buttons, world, canMove) {
  const held = new Map(), keyFor = { up: 'w', down: 's', left: 'a', right: 'd' };
  const reset = () => { held.forEach(key => world.keys.delete(key)); held.clear(); buttons.forEach(b => b.classList.remove('held')); };
  for (const button of buttons) {
    const key = keyFor[button.dataset.direction];
    button.addEventListener('pointerdown', e => {
      e.preventDefault(); if (!canMove()) return;
      held.set(e.pointerId, key); world.keys.add(key); button.classList.add('held'); button.setPointerCapture(e.pointerId);
    });
    const release = e => {
      held.delete(e.pointerId); if (![...held.values()].includes(key)) { world.keys.delete(key); button.classList.remove('held'); }
    };
    for (const event of ['pointerup', 'pointercancel', 'lostpointercapture']) button.addEventListener(event, release);
  }
  window.addEventListener('blur', reset); document.addEventListener('visibilitychange', reset);
  return reset;
}

export function renderProfile(width, coarse, dpr = 1) {
  const mobile = coarse || width <= 700;
  return { mobile, pixelRatio: Math.min(dpr, mobile ? 1.25 : 1.75), shadows: !mobile, frameInterval: mobile ? 1000 / 30 : 0 };
}

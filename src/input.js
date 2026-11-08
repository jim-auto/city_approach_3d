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
    const hits = world.ray.intersectObjects(world.city.children, true).filter(hit => {
      for (let node = hit.object; node; node = node.parent) if (node.visible === false) return false;
      return true;
    });
    const person = hits.find(h => h.object.userData.npc);
    if (person && !hits.some(h => !h.object.userData.npc && h.distance < person.distance - .1 && h.point?.y > .5)) { world.onSelect(person.object.userData.npc); return; }
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

export function bindVirtualStick(base, thumb, world, canMove) {
  let activePointer = null;
  world.stick = { x: 0, y: 0 };
  const reset = () => {
    const id = activePointer; activePointer = null;
    world.stick.x = world.stick.y = 0;
    thumb.style.transform = 'translate3d(0px, 0px, 0)';
    base.classList.remove('active');
    if (id !== null && base.hasPointerCapture?.(id)) base.releasePointerCapture(id);
  };
  const move = e => {
    if (e.pointerId !== activePointer) return;
    if (!canMove()) { reset(); return; }
    const rect = base.getBoundingClientRect();
    const radius = Math.max(1, (rect.width - (thumb.getBoundingClientRect().width || rect.width * .44)) / 2);
    const dx = e.clientX - rect.left - rect.width / 2, dy = e.clientY - rect.top - rect.height / 2;
    const length = Math.hypot(dx, dy), amount = Math.min(1, length / radius);
    const x = length ? dx / length : 0, y = length ? dy / length : 0;
    // A small dead zone avoids drifting when the thumb rests near the centre.
    const speed = Math.max(0, (amount - .12) / .88);
    world.stick.x = x * speed; world.stick.y = y * speed;
    thumb.style.transform = `translate3d(${x * amount * radius}px, ${y * amount * radius}px, 0)`;
  };
  base.addEventListener('pointerdown', e => {
    e.preventDefault();
    if (activePointer !== null || !canMove() || (e.pointerType === 'mouse' && e.button !== 0)) return;
    activePointer = e.pointerId; base.setPointerCapture(e.pointerId); base.classList.add('active');
    // Take over from tap-to-walk, including a centred press in the dead zone.
    world.destination = null; world.marker.visible = false; move(e);
  });
  base.addEventListener('pointermove', move);
  const release = e => { if (e.pointerId === activePointer) reset(); };
  for (const event of ['pointerup', 'pointercancel', 'lostpointercapture']) base.addEventListener(event, release);
  base.addEventListener('contextmenu', e => e.preventDefault());
  window.addEventListener('blur', reset); window.addEventListener('resize', reset);
  document.addEventListener('visibilitychange', reset);
  return reset;
}

export function renderProfile(width, coarse, dpr = 1) {
  const mobile = coarse || width <= 700;
  return { mobile, pixelRatio: Math.min(dpr, mobile ? 1.25 : 1.75), shadows: !mobile, frameInterval: mobile ? 1000 / 30 : 0 };
}

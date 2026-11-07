import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { cameraView } from '../src/camera.js';
import { buildKabukichoDistrict, KABUKICHO_LAYOUT } from '../src/kabukicho.js';
import { planPath, segmentClear } from '../src/navigation.js';
import { PROFILES } from '../src/game.js';
import { STREET_PROFILES } from '../src/street-encounters.js';
import { evaluateInvitation } from '../src/encounters.js';

test('the full Toho perimeter is walkable and a clear camera view exists at every sampled point', () => {
  const previous = globalThis.document;
  globalThis.document = { createElement: () => ({ getContext: () => ({ fillRect() {}, strokeRect() {}, fillText() {} }) }) };
  const city = new THREE.Group();
  try { buildKabukichoDistrict(city); } finally { globalThis.document = previous; }
  city.updateMatrixWorld(true); const blockers = [];
  city.traverse(o => { if (o.userData.cameraBlocker) blockers.push(new THREE.Box3().setFromObject(o)); });
  assert.ok(blockers.length > 20);
  let start = { x: KABUKICHO_LAYOUT.start[0], z: KABUKICHO_LAYOUT.start[1] }, changed = 0;
  for (const [x, z] of KABUKICHO_LAYOUT.tour) {
    const path = planPath(start, { x, z }, KABUKICHO_LAYOUT); assert.ok(path.length);
    let from = start;
    for (const to of path) {
      assert.ok(segmentClear(from, to, KABUKICHO_LAYOUT));
      const steps = Math.max(1, Math.ceil(Math.hypot(to.x - from.x, to.z - from.z) / 2));
      for (let i = 0; i <= steps; i++) {
        const p = new THREE.Vector3(from.x + (to.x - from.x) * i / steps, 0, from.z + (to.z - from.z) * i / steps);
        const focus = p.clone().add(new THREE.Vector3(0, 1.5, 0));
        assert.ok(blockers.every(b => !b.containsPoint(focus)), 'walkway stays outside physical buildings');
        const desired = p.clone().add(new THREE.Vector3(0, 13.36, 18.44));
        const view = cameraView(focus, desired, blockers); if (view.obstructed) changed++;
        const ray = new THREE.Ray(focus, view.position.clone().sub(focus).normalize()), distance = focus.distanceTo(view.position);
        for (const b of blockers) { const hit = ray.intersectBox(b, new THREE.Vector3()); assert.ok(!hit || hit.distanceTo(focus) >= distance, 'buildings cannot hide the player'); }
      }
      from = to;
    }
    start = { x, z };
  }
  assert.ok(changed > 0, 'rear hotel obstruction is detected');
});
test('dating characters are adults and street staff never become date invitations', () => {
  assert.ok(PROFILES.every(p => p.gender === 'woman' && p.age >= 20));
  for (const p of STREET_PROFILES) assert.equal(evaluateInvitation(p, KABUKICHO_LAYOUT.destinations[0], { favor: 100, discomfort: 0 }).accepted, false);
});

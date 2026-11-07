import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createCharacter, animateCharacter, isCharacterResource } from '../src/characters.js';
import { STREET_PROFILES } from '../src/street-encounters.js';
import { PROFILES } from '../src/game.js';

test('every model has a bounded mobile budget, finite geometry and articulated joints', () => {
  for (const profile of [{ id: 'player', color: '#a1d6c8', hair: '#2c3038' }, ...PROFILES, ...STREET_PROFILES]) {
    const person = createCharacter(profile.color, profile.hair, profile.id);
    let meshes = 0, triangles = 0;
    person.traverse(o => {
      if (!o.isMesh) return;
      meshes++; triangles += o.geometry.index ? o.geometry.index.count / 3 : o.geometry.attributes.position.count / 3;
      assert.ok(isCharacterResource(o.geometry)); assert.ok(isCharacterResource(o.material));
      for (const value of o.geometry.attributes.position.array) assert.ok(Number.isFinite(value));
    });
    assert.ok(meshes <= 12, `${profile.id}: ${meshes} draw parts`);
    assert.ok(triangles <= 5200, `${profile.id}: ${triangles} triangles`);
    assert.equal(person.userData.elbows.length, 2); assert.equal(person.userData.knees.length, 2);
    const bounds = new THREE.Box3().setFromObject(person);
    assert.ok(bounds.min.y >= -.04); assert.ok(bounds.max.y > 2.1 && bounds.max.y < 2.5);
    assert.ok(bounds.max.x - bounds.min.x < 1.2);
  }
});
test('copies share surfaces but do not share mutable joint transforms', () => {
  const a = createCharacter('#dc9aab', '#42293a', 'waiting'), b = createCharacter('#dc9aab', '#42293a', 'waiting');
  assert.equal(a.getObjectByName('face-and-hair').geometry, b.getObjectByName('face-and-hair').geometry);
  assert.equal(a.getObjectByName('face-and-hair').material, b.getObjectByName('face-and-hair').material);
  assert.notEqual(a.userData.head, b.userData.head);
  const before = b.userData.legs[0].rotation.x;
  animateCharacter(a, true, .17); assert.equal(b.userData.legs[0].rotation.x, before);
  assert.notEqual(a.userData.legs[0].rotation.x, before);
  assert.ok(a.userData.elbows[1].rotation.x < -1, 'phone stays raised while walking');
  assert.equal(a.getObjectByName('phone').parent, a.userData.elbows[1]);
});
test('reading and drinking poses retain props while walking', () => {
  const reader = createCharacter('#a998c2', '#3d3437', 'reader');
  animateCharacter(reader, true, 2);
  assert.ok(reader.userData.elbows.every(joint => joint.rotation.x < -1));
  assert.equal(reader.getObjectByName('open-book').parent, reader.userData.elbows[0]);
  const cafe = createCharacter('#e58b74', '#553931', 'cafe');
  for (const time of [0, .2, 1, 2.4]) {
    animateCharacter(cafe, true, time); cafe.updateMatrixWorld(true);
    const rotation = cafe.getObjectByName('coffee-hand').getWorldQuaternion(new THREE.Quaternion());
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(rotation);
    assert.ok(up.y > .999, 'cup stays upright');
  }
});
test('background characters omit face detail while retaining individual silhouettes', () => {
  for (const profile of PROFILES) {
    const detailed = createCharacter(profile.color, profile.hair, profile.id);
    const background = createCharacter(profile.color, profile.hair, profile.id, { detailed: false });
    assert.ok(background.getObjectByName('face-and-hair').geometry.attributes.position.count < detailed.getObjectByName('face-and-hair').geometry.attributes.position.count);
    assert.equal(background.userData.appearance.hair, detailed.userData.appearance.hair);
  }
});

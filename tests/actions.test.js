import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { ACTIONS, animateAction } from '../src/actions.js';
import { createCharacter, animateCharacter } from '../src/characters.js';
import { CityWorld } from '../src/world.js';
import { MAP_LAYOUTS } from '../src/locations.js';

const person = () => createCharacter('#a1d6c8', '#2c3038', 'player');
test('actions move joints, jump lifts feet, and every cancelled pose returns to neutral', () => {
  for (const action of ACTIONS) {
    const model = person(); const position = model.position.clone();
    animateCharacter(model, false, 0);
    const before = new THREE.Box3().setFromObject(model).clone();
    assert.equal(animateAction(model, action.id, action.duration * .4), true);
    const after = new THREE.Box3().setFromObject(model);
    assert.notDeepEqual(after, before, `${action.id} changes the pose`);
    if (action.id === 'jump') assert.ok(model.userData.legs.every(leg => leg.position.y > 1.5), 'both feet leave the ground');
    assert.deepEqual(model.position, position, 'visual action does not change navigation position');
    animateCharacter(model, false, 0);
    assert.deepEqual(new THREE.Box3().setFromObject(model), before, `${action.id} leaves no residual transform`);
    assert.equal(animateAction(model, action.id, action.duration), false);
  }
});
function makeWorld() {
  const world = Object.create(CityWorld.prototype);
  Object.assign(world, {
    player: person(), keys: new Set(), layout: MAP_LAYOUTS.nagoya, npcs: [], landmarkLabels: [],
    cameraTarget: new THREE.Vector3(), camera: new THREE.PerspectiveCamera(43, 1, .1, 160),
    distance: 26, yaw: .23, container: { clientWidth: 400, clientHeight: 800 },
    renderer: { render() {} }, ring: new THREE.Object3D(), selectionRing: new THREE.Object3D(),
    marker: new THREE.Object3D(), goalBeacon: new THREE.Object3D(), goal: new THREE.Vector3(),
    playerLabel: { style: {} }, goalLabel: { style: {} },
  });
  return world;
}
test('world actions finish, stop automatic walking, cancel for movement and reject paused input', () => {
  const world = makeWorld(); world.player.position.set(-3, 0, 5);
  world.walkTo(new THREE.Vector3(-3, 0, 15));
  assert.equal(world.performAction('jump'), true); assert.equal(world.destination, null); assert.equal(world.marker.visible, false);
  world.update(.2, .2); assert.ok(world.player.userData.legs[0].position.y > 1);
  world.keys.add('w'); world.update(.05, .25);
  assert.equal(world.action, null); assert.equal(world.player.userData.legs[0].position.y, .95);
  world.performAction('bow'); world.walkTo(new THREE.Vector3(-3, 0, 15)); assert.equal(world.action, null);
  world.performAction('dance');
  for (let i = 0; i < 70; i++) world.update(.05, i * .05);
  assert.equal(world.action, null);
  assert.equal(world.performAction('unknown'), false);
  world.paused = true; assert.equal(world.performAction('jump'), false);
});

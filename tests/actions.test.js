import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { ACTIONS, animateAction } from '../src/actions.js';
import { createCharacter, animateCharacter } from '../src/characters.js';
import { CityWorld } from '../src/world.js';
import { isWalkable } from '../src/navigation.js';
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

test('walking HUD labels only the nearest two people and preserves the selected person', () => {
  const world = makeWorld();
  world.placeLabel = el => { el.style.display = ''; };
  world.npcs = [1, 3, 5, 12].map(x => {
    const mesh = person(); mesh.position.x = x;
    return { mesh, profile: { speed: 0 }, label: { style: {} }, cooldown: 0 };
  });
  world.update(.05, 0);
  assert.deepEqual(world.npcs.map(n => n.label.style.display), ['', '', 'none', 'none']);
  world.selected = world.npcs[2]; world.update(.05, .05);
  assert.equal(world.npcs[2].label.style.display, '');
  assert.equal(world.npcs[3].label.style.display, 'none');
});

test('a companion physically follows through the Kabukicho junctions to the chosen destination', () => {
  for (const destination of MAP_LAYOUTS.kabukicho.destinations) {
    const world = makeWorld(); world.layout = MAP_LAYOUTS.kabukicho; world.map = 'kabukicho';
    world.player.position.set(0, 0, 20);
    const npc = { mesh: person(), label: { style: {} }, profile: { speed: 0 }, phase: 0, cooldown: 0 };
    npc.mesh.position.set(3, 0, 22); world.npcs = [npc]; world.companion = npc;
    world.goal.copy(new THREE.Vector3(destination.x, 0, destination.z)); world.walkTo(world.goal);
    for (let i = 0; i < 1700; i++) {
      world.update(.05, i * .05);
      assert.ok(isWalkable(world.player.position, world.layout), 'player stays on connected streets');
      assert.ok(isWalkable(npc.mesh.position, world.layout), 'companion stays on connected streets');
      if (world.player.position.distanceTo(world.goal) < 1.4 && world.distanceTo(npc) < 3.1) break;
    }
    assert.ok(world.player.position.distanceTo(world.goal) < 1.4, `player reached ${destination.id}`);
    assert.ok(world.distanceTo(npc) < 3.1, `companion reached ${destination.id}`);
  }
});

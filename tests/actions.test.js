import { arrivedTogether } from '../src/venues.js';
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
      if (arrivedTogether(world.player.position, npc.mesh.position, world.goal)) break;
    }
    assert.ok(world.player.position.distanceTo(world.goal) < 1.4, `player reached ${destination.id}`);
    assert.ok(arrivedTogether(world.player.position, npc.mesh.position, world.goal), `both reached ${destination.id}`);
  }
});

test('the one-lap tour walks the player along every side of Toho and returns to its front', () => {
  const world = makeWorld(); world.layout = MAP_LAYOUTS.kabukicho;
  world.player.position.set(...[world.layout.start[0], 0, world.layout.start[1]]);
  assert.equal(world.walkRoute(world.layout.tour), true);
  const visited = new Set();
  for (let i = 0; i < 1500 && world.destination; i++) {
    world.update(.05, i * .05);
    const p = world.player.position; assert.ok(isWalkable(p, world.layout));
    if (p.x < -14 && p.z < -25) visited.add('west');
    if (p.z < -42 && Math.abs(p.x) < 10) visited.add('rear');
    if (p.x > 17 && p.z < -25) visited.add('east');
  }
  assert.deepEqual([...visited].sort(), ['east', 'rear', 'west']);
  assert.equal(world.destination, null);
  assert.ok(world.player.position.distanceTo(new THREE.Vector3(0, 0, -17)) < .2);
});

test('duet keeps the girl visible, animates both, freezes navigation and restores each pose', () => {
  const world = makeWorld(), npc = { mesh: person(), ambient: true, phase: 1 };
  const partner = { mesh: person(), phase: 0 }; partner.mesh.position.x = 2; partner.mesh.rotation.y = .7;
  world.npcs = [npc, partner]; world.paused = true;
  const original = world.player.position.clone(), angle = world.player.rotation.y;
  assert.equal(world.beginChallenge(), false); world.beginChallenge(partner); assert.equal(npc.mesh.visible, false); assert.equal(partner.mesh.visible, true); world.challengeCue('jump'); world.keys.add('w');
  assert.equal(world.performAction('jump'), true); world.challengeFeedback('perfect'); world.update(.2, .2);
  assert.deepEqual(world.player.position, original); assert.ok(world.player.userData.legs.every(leg => leg.position.y > 1.5));
  assert.ok(partner.mesh.userData.legs.every(leg => leg.position.y > 1.5), 'girl actually performs the cue');
  assert.equal(world.challengeEffects.burst.visible, true); world.applyRewards({ outfit: 'white', aura: 'gold' }); assert.equal(world.challengeEffects.aura.visible, true);
  world.endChallenge(); assert.equal(world.action, null); assert.equal(world.challengeActive, false); assert.equal(npc.mesh.visible, true); assert.equal(world.player.rotation.y, angle); assert.equal(partner.mesh.rotation.y, .7); assert.equal(world.challengePartner, null); assert.equal(partner.mesh.userData.legs[0].position.y, .95);
  world.player.rotation.y = 1.2; world.endChallenge(); assert.equal(world.player.rotation.y, 1.2, 'repeated cleanup preserves current angle');
  assert.equal(world.performAction('jump'), false); world.applyRewards({ outfit: 'default', aura: 'none' }); assert.equal(world.challengeEffects.aura.visible, false);
});

test('duet frames both people in portrait and landscape without moving their navigation positions', () => {
  for (const aspect of [320 / 844, 390 / 844, 844 / 390]) {
    const world = makeWorld(); world.camera.aspect = aspect; world.camera.updateProjectionMatrix();
    const partner = {mesh: person()}; partner.mesh.position.set(2.1, 0, 0);
    world.npcs = [partner]; world.beginChallenge(partner);
    world.camera.position.copy(world.challengeView.desired); world.camera.lookAt(world.challengeView.focus); world.camera.updateMatrixWorld();
    for (const model of [world.player, partner.mesh]) {
      // Conservative silhouettes, including a jump above each avatar's head.
      for (const dx of [-.55, .55]) for (const y of [0, 3.3]) {
        const point = model.position.clone().add(new THREE.Vector3(dx, y, 0)).project(world.camera);
        assert.ok(Math.abs(point.x) < .9 && Math.abs(point.y) < .8, `pair fits ${aspect}`);
      }
    }
    assert.equal(partner.mesh.position.x, 2.1); assert.equal(world.player.position.length(), 0);
  }
});

test('companion closes the last gap when the player stops just short of a venue marker', () => {
  for (const goal of MAP_LAYOUTS.kabukicho.destinations) {
    const world=makeWorld();world.layout=MAP_LAYOUTS.kabukicho;world.map='kabukicho';
    world.goal.set(goal.x,0,goal.z);world.player.position.copy(world.goal).add(new THREE.Vector3(.1,0,.1));
    const npc={mesh:person(),label:{style:{}},profile:{speed:0},phase:0,cooldown:0};
    npc.mesh.position.copy(world.goal).add(new THREE.Vector3(goal.type==='netcafe'?4:-2,0,4));
    world.npcs=[npc];world.companion=npc;
    for(let i=0;i<800;i++)world.update(.005,i*.005);
    assert.ok(arrivedTogether(world.player.position,npc.mesh.position,world.goal),`${goal.id}: both must reach the entrance without moving the player again`);
  }
});

test('talk close-up hides the nearby player, frames the partner and restores the street', () => {
  for(const aspect of [390/844,960/600]){
    const world=makeWorld();world.camera.aspect=aspect;world.camera.updateProjectionMatrix();
    const partner={mesh:person()}, bystander={mesh:person()};partner.mesh.position.set(0,0,-3);partner.mesh.rotation.y=.2;
    world.npcs=[partner,bystander];const position=partner.mesh.position.clone();
    assert.equal(world.beginTalk(null),false);assert.equal(world.player.visible,true);
    world.beginTalk(partner);assert.equal(world.player.visible,false);assert.equal(bystander.mesh.visible,false);
    world.camera.position.copy(world.challengeView.desired);world.camera.lookAt(world.challengeView.focus);world.camera.updateMatrixWorld();
    const head=partner.mesh.position.clone().add(new THREE.Vector3(0,1.7,0)).project(world.camera);
    assert.ok(Math.abs(head.x)<.8&&Math.abs(head.y)<.9);assert.deepEqual(partner.mesh.position,position);
    world.endChallenge();assert.equal(world.player.visible,true);assert.equal(bystander.mesh.visible,true);assert.equal(world.talkActive,false);assert.equal(partner.mesh.rotation.y,.2);
  }
});

test('talk reactions animate while navigation is paused, expire and clear on early exit', () => {
 const world=makeWorld(), partner={mesh:person()};partner.mesh.position.z=-3;world.npcs=[partner];world.paused=true;
 assert.equal(world.reactToTalk('win','paper',1),false);world.beginTalk(partner);
 world.reactToTalk('win','paper',1);assert.equal(partner.mesh.userData.reaction.id,'nod');
 const position=partner.mesh.position.clone();world.update(.2,.2);
 assert.ok(partner.mesh.userData.head.rotation.x>0);assert.deepEqual(partner.mesh.position,position);
 for(let i=0;i<35;i++)world.update(.05,.25+i*.05);
 assert.equal(partner.mesh.userData.reaction,undefined);
 world.reactToTalk('win','rock',3);assert.equal(partner.mesh.userData.reaction.id,'delight');
 world.endChallenge();assert.equal(partner.mesh.userData.reaction,undefined);assert.equal(world.player.visible,true);
});

import { CROWD_LIMIT } from '../src/crowd.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import * as THREE from 'three';
import { loadOfflineAvatar } from '../scripts/load-avatar-offline.mjs';
import { createCharacter, animateCharacter, isCharacterResource, setCharacterOutfit } from '../src/characters.js';
import { CAST, MODEL_FILES } from '../src/cast.js';
import { PROFILES } from '../src/game.js';
import { STREET_PROFILES } from '../src/street-encounters.js';
import { ACTIONS, animateAction } from '../src/actions.js';
import { disposeCharacterSkeletons } from '../src/authored-characters.js';
import { CityWorld } from '../src/world.js';

await loadOfflineAvatar();
const person = () => createCharacter('#dc9aab', '#42293a', 'waiting');
const skinned = model => { const meshes = []; model.traverse(o => { if (o.isSkinnedMesh) meshes.push(o); }); return meshes; };
test('the real redistributable asset loads, keeps its license and fits the single-character budget', async () => {
  const bytes = await fs.readFile('public/models/yui.vrm'); assert.ok(bytes.length < 5_100_000);
  const gltf = JSON.parse(bytes.subarray(20, 20 + bytes.readUInt32LE(12)));
  const meta = gltf.extensions.VRMC_vrm.meta;
  assert.equal(meta.authors[0], 'pixiv Inc.'); assert.equal(meta.allowRedistribution, true);
  assert.equal(meta.modification, 'allowModificationRedistribution'); assert.equal(meta.allowAntisocialOrHateUsage, false);
  const model = person(); assert.equal(model.userData.authored, true);
  let triangles = 0, draws = 0, textured = 0;
  model.traverse(o => {
    if (!o.isMesh) return; draws++; triangles += (o.geometry.index?.count ?? o.geometry.attributes.position.count) / 3;
    assert.ok(isCharacterResource(o.geometry)); assert.ok(isCharacterResource(o.material));
    if (o.material.map) { textured++; assert.ok(o.geometry.attributes.uv); assert.ok(o.material.map.image.width <= 1024); }
  });
  assert.ok(draws <= 16); assert.ok(triangles < 37_000); assert.ok(textured >= 10);
  const box = new THREE.Box3().setFromObject(model, true);
  assert.ok(box.min.y > -.01); assert.ok(box.max.y > 2 && box.max.y < 2.3);
  assert.ok(box.max.x - box.min.x < 1, 'relaxed pose, not the source T-pose');
  assert.ok(model.getObjectByName('phone'));
  assert.equal(createCharacter('#dc9aab', '#42293a', 'waiting', { detailed: false }).userData.authored, true);
  assert.equal(createCharacter('#e58b74', '#553931', 'cafe').userData.authored, true);
});
test('walking changes actual skinned vertices and returns exactly to idle without moving the navigation root', () => {
  const model = person(), meshes = skinned(model), origin = model.position.clone();
  const snapshot = () => meshes.map(mesh => mesh.getVertexPosition(0, new THREE.Vector3()).applyMatrix4(mesh.matrixWorld).toArray());
  animateCharacter(model, false, 0); const idle = snapshot();
  animateCharacter(model, true, .18); assert.notDeepEqual(snapshot(), idle);
  for (const mesh of meshes) for (let i = 0; i < mesh.geometry.attributes.position.count; i += 113) {
    const p = mesh.getVertexPosition(i, new THREE.Vector3()); assert.ok(p.toArray().every(Number.isFinite));
  }
  animateCharacter(model, false, 0); assert.deepEqual(snapshot(), idle); assert.deepEqual(model.position, origin);
});
test('portraits and scene copies share textures but own independent bones, morphs and disposable skeletons', () => {
  const a = person(), b = person(), am = skinned(a), bm = skinned(b);
  assert.equal(am[0].geometry, bm[0].geometry); assert.equal(am[0].material, bm[0].material);
  assert.notEqual(am[0].skeleton, bm[0].skeleton); assert.notEqual(am[0].skeleton.bones[0], bm[0].skeleton.bones[0]);
  const before = bm[0].skeleton.bones.map(bone => bone.quaternion.toArray());
  animateCharacter(a, true, .2); assert.deepEqual(bm[0].skeleton.bones.map(bone => bone.quaternion.toArray()), before);
  const faceA = am.find(mesh => mesh.morphTargetInfluences?.length), faceB = bm.find(mesh => mesh.name === faceA.name);
  const idle = faceB.morphTargetInfluences.slice(); animateCharacter(a, false, 4.5);
  assert.notDeepEqual(faceA.morphTargetInfluences, idle); assert.deepEqual(faceB.morphTargetInfluences, idle);
  am[0].skeleton.computeBoneTexture(); bm[0].skeleton.computeBoneTexture();
  disposeCharacterSkeletons(a); assert.equal(am[0].skeleton.boneTexture, null); assert.ok(bm[0].skeleton.boneTexture);
});
test('switching maps releases imported skeletons while keeping shared model surfaces alive', () => {
  const previous = globalThis.document;
  globalThis.document = { createElement: () => ({ getContext: () => ({ fillRect() {}, strokeRect() {}, fillText() {}, createRadialGradient: () => ({ addColorStop() {} }) }) }) };
  try {
    const world = Object.create(CityWorld.prototype);
    Object.assign(world, { scene: new THREE.Scene(), player: new THREE.Group(), cameraTarget: new THREE.Vector3(), marker: {}, resetCamera() {}, makeLabel() { return { addEventListener() {}, remove() {} }; } });
    world.scene.background = new THREE.Color(); world.setMap('kabukicho');
    const mesh = skinned(world.npcs[0].mesh)[0]; assert.ok(mesh); mesh.skeleton.computeBoneTexture();
    let disposed = false; mesh.geometry.addEventListener('dispose', () => { disposed = true; });
    world.setMap('nagoya'); assert.equal(mesh.skeleton.boneTexture, null); assert.equal(disposed, false);
    assert.equal(world.npcs[0].mesh.userData.authored, true);
  } finally { globalThis.document = previous; }
});

test('all characters and background people use authored faces, retain props and stay within the combined crowd budget', () => {
  const kinds = ['player', ...PROFILES.map(p => p.id), ...STREET_PROFILES.map(p => p.id)];
  assert.deepEqual(new Set(Object.keys(CAST)), new Set(kinds));
  let triangles = 0, draws = 0;
  for (const id of kinds) {
    const model = createCharacter('#72778d', '#333333', id), background = createCharacter('#72778d', '#333333', id, { detailed: false });
    assert.equal(model.userData.authored, true, id); assert.equal(background.userData.authored, true, id);
    assert.equal(background.userData.items.has(CAST[id].prop), false, `${id}: omit small background props`);
    assert.ok(model.getObjectByName(CAST[id].prop), id);
    let count = 0, parts = 0;
    model.traverse(o => { if (o.isMesh) { count += (o.geometry.index?.count ?? o.geometry.attributes.position.count) / 3; parts++; assert.ok(isCharacterResource(o.geometry)); assert.ok(isCharacterResource(o.material)); } });
    assert.ok(count < 37_000, `${id}: ${count}`); assert.ok(parts <= 26, `${id}: ${parts}`);
    triangles += count; draws += parts;
    const bounds = new THREE.Box3().setFromObject(model, true);
    assert.ok(bounds.min.y >= -.015, `${id}: ground ${bounds.min.y}`); assert.ok(bounds.max.y > 2 && bounds.max.y < 2.5, id);
    assert.ok(bounds.max.x - bounds.min.x < 1.3, `${id}: relaxed arms`);
  }
  assert.ok(triangles < 400_000); assert.ok(draws < 320);
  for (let i = 0; i < CROWD_LIMIT.mobile; i++) {
    const model = createCharacter('#72778d', '#333333', i < 3 ? 'scout' : 'eye', { detailed: false });
    model.traverse(o => { if (o.isMesh) { triangles += (o.geometry.index?.count ?? o.geometry.attributes.position.count) / 3; draws++; } });
  }
  assert.ok(triangles < 550_000, `phone crowd: ${triangles}`); assert.ok(draws < 440, `phone crowd: ${draws}`);
});
test('every authored base walks and blinks without corrupting other instances or the attached props', () => {
  for (const kind of ['waiting', 'eye', 'earphones', 'player', 'cafe', 'reader']) {
    const model = createCharacter('#72778d', '#333333', kind), meshes = skinned(model);
    const sample = () => meshes.map(mesh => mesh.getVertexPosition(0, new THREE.Vector3()).applyMatrix4(mesh.matrixWorld).toArray());
    animateCharacter(model, false, 0); const idle = sample();
    for (const time of [.18, .65, 1.3, 4.5]) {
      animateCharacter(model, true, time); assert.notDeepEqual(sample(), idle, kind);
      for (const mesh of meshes) for (let i = 0; i < mesh.geometry.attributes.position.count; i += 149) assert.ok(mesh.getVertexPosition(i, new THREE.Vector3()).toArray().every(Number.isFinite), kind);
      if (kind === 'cafe') assert.ok(new THREE.Vector3(0, 1, 0).applyQuaternion(model.getObjectByName('coffee').getWorldQuaternion(new THREE.Quaternion())).y > .999);
    }
    animateCharacter(model, false, 0); assert.deepEqual(sample(), idle, kind);
  }
});
test('all four player actions animate the new male rig, preserve navigation and cancel cleanly', () => {
  const model = createCharacter('#303544', '#28232c', 'player'), origin = model.position.clone();
  const sample = () => skinned(model).map(mesh => mesh.getVertexPosition(0, new THREE.Vector3()).applyMatrix4(mesh.matrixWorld).toArray());
  for (const action of ACTIONS) {
    animateCharacter(model, false, 0); const idle = sample();
    assert.equal(animateAction(model, action.id, action.duration * .4), true); assert.notDeepEqual(sample(), idle, action.id);
    assert.deepEqual(model.position, origin); if (action.id === 'jump') assert.ok(model.userData.avatar.position.y > 1);
    animateCharacter(model, false, 0); assert.deepEqual(sample(), idle, `${action.id}: clean cancellation`);
  }
});
test('all four model files remain self-contained with their original permissions and a bounded total download', async () => {
  let bytes = 0;
  for (const file of Object.values(MODEL_FILES)) {
    const buffer = await fs.readFile('public/models/' + file); bytes += buffer.length;
    const gltf = JSON.parse(buffer.subarray(20, 20 + buffer.readUInt32LE(12)));
    assert.ok(gltf.images.every(image => image.bufferView !== undefined && !image.uri)); assert.ok(gltf.buffers.every(buffer => !buffer.uri));
    if (gltf.extensions.VRMC_vrm) { assert.equal(gltf.extensions.VRMC_vrm.meta.allowRedistribution, true); assert.equal(gltf.extensions.VRMC_vrm.meta.modification, 'allowModificationRedistribution'); }
    else { assert.equal(gltf.extensions.VRM.meta.licenseName, 'Other'); assert.notEqual(gltf.extensions.VRM.meta.licenseName, 'CC0'); }
  }
  assert.ok(bytes < 12_000_000, `shared model downloads: ${bytes}`);
});

test('the mobile world runs actions on the imported player and throttles distant poses without slowing navigation', () => {
  const previous = globalThis.document;
  globalThis.document = { createElement: () => ({ getContext: () => ({ fillRect() {}, strokeRect() {}, fillText() {}, createRadialGradient: () => ({ addColorStop() {} }) }) }) };
  try {
    const world = Object.create(CityWorld.prototype);
    Object.assign(world, {
      scene: new THREE.Scene(), player: createCharacter('#303544', '#28232c', 'player'), mobile: true,
      camera: new THREE.PerspectiveCamera(55, 390 / 844, .1, 160), cameraTarget: new THREE.Vector3(),
      marker: new THREE.Object3D(), ring: new THREE.Object3D(), selectionRing: new THREE.Object3D(), keys: new Set(),
      playerLabel: { style: {} }, renderer: { render() {} }, container: { clientWidth: 390, clientHeight: 844 },
      makeLabel() { return { style: {}, addEventListener() {}, remove() {} }; },
    });
    world.scene.background = new THREE.Color(); world.scene.add(world.player); world.setMap('kabukicho');
    assert.ok(world.npcs.every(n => n.mesh.userData.authored));
    world.performAction('jump'); world.update(.2, .2); assert.ok(world.player.userData.avatar.position.y > .7);
    const before = world.player.position.clone(); world.keys.add('w'); world.update(.05, .25);
    assert.equal(world.action, null); assert.ok(world.player.userData.avatar.position.y < .1); assert.ok(before.distanceTo(world.player.position) > 0);
    world.keys.clear(); world.update(.033, 1);
    const far = world.npcs.find(n => world.distanceTo(n) > 20), near = world.npcs.find(n => world.distanceTo(n) < 10);
    assert.ok(far && near); const sampled = far.mesh.userData.lastFrame.time;
    world.update(.033, 1.033); assert.equal(far.mesh.userData.lastFrame.time, sampled); assert.equal(near.mesh.userData.lastFrame.time, 1.033);
  } finally { globalThis.document = previous; }
});

test('reward outfits change only the equipped player, preserve skin and reuse cached geometry when switching back', () => {
  const a = createCharacter('#303544', '#28232c', 'player'), b = createCharacter('#303544', '#28232c', 'player');
  const body = model => skinned(model).find(mesh => /Body_00_SKIN/.test(mesh.material.name));
  const first = body(a).geometry, original = body(b).geometry.attributes.color.array.slice();
  assert.equal(setCharacterOutfit(a, '#e2dfd4'), true); assert.notEqual(body(a).geometry, first);
  assert.deepEqual(body(b).geometry.attributes.color.array, original);
  const colors = body(a).geometry.attributes.color.array;
  for (let i = 0; i < original.length; i += 3) if (original[i] === 1 && original[i + 1] === 1 && original[i + 2] === 1) assert.deepEqual([...colors.slice(i, i + 3)], [1, 1, 1]);
  setCharacterOutfit(a, '#a95a70'); setCharacterOutfit(a, '#303544'); assert.equal(body(a).geometry, first);
  animateCharacter(a, true, .2); assert.ok(skinned(a).every(mesh => mesh.getVertexPosition(0, new THREE.Vector3()).toArray().every(Number.isFinite)));
});

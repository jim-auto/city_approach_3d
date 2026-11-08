import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import * as THREE from 'three';
import { loadOfflineAvatar } from '../scripts/load-avatar-offline.mjs';
import { createCharacter, animateCharacter, isCharacterResource } from '../src/characters.js';
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
  const box = new THREE.Box3().setFromObject(model);
  assert.ok(box.min.y > -.01); assert.ok(box.max.y > 2 && box.max.y < 2.3);
  assert.ok(box.max.x - box.min.x < 1, 'relaxed pose, not the source T-pose');
  assert.ok(model.getObjectByName('phone'));
  assert.equal(createCharacter('#dc9aab', '#42293a', 'waiting', { detailed: false }).userData.authored, undefined);
  assert.equal(createCharacter('#e58b74', '#553931', 'cafe').userData.authored, undefined);
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

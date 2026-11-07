import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { CityWorld } from '../src/world.js';

test('both detailed maps build and repeated switches clean up NPC labels and GPU resources', () => {
  const previousDocument = globalThis.document;
  const context = {
    fillRect() {}, strokeRect() {}, fillText() {},
    createRadialGradient: () => ({ addColorStop() {} }),
  };
  globalThis.document = { createElement: () => ({ getContext: () => context }) };
  try {
    // Exercise real scene construction without requiring a WebGL renderer.
    const world = Object.create(CityWorld.prototype), labels = new Set();
    Object.assign(world, {
      scene: new THREE.Scene(), player: new THREE.Group(), cameraTarget: new THREE.Vector3(),
      marker: { visible: false }, resetCamera() {},
      makeLabel(text) {
        const label = { text, addEventListener() {}, remove() { labels.delete(label); } };
        labels.add(label); return label;
      },
    });
    world.scene.background = new THREE.Color();
    world.setMap('kabukicho');
    assert.equal(labels.size, 16);
    assert.ok(world.npcs.some(n => n.ambient && !n.label));
    let disposedGeometry = false, disposedTexture = false, texture, disposedCharacter = false;
    const sharedFace = world.npcs[0].mesh.getObjectByName('face-and-hair').geometry;
    sharedFace.addEventListener('dispose', () => { disposedCharacter = true; });
    world.city.traverse(o => {
      if (!texture && o.material?.map) texture = o.material.map;
      if (o.geometry?.type === 'PlaneGeometry') o.geometry.addEventListener('dispose', () => { disposedGeometry = true; });
    });
    texture.addEventListener('dispose', () => { disposedTexture = true; });
    for (const map of ['nagoya', 'kabukicho', 'nagoya']) {
      world.setMap(map);
      assert.equal(world.map, map);
      assert.equal(labels.size, map === 'kabukicho' ? 16 : 11, 'old labels must be removed, including maps with unlabelled pedestrians');
      assert.equal(world.scene.children.length, 1, 'old city must leave the scene');
      const batches = world.city.children.filter(o => o.isInstancedMesh);
      assert.ok(batches.length > 0, 'static scenery uses instanced drawing');
      assert.ok(batches.reduce((sum, batch) => sum + batch.count, 0) > 500, 'detailed scenery is preserved inside batches');
      assert.ok(world.city.children.length < 500, 'scenery draw objects are reduced');
      assert.equal(world.companion, null);
      assert.equal(world.destination, null);
    }
    world.mobile = true; world.setMap('kabukicho');
    assert.equal(world.npcs.filter(n => n.ambient).length, 6);
    assert.equal(world.npcs.filter(n => !n.ambient && !n.profile.role).length, 8, 'all women remain available on mobile');
    assert.equal(world.npcs.filter(n => n.profile?.role && n.profile.role !== 'toyoko').length, 2, 'catch and scout remain available on mobile' );
    assert.equal(world.npcs.filter(n => n.profile?.role === 'toyoko').length, 3, 'plaza group remains available on mobile');
    assert.equal(disposedCharacter, false, 'shared character geometry survives map switches');
    assert.equal(world.npcs[0].mesh.getObjectByName('face-and-hair').geometry, sharedFace);
    assert.equal(disposedGeometry, true);
    assert.equal(disposedTexture, true);
  } finally {
    if (previousDocument === undefined) delete globalThis.document;
    else globalThis.document = previousDocument;
  }
});

test('phone browser toolbar resizing preserves camera; rotation changes framing without rotating view', () => {
  const world = Object.create(CityWorld.prototype);
  Object.assign(world, {
    mobile: true, distance: 29, yaw: 1.1,
    camera: new THREE.PerspectiveCamera(43, .5, .1, 160),
    container: { clientWidth: 390, clientHeight: 740 },
    renderer: { setSize() {} },
  });
  world.resize(); assert.equal(world.distance, 29); assert.equal(world.yaw, 1.1);
  world.container.clientHeight = 690; world.resize(); assert.equal(world.distance, 29);
  world.container.clientWidth = 844; world.container.clientHeight = 390;
  world.resize(); assert.equal(world.distance, 23); assert.equal(world.yaw, 1.1);
  world.container.clientWidth = 390; world.container.clientHeight = 844;
  world.resize(); assert.equal(world.distance, 32); assert.equal(world.yaw, 1.1);
});

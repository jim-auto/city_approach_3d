import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { buildNagoyaConcourse, buildKabukichoLandmarks, MAP_LAYOUTS } from '../src/locations.js';
import { isWalkable, segmentClear, planPath, resolveDestination } from '../src/navigation.js';

function construct(builder) {
  const previous = globalThis.document;
  globalThis.document = { createElement: () => ({ getContext: () => ({ fillRect() {}, strokeRect() {}, fillText() {} }) }) };
  try { const group = new THREE.Group(); builder(group); return group; }
  finally { if (previous === undefined) delete globalThis.document; else globalThis.document = previous; }
}
test('Nagoya is an indoor free concourse: gold at Sakura-dori, silver at Taiko-dori, with gates and escalators', () => {
  const station = construct(buildNagoyaConcourse);
  const gold = station.getObjectByName('gold-clock'), silver = station.getObjectByName('silver-clock');
  assert.equal(gold.position.z, 18); assert.equal(silver.position.z, -20);
  assert.ok(new THREE.Box3().setFromObject(gold).max.y > new THREE.Box3().setFromObject(silver).max.y);
  for (const name of ['central-gates', 'shinkansen-gates', 'towers-escalators', 'sakura-dori-atrium', 'taiko-dori-exit']) assert.ok(station.getObjectByName(name), name);
  assert.ok(station.getObjectByName('sign:太閤通口   Taiko-dori Exit'));
  assert.ok(station.getObjectByName('sign:JR Nagoya Takashimaya'));
});
test('Godzilla Road leads to the Toho cinema; hotel/head sit above its base, and Ichibangai is a separate street', () => {
  const city = construct(buildKabukichoLandmarks);
  const cinema = city.getObjectByName('toho-cinemas'), tower = city.getObjectByName('hotel-gracery-tower'), head = city.getObjectByName('godzilla-head'), gate = city.getObjectByName('ichibangai-gate');
  assert.ok(cinema.position.z < -26); assert.ok(tower.position.z < cinema.position.z);
  assert.ok(head.position.y >= 11); assert.ok(head.position.x < 0);
  assert.ok(Math.abs(gate.position.x) > 12, 'arch must not block the central Godzilla Road');
  assert.ok(city.getObjectByName('sign:TOHOシネマズ 新宿'));
  assert.ok(city.getObjectByName('sign:HOTEL GRACERY'));
});
test('routes between clock plazas and every NPC reach goals without crossing either clock base', () => {
  const layout = MAP_LAYOUTS.nagoya;
  for (const [x, z] of [...layout.people, layout.start, [0, 25], [0, -24]]) {
    const start = { x, z }, goal = { x: layout.goal[0], z: layout.goal[1] };
    const path = planPath(start, goal, layout); assert.ok(path.length);
    let from = start;
    for (const next of path) { assert.ok(isWalkable(next, layout)); assert.ok(segmentClear(from, next, layout)); from = next; }
    assert.deepEqual(path.at(-1), goal);
  }
  const path = planPath({ x: 0, z: 26 }, { x: 0, z: -24 }, layout);
  assert.ok(path.length > 1, 'straight centre route detours around clocks');
  let from = { x: 0, z: 26 };
  for (const next of path) { assert.ok(segmentClear(from, next, layout)); from = next; }
  for (const o of layout.obstacles) assert.ok(isWalkable(resolveDestination(o, layout), layout));
});
test('all map spawn points, interactive people and arrival goals are reachable', () => {
  for (const layout of Object.values(MAP_LAYOUTS)) for (const [x, z] of [layout.start, layout.goal, ...layout.people, ...(layout.streetPeople || [])]) assert.ok(isWalkable({ x, z }, layout));
});

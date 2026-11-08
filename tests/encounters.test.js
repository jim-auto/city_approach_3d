import test from 'node:test';
import assert from 'node:assert/strict';
import { destinationsFor, evaluateInvitation, spokenReplies } from '../src/encounters.js';
import { PROFILES } from '../src/game.js';
import { MAP_LAYOUTS } from '../src/locations.js';
import { planPath, segmentClear, isWalkable } from '../src/navigation.js';

test('every NPC can take street routes to all three invitation destinations', () => {
  for (const map of ['nagoya', 'kabukicho']) {
    const layout = MAP_LAYOUTS[map];
    for (const [x, z] of [...layout.people, ...(layout.streetPeople || []), layout.start]) for (const destination of destinationsFor(map)) {
      const path = planPath({ x, z }, destination, layout); assert.ok(path.length, `${map}/${x},${z}/${destination.id}`);
      let from = { x, z };
      for (const next of path) { assert.ok(isWalkable(next, layout)); assert.ok(segmentClear(from, next, layout)); from = next; }
      assert.deepEqual(path.at(-1), { x: destination.x, z: destination.z });
    }
  }
});
test('Kabukicho map connects central road, parallel Ichibangai, west plaza and north Hanamichi without cutting through blocks', () => {
  const layout = MAP_LAYOUTS.kabukicho;
  assert.equal(isWalkable({ x: 11, z: 0 }, layout), false, 'storefront blocks are not walkable');
  assert.equal(segmentClear({ x: 0, z: 0 }, { x: -22, z: 0 }, layout), false);
  const route = planPath({ x: 0, z: 0 }, { x: -35, z: -32 }, layout);
  assert.ok(route.length > 1, 'plaza is reached through a street junction');
  const tower = layout.landmarks.find(l => l.id === 'tokyu-tower'), plaza = layout.landmarks.find(l => l.id === 'cinecity');
  assert.ok(tower.x < plaza.x && plaza.x < -18);
  const around = planPath({ x: -22, z: -35 }, { x: 21, z: -35 }, layout);
  assert.ok(around.some(p => p.z < -41 || p.z > -23), 'route goes around the Toho footprint');
});
test('invitations require readiness and respect schedule; spoken replies exist for every turn', () => {
  const destinations = destinationsFor('kabukicho'), ready = { favor: 90, discomfort: 12 };
  assert.equal(evaluateInvitation(PROFILES[0], destinations[1], ready).accepted, false);
  assert.equal(evaluateInvitation(PROFILES[0], destinations[0], ready).accepted, true);
  assert.equal(evaluateInvitation(PROFILES[1], destinations[1], ready).accepted, true);
  assert.equal(evaluateInvitation(PROFILES[3], destinations[0], ready).accepted, false);
  for (const talk of [{ favor: 67, discomfort: 0 }, { favor: 100, discomfort: 60 }]) assert.equal(evaluateInvitation(PROFILES[1], destinations[0], talk).accepted, false);
  assert.equal(evaluateInvitation(PROFILES[1], destinations[1], {favor: 80, discomfort: 15}).accepted, false);
  assert.equal(evaluateInvitation(PROFILES[1], destinations[1], {favor: 95, discomfort: 35}).accepted, false);
  for (let turn = 0; turn < 5; turn++) assert.equal(spokenReplies(turn, 'kabukicho').length, 4);
});

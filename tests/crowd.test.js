import test from 'node:test';
import assert from 'node:assert/strict';
import { Vector3 } from 'three';
import { crowdSpawns, visibleCrowd, visibleCast, MOBILE_CAST_LIMIT } from '../src/crowd.js';
import { MAP_LAYOUTS } from '../src/locations.js';
import { isWalkable, resolveDestination } from '../src/navigation.js';

test('larger crowds spread across walkable streets and both ends of the concourse', () => {
  for (const [map, mobile, count] of [['kabukicho', true, 16], ['kabukicho', false, 32], ['nagoya', true, 12], ['nagoya', false, 24]]) {
    const spawns = crowdSpawns(map, mobile);
    assert.equal(spawns.length, count);
    const points = spawns.map(p => resolveDestination(p, MAP_LAYOUTS[map]));
    assert.ok(points.every(p => isWalkable(p, MAP_LAYOUTS[map])));
    assert.ok(points.some(p => p.z < -20) && points.some(p => p.z > 20));
    if (map === 'kabukicho') {
      assert.ok(points.some(p => p.x < -30)); assert.ok(points.some(p => p.x > 17));
      assert.ok(spawns.some(p => p.axis === 'x') && spawns.some(p => p.axis === 'z'));
      assert.ok(points.filter(p => Math.abs(p.x) < 6 && p.z > 0).length >= 4, 'opening street is busier');
    }
  }
});

test('phones keep only eight nearby passersby visible and refresh them when walking to another area', () => {
  const crowd = Array.from({length: 16}, (_, i) => ({ambient: true, mesh: {position: new Vector3(i * 2, 0, 0), visible: false}}));
  const first = visibleCrowd(crowd, new Vector3(), true);
  assert.equal(first.size, 8); assert.ok(first.has(crowd[0])); assert.ok(!first.has(crowd[15]));
  crowd.forEach(n => { n.mesh.visible = first.has(n); });
  const next = visibleCrowd(crowd, new Vector3(30, 0, 0), true);
  assert.equal(next.size, 8); assert.ok(next.has(crowd[15])); assert.ok(!next.has(crowd[0]));
  assert.equal(visibleCrowd(crowd, new Vector3(200, 0, 0), true).size, 0);
});

test('all expanded dating characters remain available while mobile drawing prioritizes the selected woman and companion', () => {
  const cast = Array.from({length: 24}, (_, i) => ({mesh: {position: new Vector3(i * 2, 0, 0), visible: true}}));
  const visible = visibleCast(cast, new Vector3(), true, cast[23], cast[22]);
  assert.equal(visible.size, MOBILE_CAST_LIMIT); assert.ok(visible.has(cast[23])); assert.ok(visible.has(cast[22])); assert.ok(visible.has(cast[0]));
  assert.equal(visibleCast(cast, new Vector3(), false).size, 24);
});

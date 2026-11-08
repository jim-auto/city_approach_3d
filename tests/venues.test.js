import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { KABUKICHO_VENUES, arrivedTogether } from '../src/venues.js';
import { buildKabukichoDistrict, KABUKICHO_LAYOUT } from '../src/kabukicho.js';
import { isWalkable, planPath } from '../src/navigation.js';

test('official map pins preserve west/south placement and lead to reachable ground-floor entrances', () => {
  const [cafe, hotel] = KABUKICHO_VENUES;
  assert.equal(cafe.address, '東京都新宿区歌舞伎町1-21-1 第二東亜会館ビル7F');
  assert.equal(hotel.address, '東京都新宿区歌舞伎町1-13-4');
  assert.ok(cafe.longitude < 139.7020545 && cafe.x < 0);
  assert.ok(hotel.longitude > 139.7020545 && hotel.x > 0);
  assert.ok(hotel.latitude < cafe.latitude && hotel.z > cafe.z);
  assert.deepEqual(KABUKICHO_LAYOUT.destinations.map(v => v.type), ['netcafe', 'lovehotel']);
  for (const venue of KABUKICHO_VENUES) {
    assert.ok(isWalkable(venue, KABUKICHO_LAYOUT));
    assert.ok(planPath({x:0,z:29}, venue, KABUKICHO_LAYOUT).length);
  }
});

test('both venues have named facades and entrance geometry; entrance space stays outside buildings', () => {
  const previous = globalThis.document;
  globalThis.document = {createElement: () => ({getContext: () => ({fillRect(){}, strokeRect(){}, fillText(){}})})};
  try {
    const city = new THREE.Group(); buildKabukichoDistrict(city); city.updateMatrixWorld(true);
    const blockers = []; city.traverse(o => {if(o.userData.cameraBlocker) blockers.push(new THREE.Box3().setFromObject(o));});
    for (const venue of KABUKICHO_VENUES) {
      const facade = city.getObjectByName(venue.id), entrance = city.getObjectByName(`${venue.id}-entrance`);
      assert.ok(facade && entrance); assert.equal(facade.userData.venue, venue.id);
      assert.equal(entrance.position.x, venue.x); assert.equal(entrance.position.z, venue.z);
      assert.ok(blockers.every(b => !b.containsPoint(new THREE.Vector3(venue.x, 1.2, venue.z))), venue.name);
    }
    assert.ok(city.getObjectByName('sign:カスタマカフェ 7F'));
    assert.ok(city.getObjectByName('sign:HOTEL i 入口'));
  } finally {globalThis.document = previous;}
});

test('arrival requires both player and companion at the chosen entrance', () => {
  const goal = KABUKICHO_VENUES[0];
  assert.equal(arrivedTogether(goal, null, goal), false);
  assert.equal(arrivedTogether(goal, {x:goal.x,z:goal.z+4}, goal), false);
  assert.equal(arrivedTogether({x:goal.x,z:goal.z+3}, goal, goal), false);
  assert.equal(arrivedTogether(goal, {x:goal.x+.9,z:goal.z+.9}, goal), true);
});

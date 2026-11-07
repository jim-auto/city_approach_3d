import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Window } from 'happy-dom';
import { Vector3 } from 'three';
import { startGame } from '../src/app.js';
import { MAP_LAYOUTS } from '../src/locations.js';
import { STREET_PROFILES } from '../src/street-encounters.js';
import { PROFILES } from '../src/game.js';

// Test the real application controller and HTML without opening or controlling Chrome.
test('explore → observe → conversation → escort → arrival, help resume, and map switch', async t => {
  const window = new Window({ url: 'http://localhost:5173/' });
  window.document.write(await readFile(new URL('../index.html', import.meta.url), 'utf8'));
  let nextFrame;
  const globals = { window, document: window.document, requestAnimationFrame: callback => { nextFrame = callback; } };
  const previous = new Map();
  for (const [name, value] of Object.entries(globals)) { previous.set(name, Object.getOwnPropertyDescriptor(globalThis, name)); Object.defineProperty(globalThis, name, { configurable: true, value }); }
  window.HTMLDialogElement.prototype.showModal = function () { this.open = true; };
  window.HTMLDialogElement.prototype.close = function () { this.open = false; };
  window.HTMLCanvasElement.prototype.getContext = () => ({});
  t.mock.timers.enable({ apis: ['setTimeout'] });
  class WorldStub {
    constructor(container, labels, onSelect) {
      this.onSelect = onSelect; this.player = { position: new Vector3(0, 0, 8) }; this.keys = new Set(); this.marker = { visible: false }; this.map = 'kabukicho'; this.goal = new Vector3(-6, 0, -22); this.selected = null; this.layout = MAP_LAYOUTS.kabukicho;
    }
    select(n) { this.selected = n; }
    distanceTo(n) { return this.player.position.distanceTo(n.mesh.position); }
    walkTo(pos) { this.destination = pos.clone(); this.player.position.copy(pos); }
    setMap(map) { this.map = map; this.companion = null; }
    walkRoute(points) { this.lastTour = points; this.destination = new Vector3(points[0][0], 0, points[0][1]); return true; }
    setDestination(destination) { this.goal.set(destination.x, 0, destination.z); this.escortDestination = destination; }
    performAction(id) { this.action = id; return !this.paused; }
    cancelAction() { this.action = null; }
    resetCamera() {}
    update() {}
    drawMinimap() {}
  }
  try {
    const { state, world } = startGame(WorldStub), doc = window.document;
    const click = id => doc.getElementById(id).click();
    const choose = key => { doc.querySelector(`[data-response="${key}"]`).click(); t.mock.timers.tick(710); };
    assert.equal(state.mode, 'intro'); assert.match(doc.getElementById('intro').textContent, /ナンパシミュレーター/);
    click('start-tour'); assert.equal(state.mode, 'explore'); assert.equal(world.lastTour.length, 6);
    click('start'); assert.equal(state.mode, 'explore');
    click('menu-toggle'); assert.equal(state.mode, 'menu'); assert.equal(world.paused, true);
    assert.equal(doc.getElementById('game-menu').open, true);
    doc.getElementById('game-menu').dispatchEvent(new window.Event('cancel', { cancelable: true }));
    assert.equal(state.mode, 'explore'); assert.equal(world.paused, false);
    assert.equal(doc.getElementById('game-menu').open, false);
    click('action-toggle'); assert.equal(doc.getElementById('action-menu').hidden, false);
    doc.querySelector('[data-action="jump"]').click(); assert.equal(world.action, 'jump');
    assert.equal(doc.getElementById('action-menu').hidden, true); assert.equal(state.score, 0);
    window.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'e' })); assert.equal(world.action, 'wave');
    click('help'); assert.equal(world.action, null);
    window.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'q' })); assert.equal(world.action, null);
    click('start');
    const npc = { profile: PROFILES[0], mesh: { position: new Vector3(-3.4, 0, 4) }, cooldown: 0 };
    world.npcs = [npc];
    click('nearby-person'); assert.equal(state.selected, npc);
    assert.equal(doc.getElementById('app').dataset.panel, 'observation');
    assert.equal(doc.getElementById('inspect').hidden, false);
    doc.querySelector('[data-action="dance"]').click(); assert.equal(world.action, null, 'observation blocks action commands');
    doc.querySelector('[data-opener="empathy"]').click(); assert.equal(state.mode, 'talk');
    assert.equal(doc.getElementById('app').dataset.panel, undefined);
    assert.equal(doc.getElementById('app').dataset.mode, 'talk');
    // A map change during conversation must not discard its state.
    doc.querySelector('[data-map="nagoya"]').click(); assert.equal(state.map, 'kabukicho');
    choose('listen'); choose('empathy'); choose('empathy'); choose('listen'); choose('proposal');
    assert.equal(state.mode, 'invite'); assert.equal(state.score, 0);
    assert.equal(world.companion, null, 'a conversation alone does not start following');
    doc.querySelector('[data-destination="lounge"]').click();
    assert.equal(doc.getElementById('invite-confirm').hidden, true, 'waiting person declines a long lounge visit');
    click('invite-confirm'); assert.equal(state.mode, 'invite');
    doc.querySelector('[data-destination="plaza"]').click();
    assert.equal(doc.getElementById('invite-confirm').hidden, false);
    click('invite-confirm'); assert.equal(state.mode, 'escort'); assert.equal(state.score, 120); assert.equal(world.companion, npc);
    assert.equal(world.escortDestination.id, 'plaza');
    click('menu-toggle'); assert.equal(state.mode, 'menu');
    click('menu-resume'); assert.equal(state.mode, 'escort'); assert.equal(world.companion, npc);
    click('menu-toggle'); click('help'); assert.equal(state.mode, 'help');
    assert.equal(doc.getElementById('game-menu').open, false);
    click('start');
    assert.equal(state.mode, 'escort'); assert.equal(world.companion, npc, 'help must preserve the companion');
    assert.equal(doc.getElementById('escort').hidden, false);
    click('goal-walk'); assert.deepEqual(world.destination, world.goal);
    npc.mesh.position.copy(world.goal); nextFrame(performance.now() + 16);
    assert.equal(state.mode, 'result'); assert.equal(state.score, 220);
    assert.match(doc.getElementById('result-body').textContent, /シネシティ広場/);
    click('result-next'); assert.equal(state.mode, 'explore'); assert.equal(world.companion, null);
    for (const profile of STREET_PROFILES) {
      const streetNpc = { profile, mesh: { position: world.player.position.clone() }, cooldown: 0 };
      world.onSelect(streetNpc); assert.equal(state.mode, 'street');
      assert.equal(doc.getElementById('street-name').textContent, profile.name);
      assert.equal(doc.getElementById('street-options').children.length, 3);
      doc.getElementById('street-options').firstElementChild.click();
      assert.equal(doc.getElementById('street-options').children.length, 0);
      click('street-close'); assert.equal(state.mode, 'explore'); assert.ok(streetNpc.cooldown > state.elapsed);
      assert.equal(world.companion, null);
    }
    doc.querySelector('[data-map="nagoya"]').click(); assert.equal(state.map, 'nagoya'); assert.equal(world.map, 'nagoya');
    assert.match(doc.getElementById('location-name').textContent, /名古屋駅/);
    const busy = { profile: PROFILES[3], mesh: { position: world.player.position.clone() }, cooldown: 0 };
    world.onSelect(busy); click('leave'); assert.equal(state.score, 240); assert.ok(busy.cooldown > state.elapsed);
    world.onSelect(busy); assert.equal(state.selected, null, 'cooldown prevents immediate score farming');
    assert.equal(doc.getElementById('best').textContent, '240');
    // Aborting a line cancels its delayed callback rather than changing a later scene.
    npc.cooldown = 0; world.onSelect(npc); doc.querySelector('[data-opener="empathy"]').click();
    doc.querySelector('[data-response="listen"]').click(); click('talk-exit');
    const afterAbort = state.score; t.mock.timers.tick(1500); assert.equal(state.mode, 'result'); assert.equal(state.score, afterAbort);
    click('result-next'); npc.cooldown = 0; world.onSelect(npc); doc.querySelector('[data-opener="empathy"]').click();
    choose('listen'); choose('empathy'); choose('empathy'); choose('listen'); choose('proposal');
    assert.equal(state.mode, 'invite');
    doc.querySelector('[data-destination="towers"]').click();
    click('invite-cancel'); assert.equal(state.mode, 'explore'); assert.equal(state.score, afterAbort);
    click('invite-confirm'); assert.equal(world.companion, null); assert.equal(state.score, afterAbort);
  } finally {
    t.mock.timers.reset(); window.happyDOM.abort();
    for (const [name, descriptor] of previous) { if (descriptor) Object.defineProperty(globalThis, name, descriptor); else delete globalThis[name]; }
  }
});

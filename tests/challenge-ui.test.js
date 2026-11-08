import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Window } from 'happy-dom';
import { Vector3 } from 'three';
import { startGame } from '../src/app.js';
import { PROFILES } from '../src/game.js';
import { CHALLENGE, loadRewards } from '../src/challenge.js';
test('girl selection → duet → combos → unlock and equip → replay/cancel → persistent wardrobe', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const window = new Window({ url: 'http://localhost/' }); window.document.write(await readFile(new URL('../index.html', import.meta.url), 'utf8'));
  const old = new Map(); for (const [key, value] of Object.entries({ window, document: window.document, requestAnimationFrame() {} })) { old.set(key, Object.getOwnPropertyDescriptor(globalThis, key)); Object.defineProperty(globalThis, key, { configurable: true, value }); }
  window.HTMLDialogElement.prototype.showModal = function () { this.open = true; }; window.HTMLDialogElement.prototype.close = function () { this.open = false; }; window.HTMLCanvasElement.prototype.getContext = () => ({});
  class World {
    constructor() { this.player = { position: new Vector3() }; this.keys = new Set(); this.npcs = [{profile: PROFILES[0], mesh: {position: new Vector3(2, 0, 0)}, cooldown: 0}]; this.marker = {}; }
    select() {} distanceTo(n) { return this.player.position.distanceTo(n.mesh.position); } walkTo() {} cancelAction() {} beginChallenge(partner) { this.partner = partner; this.active = true; } challengeCue(id) { this.cue = id; } endChallenge() { this.active = false; }
    applyRewards(value) { this.equipped = { ...value }; } performAction(id) { this.action = id; return this.active; } challengeFeedback(grade) { this.grade = grade; }
  }
  try {
    const { state, world, arcade } = startGame(World), doc = window.document, click = id => doc.getElementById(id).click();
    assert.equal(doc.querySelectorAll('.play-actions button:not([hidden])').length, 1);
    assert.ok(doc.querySelector('#game-menu .map-switch'));
    assert.ok(doc.querySelector('#game-menu #action-toggle'));
    assert.equal(doc.getElementById('intro-challenge'), null);
    arcade.start(); assert.equal(state.mode, 'intro', 'no solo challenge'); click('start'); click('nearby-person'); assert.equal(state.selected, world.npcs[0]); click('partner-play'); assert.equal(world.partner, world.npcs[0]); assert.equal(state.mode, 'challenge'); assert.equal(world.paused, true); assert.equal(world.active, true); assert.equal(doc.getElementById('labels').hidden, true);
    Object.defineProperty(doc, 'hidden', { configurable: true, value: true }); arcade.update(3); click('challenge-tap'); assert.equal(arcade.run.elapsed, 0);
    Object.defineProperty(doc, 'hidden', { configurable: true, value: false });
    doc.querySelector('[data-map="nagoya"]').click(); assert.equal(state.map, 'kabukicho');
    for (let i = 0; i < 6; i++) {
      arcade.update(CHALLENGE.leadIn + i * CHALLENGE.beat + .72 * CHALLENGE.beat - arcade.run.elapsed);
      if (i === 2) window.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Enter', cancelable: true })); else click('challenge-tap');
      click('challenge-tap'); assert.equal(arcade.run.results.filter(Boolean).length, i + 1); assert.equal(world.grade, 'perfect'); assert.match(doc.getElementById('challenge-feedback').textContent, /PERFECT/);
    }
    arcade.update(15 - arcade.run.elapsed); assert.equal(state.mode, 'challenge-result'); assert.equal(world.active, false); assert.equal(state.score, 81); assert.equal(arcade.rewards.stars, 16);
    arcade.update(1); assert.equal(state.score, 81); assert.equal(arcade.rewards.stars, 16);
    assert.equal(world.equipped.outfit, 'white'); assert.equal(world.equipped.aura, 'mint'); assert.equal(doc.getElementById('challenge-result').open, true);
    assert.match(doc.getElementById('challenge-unlocked').textContent, /ホワイトジャケット/);
    assert.match(doc.getElementById('challenge-reaction').textContent, /ユイ/);
    click('challenge-retry'); assert.equal(state.mode, 'challenge'); assert.equal(world.partner, world.npcs[0]);
    arcade.update(15); click('challenge-return'); assert.equal(state.selected, world.npcs[0]); assert.equal(doc.getElementById('opener-choices').open, false);
    click('partner-play'); arcade.update(15);
    click('challenge-closet'); assert.equal(state.mode, 'menu'); assert.equal(doc.getElementById('reward-closet').open, true);
    doc.querySelector('[data-reward="burgundy"]').click(); assert.equal(world.equipped.outfit, 'burgundy'); assert.equal(loadRewards(window.localStorage).outfit, 'burgundy');
    doc.querySelector('[data-reward="gold"]').click(); assert.equal(world.equipped.aura, 'mint');
    click('menu-resume'); click('nearby-person'); click('partner-play'); arcade.update(2.328); click('challenge-tap'); click('challenge-cancel');
    assert.equal(state.mode, 'explore'); assert.equal(arcade.rewards.stars, 16); assert.equal(world.paused, false); assert.equal(doc.getElementById('labels').hidden, false);
    click('nearby-person'); click('partner-play'); assert.equal(state.mode, 'challenge');
    window.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', cancelable: true })); assert.equal(state.mode, 'explore');
    click('nearby-person'); world.npcs[0].profile = { ...PROFILES[0], guarded: true }; arcade.start(state.selected); assert.equal(state.mode, 'explore', 'busy people do not join');
    world.npcs[0].profile = { ...PROFILES[0], role: 'catch' }; arcade.start(state.selected); assert.equal(state.mode, 'explore', 'street roles do not join');
    world.npcs[0].profile = PROFILES[0]; world.npcs[0].mesh.position.x = 20; arcade.start(state.selected); assert.equal(state.mode, 'explore', 'must be nearby');
    world.npcs[0].mesh.position.x = 2; world.companion = {}; arcade.start(state.selected); assert.equal(state.mode, 'explore', 'preserves escort');

  } finally {
    t.mock.timers.reset(); window.happyDOM.abort(); for (const [key, descriptor] of old) if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key];
  }
});

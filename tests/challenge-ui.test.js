import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Window } from 'happy-dom';
import { Vector3 } from 'three';
import { startGame } from '../src/app.js';
import { CHALLENGE, loadRewards } from '../src/challenge.js';
test('quick play → combos → unlock and equip → replay/cancel → persistent wardrobe', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const window = new Window({ url: 'http://localhost/' }); window.document.write(await readFile(new URL('../index.html', import.meta.url), 'utf8'));
  const old = new Map(); for (const [key, value] of Object.entries({ window, document: window.document, requestAnimationFrame() {} })) { old.set(key, Object.getOwnPropertyDescriptor(globalThis, key)); Object.defineProperty(globalThis, key, { configurable: true, value }); }
  window.HTMLDialogElement.prototype.showModal = function () { this.open = true; }; window.HTMLDialogElement.prototype.close = function () { this.open = false; }; window.HTMLCanvasElement.prototype.getContext = () => ({});
  class World {
    constructor() { this.player = { position: new Vector3() }; this.keys = new Set(); this.npcs = []; this.marker = {}; }
    select() {} cancelAction() {} beginChallenge() { this.active = true; } endChallenge() { this.active = false; }
    applyRewards(value) { this.equipped = { ...value }; } performAction(id) { this.action = id; return this.active; } challengeFeedback(grade) { this.grade = grade; }
  }
  try {
    const { state, world, arcade } = startGame(World), doc = window.document, click = id => doc.getElementById(id).click();
    click('intro-challenge'); assert.equal(state.mode, 'challenge'); assert.equal(world.paused, true); assert.equal(world.active, true); assert.equal(doc.getElementById('labels').hidden, true);
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
    click('challenge-closet'); assert.equal(state.mode, 'menu'); assert.equal(doc.getElementById('reward-closet').open, true);
    doc.querySelector('[data-reward="burgundy"]').click(); assert.equal(world.equipped.outfit, 'burgundy'); assert.equal(loadRewards(window.localStorage).outfit, 'burgundy');
    doc.querySelector('[data-reward="gold"]').click(); assert.equal(world.equipped.aura, 'mint');
    click('menu-challenge'); arcade.update(2.328); click('challenge-tap'); click('challenge-cancel');
    assert.equal(state.mode, 'explore'); assert.equal(arcade.rewards.stars, 16); assert.equal(world.paused, false); assert.equal(doc.getElementById('labels').hidden, false);
    click('action-toggle'); doc.querySelector('.action-menu .challenge-launch').click(); assert.equal(state.mode, 'challenge');
    window.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', cancelable: true })); assert.equal(state.mode, 'explore');
    world.companion = {}; click('menu-toggle'); click('menu-challenge'); assert.equal(state.mode, 'menu', 'escort cannot be discarded by quick play');
  } finally {
    t.mock.timers.reset(); window.happyDOM.abort(); for (const [key, descriptor] of old) if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key];
  }
});

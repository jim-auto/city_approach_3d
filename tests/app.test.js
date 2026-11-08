import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Window } from 'happy-dom';
import { Vector3 } from 'three';
import { startGame } from '../src/app.js';
import { MAP_LAYOUTS } from '../src/locations.js';
import { STREET_PROFILES } from '../src/street-encounters.js';
import { RHYTHM, TALK_LANES } from '../src/talk-rhythm.js';
import { PROFILES } from '../src/game.js';

// Test the real application controller and HTML without opening or controlling Chrome.
test('explore → observe → conversation → escort → arrival, help resume, and map switch', async t => {
  const window = new Window({ url: 'http://localhost:5173/' });
  window.document.write(await readFile(new URL('../index.html', import.meta.url), 'utf8'));
  let nextFrame, frameClock=performance.now();
  const frame = now => { frameClock=Math.max(frameClock+50,now);nextFrame(frameClock); };
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
    makeGoalPhoto(n, venue) { this.photoSubject=n; return 'data:image/webp;base64,dGVzdA=='; }
    respondToCompanion() { this.gestures=(this.gestures||0)+1; }
    beginChallenge(n) { this.challengePartner=n; }
    endChallenge() { this.challengePartner=null; }
    resetCamera() {}
    update() {}
    drawMinimap() {}
  }
  try {
    const { state, world } = startGame(WorldStub,{now:()=>frameClock}), doc = window.document;
    const click = id => doc.getElementById(id).click();
    const playStage = () => { click('rhythm-muted');
      for(let part=0;part<3;part++){
        for(const n of state.talk.run.notes){frame(state.talk.startedAt+n.time*1000);doc.querySelector(`[data-lane="${TALK_LANES[n.lane].key}"]`).click();}
        frame(state.talk.startedAt+(RHYTHM.duration+.05)*1000);assert.equal(state.talk.phase,'qte');
        if(part===0){frame(state.talk.qteStartedAt+1400);click('qte-button');}
        if(part===1){window.dispatchEvent(new window.KeyboardEvent('keydown',{key:' '}));frame(frameClock+800);window.dispatchEvent(new window.KeyboardEvent('keyup',{key:' '}));}
        if(part===2)window.dispatchEvent(new window.KeyboardEvent('keydown',{key:'ArrowRight'}));
        assert.equal(state.talk.phase,'clear');if(part<2)click('part-next');
      }
      t.mock.timers.tick(1210);
    };
    assert.equal(state.mode, 'intro'); assert.match(doc.getElementById('intro').textContent, /ナンパシミュレーター/);
    click('start-tour'); assert.equal(state.mode, 'explore'); assert.equal(world.lastTour.length, 6);
    click('start'); assert.equal(state.mode, 'explore');
    click('menu-toggle'); assert.equal(state.mode, 'menu'); assert.equal(world.paused, true);
    assert.equal(doc.getElementById('game-menu').open, true);
    doc.getElementById('game-menu').dispatchEvent(new window.Event('cancel', { cancelable: true }));
    assert.equal(state.mode, 'explore'); assert.equal(world.paused, false);
    assert.equal(doc.getElementById('game-menu').open, false);
    click('menu-toggle'); click('action-toggle'); assert.equal(doc.getElementById('action-menu').hidden, false);
    doc.querySelector('[data-action="jump"]').click(); assert.equal(world.action, 'jump');
    assert.equal(doc.getElementById('action-menu').hidden, true); assert.equal(state.score, 0);
    window.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'e' })); assert.equal(world.action, 'wave');
    click('help'); assert.equal(world.action, null);
    window.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'q' })); assert.equal(world.action, null);
    click('start');
    const npc = { profile: PROFILES[0], mesh: { position: new Vector3(-3.4, 0, 4) }, cooldown: 0 };
    world.npcs = [npc, { profile: PROFILES[3], mesh: { position: world.player.position.clone() }, cooldown: 0 }];
    click('nearby-person'); assert.equal(state.selected, npc);
    assert.equal(doc.getElementById('app').dataset.panel, 'observation');
    assert.equal(doc.getElementById('inspect').hidden, false);
    doc.querySelector('[data-action="dance"]').click(); assert.equal(world.action, null, 'observation blocks action commands');
    doc.querySelector('[data-opener="empathy"]').click(); assert.equal(state.mode, 'talk');
    assert.equal(doc.getElementById('app').dataset.panel, undefined);
    assert.equal(doc.getElementById('app').dataset.mode, 'talk');
    // A map change during conversation must not discard its state.
    doc.querySelector('[data-map="nagoya"]').click(); assert.equal(state.map, 'kabukicho');
    playStage();
    assert.equal(state.mode, 'invite'); assert.equal(state.score, 400);
    assert.equal(world.companion, null, 'a conversation alone does not start following');
    doc.querySelector('[data-destination="hotel-i"]').click();
    assert.equal(doc.getElementById('invite-confirm').hidden, true, 'waiting person declines hotel invitation');
    click('invite-confirm'); assert.equal(state.mode, 'invite');
    doc.querySelector('[data-destination="customa"]').click();
    assert.equal(doc.getElementById('invite-confirm').hidden, false);
    click('invite-confirm'); assert.equal(state.mode, 'escort'); assert.equal(state.score, 520); assert.equal(world.companion, npc);
    assert.equal(world.escortDestination.id, 'customa');
    const starting=world.player.position.clone(), direction=world.goal.clone().sub(starting).normalize();
    for(let i=1;i<=9;i++){world.player.position.copy(starting).addScaledVector(direction,i*.2);npc.mesh.position.copy(world.player.position).add(new Vector3(0,0,1));frame(performance.now()+i*80);}
    assert.equal(doc.getElementById('walk-response').hidden,false);
    const walkClock=state.escort.walk.elapsed;click('menu-toggle');frame(performance.now()+1000);assert.equal(state.escort.walk.elapsed,walkClock,'menu pauses walk timer');click('menu-resume');
    const beforeResponse=state.score;click('walk-response');assert.ok(state.score>=beforeResponse+40);assert.equal(world.gestures,1);
    const afterResponse=state.score;click('walk-response');assert.equal(state.score,afterResponse,'double taps do not score');
    click('menu-toggle'); assert.equal(state.mode, 'menu');
    click('menu-resume'); assert.equal(state.mode, 'escort'); assert.equal(world.companion, npc);
    click('menu-toggle'); click('help'); assert.equal(state.mode, 'help');
    assert.equal(doc.getElementById('game-menu').open, false);
    click('start');
    assert.equal(state.mode, 'escort'); assert.equal(world.companion, npc, 'help must preserve the companion');
    assert.equal(doc.getElementById('escort').hidden, false);
    click('goal-walk'); assert.deepEqual(world.destination, world.goal);
    npc.mesh.position.copy(world.goal); frame(performance.now() + 16);
    assert.equal(state.mode, 'result'); assert.ok(state.score>=860); assert.equal(state.clears, 1);
    assert.match(doc.getElementById('result-body').textContent, /カスタマカフェ/);
    assert.equal(doc.getElementById('goal-memory').hidden,false);assert.equal(world.photoSubject,npc);
    const completedScore=state.score;assert.equal(doc.getElementById('result-points').textContent,`${completedScore} pt`);
    assert.equal(doc.getElementById('date-score-lines').children.length,6);
    assert.equal(doc.querySelectorAll('#album-items figure').length,1);
    click('result-next'); assert.equal(state.mode, 'explore'); assert.equal(world.companion, null);
    for (const profile of STREET_PROFILES) {
      const streetNpc = { profile, mesh: { position: world.player.position.clone() }, cooldown: 0 };
      if (profile.role === 'toyoko') { world.npcs = [streetNpc]; frame(performance.now() + 32); assert.equal(state.mode, 'explore', 'plaza group does not interrupt passing players'); }
      world.onSelect(streetNpc); assert.equal(state.mode, 'street');
      assert.equal(doc.getElementById('street-name').textContent, `${profile.name}（${profile.age}歳）`);
      assert.equal(doc.getElementById('street-options').children.length, 3);
      doc.getElementById('street-options').firstElementChild.click();
      assert.equal(doc.getElementById('street-options').children.length, 0);
      click('street-close'); assert.equal(state.mode, 'explore'); assert.ok(streetNpc.cooldown > state.elapsed);
      assert.equal(world.companion, null);
    }
    click('menu-toggle'); click('menu-nightlife'); assert.equal(state.mode, 'explore');
    assert.equal(world.destination.x, 24); assert.equal(world.destination.z, -36);
    click('menu-toggle'); click('menu-plaza'); assert.equal(state.mode, 'explore');
    assert.equal(world.destination.x, -34); assert.equal(world.destination.z, -33);
    doc.querySelector('[data-map="nagoya"]').click(); assert.equal(state.map, 'nagoya'); assert.equal(world.map, 'nagoya');
    assert.match(doc.getElementById('location-name').textContent, /名古屋駅/);
    const busy = { profile: PROFILES[3], mesh: { position: world.player.position.clone() }, cooldown: 0 };
    world.onSelect(busy); click('leave'); assert.equal(state.score, completedScore); assert.ok(busy.cooldown > state.elapsed);
    world.onSelect(busy); assert.equal(state.selected, null, 'cooldown prevents immediate score farming');
    assert.equal(doc.getElementById('best').textContent, String(completedScore));
    // Aborting a line cancels its delayed callback rather than changing a later scene.
    npc.cooldown = 0; world.onSelect(npc); doc.querySelector('[data-opener="empathy"]').click();
    click('rhythm-muted'); click('talk-exit');
    const afterAbort = state.score; t.mock.timers.tick(2000); assert.equal(state.mode, 'result'); assert.equal(state.score, afterAbort);
    click('result-next'); npc.cooldown = 0; world.onSelect(npc); doc.querySelector('[data-opener="empathy"]').click();
    playStage();
    assert.equal(state.mode, 'invite');
    doc.querySelector('[data-destination="towers"]').click();
    const beforeCancel=state.score;click('invite-cancel'); assert.equal(state.mode, 'explore'); assert.equal(state.score, beforeCancel);
    click('invite-confirm'); assert.equal(world.companion, null); assert.equal(state.score, beforeCancel);
    assert.equal(state.clears, 1, 'points alone cannot produce another goal clear');
    // Nagoya remains a practice area: reaching a clock must not clear the game.
    const practice = {profile: PROFILES[8], mesh: {position: world.player.position.clone()}, cooldown: 0};
    world.npcs = [practice]; world.onSelect(practice); click('approach-start');
    playStage();
    doc.querySelector('[data-destination="gold"]').click(); click('invite-confirm');
    click('goal-walk'); practice.mesh.position.copy(world.goal); frame(performance.now() + 100);
    assert.equal(state.clears, 1); assert.doesNotMatch(doc.getElementById('result-title').textContent, /CLEAR|デート成立/); assert.equal(doc.getElementById('goal-memory').hidden,true); click('result-next');
    doc.querySelector('[data-map="kabukicho"]').click();
    // Every added woman starts a real conversation from the primary button and can complete a date.
    for (const profile of PROFILES.slice(8)) {
      const added = { profile, mesh: { position: world.player.position.clone() }, cooldown: 0 };
      world.npcs = [added]; world.onSelect(added);
      assert.equal(doc.getElementById('opener-choices').open, false);
      click('partner-play'); assert.equal(state.mode, 'challenge', `${profile.name}: duet`);
      assert.match(doc.getElementById('challenge-partner').textContent, new RegExp(profile.name));
      click('challenge-cancel'); world.onSelect(added);
      click('approach-start'); assert.equal(state.mode, 'talk', profile.name);
      assert.equal(doc.getElementById('talk-name').textContent, profile.name);
      assert.match(doc.getElementById('talk-feedback').textContent, /あなた/);
      playStage();
      assert.equal(state.mode, 'invite', profile.name);
      doc.querySelector('[data-destination="hotel-i"]').click(); click('invite-confirm');
      assert.equal(state.mode, 'escort'); assert.equal(world.companion, added);
      click('goal-walk'); added.mesh.position.copy(world.goal).add(new Vector3(0,0,4)); frame(performance.now() + 100);
      assert.equal(state.mode, 'escort', 'player alone at the entrance does not clear');
      added.mesh.position.copy(world.goal); frame(performance.now() + 150);
      assert.equal(state.mode, 'result', `${profile.name}: date arrival`);
      assert.match(doc.getElementById('result-title').textContent, /デート成立/);
      click('result-next');
    }
    assert.equal(state.clears, 9, 'only eight actual hotel arrivals add to the cafe goal');
    // Wrong lanes cannot be repaired by tapping every button; hiding the tab pauses the song.
    npc.cooldown=0;npc.mesh.position.copy(world.player.position);world.onSelect(npc);click('approach-start');
    assert.equal(world.challengePartner,npc);click('rhythm-muted');
    const startingScore=state.score, first=state.talk.run.notes[0];
    frame(state.talk.startedAt+first.time*1000);
    doc.querySelector(`[data-lane="${TALK_LANES[(first.lane+1)%3].key}"]`).click();
    doc.querySelector(`[data-lane="${TALK_LANES[first.lane].key}"]`).click();
    assert.equal(state.talk.run.hits,0);assert.equal(state.score,startingScore);
    assert.equal(doc.getElementById('conversation').dataset.grade,'miss');
    const elapsed=state.talk.run.elapsed;
    Object.defineProperty(window.document,'hidden',{configurable:true,value:true});doc.dispatchEvent(new window.Event('visibilitychange'));frame(frameClock+10000);
    Object.defineProperty(window.document,'hidden',{configurable:true,value:false});doc.dispatchEvent(new window.Event('visibilitychange'));
    frame(frameClock+50);assert.ok(state.talk.run.elapsed<elapsed+.1,'background tab does not consume song time');
    frame(state.talk.startedAt+(RHYTHM.duration+.1)*1000);assert.equal(state.talk.phase,'retry');
    click('part-next');assert.equal(state.talk.progress.index,0,'cannot skip failed part');
    assert.equal(state.attempt.conversation,0,'failed attempts do not bank or farm points');
    click('part-retry');assert.equal(state.talk.phase,'rhythm');assert.equal(state.talk.progress.index,0);
    for(const n of state.talk.run.notes){frame(state.talk.startedAt+n.time*1000);doc.querySelector(`[data-lane="${TALK_LANES[n.lane].key}"]`).click();}
    frame(state.talk.startedAt+(RHYTHM.duration+.1)*1000);assert.equal(state.talk.phase,'qte');
    click('qte-button');assert.equal(state.talk.phase,'retry','early QTE must not progress');
    click('part-next');assert.equal(state.talk.progress.index,0);click('part-retry');
    frame(state.talk.qteStartedAt+1400);click('qte-button');assert.equal(state.talk.progress.cleared.length,1);
    const paid=state.score;click('qte-button');assert.equal(state.score,paid,'QTE cannot pay twice');
    click('part-next');assert.equal(state.talk.progress.index,1);assert.equal(state.talk.phase,'rhythm');
    click('talk-exit');assert.equal(world.challengePartner,null);t.mock.timers.tick(2000);assert.equal(state.mode,'result');
  } finally {
    t.mock.timers.reset(); window.happyDOM.abort();
    for (const [name, descriptor] of previous) { if (descriptor) Object.defineProperty(globalThis, name, descriptor); else delete globalThis[name]; }
  }
});

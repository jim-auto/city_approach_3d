import test from 'node:test';
import assert from 'node:assert/strict';
import { PROFILES, evaluateOpener, buildLines, applyResponse, rank, loadBest, saveBest } from '../src/game.js';

test('guarded NPCs decline every opener; stepping away is the field choice', () => {
  for (const p of PROFILES.filter(p => p.guarded)) for (const key of ['empathy', 'situation', 'item', 'joke']) assert.equal(evaluateOpener(p, key).success, false);
});
test('each receptive profile can complete a contextual conversation in both maps', () => {
  for (const profile of PROFILES.filter(p => !p.guarded)) for (const map of ['nagoya', 'kabukicho']) {
    let state = { ...evaluateOpener(profile, profile.open[0], map), chain: 0 };
    assert.equal(state.success, true);
    const lines = buildLines(profile, map);
    for (let i = 0; i < lines.length; i++) {
      state = applyResponse(state, lines[i], lines[i].correct[0]);
      assert.equal(state.accepted, i === lines.length - 1, `${profile.id} / ${map} / turn ${i}`);
      assert.ok(state.favor >= 0 && state.favor <= 100);
    }
  }
});
test('high favor alone does not accept an invitation without the right context', () => {
  const state = { favor: 100, discomfort: 0, chain: 0 };
  assert.equal(applyResponse(state, { correct: ['proposal'], cue: '道案内' }, 'proposal').accepted, false);
  assert.equal(applyResponse({ ...state, discomfort: 60 }, { correct: ['proposal'], cue: '次の予定を提案する場面' }, 'proposal').accepted, false);
  assert.equal(applyResponse({ ...state, favor: 67 }, { correct: ['proposal'], cue: '次の予定を提案する場面' }, 'proposal').accepted, false);
});
test('listening is safe, repeated unrelated responses increase discomfort', () => {
  const line = { correct: ['empathy'], cue: '共感' }, s = { favor: 50, discomfort: 20, chain: 2 };
  const safe = applyResponse(s, line, 'listen'); assert.equal(safe.discomfort, 16); assert.equal(safe.favor, 50);
  const wrong = applyResponse(s, line, 'joke'); assert.equal(wrong.discomfort, 42); assert.equal(wrong.chain, 0);
});
test('rank and storage tolerate missing, invalid or blocked browser storage', () => {
  assert.equal(rank(500), 'S'); assert.equal(rank(0), 'D'); assert.equal(loadBest(null), 0);
  assert.equal(loadBest({ getItem: () => '-20' }), 0); assert.equal(loadBest({ getItem: () => 'bad' }), 0);
  assert.equal(loadBest({ getItem: () => 'Infinity' }), 0);
  assert.equal(loadBest({ getItem: () => { throw Error('blocked'); } }), 0);
  assert.doesNotThrow(() => saveBest(null, 100));
  const data = new Map(), storage = { getItem: k => data.get(k), setItem: (k, v) => data.set(k, v) }; saveBest(storage, 220); assert.equal(loadBest(storage), 220);
});

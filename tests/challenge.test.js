import test from 'node:test';
import assert from 'node:assert/strict';
import { CHALLENGE, createChallenge, challengeBeat, advanceChallenge, tapChallenge, challengeResult, grantChallenge, loadRewards, saveRewards, cleanRewards, equipReward } from '../src/challenge.js';
function play(grades) {
  const run = createChallenge();
  for (const [i, grade] of grades.entries()) {
    const target = CHALLENGE.leadIn + i * CHALLENGE.beat + (grade === 'perfect' ? .72 : grade === 'good' ? .84 : .15) * CHALLENGE.beat;
    advanceChallenge(run, target - run.elapsed); tapChallenge(run);
  }
  advanceChallenge(run, 15 - run.elapsed); return run;
}
test('six timed taps finish in 15 seconds; repeated taps and pre-start inputs cannot add rewards', () => {
  const run = createChallenge(); assert.equal(tapChallenge(run), null);
  advanceChallenge(run, .6 + .72 * 2.4); assert.equal(tapChallenge(run).grade, 'perfect');
  assert.equal(tapChallenge(run), null); assert.equal(run.score, 110);
  advanceChallenge(run, 15); assert.equal(run.finished, true); assert.equal(run.results.length, 6); assert.equal(challengeBeat(run).ready, false);
  assert.equal(tapChallenge(run), null); assert.equal(challengeResult(run).hits, 1);
  const all = play(Array(6).fill('perfect')); assert.deepEqual(challengeResult(all), { perfect: 6, good: 0, hits: 6, combo: 6, score: 810, stars: 16 });
});
test('misses reset the combo; idle, interrupted and already claimed rounds give no extra rewards', () => {
  const run = play(['perfect', 'good', 'miss', 'good', 'good', 'good']); assert.equal(run.maxCombo, 3); assert.equal(challengeResult(run).stars, 10);
  const idle = createChallenge(); advanceChallenge(idle, NaN); assert.equal(idle.elapsed, 0); advanceChallenge(idle, 15);
  assert.equal(challengeResult(idle).stars, 0); assert.equal(grantChallenge(cleanRewards(), createChallenge()).stars, 0);
  const first = grantChallenge(cleanRewards(), run); assert.equal(first.stars, 10); assert.equal(grantChallenge(first.rewards, run).stars, 0);
});
test('a single good hit earns the first outfit, unlocks accumulate and locked equipment is rejected', () => {
  const first = grantChallenge(cleanRewards(), play(['good'])); assert.equal(first.stars, 3); assert.equal(first.rewards.outfit, 'burgundy');
  assert.deepEqual(equipReward(first.rewards, 'gold'), first.rewards);
  const next = grantChallenge(first.rewards, play(Array(6).fill('perfect'))); assert.equal(next.rewards.stars, 19); assert.equal(next.rewards.outfit, 'white'); assert.equal(next.rewards.aura, 'mint');
  assert.equal(equipReward(next.rewards, 'burgundy').outfit, 'burgundy');
  const third = grantChallenge(next.rewards, play(Array(6).fill('perfect'))); assert.equal(third.rewards.aura, 'gold');
});
test('stars, best score and equipment survive reload; malformed and blocked storage remain playable', () => {
  const memory = new Map(), storage = { getItem: key => memory.get(key), setItem: (key, value) => memory.set(key, value) };
  const rewards = grantChallenge(cleanRewards(), play(Array(6).fill('perfect'))).rewards; saveRewards(storage, rewards); assert.deepEqual(loadRewards(storage), rewards);
  memory.set('city-approach-rewards-v1', '{bad'); assert.deepEqual(loadRewards(storage), cleanRewards());
  const blocked = { getItem() { throw Error(); }, setItem() { throw Error(); } }; assert.deepEqual(loadRewards(blocked), cleanRewards()); assert.doesNotThrow(() => saveRewards(blocked, rewards));
  assert.deepEqual(cleanRewards({ stars: -1, aura: 'gold', outfit: 'white', best: -10 }), cleanRewards());
});

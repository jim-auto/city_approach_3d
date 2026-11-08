export const CHALLENGE = { duration: 15, leadIn: .6, beat: 2.4, rounds: 6, center: .72, perfect: .065, good: .16 };
export const CUES = ['jump', 'wave', 'dance', 'jump', 'dance', 'wave'];
export function createChallenge() { return { elapsed: 0, results: [], combo: 0, maxCombo: 0, score: 0, finished: false }; }
export function challengeBeat(run) {
  const time = run.elapsed - CHALLENGE.leadIn, round = Math.min(CHALLENGE.rounds - 1, Math.max(0, Math.floor(time / CHALLENGE.beat)));
  return { round, phase: Math.max(0, time / CHALLENGE.beat - round), ready: time >= 0 && !run.finished && !run.results[round], cue: CUES[round] };
}
function record(run, round, grade) {
  if (run.results[round]) return null;
  run.combo = grade === 'miss' ? 0 : run.combo + 1; run.maxCombo = Math.max(run.maxCombo, run.combo);
  const points = grade === 'miss' ? 0 : (grade === 'perfect' ? 100 : 60) + run.combo * 10;
  run.score += points; return run.results[round] = { grade, points };
}
export function advanceChallenge(run, dt) {
  if (run.finished || !Number.isFinite(dt) || dt <= 0) return;
  run.elapsed = Math.min(CHALLENGE.duration, run.elapsed + dt);
  for (let i = 0; i < CHALLENGE.rounds; i++) if (run.elapsed >= CHALLENGE.leadIn + (i + 1) * CHALLENGE.beat - 1e-8) record(run, i, 'miss');
  run.finished = run.elapsed >= CHALLENGE.duration;
}
export function tapChallenge(run) {
  const beat = challengeBeat(run); if (!beat.ready) return null;
  const distance = Math.abs(beat.phase - CHALLENGE.center), grade = distance <= CHALLENGE.perfect + 1e-8 ? 'perfect' : distance <= CHALLENGE.good + 1e-8 ? 'good' : 'miss';
  return { ...record(run, beat.round, grade), cue: beat.cue };
}
export function challengeResult(run) {
  const perfect = run.results.filter(r => r.grade === 'perfect').length, good = run.results.filter(r => r.grade === 'good').length;
  return { perfect, good, hits: perfect + good, combo: run.maxCombo, score: run.score, stars: perfect + good ? 2 + perfect * 2 + good + (run.maxCombo >= 3 ? 2 : 0) : 0 };
}
export const REWARDS = [
  { id: 'default', slot: 'outfit', label: 'ストリートネイビー', cost: 0, color: '#303544' },
  { id: 'burgundy', slot: 'outfit', label: 'ボルドージャケット', cost: 3, color: '#a95a70' },
  { id: 'white', slot: 'outfit', label: 'ホワイトジャケット', cost: 16, color: '#e2dfd4' },
  { id: 'none', slot: 'aura', label: 'オーラなし', cost: 0 },
  { id: 'mint', slot: 'aura', label: 'ミントオーラ', cost: 8, color: '#a6efd2' },
  { id: 'gold', slot: 'aura', label: 'ゴールドオーラ', cost: 26, color: '#ffd27a' },
  { id: 'untitled', slot: 'title', label: '称号なし', cost: 0 },
  { id: 'street-star', slot: 'title', label: 'ストリートスター', cost: 40 },
];
const KEY = 'city-approach-rewards-v1';
export function cleanRewards(value = {}) {
  const stars = Number.isSafeInteger(value?.stars) && value.stars >= 0 ? Math.min(value.stars, 999999) : 0;
  const result = { stars, best: Number.isSafeInteger(value?.best) && value.best >= 0 ? Math.min(810, value.best) : 0, outfit: 'default', aura: 'none', title: 'untitled' };
  for (const slot of ['outfit', 'aura', 'title']) if (REWARDS.some(r => r.slot === slot && r.id === value?.[slot] && r.cost <= stars)) result[slot] = value[slot];
  return result;
}
export function loadRewards(storage) { try { return cleanRewards(JSON.parse(storage?.getItem(KEY) || '{}')); } catch { return cleanRewards(); } }
export function saveRewards(storage, rewards) { try { storage?.setItem(KEY, JSON.stringify(cleanRewards(rewards))); } catch { /* Play without persistence when storage is unavailable. */ } }
export function grantChallenge(rewards, run) {
  if (!run.finished || run.claimed) return { rewards, unlocked: [], stars: 0 };
  run.claimed = true; const result = challengeResult(run), next = cleanRewards({ ...rewards, stars: rewards.stars + result.stars, best: Math.max(rewards.best, result.score) });
  const unlocked = REWARDS.filter(r => r.cost > rewards.stars && r.cost <= next.stars);
  for (const item of unlocked) next[item.slot] = item.id;
  return { rewards: next, unlocked, stars: result.stars };
}
export function equipReward(rewards, id) {
  const item = REWARDS.find(r => r.id === id); if (!item || item.cost > rewards.stars) return rewards;
  return { ...rewards, [item.slot]: id };
}

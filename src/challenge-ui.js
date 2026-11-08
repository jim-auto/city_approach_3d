import { CHALLENGE, REWARDS, createChallenge, challengeBeat, advanceChallenge, tapChallenge, challengeResult, loadRewards, saveRewards, grantChallenge, equipReward } from './challenge.js';
import { ACTIONS } from './actions.js';
export function createChallengeUI({ world, storage, mode, canStart, enter, leave, award, tone }) {
  const $ = id => document.getElementById(id);
  let run = null, rewards = loadRewards(storage), lastRound = -1;
  const apply = () => {
    world.applyRewards?.(rewards);
    const title = rewards.title === 'street-star' ? ' · ★ストリートスター' : '';
    $('guide').querySelector('strong').textContent = 'ナンパシミュレーター' + title;
  };
  function renderCloset() {
    $('reward-stars').textContent = `★ ${rewards.stars}　ベスト ${rewards.best} pt`;
    $('reward-items').replaceChildren(...REWARDS.map(item => {
      const button = document.createElement('button'), unlocked = rewards.stars >= item.cost;
      button.dataset.reward = item.id; button.disabled = !unlocked;
      button.classList.toggle('equipped', rewards[item.slot] === item.id);
      button.textContent = `${rewards[item.slot] === item.id ? '✓ ' : ''}${item.label}`;
      const small = document.createElement('small'); small.textContent = unlocked ? rewards[item.slot] === item.id ? '装備中' : 'タップで装備' : `あと ${item.cost - rewards.stars} ★`; button.append(small);
      button.addEventListener('click', () => {
        if (mode() !== 'menu' && mode() !== 'challenge-result') return;
        rewards = equipReward(rewards, item.id); saveRewards(storage, rewards); apply(); renderCloset();
      }); return button;
    }));
  }
  function render() {
    if (!run) return;
    const beat = challengeBeat(run), action = ACTIONS.find(a => a.id === beat.cue), hit = run.results[beat.round];
    $('challenge-time').textContent = `${Math.ceil(CHALLENGE.duration - run.elapsed)}秒`;
    $('challenge-round').textContent = `${beat.round + 1} / ${CHALLENGE.rounds}`;
    $('challenge-combo').textContent = `${run.combo} COMBO`;
    $('challenge-cue').textContent = `${action.icon} ${action.label}`;
    $('challenge-cursor').style.left = `${Math.min(1, beat.phase) * 100}%`;
    $('challenge-tap').disabled = !beat.ready;
    $('challenge-tap').textContent = run.elapsed < CHALLENGE.leadIn ? 'READY…' : hit ? '次の合図を待とう' : 'タップ！';
    if (beat.round !== lastRound) { lastRound = beat.round; $('challenge-feedback').textContent = '青いゾーンで1回タップ'; $('challenge-feedback').dataset.grade = ''; }
    [...$('challenge-dots').children].forEach((dot, i) => { dot.dataset.grade = run.results[i]?.grade || ''; dot.textContent = run.results[i] ? run.results[i].grade === 'miss' ? '−' : '★' : '·'; });
  }
  function start() {
    if (!canStart()) return;
    $('intro').close(); $('game-menu').close(); $('challenge-result').close();
    enter('challenge'); world.beginChallenge?.();
    run = createChallenge(); lastRound = -1; $('challenge-panel').hidden = false;
    $('challenge-dots').replaceChildren(...Array.from({ length: CHALLENGE.rounds }, () => document.createElement('span')));
    render(); $('challenge-tap').focus();
  }
  function finish() {
    const result = challengeResult(run), granted = grantChallenge(rewards, run); rewards = granted.rewards;
    saveRewards(storage, rewards); apply(); renderCloset();
    award(Math.round(result.score / 10)); world.endChallenge?.(); $('challenge-panel').hidden = true; enter('challenge-result');
    $('challenge-result-title').textContent = result.hits === 6 ? 'フルコンボ！' : result.hits ? 'NICE ACTION！' : 'もう一度やってみよう';
    $('challenge-result-score').textContent = `${result.score} pt　${result.hits}/6 成功　最大 ${result.combo} COMBO`;
    $('challenge-earned').textContent = `+${granted.stars} ★　合計 ${rewards.stars} ★`;
    $('challenge-unlocked').replaceChildren();
    for (const item of granted.unlocked) { const line = document.createElement('p'); line.textContent = `🎁 ${item.label}を解放${rewards[item.slot] === item.id ? '・装備！' : '！'}`; $('challenge-unlocked').append(line); }
    const next = REWARDS.filter(r => r.cost > rewards.stars).sort((a, b) => a.cost - b.cost)[0];
    $('challenge-next').textContent = !result.hits ? 'バーが青いゾーンに入ったらタップ。成功1回からスターGET！' : next ? `次は「${next.label}」まで ${next.cost - rewards.stars} ★` : 'すべての特典を解放！ ベスト更新に挑戦しよう。';
    $('challenge-result').showModal(); $('challenge-retry').focus(); tone(result.hits ? 'success' : 'miss');
  }
  function tap() {
    if (mode() !== 'challenge' || document.hidden || !run) return;
    const result = tapChallenge(run); if (!result) return;
    $('challenge-feedback').textContent = result.grade === 'perfect' ? 'PERFECT！' : result.grade === 'good' ? 'GOOD！' : 'MISS · 次で取り返そう'; $('challenge-feedback').dataset.grade = result.grade;
    world.challengeFeedback?.(result.grade);
    if (result.grade !== 'miss') world.performAction(result.cue);
    tone(result.grade === 'miss' ? 'miss' : 'success'); render();
  }
  function stop() {
    if (!['challenge', 'challenge-result'].includes(mode())) return;
    run = null; world.endChallenge?.(); $('challenge-panel').hidden = true; $('challenge-result').close(); leave();
  }
  $('challenge-tap').addEventListener('click', tap); $('challenge-cancel').addEventListener('click', stop);
  $('intro-challenge').addEventListener('click', start); $('menu-challenge').addEventListener('click', start);
  $('challenge-retry').addEventListener('click', start); $('challenge-return').addEventListener('click', stop);
  $('challenge-result').addEventListener('cancel', event => { event.preventDefault(); stop(); });
  $('challenge-closet').addEventListener('click', () => { stop(); $('menu-toggle').click(); $('reward-closet').open = true; });
  window.addEventListener('keydown', event => {
    if (!['challenge', 'challenge-result'].includes(mode()) || event.repeat || event.ctrlKey || event.metaKey || event.altKey) return;
    if (event.key === 'Escape') { event.preventDefault(); stop(); }
    else if (mode() === 'challenge' && [' ', 'Enter'].includes(event.key) && event.target?.id !== 'challenge-cancel') { event.preventDefault(); tap(); }
  });
  apply(); renderCloset();
  return { start, renderCloset, update(dt) { if (mode() !== 'challenge' || document.hidden || !run) return; advanceChallenge(run, dt); render(); if (run.finished) finish(); }, get run() { return run; }, get rewards() { return rewards; } };
}

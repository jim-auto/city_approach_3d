import { CHALLENGE, REWARDS, createChallenge, challengeBeat, advanceChallenge, tapChallenge, challengeResult, loadRewards, saveRewards, grantChallenge, equipReward } from './challenge.js';
import { ACTIONS } from './actions.js';
export function createChallengeUI({ world, storage, mode, canStart, enter, leave, award, tone }) {
  const $ = id => document.getElementById(id);
  let run = null, rewards = loadRewards(storage), lastRound = -1, partner = null;
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
    $('challenge-partner').textContent = `${partner.profile.name}とリズム遊び`;
    $('challenge-round').textContent = `${beat.round + 1} / ${CHALLENGE.rounds}`;
    $('challenge-cue').textContent = `${action.icon} ${{ jump: '一緒にジャンプ', wave: '同じタイミングで手を振ろう', dance: '一緒にダンス' }[beat.cue]}`;
    $('challenge-cursor').style.left = `${Math.min(1, beat.phase) * 100}%`;
    $('challenge-tap').disabled = !beat.ready;
    $('challenge-tap').textContent = run.elapsed < CHALLENGE.leadIn ? 'READY…' : hit ? '次の合図を待とう' : '青いゾーンでタップ';
    if (beat.round !== lastRound) { lastRound = beat.round; world.challengeCue?.(beat.cue); $('challenge-feedback').textContent = run.elapsed < CHALLENGE.leadIn ? `${partner.profile.name}「いいよ、一緒にやろう！」` : '相手を見て、青いゾーンでタップ'; $('challenge-feedback').dataset.grade = ''; }
  }
  function start(person = partner) {
    if (!canStart(person)) return;
    partner = person;
    $('intro').close(); $('game-menu').close(); $('challenge-result').close();
    enter('challenge'); world.beginChallenge?.(partner);
    run = createChallenge(); lastRound = -1; $('challenge-panel').hidden = false;
    render(); $('challenge-tap').focus();
  }
  function finish() {
    const result = challengeResult(run), granted = grantChallenge(rewards, run); rewards = granted.rewards;
    saveRewards(storage, rewards); apply(); renderCloset();
    award(Math.round(result.score / 10)); world.endChallenge?.(); $('challenge-panel').hidden = true; enter('challenge-result');
    $('challenge-result-title').textContent = result.hits === 6 ? 'フルコンボ！' : result.hits ? '息が合ってきた！' : 'もう一度やってみよう';
    $('challenge-reaction').textContent = `${partner.profile.name}「${result.hits >= 5 ? 'すごい！ ぴったりだったね。また一緒にやろう！' : result.hits >= 2 ? '楽しかった！ ちょっと息が合ってきたね。' : '次は私を見て、一緒に合わせてみよう！'}」`;
    $('challenge-result-score').textContent = `${result.score} pt　${result.hits}/6 成功　最大 ${result.combo} COMBO`;
    $('challenge-earned').textContent = `+${granted.stars} ★　合計 ${rewards.stars} ★`;
    $('challenge-unlocked').replaceChildren();
    for (const item of granted.unlocked) { const line = document.createElement('p'); line.textContent = `🎁 ${item.label}を解放${rewards[item.slot] === item.id ? '・装備！' : '！'}`; $('challenge-unlocked').append(line); }
    const next = REWARDS.filter(r => r.cost > rewards.stars).sort((a, b) => a.cost - b.cost)[0];
    $('challenge-next').textContent = !result.hits ? 'バーが青いゾーンに入ったらタップ。成功1回からスターGET！' : next ? `次は「${next.label}」まで ${next.cost - rewards.stars} ★` : 'すべての特典を解放！ ベスト更新に挑戦しよう。';
    $('challenge-result').querySelector('details').open = false; $('challenge-result').showModal(); $('challenge-return').focus(); tone(result.hits ? 'success' : 'miss');
  }
  function tap() {
    if (mode() !== 'challenge' || document.hidden || !run) return;
    const result = tapChallenge(run); if (!result) return;
    $('challenge-feedback').textContent = result.grade === 'perfect' ? `${partner.profile.name}「ぴったり！」 PERFECT` : result.grade === 'good' ? `${partner.profile.name}「いい感じ！」 GOOD` : `${partner.profile.name}「次、合わせよう！」`; $('challenge-feedback').dataset.grade = result.grade;
    world.challengeFeedback?.(result.grade);
    if (result.grade !== 'miss') { world.performAction(result.cue); world.challengeCue?.(result.cue); }
    tone(result.grade === 'miss' ? 'miss' : 'success'); render();
  }
  function stop(talk = false) {
    if (!['challenge', 'challenge-result'].includes(mode())) return;
    run = null; world.endChallenge?.(); $('challenge-panel').hidden = true; $('challenge-result').close(); leave(talk ? partner : null);
  }
  $('challenge-tap').addEventListener('click', tap); $('challenge-cancel').addEventListener('click', () => stop());
  $('challenge-retry').addEventListener('click', () => start()); $('challenge-return').addEventListener('click', () => stop(true));
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

import { ACTIONS } from './actions.js';
import { bindVirtualStick } from './input.js';
import { OPENERS, RESPONSES, evaluateOpener, buildLines, applyResponse, rank, loadBest, saveBest } from './game.js';

export function startGame(CityWorld) {
const $ = id => document.getElementById(id);
let storage; try { storage = window.localStorage; } catch { storage = null; }
const state = { score: 0, best: loadBest(storage), map: 'kabukicho', mode: 'intro', selected: null, talk: null, sound: false, elapsed: 0, clearShown: false };
let world, toastTimer, talkTimer, resultAction, audio;
let resetTouch = () => {};
function tone(kind = 'click') {
  if (!state.sound) return;
  try {
    audio ||= new (window.AudioContext || window.webkitAudioContext)(); audio.resume();
    const oscillator = audio.createOscillator(), volume = audio.createGain(); oscillator.connect(volume); volume.connect(audio.destination);
    oscillator.type = 'sine'; oscillator.frequency.setValueAtTime(kind === 'success' ? 660 : kind === 'miss' ? 210 : 440, audio.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(kind === 'success' ? 990 : 330, audio.currentTime + .12);
    volume.gain.setValueAtTime(.07, audio.currentTime); volume.gain.exponentialRampToValueAtTime(.001, audio.currentTime + .23); oscillator.start(); oscillator.stop(audio.currentTime + .24);
  } catch { /* Audio is optional. */ }
}
function toast(text) { $('toast').textContent = text; $('toast').classList.add('show'); clearTimeout(toastTimer); toastTimer = setTimeout(() => $('toast').classList.remove('show'), 4300); }
function score(points) { state.score += points; state.best = Math.max(state.best, state.score); saveBest(storage, state.best); updateScore(); }
function updateScore() { $('score').textContent = String(state.score).padStart(3, '0'); $('best').textContent = String(state.best).padStart(3, '0'); $('rank').textContent = rank(state.score); $('score-progress').style.width = `${Math.min(100, state.score / 5)}%`; $('clear-progress').textContent = state.score >= 500 ? 'CITY CLEAR · 街のつながりが広がった！' : `CITY CLEAR まで ${500 - state.score} pt`; }
function mission(step, title, text, number = '01') { $('mission-step').textContent = step; $('mission-title').textContent = title; $('mission-text').textContent = text; $('mission-number').textContent = number; }
function setMode(mode) { closeActions(); world.cancelAction?.(); resetTouch(); $('app').dataset.mode = mode; state.mode = mode; world.paused = !['explore', 'escort'].includes(mode); if (world.paused) world.keys.clear(); $('touch-controls').style.visibility = ['explore', 'escort'].includes(mode) ? '' : 'hidden'; }
function openModal(id) { $(id).showModal(); }
function closeInspect() { delete $('app').dataset.panel; $('inspect').hidden = true; state.selected = null; world.select(null); }
function explore() { closeInspect(); $('escort').hidden = true; world.companion = null; setMode('explore'); mission('OBSERVE', 'まずは、街を歩こう。', '近くの人を選んで、サインを観察。'); }
function result(title, body, points, button, action, good = false) {
  setMode('result'); $('conversation').close(); $('result-title').textContent = title; $('result-body').textContent = body; $('result-points').textContent = points ? `+${points} POINTS` : 'A MOMENT TO LEARN'; $('result-symbol').textContent = good ? '↗' : '◌'; $('result-eyebrow').textContent = good ? 'A NEW CONNECTION' : 'RESPECT THEIR PACE'; $('result-next').textContent = button; resultAction = action; if (points) score(points); tone(good ? 'success' : 'miss'); openModal('result');
}
function finishNpc(n) { if (n) n.cooldown = state.elapsed + 28; }
function selectNpc(n) {
  if (state.mode !== 'explore') return;
  if (n.cooldown > state.elapsed) { toast('今は相手の時間。ほかの出会いを探してみよう。'); return; }
  closeActions(); world.cancelAction?.(); resetTouch(); $('app').dataset.panel = 'observation'; state.selected = n; world.select(n); $('inspect').hidden = false;
  // Use the same 3D model for the close-up, once per person rather than every frame.
  $('person-icon').replaceChildren();
  if (world.portrait) {
    try { const image = document.createElement('img'); image.src = world.portrait(n); image.alt = ''; $('person-icon').append(image); }
    catch { $('person-icon').textContent = '◎'; }
  } else $('person-icon').textContent = '◎';
  $('person-name').textContent = n.profile.name; $('person-icon').style.color = n.profile.color; $('person-icon').style.background = `${n.profile.color}20`;
  $('traits').replaceChildren(...n.profile.traits.map(t => { const span = document.createElement('span'); span.textContent = t; return span; }));
  $('person-cue').textContent = n.profile.cue; $('person-status').textContent = n.profile.guarded ? '今はそっとしておこう' : '相手のペースを大切に';
  $('opener-actions').replaceChildren(...OPENERS.map(opener => { const button = document.createElement('button'); button.dataset.opener = opener.key; button.textContent = opener.label; const small = document.createElement('small'); small.textContent = opener.text; button.append(small); button.addEventListener('click', () => startTalk(opener.key)); return button; }));
  if (world.distanceTo(n) > 3.1) { const pos = n.mesh.position.clone(); pos.z += 2.1; world.walkTo(pos); toast('近くまで歩いて、相手のサインを見てみよう。'); }
  mission('READ THE SIGNS', '声をかける？ それとも離れる？', 'サインに合う、自然なきっかけを選ぼう。', '02'); tone();
}
function startTalk(key) {
  const n = state.selected; if (!n || state.mode !== 'explore') return;
  if (world.distanceTo(n) > 3.5) { toast('もう少し近づいてから、自然に声をかけよう。'); return; }
  const opening = evaluateOpener(n.profile, key, state.map); world.destination = null; world.marker.visible = false;
  if (!opening.success) { finishNpc(n); closeInspect(); result('また、別のきっかけを。', opening.message, 0, '街に戻る ↗', explore); return; }
  state.talk = { npc: n, ...opening, chain: 0, lines: buildLines(n.profile, state.map), turn: 0, locked: false };
  delete $('app').dataset.panel; $('inspect').hidden = true; $('talk-name').textContent = n.profile.name;
  $('responses').replaceChildren(...RESPONSES.map((r, i) => { const b = document.createElement('button'); b.dataset.response = r.key; b.textContent = `${i + 1}  ${r.label}`; const small = document.createElement('small'); small.textContent = r.sub; b.append(small); b.addEventListener('click', () => respond(r.key)); return b; }));
  setMode('talk'); showLine(); openModal('conversation'); tone();
}
function showLine() {
  const talk = state.talk; talk.locked = false;
  $('talk-line').textContent = talk.lines[talk.turn].text; $('talk-cue').textContent = `サイン：${talk.lines[talk.turn].cue}`; $('talk-turn').textContent = `0${talk.turn + 1} / 0${talk.lines.length}`;
  $('talk-feedback').textContent = ''; updateMeters(); $('responses').querySelectorAll('button').forEach(b => b.disabled = false);
}
function updateMeters() { const t = state.talk; $('favor').value = t.favor; $('favor-value').textContent = t.favor; $('discomfort').value = t.discomfort; $('discomfort-value').textContent = t.discomfort; }
function respond(key) {
  const talk = state.talk; if (state.mode !== 'talk' || !talk || talk.locked) return;
  talk.locked = true; const outcome = applyResponse(talk, talk.lines[talk.turn], key); Object.assign(talk, outcome); updateMeters();
  $('talk-feedback').textContent = outcome.feedback; $('responses').querySelectorAll('button').forEach(b => b.disabled = true); tone(outcome.correct ? 'click' : 'miss');
  talkTimer = setTimeout(() => {
    if (state.mode !== 'talk') return;
    if (outcome.accepted) { result('いいね、一緒に行こう。', '「少し落ち着けるところで、続きを話しませんか？」ラウンジへの提案に、笑顔でうなずいてくれた。', 120, 'ふたりで歩く ↗', beginEscort, true); return; }
    if (talk.discomfort >= 100) { endTalk(true); return; }
    talk.turn++; if (talk.turn >= talk.lines.length) endTalk(false); else showLine();
  }, 700);
}
function endTalk(failed) {
  clearTimeout(talkTimer); const t = state.talk; finishNpc(t?.npc); const points = failed ? 0 : t?.favor >= 68 ? 55 : 25;
  closeInspect(); result(failed ? '相手のペースを大切に。' : 'ひとときの会話を、ありがとう。', failed ? '少し戸惑わせてしまったようだ。追わずに離れて、次は相手の話をゆっくり聞こう。' : '会話はここでおしまい。提案は好感度だけでなく、タイミングも大切。', points, '街に戻る ↗', explore, !failed);
}
function beginEscort() {
  closeInspect(); world.companion = state.talk.npc; state.talk = null; setMode('escort'); $('escort').hidden = false; $('escort-description').textContent = state.map === 'nagoya' ? 'タワーズ側の入口へ。紫のマーカーが目印。' : '東宝ビルのホテル入口へ。紫のマーカーが目印。'; mission('WALK TOGETHER', 'ラウンジまで、一緒に。', '紫のマーカーへ、ふたりのペースで歩こう。', '03');
}
function completeEscort() {
  const n = world.companion; finishNpc(n); world.companion = null; $('escort').hidden = true;
  const clear = state.score + 100 >= 500 && !state.clearShown; if (clear) state.clearShown = true;
  result(clear ? 'CITY CLEAR' : '街に、ひとつのつながり。', clear ? '500ポイント達成！ 相手の気持ちを大切にしながら、街の出会いを楽しめた。続けてベストスコアを更新しよう。' : (state.map === 'nagoya' ? 'ふたりでタワーズ側の入口に到着。この先のラウンジで会話の続きを楽しもう。' : 'ふたりでホテルラウンジに到着。相手のサインを読み、会話を聞いて、自然な提案ができた。'), 100, 'また街を歩く ↗', explore, true);
}
function changeMap(map) {
  if (state.map === map) return;
  if (state.mode !== 'explore') { toast('今の会話や同行を終えてから、エリアを切り替えよう。'); return; }
  resetTouch(); closeInspect(); state.map = map; world.setMap(map); document.querySelectorAll('[data-map]').forEach(b => b.classList.toggle('active', b.dataset.map === map));
  const night = map === 'kabukicho'; $('location-name').innerHTML = night ? '歌舞伎町<span> KABUKICHO</span>' : '名古屋駅<span> 中央コンコース</span>';
  $('location-description').textContent = night ? 'ゴジラロードから、TOHOシネマズ新宿へ。' : '桜通口から太閤通口へ、駅構内を歩く。'; $('weather').innerHTML = night ? '◐ 21:30 <span>夜のにぎわい · 警戒度 高め</span>' : '◷ 15:00 <span>駅構内 · 金時計と銀時計を結ぶ通路</span>'; $('map-coord').textContent = night ? 'ゴジラロード' : '金時計 ↔ 銀時計'; document.querySelector('.compass span').textContent = night ? 'N' : 'W';
  mission('OBSERVE', 'まずは、街を歩こう。', '近くの人を選んで、サインを観察。'); toast(night ? 'ゴジラロードへ。通りの奥がTOHOシネマズ新宿。' : '名古屋駅の構内へ。金時計から中央通路を進むと銀時計。');
}
try { world = new CityWorld($('world'), $('labels'), selectNpc, () => {}); }
catch (error) { console.error(error); $('fatal').hidden = false; throw error; }
$('start').addEventListener('click', () => { $('intro').close(); if (state.mode === 'help') setMode(state.resumeMode || 'explore'); else explore(); state.resumeMode = null; tone(); });
$('intro-close').addEventListener('click', () => { $('intro').close(); if (state.mode === 'intro') explore(); else setMode(state.resumeMode || 'explore'); });
$('intro').addEventListener('cancel', e => { e.preventDefault(); $('intro-close').click(); });
$('help').addEventListener('click', () => { if (state.mode === 'menu') resumeMenu(); if (!['explore', 'escort'].includes(state.mode)) return; state.resumeMode = state.mode; setMode('help'); openModal('intro'); });
function resumeMenu() {
  $('game-menu').close(); setMode(state.menuResume || 'explore'); state.menuResume = null;
}
$('menu-toggle').addEventListener('click', () => {
  if (!['explore', 'escort'].includes(state.mode) || state.selected) return;
  state.menuResume = state.mode; setMode('menu'); openModal('game-menu');
});
$('menu-close').addEventListener('click', resumeMenu);
$('menu-resume').addEventListener('click', resumeMenu);
$('game-menu').addEventListener('cancel', event => { event.preventDefault(); resumeMenu(); });
$('inspect-close').addEventListener('click', () => { closeInspect(); mission('OBSERVE', 'まずは、街を歩こう。', '近くの人を選んで、サインを観察。'); });
$('leave').addEventListener('click', () => { const n = state.selected; if (!n) return; const good = n.profile.guarded; finishNpc(n); closeInspect(); score(good ? 20 : 5); toast(good ? 'いい判断！ 相手の時間を尊重できた。 +20 pt' : '軽く会釈して離れた。 +5 pt'); tone(); mission('OBSERVE', '次のきっかけを探そう。', '気になるサインを見つけよう。'); });
$('talk-exit').addEventListener('click', () => endTalk(false)); $('conversation').addEventListener('cancel', e => { e.preventDefault(); endTalk(false); });
$('result-next').addEventListener('click', () => { $('result').close(); resultAction?.(); }); $('result').addEventListener('cancel', e => { e.preventDefault(); $('result-next').click(); });
$('goal-walk').addEventListener('click', () => { if (state.mode === 'escort') world.walkTo(world.goal); });
$('escort-cancel').addEventListener('click', () => { finishNpc(world.companion); explore(); toast('同行を終えた。またね、と挨拶して別れた。'); });
$('camera-reset').addEventListener('click', () => world.resetCamera()); document.querySelectorAll('[data-map]').forEach(b => b.addEventListener('click', () => changeMap(b.dataset.map)));
$('sound').addEventListener('click', () => { state.sound = !state.sound; $('sound').innerHTML = `♪<span>${state.sound ? 'ON' : 'OFF'}</span>`; $('sound').setAttribute('aria-pressed', String(state.sound)); $('sound').setAttribute('aria-label', `効果音を${state.sound ? 'オフ' : 'オン'}にする`); tone(); });
resetTouch = bindVirtualStick($('movement-stick'), $('stick-thumb'), world, () => ['explore', 'escort'].includes(state.mode) && !state.selected);
function nearestPerson() {
  return (world.npcs || []).filter(n => !n.ambient && n.cooldown <= state.elapsed && world.distanceTo(n) < 10).sort((a, b) => world.distanceTo(a) - world.distanceTo(b))[0];
}
function closeActions() { $('action-menu').hidden = true; $('action-toggle').setAttribute('aria-expanded', 'false'); }
function runAction(id) {
  if (!['explore', 'escort'].includes(state.mode) || state.selected || document.hidden) return;
  resetTouch();
  if (world.performAction(id)) { const action = ACTIONS.find(a => a.id === id); toast(action.label); tone(); }
  closeActions();
}
$('action-toggle').addEventListener('click', () => {
  if (!['explore', 'escort'].includes(state.mode) || state.selected) return;
  const open = $('action-menu').hidden;
  $('action-menu').hidden = !open; $('action-toggle').setAttribute('aria-expanded', String(open));
});
$('action-menu').replaceChildren(...ACTIONS.map(action => {
  const button = document.createElement('button'); button.dataset.action = action.id;
  button.textContent = `${action.icon} ${action.label}`;
  const hint = document.createElement('kbd'); hint.textContent = action.key === ' ' ? 'SPACE' : action.key.toUpperCase(); button.append(hint);
  button.addEventListener('click', () => runAction(action.id)); return button;
}));
window.addEventListener('keydown', event => {
  if (event.key === 'Escape') closeActions();
  if (event.repeat || event.ctrlKey || event.altKey || event.metaKey || /^(INPUT|TEXTAREA|SELECT)$/.test(event.target?.tagName) || (event.key === ' ' && event.target?.tagName === 'BUTTON') || event.target?.isContentEditable) return;
  const action = ACTIONS.find(a => a.key === event.key.toLowerCase());
  if (action && ['explore', 'escort'].includes(state.mode) && !state.selected) { event.preventDefault(); runAction(action.id); }
});
$('nearby-person').addEventListener('click', () => { const n = nearestPerson(); if (n) selectNpc(n); else toast('地面をタップして移動し、近くの人を探してみよう。'); });
$('zoom-in').addEventListener('click', () => world.zoom(-3));
$('zoom-out').addEventListener('click', () => world.zoom(3));
window.addEventListener('keydown', e => { if (state.mode === 'talk' && ['1', '2', '3', '4'].includes(e.key)) respond(RESPONSES[Number(e.key) - 1].key); if (e.key === 'Escape' && state.mode === 'explore') closeInspect(); });
updateScore(); setMode('intro'); openModal('intro');
const ctx = $('minimap').getContext('2d'); let previous = performance.now(), lastRender = 0, mapTick = 0;
function frame(now) {
  if (document.hidden || now - lastRender < (world.profile?.frameInterval || 0)) { requestAnimationFrame(frame); if (document.hidden) previous = now; return; }
  const interval = world.profile?.frameInterval || 0;
  lastRender = interval ? now - ((now - lastRender) % interval) : now;
  const dt = Math.min((now - previous) / 1000, .05); previous = now; state.elapsed += dt;
  world.update(dt, state.elapsed); mapTick += dt;
  if (mapTick > .2) { if ($('game-menu').open) world.drawMinimap(ctx); mapTick = 0; }
  if (state.selected && state.mode === 'explore') {
    const dist = world.distanceTo(state.selected); $('person-distance').textContent = `${dist.toFixed(1)} m`; $('opener-actions').querySelectorAll('button').forEach(b => b.disabled = dist > 3.5);
  }
  if (state.mode === 'escort') { const dist = world.player.position.distanceTo(world.goal); $('goal-distance').textContent = `${Math.ceil(dist)} m`; if (dist < 1.4 && world.distanceTo(world.companion) < 3.1) completeEscort(); }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
return { state, world };
}

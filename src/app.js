import { createChallengeUI } from './challenge-ui.js';
import { streetLines } from './street-encounters.js';
import { destinationsFor, evaluateInvitation, spokenReplies } from './encounters.js';
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
function setMode(mode) { closeActions(); world.cancelAction?.(); resetTouch(); $('app').dataset.mode = mode; state.mode = mode; world.paused = !['explore', 'escort'].includes(mode); if (world.paused) world.keys.clear(); $('touch-controls').style.visibility = ['explore', 'escort'].includes(mode) ? '' : 'hidden'; $('guide').hidden = mode !== 'explore'; $('labels').hidden = ['challenge', 'challenge-result'].includes(mode); }
function openModal(id) { $(id).showModal(); }
function closeInspect() { delete $('app').dataset.panel; $('inspect').hidden = true; state.selected = null; world.select(null); }
function explore() { state.touring = false; $('guide-text').textContent = '女の子をタップして、一緒に遊ぶ・話す'; state.invitation = null; state.escort = null; closeInspect(); $('escort').hidden = true; world.companion = null; setMode('explore'); mission('OBSERVE', 'まずは、街を歩こう。', '近くの人を選んで、サインを観察。'); }
function result(title, body, points, button, action, good = false) {
  setMode('result'); $('conversation').close(); $('result-title').textContent = title; $('result-body').textContent = body; $('result-points').textContent = points ? `+${points} POINTS` : 'A MOMENT TO LEARN'; $('result-symbol').textContent = good ? '↗' : '◌'; $('result-eyebrow').textContent = good ? 'A NEW CONNECTION' : 'RESPECT THEIR PACE'; $('result-next').textContent = button; resultAction = action; if (points) score(points); tone(good ? 'success' : 'miss'); openModal('result');
}
function finishNpc(n) { if (n) n.cooldown = state.elapsed + 28; }
function selectNpc(n) {
  if (state.mode !== 'explore') return;
  if (n.profile.role) { openStreet(n); return; }
  if (n.cooldown > state.elapsed) { toast('今は相手の時間。ほかの出会いを探してみよう。'); return; }
  closeActions(); world.cancelAction?.(); resetTouch(); $('app').dataset.panel = 'observation'; state.selected = n; world.select(n); $('inspect').hidden = false;
  // Use the same 3D model for the close-up, once per person rather than every frame.
  $('person-icon').replaceChildren();
  if (world.portrait) {
    try { const image = document.createElement('img'); image.src = world.portrait(n); image.alt = ''; $('person-icon').append(image); }
    catch { $('person-icon').textContent = '◎'; }
  } else $('person-icon').textContent = '◎';
  $('person-name').textContent = `${n.profile.name} · ${n.profile.age}歳`; $('person-icon').style.color = n.profile.color; $('person-icon').style.background = `${n.profile.color}20`;
  $('traits').replaceChildren(...n.profile.traits.map(t => { const span = document.createElement('span'); span.textContent = t; return span; }));
  $('person-cue').textContent = n.profile.cue; $('person-status').textContent = n.profile.guarded ? '今はそっとしておこう' : '相手のペースを大切に';
  $('opener-choices').open = false; $('partner-play').disabled = !!n.profile.guarded || world.distanceTo(n) > 3.5; $('partner-play').textContent = n.profile.guarded ? '今は忙しそう' : world.distanceTo(n) > 3.5 ? '近くまで移動中…' : '一緒にリズム遊び · 15秒';
  $('opener-actions').replaceChildren(...OPENERS.map(opener => { const button = document.createElement('button'); button.dataset.opener = opener.key; button.textContent = opener.text; const small = document.createElement('small'); small.textContent = opener.label; button.append(small); button.addEventListener('click', () => startTalk(opener.key)); return button; }));
  if (world.distanceTo(n) > 3.1) { const pos = n.mesh.position.clone(); pos.z += 2.1; world.walkTo(pos); toast('近くまで歩いて、相手のサインを見てみよう。'); }
  mission('READ THE SIGNS', '声をかける？ それとも離れる？', 'サインに合う、自然なきっかけを選ぼう。', '02'); tone();
}
function openStreet(n) {
  if (state.mode !== 'explore' || n.cooldown > state.elapsed) return;
  if (world.distanceTo(n) > 3.5) { const pos = n.mesh.position.clone(); pos.z += 1.5; world.walkTo(pos); toast('近くまで歩こう。もう一度タップすると話せます。'); return; }
  closeInspect(); world.destination = null; world.waypoints = []; world.marker.visible = false;
  world.faceEachOther?.(n); state.street = n; setMode('street');
  const encounter = streetLines(n.profile.role, n.profile.id);
  $('street-name').textContent = `${n.profile.name}（${n.profile.age}歳）`; $('street-line').textContent = encounter.line;
  $('street-options').replaceChildren(...encounter.choices.map(([line, reply]) => {
    const button = document.createElement('button'); button.textContent = line;
    button.addEventListener('click', () => { if (state.mode !== 'street') return; $('street-line').textContent = reply; $('street-options').replaceChildren(); }); return button;
  })); openModal('street-dialog');
}
function closeStreet() { if (state.mode !== 'street') return; state.street.cooldown = state.elapsed + 60; state.street = null; $('street-dialog').close(); explore(); }
function startTour() {
  if (world.companion || state.map !== 'kabukicho') { toast('歌舞伎町の探索中に使えます。'); return; }
  $('intro').close(); $('game-menu').close(); explore(); resetTouch();
  if (world.walkRoute(world.layout.tour)) { state.touring = true; $('guide-text').textContent = 'TOHO一周散策中 · スティックを倒すと自由移動'; toast('正面 → 西側 → 裏側 → 東側を一周します。'); }
}
function startTalk(key) {
  const n = state.selected; if (!n || state.mode !== 'explore') return;
  if (world.distanceTo(n) > 3.5) { toast('もう少し近づいてから、自然に声をかけよう。'); return; }
  world.faceEachOther?.(n);
  const opening = evaluateOpener(n.profile, key, state.map); world.destination = null; world.marker.visible = false;
  if (!opening.success) { finishNpc(n); closeInspect(); result('また、別のきっかけを。', opening.message, 0, '街に戻る ↗', explore); return; }
  state.talk = { npc: n, ...opening, chain: 0, lines: buildLines(n.profile, state.map), turn: 0, locked: false };
  delete $('app').dataset.panel; $('inspect').hidden = true; $('talk-name').textContent = n.profile.name;
  $('responses').replaceChildren(...RESPONSES.map(r => { const b = document.createElement('button'); b.dataset.response = r.key; b.addEventListener('click', () => respond(r.key)); return b; }));
  setMode('talk'); showLine(); openModal('conversation'); tone();
}
function showLine() {
  const talk = state.talk; talk.locked = false;
  const replies = spokenReplies(talk.turn, state.map);
  $('responses').querySelectorAll('button').forEach((button, i) => { button.textContent = replies[i]; });
  $('talk-line').textContent = talk.lines[talk.turn].text; $('talk-cue').textContent = `サイン：${talk.lines[talk.turn].cue}`; $('talk-turn').textContent = `0${talk.turn + 1} / 0${talk.lines.length}`;
  $('talk-feedback').textContent = ''; updateMeters(); $('responses').querySelectorAll('button').forEach(b => b.disabled = false);
}
function updateMeters() { const t = state.talk; $('favor').value = t.favor; $('favor-value').textContent = t.favor; $('discomfort').value = t.discomfort; $('discomfort-value').textContent = t.discomfort; }
function respond(key) {
  const talk = state.talk; if (state.mode !== 'talk' || !talk || talk.locked) return;
  talk.locked = true; const outcome = applyResponse(talk, talk.lines[talk.turn], key); Object.assign(talk, outcome); updateMeters();
  $('talk-feedback').textContent = `あなた「${spokenReplies(talk.turn, state.map)[RESPONSES.findIndex(r => r.key === key)]}」 ${outcome.feedback}`; $('responses').querySelectorAll('button').forEach(b => b.disabled = true); tone(outcome.correct ? 'click' : 'miss');
  talkTimer = setTimeout(() => {
    if (state.mode !== 'talk') return;
    if (outcome.accepted) { openInvitation(); return; }
    if (talk.discomfort >= 100) { endTalk(true); return; }
    talk.turn++; if (talk.turn >= talk.lines.length) endTalk(false); else showLine();
  }, 700);
}
function endTalk(failed) {
  clearTimeout(talkTimer); const t = state.talk; finishNpc(t?.npc); const points = failed ? 0 : t?.favor >= 68 ? 55 : 25;
  closeInspect(); result(failed ? '相手のペースを大切に。' : 'ひとときの会話を、ありがとう。', failed ? '少し戸惑わせてしまったようだ。追わずに離れて、次は相手の話をゆっくり聞こう。' : '会話はここでおしまい。提案は好感度だけでなく、タイミングも大切。', points, '街に戻る ↗', explore, !failed);
}
function openInvitation() {
  $('conversation').close(); closeInspect(); setMode('invite');
  $('invite-name').textContent = state.talk.npc.profile.name;
  $('invite-line').textContent = 'いいですよ。どこに行きましょう？';
  $('invite-confirm').hidden = true; state.invitation = null;
  $('invite-options').replaceChildren(...destinationsFor(state.map).map(destination => {
    const button = document.createElement('button'); button.dataset.destination = destination.id; button.textContent = destination.invitation;
    button.addEventListener('click', () => {
      if (state.mode !== 'invite' || !state.talk) return;
      const outcome = evaluateInvitation(state.talk.npc.profile, destination, state.talk);
      $('invite-line').textContent = outcome.answer;
      $('invite-options').querySelectorAll('button').forEach(b => b.classList.toggle('chosen', b === button));
      state.invitation = outcome.accepted ? destination : null;
      $('invite-confirm').hidden = !outcome.accepted;
    }); return button;
  }));
  openModal('invitation');
}
function cancelInvitation() {
  if (state.mode !== 'invite') return;
  finishNpc(state.talk?.npc); state.talk = null; $('invitation').close(); explore(); toast('またね、と挨拶して別れた。');
}
function beginEscort() {
  if (state.mode !== 'invite' || !state.invitation || !state.talk) return;
  const destination = state.invitation, npc = state.talk.npc;
  $('invitation').close(); closeInspect(); world.setDestination(destination);
  world.companion = npc; npc.followTarget = null; state.talk = null; state.invitation = null;
  state.escort = { destination, distance: 0, chatted: false, previous: world.player.position.clone() };
  score(120); setMode('escort'); $('escort').hidden = false;
  $('goal-walk').textContent = `${destination.label}へ`;
  $('escort-description').textContent = `${destination.label}まで、一緒に歩こう。`;
  mission('WALK TOGETHER', `${destination.label}へ、一緒に。`, '紫のマーカーへ、ふたりのペースで歩こう。', '03');
  toast(`デートOK！「一緒に行きましょう」 ${destination.label}へ。`); tone('success');
}
function completeEscort() {
  const n = world.companion, destination = state.escort.destination;
  finishNpc(n); world.faceEachOther?.(n); world.companion = null; $('escort').hidden = true; state.escort = null;
  const clear = state.score + 100 >= 500 && !state.clearShown; if (clear) state.clearShown = true;
  result(clear ? 'CITY CLEAR · デート成立' : 'デート成立！', `「一緒に歩けて楽しかった。続きを話しましょう」${destination.label}まで、ふたりで歩いた。` + (clear ? ' 500ポイント達成！' : ''), 100, 'また街を歩く ↗', explore, true);
}
function changeMap(map) {
  if (state.map === map) return;
  if (state.mode !== 'explore') { toast('今の会話や同行を終えてから、エリアを切り替えよう。'); return; }
  resetTouch(); closeInspect(); state.map = map; world.setMap(map); document.querySelectorAll('[data-map]').forEach(b => b.classList.toggle('active', b.dataset.map === map));
  const night = map === 'kabukicho'; $('location-name').innerHTML = night ? '歌舞伎町<span> KABUKICHO</span>' : '名古屋駅<span> 中央コンコース</span>';
  $('location-description').textContent = night ? '東宝ビル・一番街・シネシティ広場を歩く。' : '桜通口から太閤通口へ、駅構内を歩く。'; $('weather').innerHTML = night ? '◐ 21:30 <span>夜のにぎわい · 警戒度 高め</span>' : '◷ 15:00 <span>駅構内 · 金時計と銀時計を結ぶ通路</span>'; $('map-coord').textContent = night ? 'ゴジラロード' : '金時計 ↔ 銀時計'; document.querySelector('.compass span').textContent = night ? 'N' : 'W';
  mission('OBSERVE', 'まずは、街を歩こう。', '近くの人を選んで、サインを観察。'); toast(night ? 'ゴジラロードへ。通りの奥がTOHOシネマズ新宿。' : '名古屋駅の構内へ。金時計から中央通路を進むと銀時計。');
}
try { world = new CityWorld($('world'), $('labels'), selectNpc, () => {}); }
catch (error) { console.error(error); $('fatal').hidden = false; throw error; }
const arcade = createChallengeUI({ world, storage, mode: () => state.mode,
  canStart: partner => ['explore', 'challenge-result'].includes(state.mode) && !world.companion && !!partner && world.npcs.includes(partner) && !partner.ambient && !partner.profile.role && partner.profile.gender === 'woman' && !partner.profile.guarded && partner.profile.age >= 20 && world.distanceTo(partner) <= 3.5 && (state.mode === 'challenge-result' || partner === state.selected),
  enter(mode) { state.touring = false; closeInspect(); setMode(mode); }, leave(partner) { explore(); if (partner) selectNpc(partner); }, award: score, tone,
});
$('partner-play').addEventListener('click', () => arcade.start(state.selected));
$('start-tour').addEventListener('click', startTour);
$('menu-tour').addEventListener('click', startTour);
$('menu-nightlife').addEventListener('click', () => {
  if (state.mode !== 'menu' || state.map !== 'kabukicho' || world.companion) return;
  resumeMenu(); state.touring = false;
  const [x, z] = world.layout.nightlifeArea.entrance; world.walkTo(world.player.position.clone().set(x, 0, z));
  toast('待ち合わせ通りへ。人物をタップして話しかけられます。');
});
$('menu-plaza').addEventListener('click', () => {
  if (state.mode !== 'menu' || state.map !== 'kabukicho' || world.companion) return;
  resumeMenu(); state.touring = false; world.walkTo(world.player.position.clone().set(-34, 0, -33));
  toast('シネシティ広場へ。集まっている3人をタップすると雑談できます。');
});
$('street-close').addEventListener('click', closeStreet);
$('street-dialog').addEventListener('cancel', event => { event.preventDefault(); closeStreet(); });
$('start').addEventListener('click', () => { $('intro').close(); if (state.mode === 'help') setMode(state.resumeMode || 'explore'); else explore(); state.resumeMode = null; tone(); });
$('intro-close').addEventListener('click', () => { $('intro').close(); if (state.mode === 'intro') explore(); else setMode(state.resumeMode || 'explore'); });
$('intro').addEventListener('cancel', e => { e.preventDefault(); $('intro-close').click(); });
$('help').addEventListener('click', () => { if (state.mode === 'menu') resumeMenu(); if (!['explore', 'escort'].includes(state.mode)) return; state.resumeMode = state.mode; $('start-tour').disabled = !!world.companion || state.map !== 'kabukicho'; setMode('help'); openModal('intro'); });
function resumeMenu() {
  $('game-menu').close(); setMode(state.menuResume || 'explore'); state.menuResume = null;
}
$('menu-toggle').addEventListener('click', () => {
  if (!['explore', 'escort'].includes(state.mode) || state.selected) return;
  $('menu-nightlife').disabled = state.map !== 'kabukicho' || !!world.companion;
  $('menu-plaza').disabled = state.map !== 'kabukicho' || !!world.companion;
  arcade.renderCloset();
  state.menuResume = state.mode; setMode('menu'); openModal('game-menu');
});
$('menu-close').addEventListener('click', resumeMenu);
$('menu-resume').addEventListener('click', resumeMenu);
$('game-menu').addEventListener('cancel', event => { event.preventDefault(); resumeMenu(); });
$('inspect-close').addEventListener('click', () => { closeInspect(); mission('OBSERVE', 'まずは、街を歩こう。', '近くの人を選んで、サインを観察。'); });
$('leave').addEventListener('click', () => { const n = state.selected; if (!n) return; const good = n.profile.guarded; finishNpc(n); closeInspect(); score(good ? 20 : 5); toast(good ? 'いい判断！ 相手の時間を尊重できた。 +20 pt' : '軽く会釈して離れた。 +5 pt'); tone(); mission('OBSERVE', '次のきっかけを探そう。', '気になるサインを見つけよう。'); });
$('invite-confirm').addEventListener('click', beginEscort);
$('invite-cancel').addEventListener('click', cancelInvitation);
$('invitation').addEventListener('cancel', event => { event.preventDefault(); cancelInvitation(); });
$('talk-exit').addEventListener('click', () => endTalk(false)); $('conversation').addEventListener('cancel', e => { e.preventDefault(); endTalk(false); });
$('result-next').addEventListener('click', () => { $('result').close(); resultAction?.(); }); $('result').addEventListener('cancel', e => { e.preventDefault(); $('result-next').click(); });
$('goal-walk').addEventListener('click', () => { if (state.mode === 'escort') world.walkTo(world.goal); });
$('escort-cancel').addEventListener('click', () => { finishNpc(world.companion); explore(); toast('同行を終えた。またね、と挨拶して別れた。'); });
$('camera-reset').addEventListener('click', () => world.resetCamera()); document.querySelectorAll('[data-map]').forEach(b => b.addEventListener('click', () => { if (state.mode === 'menu' && !world.companion) resumeMenu(); changeMap(b.dataset.map); }));
$('sound').addEventListener('click', () => { state.sound = !state.sound; $('sound').innerHTML = `♪<span>${state.sound ? 'ON' : 'OFF'}</span>`; $('sound').setAttribute('aria-pressed', String(state.sound)); $('sound').setAttribute('aria-label', `効果音を${state.sound ? 'オフ' : 'オン'}にする`); tone(); });
resetTouch = bindVirtualStick($('movement-stick'), $('stick-thumb'), world, () => ['explore', 'escort'].includes(state.mode) && !state.selected);
function nearestPerson() {
  return (world.npcs || []).filter(n => !n.ambient && !n.profile.role && n.cooldown <= state.elapsed && world.distanceTo(n) < (n.profile.guarded ? 10 : 18)).sort((a, b) => Number(!!a.profile.guarded) - Number(!!b.profile.guarded) || world.distanceTo(a) - world.distanceTo(b))[0];
}
function closeActions() { $('action-menu').hidden = true; $('action-toggle').setAttribute('aria-expanded', 'false'); }
function runAction(id) {
  if (state.mode === 'menu') resumeMenu();
  if (!['explore', 'escort'].includes(state.mode) || state.selected || document.hidden) return;
  resetTouch();
  if (world.performAction(id)) { const action = ACTIONS.find(a => a.id === id); toast(action.label); tone(); }
  closeActions();
}
$('action-toggle').addEventListener('click', () => {
  if (!['explore', 'escort', 'menu'].includes(state.mode) || state.selected) return;
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
$('nearby-person').addEventListener('click', () => { const n = nearestPerson(); if (n) selectNpc(n); else toast('地面をタップして移動し、女の子を探してみよう。'); });
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
  arcade.update(dt); world.update(dt, state.elapsed); mapTick += dt;
  if (state.touring && !world.destination) { state.touring = false; $('guide-text').textContent = '女の子をタップして、一緒に遊ぶ・話す'; }
  if (state.mode === 'explore' && !state.selected && !state.touring) {
    const street = (world.npcs || []).find(n => n.profile?.autoApproach && n.cooldown <= state.elapsed && world.distanceTo(n) < 2.7);
    if (street) openStreet(street);
  }
  if (mapTick > .2) { if ($('game-menu').open) world.drawMinimap(ctx); mapTick = 0; }
  if (state.selected && state.mode === 'explore') {
    const dist = world.distanceTo(state.selected); $('partner-play').disabled = dist > 3.5 || !!state.selected.profile.guarded; $('partner-play').textContent = state.selected.profile.guarded ? '今は忙しそう' : dist > 3.5 ? '近くまで移動中…' : '一緒にリズム遊び · 15秒'; $('approach-status').textContent = dist > 3.5 ? '近くまで移動中… 到着したら台詞を選ぼう。' : state.selected.profile.guarded ? '今は話す余裕がなさそう。会釈して次の出会いへ。' : '一緒に遊ぶ？ それとも会話する？'; $('person-distance').textContent = `${dist.toFixed(1)} m`; $('opener-actions').querySelectorAll('button').forEach(b => b.disabled = dist > 3.5);
  }
  if (state.mode === 'escort') {
    state.escort.distance += state.escort.previous.distanceTo(world.player.position); state.escort.previous.copy(world.player.position);
    if (!state.escort.chatted && state.escort.distance > 12 && world.distanceTo(world.companion) < 4) { state.escort.chatted = true; toast('「さっきの話の続き、気になります」ふたりで話しながら歩いている。'); }
    const dist = world.player.position.distanceTo(world.goal); $('goal-distance').textContent = `${Math.ceil(dist)} m`; if (dist < 1.4 && world.distanceTo(world.companion) < 3.1) completeEscort(); }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
return { state, world, arcade };
}

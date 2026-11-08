import { TALK_PARTS, createTalkProgress, clearTalkPart, nextTalkPart, createTalkQte, advanceTalkQte, inputTalkQte } from './talk-parts.js';
import { RHYTHM, TALK_LANES, createTalkRhythm, rhythmPhrase, advanceTalkRhythm, tapTalkRhythm, rhythmOutcome } from './talk-rhythm.js';
import { createRhythmMusic } from './rhythm-music.js';
import { createDateRun, dateTotal, createWalkRun, advanceWalk, respondWalk, collectWalkPoints, finishDate, dateRank, loadAlbum, saveAlbum } from './date-run.js';
import { arrivedTogether } from './venues.js';
import { createChallengeUI } from './challenge-ui.js';
import { streetLines } from './street-encounters.js';
import { destinationsFor, evaluateInvitation } from './encounters.js';
import { ACTIONS } from './actions.js';
import { bindVirtualStick } from './input.js';
import { OPENERS, evaluateOpener } from './game.js';

export function startGame(CityWorld, { now = () => performance.now() } = {}) {
const $ = id => document.getElementById(id);
let storage; try { storage = window.localStorage; } catch { storage = null; }
let album = loadAlbum(storage);
const state = { score: 0, best: album.best, map: 'kabukicho', mode: 'intro', selected: null, talk: null, sound: false, elapsed: 0, clears: 0, attempt: null };
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
function score(points) { state.score += points; updateScore(); }
function updateScore() { $('run-score').textContent = `${dateTotal(state.attempt)} pt`; $('score').textContent = String(dateTotal(state.attempt)).padStart(3, '0'); $('best').textContent = String(album.best).padStart(3, '0'); $('rank').textContent = dateRank(state.attempt); $('score-progress').style.width = `${Math.min(100, dateTotal(state.attempt) / 11.2)}%`; $('clear-progress').textContent = state.clears ? `GOAL CLEAR · ${state.clears}回` : '相手とホテルかネットカフェの入口へ'; }
function mission(step, title, text, number = '01') { $('mission-step').textContent = step; $('mission-title').textContent = title; $('mission-text').textContent = text; $('mission-number').textContent = number; }
function setMode(mode) { if(mode!=='escort') $('walk-response').hidden=true; closeActions(); world.cancelAction?.(); resetTouch(); $('app').dataset.mode = mode; state.mode = mode; world.paused = !['explore', 'escort'].includes(mode); if (world.paused) world.keys.clear(); $('touch-controls').style.visibility = ['explore', 'escort'].includes(mode) ? '' : 'hidden'; $('guide').hidden = mode !== 'explore'; $('labels').hidden = ['talk', 'challenge', 'challenge-result'].includes(mode); }
function openModal(id) { $(id).showModal(); }
function closeInspect() { delete $('app').dataset.panel; $('inspect').hidden = true; state.selected = null; world.select(null); }
function explore() { state.touring = false; $('guide-text').textContent = state.map === 'nagoya' ? '名古屋駅は会話・同行の練習。ゴールは歌舞伎町で。' : '声をかける → 誘う → ホテル・ネカフェの入口へ'; state.invitation = null; state.escort = null; closeInspect(); $('escort').hidden = true; world.companion = null; setMode('explore'); mission('OBSERVE', 'まずは、街を歩こう。', '近くの人を選んで、サインを観察。'); }
function result(title, body, points, button, action, good = false) {
  $('result').classList.remove('has-memory');
  $('goal-memory').hidden = true; $('date-breakdown').hidden = true;
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
  $('person-cue').textContent = n.profile.cue;
  $('opener-choices').open = false; $('approach-start').disabled = world.distanceTo(n) > 3.5; $('partner-play').disabled = !!n.profile.guarded || world.distanceTo(n) > 3.5; $('partner-play').textContent = n.profile.guarded ? '今は忙しそう' : world.distanceTo(n) > 3.5 ? '近くまで移動中…' : '一緒にリズム遊び · 15秒';
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
  state.attempt = null; updateScore();
  const opening = evaluateOpener(n.profile, key, state.map); world.destination = null; world.marker.visible = false;
  if (!opening.success) { finishNpc(n); closeInspect(); result('また、別のきっかけを。', opening.message, 0, '街に戻る ↗', explore); return; }
  state.attempt = createDateRun(); score(state.attempt.approach);
  state.talk = { npc:n, ...opening, opening, run:createTalkRhythm(n.profile.name.length%3), progress:createTalkProgress(), phase:'ready', started:false, ending:false, music:null };
  if(world.beginTalk) world.beginTalk(n); else world.beginChallenge?.(n);
  delete $('app').dataset.panel; $('inspect').hidden = true; $('talk-name').textContent = n.profile.name;
  $('responses').replaceChildren(...TALK_LANES.map((lane,i)=>{const b=document.createElement('button');b.dataset.lane=lane.key;b.style.setProperty('--lane',lane.color);b.setAttribute('aria-label',`${lane.label}・${i+1}`);b.innerHTML=`<strong>${lane.icon}</strong><span>${lane.label}</span>`;b.addEventListener('pointerdown',e=>{e.preventDefault();respond(lane.key);});b.addEventListener('click',e=>{if(e.detail===0)respond(lane.key);});return b;}));
  prepareTalkPart();
  setMode('talk'); clearTimeout(toastTimer); $('toast').classList.remove('show'); renderRhythm(); $('talk-feedback').textContent = `あなた ${OPENERS.find(opener => opener.key === key).text}`; openModal('conversation'); tone();
}
function prepareTalkPart(){
 const t=state.talk;stopTalkMusic();t.phase='ready';t.started=false;t.ending=false;t.qte=null;t.retryQte=false;
 if(t.progress.index===1){if(!world.rhythmTravelActive)world.beginRhythmTravel?.();world.paused=true;}else if(t.progress.index>=2){world.endRhythmTravel?.();if(!world.talkActive){world.faceEachOther?.(t.npc);if(world.beginTalk)world.beginTalk(t.npc);else world.beginChallenge?.(t.npc);}world.paused=true;}
 [...$('responses').children].forEach((button,i)=>{button.querySelector('span').textContent=TALK_PARTS[t.progress.index].lanes[i];button.setAttribute('aria-label',`${TALK_PARTS[t.progress.index].lanes[i]}・${i+1}`);});
 t.run=createTalkRhythm(t.npc.profile.name.length%3,t.progress.index);
 $('rhythm-notes').replaceChildren(...t.run.notes.map(note=>{const el=document.createElement('i');el.dataset.note=note.id;el.style.setProperty('--lane',TALK_LANES[note.lane].color);el.style.left=`${(note.lane+.5)*100/3}%`;el.textContent=TALK_LANES[note.lane].icon;return el;}));
 $('rhythm-start').hidden=false;$('rhythm-muted').hidden=false;$('rhythm-start').disabled=false;
 world.talkPart?.(t.progress.index);renderRhythm();
}
function startRhythm(withSound) {
 const t=state.talk;if(state.mode!=='talk'||!t||t.started)return;
 t.phase='rhythm';t.withSound=withSound;t.started=true;t.startedAt=now();world.paused=t.progress.index!==1;world.rhythmBeat?.(0,t.progress.index);t.music=withSound?createRhythmMusic():null;
 $('rhythm-start').hidden=true;$('rhythm-muted').hidden=true;
 $('talk-feedback').textContent='6ノーツ中4ノーツでクリア';renderRhythm();
}
function rhythmTime(t) { return t.music?.now() ?? (now()-t.startedAt)/1000; }
function stopTalkMusic(){state.talk?.music?.stop();if(state.talk)state.talk.music=null;}
function renderRhythm(){
 const t=state.talk,run=t.run,part=TALK_PARTS[t.progress.index],q=t.phase==='qte';
 const title=t.progress.index===2&&t.destination&&t.destination.type!=='lovehotel'?(t.destination?.type==='netcafe'?'ネカフェ前':'目的地前'):part.title;
 $('conversation').dataset.lap=t.travelLap||0;
 $('conversation').dataset.phase=t.phase;$('conversation').dataset.part=t.progress.index;
 const stepsSignature=`${t.progress.index}:${t.progress.cleared.join(',')}`;
 if(t.stepsSignature!==stepsSignature){t.stepsSignature=stepsSignature;$('talk-steps').replaceChildren(...TALK_PARTS.map((p,i)=>{const el=document.createElement('span');el.textContent=`${t.progress.cleared.includes(i)?'✓':i+1} ${i===2&&t.destination&&t.destination.type!=='lovehotel'?(t.destination?.type==='netcafe'?'ネカフェ前':'目的地前'):p.title}`;el.className=i===t.progress.index?'current':'';el.setAttribute('aria-current',i===t.progress.index?'step':'false');return el;}));}
 $('talk-turn').textContent=`PART ${t.progress.index+1} / 4 · ${run.combo} COMBO`;
 $('talk-line').textContent=t.phase==='clear'?`♥ ${title} CLEAR`:t.phase==='retry'?'もう一度、相手のペースで':q?part.cue:!t.started?part.line:run.elapsed<RHYTHM.leadIn?`${Math.ceil(RHYTHM.leadIn-run.elapsed)}`:rhythmPhrase(run);
 $('talk-cue').textContent=q?'QTE · PC：Space／右矢印':t.phase==='clear'?`次の場面へ · 合計 ${t.progress.points} pt`:'6ノーツ中4ノーツ成功 → QTEで次のパートへ';
 if(t.progress.index===1&&t.phase==='rhythm')$('talk-cue').textContent=`入口まで ${Math.ceil(world.player.position.distanceTo(world.goal))} m · フレーズ ${(t.travelLap||0)+1} · 歩きながらリズム！`;
 $('talk-clock').max=q?4:RHYTHM.duration;$('talk-clock').value=q?t.qte.elapsed:run.elapsed;
 $('talk-clock').setAttribute('aria-valuetext',q?`QTE残り${Math.ceil(4-t.qte.elapsed)}秒`:`PART ${t.progress.index+1}`);
 $('rhythm-track').hidden=t.phase!=='rhythm';$('responses').hidden=!['rhythm','ready'].includes(t.phase);
 $('responses').querySelectorAll('button').forEach(b=>b.disabled=t.phase!=='rhythm');
 $('talk-qte').hidden=!q;$('part-next').hidden=t.phase!=='clear'||(t.progress.index===0||t.progress.index===3);$('part-retry').hidden=t.phase!=='retry';$('part-retry').textContent=t.retryQte?'QTEをもう一度':'このパートをもう一度';
 for(const el of $('rhythm-notes').children){const n=run.notes[Number(el.dataset.note)],distance=n.time-run.elapsed;el.hidden=!t.started||!!n.grade||distance>RHYTHM.travel||distance<-.24;el.style.top=`${(1-distance/RHYTHM.travel)*100}%`;}
 if(q){
  const qt=t.qte,ready=qt.kind!=='tap'||Math.abs(qt.elapsed-1.4)<=.5;
  $('qte-button').dataset.kind=qt.kind;$('qte-button').dataset.ready=ready;
  $('qte-label').textContent=part.action;$('qte-button').setAttribute('aria-label',`${part.action}。${part.cue}`);
  $('qte-ring').style.transform=`scale(${qt.kind==='tap'?Math.max(.55,1.9-qt.elapsed/1.4*.9):1})`;
  $('qte-fill').style.width=`${qt.kind==='hold'&&qt.holdAt!=null?Math.min(100,(qt.elapsed-qt.holdAt)/.7*100):qt.kind==='tap'?qt.elapsed/4*100:0}%`;
 }
}
function rhythmFeedback(event){
 const t=state.talk,lane=TALK_LANES[event.lane],good=event.grade!=='miss';
 if(good)t.music?.hit(event.lane,event.grade==='perfect');
 if(t.progress.index===1&&good&&state.escort){const walk=state.escort.walk;walk.eventPoints=Math.min(200,walk.eventPoints+(event.grade==='perfect'?18:12));walk.hits++;walk.maxCombo=Math.max(walk.maxCombo,event.combo);}
 const preview={finished:false,hits:t.progress.hits+t.run.hits,misses:t.progress.misses+t.run.misses,notes:{length:24}};
 Object.assign(t,rhythmOutcome(preview,t.opening));updateMeters();
 $('conversation').dataset.grade=good?'win':'miss';
 $('talk-feedback').textContent=good?`${event.grade.toUpperCase()} · ${event.combo} COMBO　${lane.key==='joke'?'「ふふっ、おもしろい！」':lane.key==='groove'?'「なんか気が合うね！」':'「聞いてくれてうれしい」'}`:'MISS · 次のリズムに合わせよう';
 if(good&&t.progress.index===1)$('talk-feedback').textContent=`${event.grade.toUpperCase()} · ${event.combo} COMBO 「${['このペースがいいね','目が合うと、うれしいね','一緒に歩くの楽しい！'][event.lane]}」`;
 world.reactToTalk?.(good?'win':'miss',lane.hand,event.combo);world.challengeFeedback?.(good?(event.grade==='perfect'?'perfect':'good'):'miss');
 const button=$('responses').children[event.lane];button.dataset.grade=event.grade;
 clearTimeout(button.flashTimer);button.flashTimer=setTimeout(()=>delete button.dataset.grade,180);
}
function finishRhythm(){
 const t=state.talk;if(t.phase!=='rhythm')return;world.stopRhythmMotion?.();t.music?.pause();world.paused=true;
 if(t.progress.index===1){
  if(t.run.hits>=4&&(!t.bestTravel||t.run.points>t.bestTravel.points))t.bestTravel=t.run;
  if(!arrivedTogether(world.player.position,world.companion?.mesh.position,world.goal)){
   const sound=t.withSound;t.travelLap=(t.travelLap||0)+1;prepareTalkPart();startRhythm(sound);
   $('talk-feedback').textContent='歩調を合わせて、次のフレーズ！';return;
  }
  if(t.bestTravel&&t.bestTravel.points>t.run.points)t.run=t.bestTravel;
 }
 if(t.run.hits<4){t.phase='retry';$('talk-feedback').textContent='4ノーツ成功を目指して、このパートをもう一度。';world.reactToTalk?.('miss','paper',0);}
 else beginQte();renderRhythm();
}
function beginQte(){
 const t=state.talk;t.phase='qte';t.qte=createTalkQte(TALK_PARTS[t.progress.index].qte);t.qteStartedAt=now();
 $('talk-feedback').textContent='リズムクリア！ 次はアクション';world.talkScene?.(TALK_PARTS[t.progress.index].motion);
}
function finishQte(){
 const t=state.talk;if(t.phase!=='qte'||t.qte.status==='active')return;
 if(t.qte.status==='failed'){t.phase='retry';t.retryQte=true;$('talk-feedback').textContent='QTEをもう一度。リズムのクリアは残っています。';world.reactToTalk?.('miss','paper',0);renderRhythm();return;}
 if(!clearTalkPart(t.progress,t.run,t.qte))return;
 const delta=t.progress.points-state.attempt.conversation;state.attempt.conversation=t.progress.points;score(delta);
 t.phase='clear';world.stopRhythmMotion?.();world.talkScene?.(TALK_PARTS[t.progress.index].motion,true);
 $('talk-feedback').textContent=`PART ${t.progress.index+1} CLEAR！ 相手との距離が縮まった。`;
 const music=t.music;t.music=null;if(music){music.resume();music.hit(2,true);setTimeout(()=>music.stop(),250);}
 const summary={finished:t.progress.cleared.length===4,completedParts:t.progress.cleared.length,hits:t.progress.hits,misses:t.progress.misses,notes:{length:24}};
 Object.assign(t,rhythmOutcome(summary,t.opening));renderRhythm();
 if(t.progress.index===0){t.ending=true;talkTimer=setTimeout(()=>{if(state.mode==='talk')openInvitation();},1200);}
 if(t.progress.cleared.length===4){t.ending=true;talkTimer=setTimeout(()=>{if(state.mode==='talk')completeEscort();},1200);}
}
function qteInput(action,point){
 const t=state.talk;if(state.mode!=='talk'||t?.phase!=='qte'||t.pausedAt!=null)return;
 inputTalkQte(t.qte,action,(now()-t.qteStartedAt)/1000,point);renderRhythm();finishQte();
}
function respond(key){
 const t=state.talk;if(state.mode!=='talk'||t?.phase!=='rhythm'||t.pausedAt!=null)return;
 const result=tapTalkRhythm(t.run,key,rhythmTime(t));if(!result)return;
 for(const event of result.events)rhythmFeedback(event);if(result.hit)rhythmFeedback(result.hit);
 renderRhythm();if(t.run.finished)finishRhythm();
}
$('part-next').addEventListener('click',()=>{const t=state.talk;if(state.mode!=='talk'||t.phase!=='clear'||t.progress.index===0||!nextTalkPart(t.progress))return;const sound=t.withSound;prepareTalkPart();startRhythm(sound);});
$('part-retry').addEventListener('click',()=>{const t=state.talk;if(state.mode!=='talk'||t.phase!=='retry')return;if(t.retryQte){t.retryQte=false;beginQte();renderRhythm();}else{const sound=t.withSound;prepareTalkPart();startRhythm(sound);}});
$('qte-button').addEventListener('click',()=>{if(state.talk?.qte?.kind==='tap')qteInput('tap');});
$('qte-button').addEventListener('pointerdown',e=>{if(state.talk?.qte?.kind==='tap')return;e.preventDefault();e.currentTarget.setPointerCapture?.(e.pointerId);qteInput('down',{x:e.clientX,y:e.clientY});});
$('qte-button').addEventListener('pointerup',e=>{if(state.talk?.qte?.kind!=='tap')qteInput('up',{x:e.clientX,y:e.clientY});});
$('qte-button').addEventListener('pointercancel',()=>qteInput('cancel'));
function updateMeters(){const t=state.talk;$('favor').value=t.favor;$('favor-value').textContent=t.favor;$('discomfort').value=t.discomfort;$('discomfort-value').textContent=t.discomfort;}
$('rhythm-start').addEventListener('click',()=>startRhythm(true));
$('rhythm-muted').addEventListener('click',()=>startRhythm(false));
document.addEventListener('visibilitychange',()=>{
 const t=state.talk;if(state.mode!=='talk'||!t?.started||t.ending)return;
 if(document.hidden){world.paused=true;t.pausedAt=now();t.music?.pause();if(t.qte)inputTalkQte(t.qte,'cancel',t.qte.elapsed);}
 else if(t.pausedAt!=null){const pause=now()-t.pausedAt;t.startedAt+=pause;if(t.qteStartedAt!=null)t.qteStartedAt+=pause;t.pausedAt=null;if(t.phase==='rhythm'){t.music?.resume();world.paused=t.progress.index!==1;}}
});
function endTalk(failed) {
  clearTimeout(talkTimer); stopTalkMusic();world.stopRhythmMotion?.();world.endRhythmTravel?.();world.endChallenge?.();
  if(state.escort){state.escort=null;world.companion=null;world.destination=null;world.waypoints=[];world.marker.visible=false;} const t = state.talk; finishNpc(t?.npc); const points = 0;
  closeInspect(); result(failed ? '相手のペースを大切に。' : 'ひとときの会話を、ありがとう。', failed ? '少し戸惑わせてしまったようだ。追わずに離れて、次は相手の話をゆっくり聞こう。' : '今回はここでお別れ。流れるノーツが下のラインに重なるタイミングでタップしてみよう。', points, '街に戻る ↗', explore, !failed);
}
function openInvitation() {
  stopTalkMusic(); world.endChallenge?.();
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
      $('invite-confirm').textContent = outcome.accepted ? `${destination.name || destination.label}へ一緒に向かう` : '一緒に向かう';
    }); return button;
  }));
  openModal('invitation');
}
function cancelInvitation() {
  if (state.mode !== 'invite') return;
  finishNpc(state.talk?.npc); state.talk = null; $('invitation').close(); explore(); toast('またね、と挨拶して別れた。');
}
function beginEscort() {
 if(state.mode!=='invite'||!state.invitation||!state.talk)return;
 const destination=state.invitation,t=state.talk,npc=t.npc;
 $('invitation').close();closeInspect();world.setDestination(destination);world.companion=npc;npc.followTarget=null;
 t.destination=destination;state.invitation=null;state.escort={destination,walk:createWalkRun(world.player.position,world.goal)};state.escort.walk.rhythmMode=true;
 state.attempt.consent=120;score(120);$('escort').hidden=true;
 if(!nextTalkPart(t.progress))return;
 prepareTalkPart();setMode('talk');openModal('conversation');
 $('talk-feedback').textContent='連れ出しパート！リズムに合わせて、ふたりで入口へ。';
}
function renderAlbum() {
  $('album-record').textContent = `デート BEST ${album.best} pt · 記念写真 ${album.records.length}枚`;
  $('album-items').replaceChildren(...album.records.map(record => {
    const figure=document.createElement('figure'), image=document.createElement('img'), caption=document.createElement('figcaption'), save=document.createElement('a');
    image.src=record.image; image.alt=`${record.name}とのゴール記念写真`; image.loading='lazy'; image.width=720;image.height=480;
    caption.textContent=`${record.name} · ${record.venue} · ${record.score} pt`;
    save.href=record.image;save.download=`city-approach-${record.id}.webp`;save.textContent='写真を保存';figure.append(image,caption,save);return figure;
  }));
}
function renderWalk() {
  const walk=state.escort?.walk;if(!walk)return;
  $('walk-score').textContent=`${dateTotal(state.attempt)} pt`;
  $('walk-combo').textContent=walk.combo ? `${walk.combo} COMBO` : walk.separated ? '相手を待とう' : '歩調を合わせよう';
  $('walk-comfort').value=walk.comfort;
  $('walk-cue').textContent=walk.prompt ? walk.prompt.line : walk.separated ? '少し離れたよ。立ち止まって待とう。' : '近くで歩くとスコアUP';
  $('walk-response').hidden=!walk.prompt;
  $('walk-response').disabled=walk.waiting;
  $('walk-response').textContent=walk.waiting?'相手を待っています…':walk.prompt?.button || '';
}
function collectWalkingScore() {
  const walk=state.escort?.walk;if(!walk)return;
  const delta=collectWalkPoints(walk); if(delta){state.attempt.walk+=delta;score(delta);}
}
function completeEscort() {
  if(!state.escort||state.talk?.progress.cleared.length!==4||!arrivedTogether(world.player.position,world.companion?.mesh.position,world.goal))return false;
  stopTalkMusic();world.stopRhythmMotion?.();world.endRhythmTravel?.();world.endChallenge?.();$('conversation').close();state.talk=null;
  const n = world.companion, destination = state.escort.destination, walk=state.escort.walk;
  const clear = destination.clearsGoal === true && ['netcafe', 'lovehotel'].includes(destination.type);
  let photo=null;
  if(clear) try { photo=world.makeGoalPhoto?.(n,destination); } catch(error) { console.warn('Goal photo unavailable',error); }
  collectWalkingScore(); const bonus=finishDate(state.attempt,walk,clear); score(bonus);
  finishNpc(n); world.faceEachOther?.(n); world.companion = null; $('escort').hidden = true; state.escort = null;
  if (clear) state.clears++;
  result(clear ? 'GOAL CLEAR · デート成立！' : '同行の練習、おつかれさま！',
    clear ? `${n.profile.name}と${destination.name}の入口に到着！「一緒に来られてうれしいです」` : `${destination.label}へ一緒に歩いた。ゴールは歌舞伎町のホテルかネットカフェ。次は歌舞伎町で誘ってみよう。`,
    0, 'また街を歩く ↗', explore, true);
  const total=dateTotal(state.attempt);
  $('result-points').textContent=`${total} pt`;
  $('date-breakdown').hidden=false;$('date-rank').textContent=`RANK ${dateRank(state.attempt)}`;
  const previousBest=album.best;
  if(clear) {
    album.best=Math.max(album.best,total);
    if(!album.unlocked.includes(destination.type))album.unlocked.push(destination.type);
    if(photo) {
      const id=`${n.profile.id}-${destination.type}`;
      const record={id,name:n.profile.name,venue:destination.name,score:total,image:photo};
      const existing=album.records.find(r=>r.id===id);
      if(!existing||total>=existing.score)album.records=[record,...album.records.filter(r=>r.id!==id)].slice(0,16);
    }
    const saved=saveAlbum(storage,album);
    if(!saved&&photo)toast('端末に記録を保存できませんでした。記念写真は画面から保存できます。');
  }
  $('date-best').textContent=clear&&total>previousBest?`NEW BEST! ${total} pt`:`デート BEST ${album.best} pt`;
  $('date-score-lines').replaceChildren(...[['声掛け',state.attempt.approach],['会話',state.attempt.conversation],['誘い',state.attempt.consent],['同行',state.attempt.walk],['到着',state.attempt.arrival],['テンポ',state.attempt.tempo]].map(([label,value])=>{
    const row=document.createElement('div'),dt=document.createElement('dt'),dd=document.createElement('dd');dt.textContent=label;dd.textContent=`${value} pt`;row.append(dt,dd);return row;
  }));
  if(clear&&photo) {
    $('result').classList.add('has-memory'); $('goal-memory').hidden=false;$('goal-photo').src=photo;$('goal-photo').alt=`${n.profile.name}と${destination.name}で撮った3Dモデルの記念写真`;
    $('goal-photo-caption').textContent=`${n.profile.name}と ${destination.name}`;
    $('goal-photo-save').href=photo;$('goal-photo-save').download=`city-approach-${n.profile.id}-${destination.type}.webp`;
  }
  state.best=album.best; updateScore(); $('date-breakdown').querySelector('details').open=false; renderAlbum();
}
function changeMap(map) {
  if (state.map === map) return;
  if (state.mode !== 'explore') { toast('今の会話や同行を終えてから、エリアを切り替えよう。'); return; }
  resetTouch(); closeInspect(); state.map = map; world.setMap(map); document.querySelectorAll('[data-map]').forEach(b => b.classList.toggle('active', b.dataset.map === map));
  $('guide-text').textContent = map === 'nagoya' ? '名古屋駅は会話・同行の練習。ゴールは歌舞伎町で。' : '声をかける → 誘う → ホテル・ネカフェの入口へ';
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
$('approach-start').addEventListener('click', () => { const n = state.selected; if (n) startTalk(n.profile.open[0] || 'empathy'); });
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
$('leave').addEventListener('click', () => { const n = state.selected; if (!n) return; const good = n.profile.guarded; finishNpc(n); closeInspect(); toast(good ? 'いい判断！ 相手の時間を尊重できた。' : '軽く会釈して離れた。'); tone(); mission('OBSERVE', '次のきっかけを探そう。', '気になるサインを見つけよう。'); });
$('invite-confirm').addEventListener('click', beginEscort);
$('invite-cancel').addEventListener('click', cancelInvitation);
$('invitation').addEventListener('cancel', event => { event.preventDefault(); cancelInvitation(); });
$('talk-exit').addEventListener('click', () => endTalk(false)); $('conversation').addEventListener('cancel', e => { e.preventDefault(); endTalk(false); });
$('result-next').addEventListener('click', () => { $('result').close(); resultAction?.(); }); $('result').addEventListener('cancel', e => { e.preventDefault(); $('result-next').click(); });
$('walk-response').addEventListener('click',()=>{
  if(state.mode!=='escort'||document.hidden)return;
  const response=respondWalk(state.escort.walk,world.distanceTo(world.companion));if(!response)return;
  if(response.wait){resetTouch();world.keys.clear();world.destination=null;world.waypoints=[];world.marker.visible=false;}
  else if(!response.far){world.respondToCompanion?.();world.challengeFeedback?.('perfect');tone('success');}
  toast(response.reply);collectWalkingScore();renderWalk();
});
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
window.addEventListener('keydown', e => { if(state.mode==='escort'&&e.key.toLowerCase()==='f'&&!e.repeat&&!e.ctrlKey&&!e.metaKey&&!e.altKey){e.preventDefault();$('walk-response').click();} if (state.mode === 'talk' && !e.repeat && !e.ctrlKey && !e.metaKey && !e.altKey && ['1', '2', '3'].includes(e.key)) { e.preventDefault(); respond(TALK_LANES[Number(e.key) - 1].key); } if (e.key === 'Escape' && state.mode === 'explore') closeInspect(); });
window.addEventListener('keydown',e=>{
 if(state.mode!=='talk'||state.talk?.phase!=='qte'||e.repeat||e.ctrlKey||e.altKey||e.metaKey)return;
 const kind=state.talk.qte.kind;
 if(e.key===' '){e.preventDefault();if(kind==='tap')qteInput('tap');else if(kind==='hold')qteInput('down');}
 if(e.key==='ArrowRight'&&kind==='swipe'){e.preventDefault();qteInput('down',{x:0,y:0});qteInput('up',{x:100,y:0});}
});
window.addEventListener('keyup',e=>{if(e.key===' '&&state.mode==='talk'&&state.talk?.phase==='qte'&&state.talk.qte.kind==='hold'){e.preventDefault();qteInput('up');}});
renderAlbum(); updateScore(); setMode('intro'); openModal('intro');
const ctx = $('minimap').getContext('2d'); let previous = performance.now(), lastRender = 0, mapTick = 0;
function frame(frameNow) {
  if (document.hidden || frameNow - lastRender < (world.profile?.frameInterval || 0)) { requestAnimationFrame(frame); if (document.hidden) previous = frameNow; return; }
  const interval = world.profile?.frameInterval || 0;
  lastRender = interval ? frameNow - ((frameNow - lastRender) % interval) : frameNow;
  const dt = Math.min((frameNow - previous) / 1000, .05); previous = frameNow; state.elapsed += dt;
  if(state.mode==='talk'&&state.talk?.phase==='rhythm'){world.rhythmBeat?.(state.talk.run.elapsed,state.talk.progress.index);if(state.talk.progress.index===1)world.keys.clear();}
  arcade.update(dt); world.update(dt, state.elapsed); mapTick += dt;
  if(state.mode==='talk'&&state.talk?.progress.index===1&&state.talk.phase==='rhythm'&&state.escort){advanceWalk(state.escort.walk,dt,world.player.position,world.companion.mesh.position,world.goal);collectWalkingScore();}
  if(state.mode==='talk' && state.talk?.phase==='rhythm' && state.talk.pausedAt==null){
    for(const event of advanceTalkRhythm(state.talk.run,rhythmTime(state.talk)))rhythmFeedback(event);
    renderRhythm();if(state.talk.run.finished)finishRhythm();
  }
  if(state.mode==='talk'&&state.talk?.phase==='qte'&&state.talk.pausedAt==null){advanceTalkQte(state.talk.qte,(now()-state.talk.qteStartedAt)/1000);renderRhythm();finishQte();}
  if (state.touring && !world.destination) { state.touring = false; $('guide-text').textContent = state.map === 'nagoya' ? '名古屋駅は会話・同行の練習。ゴールは歌舞伎町で。' : '声をかける → 誘う → ホテル・ネカフェの入口へ'; }
  if (state.mode === 'explore' && !state.selected && !state.touring) {
    const street = (world.npcs || []).find(n => n.profile?.autoApproach && n.cooldown <= state.elapsed && world.distanceTo(n) < 2.7);
    if (street) openStreet(street);
  }
  if (mapTick > .2) { if ($('game-menu').open) world.drawMinimap(ctx); mapTick = 0; }
  if (state.selected && state.mode === 'explore') {
    const dist = world.distanceTo(state.selected); $('approach-start').disabled = dist > 3.5; $('partner-play').disabled = dist > 3.5 || !!state.selected.profile.guarded; $('partner-play').textContent = state.selected.profile.guarded ? '今は忙しそう' : dist > 3.5 ? '近くまで移動中…' : '一緒にリズム遊び · 15秒'; $('approach-status').hidden = dist <= 3.5; $('approach-status').textContent = '近くまで移動中…';  $('opener-actions').querySelectorAll('button').forEach(b => b.disabled = dist > 3.5);
  }
  if (state.mode === 'escort') {
    const walk=state.escort.walk, previousHits=walk.hits;
    advanceWalk(walk,dt,world.player.position,world.companion.mesh.position,world.goal);
    if(walk.hits>previousHits){toast('「待ってくれてありがとう」');world.respondToCompanion?.();tone('success');}
    collectWalkingScore();renderWalk();
    const dist = world.player.position.distanceTo(world.goal); $('goal-distance').textContent = `${Math.ceil(dist)} m`; if (arrivedTogether(world.player.position, world.companion?.mesh.position, world.goal)) completeEscort(); }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
return { state, world, arcade };
}

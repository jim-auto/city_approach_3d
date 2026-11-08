const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const distance = (a,b) => Math.hypot(a.x-b.x,a.z-b.z);
export function createDateRun() {
  return { approach: 50, conversation: 0, consent: 0, walk: 0, arrival: 0, tempo: 0, replyCombo: 0, replyTurns: new Set(), finished: false };
}
export function scoreReply(run, turn, correct) {
  if (!run || run.finished || run.replyTurns.has(turn)) return 0;
  run.replyTurns.add(turn); run.replyCombo = correct ? run.replyCombo + 1 : 0;
  const points = correct ? 40 + run.replyCombo * 10 : 0; run.conversation += points; return points;
}
export function dateTotal(run) { return !run ? 0 : run.approach + run.conversation + run.consent + run.walk + run.arrival + run.tempo; }
export function createWalkRun(player, goal) {
  return { elapsed: 0, bestDistance: distance(player,goal), previous: {...player}, progress: 0, together: 0, comfort: 65, points: 0, eventPoints: 0, paid: 0, combo: 0, maxCombo: 0, hits: 0, misses: 0, count: 0, prompt: null, waiting: false, separated: false, finished: false };
}
const cues = [
  { line: '目が合った。笑顔で返そう。', button: '笑顔を返す', reply: '「目が合うと、なんかうれしいね」' },
  { line: '「人が多いね。ゆっくり行こう？」', button: '「一緒にゆっくり行こう」', reply: '「ありがとう。このペースがいいね」' },
  { line: '楽しそうに話しかけてきた。', button: '相手の話にうなずく', reply: '「ちゃんと聞いてくれてうれしい！」' },
  { line: '「一緒に歩くの、楽しいね」', button: '「自分も楽しい」', reply: '「ふふ、着いてからも話そうね」' },
];
export function advanceWalk(run, dt, player, companion, goal) {
  if (!run || run.finished || !Number.isFinite(dt) || dt <= 0) return;
  dt = Math.min(.25, dt); run.elapsed += dt;
  const step = distance(player,run.previous), remaining = distance(player,goal), gap = distance(player,companion);
  run.previous = {x:player.x,z:player.z};
  const progress = step <= 1.3 && step > .001 ? Math.min(step, Math.max(0,run.bestDistance-remaining)) : 0;
  run.bestDistance = Math.min(run.bestDistance,remaining); run.progress += progress;
  if (gap <= 2.8) { run.together += progress; run.comfort = clamp(run.comfort + progress * .7,0,100); }
  else if (gap > 4) run.comfort = clamp(run.comfort - dt * 9,0,100);
  run.points = Math.min(300, Math.floor(run.together * 2) + run.eventPoints);
  if (run.prompt && run.elapsed > run.prompt.expires) { run.misses++; run.combo = 0; run.comfort = Math.max(0,run.comfort-10); run.prompt = null; run.waiting = false; }
  if (!run.rhythmMode && !run.prompt && run.count < cues.length && run.progress >= [1.5,7,15,25][run.count]) {
    const cue = gap > 3.3 ? {line:'「少し待って。一緒に歩こう？」',button:'立ち止まって待つ',reply:'「待ってくれてありがとう」',wait:true} : cues[run.count];
    run.prompt = {...cue, expires:run.elapsed+5}; run.count++;
  }
  if (run.waiting && run.prompt && gap <= 2.8) resolveWalkCue(run);
  run.separated = gap > 4;
}
function resolveWalkCue(run) {
  const cue=run.prompt; if (!cue) return null;
  run.hits++; run.combo++; run.eventPoints+=30+10*run.combo; run.maxCombo=Math.max(run.maxCombo,run.combo); run.comfort=Math.min(100,run.comfort+10);
  run.prompt=null; run.waiting=false;
  run.points=Math.min(300,Math.floor(run.together*2)+run.eventPoints);
  return {reply:cue.reply, points:30+10*run.combo};
}
export function respondWalk(run, gap) {
  if (!run || run.finished || !run.prompt || run.waiting || run.elapsed > run.prompt.expires) return null;
  if (run.prompt.wait) { run.waiting=true; return {wait:true,reply:'立ち止まって、相手が追いつくのを待とう。'}; }
  if (gap > 3.3) return {far:true,reply:'少し近づいてから、もう一度応えよう。'};
  return resolveWalkCue(run);
}
export function collectWalkPoints(walk) { const delta=Math.max(0,walk.points-walk.paid); walk.paid+=delta; return delta; }
export function finishDate(run, walk, goalClear) {
  if (!run || run.finished) return 0;
  run.finished=true; run.arrival=goalClear?200:100; run.tempo=goalClear?Math.max(0,100-Math.floor((walk?.elapsed||0)/2)):0;
  if (walk) walk.finished=true;
  return run.arrival+run.tempo;
}
export function dateRank(run) { const total=dateTotal(run); return total>=1000?'S':total>=850?'A':total>=700?'B':'C'; }
const ALBUM_KEY='city-approach-album-v1';
export function loadAlbum(storage) {
  try { const raw=JSON.parse(storage?.getItem(ALBUM_KEY)||'{}'); return {unlocked:['netcafe','lovehotel'].filter(id=>Array.isArray(raw?.unlocked)&&raw.unlocked.includes(id)),best:Number.isSafeInteger(raw?.best)&&raw.best>=0?raw.best:0,records:Array.isArray(raw?.records)?raw.records.filter(r=>r&&typeof r.id==='string'&&typeof r.name==='string'&&typeof r.venue==='string'&&Number.isSafeInteger(r.score)&&r.score>=0&&typeof r.image==='string'&&r.image.length<300000&&/^data:image\/(webp|png|jpeg);base64,[A-Za-z0-9+/=]+$/.test(r.image)).slice(0,16):[]}; } catch {return {unlocked:[],best:0,records:[]};}
}
export function saveAlbum(storage,album) {try {if(!storage)return false;storage.setItem(ALBUM_KEY,JSON.stringify(album));return true;} catch {return false;}}

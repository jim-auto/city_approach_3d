export const PROFILES = [
  { id: 'waiting', name: '待ち合わせ中の人', traits: ['立ち止まり', 'スマホ', '待ち合わせ'], cue: '時々時計を見て、周囲を見渡している。', open: ['empathy', 'situation'], interest: 52, color: '#dc9aab', hair: '#42293a', speed: 0.15 },
  { id: 'eye', name: '散歩中の人', traits: ['目が合う', '歩くのがゆっくり'], cue: 'こちらと目が合うと、小さく会釈した。', open: ['empathy', 'situation', 'joke'], interest: 58, color: '#b5b3ec', hair: '#333144', speed: 0.5 },
  { id: 'tourist', name: '街を見ている人', traits: ['周囲を見る', '観光中', 'カメラ'], cue: 'カメラを片手に、道を探しているようだ。', open: ['item', 'situation'], interest: 48, color: '#e3b86f', hair: '#65483d', speed: 0.3 },
  { id: 'busy', name: '急いでいる人', traits: ['足早', 'スマホ', '余裕がなさそう'], cue: '画面を見ながら足早に歩いている。今はそっとしておこう。', open: [], interest: 20, color: '#6486a9', hair: '#292936', speed: 1.2, guarded: true },
  { id: 'earphones', name: '音楽を聴いている人', traits: ['イヤホン', '視線が合わない'], cue: '音楽に集中していて、周囲に注意を向けていない。', open: [], interest: 18, color: '#88ab98', hair: '#383039', speed: 0.85, guarded: true },
  { id: 'cafe', name: 'ひと休み中の人', traits: ['コーヒー', '立ち止まり', '目が合う'], cue: 'カップを持ってひと休み。少し時間がありそう。', open: ['item', 'empathy'], interest: 60, color: '#e58b74', hair: '#553931', speed: 0 },
  { id: 'reader', name: '本を読んでいる人', traits: ['読書', '立ち止まり'], cue: '本から顔を上げて、ひと息ついている。', open: ['item'], interest: 42, color: '#a998c2', hair: '#3d3437', speed: 0 },
  { id: 'friend', name: '友達を待つ人', traits: ['友達と一緒', 'もうすぐ出発'], cue: '友達と話しながら出発するところ。流れを止めずに離れよう。', open: [], interest: 22, color: '#80b6c1', hair: '#413226', speed: 0.6, guarded: true },
];
export const OPENERS = [
  { key: 'empathy', label: '共感する', text: '「今日は人が多いですね」' },
  { key: 'situation', label: '状況いじり', text: '「ここ、待ち合わせの定番ですね」' },
  { key: 'item', label: '持ち物に触れる', text: '「それ、素敵ですね」' },
  { key: 'joke', label: 'ユーモア賭け', text: '「この街、迷路みたいですね」' },
];
export const RESPONSES = [{ key: 'listen', label: '聞く', sub: '相手のペースで' }, { key: 'empathy', label: '共感', sub: '気持ちを受け止める' }, { key: 'joke', label: 'ツッコミ', sub: '軽く笑いにする' }, { key: 'proposal', label: '提案', sub: '次のきっかけを' }];
export const clamp = (v, min = 0, max = 100) => Math.min(max, Math.max(min, v));
export function evaluateOpener(profile, key, map = 'kabukicho') {
  if (profile.guarded) return { success: false, favor: 0, discomfort: 75, message: '今は話す余裕がないようだ。追わずに、相手の時間を尊重しよう。' };
  const good = profile.open.includes(key);
  return { success: good, favor: profile.interest + (good ? 3 : -8), discomfort: map === 'kabukicho' ? 24 : 14, message: good ? '足を止めて、話を聞いてくれた。' : '少し戸惑っているようだ。軽く会釈して離れよう。' };
}
export function buildLines(profile, map) {
  const specific = {
    waiting: { text: '友達、もう20分も遅れてるんです。', cue: '待ち時間への気持ち', correct: ['empathy', 'joke'] },
    eye: { text: '目、合っちゃいましたね。', cue: '偶然のきっかけ', correct: ['empathy', 'joke'] },
    tourist: { text: 'この辺、初めてで。道に迷っちゃって。', cue: '案内を求めている', correct: ['proposal', 'empathy'] },
    cafe: { text: 'このコーヒー、おいしくてつい休憩しちゃった。', cue: '好きなものの話', correct: ['empathy', 'joke'] },
    reader: { text: '続きが気になって、ずっと読んじゃいました。', cue: '好きなものの話', correct: ['empathy'] },
  };
  return [
    { text: 'あ、こんにちは。ちょうどひと息ついてたところで。', cue: 'まずは話を聞こう', correct: ['listen'] },
    specific[profile.id] || specific.eye,
    { text: map === 'kabukicho' ? 'ネオンは綺麗だけど、人が多いと少し疲れますね。' : '駅って人が多くて、ちょっと疲れますね。', cue: '気持ちへの共感', correct: ['empathy'] },
    { text: '話してたら、なんだか気分転換になりました。', cue: '相手の話を受け止める', correct: ['listen', 'empathy'] },
    { text: 'まだ少し時間があるんです。このあと、どうしようかな。', cue: '次の予定を提案する場面', correct: ['proposal'] },
  ];
}
export function applyResponse(state, line, key) {
  const ready = state.favor >= 68 && state.discomfort < 60;
  const correct = line.correct.includes(key);
  const chain = correct ? state.chain + 1 : 0;
  const gain = correct ? 12 + Math.min(9, (chain - 1) * 3) : key === 'listen' ? 0 : -6;
  return {
    favor: clamp(state.favor + gain), discomfort: clamp(state.discomfort + (correct ? -6 : key === 'listen' ? -4 : 22)), chain,
    accepted: correct && key === 'proposal' && ready && line.cue === '次の予定を提案する場面', correct,
    feedback: correct ? (key === 'listen' ? '相手のペースで話を聞けた。' : '気持ちに合う返答ができた。') : key === 'listen' ? 'ひと呼吸。落ち着いて話を聞いた。' : '少し話がすれ違った。サインをよく見よう。',
  };
}
export function rank(score) { return score >= 500 ? 'S' : score >= 320 ? 'A' : score >= 200 ? 'B' : score >= 90 ? 'C' : 'D'; }
export function loadBest(storage) { try { const value = Number(storage.getItem('city-approach-3d-best')); return Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0; } catch { return 0; } }
export function saveBest(storage, score) { try { storage.setItem('city-approach-3d-best', String(score)); } catch { /* Private browsing can disable storage. */ } }

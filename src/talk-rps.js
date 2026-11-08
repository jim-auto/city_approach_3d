// Visible opponent hands make this a reaction game, not a random dialogue quiz.
export const TALK_HANDS = [
  { key: 'rock', icon: '✊', name: 'グー', action: 'ボケる', beats: 'scissors' },
  { key: 'scissors', icon: '✌', name: 'チョキ', action: 'ノる', beats: 'paper' },
  { key: 'paper', icon: '✋', name: 'パー', action: '聞く', beats: 'rock' },
];
const signs = {
  rock: ['ちょっと照れながら、こちらを見ている。', '少し考え込みながら、話を続けている。'],
  scissors: ['いたずらっぽく笑っている。', '楽しそうに、こちらへ身を乗り出した。'],
  paper: ['笑顔で、話しかけてきた。', 'もっと話したそうに、手を振っている。'],
};
const reactions = {
  rock: '「ふふっ、なにそれ！ おもしろいね」',
  scissors: '「それそれ！ なんか気が合うね」',
  paper: '「ちゃんと聞いてくれるの、うれしい」',
};
const clamp = n => Math.max(0, Math.min(100, n));
export function createTalkRps(random = Math.random) {
  let previous;
  return Array.from({length:5}, (_,i) => {
    const available = TALK_HANDS.filter(h => h.key !== previous);
    const hand = available[Math.min(available.length-1, Math.max(0, Math.floor(random()*available.length)))];
    previous = hand.key;
    return { hand:hand.key, cue:signs[hand.key][i%2], seconds:i===0?6:4.5 };
  });
}
export function winningHand(opponent) { return TALK_HANDS.find(h => h.beats === opponent)?.key; }
export function playTalkHand(talk, key) {
  const hand = TALK_HANDS.find(h => h.key === key), round = talk.rounds[talk.turn];
  if (!round || talk.locked || (key !== 'timeout' && !hand)) return null;
  const grade = key === 'timeout' ? 'miss' : key === round.hand ? 'draw' : hand.beats === round.hand ? 'win' : 'lose';
  const win = grade === 'win', wins = talk.wins + Number(win), chain = win ? talk.chain + 1 : 0;
  const favor = clamp(talk.favor + (win ? 12 : grade === 'draw' ? 1 : -6));
  const discomfort = clamp(talk.discomfort + (win ? -6 : grade === 'draw' ? 0 : 14));
  return { grade, wins, chain, favor, discomfort, correct:win,
    accepted:talk.turn===talk.rounds.length-1 && wins>=3 && favor>=68 && discomfort<60,
    feedback:win?reactions[key]:grade==='draw'?'「ふふ、同じこと考えてた？」':grade==='miss'?'「あれ、どうしたの？」':'「あ、うん……ちょっと違ったかも」',
  };
}

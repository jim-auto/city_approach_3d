export const STREET_PROFILES = [
  { id: 'catch', role: 'catch', name: '居酒屋のキャッチ', age: 28, traits: ['キャッチ'], cue: 'メニューを片手に店を案内している。', color: '#704659', hair: '#26212b', speed: 0, open: [], interest: 0 },
  { id: 'scout', role: 'scout', name: 'スカウト', age: 31, traits: ['スカウト'], cue: '通りかかる人に仕事の話を持ちかけている。', color: '#313b52', hair: '#4d352a', speed: 0, open: [], interest: 0 },
];
export function streetLines(role) {
  return role === 'catch' ? {
    line: 'お兄さん、お店探してる？ 居酒屋なら案内するよ。',
    choices: [
      ['今日はいいです。', '了解です。楽しんでいってね。'],
      ['TOHOの裏に行く道を教えて。', 'ビル前から一番街側へ曲がって、北側の道に出ると一周できるよ。'],
      ['どんなお店？', 'このゲームの架空の居酒屋だよ。今日は話だけで大丈夫。'],
    ],
  } : {
    line: '雰囲気いいね。接客の仕事に興味ない？',
    choices: [
      ['仕事は探していません。', 'そっか、声かけてごめんね。'],
      ['どんな話ですか？', '架空のお店の求人案内だよ。今回は話を聞くだけで大丈夫。'],
      ['今はデートの相手を探してるんです。', 'なるほど。ゴジラ前や広場に人が集まっているよ。'],
    ],
  };
}

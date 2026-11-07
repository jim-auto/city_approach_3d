export const STREET_PROFILES = [
  { id: 'catch', role: 'catch', autoApproach: true, name: '居酒屋のキャッチ', age: 28, traits: ['キャッチ'], cue: 'メニューを片手に店を案内している。', color: '#704659', hair: '#26212b', speed: 0, open: [], interest: 0 },
  { id: 'scout', role: 'scout', autoApproach: true, name: 'スカウト', age: 31, traits: ['スカウト'], cue: '通りかかる人に仕事の話を持ちかけている。', color: '#313b52', hair: '#4d352a', speed: 0, open: [], interest: 0 },
  { id: 'toyoko_sora', role: 'toyoko', name: 'トー横のソラ', age: 20, traits: ['広場の仲間', '音楽'], cue: '友達と音楽の話をしている。', color: '#373343', hair: '#c18aab', speed: 0, open: [], interest: 0 },
  { id: 'toyoko_ruka', role: 'toyoko', name: 'トー横のルカ', age: 21, traits: ['広場の仲間', '写真'], cue: 'スマホで撮った写真を友達に見せている。', color: '#a2b9b2', hair: '#322c39', speed: 0, open: [], interest: 0 },
  { id: 'toyoko_neo', role: 'toyoko', name: 'トー横のネオ', age: 20, traits: ['広場の仲間', '待ち合わせ'], cue: '広場で友達を待ちながら雑談している。', color: '#8e82a7', hair: '#615369', speed: 0, open: [], interest: 0 },
];
export function streetLines(role, id) {
  if (role === 'toyoko') return {
    line: {
      toyoko_sora: '今、好きな曲の話してた。映画を観に来たの？',
      toyoko_ruka: 'この辺、ネオンの写真がきれいに撮れるんだよね。ほら、この写真。',
      toyoko_neo: '友達とここで待ち合わせ。さっきTOHOの周りを歩いてきたところ。',
    }[id] || 'ここで友達と話してたところ。少し話す？',
    choices: [
      ['最近、何の話で盛り上がってる？', '音楽とか服とか、最近観た映画の話。みんな好みが違うから面白いんだよね。'],
      ['TOHOの裏側にも回れる？', '一番街側から北へ進むと、ビルの裏側に出られるよ。東側を通れば正面に戻れる。'],
      ['じゃあ、またね。', 'うん、またね。街歩き楽しんで！'],
    ],
  };
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

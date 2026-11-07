export const STREET_PROFILES = [
  { id: 'catch', role: 'catch', autoApproach: true, name: '居酒屋のキャッチ', age: 28, traits: ['キャッチ'], cue: 'メニューを片手に店を案内している。', color: '#704659', hair: '#26212b', speed: 0, open: [], interest: 0 },
  { id: 'scout', role: 'scout', autoApproach: true, name: 'スカウト', age: 31, traits: ['スカウト'], cue: '通りかかる人に仕事の話を持ちかけている。', color: '#313b52', hair: '#4d352a', speed: 0, open: [], interest: 0 },
  { id: 'toyoko_sora', role: 'toyoko', name: 'トー横のソラ', age: 20, traits: ['広場の仲間', '音楽'], cue: '友達と音楽の話をしている。', color: '#373343', hair: '#c18aab', speed: 0, open: [], interest: 0 },
  { id: 'toyoko_ruka', role: 'toyoko', name: 'トー横のルカ', age: 21, traits: ['広場の仲間', '写真'], cue: 'スマホで撮った写真を友達に見せている。', color: '#a2b9b2', hair: '#322c39', speed: 0, open: [], interest: 0 },
  { id: 'toyoko_neo', role: 'toyoko', name: 'トー横のネオ', age: 20, traits: ['広場の仲間', '待ち合わせ'], cue: '広場で友達を待ちながら雑談している。', color: '#8e82a7', hair: '#615369', speed: 0, open: [], interest: 0 },
  { id: 'night_mai', role: 'street_waiting', zone: 'nightlife', name: '客待ち中のマイ', age: 25, traits: ['客待ち', '待ち合わせ通り'], cue: 'コート姿でスマホを確認し、約束の相手を待っている。', color: '#c8adad', hair: '#40303c', speed: 0, open: [], interest: 0 },
  { id: 'night_rei', role: 'sugar_date', zone: 'nightlife', name: 'P活女子のレイ', age: 24, traits: ['食事の待ち合わせ', 'P活'], cue: 'バッグを持って、食事の約束の時間を確かめている。', color: '#c49ab2', hair: '#755543', speed: 0, open: [], interest: 0 },
  { id: 'night_kaito', role: 'host', zone: 'nightlife', name: 'ホストのカイト', age: 27, traits: ['ホスト', '出勤前'], cue: 'ジャケット姿で、出勤前に店先に立っている。', color: '#c2bbc9', hair: '#684c3c', speed: 0, open: [], interest: 0 },
];
export function streetLines(role, id) {
  if (role === 'street_waiting') return {
    line: 'こんばんは。今、お客さんと待ち合わせしてるの。少し話すだけなら。',
    choices: [
      ['この通りではよく待ち合わせするの？', 'このゲームの待ち合わせ通りには、いろんな約束で人が集まるの。今日は時間までここで待つつもり。'],
      ['映画館の正面に戻る道は？', 'この道を南へ行って、西に曲がるとTOHOの正面だよ。'],
      ['待ち合わせの邪魔をしてごめん、またね。', 'うん、またね。街歩き楽しんで。'],
    ],
  };
  if (role === 'sugar_date') return {
    line: '今日はP活で、食事の約束。相手が来るまで少し時間があるの。',
    choices: [
      ['どんなお店が好き？', '落ち着いて話せるカフェが好き。最近は映画の話で盛り上がったよ。'],
      ['普段は何をして過ごすの？', '仕事が休みの日は、写真を撮ったり友達と服を見に行ったりしてる。'],
      ['じゃあ、食事楽しんできてね。', 'ありがとう。じゃあね。'],
    ],
  };
  if (role === 'host') return {
    line: 'こんばんは、カイトです。架空のホストクラブ「LUNA」で働いてる。今日は出勤前なんだ。',
    choices: [
      ['どんな仕事なの？', 'お客さんと話して、店で楽しい時間を過ごしてもらう仕事。人の話を聞くのも大事なんだよね。'],
      ['この辺の道を教えて。', '西側を回るとシネシティ広場。ビル沿いに歩けばTOHOの周りを一周できるよ。'],
      ['今日は街歩きだけ。またね。', '了解。楽しんでいってね。'],
    ],
  };
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

import { KABUKICHO_LAYOUT } from './kabukicho.js';
export function destinationsFor(map) {
  return map === 'kabukicho' ? KABUKICHO_LAYOUT.destinations : [
    { id: 'towers', label: 'タワーズ側の入口', x: 6.1, z: 23, invitation: 'タワーズ側で、もう少し話しませんか？', answer: 'いいですね。入口まで一緒に行きましょう。' },
    { id: 'gold', label: '金時計前', x: 3, z: 18, invitation: '金時計のほうまで一緒に歩きませんか？', answer: 'ちょうどそちらに行きたかったんです。一緒に行きましょう。' },
    { id: 'silver', label: '銀時計前', x: 3, z: -20, invitation: '銀時計のほうへ、少し歩きませんか？', answer: '少しなら大丈夫です。一緒に歩きましょう。' },
  ];
}
export function evaluateInvitation(profile, destination, talk) {
  if (!destination || profile.guarded || talk.favor < 68 || talk.discomfort >= 60) return { accepted: false, answer: '今日はここで。また機会があれば。' };
  if (profile.id === 'waiting' && destination.id === 'lounge') return { accepted: false, answer: '友達が来るので、ラウンジはやめておきます。近くを歩くくらいなら。' };
  return { accepted: true, answer: destination.answer };
}
export function spokenReplies(turn, map) {
  return [
    ['そうなんですね。少しお話ししても？', 'この辺はにぎやかですね。', 'ひと休みのプロですね。', 'すぐ別の場所へ行きませんか？'],
    ['そうだったんですね。', 'それ、気になりますよね。', 'この街、話のネタが尽きませんね。', '何か手伝えることはありますか？'],
    ['うん、聞いています。', 'わかります。少し落ち着きたいですね。', '疲れるのも街歩きの醍醐味ですね。', 'このままどこか行きましょう。'],
    ['そう言ってもらえてうれしいです。', '私も話せて楽しいです。', 'もう長年の友達みたいですね。', 'じゃあ、すぐ移動しましょう。'],
    ['この後の予定はありますか？', 'ゆっくりできるといいですね。', '街を一周しちゃいますか。', map === 'kabukicho' ? 'よかったら、少し一緒に歩きませんか？' : 'よかったら、駅の中を一緒に歩きませんか？'],
  ][turn];
}

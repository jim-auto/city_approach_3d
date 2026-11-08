// Official venue pages and their linked map pins checked 2026-11-08.
// North is -z. Game streets are compressed; these are walkable ground-floor approaches,
// not survey coordinates or a claim to reproduce interior layouts.
export const KABUKICHO_VENUES = [
  {
    id: 'customa', type: 'netcafe', clearsGoal: true,
    name: 'カスタマカフェ 歌舞伎町店', label: 'カスタマカフェのビル入口', x: -25.5, z: -7,
    address: '東京都新宿区歌舞伎町1-21-1 第二東亜会館ビル7F', floor: '7F',
    latitude: 35.695223, longitude: 139.701313,
    source: 'https://rakutama.com/shop/kabukicho.html', mapSource: 'https://goo.gl/maps/VKchcdvskwN2',
    building: {x: -32, z: -7, width: 8, depth: 12, height: 24, rotation: Math.PI / 2},
    invitation: '近くのネットカフェで、少し座って話さない？',
    answer: 'うん、もう少し話したい。行こう。',
    routeHint: 'TOHO前から西へ、一番街を南へ。第二東亜会館の1F入口（店舗は7F）。',
  },
  {
    id: 'hotel-i', type: 'lovehotel', clearsGoal: true,
    name: 'HOTEL i（ホテルアイ）', label: 'ホテルアイの入口', x: 5.7, z: 24,
    address: '東京都新宿区歌舞伎町1-13-4', floor: '1F',
    latitude: 35.6945363, longitude: 139.7023689,
    source: 'https://ssh-hotel-group.com/hotel_details/hotel-i/', mapSource: 'https://goo.gl/maps/eXUXAXonCdHUNpHi7',
    building: {x: 11.3, z: 24, width: 7.8, depth: 10, height: 14, rotation: -Math.PI / 2},
    invitation: 'ホテルアイで、ふたりで休憩しませんか？',
    answer: '私も一緒に行きたいです。ホテルアイまで行きましょう。',
    routeHint: 'TOHO正面からゴジラロードを南へ。東側のホテルアイ入口。',
  },
];
export function arrivedTogether(player, companion, destination) {
  if (!player || !companion || !destination) return false;
  return Math.hypot(player.x - destination.x, player.z - destination.z) < 1.4
    && Math.hypot(companion.x - destination.x, companion.z - destination.z) < 2.4;
}

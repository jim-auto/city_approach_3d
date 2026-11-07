import * as THREE from 'three';
import { box, cylinder, textSign, material } from './scenery.js';
import { buildTohoBuilding } from './toho.js';

// North is -z. Compressed from the operator's surrounding street map:
// Yasukuni → Central Road → Toho; Ichibangai/plaza/Tokyu tower lie west.
const rect = (id, name, minX, maxX, minZ, maxZ) => ({ id, name, minX, maxX, minZ, maxZ });
export const KABUKICHO_LAYOUT = {
  bounds: { minX: -65, maxX: 38, minZ: -59, maxZ: 49 },
  start: [0, 29], goal: [9.8, -25.8], goalLabel: 'ホテル入口', obstacles: [],
  people: [[-3.8, 23], [3.5, -7], [-21, -20], [22, 4], [3.7, 0], [-34, -32], [-23, 18], [3, -19]],
  walkways: [
    rect('central-road', 'ゴジラロード', -6.5, 6.5, -22, 49),
    rect('cinema-front-road', '東宝ビル前', -50, 35, -22, -12),
    rect('ichibangai', '歌舞伎町一番街', -27, -18, -58, 49),
    rect('east-road', '東宝ビル東側', 17, 26, -58, 49),
    rect('toho-west', '東宝ビル西側', -22, -14, -51, -18),
    rect('toho-rear', '東宝ビル裏', -23, 25, -48, -41.3),
    rect('toho-east', '東宝ビル東側歩道', 14.2, 24, -51, -18),
    rect('hanamichi', '花道通り', -50, 35, -58, -48),
    rect('yasukuni', '靖国通り', -50, 35, 39, 49),
    rect('middle-alley', '仲通り', -50, 35, 12, 19),
    rect('cinecity', 'シネシティ広場', -45, -24, -40, -16),
    rect('hotel-approach', 'ホテル入口前', 5, 15.8, -28, -17),
    rect('cinema-approach', '映画館入口前', -4, 5, -28, -17),
  ],
  streetPeople: [[-20, -17], [20, -30]],
  tour: [[0, -17], [-17, -17], [-17, -44.5], [19, -44.5], [19, -17], [0, -17]],
  landmarks: [
    { id: 'toho-cinemas', name: 'TOHOシネマズ 新宿', x: 0, z: -28, color: '#f1e8db', height: 10 },
    { id: 'cinecity', name: 'シネシティ広場', x: -35, z: -30, color: '#8dd5d7', height: 2 },
    { id: 'tokyu-tower', name: '東急歌舞伎町タワー', x: -55, z: -35, color: '#77cbea' },
    { id: 'ichibangai-gate', name: '一番街ゲート', x: -22.5, z: 38, color: '#f08794' },
    { id: 'godzilla-head', name: 'ゴジラヘッド', x: -6.8, z: -28.8, color: '#9bb3a1' },
  ],
  destinations: [
    { id: 'cinema', label: '映画館の入口', x: 0, z: -26, invitation: '一緒に映画を観ませんか？', answer: 'いいですね。TOHOの入口まで一緒に行きましょう。' },
    { id: 'plaza', label: 'シネシティ広場', x: -35, z: -32, invitation: '広場のほうで、もう少し話しませんか？', answer: '少しなら。広場のほうに歩きましょう。' },
    { id: 'lounge', label: 'ホテルのラウンジ入口', x: 9.8, z: -25.8, invitation: 'ラウンジで続きを話しませんか？', answer: 'もう少し話したいです。まず入口まで一緒に行きましょう。' },
  ],
};
function group(parent, name, x, z) { const g = new THREE.Group(); g.name = name; g.position.set(x, 0, z); parent.add(g); return g; }
function sign(parent, text, x, y, z, w, h, bg, fg = '#faf0d9', rotation = 0) {
  const mesh = textSign(parent, text, x, y, z, w, h, bg, fg, rotation); mesh.name = `sign:${text}`; return mesh;
}
function vertical(parent, text, x, y, z, color, rotation = 0, width = 1.05) {
  const g = group(parent, `vertical:${text}`, x, z); g.position.y = y; g.rotation.y = rotation;
  box(g, 0, 0, -.1, width + .16, text.length * .85 + .35, .22, '#1a2130');
  [...text].forEach((c, i) => sign(g, c, 0, (text.length - 1) * .425 - i * .85, .03, width, .85, color));
}
function storefront(parent, name, x, z, width, depth, height, color, rotation = 0, accent = '#d4c47f') {
  const g = group(parent, name, x, z); g.rotation.y = rotation;
  const body = box(g, 0, height / 2, 0, width, height, depth, color); body.userData.cameraBlocker = true;
  box(g, 0, height + .1, 0, width + .15, .25, depth + .15, '#50565e');
  for (let y = 3.8; y < height - .5; y += 2.5) {
    box(g, 0, y, depth / 2 + .02, width - .3, .12, .04, '#8a8d8e');
    for (let x = -width / 2 + .7; x < width / 2; x += 1.3) box(g, x, y - .95, depth / 2 + .05, .85, 1.35, .08, '#506075');
  }
  box(g, 0, 1.2, depth / 2 + .04, width - .5, 2.4, .1, '#192c3e');
  for (let x = -width / 2 + .4; x < width / 2; x += 1.3) box(g, x, 1.25, depth / 2 + .12, .05, 2.5, .06, '#a3bdc4');
  sign(g, name, 0, 2.9, depth / 2 + .15, width - .25, .85, accent, '#fff5dd');
  return g;
}
export function buildKabukichoDistrict(parent) {
  parent.name = 'kabukicho-toho-district';
  box(parent, -8, -.4, -4, 130, .65, 143, '#141a29');
  for (const road of KABUKICHO_LAYOUT.walkways) {
    const x = (road.minX + road.maxX) / 2, z = (road.minZ + road.maxZ) / 2;
    const w = road.maxX - road.minX, d = road.maxZ - road.minZ;
    const mesh = box(parent, x, -.045, z, w, .08, d, road.id === 'cinecity' ? '#6e7078' : '#343942'); mesh.name = road.id;
    if (d > w) for (const side of [-1, 1]) box(parent, x + side * (w / 2 - .35), .009, z, .06, .02, d, '#72717a');
  }
  for (const z of [-20, 40]) for (let x = -4.8; x <= 4.8; x += 1.35) box(parent, x, .024, z, .7, .025, 4.5, '#d4d0bc');
  for (let z = 42; z < 48; z += 1.5) for (const x of [-23, 21]) box(parent, x, .025, z, 5.5, .025, .7, '#d7d4bf');
  for (let x = -47; x < 34; x += 6) box(parent, x, .02, 45, 3, .02, .12, '#b8aa6b');
  // Central Road: individually composed narrow facades with stacked signs, not repeated street blocks.
  const west = [
    ['カラオケ歌広場', -8, 16, '#b0a69c', '#bc3054'], ['居酒屋', 1, 12, '#77777c', '#2d968d'],
    ['ラーメン', 23, 13, '#9a9384', '#c77337'], ['ゲーム', 33, 20, '#7a858b', '#366fb3'],
  ];
  const east = [
    ['ネットカフェ', -7.5, 19, '#949c9b', '#4d914d'], ['カラオケ', 1, 15, '#89818c', '#477aab'],
    ['焼肉', 24, 16, '#99847f', '#a22c39'], ['ドン・キホーテ', 34, 14, '#57748d', '#245395'],
  ];
  for (const [side, row] of [[-1, west], [1, east]]) for (const [i, [name, z, h, color, accent]] of row.entries()) {
    const g = storefront(parent, name, side * 11.3, z, 7.8, 10, h, color, -side * Math.PI / 2, accent);
    vertical(g, name, -2.8, h * .61, 5.25, accent, 0, 1.05);
    for (let j = 0; j < 3; j++) sign(g, ['3F 居酒屋', '2F DINING', 'B1 BAR'][j], 1.3, 4.7 + j * 1.1, 5.14, 3.6, .85, ['#66334d', '#285a6b', '#66512d'][(j + i) % 3]);
    box(g, 0, 3.7, 5.3, 7.5, .08, .10, accent, true);
    // Slender perpendicular directory signs face visitors coming up the road.
    const panel = group(g, 'projecting-directory', -3.6, 5.8); panel.rotation.y = side * Math.PI / 2;
    for (let j = 0; j < 5; j++) sign(panel, ['串焼', '海鮮', '焼肉', '麻雀', '珈琲'][j], 0, 4.4 + j * 1.2, 0, 1.2, 1.05, ['#a93a45', '#ded4b8', '#356882'][j % 3], j % 3 === 1 ? '#302d30' : '#f9e7c3');
  }
  // Large road-facing red/green boards are the silhouette visible in the reference street view.
  vertical(parent, 'カラオケ歌広場', -5.8, 10.0, -7.0, '#bc2f49', 0, 1.55);
  vertical(parent, 'ネットカフェ', 5.8, 11.0, -7.0, '#4a8c45', 0, 1.55);
  vertical(parent, 'ドン・キホーテ', 5.8, 8.0, 32.0, '#245099', 0, 1.4);
  // Restrained neon reflections use shared instanced materials, without postprocessing.
  for (const [i, color] of ['#d6537f', '#63bfd0', '#ccaa62'].entries()) {
    const reflection = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: .13, depthWrite: false });
    for (const side of [-1, 1]) for (let z = -8 + i * 4; z < 38; z += 12) for (let j = 0; j < 3; j++) {
      const stripe = box(parent, side * (4.0 + j * .45), .025, z + j * .7, .12, .012, 2.0 + j * .5, color); stripe.material = reflection;
    }
  }
  // Recognisable Central/Godzilla Road light pylons at the southern entrance.
  for (const side of [-1, 1]) {
    const g = group(parent, 'godzilla-road-pylon', side * 6, 30);
    box(g, 0, 3.4, 0, .65, 6.8, .65, '#35576c');
    box(g, 0, 3.9, .36, .45, 5.6, .04, '#bce8e3', true);
    vertical(g, side < 0 ? 'GODZILLA' : 'ゴジラロード', 0, 3.8, .4, '#b1dedc', 0, .48);
    sign(g, side < 0 ? 'KABUKI町' : 'CENTRAL ROAD', -side * 1.15, 7.1, .05, 3.6, .65, '#b5d4d6', '#152e40');
  }
  // Parallel Ichibangai is accessible from Yasukuni, the middle alley and Toho's front street.
  const gate = group(parent, 'ichibangai-gate', -22.5, 38);
  for (const x of [-3.5, 3.5]) { box(gate, x, 3.2, 0, .35, 6.4, .5, '#c7384d'); box(gate, x, 3.2, .28, .07, 6.2, .04, '#ffb1a1', true); }
  box(gate, 0, 6.25, 0, 7.6, 1.0, .6, '#bf2b40');
  sign(gate, '歌舞伎町一番街', 0, 6.25, .33, 7.1, .7, '#b62d3f');
  for (const [i, z] of [-7, 3, 25, 34].entries()) {
    const g = storefront(parent, ['寿司', 'カラオケ館', '焼鳥', '居酒屋'][i], -32, z, 8, 12, 11 + i * 2, '#6e6471', Math.PI / 2, ['#bb4a4d', '#3b88b5', '#a77a36', '#99516c'][i]);
    vertical(g, ['寿司', 'カラオケ館', '焼鳥', '居酒屋'][i], -2.8, 7, 6.2, '#943f56');
  }
  // Cinema front and its western square. Keep these passages open all the way around the block.
  buildTohoBuilding(parent);
  box(parent, -35, .02, -31, 19, .06, 27, '#696975');
  for (let x = -43; x <= -27; x += 2) for (let z = -43; z <= -19; z += 2) box(parent, x, .06, z, 1.97, .015, .025, '#aaa39c');
  const plazaSign = sign(parent, 'シネシティ広場', -35, .08, -24, 10, 1.3, '#696975', '#d9ddd1'); plazaSign.rotation.x = -Math.PI / 2;
  for (const x of [-43, -28]) {
    box(parent, x, .5, -36, 1.1, 1.0, 4.5, '#575c60'); box(parent, x, 1.06, -36, 1.1, .12, 4.5, '#a78e74');
    cylinder(parent, x, 3.0, -27, .06, 6, '#88969b', 8); box(parent, x, 6, -27, 1.3, .12, .45, '#d6e5e7', true);
  }
  const tower = group(parent, 'tokyu-tower', -55, -35);
  box(tower, 0, 4, 0, 17, 8, 25, '#314853').userData.cameraBlocker = true; box(tower, 0, 32, -2, 13, 52, 19, '#416e86').userData.cameraBlocker = true;
  for (let y = 9; y < 58; y += 1.35) box(tower, 0, y, 7.6, 12.8, .12, .09, '#8ab8cb');
  for (let x = -6; x <= 6; x += 1.3) box(tower, x, 33, 7.7, .09, 49, .07, '#96bfd1');
  sign(tower, '東急歌舞伎町タワー', 0, 7.0, 12.6, 15, 1.0, '#273e52');
  sign(tower, 'KABUKI YOKOCHO', 0, 4.8, 12.6, 14, 1.2, '#a74158');
  const apa = storefront(parent, 'APA HOTEL', -35, -44, 18, 6, 23, '#7e6f65', 0, '#d77831'); apa.name = 'apa-hotel';
  // Rear/eastern blocks and roadside details make cross streets read as a district.
  for (let i = 0; i < 5; i++) storefront(parent, ['飲食店', 'BAR', 'カラオケ', 'コンビニ', 'DINING'][i], 32, -37 + i * 17, 8, 8, 14 + i * 2, '#565d6c', Math.PI / 2, ['#834b77', '#3d7173', '#af6e3e'][i % 3]);
  for (const side of [-1, 1]) for (let z = -6; z < 39; z += 12) {
    cylinder(parent, side * 5.9, 2.5, z, .055, 5, '#687785', 8);
    box(parent, side * 5.9, 5.0, z, .8, .12, .5, '#e6dcc0', true);
    const crown = new THREE.Mesh(new THREE.IcosahedronGeometry(.75, 1), material('#365f53')); crown.position.set(side * 6.0, 2.9, z + 1.5); parent.add(crown);
    cylinder(parent, side * 6, 1.35, z + 1.5, .07, 2.7, '#796b5b', 8);
  }
  sign(parent, '← 東宝ビル裏 →', 0, .055, -44.5, 10, 1.0, '#343942', '#c6d0d3').rotation.x = -Math.PI / 2;
  for (const [text, x, z, width] of [['ゴジラロード', 0, 22, 5.5], ['一番街', -22.5, 29, 4], ['花道通り', -8, -53, 10]]) {
    const label = sign(parent, text, x, .055, z, width, .8, '#343942', '#bbb9b3'); label.rotation.x = -Math.PI / 2;
  }
}

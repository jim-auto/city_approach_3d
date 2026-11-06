import * as THREE from 'three';
import { box, cylinder, textSign, material } from './scenery.js';

// The station axis is east (Sakura-dori, +z) → west (Taiko-dori, -z).
// Kabukicho's axis is south (Yasukuni-dori, +z) → north (Toho, -z).
export const MAP_LAYOUTS = {
  nagoya: {
    bounds: { minX: -6.7, maxX: 6.7, minZ: -25, maxZ: 27 },
    start: [-3.2, 24], goal: [6.1, 23], goalLabel: 'タワーズ入口 ↗',
    obstacles: [{ x: 0, z: 18, radius: 1.05 }, { x: 0, z: -20, radius: 1.1 }],
    people: [[-2.8, 14], [3.3, 9], [-3.6, -16], [2, -4], [4.8, 1], [-5.4, 0], [5.3, -10], [3.4, -22]],
    landmarks: [{ id: 'gold-clock', name: '金時計 / 桜通口', x: 0, z: 18, color: '#d5b66b' }, { id: 'silver-clock', name: '銀時計 / 太閤通口', x: 0, z: -20, color: '#bfcdda' }, { id: 'central-gates', name: 'JR中央口', x: -8.4, z: 4, color: '#dd9759' }, { id: 'shinkansen-gates', name: '新幹線北口', x: 8.4, z: -17, color: '#79b5e4' }],
  },
  kabukicho: {
    bounds: { minX: -6.7, maxX: 6.7, minZ: -26, maxZ: 27.5 },
    start: [0, 21], goal: [6.1, -24], goalLabel: 'ホテル入口 ↗', obstacles: [],
    people: [[-3.4, 5], [3.2, -3], [-4, -20], [1.5, -10], [4.7, 14], [5.5, -7], [-5.5, 19], [3.5, -18]],
    landmarks: [{ id: 'toho-cinemas', name: 'TOHOシネマズ 新宿', x: 0, z: -29, color: '#f1e8db' }, { id: 'godzilla-head', name: 'ゴジラヘッド', x: -3.5, z: -32, color: '#a8c2a8' }, { id: 'ichibangai-gate', name: '歌舞伎町一番街', x: -17, z: 24, color: '#e4858e' }],
  },
};
function landmark(parent, id, position) { const group = new THREE.Group(); group.name = id; group.position.set(...position); parent.add(group); return group; }
function sphere(parent, x, y, z, sx, sy, sz, color, detail = 1) {
  const m = new THREE.Mesh(new THREE.IcosahedronGeometry(1, detail), material(color)); m.position.set(x, y, z); m.scale.set(sx, sy, sz); m.castShadow = true; parent.add(m); return m;
}
function sign(parent, text, x, y, z, w, h, bg = '#25313b', fg = '#f1ead9', rotation = 0) {
  const mesh = textSign(parent, text, x, y, z, w, h, bg, fg, rotation); mesh.name = `sign:${text}`; return mesh;
}
function dial(parent, x, y, z, radius, silver, rotation = 0) {
  const face = new THREE.Group(); face.position.set(x, y, z); face.rotation.y = rotation; parent.add(face);
  const edge = cylinder(face, 0, 0, 0, radius, .17, silver ? '#bfc9d0' : '#c9a657', 32); edge.rotation.x = Math.PI / 2;
  const disk = new THREE.Mesh(new THREE.CircleGeometry(radius * .88, 32), material(silver ? '#a3bac9' : '#f2eee0')); disk.position.z = .092; face.add(disk);
  if (silver) { const center = new THREE.Mesh(new THREE.CircleGeometry(radius * .61, 32), material('#567b9b')); center.position.z = .1; face.add(center); }
  for (let i = 0; i < 12; i++) {
    const a = i * Math.PI / 6, r = radius * .73;
    const tick = box(face, Math.sin(a) * r, Math.cos(a) * r, .108, .024, radius * .17, .012, '#303c45'); tick.rotation.z = -a;
  }
  const hour = box(face, .16, 0, .124, .038, radius * .48, .025, silver ? '#f2e9d4' : '#27313a'); hour.rotation.z = -Math.PI / 2;
  const minute = box(face, 0, .22, .131, .025, radius * .69, .026, silver ? '#f2e9d4' : '#27313a'); minute.rotation.z = 0;
  sphere(face, 0, 0, .15, .045, .045, .025, '#d7c48b', 0);
}
function clock(parent, silver, z) {
  const group = landmark(parent, silver ? 'silver-clock' : 'gold-clock', [0, 0, z]);
  const floor = cylinder(group, 0, .025, 0, 1.38, .05, silver ? '#c5c7be' : '#dbd4be', 40);
  if (silver) {
    cylinder(group, 0, .16, 0, 1.05, .28, '#a9b3ba', 16);
    const stand = new THREE.Mesh(new THREE.CylinderGeometry(.27, .91, 2.3, 8), material('#b8c4cb')); stand.position.y = 1.42; group.add(stand);
    for (const side of [-1, 1]) box(group, side * .36, 1.4, .55, .024, 1.82, .024, '#7c8e9c').rotation.z = side * .26;
    sphere(group, 0, 3.05, 0, .84, .96, .37, '#bdc7cf', 2);
    dial(group, 0, 3.07, .32, .72, true); dial(group, 0, 3.07, -.32, .72, true, Math.PI);
  } else {
    cylinder(group, 0, .11, 0, .62, .2, '#343436', 8);
    box(group, 0, 1.05, 0, .57, 1.8, .57, '#323238');
    box(group, 0, 1.9, 0, .67, .12, .67, '#c1a45d');
    const flare = new THREE.Mesh(new THREE.CylinderGeometry(.10, .30, .55, 16), material('#c9ab64')); flare.position.y = 2.23; group.add(flare);
    cylinder(group, 0, 3.35, 0, .085, 1.8, '#d6b55f', 16);
    for (const y of [2.56, 3.3, 4.2]) cylinder(group, 0, y, 0, .15, .07, '#e0c47d', 16);
    for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2; dial(group, Math.sin(a) * .37, 4.72, Math.cos(a) * .37, .61, false, a); }
    sign(group, '名古屋駅', 0, 3.36, .15, 1.65, .29, '#a58c52', '#f6e9ba');
  }
  floor.name = 'clock-floor-inlay';
  return group;
}
function ticketGates(parent, x, z, shinkansen, rotation) {
  const group = landmark(parent, shinkansen ? 'shinkansen-gates' : 'central-gates', [x, 0, z]); group.rotation.y = rotation;
  box(group, 0, 2.1, -.75, 8.7, 4.2, .6, '#b3b8b5');
  box(group, 0, 1.8, -.38, 7.7, 3.3, .15, '#3a4548');
  for (let i = -3; i <= 3; i++) {
    box(group, i * 1.05, .58, .55, .31, 1.16, 1.8, '#9aa7a7');
    box(group, i * 1.05, 1.17, .75, .33, .10, 1.45, '#466c70');
    box(group, i * 1.05, 1.25, 1.1, .2, .05, .20, '#70c3c5', true);
    box(group, i * 1.05 + .32, .57, .25, .37, .6, .05, '#447c94');
  }
  const label = shinkansen ? '新幹線 北口   Shinkansen' : 'JR線 中央口   Central Gate';
  sign(group, label, 0, 3.15, -.01, 7.7, .85, shinkansen ? '#174d7e' : '#a45f2b');
}
function escalators(parent, x, z) {
  const group = landmark(parent, 'towers-escalators', [x, 0, z]);
  for (const offset of [-1.5, -.5, .5, 1.5]) {
    for (let i = 0; i < 19; i++) box(group, offset * .82, .1 + i * .18, -i * .23, .66, .18, .27, '#929fa5');
    for (const edge of [-.38, .38]) {
      const rail = box(group, offset * .82 + edge, 2.3, -2.1, .07, .09, 5.5, '#4e5962'); rail.rotation.x = .65;
      const glass = box(group, offset * .82 + edge, 1.9, -2.1, .045, .72, 5.3, '#aabcc2'); glass.rotation.x = .65;
    }
  }
  sign(group, '↑ JRセントラルタワーズ', 0, 4.3, -.3, 5, .6);
}
export function buildNagoyaConcourse(parent) {
  parent.name = 'nagoya-central-concourse';
  box(parent, 0, -.25, 0, 27, .5, 65, '#bdb9a8');
  // Warm stone floor, grid joints and a continuous tactile route through the free concourse.
  for (let z = -31; z < 32; z += 2) for (let x = -10; x <= 10; x += 2) {
    box(parent, x, .012, z, 1.98, .018, 1.98, (Math.round(z / 2) + x) % 3 === 0 ? '#c6c0ad' : '#d2cbb9');
  }
  for (let z = -30; z < 31; z += .8) {
    box(parent, -2.0, .04, z, .42, .045, .75, '#d0ae4f');
    for (const x of [-.11, 0, .11]) box(parent, -2 + x, .067, z, .027, .012, .69, '#ead17d');
  }
  // Side-wall shops and gates sit beyond the public passage; no street buildings or trees.
  for (const side of [-1, 1]) {
    box(parent, side * 10.8, 3.6, 0, .7, 7.2, 61, '#b3b9b7');
    for (let z = -26; z <= 26; z += 6.5) {
      cylinder(parent, side * 8.1, 3.5, z, .43, 7, '#c9cdca', 12);
      cylinder(parent, side * 8.1, .38, z, .46, .76, '#9da7aa', 12);
    }
    for (let i = 0; i < 4; i++) {
      const z = -10 + i * 7;
      if ((side === -1 && i === 2) || (side === 1 && i === 0)) continue;
      box(parent, side * 10.33, 1.9, z, .08, 3.1, 5.7, '#4b585c');
      for (let k = -2; k <= 2; k++) box(parent, side * 10.26, 1.65, z + k, .05, 2.6, .045, '#c1cbcb');
      sign(parent, ['KIOSK', '名古屋うまいもん通り', 'おみやげ', '名古屋市観光案内所'][i], side * 10.20, 3.8, z, 5.5, .65, '#364d50', '#f0ebd7', -side * Math.PI / 2);
    }
  }
  // Open-sided / cutaway roof beams retain the indoor character without hiding the player.
  for (let z = -28; z <= 12; z += 4) {
    box(parent, 0, 7.1, z, 20.8, .27, .32, '#bcc4c3');
    for (const x of [-5, 0, 5]) box(parent, x, 6.94, z, 2.5, .04, .17, '#fff3ce', true);
  }
  for (const x of [-8.2, 8.2]) box(parent, x, 7.25, -8, .25, .32, 43, '#a4afaf');
  // Sakura-dori's tall glass atrium, Takashimaya and the four escalators behind the gold clock.
  const atrium = landmark(parent, 'sakura-dori-atrium', [0, 0, 21]);
  for (let y = 4; y <= 13; y += 2.2) box(atrium, 0, y, 9.8, 22, .10, .13, '#9caeaf');
  for (const x of [-10, -6, -2, 2, 6, 10]) box(atrium, x, 7.7, 9.8, .11, 12, .13, '#acb9b9');
  box(atrium, 0, 3.6, 9.6, 21, .4, .8, '#d0d4ce');
  for (let x = -8; x <= 8; x += 4) {
    box(atrium, x, 1.5, 9.5, 3.5, 2.8, .08, '#8b9da1');
    box(atrium, x, 1.5, 9.4, .06, 2.8, .10, '#e0e6df');
  }
  sign(atrium, '桜通口   Sakura-dori Exit', 0, 3.7, 9.05, 9, .7);
  box(atrium, 10.3, 5.3, 0, .2, 9.8, 18, '#aabcbf');
  for (const y of [4.7, 7.2, 9.7]) box(atrium, 10.0, y, 0, .09, .08, 18, '#e1e3dc');
  sign(parent, 'JR Nagoya Takashimaya', 8.9, 4.1, 19.8, 7, .65, '#bfc7c2', '#aa3a43', -Math.PI / 2);
  escalators(parent, 8.0, 23.7);
  clock(parent, false, 18); clock(parent, true, -20);
  ticketGates(parent, -10.2, 4, false, Math.PI / 2);
  ticketGates(parent, 10.2, -17, true, -Math.PI / 2);
  const west = landmark(parent, 'taiko-dori-exit', [0, 0, -29]);
  box(west, 0, 3.4, 0, 23, .45, 1.2, '#b3bdbb');
  for (let x = -9; x <= 9; x += 3) box(west, x, 1.55, -.2, .10, 3.1, .2, '#e6ebe5');
  sign(west, '太閤通口   Taiko-dori Exit', 0, 3.45, .7, 10, .7);
  // Paired information boards and overhead black-and-yellow wayfinding.
  for (const side of [-1, 1]) {
    sign(parent, side < 0 ? 'FASHION ONE' : '新幹線 のりば', side * 5, 4.6, -26, 5.8, 1.0, '#1d3643', '#dce7e2');
    sign(parent, 'NAGOYA  /  INFORMATION', side * 5.4, 5, 24.9, 4.9, 1.35, '#344e61', '#cfdbc9');
  }
  for (const z of [-11, 7]) {
    const group = landmark(parent, `overhead-wayfinding-${z}`, [0, 5.0, z]);
    sign(group, '↑ 新幹線・太閤通口    JR線 中央口 ←', 0, 0, 0, 11, .75, '#232a2d', '#ffe197');
    sign(group, '桜通口・地下鉄 ↑   名鉄・近鉄 →', 0, 0, -.04, 11, .75, '#232a2d', '#ffe197', Math.PI);
    for (const x of [-4.5, 4.5]) box(group, x, .9, 0, .035, 1.8, .035, '#8d999c');
  }
}

export function buildKabukichoLandmarks(parent) {
  // Godzilla Road reaches the Toho cinema directly. The Ichibangai arch belongs to the parallel western street.
  const building = landmark(parent, 'toho-cinemas', [0, 0, -34]);
  box(building, 0, 5.6, 0, 27, 11.2, 11, '#b6b9b7');
  box(building, 0, 5.1, 5.62, 26.5, 7.6, .15, '#bbc4c4');
  for (let y = 2.4; y < 10; y += .75) box(building, 0, y, 5.74, 26, .08, .08, '#8c9ca5');
  box(building, 0, 2, 5.83, 8.0, 3.6, .12, '#1c2639');
  for (const x of [-3.3, -1.1, 1.1, 3.3]) box(building, x, 1.8, 5.93, .06, 3.4, .10, '#c6d5d9');
  box(building, 0, 3.8, 6.2, 11.5, .35, 1.8, '#5e6a79');
  box(building, 2.2, 7.3, 5.95, 3.8, 5.2, .16, '#18202a');
  const emblem = new THREE.Mesh(new THREE.TorusGeometry(.85, .21, 8, 24), material('#c33745')); emblem.position.set(2.2, 8.45, 6.09); building.add(emblem);
  sign(building, 'TOHO', 2.2, 7.0, 6.08, 3.2, .65, '#18202a', '#f2f1e9');
  sign(building, 'CINEMAS', 2.2, 6.25, 6.08, 3.2, .6, '#18202a', '#f2f1e9');
  sign(building, 'TOHOシネマズ 新宿', 0, 3.9, 7.15, 9, .60, '#2b3445', '#f5e8da');
  sign(building, 'IMAX', -10.1, 7.6, 5.95, 4.1, 1.45, '#253342', '#8ad5ef');
  sign(building, 'CINEMA  3F', 10, 7.6, 5.95, 4.2, 1.45, '#343d4e', '#ece3cf');
  for (const x of [-9.5, 9.5]) {
    box(building, x, 1.7, 5.8, 5.8, 3.2, .14, '#263746');
    sign(building, x < 0 ? 'RESTAURANTS' : 'HOTEL ENTRANCE →', x, 2.9, 5.95, 5.4, .55, '#222d3c', '#e3d8c4');
  }
  // Vertical film advertising and the dark, finely banded hotel tower above the cinema base.
  for (const [i, x] of [-9.7, 8.7].entries()) {
    box(building, x, 6.4, 5.88, 3.5, 4.1, .10, ['#355d75', '#7b454f'][i]);
    sign(building, ['CINEMA', 'MOVIES'][i], x, 6.4, 6.0, 3.0, 1.5, '#293344', '#e2d8c4');
  }
  const tower = landmark(parent, 'hotel-gracery-tower', [3.2, 0, -36]);
  box(tower, 0, 22.0, 0, 15.4, 28, 9.5, '#333c49');
  for (let floor = 0; floor < 23; floor++) {
    const y = 10.2 + floor * 1.05;
    box(tower, 0, y, 4.85, 15.6, .10, .20, '#89949b');
    for (let col = -5; col <= 5; col++) box(tower, col * 1.28, y + .42, 4.78, .68, .35, .05, (floor + col) % 6 === 0 ? '#d5c49c' : '#65727e', (floor + col) % 6 === 0);
    for (let col = -3; col <= 3; col++) box(tower, -7.76, y + .42, col * 1.2, .05, .35, .62, '#687580');
  }
  sign(tower, 'HOTEL GRACERY', 0, 9.1, 4.95, 12.5, .8, '#303b48', '#e8e4dc');
  sign(tower, 'HOTEL GRACERY SHINJUKU', 0, 34.6, 4.95, 12.5, .65, '#303b48', '#d7d9d4');
  // The terrace's recognisable head, open jaws, teeth, dorsal plates and claws.
  const godzilla = landmark(parent, 'godzilla-head', [-5.6, 11.0, -30.9]);
  sphere(godzilla, 0, .6, -.7, 1.3, 1.85, 1.1, '#34433f', 1);
  sphere(godzilla, 0, 1.9, .15, 1.16, .91, 1.05, '#3a4946', 2);
  sphere(godzilla, 0, 1.7, 1.1, .92, .48, .87, '#3e4c48', 1);
  sphere(godzilla, 0, .89, 1.05, .83, .24, .9, '#46534b', 1);
  box(godzilla, 0, 1.22, 1.33, 1.12, .36, .7, '#30262c');
  for (const side of [-1, 1]) {
    sphere(godzilla, side * .95, 2.1, .54, .22, .12, .23, '#7c6d3c', 1);
    sphere(godzilla, side * 1.10, 2.13, .65, .07, .07, .10, '#e4ad4d', 1);
    for (let i = 0; i < 7; i++) {
      const tooth = new THREE.Mesh(new THREE.ConeGeometry(.07, .24, 5), material('#ded1a6'));
      tooth.position.set(side * .57, i % 2 ? 1.58 : 1.0, .4 + i * .23); if (i % 2) tooth.rotation.z = Math.PI; godzilla.add(tooth);
    }
    for (let i = 0; i < 3; i++) sphere(godzilla, side * (1.0 + i * .21), -.20, 1.05 + i * .09, .19, .40, .32, '#c6bd9a', 1);
    for (let i = 0; i < 3; i++) sphere(godzilla, side * .82, .8 + i * .43, -.25, .19, .21, .23, '#53605a', 0);
  }
  for (let i = 0; i < 5; i++) {
    const plate = new THREE.Mesh(new THREE.ConeGeometry(.4, .95, 4), material('#758078'));
    plate.position.set(0, .4 + i * .44, -1.15 + i * .14); plate.rotation.x = -.35; godzilla.add(plate);
  }
  // Side roads and crossing at the cinema forecourt; the parallel Ichibangai arch stays off the main axis.
  box(parent, 0, .025, -22.5, 31, .04, 6, '#424d60');
  for (let x = -11; x <= 11; x += 1.6) box(parent, x, .052, -22.5, .75, .025, 2.7, '#c6c7be');
  const gate = landmark(parent, 'ichibangai-gate', [-17, 0, 24]);
  for (const x of [-3, 3]) box(gate, x, 3.3, 0, .32, 6.6, .50, '#b03648');
  box(gate, 0, 6.6, 0, 6.8, 1.0, .6, '#b8364b');
  sign(gate, '歌舞伎町一番街', 0, 6.65, .33, 6.2, .7, '#a62f42', '#ffe2cc');
  box(parent, -17, -.01, 7, 7, .08, 40, '#333d51');
  sign(parent, 'ゴジラロード   GODZILLA ROAD', 0, .065, 15, 5.5, .55, '#333d4e', '#d1c8ac').rotation.x = -Math.PI / 2;
}

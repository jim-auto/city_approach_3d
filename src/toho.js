import * as THREE from 'three';
import { box, cylinder, textSign, material } from './scenery.js';
function landmark(parent, id, position) { const group = new THREE.Group(); group.name = id; group.position.set(...position); parent.add(group); return group; }
function sphere(parent, x, y, z, sx, sy, sz, color, detail = 1) {
  const m = new THREE.Mesh(new THREE.IcosahedronGeometry(1, detail), material(color)); m.position.set(x, y, z); m.scale.set(sx, sy, sz); m.castShadow = true; parent.add(m); return m;
}
function sign(parent, text, x, y, z, w, h, bg = '#25313b', fg = '#f1ead9', rotation = 0) {
  const mesh = textSign(parent, text, x, y, z, w, h, bg, fg, rotation); mesh.name = `sign:${text}`; return mesh;
}
export function buildTohoBuilding(parent) {
  // Godzilla Road reaches the Toho cinema directly. The Ichibangai arch belongs to the parallel western street.
  const building = landmark(parent, 'toho-cinemas', [0, 0, -34]);
  box(building, 0, 5.6, 0, 27, 11.2, 11, '#b6b9b7');
  box(building, 0, 5.1, 5.62, 26.5, 7.6, .15, '#bbc4c4');
  // Asymmetric poster bay and the tall recessed cinema entrance.
  box(building, -6, 5.9, 5.93, 8.2, 9.8, .12, '#182b3e');
  sign(building, 'NIGHT IN TOKYO', -6, 9.5, 6.04, 7.5, .8, '#17293d', '#8be6eb');
  for (let i = 0; i < 9; i++) box(building, -9.1 + i * .77, 4.9 + (i % 4) * .35, 6.04, .38, 3 + (i % 4) * .7, .05, ['#417f9d', '#b05477', '#8ab7bd'][i % 3], true);
  sign(building, 'NOW SHOWING', -6, 1.8, 6.05, 7.8, .7, '#192334', '#f6e4b4');
  for (let y = 2.4; y < 10; y += .75) box(building, 0, y, 5.74, 26, .08, .08, '#8c9ca5');
  box(building, 0, 2, 5.83, 8.0, 3.6, .12, '#1c2639');
  for (const x of [-3.3, -1.1, 1.1, 3.3]) box(building, x, 1.8, 5.93, .06, 3.4, .10, '#c6d5d9');
  box(building, 0, 3.8, 6.2, 11.5, .35, 1.8, '#5e6a79');
  box(building, 2.2, 7.3, 5.95, 3.8, 5.2, .16, '#18202a');
  const emblem = new THREE.Mesh(new THREE.TorusGeometry(.85, .21, 8, 24), material('#c33745')); emblem.position.set(2.2, 8.45, 6.09); building.add(emblem);
  sign(building, 'TOHO', 2.2, 7.0, 6.08, 3.2, .65, '#18202a', '#f2f1e9');
  sign(building, 'CINEMAS', 2.2, 6.25, 6.08, 3.2, .6, '#18202a', '#f2f1e9');
  sign(building, 'TOHOシネマズ 新宿', 0, 3.9, 7.15, 9, .60, '#2b3445', '#f5e8da');
  sign(building, 'IMAX', 2.2, 5.25, 6.1, 3.5, .65, '#253342', '#8ad5ef');
  sign(building, 'CINEMA  3F', 10, 7.6, 5.95, 4.2, 1.45, '#343d4e', '#ece3cf');
  for (const x of [-9.5, 9.5]) {
    box(building, x, 1.7, 5.8, 5.8, 3.2, .14, '#263746');
    sign(building, x < 0 ? 'RESTAURANTS' : 'HOTEL ENTRANCE →', x, 2.9, 5.95, 5.4, .55, '#222d3c', '#e3d8c4');
  }
  sign(building, 'MARUHAN', -6, .85, 6.07, 7.8, .65, '#20202a', '#f2e9dd');
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
  const godzilla = landmark(parent, 'godzilla-head', [-6.8, 11.0, -28.8]); godzilla.scale.setScalar(1.55);
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
}

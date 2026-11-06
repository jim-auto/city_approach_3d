import fs from 'node:fs/promises';
import { Window } from 'happy-dom';
import * as THREE from 'three';
import { SVGRenderer } from 'three/addons/renderers/SVGRenderer.js';
import { buildNagoyaConcourse, buildKabukichoLandmarks } from '../src/locations.js';

// Offline geometry check; no browser or remote-control session is used.
const window = new Window(); globalThis.document = window.document;
window.HTMLCanvasElement.prototype.getContext = () => ({ fillRect() {}, strokeRect() {}, fillText() {} });
const views = [
  ['NAGOYA / GOLD CLOCK', buildNagoyaConcourse, [8, 11, 36], [0, 2, 17]],
  ['NAGOYA / SILVER CLOCK', buildNagoyaConcourse, [6, 8, -5], [0, 2, -20]],
  ['NAGOYA / CENTRAL CONCOURSE', buildNagoyaConcourse, [31, 44, 44], [0, 1, 0]],
  ['KABUKICHO / TOHO BUILDING', buildKabukichoLandmarks, [23, 22, 23], [0, 14, -30]],
];
let cells = '';
for (const [i, [title, build, position, target]] of views.entries()) {
  const scene = new THREE.Scene(); build(scene);
  scene.add(new THREE.AmbientLight('#ffffff', .55));
  const light = new THREE.DirectionalLight('#fff3db', .75); light.position.set(-10, 30, 20); scene.add(light);
  const camera = new THREE.PerspectiveCamera(47, 1.6, .1, 200); camera.position.set(...position); camera.lookAt(...target);
  const renderer = new SVGRenderer(); renderer.setSize(960, 600); renderer.setPrecision(2); renderer.render(scene, camera);
  cells += `<svg x="${(i % 2) * 960}" y="${Math.floor(i / 2) * 640}" width="960" height="640" viewBox="-480 -320 960 640"><g transform="translate(0,0)">${renderer.domElement.innerHTML}<text x="-460" y="-290" fill="#ffffff" font-family="sans-serif" font-size="22">${title}</text></g></svg>`;
}
await fs.mkdir('artifacts', { recursive: true });
await fs.writeFile('artifacts/locations.svg', `<svg xmlns="http://www.w3.org/2000/svg" width="1920" height="1280"><rect width="1920" height="1280" fill="#273345"/>${cells}</svg>`);
console.log('Saved artifacts/locations.svg (geometry only; canvas sign textures omitted)');
window.happyDOM.abort();

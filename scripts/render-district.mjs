import fs from 'node:fs/promises';
import { Window } from 'happy-dom';
import * as THREE from 'three';
import { SVGRenderer } from 'three/addons/renderers/SVGRenderer.js';
import { buildKabukichoDistrict, KABUKICHO_LAYOUT } from '../src/kabukicho.js';
import { createCharacter } from '../src/characters.js';
const window = new Window(); globalThis.document = window.document;
window.HTMLCanvasElement.prototype.getContext = () => ({ fillRect() {}, strokeRect() {}, fillText() {} });
const escape = text => text.replaceAll('&', '&amp;').replaceAll('<', '&lt;');
const views = [
  ['STREET / START CAMERA', [0, 15.5, 53], [0, 4, 23], 55],
  ['TOHO / CINEMA FRONT', [2, 10, 3], [0, 10, -29], 60],
  ['DISTRICT / WEST PLAZA & STREETS', [65, 110, 95], [-11, 0, -5], 55],
];
let cells = '';
for (const [i, [title, position, target, fov]] of views.entries()) {
  const scene = new THREE.Scene(); buildKabukichoDistrict(scene);
  const player = createCharacter('#a1d6c8', '#2c3038', 'player'); player.position.set(0, 0, 29); scene.add(player);
  scene.add(new THREE.AmbientLight('#d8dfff', .65));
  const sun = new THREE.DirectionalLight('#bfcaff', .8); sun.position.set(-20, 45, 25); scene.add(sun);
  scene.traverse(o => { if (o.userData.sign) { o.material = o.material.clone(); o.material.color.set(o.userData.sign.bg); } });
  const camera = new THREE.PerspectiveCamera(fov, 1.6, .1, 250); camera.position.set(...position); camera.lookAt(...target);
  const renderer = new SVGRenderer(); renderer.setSize(960, 600); renderer.setPrecision(2); renderer.render(scene, camera);
  let signs = '';
  if (i < 2) {
    scene.updateMatrixWorld(true); const ray = new THREE.Raycaster();
    scene.traverse(o => {
      const s = o.userData.sign; if (!s || o.rotation.x === -Math.PI / 2) return;
      const pos = o.getWorldPosition(new THREE.Vector3()), dir = pos.clone().sub(camera.position); const distance = dir.length(); ray.set(camera.position, dir.normalize());
      if (ray.intersectObjects(scene.children, true).some(hit => hit.object !== o && hit.distance < distance - .2)) return;
      const p = pos.clone().project(camera); if (p.z < -1 || p.z > 1 || Math.abs(p.x) > 1 || Math.abs(p.y) > 1) return;
      const size = Math.min(24, Math.max(5, s.height * 300 / (Math.tan(fov * Math.PI / 360) * distance) * .5));
      signs += `<text x="${p.x * 480}" y="${-p.y * 300}" text-anchor="middle" fill="${s.fg}" font-family="sans-serif" font-size="${size}">${escape(s.text)}</text>`;
    });
  }
  cells += `<svg x="${i % 2 * 960}" y="${Math.floor(i / 2) * 640}" width="960" height="640" viewBox="-480 -320 960 640">${renderer.domElement.innerHTML}${signs}<text x="-460" y="-295" fill="#dce8eb" font-size="18" font-family="sans-serif">${escape(title)}</text></svg>`;
}
const b = KABUKICHO_LAYOUT.bounds, scale = 4.5;
let map = '';
for (const r of KABUKICHO_LAYOUT.walkways) map += `<rect x="${(r.minX-b.minX)*scale}" y="${(r.minZ-b.minZ)*scale}" width="${(r.maxX-r.minX)*scale}" height="${(r.maxZ-r.minZ)*scale}" fill="#586173"/>`;
for (const p of KABUKICHO_LAYOUT.landmarks) map += `<circle cx="${(p.x-b.minX)*scale}" cy="${(p.z-b.minZ)*scale}" r="4" fill="${p.color}"/><text x="${(p.x-b.minX)*scale+6}" y="${(p.z-b.minZ)*scale}" fill="#e5e9ed" font-size="12" font-family="sans-serif">${escape(p.name)}</text>`;
for (const p of KABUKICHO_LAYOUT.destinations) map += `<circle cx="${(p.x-b.minX)*scale}" cy="${(p.z-b.minZ)*scale}" r="7" stroke="#bda7f5" stroke-width="2" fill="none"/>`;
cells += `<g transform="translate(1110,710)">${map}</g>`;
await fs.mkdir('artifacts', {recursive:true});
await fs.writeFile('artifacts/district.svg', `<svg xmlns="http://www.w3.org/2000/svg" width="1920" height="1280"><rect width="1920" height="1280" fill="#161e2c"/>${cells}</svg>`);
console.log('Saved artifacts/district.svg (offline geometry and projected sign labels)'); window.happyDOM.abort();

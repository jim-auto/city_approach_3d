import fs from 'node:fs/promises';
import { Window } from 'happy-dom';
import * as THREE from 'three';
import { SVGRenderer } from 'three/addons/renderers/SVGRenderer.js';
import { createCharacter, animateCharacter } from '../src/characters.js';
import { PROFILES } from '../src/game.js';

// Offline geometry preview: does not launch or control a browser.
const window = new Window(); globalThis.document = window.document;
const variants = [{ id: 'player', name: 'PLAYER', color: '#a1d6c8', hair: '#2c3038' }, ...PROFILES];
let cells = '';
for (const [i, profile] of variants.entries()) {
  const scene = new THREE.Scene(); scene.add(new THREE.AmbientLight('#ffffff', .9));
  const light = new THREE.DirectionalLight('#fff2df', 1.3); light.position.set(-3, 6, 5); scene.add(light);
  const model = createCharacter(profile.color, profile.hair, profile.id); animateCharacter(model, false, 2, .6); scene.add(model);
  const camera = new THREE.OrthographicCamera(-1.03, 1.03, 1.35, -1.35, .1, 50); camera.position.set(2.4, 2.1, 6); camera.lookAt(0, 1.14, 0);
  const renderer = new SVGRenderer(); renderer.setSize(320, 420); renderer.setQuality('high'); renderer.setPrecision(2); renderer.render(scene, camera);
  cells += `<g transform="translate(${(i % 5) * 320 + 160},${Math.floor(i / 5) * 450 + 230})">${renderer.domElement.innerHTML}<text x="0" y="210" text-anchor="middle" fill="#dae1ed" font-family="sans-serif" font-size="17">${profile.id.toUpperCase()}</text></g>`;
}
await fs.mkdir('artifacts', { recursive: true });
await fs.writeFile('artifacts/characters.svg', `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="920" viewBox="0 0 1600 920"><rect width="1600" height="920" fill="#273345"/>${cells}</svg>`);
console.log('Saved artifacts/characters.svg'); window.happyDOM.abort();

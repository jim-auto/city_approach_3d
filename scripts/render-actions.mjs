import fs from 'node:fs/promises';
import { Window } from 'happy-dom';
import * as THREE from 'three';
import { SVGRenderer } from 'three/addons/renderers/SVGRenderer.js';
import { createCharacter, animateCharacter } from '../src/characters.js';
import { ACTIONS, animateAction } from '../src/actions.js';
const window = new Window(); globalThis.document = window.document;
let cells = '';
for (const [i, action] of ACTIONS.entries()) {
  const scene = new THREE.Scene(); scene.add(new THREE.AmbientLight('#ffffff', .9));
  const light = new THREE.DirectionalLight('#fff2df', 1.3); light.position.set(-3, 6, 5); scene.add(light);
  const model = createCharacter('#a1d6c8', '#2c3038', 'player');
  animateCharacter(model, false, 0); animateAction(model, action.id, action.duration * .4); scene.add(model);
  const camera = new THREE.OrthographicCamera(-1.25, 1.25, 1.9, -1.9, .1, 50); camera.position.set(2.4, 2.1, 6); camera.lookAt(0, 1.5, 0);
  const renderer = new SVGRenderer(); renderer.setSize(320, 480); renderer.setPrecision(2); renderer.render(scene, camera);
  cells += `<svg x="${i * 320}" width="320" height="520" viewBox="-160 -260 320 520">${renderer.domElement.innerHTML}<text x="0" y="240" text-anchor="middle" fill="#dae1ed" font-family="sans-serif" font-size="17">${action.id.toUpperCase()}</text></svg>`;
}
await fs.mkdir('artifacts', { recursive: true });
await fs.writeFile('artifacts/actions.svg', `<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="520"><rect width="1280" height="520" fill="#273345"/>${cells}</svg>`);
console.log('Saved artifacts/actions.svg'); window.happyDOM.abort();

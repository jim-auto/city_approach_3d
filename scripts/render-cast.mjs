import fs from 'node:fs/promises';
import sharp from 'sharp';
import * as THREE from 'three';
import { loadOfflineAvatar } from './load-avatar-offline.mjs';
import { renderGeometry } from './software-preview.mjs';
import { createCharacter, animateCharacter } from '../src/characters.js';
import { CAST } from '../src/cast.js';
import { PROFILES } from '../src/game.js';
import { STREET_PROFILES } from '../src/street-encounters.js';
import { ACTIONS, animateAction } from '../src/actions.js';
await loadOfflineAvatar(); await fs.mkdir('artifacts', { recursive: true });
const samples = [{ id: 'player', name: 'PLAYER' }, ...PROFILES, ...STREET_PROFILES];
for (const mode of ['full', 'face']) {
  const cells = [], columns = 5, width = 260, height = mode === 'full' ? 450 : 290;
  for (const [i, profile] of samples.entries()) {
    const person = createCharacter(profile.color, profile.hair, profile.id); animateCharacter(person, mode === 'full' && i % 2 === 1, .12); person.rotation.y = -.15;
    const scene = new THREE.Scene(); scene.add(person);
    const half = mode === 'full' ? [.73, 1.24] : [.26, .29], focus = mode === 'full' ? 1.1 : person.userData.faceY;
    const camera = new THREE.OrthographicCamera(-half[0], half[0], half[1], -half[1], .1, 20); camera.position.set(0, focus, 6); camera.lookAt(0, focus, 0);
    const data = renderGeometry(scene, camera, width, height);
    const name = Buffer.from(`<svg width="${width}" height="28"><rect width="100%" height="100%" fill="#152033"/><text x="12" y="20" font-size="14" fill="#eef1f8" font-family="sans-serif">${profile.name}</text></svg>`);
    const input = await sharp(data, { raw: { width, height, channels: 3 } }).composite([{ input: name, top: height - 28, left: 0 }]).png().toBuffer();
    cells.push({ input, left: i % columns * width, top: Math.floor(i / columns) * height });
  }
  await sharp({ create: { width: columns * width, height: Math.ceil(samples.length / columns) * height, channels: 3, background: '#273345' } }).composite(cells).png().toFile(`artifacts/cast-${mode}.png`);
}
const actions = [];
for (const [i, action] of ACTIONS.entries()) {
  const model = createCharacter('#303544', '#28232c', 'player'); animateCharacter(model, false, 0); animateAction(model, action.id, action.duration * .4);
  const scene = new THREE.Scene(); scene.add(model); const camera = new THREE.OrthographicCamera(-.9, .9, 2.4, -1.2, .1, 20); camera.position.set(.5, 1.1, 6); camera.lookAt(0, 1.1, 0);
  const data = renderGeometry(scene, camera, 320, 550); actions.push({ input: await sharp(data, { raw: { width: 320, height: 550, channels: 3 } }).png().toBuffer(), left: i * 320, top: 0 });
}
await sharp({ create: { width: 1280, height: 550, channels: 3, background: '#273345' } }).composite(actions).png().toFile('artifacts/cast-actions.png');
console.log('Saved artifacts/cast-{full,face,actions}.png');

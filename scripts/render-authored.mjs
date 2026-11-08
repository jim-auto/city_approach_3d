import fs from 'node:fs/promises';
import sharp from 'sharp';
import * as THREE from 'three';
import { loadOfflineAvatar } from './load-avatar-offline.mjs';
import { renderGeometry } from './software-preview.mjs';
import { createCharacter, animateCharacter } from '../src/characters.js';
await loadOfflineAvatar();
const frames = [
  { name: 'full', angle: .18, y: 1.08, half: [ .7, 1.15 ], moving: false, time: 0 },
  { name: 'walk', angle: -.35, y: 1.08, half: [ .7, 1.15 ], moving: true, time: .18 },
  { name: 'face', angle: -.12, y: 1.94, half: [ .26, .29 ], moving: false, time: 0 },
];
await fs.mkdir('artifacts', { recursive: true });
for (const frame of frames) {
  const person = createCharacter('#dc9aab', '#42293a', 'waiting');
  animateCharacter(person, frame.moving, frame.time); person.rotation.y = frame.angle;
  const scene = new THREE.Scene(); scene.add(person);
  const camera = new THREE.OrthographicCamera(-frame.half[0], frame.half[0], frame.half[1], -frame.half[1], .1, 20);
  camera.position.set(0, frame.y, 6); camera.lookAt(0, frame.y, 0);
  const width = 600, height = frame.name === 'face' ? 670 : 986;
  const rgb = renderGeometry(scene, camera, width, height);
  await sharp(rgb, { raw: { width, height, channels: 3 } }).png().toFile(`artifacts/yui-${frame.name}.png`);
}
console.log('Saved artifacts/yui-{full,walk,face}.png (offline textured skinning preview)');

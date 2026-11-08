import fs from 'node:fs/promises';
import sharp from 'sharp';
import * as THREE from 'three';
import { loadOfflineAvatar } from './load-avatar-offline.mjs';
import { renderGeometry } from './software-preview.mjs';
import { createCharacter, animateCharacter } from '../src/characters.js';
import { animateAction } from '../src/actions.js';
import { CityWorld } from '../src/world.js';
await loadOfflineAvatar();
const player = createCharacter('#303544', '#28232c', 'player');
const girl = createCharacter('#dc9aab', '#42293a', 'waiting'); girl.position.x = 2.1;
const scene = new THREE.Scene(); scene.add(player, girl);
const world = Object.create(CityWorld.prototype);
Object.assign(world, {player, challengePartner: {mesh: girl}, camera: new THREE.PerspectiveCamera(43, 390 / 844, .1, 160)});
world.updateChallengeView(); world.camera.position.copy(world.challengeView.desired); world.camera.lookAt(world.challengeView.focus);
const frames = [];
for (const [i, action] of ['wave', 'jump', 'dance'].entries()) {
  for (const model of [player, girl]) { animateCharacter(model, false, 0); animateAction(model, action, action === 'jump' ? .3 : .65); }
  const rgb = renderGeometry(scene, world.camera, 390, 844);
  frames.push({ input: await sharp(rgb, { raw: { width: 390, height: 844, channels: 3 } }).png().toBuffer(), left: i * 390, top: 0 });
}
await fs.mkdir('artifacts', {recursive: true});
await sharp({create:{width:1170,height:844,channels:3,background:'#273345'}}).composite(frames).png().toFile('artifacts/duet.png');
console.log('Saved artifacts/duet.png — offline geometry preview, no browser');

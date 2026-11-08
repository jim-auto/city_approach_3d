import fs from 'node:fs/promises';
import sharp from 'sharp';
import * as THREE from 'three';
import { loadOfflineAvatar } from './load-avatar-offline.mjs';
import { renderGeometry } from './software-preview.mjs';
import { createCharacter, animateCharacter } from '../src/characters.js';
import { CityWorld } from '../src/world.js';
import { updateChallengeEffects } from '../src/challenge-effects.js';
await loadOfflineAvatar(); const frames = [];
for (const [i, [outfit, aura, label]] of [['default', 'none', 'DEFAULT'], ['burgundy', 'mint', '3 / 8 STARS'], ['white', 'gold', '16 / 26 STARS']].entries()) {
  const player = createCharacter('#303544', '#28232c', 'player'), world = Object.create(CityWorld.prototype); world.player = player;
  world.applyRewards({ outfit, aura }); animateCharacter(player, false, 0); updateChallengeEffects(world.challengeEffects, .01, 1.2); player.rotation.y = -.18;
  const scene = new THREE.Scene(); scene.add(player); const camera = new THREE.OrthographicCamera(-.75, .75, 1.25, -1.25, .1, 20); camera.position.set(.2, 1.1, 6); camera.lookAt(0, 1.1, 0);
  const pixels = renderGeometry(scene, camera, 360, 600), text = Buffer.from(`<svg width="360" height="36"><rect width="360" height="36" fill="#14212e"/><text x="20" y="24" fill="#ffd27a" font-family="sans-serif" font-size="17">${label}</text></svg>`);
  frames.push({ input: await sharp(pixels, { raw: { width: 360, height: 600, channels: 3 } }).composite([{ input: text, top: 564, left: 0 }]).png().toBuffer(), left: i * 360, top: 0 });
}
await fs.mkdir('artifacts', { recursive: true }); await sharp({ create: { width: 1080, height: 600, channels: 3, background: '#273345' } }).composite(frames).png().toFile('artifacts/perks.png');
console.log('Saved artifacts/perks.png (offline reward outfit and aura preview)');

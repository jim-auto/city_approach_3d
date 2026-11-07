import fs from 'node:fs/promises';
import { deflateSync } from 'node:zlib';
import * as THREE from 'three';
import { renderGeometry } from './software-preview.mjs';
import { createCharacter } from '../src/characters.js';
const label = 'after';
const samples = [['PLAYER', '#303544', '#28232c', 'player'], ['YUI', '#dc9aab', '#42293a', 'waiting'], ['NATSUKI', '#e58b74', '#553931', 'cafe']];
const width = 1200, height = 1000, scale = 2, fullWidth = width * scale, fullHeight = height * scale;
const rgb = new Uint8Array(fullWidth * fullHeight * 3);
for (let row = 0; row < 2; row++) for (const [i, [, color, hair, kind]] of samples.entries()) {
  const scene = new THREE.Scene(); scene.add(createCharacter(color, hair, kind));
  const camera = row ? new THREE.OrthographicCamera(-.32, .32, .34, -.34, .1, 50) : new THREE.OrthographicCamera(-.8, .8, 1.25, -1.25, .1, 50);
  camera.position.set(row ? .45 : 2.3, row ? 2.06 : 2, row ? 4 : 7); camera.lookAt(0, row ? 1.98 : 1.1, 0);
  const cellWidth = 400 * scale, cellHeight = (row ? 400 : 600) * scale, cell = renderGeometry(scene, camera, cellWidth, cellHeight);
  for (let y = 0; y < cellHeight; y++) rgb.set(cell.subarray(y * cellWidth * 3, (y + 1) * cellWidth * 3), ((row ? 600 * scale : 0) + y) * fullWidth * 3 + i * cellWidth * 3);
}
await fs.mkdir('artifacts', { recursive: true });
// Encode PNG with Node's standard library so the preview needs no browser or native packages.
function chunk(type, data) {
  const tag = Buffer.from(type), body = Buffer.concat([tag, data]), out = Buffer.alloc(data.length + 12);
  out.writeUInt32BE(data.length); body.copy(out, 4);
  let crc = 0xffffffff;
  for (const byte of body) { crc ^= byte; for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0); }
  out.writeUInt32BE((crc ^ 0xffffffff) >>> 0, out.length - 4); return out;
}
const header = Buffer.alloc(13); header.writeUInt32BE(fullWidth); header.writeUInt32BE(fullHeight, 4); header[8] = 8; header[9] = 2;
const scanlines = Buffer.alloc(fullHeight * (fullWidth * 3 + 1));
for (let y = 0; y < fullHeight; y++) scanlines.set(rgb.subarray(y * fullWidth * 3, (y + 1) * fullWidth * 3), y * (fullWidth * 3 + 1) + 1);
await fs.writeFile(`artifacts/model-${label}.png`, Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]), chunk('IHDR', header), chunk('IDAT', deflateSync(scanlines)), chunk('IEND', Buffer.alloc(0))]));
console.log(`Saved artifacts/model-${label}.png (offline smooth-shaded geometry preview)`);

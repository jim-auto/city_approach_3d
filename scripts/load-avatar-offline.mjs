import fs from 'node:fs/promises';
import sharp from 'sharp';
// Image decoding only; no browser or remote-control session is opened.
export async function loadOfflineAvatar() {
  globalThis.self ||= globalThis;
  globalThis.createImageBitmap ||= async blob => {
    const { data, info } = await sharp(Buffer.from(await blob.arrayBuffer())).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    return { data, width: info.width, height: info.height, close() {} };
  };
  const { loadAuthoredCharacters } = await import('../src/authored-characters.js');
  const data = await fs.readFile('public/models/yui.vrm');
  return loadAuthoredCharacters(data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength));
}

import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import sharp from 'sharp';
// Retain the VRM license metadata, skeleton, constraints, morphs and UVs verbatim.
const sourcePath = process.argv[2];
if (!sourcePath) throw new Error('Usage: node scripts/prepare-avatar.mjs /path/to/VRM1_Constraint_Twist_Sample.vrm');
const source = await fs.readFile(sourcePath);
const sourceHash = crypto.createHash('sha256').update(source).digest('hex');
if (sourceHash !== '12c2b97e95e700783a6a550dc0eee2d7880aeedccef9ae67bc4c5a2f0f2631a2') throw new Error('Source does not match the attributed original model');
const jsonSize = source.readUInt32LE(12), gltf = JSON.parse(source.subarray(20, 20 + jsonSize)), bin = source.subarray(28 + jsonSize);
const replacements = new Map();
for (const image of gltf.images) {
  const view = gltf.bufferViews[image.bufferView], bytes = bin.subarray(view.byteOffset || 0, (view.byteOffset || 0) + view.byteLength);
  const limit = /Face_00$|EyeIris/.test(image.name) ? 1024 : 512;
  const compressed = await sharp(bytes).resize(limit, limit, { fit: 'inside', withoutEnlargement: true }).png({ compressionLevel: 9, palette: true, quality: 95 }).toBuffer();
  replacements.set(image.bufferView, compressed);
}
const chunks = []; let offset = 0;
for (const [i, view] of gltf.bufferViews.entries()) {
  const bytes = replacements.get(i) || bin.subarray(view.byteOffset || 0, (view.byteOffset || 0) + view.byteLength);
  view.byteOffset = offset; view.byteLength = bytes.length; chunks.push(bytes);
  const pad = (4 - bytes.length % 4) % 4; chunks.push(Buffer.alloc(pad)); offset += bytes.length + pad;
}
// Outlines duplicate every material draw; painted outlines in the textures remain visible.
for (const material of gltf.materials) if (material.extensions?.VRMC_materials_mtoon) material.extensions.VRMC_materials_mtoon.outlineWidthMode = 'none';
gltf.buffers[0].byteLength = offset;
const json = Buffer.from(JSON.stringify(gltf)), jsonPad = Buffer.alloc((4 - json.length % 4) % 4, 32), packed = Buffer.concat(chunks);
const header = Buffer.alloc(20); header.write('glTF'); header.writeUInt32LE(2, 4); header.writeUInt32LE(28 + json.length + jsonPad.length + packed.length, 8); header.writeUInt32LE(json.length + jsonPad.length, 12); header.write('JSON', 16);
const binHeader = Buffer.alloc(8); binHeader.writeUInt32LE(packed.length); binHeader.write('BIN\0', 4);
await fs.mkdir('public/models', { recursive: true });
await fs.writeFile('public/models/yui.vrm', Buffer.concat([header, json, jsonPad, binHeader, packed]));
console.log(JSON.stringify({ sourceBytes: source.length, sourceSha256: crypto.createHash('sha256').update(source).digest('hex'), outputBytes: header.readUInt32LE(8) }, null, 2));

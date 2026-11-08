import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import sharp from 'sharp';
import { MeshoptSimplifier } from 'meshoptimizer';
import { AVATAR_SOURCES } from './avatar-sources.mjs';
await MeshoptSimplifier.ready;
const components = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 };
const arrays = { 5121: Uint8Array, 5123: Uint16Array, 5125: Uint32Array, 5126: Float32Array };
export async function prepareAvatar(key, sourcePath) {
  const spec = AVATAR_SOURCES[key];
  const source = await fs.readFile(sourcePath || `artifacts/model-sources/${spec.input}.vrm`);
  if (crypto.createHash('sha256').update(source).digest('hex') !== spec.hash) throw new Error(`Wrong source: ${key}`);
  const size = source.readUInt32LE(12), gltf = JSON.parse(source.subarray(20, 20 + size)), bin = source.subarray(28 + size), extra = new Map();
  const read = index => {
    const a = gltf.accessors[index], Type = arrays[a.componentType], width = components[a.type], out = new Type(a.count * width);
    if (a.bufferView !== undefined) {
      const view = gltf.bufferViews[a.bufferView], start = (view.byteOffset || 0) + (a.byteOffset || 0), stride = view.byteStride || Type.BYTES_PER_ELEMENT * width;
      for (let i = 0; i < a.count; i++) out.set(new Type(bin.buffer, bin.byteOffset + start + i * stride, width), i * width);
    }
    if (a.sparse) {
      const sparse = a.sparse, iv = gltf.bufferViews[sparse.indices.bufferView], vv = gltf.bufferViews[sparse.values.bufferView];
      const indices = new arrays[sparse.indices.componentType](bin.buffer, bin.byteOffset + (iv.byteOffset || 0) + (sparse.indices.byteOffset || 0), sparse.count);
      const values = new Type(bin.buffer, bin.byteOffset + (vv.byteOffset || 0) + (sparse.values.byteOffset || 0), sparse.count * width);
      for (let i = 0; i < sparse.count; i++) out.set(values.subarray(i * width, (i + 1) * width), indices[i] * width);
    }
    return out;
  };
  const addView = (data, target) => { const index = gltf.bufferViews.length; gltf.bufferViews.push({ buffer: 0, byteLength: data.byteLength, ...(target ? { target } : {}) }); extra.set(index, Buffer.from(data.buffer, data.byteOffset, data.byteLength)); return index; };
  const addIndex = data => { const index = gltf.accessors.length; gltf.accessors.push({ bufferView: addView(data, 34963), componentType: 5125, count: data.length, type: 'SCALAR' }); return index; };
  let triangles = 0;
  for (const mesh of gltf.meshes) {
    // All split primitives in these exports use the same attributes and morph targets.
    const groups = new Map();
    for (const p of mesh.primitives) {
      const id = JSON.stringify([p.material, p.attributes, p.targets]);
      if (!groups.has(id)) groups.set(id, { ...p, chunks: [] }); groups.get(id).chunks.push(read(p.indices));
    }
    mesh.primitives = [...groups.values()].map(p => {
      const indices = Uint32Array.from(p.chunks.flatMap(a => [...a])); delete p.chunks;
      let reduced = indices;
      if (key !== 'yui' && !/face/i.test(mesh.name) && indices.length > 600) {
        const positions = read(p.attributes.POSITION), normals = read(p.attributes.NORMAL), uv = read(p.attributes.TEXCOORD_0), attrs = new Float32Array(positions.length / 3 * 5);
        for (let v = 0; v < positions.length / 3; v++) { attrs.set(normals.subarray(v * 3, v * 3 + 3), v * 5); attrs.set(uv.subarray(v * 2, v * 2 + 2), v * 5 + 3); }
        [reduced] = MeshoptSimplifier.simplifyWithAttributes(indices, positions, 3, attrs, 5, [.2, .2, .2, 1, 1], null, Math.floor(indices.length * .52 / 3) * 3, .006, ['LockBorder']);
      }
      p.indices = addIndex(reduced); triangles += reduced.length / 3; return p;
    });
  }
  // Morph vectors are mostly zeros. Sparse accessors preserve all nonzero data exactly.
  const morphs = new Set(gltf.meshes.flatMap(mesh => mesh.primitives.flatMap(p => (p.targets || []).flatMap(t => Object.values(t)))));
  for (const index of morphs) {
    const a = gltf.accessors[index], data = read(index), width = components[a.type], touched = [], values = [];
    for (let i = 0; i < a.count; i++) if (data.subarray(i * width, (i + 1) * width).some(v => v !== 0)) { touched.push(i); values.push(...data.subarray(i * width, (i + 1) * width)); }
    if (touched.length > a.count * .6) continue;
    delete a.bufferView; delete a.byteOffset;
    if (touched.length) a.sparse = { count: touched.length, indices: { bufferView: addView(new Uint32Array(touched)), componentType: 5125 }, values: { bufferView: addView(new Float32Array(values)) } };
  }
  for (const [i, image] of gltf.images.entries()) {
    const view = gltf.bufferViews[image.bufferView], bytes = bin.subarray(view.byteOffset || 0, (view.byteOffset || 0) + view.byteLength);
    const limit = /Face_00$|EyeIris/.test(image.name || '') ? 1024 : 512;
    extra.set(image.bufferView, await sharp(bytes).resize(limit, limit, { fit: 'inside', withoutEnlargement: true }).png({ palette: true, quality: 95, compressionLevel: 9 }).toBuffer());
  }
  for (const material of gltf.materials) if (material.extensions?.VRMC_materials_mtoon) material.extensions.VRMC_materials_mtoon.outlineWidthMode = 'none';
  for (const material of gltf.extensions.VRM?.materialProperties || []) material.floatProperties._OutlineWidth = 0;
  // Retain only views that are actually used after sparse conversion and primitive merging.
  const usedAccessors = new Set();
  for (const mesh of gltf.meshes) for (const p of mesh.primitives) { usedAccessors.add(p.indices); Object.values(p.attributes).forEach(i => usedAccessors.add(i)); for (const target of p.targets || []) Object.values(target).forEach(i => usedAccessors.add(i)); }
  for (const skin of gltf.skins || []) usedAccessors.add(skin.inverseBindMatrices);
  const usedViews = new Set(gltf.images.map(i => i.bufferView));
  for (const [i, a] of gltf.accessors.entries()) {
    if (!usedAccessors.has(i)) { delete a.bufferView; delete a.byteOffset; delete a.sparse; continue; }
    if (a.bufferView !== undefined) usedViews.add(a.bufferView);
    if (a.sparse) { usedViews.add(a.sparse.indices.bufferView); usedViews.add(a.sparse.values.bufferView); }
  }
  const viewMap = new Map(), views = [], chunks = []; let offset = 0;
  for (const [i, view] of gltf.bufferViews.entries()) if (usedViews.has(i)) {
    const bytes = extra.get(i) || bin.subarray(view.byteOffset || 0, (view.byteOffset || 0) + view.byteLength);
    viewMap.set(i, views.length); views.push({ ...view, byteOffset: offset, byteLength: bytes.length }); chunks.push(bytes);
    const pad = (4 - bytes.length % 4) % 4; chunks.push(Buffer.alloc(pad)); offset += bytes.length + pad;
  }
  for (const a of gltf.accessors) { if (a.bufferView !== undefined) a.bufferView = viewMap.get(a.bufferView); if (a.sparse) { a.sparse.indices.bufferView = viewMap.get(a.sparse.indices.bufferView); a.sparse.values.bufferView = viewMap.get(a.sparse.values.bufferView); } }
  for (const image of gltf.images) image.bufferView = viewMap.get(image.bufferView);
  gltf.bufferViews = views; gltf.buffers[0].byteLength = offset;
  const raw = Buffer.from(JSON.stringify(gltf)), json = Buffer.concat([raw, Buffer.alloc((4 - raw.length % 4) % 4, 32)]), packed = Buffer.concat(chunks), header = Buffer.alloc(20), binHeader = Buffer.alloc(8);
  header.write('glTF'); header.writeUInt32LE(2, 4); header.writeUInt32LE(28 + json.length + packed.length, 8); header.writeUInt32LE(json.length, 12); header.write('JSON', 16); binHeader.writeUInt32LE(packed.length); binHeader.write('BIN\0', 4);
  await fs.writeFile('public/models/' + spec.file, Buffer.concat([header, json, binHeader, packed]));
  console.log(key, { triangles, parts: gltf.meshes.reduce((n, m) => n + m.primitives.length, 0), bytes: header.readUInt32LE(8) });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) for (const key of Object.keys(AVATAR_SOURCES)) await prepareAvatar(key);

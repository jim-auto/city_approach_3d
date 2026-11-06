import * as THREE from 'three';

export const mats = new Map();
export function material(color, glow = false) {
  const key = `${color}-${glow}`;
  if (!mats.has(key)) mats.set(key, new THREE.MeshStandardMaterial({ color, roughness: glow ? 0.4 : 0.85, metalness: 0.08, emissive: glow ? color : 0x000000, emissiveIntensity: glow ? 1.6 : 0 }));
  return mats.get(key);
}
export const boxGeo = new THREE.BoxGeometry(1, 1, 1);
export function box(parent, x, y, z, w, h, d, color, glow = false) {
  const m = new THREE.Mesh(boxGeo, material(color, glow));
  m.position.set(x, y, z); m.scale.set(w, h, d); m.castShadow = !glow; m.receiveShadow = true; parent.add(m); return m;
}
export function cylinder(parent, x, y, z, radius, height, color, sides = 10) {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, height, sides), material(color));
  mesh.position.set(x, y, z); mesh.castShadow = true; mesh.receiveShadow = true; parent.add(mesh); return mesh;
}
export function textSign(parent, text, x, y, z, width, height, bg, fg, rotation = 0) {
  const canvas = document.createElement('canvas'); canvas.width = 512; canvas.height = Math.round(512 * height / width);
  const ctx = canvas.getContext('2d'); ctx.fillStyle = bg; ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = fg; ctx.lineWidth = 8; ctx.strokeRect(9, 9, 494, canvas.height - 18);
  ctx.fillStyle = fg; ctx.font = `700 ${Math.min(canvas.height * .55, 440 / Math.max(text.length * .6, 1))}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(text, 256, canvas.height * .52, 460);
  const tex = new THREE.CanvasTexture(canvas); tex.colorSpace = THREE.SRGBColorSpace;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(width, height), new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide }));
  m.position.set(x, y, z); m.rotation.y = rotation; parent.add(m); return m;
}

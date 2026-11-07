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
  const canvas = document.createElement('canvas'); canvas.width = width < 1.6 ? 128 : width < 4.5 ? 256 : 512; canvas.height = Math.max(32, Math.round(canvas.width * height / width));
  const ctx = canvas.getContext('2d'); ctx.fillStyle = bg; ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = fg; ctx.lineWidth = Math.max(2, canvas.width / 64); const inset = canvas.width * .018; ctx.strokeRect(inset, inset, canvas.width - inset * 2, canvas.height - inset * 2);
  ctx.fillStyle = fg; ctx.font = `700 ${Math.min(canvas.height * .55, canvas.width * .86 / Math.max(text.length * .6, 1))}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(text, canvas.width / 2, canvas.height * .52, canvas.width * .90);
  const tex = new THREE.CanvasTexture(canvas); tex.colorSpace = THREE.SRGBColorSpace;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(width, height), new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide }));
  m.userData.sign = { text, width, height, bg, fg }; m.position.set(x, y, z); m.rotation.y = rotation; parent.add(m); return m;
}

import * as THREE from 'three';
const geometries = new Map(), materials = new Map(), shapes = new Map();
const shared = r => { r.userData.characterShared = true; return r; };
function material(color) { if (!materials.has(color)) materials.set(color, shared(new THREE.MeshStandardMaterial({ color, roughness: .65 }))); return materials.get(color); }
function geometry(key, make) { if (!geometries.has(key)) geometries.set(key, shared(make())); return geometries.get(key); }
const box = geometry('box', () => new THREE.BoxGeometry(1, 1, 1));
const sphere = geometry('sphere', () => new THREE.SphereGeometry(1, 12, 8));
function add(parent, shape, color, position, scale) { const mesh = new THREE.Mesh(shape, material(color)); mesh.position.set(...position); mesh.scale.set(...scale); parent.add(mesh); return mesh; }
function shape(name) {
  if (shapes.has(name)) return shapes.get(name).clone(true);
  const group = new THREE.Group(); group.name = name;
  const b = (c, p, s) => add(group, box, c, p, s), ball = (c, p, s) => add(group, sphere, c, p, s);
  if (name === 'phone') { b('#252b38', [0, .035, .025], [.066, .12, .012]); b('#96c6ce', [0, .035, .018], [.054, .095, .002]); }
  if (name === 'coffee') {
    const cup = geometry('cup', () => new THREE.CylinderGeometry(.051, .040, .13, 16));
    add(group, cup, '#f0e4d4', [0, .045, .02], [1, 1, 1]);
    b('#b68b71', [0, .05, .02], [.095, .04, .087]);
    add(group, geometry('lid', () => new THREE.CylinderGeometry(.057, .057, .015, 16)), '#f7f0dc', [0, .115, .02], [1, 1, 1]);
  }
  if (name === 'book' || name === 'menu') {
    if (name === 'menu') { b('#862e47', [0, .05, .025], [.19, .26, .018]); for (let i = 0; i < 4; i++) b('#eed9ba', [0, .12 - i * .045, .036], [.13, .008, .003]); }
    else for (const side of [-1, 1]) { const cover = b('#63878e', [side * .075, 0, .025], [.15, .014, .2]); cover.rotation.z = side * -.12; const pages = b('#e9ddbd', [side * .075, .012, .025], [.14, .018, .18]); pages.rotation.z = side * -.12; }
  }
  if (name === 'camera') { b('#39485a', [0, 0, .04], [.2, .13, .08]); const lens = add(group, geometry('lens', () => new THREE.CylinderGeometry(.048, .048, .06, 16)), '#263a51', [0, 0, .10], [1, 1, 1]); lens.rotation.x = Math.PI / 2; b('#c4d4cf', [.06, .035, .083], [.027, .023, .009]); }
  if (name === 'bag') {
    const rounded = geometry('bag', () => {
      const s = new THREE.Shape(); s.moveTo(-.08, -.10); s.lineTo(.08, -.10); s.quadraticCurveTo(.10, -.10, .10, -.08); s.lineTo(.10, .08); s.quadraticCurveTo(.10, .10, .08, .10); s.lineTo(-.08, .10); s.quadraticCurveTo(-.10, .10, -.10, .08); s.lineTo(-.10, -.08); s.quadraticCurveTo(-.10, -.10, -.08, -.10);
      return new THREE.ExtrudeGeometry(s, { depth: .06, bevelEnabled: true, bevelSize: .008, bevelThickness: .008, bevelSegments: 2, steps: 1, curveSegments: 4 });
    });
    add(group, rounded, '#ac806b', [0, 0, -.03], [1, 1, 1]); b('#d2b38a', [0, .02, .04], [.05, .02, .008]);
    add(group, geometry('bag-strap', () => new THREE.TorusGeometry(.10, .004, 4, 16)), '#806254', [0, .20, -.012], [.4, 2.2, 1]);
  }
  if (name === 'watch') { ball('#b5a27c', [0, 0, .018], [.04, .026, .015]); b('#816a4f', [0, 0, -.003], [.07, .025, .035]); }
  if (name === 'headphones') { const band = geometry('headphone-band', () => new THREE.TorusGeometry(.105, .009, 5, 20, Math.PI)); const arc = add(group, band, '#b8a4ce', [0, .07, -.006], [1, 1, 1]); for (const side of [-1, 1]) ball('#85729b', [side * .113, .06, -.003], [.023, .043, .032]); arc.rotation.z = 0; }
  if (name === 'glasses') { const ring = geometry('glasses', () => new THREE.TorusGeometry(.032, .0024, 4, 20)); for (const side of [-1, 1]) add(group, ring, '#65546b', [side * .042, 0, 0], [1, .8, 1]); b('#65546b', [0, 0, 0], [.022, .003, .003]); }
  if (name === 'chain') { const chain = geometry('chain', () => new THREE.TorusGeometry(.075, .002, 4, 24, Math.PI)); const arc = add(group, chain, '#c3a66c', [0, 0, 0], [1, 1.3, 1]); arc.rotation.z = Math.PI; b('#d5b97b', [0, -.10, .002], [.012, .021, .004]); }
  group.traverse(o => { if (o.isMesh) o.frustumCulled = true; }); shapes.set(name, group); return group.clone(true);
}
export function createAccessories(style, detailed) {
  const group = new THREE.Group(), items = new Map(); group.name = 'accessories';
  // Background people keep the same authored body and face; omit tiny handheld objects.
  for (const name of [detailed ? style.prop : null, detailed && style.glasses ? 'glasses' : null, style.chain ? 'chain' : null].filter(Boolean)) { const item = shape(name); group.add(item); items.set(name, item); }
  return { group, items };
}
const point = new THREE.Vector3();
export function placeAccessories(model, source, humanoid) {
  const { items, source: template } = model.userData;
  const locate = (name, bone, offset = [0, 0, 0]) => {
    const object = items.get(name); if (!object) return;
    humanoid.getNormalizedBoneNode(bone).getWorldPosition(point); source.worldToLocal(point);
    object.position.copy(point).add(new THREE.Vector3(...offset)); object.rotation.set(0, source.rotation.y ? Math.PI : 0, 0);
  };
  locate('phone', 'rightHand'); locate('menu', 'rightHand'); locate('coffee', 'rightHand');
  if (items.has('book')) {
    const left = humanoid.getNormalizedBoneNode('leftHand').getWorldPosition(new THREE.Vector3()), right = humanoid.getNormalizedBoneNode('rightHand').getWorldPosition(new THREE.Vector3());
    source.worldToLocal(left.add(right).multiplyScalar(.5));
    items.get('book').position.copy(left); items.get('book').rotation.set(.45, source.rotation.y ? Math.PI : 0, 0);
  }
  locate('watch', 'leftHand', [0, .025, 0]); locate('camera', 'chest', [0, -.10, source.rotation.y ? -.14 : .14]);
  locate('bag', 'hips', [.18, .04, 0]); locate('headphones', 'head', [0, .065, 0]);
  locate('glasses', 'head', template.faceOffset.clone().add(new THREE.Vector3(0, 0, template.forward * .006)).toArray()); locate('chain', 'chest', [0, .08, source.rotation.y ? -.10 : .10]);
}

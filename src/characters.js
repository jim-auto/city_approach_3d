import { sampleReaction } from './reactions.js';
import { createAuthoredCharacter, animateAuthoredCharacter, setAuthoredOutfit } from './authored-characters.js';
import { loftGeometry, buildHead, strandGeometry, clothPanelGeometry, lapelGeometry, loftFront } from './character-shapes.js';
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// One shared, vertex-coloured surface per articulated part keeps draw calls small.
const surface = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .72, metalness: .03 });
const shadowMaterial = new THREE.MeshBasicMaterial({ color: '#080b18', transparent: true, opacity: .23, depthWrite: false });
const templates = new Map();
const looks = {
  toyoko_sora: { hair: 'ponytail', outfit: 'hoodie', pants: '#292d3a', skin: '#d9ae96', shoes: '#d8c7dc', accessory: 'headphones' },
  toyoko_ruka: { hair: 'crop', outfit: 'jacket', pants: '#303743', skin: '#dcaf91', shoes: '#efebdf', accessory: 'phone' },
  toyoko_neo: { hair: 'long', outfit: 'hoodie', pants: '#343047', skin: '#e5bba3', shoes: '#dad5e6', accessory: 'phone' },
  night_mai: { feminine: true, hair: 'long', outfit: 'coat', pants: '#5a4055', skin: '#e6bca2', shoes: '#4c384c', accessory: 'phone' },
  night_rei: { feminine: true, skirt: true, hair: 'wavy', outfit: 'cardigan', pants: '#cbb6b2', skin: '#dfb199', shoes: '#705266', accessory: 'bag' },
  night_kaito: { hair: 'sidepart', outfit: 'blazer', pants: '#343141', skin: '#d7ac8c', shoes: '#302b35', accessory: 'watch' },
  movie: { feminine: true, hair: 'bob', outfit: 'cardigan', pants: '#574659', skin: '#e1b198', shoes: '#e2d4c8', accessory: 'book' },
  shopping: { feminine: true, hair: 'ponytail', outfit: 'cardigan', pants: '#574659', skin: '#e1b198', shoes: '#e2d4c8', accessory: 'bag' },
  photo: { feminine: true, hair: 'bob', outfit: 'cardigan', pants: '#574659', skin: '#e1b198', shoes: '#e2d4c8', accessory: 'camera' },
  music: { feminine: true, hair: 'ponytail', outfit: 'cardigan', pants: '#574659', skin: '#e1b198', shoes: '#e2d4c8', accessory: 'headphones' },
  break: { feminine: true, hair: 'bob', outfit: 'cardigan', pants: '#574659', skin: '#e1b198', shoes: '#e2d4c8', accessory: 'coffee' },
  explorer: { feminine: true, hair: 'long', outfit: 'cardigan', pants: '#574659', skin: '#e1b198', shoes: '#e2d4c8', accessory: 'phone' },
  weekend: { feminine: true, hair: 'bob', outfit: 'cardigan', pants: '#574659', skin: '#e1b198', shoes: '#e2d4c8', accessory: 'bag' },
  stroll: { feminine: true, hair: 'long', outfit: 'cardigan', pants: '#574659', skin: '#e1b198', shoes: '#e2d4c8', accessory: 'phone' },
  catch: { hair: 'crop', outfit: 'jacket', pants: '#252734', skin: '#cda181', shoes: '#292933', accessory: 'menu' },
  scout: { hair: 'sidepart', outfit: 'blazer', pants: '#303342', skin: '#dfb49b', shoes: '#262430', accessory: 'watch' },
  player: { hair: 'sidepart', outfit: 'blazer', pants: '#292c39', skin: '#dfb397', shoes: '#302b32', accessory: 'watch' },
  waiting: { feminine: true, hair: 'long', outfit: 'coat', pants: '#45405d', skin: '#edc3a6', shoes: '#f0dfcf', accessory: 'phone' },
  eye: { skirt: true, feminine: true, hair: 'bob', outfit: 'cardigan', pants: '#e1d6c9', skin: '#e1ad90', shoes: '#614d5d', accessory: 'bag' },
  tourist: { feminine: true, hair: 'wavy', outfit: 'jacket', pants: '#536677', skin: '#d5a17e', shoes: '#eee6d3', accessory: 'camera' },
  busy: { feminine: true, hair: 'long', outfit: 'blazer', pants: '#3c465c', skin: '#deb193', shoes: '#343744', accessory: 'phone' },
  earphones: { feminine: true, hair: 'ponytail', outfit: 'hoodie', pants: '#445663', skin: '#bd8a6b', shoes: '#e4e9e4', accessory: 'headphones' },
  cafe: { skirt: true, feminine: true, hair: 'wavy', outfit: 'cardigan', pants: '#d7cbbb', skin: '#e9b69b', shoes: '#e9dfcb', accessory: 'coffee' },
  reader: { feminine: true, hair: 'bob', outfit: 'knit', pants: '#596073', skin: '#c69273', shoes: '#4c3e41', accessory: 'book', glasses: true },
  friend: { feminine: true, hair: 'ponytail', outfit: 'jacket', pants: '#4f5167', skin: '#e8bb9e', shoes: '#e4d6d9', accessory: 'bag' },
};

function builder(detailed = true) {
  const geometries = [];
  const add = (geometry, color, position, scale = [1, 1, 1], rotation = [0, 0, 0]) => {
    const g = geometry.index ? geometry.toNonIndexed() : geometry;
    if (g !== geometry) geometry.dispose();
    g.deleteAttribute('uv');
    const transform = new THREE.Matrix4().compose(new THREE.Vector3(...position), new THREE.Quaternion().setFromEuler(new THREE.Euler(...rotation)), new THREE.Vector3(...scale));
    g.applyMatrix4(transform);
    const c = new THREE.Color(color), blush = new THREE.Color('#cc9193'), vertex = new THREE.Color(), colors = new Float32Array(g.attributes.position.count * 3);
    for (let i = 0; i < colors.length; i += 3) {
      vertex.copy(c);
      if (geometry.userData.skinGradient) {
        const p = g.attributes.position, x = p.getX(i / 3), y = p.getY(i / 3), z = p.getZ(i / 3);
        const warmth = z > .05 ? .14 * Math.exp(-1 * ((Math.abs(x) - .105) / .042) ** 2 - ((y + .055) / .034) ** 2) : 0;
        vertex.lerp(blush, warmth).multiplyScalar(1 + .035 * y);
      }
      colors[i] = vertex.r; colors[i + 1] = vertex.g; colors[i + 2] = vertex.b;
    }
    g.setAttribute('color', new THREE.BufferAttribute(colors, 3)); geometries.push(g);
  };
  return {
    geometry: (g, color) => add(g, color, [0, 0, 0]),
    loft: (color, rings, segments) => add(loftGeometry(rings, segments || (detailed ? 20 : 10)), color, [0, 0, 0]),
    strand: (color, points, widths, depths) => add(strandGeometry(points, widths, depths, detailed), color, [0, 0, 0]),
    box: (color, p, size, r) => add(new THREE.BoxGeometry(1, 1, 1), color, p, size, r),
    ball: (color, p, size, r) => add(new THREE.SphereGeometry(1, Math.max(...size) < .06 ? 8 : detailed ? 16 : 10, Math.max(...size) < .06 ? 5 : detailed ? 10 : 7), color, p, size, r),
    cone: (color, p, radiusTop, radiusBottom, height, r, depth = 1) => add(new THREE.CylinderGeometry(radiusTop, radiusBottom, height, detailed ? 20 : 10), color, p, [1, 1, depth], r),
    arc: (color, p, radius, tube, rotation, length = Math.PI * 2) => add(new THREE.TorusGeometry(radius, tube, 4, 14, length), color, p, [1, 1, 1], rotation),
    scalp: (color, p, size) => add(new THREE.SphereGeometry(1, 12, 7, 0, Math.PI * 2, 0, Math.PI * .56), color, p, size),
    finish() {
      const geometry = mergeGeometries(geometries); geometries.forEach(g => g.dispose());
      geometry.computeBoundingBox(); geometry.computeBoundingSphere(); geometry.userData.characterShared = true; return geometry;
    },
  };
}
function part(name, build, detailed) {
  const b = builder(detailed); build(b); const mesh = new THREE.Mesh(b.finish(), surface); mesh.name = name; mesh.castShadow = true; mesh.receiveShadow = true; return mesh;
}
function shade(color, multiplier) { return new THREE.Color(color).multiplyScalar(multiplier); }

function buildTemplate(color, hairColor, kind, detailed) {
  const look = looks[kind] || looks.player, root = new THREE.Group(); root.name = `person-${kind}`;
  const add = (parent, name, fn) => { const mesh = part(name, fn, detailed); parent.add(mesh); return mesh; };
  const body = new THREE.Group(); body.name = 'body'; root.add(body);
  const torsoRings = [[.99, .18, .12], [1.13, look.outfit === 'hoodie' ? .20 : look.feminine ? .166 : .19, .125], [1.32, .205, .145], [1.51, look.feminine ? .23 : .26, .135], [1.59, look.feminine ? .19 : .21, .115], [1.65, .075, .075]];
  add(body, 'outfit', b => {
    b.loft(color, torsoRings);
    b.loft(look.skin, [[1.63, .065, .062], [1.72, .058, .058], [1.81, .064, .064]]);
    b.cone(look.pants, [0, .99, 0], .175, .175, .15, undefined, .65);
    const inner = ['player', 'scout', 'night_kaito'].includes(kind) ? '#22232e' : '#e9e3dd', dark = shade(color, .72), light = shade(color, 1.15);
    if (look.outfit === 'coat') {
      b.loft(color, [[.80, .265, .17, -.015], [.9, .24, .16, -.015], [1.13, .18, .125, -.015], [1.2, .19, .13, -.015]]);
      b.geometry(clothPanelGeometry(torsoRings, .07, 1.20, 1.59, detailed), inner);
      for (const side of [-1, 1]) b.geometry(lapelGeometry(torsoRings, [[side * .05, 1.615], [side * .15, 1.51], [side * .065, 1.31], [side * .075, 1.52]]), light);
      if (detailed) for (const y of [1.08, 1.25, 1.41]) b.ball('#bfa77e', [.055, y, loftFront(torsoRings, .055, y) + .009], [.009, .011, .004]);
      b.loft(shade(color, .91), [[1.125, .179, .128], [1.15, .177, .128]]);
    } else if (['jacket', 'blazer', 'cardigan'].includes(look.outfit)) {
      b.geometry(clothPanelGeometry(torsoRings, .075, 1.08, 1.60, detailed), inner);
      for (const side of [-1, 1]) {
        b.geometry(lapelGeometry(torsoRings, [[side * .05, 1.61], [side * .15, 1.535], [side * .065, 1.32], [side * .085, 1.52]]), light);
        if (detailed) b.geometry(lapelGeometry(torsoRings, [[side * .10, 1.19], [side * .155, 1.19], [side * .15, 1.176], [side * .10, 1.176]]), dark);
      }
      b.loft(shade(color, .94), [[1.035, .185, .129], [1.06, .183, .128]]);
    } else if (look.outfit === 'hoodie') {
      b.ball(dark, [0, 1.65, -.055], [.21, .11, .19]);
      b.geometry(clothPanelGeometry(torsoRings, .12, 1.12, 1.23, detailed), shade(color, .96));
      for (const x of [-.055, .055]) b.strand('#dcd6ce', [[x, 1.61, .105], [x * .9, 1.52, .135], [x, 1.40, .15]], [.002, .002, .001], [.002, .002, .001]);
      b.loft(shade(color, .94), [[1.035, .19, .129], [1.07, .192, .13]]);
    } else {
      b.loft(color, [[1.62, .077, .07], [1.70, .068, .064], [1.74, .068, .064]]);
      if (detailed) for (const y of [1.17, 1.29, 1.41]) b.box(shade(color, .88), [0, y, .172], [.38, .018, .02]);
    }
    if (look.skirt) {
      b.loft(color, [[.72, .29, .21], [.82, .26, .19], [1.02, .2, .14], [1.12, .178, .125]]);
      if (detailed) for (const x of [-.16, -.06, .06, .16]) b.strand(shade(color, .92), [[x * .65, 1.06, .13], [x * .85, .89, .18], [x, .74, .19]], [.001, .002, .001], [.001, .001, .001]);
    }
    if (kind === 'player' || kind === 'scout' || kind === 'night_kaito') {
      b.strand('#baa06b', [[-.052, 1.69, .06], [0, 1.545, .15], [.052, 1.69, .06]], [.002, .002, .002], [.002, .002, .002]);
      b.box('#c7ac78', [0, 1.547, .157], [.012, .023, .006]);
    }
  });
  const head = new THREE.Group(); head.name = 'head'; head.position.set(0, 1.98, 0); body.add(head);
  add(head, 'face-and-hair', b => buildHead(b, look, hairColor, detailed));
  const arms = [], elbows = [], legs = [], knees = [], props = [];
  for (const side of [-1, 1]) {
    const arm = new THREE.Group(); arm.name = side < 0 ? 'arm-left' : 'arm-right'; arm.position.set(side * .29, 1.58, 0); body.add(arm); arms.push(arm);
    add(arm, 'sleeve', b => b.loft(color, [[-.34, .067, .068], [-.24, .077, .078], [-.08, look.feminine ? .084 : .095, .09], [.015, .080, .078], [.065, .042, .043], [.08, .001, .001]]));
    const elbow = new THREE.Group(); elbow.name = 'elbow'; elbow.position.set(side * .03, -.33, 0); arm.add(elbow); elbows.push(elbow);
    add(elbow, 'forearm-and-hand', b => {
      b.loft(color, [[-.28, .049, .050], [-.24, .055, .057], [-.10, .065, .066], [0, .067, .068]]);
      b.ball(look.skin, [0, -.33, .006], [.045, .059, .027]);
      b.ball(look.skin, [-side * .037, -.32, .028], [.016, .034, .020]);
      if (detailed) for (let finger = 0; finger < 4; finger++) b.ball(look.skin, [-.027 + finger * .018, -.375 + Math.abs(finger - 1.5) * .006, .010], [.009, .026, .014]);
    });
    const leg = new THREE.Group(); leg.name = side < 0 ? 'leg-left' : 'leg-right'; leg.position.set(side * .125, .95, 0); root.add(leg); legs.push(leg);
    add(leg, 'trouser-thigh', b => b.loft(look.pants, [[-.42, .062, .062], [-.28, .075, .074], [-.08, .089, .085], [0, .086, .080]]));
    const knee = new THREE.Group(); knee.name = 'knee'; knee.position.y = -.40; leg.add(knee); knees.push(knee);
    add(knee, 'trouser-calf-and-shoe', b => {
      b.loft(look.pants, [[-.46, .045, .049], [-.34, .050, .054], [-.15, .068, .068], [.018, .063, .063]]);
      b.ball(look.shoes, [0, -.48, .047], [.075, .063, .14]);
      b.loft(look.outfit === 'blazer' ? '#35333b' : '#d3cec6', [[-.55, .069, .124, .049], [-.535, .077, .140, .049], [-.520, .076, .138, .049]]);
      if (detailed && look.outfit !== 'blazer') for (const z of [.04, .075, .11]) b.box('#d9d2c9', [0, -.431, z], [.067, .004, .006]);
    });
  }
  if (look.accessory === 'watch') add(elbows[0], 'wrist-watch', b => { b.cone('#bfa46b', [0, -.26, 0], .075, .075, .055); b.ball('#e1cda1', [0, -.26, .068], [.045, .035, .015]); });
  const held = look.accessory;
  if (held === 'menu') {
    const menu = add(elbows[1], 'restaurant-menu', b => { b.box('#862e47', [0, -.31, .10], [.23, .33, .025]); for (let i = 0; i < 4; i++) b.box('#eed9ba', [0, -.21 - i * .06, .117], [.16, .018, .006]); }); props.push(menu);
  }
  if (held === 'phone') {
    const phone = add(elbows[1], 'phone', b => {
      b.box('#273344', [0, -.34, .07], [.105, .19, .027]); b.box('#9bc9cd', [0, -.34, .087], [.083, .145, .006]);
      if (detailed) for (let i = 0; i < 3; i++) b.box('#e6f0dc', [-.012, -.30 - i * .025, .092], [.047, .009, .004]);
    }); props.push(phone);
  }
  if (held === 'coffee') {
    const hand = new THREE.Group(); hand.name = 'coffee-hand'; hand.position.set(0, -.35, .04); elbows[1].add(hand);
    add(hand, 'coffee', b => {
      b.cone('#f0e4d4', [0, .04, .04], .074, .057, .18);
      b.cone('#b68b71', [0, .05, .04], .07, .061, .068);
      b.cone('#f7f0dc', [0, .14, .04], .083, .083, .023);
    }); props.push(hand);
  }
  if (held === 'book') {
    const book = add(elbows[0], 'open-book', b => {
      for (const side of [-1, 1]) {
        b.box('#748a92', [.17 + side * .105, -.34, .085], [.22, .025, .28], [0, 0, side * -.15]);
        b.box('#e9ddbd', [.17 + side * .105, -.315, .085], [.2, .025, .255], [0, 0, side * -.15]);
        if (detailed) for (let i = 0; i < 5; i++) b.box('#bcb294', [.17 + side * .105, -.298, .015 + i * .035], [.15, .003, .005], [0, 0, side * -.15]);
      }
    }); props.push(book);
  }
  if (held === 'camera') {
    add(body, 'camera-and-backpack', b => {
      for (const side of [-1, 1]) b.box('#535051', [side * .13, 1.49, .16], [.026, .42, .026], [0, 0, side * -.27]);
      b.box('#3d4655', [0, 1.25, .23], [.29, .20, .13]);
      b.cone('#788897', [0, 1.25, .335], .078, .078, .09, [Math.PI / 2, 0, 0]);
      b.cone('#263a51', [0, 1.25, .39], .055, .055, .025, [Math.PI / 2, 0, 0]);
      b.box('#c4d4cf', [.09, 1.30, .3], [.04, .025, .02]);
      b.ball('#687b7e', [0, 1.37, -.24], [.23, .28, .12]);
      b.box('#9aada7', [0, 1.3, -.35], [.26, .16, .03]);
    });
  } else if (held === 'bag' || held === 'satchel') {
    add(body, 'crossbody-bag', b => {
      b.box('#6f5553', [0, 1.4, .19], [.031, .66, .026], [0, 0, -.63]);
      b.ball(held === 'bag' ? '#c7a887' : '#5c7776', [.29, 1.05, .02], [.16, .17, .10]);
      b.box('#d2b38a', [.29, 1.09, .125], [.08, .035, .012]);
    });
  }
  const shadowGeometry = new THREE.CircleGeometry(.43, 16); shadowGeometry.userData.characterShared = true;
  const shadow = new THREE.Mesh(shadowGeometry, shadowMaterial); shadow.name = 'contact-shadow'; shadow.rotation.x = -Math.PI / 2; shadow.position.y = .016; root.add(shadow);
  root.userData = { character: true, kind, detailed, resourceOwner: 'characters', appearance: { ...look }, body, head, arms, elbows, legs, knees, props };
  return root;
}

// Clone the hierarchy, share immutable geometry/materials, and rebind every joint.
export function createCharacter(color, hair, kind = 'player', { detailed = true } = {}) {
  const authored = createAuthoredCharacter(kind, detailed, color);
  if (authored) return authored;
  const key = `${color}/${hair}/${kind}/${detailed}`;
  if (!templates.has(key)) {
    const root = buildTemplate(color, hair, kind, detailed), rig = root.userData;
    root.userData = { character: true, kind, detailed, resourceOwner: 'characters', appearance: { ...rig.appearance } };
    templates.set(key, { root, rig });
  }
  const { root: template, rig } = templates.get(key), model = template.clone(true);
  const objects = new Map();
  const bind = (source, clone) => { objects.set(source, clone); source.children.forEach((child, i) => bind(child, clone.children[i])); };
  bind(template, model);
  model.userData = { baseColor: color, character: true, kind, detailed, resourceOwner: 'characters', appearance: { ...rig.appearance }, body: objects.get(rig.body), head: objects.get(rig.head), arms: rig.arms.map(o => objects.get(o)), elbows: rig.elbows.map(o => objects.get(o)), legs: rig.legs.map(o => objects.get(o)), knees: rig.knees.map(o => objects.get(o)), props: rig.props.map(o => objects.get(o)) };
  animateCharacter(model, false, 0);
  return model;
}

export function animateCharacter(model, moving, time, seed = 0) {
  if (animateAuthoredCharacter(model, moving, time, seed)) return;
  const { body, head, arms, elbows, legs, knees, kind, props } = model.userData;
  const wave = Math.sin(time * 8 + seed), swing = moving ? wave * .42 : 0;
  body.position.y = moving ? Math.abs(wave) * .025 : Math.sin(time * 1.8 + seed) * .009;
  body.rotation.x = body.rotation.y = 0; body.position.z = 0;
  body.rotation.z = moving ? Math.sin(time * 4 + seed) * .025 : 0;
  head.rotation.y = moving ? 0 : Math.sin(time * .6 + seed) * .065;
  head.rotation.x = ['waiting', 'busy', 'reader'].includes(kind) ? .12 : 0;
  for (let i = 0; i < 2; i++) {
    const phase = i ? -swing : swing;
    legs[i].position.y = .95; legs[i].rotation.set(phase, 0, 0);
    knees[i].rotation.x = moving ? Math.max(0, -phase) * 1.15 : .025;
    arms[i].rotation.set(-phase * .65, 0, i ? -.06 : .06);
    elbows[i].rotation.set(moving ? -.12 - Math.max(0, phase) * .45 : -.12, 0, 0);
  }
  if (['waiting', 'busy', 'cafe', 'catch', 'toyoko_ruka', 'toyoko_neo', 'night_mai'].includes(kind)) { arms[1].rotation.x = -.24; elbows[1].rotation.x = -1.12; }
  if (kind === 'cafe') props[0].quaternion.copy(body.quaternion).multiply(arms[1].quaternion).multiply(elbows[1].quaternion).invert();
  if (kind === 'reader') { arms.forEach(a => a.rotation.x = -.22); elbows.forEach(a => a.rotation.x = -1.15); }
  if (kind === 'earphones' && !moving) head.rotation.z = Math.sin(time * 2 + seed) * .04;
  else head.rotation.z = 0;
  const reaction=model.userData.reaction;
  if(reaction){const r=sampleReaction(reaction.id,reaction.elapsed,reaction.duration);head.rotation.x=r.headX;head.rotation.y=r.headY;head.rotation.z=r.headZ;body.rotation.x=r.chestX;body.rotation.z=r.chestZ;body.position.y+=r.lift;
    if(r.gesture!=='none'){arms[0].rotation.x=-.3*r.energy;elbows[0].rotation.x=-(r.gesture==='cheek'?1.8:1.2)*r.energy;}
  }
}

export function isCharacterResource(resource) { return resource?.userData?.characterShared || resource === surface || resource === shadowMaterial; }

export function setCharacterOutfit(model, color) {
  if (setAuthoredOutfit(model, color)) return true;
  if (!model.userData.character) return false;
  if (!model.userData.outfitParts) {
    const parts = []; model.traverse(mesh => { if (['outfit', 'sleeve', 'forearm-and-hand'].includes(mesh.name)) parts.push({ mesh, original: mesh.geometry, variants: new Map() }); });
    model.userData.outfitParts = parts;
  }
  const base = new THREE.Color(model.userData.baseColor || '#303544'), tint = new THREE.Color(color);
  for (const part of model.userData.outfitParts) {
    if (!part.variants.has(color)) {
      const g = part.original.clone(), colors = g.attributes.color;
      for (let i = 0; i < colors.count; i++) {
        const r = colors.getX(i), green = colors.getY(i), b = colors.getZ(i), scale = (r / base.r + green / base.g + b / base.b) / 3;
        if (Math.max(Math.abs(r - base.r * scale), Math.abs(green - base.g * scale), Math.abs(b - base.b * scale)) < .012) colors.setXYZ(i, tint.r * scale, tint.g * scale, tint.b * scale);
      }
      g.userData.characterShared = true; part.variants.set(color, g);
    }
    part.mesh.geometry = part.variants.get(color);
  }
  return true;
}

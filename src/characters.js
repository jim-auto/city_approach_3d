import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// One shared, vertex-coloured surface per articulated part keeps draw calls small.
const surface = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .8, metalness: .03 });
const shadowMaterial = new THREE.MeshBasicMaterial({ color: '#080b18', transparent: true, opacity: .23, depthWrite: false });
const templates = new Map();
const looks = {
  player: { hair: 'crop', outfit: 'jacket', pants: '#344957', skin: '#e5b799', shoes: '#ece8d9', accessory: 'satchel' },
  waiting: { hair: 'long', outfit: 'coat', pants: '#45405d', skin: '#edc3a6', shoes: '#f0dfcf', accessory: 'phone' },
  eye: { hair: 'bob', outfit: 'cardigan', pants: '#e1d6c9', skin: '#e1ad90', shoes: '#614d5d', accessory: 'bag' },
  tourist: { hair: 'crop', outfit: 'jacket', pants: '#536677', skin: '#d5a17e', shoes: '#eee6d3', accessory: 'camera' },
  busy: { hair: 'sidepart', outfit: 'blazer', pants: '#3c465c', skin: '#deb193', shoes: '#343744', accessory: 'phone' },
  earphones: { hair: 'ponytail', outfit: 'hoodie', pants: '#445663', skin: '#bd8a6b', shoes: '#e4e9e4', accessory: 'headphones' },
  cafe: { hair: 'wavy', outfit: 'cardigan', pants: '#d7cbbb', skin: '#e9b69b', shoes: '#e9dfcb', accessory: 'coffee' },
  reader: { hair: 'bob', outfit: 'knit', pants: '#596073', skin: '#c69273', shoes: '#4c3e41', accessory: 'book', glasses: true },
  friend: { hair: 'ponytail', outfit: 'jacket', pants: '#4f5167', skin: '#e8bb9e', shoes: '#e4d6d9', accessory: 'bag' },
};

function builder() {
  const geometries = [];
  const add = (geometry, color, position, scale = [1, 1, 1], rotation = [0, 0, 0]) => {
    const g = geometry.index ? geometry.toNonIndexed() : geometry;
    if (g !== geometry) geometry.dispose();
    g.deleteAttribute('uv');
    const transform = new THREE.Matrix4().compose(new THREE.Vector3(...position), new THREE.Quaternion().setFromEuler(new THREE.Euler(...rotation)), new THREE.Vector3(...scale));
    g.applyMatrix4(transform);
    const c = new THREE.Color(color), colors = new Float32Array(g.attributes.position.count * 3);
    for (let i = 0; i < colors.length; i += 3) { colors[i] = c.r; colors[i + 1] = c.g; colors[i + 2] = c.b; }
    g.setAttribute('color', new THREE.BufferAttribute(colors, 3)); geometries.push(g);
  };
  return {
    box: (color, p, size, r) => add(new THREE.BoxGeometry(1, 1, 1), color, p, size, r),
    ball: (color, p, size, r) => add(new THREE.SphereGeometry(1, 10, 7), color, p, size, r),
    cone: (color, p, radiusTop, radiusBottom, height, r, depth = 1) => add(new THREE.CylinderGeometry(radiusTop, radiusBottom, height, 10), color, p, [1, 1, depth], r),
    arc: (color, p, radius, tube, rotation, length = Math.PI * 2) => add(new THREE.TorusGeometry(radius, tube, 4, 14, length), color, p, [1, 1, 1], rotation),
    scalp: (color, p, size) => add(new THREE.SphereGeometry(1, 12, 7, 0, Math.PI * 2, 0, Math.PI * .56), color, p, size),
    finish() {
      const geometry = mergeGeometries(geometries); geometries.forEach(g => g.dispose());
      geometry.computeBoundingBox(); geometry.computeBoundingSphere(); geometry.userData.characterShared = true; return geometry;
    },
  };
}
function part(name, build) {
  const b = builder(); build(b); const mesh = new THREE.Mesh(b.finish(), surface); mesh.name = name; mesh.castShadow = true; mesh.receiveShadow = true; return mesh;
}
function shade(color, multiplier) { return new THREE.Color(color).multiplyScalar(multiplier); }

function buildTemplate(color, hairColor, kind, detailed) {
  const look = looks[kind] || looks.player, root = new THREE.Group(); root.name = `person-${kind}`;
  const add = (parent, name, fn) => { const mesh = part(name, fn); parent.add(mesh); return mesh; };
  const body = new THREE.Group(); body.name = 'body'; root.add(body);
  add(body, 'outfit', b => {
    b.cone(color, [0, 1.34, 0], .265, .205, .59, undefined, .66);
    b.ball(color, [0, 1.56, 0], [.29, .13, .18]);
    b.cone(look.skin, [0, 1.73, 0], .075, .09, .18);
    b.cone(look.pants, [0, .99, 0], .21, .21, .15, undefined, .7);
    const inner = '#f1e8da', dark = shade(color, .72), light = shade(color, 1.15);
    if (look.outfit === 'coat') {
      b.cone(color, [0, 1.02, -.015], .205, .29, .42, undefined, .65);
      b.box(dark, [0, 1.11, .182], [.025, .46, .018]);
      b.box(inner, [0, 1.57, .164], [.15, .23, .025]);
      for (const side of [-1, 1]) b.box(light, [side * .12, 1.49, .18], [.1, .26, .035], [0, 0, side * -.34]);
      if (detailed) for (const y of [1.1, 1.26, 1.41]) b.ball('#dbc4ab', [.06, y, .19], [.022, .022, .012]);
      b.box(dark, [0, 1.16, .005], [.43, .045, .32]);
    } else if (['jacket', 'blazer', 'cardigan'].includes(look.outfit)) {
      b.box(inner, [0, 1.35, .165], [.19, .51, .028]);
      for (const side of [-1, 1]) {
        b.box(light, [side * .115, 1.5, .181], [.085, .29, .036], [0, 0, side * -.27]);
        if (detailed) b.box(dark, [side * .18, 1.19, .166], [.10, .025, .035]);
      }
      b.box(dark, [0, 1.05, .01], [.43, .05, .3]);
      if (look.outfit === 'blazer') b.box('#839fb3', [0, 1.43, .19], [.04, .29, .02]);
    } else if (look.outfit === 'hoodie') {
      b.ball(dark, [0, 1.65, -.055], [.21, .11, .19]);
      b.box(dark, [0, 1.17, .17], [.26, .14, .035]);
      for (const x of [-.075, .075]) b.box('#e0e4d8', [x, 1.46, .185], [.013, .22, .016]);
      b.box(light, [0, 1.06, .01], [.43, .055, .31]);
    } else {
      b.arc(dark, [0, 1.64, .01], .10, .025, [Math.PI / 2, 0, 0]);
      if (detailed) for (const y of [1.17, 1.29, 1.41]) b.box(shade(color, .88), [0, y, .172], [.38, .018, .02]);
    }
    if (detailed) for (const side of [-1, 1]) b.box(shade(look.pants, .75), [side * .17, .98, .05], [.06, .08, .15]);
  });
  const head = new THREE.Group(); head.name = 'head'; head.position.set(0, 1.94, 0); body.add(head);
  add(head, 'face-and-hair', b => {
    b.ball(look.skin, [0, 0, 0], [.235, .275, .219]);
    b.ball(shade(look.skin, .94), [0, -.12, .05], [.175, .145, .17]);
    for (const side of [-1, 1]) {
      b.ball(look.skin, [side * .232, -.01, -.005], [.045, .065, .036]);
      b.ball('#f4f0e9', [side * .087, .024, .203], [.051, .034, .018]);
      b.ball('#303445', [side * .087, .023, .219], [.023, .029, .009]);
      if (detailed) {
        b.ball('#fff6e8', [side * .083 - .006, .033, .227], [.007, .009, .004]);
        b.box(hairColor, [side * .086, .086, .205], [.072, .017, .019], [0, 0, side * -.1]);
        b.ball('#d99889', [side * .135, -.065, .185], [.047, .022, .013]);
      }
    }
    b.ball(shade(look.skin, .92), [0, -.025, .224], [.028, .043, .032]);
    b.arc('#995e5e', [0, -.118, .193], .034, .007, [0, 0, Math.PI], Math.PI);
    b.scalp(hairColor, [0, .047, -.025], [.254, .275, .24]);
    const hairLight = shade(hairColor, 1.38);
    for (let i = 0; i < 5; i++) {
      const x = -.17 + i * .078;
      b.cone(i % 2 ? hairLight : hairColor, [x, .146 + (kind === 'busy' ? x * .4 : 0), .159], .075, .015, .19, [0, 0, -.18 + i * .08], .55);
    }
    if (look.hair === 'long' || look.hair === 'bob') {
      b.ball(hairColor, [0, look.hair === 'long' ? -.2 : -.075, -.125], [.25, look.hair === 'long' ? .42 : .28, .15]);
      for (const side of [-1, 1]) b.ball(side > 0 ? hairLight : hairColor, [side * .218, -.115, -.018], [.075, look.hair === 'long' ? .31 : .21, .12]);
    } else if (look.hair === 'ponytail') {
      b.ball(hairColor, [0, .08, -.26], [.12, .12, .13]);
      b.ball(hairColor, [.025, -.15, -.31], [.105, .29, .1], [-.22, 0, -.13]);
      b.arc('#dfb186', [0, .07, -.26], .085, .018, [Math.PI / 2, 0, 0]);
    } else if (look.hair === 'wavy') {
      for (let i = 0; i < 7; i++) { const a = i / 6 * Math.PI; b.ball(i % 2 ? hairLight : hairColor, [Math.cos(a) * .23, .05, -.035 - Math.sin(a) * .17], [.10, .27, .10]); }
    } else {
      b.ball(hairColor, [0, .17, -.15], [.23, .19, .14]);
      b.ball(hairLight, [-.06, .26, -.035], [.17, .075, .16], [0, 0, -.18]);
    }
    if (look.glasses) {
      for (const side of [-1, 1]) b.arc('#4c4750', [side * .089, .028, .231], .061, .009);
      b.box('#4c4750', [0, .04, .232], [.045, .009, .01]);
    }
    if (look.accessory === 'headphones') {
      b.arc('#d1bdcc', [0, .055, -.025], .29, .026, [0, 0, 0], Math.PI);
      for (const side of [-1, 1]) { b.ball('#d1bdcc', [side * .26, -.01, -.01], [.053, .09, .075]); b.ball('#6d667f', [side * .292, -.01, -.01], [.025, .065, .055]); }
    }
  });
  const arms = [], elbows = [], legs = [], knees = [], props = [];
  for (const side of [-1, 1]) {
    const arm = new THREE.Group(); arm.name = side < 0 ? 'arm-left' : 'arm-right'; arm.position.set(side * .29, 1.58, 0); body.add(arm); arms.push(arm);
    add(arm, 'sleeve', b => { b.ball(color, [side * .025, -.10, 0], [.105, .18, .105]); b.cone(color, [side * .03, -.23, 0], .09, .078, .23); });
    const elbow = new THREE.Group(); elbow.name = 'elbow'; elbow.position.set(side * .03, -.33, 0); arm.add(elbow); elbows.push(elbow);
    add(elbow, 'forearm-and-hand', b => {
      b.cone(color, [0, -.13, 0], .079, .065, .28);
      b.cone(shade(color, .8), [0, -.265, 0], .068, .068, .055);
      b.ball(look.skin, [0, -.35, .015], [.061, .088, .055]);
      b.ball(look.skin, [-side * .047, -.337, .04], [.025, .044, .026]);
    });
    const leg = new THREE.Group(); leg.name = side < 0 ? 'leg-left' : 'leg-right'; leg.position.set(side * .125, .95, 0); root.add(leg); legs.push(leg);
    add(leg, 'trouser-thigh', b => b.cone(look.pants, [0, -.19, 0], .102, .078, .40, undefined, .9));
    const knee = new THREE.Group(); knee.name = 'knee'; knee.position.y = -.40; leg.add(knee); knees.push(knee);
    add(knee, 'trouser-calf-and-shoe', b => {
      b.cone(look.pants, [0, -.17, 0], .077, .06, .36, undefined, .9);
      b.cone(shade(look.pants, 1.1), [0, -.325, 0], .064, .064, .05);
      b.ball(look.shoes, [0, -.413, .065], [.091, .068, .17]);
      b.box('#dddace', [0, -.454, .06], [.18, .035, .30]);
      if (detailed) for (const z of [.04, .085, .13]) b.box('#f9f0df', [0, -.357, z], [.09, .009, .015]);
    });
  }
  const held = look.accessory;
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
  model.userData = { character: true, kind, detailed, resourceOwner: 'characters', appearance: { ...rig.appearance }, body: objects.get(rig.body), head: objects.get(rig.head), arms: rig.arms.map(o => objects.get(o)), elbows: rig.elbows.map(o => objects.get(o)), legs: rig.legs.map(o => objects.get(o)), knees: rig.knees.map(o => objects.get(o)), props: rig.props.map(o => objects.get(o)) };
  animateCharacter(model, false, 0);
  return model;
}

export function animateCharacter(model, moving, time, seed = 0) {
  const { body, head, arms, elbows, legs, knees, kind, props } = model.userData;
  const wave = Math.sin(time * 8 + seed), swing = moving ? wave * .42 : 0;
  body.position.y = moving ? Math.abs(wave) * .025 : Math.sin(time * 1.8 + seed) * .009;
  body.rotation.z = moving ? Math.sin(time * 4 + seed) * .025 : 0;
  head.rotation.y = moving ? 0 : Math.sin(time * .6 + seed) * .065;
  head.rotation.x = ['waiting', 'busy', 'reader'].includes(kind) ? .12 : 0;
  for (let i = 0; i < 2; i++) {
    const phase = i ? -swing : swing;
    legs[i].rotation.x = phase;
    knees[i].rotation.x = moving ? Math.max(0, -phase) * 1.15 : .025;
    arms[i].rotation.set(-phase * .65, 0, i ? -.06 : .06);
    elbows[i].rotation.x = moving ? -.12 - Math.max(0, phase) * .45 : -.12;
  }
  if (['waiting', 'busy', 'cafe'].includes(kind)) { arms[1].rotation.x = -.24; elbows[1].rotation.x = -1.12; }
  if (kind === 'cafe') props[0].quaternion.copy(body.quaternion).multiply(arms[1].quaternion).multiply(elbows[1].quaternion).invert();
  if (kind === 'reader') { arms.forEach(a => a.rotation.x = -.22); elbows.forEach(a => a.rotation.x = -1.15); }
  if (kind === 'earphones' && !moving) head.rotation.z = Math.sin(time * 2 + seed) * .04;
  else head.rotation.z = 0;
}

export function isCharacterResource(resource) { return resource?.userData?.characterShared || resource === surface || resource === shadowMaterial; }

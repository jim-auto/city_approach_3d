import * as THREE from 'three';
import { PROFILES, clamp } from './game.js';
import { bindWorldInput, renderProfile } from './input.js';

const mats = new Map();
function material(color, glow = false) {
  const key = `${color}-${glow}`;
  if (!mats.has(key)) mats.set(key, new THREE.MeshStandardMaterial({ color, roughness: glow ? 0.4 : 0.85, metalness: 0.08, emissive: glow ? color : 0x000000, emissiveIntensity: glow ? 1.6 : 0 }));
  return mats.get(key);
}
const boxGeo = new THREE.BoxGeometry(1, 1, 1);
function box(parent, x, y, z, w, h, d, color, glow = false) {
  const m = new THREE.Mesh(boxGeo, material(color, glow));
  m.position.set(x, y, z); m.scale.set(w, h, d); m.castShadow = !glow; m.receiveShadow = true; parent.add(m); return m;
}
function cylinder(parent, x, y, z, radius, height, color, sides = 10) {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, height, sides), material(color));
  mesh.position.set(x, y, z); mesh.castShadow = true; mesh.receiveShadow = true; parent.add(mesh); return mesh;
}
function textSign(parent, text, x, y, z, width, height, bg, fg, rotation = 0) {
  const canvas = document.createElement('canvas'); canvas.width = 512; canvas.height = Math.round(512 * height / width);
  const ctx = canvas.getContext('2d'); ctx.fillStyle = bg; ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = fg; ctx.lineWidth = 8; ctx.strokeRect(9, 9, 494, canvas.height - 18);
  ctx.fillStyle = fg; ctx.font = `700 ${Math.min(canvas.height * .55, 440 / Math.max(text.length * .6, 1))}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(text, 256, canvas.height * .52, 460);
  const tex = new THREE.CanvasTexture(canvas); tex.colorSpace = THREE.SRGBColorSpace;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(width, height), new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide }));
  m.position.set(x, y, z); m.rotation.y = rotation; parent.add(m); return m;
}
function character(color, hair, kind = '') {
  const group = new THREE.Group();
  // Small, fully modelled characters: body, coat, hair and articulated limbs.
  const torso = box(group, 0, 1.15, 0, .52, .68, .3, color);
  box(group, 0, .82, 0, .48, .16, .31, '#313549');
  const head = box(group, 0, 1.77, 0, .39, .42, .36, '#e7bc9f');
  box(group, 0, 1.97, -.035, .43, .18, .4, hair);
  box(group, 0, 1.8, -.19, .43, .35, .13, hair);
  box(group, -.205, 1.84, -.04, .07, .27, .32, hair);
  box(group, .205, 1.84, -.04, .07, .27, .32, hair);
  box(group, -.09, 1.8, .187, .035, .04, .015, '#332e34');
  box(group, .09, 1.8, .187, .035, .04, .015, '#332e34');
  const legs = [], arms = [];
  for (const side of [-1, 1]) {
    const leg = new THREE.Group(); leg.position.set(side * .15, .8, 0); group.add(leg);
    box(leg, 0, -.29, 0, .19, .58, .23, '#35384b'); box(leg, 0, -.64, .04, .21, .12, .35, '#e1dfd9'); legs.push(leg);
    const arm = new THREE.Group(); arm.position.set(side * .33, 1.42, 0); group.add(arm);
    box(arm, 0, -.23, 0, .15, .43, .22, color); box(arm, 0, -.49, 0, .13, .14, .18, '#e7bc9f'); arms.push(arm);
  }
  if (kind === 'waiting' || kind === 'busy') { arms[1].rotation.x = -0.8; box(arms[1], 0, -.49, .07, .12, .2, .035, '#1c2334'); }
  if (kind === 'cafe') { arms[1].rotation.x = -.7; cylinder(arms[1], 0, -.43, .1, .09, .18, '#f1e5ca'); }
  if (kind === 'tourist') { box(group, 0, 1.05, .23, .28, .2, .17, '#293545'); cylinder(group, 0, 1.05, .36, .065, .05, '#8290a1').rotation.x = Math.PI / 2; }
  if (kind === 'earphones') { box(group, 0, 2.04, 0, .5, .06, .14, '#d8c4e4'); box(group, -.24, 1.84, .01, .08, .2, .2, '#d8c4e4'); box(group, .24, 1.84, .01, .08, .2, .2, '#d8c4e4'); }
  if (kind === 'reader') { arms.forEach(a => a.rotation.x = -.8); box(group, 0, 1.06, .5, .42, .06, .3, '#d6d2b7'); }
  const shadow = new THREE.Mesh(new THREE.CircleGeometry(.48, 20), new THREE.MeshBasicMaterial({ color: '#080b18', transparent: true, opacity: .25, depthWrite: false }));
  shadow.rotation.x = -Math.PI / 2; shadow.position.y = .014; group.add(shadow);
  group.userData = { legs, arms, torso, head }; return group;
}
function animatePerson(mesh, moving, time, seed = 0) {
  const { legs, arms, torso } = mesh.userData;
  const swing = moving ? Math.sin(time * 9 + seed) * .45 : 0;
  legs[0].rotation.x = swing; legs[1].rotation.x = -swing;
  arms[0].rotation.x = -swing * .65;
  torso.position.y = 1.15 + (moving ? Math.abs(Math.sin(time * 9 + seed)) * .025 : Math.sin(time * 2 + seed) * .008);
}
export class CityWorld {
  constructor(container, labels, onSelect, onMove) {
    this.container = container; this.labels = labels; this.onSelect = onSelect; this.onMove = onMove;
    this.scene = new THREE.Scene(); this.scene.background = new THREE.Color('#171d31');
    this.camera = new THREE.PerspectiveCamera(43, innerWidth / innerHeight, .1, 160);
    this.profile = renderProfile(innerWidth, window.matchMedia('(pointer: coarse)').matches, devicePixelRatio);
    this.mobile = this.profile.mobile;
    this.renderer = new THREE.WebGLRenderer({ antialias: !this.mobile, powerPreference: this.mobile ? 'default' : 'high-performance' });
    this.renderer.setPixelRatio(this.profile.pixelRatio); this.renderer.setSize(innerWidth, innerHeight);
    this.renderer.shadowMap.enabled = this.profile.shadows; this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace; this.renderer.toneMapping = THREE.ACESFilmicToneMapping; this.renderer.toneMappingExposure = 1.3;
    container.append(this.renderer.domElement);
    this.ray = new THREE.Raycaster(); this.pointer = new THREE.Vector2(); this.target = new THREE.Vector3(0, 0, 4);
    this.cameraTarget = this.target.clone(); this.yaw = .22; this.distance = 26; this.keys = new Set(); this.destination = null;
    this.player = character('#a1d6c8', '#2c3038'); this.player.position.set(0, 0, 8); this.scene.add(this.player);
    this.playerLabel = this.makeLabel('YOU', 'player-label');
    this.ring = new THREE.Mesh(new THREE.RingGeometry(.62, .68, 48), new THREE.MeshBasicMaterial({ color: '#a5efd0', side: THREE.DoubleSide, transparent: true, opacity: .85, depthWrite: false }));
    this.ring.rotation.x = -Math.PI / 2; this.ring.position.y = .03; this.scene.add(this.ring);
    this.selectionRing = this.ring.clone(); this.selectionRing.material = this.ring.material.clone(); this.selectionRing.visible = false; this.scene.add(this.selectionRing);
    this.marker = this.ring.clone(); this.marker.material = new THREE.MeshBasicMaterial({ color: '#a5efd0', transparent: true, opacity: .5, side: THREE.DoubleSide }); this.marker.visible = false; this.scene.add(this.marker);
    this.registerInput(); this.setMap('kabukicho');
    this.resizeObserver = new ResizeObserver(() => this.resize()); this.resizeObserver.observe(container);
  }
  makeLabel(text, cls = '') { const interactive = !cls.includes('player-label') && !cls.includes('goal-label'); const el = document.createElement(interactive ? 'button' : 'div'); if (!interactive) el.setAttribute('aria-hidden', 'true'); el.className = `npc-label ${cls}`; el.textContent = text; this.labels.append(el); return el; }
  setMap(map) {
    if (this.city) {
      this.scene.remove(this.city);
      const resources = new Set(), sharedMaterials = new Set(mats.values());
      this.city.traverse(o => {
        if (o.geometry && o.geometry !== boxGeo) resources.add(o.geometry);
        if (o.material && !sharedMaterials.has(o.material)) { resources.add(o.material); if (o.material.map) resources.add(o.material.map); }
        if (o.isInstancedMesh) resources.add(o);
        o.shadow?.dispose();
      });
      resources.forEach(resource => resource.dispose());
      this.npcs.forEach(n => n.label?.remove()); this.goalLabel.remove();
    }
    this.map = map; this.city = new THREE.Group(); this.scene.add(this.city); this.selected = null; this.companion = null; this.destination = null; this.marker.visible = false;
    const night = map === 'kabukicho';
    this.scene.background.set(night ? '#141b2d' : '#a4b1bc'); this.scene.fog = new THREE.Fog(night ? '#141b2d' : '#a4b1bc', 35, 88);
    this.city.add(new THREE.HemisphereLight(night ? '#a9bafa' : '#f5ecdc', night ? '#3d344b' : '#737e7b', night ? 2.1 : 2.8));
    const sun = new THREE.DirectionalLight(night ? '#b7c8ff' : '#ffe3ad', night ? 2 : 3.6); sun.position.set(-12, 27, 15); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); Object.assign(sun.shadow.camera, { left: -28, right: 28, top: 30, bottom: -30, far: 85 }); sun.shadow.bias = -.001; this.city.add(sun);
    box(this.city, 0, -.7, 0, 36, 1.2, 64, night ? '#1b2436' : '#7b8589');
    box(this.city, 0, -.07, 0, 17, .18, 62, night ? '#2d3548' : '#a6aaa8');
    // Pavement joints, curb edges and crosswalk create readable movement space.
    for (let z = -30; z <= 30; z += 2) for (let x = -8; x < 8; x += 2) box(this.city, x + 1, .026, z, 1.97, .015, .025, night ? '#41485b' : '#bcc0bc');
    for (let x = -6; x <= 6; x += 1.5) box(this.city, x, .035, 12, .85, .02, 3.7, night ? '#9b9ba8' : '#e4e0cf');
    for (const side of [-1, 1]) {
      box(this.city, side * 8.7, .06, 0, 1.2, .3, 62, night ? '#46495b' : '#b7b8ae');
      box(this.city, side * 8.05, .045, 0, .08, .04, 60, night ? '#b68583' : '#dbcf9b');
      for (let i = 0; i < 9; i++) this.buildBuilding(side, -27 + i * 7, i, night);
      for (let i = 0; i < 7; i++) this.streetLamp(side * 7.4, -23 + i * 8, night);
      for (let i = 0; i < 5; i++) this.planter(side * 7.4, -19 + i * 11, night);
    }
    if (night) this.buildGate(); else this.buildStation();
    this.buildAtmosphere(night);
    this.goal = new THREE.Vector3(-6.1, 0, -22);
    const goalRing = new THREE.Mesh(new THREE.RingGeometry(1.1, 1.25, 48), new THREE.MeshBasicMaterial({ color: '#c6a0fa', side: THREE.DoubleSide, transparent: true, opacity: .75 }));
    goalRing.rotation.x = -Math.PI / 2; goalRing.position.copy(this.goal); goalRing.position.y = .04; this.city.add(goalRing);
    this.goalBeacon = new THREE.Mesh(new THREE.CylinderGeometry(.045, .045, 6, 8), new THREE.MeshBasicMaterial({ color: '#c6a0fa', transparent: true, opacity: .3 })); this.goalBeacon.position.copy(this.goal); this.goalBeacon.position.y = 3; this.city.add(this.goalBeacon);
    this.goalLabel = this.makeLabel('HOTEL LOUNGE ↗', 'goal-label');
    textSign(this.city, 'HOTEL LOUNGE', -10.2, 3, -21.9, 5, 1, '#22263d', '#d3b2f7', Math.PI / 2);
    this.batchScenery();
    const positions = [[-3.4, 4], [3.2, 1], [-4, -5], [1.5, -10], [4.7, 8], [5.5, -7], [-5.5, 15], [3.5, -18]];
    this.npcs = PROFILES.map((profile, i) => {
      const mesh = character(profile.color, profile.hair, profile.id); mesh.position.set(positions[i][0], 0, positions[i][1]); mesh.rotation.y = i % 2 ? Math.PI * .8 : Math.PI * .2; this.city.add(mesh);
      const label = this.makeLabel(profile.traits[0], profile.guarded ? 'guarded' : ''); const n = { profile, mesh, label, home: mesh.position.clone(), phase: i * 1.8, cooldown: 0 };
      mesh.traverse(o => { if (o.isMesh) o.userData.npc = n; }); label.addEventListener('click', e => { e.stopPropagation(); this.onSelect(n); }); return n;
    });
    for (let i = 0; i < (this.mobile ? (night ? 6 : 4) : (night ? 18 : 12)); i++) {
      const mesh = character(['#72778d', '#9b8392', '#b3a184', '#758e8d'][i % 4], '#3b3440');
      mesh.position.set((i % 2 ? 1 : -1) * (1 + (i * 1.7) % 6), 0, -28 + (i * 4.3) % 56); mesh.scale.setScalar(.88 + (i % 3) * .06); this.city.add(mesh);
      this.npcs.push({ mesh, ambient: true, speed: .45 + (i % 4) * .2, direction: i % 2 ? 1 : -1, phase: i });
    }
    this.player.position.set(0, 0, 8); this.player.rotation.y = Math.PI; this.cameraTarget.copy(this.player.position); this.cameraTarget.y = 1; this.resetCamera();
  }
  buildBuilding(side, z, i, night) {
    const w = 5.5 + i % 3, h = 7 + (i * 7 % 13), x = side * (9.7 + w / 2), front = side * 9.65;
    const colors = night ? ['#354058', '#42435b', '#303d50', '#4a3e52'] : ['#a1a8aa', '#b0aaa0', '#81929c', '#b7b6ae'];
    box(this.city, x, h / 2, z, w, h, 6.5, colors[i % 4]);
    box(this.city, x, h + .15, z, w + .25, .3, 6.8, night ? '#596078' : '#c4c6be');
    box(this.city, x, h + .7, z - 1, 1.7, 1, 1.5, night ? '#3c465a' : '#8d989c');
    for (let floor = 4; floor < h - 1; floor += 2.2) for (let col = -1; col <= 1; col++) {
      const lit = (i + col + Math.round(floor)) % 4 !== 0;
      box(this.city, front, floor, z + col * 1.7, .05, 1.1, 1, lit ? (night ? ['#c7b993', '#7e9aa6', '#9e82a2'][i % 3] : '#5c7483') : '#273345', night && lit);
    }
    box(this.city, front - side * .04, 1.5, z, .12, 2.6, 5.6, '#152438');
    for (let p = -1; p <= 1; p++) box(this.city, front - side * .12, 1.4, z + p * 1.65, .06, 2.2, .06, '#a8b2bc');
    box(this.city, front - side * .6, 3.1, z, 1.5, .22, 6.2, night ? ['#a75472', '#458889', '#98764e'][i % 3] : '#5f7a78');
    const signColor = night ? ['#f5a5c7', '#8ee2d9', '#f7c982', '#a8b9ff'][i % 4] : '#f0e6d1';
    textSign(this.city, (night ? ['喫茶 月灯', '酒場', 'KARAOKE', '夜喫茶', 'RAMEN', 'カフェ 青', 'TOKYO', 'DINING', 'LOUNGE'] : ['COFFEE', 'BOOKS', '名駅商店', 'CAFE', 'KIOSK', 'FLOWERS', 'DINING', '駅前喫茶', 'LOUNGE'])[i], front - side * .13, 3.8, z, 5.2, .85, night ? '#273047' : '#445860', signColor, -side * Math.PI / 2);
    if (night) {
      box(this.city, front - side * .2, 2.9, z, .06, .05, 5.8, signColor, true);
      if (i % 2 === 0) {
        box(this.city, front - side * .9, 7, z + 2.4, .35, 5.6, 1.05, '#322a48');
        for (let p = 0; p < 4; p++) textSign(this.city, ['カ', 'ラ', 'オ', 'ケ'][p], front - side * 1.1, 8.8 - p * 1.2, z + 2.4, .9, 1, '#302637', signColor, -side * Math.PI / 2);
      }
      const spill = new THREE.Mesh(new THREE.PlaneGeometry(3.3, 5.2), new THREE.MeshBasicMaterial({ color: signColor, transparent: true, opacity: .07, depthWrite: false }));
      spill.rotation.x = -Math.PI / 2; spill.position.set(side * 7, .045, z); this.city.add(spill);
    }
    // A-board and vending machine.
    if (i % 3 === 1) { box(this.city, side * 7.7, .7, z + 2, .55, 1.4, .8, night ? '#75999c' : '#bc7067'); box(this.city, side * 7.7 - side * .29, .9, z + 2, .025, .7, .64, '#cbe3dd', night); }
  }
  buildAtmosphere(night) {
    // A shared soft texture gives light pools feathered edges without extra lights.
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 128;
    const ctx = canvas.getContext('2d');
    const gradient = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    gradient.addColorStop(0, '#ffffff'); gradient.addColorStop(.3, '#ffffff88'); gradient.addColorStop(1, '#ffffff00');
    ctx.fillStyle = gradient; ctx.fillRect(0, 0, 128, 128);
    const texture = new THREE.CanvasTexture(canvas);
    const glow = (x, z, w, d, color, opacity) => {
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshBasicMaterial({ map: texture, color, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending }));
      mesh.rotation.x = -Math.PI / 2; mesh.position.set(x, .065, z); this.city.add(mesh);
    };
    // Narrow joints, drains and utility covers break up the broad paved surface.
    for (let z = -29; z < 30; z += 2) {
      for (let x = -6; x <= 6; x += 2) box(this.city, x, .038, z + 1, .018, .012, 1.96, night ? '#252c3d' : '#929a98');
      for (const side of [-1, 1]) {
        box(this.city, side * 6.95, .04, z, .25, .025, .65, night ? '#192231' : '#737f83');
        for (let i = 0; i < 4; i++) box(this.city, side * 6.95, .057, z - .24 + i * .16, .21, .008, .025, '#45515c');
      }
    }
    for (const z of [-19, -2, 19]) {
      const cover = cylinder(this.city, 2, .035, z, .38, .025, night ? '#485061' : '#87928e', 24);
      for (let i = -1; i <= 1; i++) box(this.city, cover.position.x, .053, z + i * .15, .48, .01, .022, night ? '#282e3c' : '#657471');
    }
    // Distant towers stay outside the playable street and frame its vanishing point.
    for (const side of [-1, 1]) for (let i = 0; i < 6; i++) {
      const x = side * (18 + i * 4), h = 16 + (i * 7 % 17), z = -37 - (i % 3) * 4;
      box(this.city, x, h / 2, z, 3.4, h, 4, night ? '#222c43' : '#83959f');
      for (let y = 3; y < h - 1; y += 2.4) for (const offset of [-.8, .8]) {
        if ((i + Math.round(y) + Math.round(offset * 5)) % 3) box(this.city, x + offset, y, z + 2.02, .5, .75, .03, night ? '#9daebd' : '#adbdc5', night);
      }
    }
    for (const side of [-1, 1]) {
      for (let i = 0; i < 6; i++) {
        const z = -23 + i * 9;
        if (night) {
          const color = ['#ef82b0', '#59c9db', '#eab169'][(i + (side > 0 ? 1 : 0)) % 3];
          glow(side * 6.9, z, 6, 9, color, .28);
          // Broken, elongated highlights suggest damp paving below the signs.
          for (let j = 0; j < 6; j++) {
            const reflection = box(this.city, side * (5.2 + (j % 3) * .48), .052, z - 1.8 + j * .65, .05 + (j % 2) * .09, .008, .4 + (j % 3) * .22, color);
            reflection.material = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: .12 + (j % 3) * .045, depthWrite: false });
          }
          if (i % 2 === 0) {
            const sign = textSign(this.city, ['本日 OPEN', '夜喫茶 ☕', 'DINING →'][i / 2], side * 7.1, .85, z, .95, 1.35, '#233043', color, -side * .35);
            for (const offset of [-.42, .42]) box(this.city, side * 7.1 + offset, .4, z, .045, .8, .08, '#566271');
            sign.castShadow = true;
          }
        } else {
          // Trees and café terraces make the station plaza feel open and lived in.
          const x = side * 7.5;
          cylinder(this.city, x, .22, z, .6, .44, '#b2afa0', 12);
          cylinder(this.city, x, 1.65, z, .13, 2.9, '#75634f', 8);
          for (let j = 0; j < 3; j++) {
            const crown = new THREE.Mesh(new THREE.IcosahedronGeometry(1.05, 1), material(['#73966e', '#8da578', '#628a73'][j]));
            crown.position.set(x + (j - 1) * .37, 3.05 + (j % 2) * .65, z + (j - 1) * .25); crown.castShadow = true; this.city.add(crown);
          }
          if (i % 2 === 0) {
            const umbrella = new THREE.Mesh(new THREE.ConeGeometry(1.25, .48, 8), material(i === 2 ? '#b38c70' : '#d3c6a3'));
            umbrella.position.set(side * 7.4, 2.65, z + 3); umbrella.castShadow = true; this.city.add(umbrella);
            cylinder(this.city, side * 7.4, 1.3, z + 3, .045, 2.6, '#6a716e');
            cylinder(this.city, side * 7.4, .88, z + 3, .58, .1, '#b09a7e', 16);
            cylinder(this.city, side * 7.4, .44, z + 3, .07, .88, '#606e71');
          }
        }
      }
    }
    if (night) {
      const moon = new THREE.Mesh(new THREE.SphereGeometry(1.05, 20, 12), new THREE.MeshBasicMaterial({ color: '#e8dfc9' }));
      moon.position.set(8, 28, -53); this.city.add(moon);
    } else {
      textSign(this.city, '駅前広場  /  STATION SQUARE', 0, .075, 18, 4.5, .65, '#a6aaa8', '#e3e3d1', 0).rotation.x = -Math.PI / 2;
    }
  }
  streetLamp(x, z, night) {
    cylinder(this.city, x, 2.2, z, .075, 4.4, '#596373', 8); box(this.city, x, 4.4, z, .55, .15, .6, '#adb0a8'); box(this.city, x, 4.3, z, .43, .06, .45, '#f5d59f', true);
    const patch = new THREE.Mesh(new THREE.CircleGeometry(1.65, 24), new THREE.MeshBasicMaterial({ color: '#edc99f', transparent: true, opacity: night ? .055 : .025, depthWrite: false })); patch.rotation.x = -Math.PI / 2; patch.position.set(x, .04, z); this.city.add(patch);
  }
  planter(x, z, night) {
    box(this.city, x, .3, z, .9, .6, 1.7, night ? '#5c5b69' : '#a3a59c');
    for (let i = 0; i < 3; i++) { const bush = new THREE.Mesh(new THREE.IcosahedronGeometry(.6, 0), material(night ? '#3e6860' : '#658a6e')); bush.position.set(x, .9, z - .5 + i * .5); bush.scale.y = 1.4; bush.castShadow = true; this.city.add(bush); }
    box(this.city, x - Math.sign(x) * .3, .6, z + 2, .8, .12, 2, '#736759'); for (const d of [-.7, .7]) box(this.city, x, .3, z + 2 + d, .1, .6, .12, '#53616b');
  }
  buildGate() {
    for (const x of [-7, 7]) { box(this.city, x, 4.4, -15, .35, 8.8, .55, '#9a3f59'); box(this.city, x, 4.4, -14.68, .09, 8.8, .04, '#f5a7ba', true); }
    box(this.city, 0, 8.6, -15, 14.5, 1.2, .6, '#723447');
    textSign(this.city, '歌 舞 伎 町', 0, 8.6, -14.67, 10, 1, '#73374d', '#ffd1cc');
    box(this.city, 0, 9.3, -15, 15, .15, .7, '#ee8d9e', true);
  }
  buildStation() {
    box(this.city, 0, 5, -30, 29, 10, 6, '#b0b6b6');
    box(this.city, 0, 2.5, -26.9, 15, 5, .2, '#344956');
    for (let i = -6; i <= 6; i += 2) box(this.city, i, 2.5, -26.7, .1, 5, .2, '#b2bbb8');
    box(this.city, 0, 6, -26, 22, .3, 3, '#d1d3c7');
    textSign(this.city, 'NAGOYA STATION  /  名古屋駅', 0, 7.6, -26.9, 19, 1.5, '#455c62', '#edf4de');
    // The meeting-point golden clock.
    cylinder(this.city, 0, 1.5, -12, .24, 3, '#b49a5d'); cylinder(this.city, 0, .15, -12, 1, .3, '#b49a5d');
    const clock = new THREE.Mesh(new THREE.CylinderGeometry(.82, .82, .25, 32), material('#dac286')); clock.rotation.x = Math.PI / 2; clock.position.set(0, 3.4, -12); this.city.add(clock);
    textSign(this.city, '◷', 0, 3.4, -11.85, 1.3, 1.3, '#e3d9b9', '#554c37');
    textSign(this.city, '金時計', 0, 2.3, -11.7, 1.2, .4, '#806b45', '#f6e3ac');
    // Central tactile paving, with a gap around the clock.
    for (let z = -24; z < 29; z += 1) if (Math.abs(z + 12) > 1.5) box(this.city, 0, .04, z, .45, .035, .92, '#c4ab62');
  }
  // Static scenery shares geometry/material draw calls; animated people stay separate.
  batchScenery() {
    const batches = new Map();
    for (const mesh of [...this.city.children]) {
      if (mesh.geometry !== boxGeo) continue;
      const key = `${mesh.material.uuid}-${mesh.castShadow}`;
      if (!batches.has(key)) batches.set(key, []);
      batches.get(key).push(mesh);
    }
    for (const meshes of batches.values()) {
      const batch = new THREE.InstancedMesh(boxGeo, meshes[0].material, meshes.length);
      batch.castShadow = meshes[0].castShadow; batch.receiveShadow = true;
      meshes.forEach((mesh, i) => { mesh.updateMatrix(); batch.setMatrixAt(i, mesh.matrix); this.city.remove(mesh); });
      batch.computeBoundingSphere(); this.city.add(batch);
    }
  }
  registerInput() { this.resetInput = bindWorldInput(this); }
  zoom(amount) { this.distance = clamp(this.distance + amount, 15, 43); }
  walkTo(pos) {
    this.destination = new THREE.Vector3(clamp(pos.x, -6.7, 6.7), 0, clamp(pos.z, -24.5, 27.5));
    this.marker.position.copy(this.destination); this.marker.position.y = .04; this.marker.visible = true;
  }
  resetCamera() { this.yaw = .23; this.distance = this.camera.aspect < .75 ? 32 : this.mobile ? 23 : 26; }
  select(n) { this.selected = n; this.npcs.filter(p => !p.ambient).forEach(p => p.label.classList.toggle('selected', p === n)); }
  resize() {
    const w = this.container.clientWidth, h = this.container.clientHeight;
    if (!w || !h) return;
    const wasPortrait = this.camera.aspect < .75;
    this.camera.aspect = w / h; this.camera.updateProjectionMatrix(); this.renderer.setSize(w, h);
    // Browser address-bar resizing must preserve the chosen angle and zoom.
    if (this.mobile && wasPortrait !== (this.camera.aspect < .75)) this.distance = this.camera.aspect < .75 ? 32 : 23;
  }
  distanceTo(n) { return this.player.position.distanceTo(n.mesh.position); }
  placeLabel(el, position, offset = 2.7) {
    const p = position.clone(); p.y += offset; p.project(this.camera);
    const visible = p.z > -1 && p.z < 1 && Math.abs(p.x) < .99 && Math.abs(p.y) < .95;
    el.style.display = visible ? '' : 'none'; el.style.left = `${(p.x * .5 + .5) * this.container.clientWidth}px`; el.style.top = `${(-p.y * .5 + .5) * this.container.clientHeight}px`;
  }
  update(dt, time) {
    const previous = this.player.position.clone();
    if (!this.paused) {
      let x = 0, z = 0;
      if (this.keys.has('w') || this.keys.has('arrowup')) z--;
      if (this.keys.has('s') || this.keys.has('arrowdown')) z++;
      if (this.keys.has('a') || this.keys.has('arrowleft')) x--;
      if (this.keys.has('d') || this.keys.has('arrowright')) x++;
      let direction = new THREE.Vector3();
      if (x || z) { direction.set(x, 0, z).normalize().applyAxisAngle(new THREE.Vector3(0, 1, 0), this.yaw); this.destination = null; this.marker.visible = false; }
      else if (this.destination) { direction.subVectors(this.destination, this.player.position); if (direction.length() < .15) { this.destination = null; this.marker.visible = false; direction.set(0, 0, 0); } else direction.normalize(); }
      if (direction.lengthSq()) { this.player.position.addScaledVector(direction, 4.6 * dt); this.player.rotation.y = Math.atan2(direction.x, direction.z); }
      this.player.position.x = clamp(this.player.position.x, -6.7, 6.7); this.player.position.z = clamp(this.player.position.z, -24.5, 27.5);
      if (this.map === 'nagoya' && Math.hypot(this.player.position.x, this.player.position.z + 12) < 1.1) { this.player.position.copy(previous); this.destination = null; this.marker.visible = false; }
    }
    animatePerson(this.player, previous.distanceToSquared(this.player.position) > .00001, time);
    for (const n of this.npcs) {
      let moving = false;
      if (!this.paused && n !== this.selected) {
        if (n === this.companion) {
          const target = this.player.position.clone().add(new THREE.Vector3(1, 0, 1)); const dir = target.sub(n.mesh.position); if (dir.length() > 1.1) { dir.normalize(); n.mesh.position.addScaledVector(dir, 4.9 * dt); n.mesh.rotation.y = Math.atan2(dir.x, dir.z); moving = true; }
        } else if (n.ambient) { n.mesh.position.z += n.speed * n.direction * dt; n.mesh.rotation.y = n.direction === 1 ? 0 : Math.PI; if (Math.abs(n.mesh.position.z) > 29) n.mesh.position.z *= -.97; moving = true; }
        else if (n.profile.speed > .2) { const delta = Math.sin(time * .15 + n.phase); n.mesh.position.z = n.home.z + delta * (n.profile.guarded ? 3 : 1.4); n.mesh.rotation.y = Math.cos(time * .15 + n.phase) > 0 ? 0 : Math.PI; moving = true; }
      }
      animatePerson(n.mesh, moving, time, n.phase);
      if (!n.ambient) {
        n.label.style.opacity = n === this.companion || n.cooldown > time ? '.25' : '1';
        if (this.mobile && this.distanceTo(n) > 14 && n !== this.selected) n.label.style.display = 'none';
        else this.placeLabel(n.label, n.mesh.position);
      }
    }
    this.ring.position.copy(this.player.position); this.ring.position.y = .035;
    this.selectionRing.visible = !!this.selected; if (this.selected) { this.selectionRing.position.copy(this.selected.mesh.position); this.selectionRing.position.y = .04; }
    this.goalBeacon.visible = !!this.companion; this.goalLabel.style.opacity = this.companion ? '1' : '.7';
    this.cameraTarget.lerp(this.player.position.clone().add(new THREE.Vector3(0, 1.1, -2)), 1 - Math.exp(-dt * 3));
    const horizontal = this.distance * .82;
    const desired = this.cameraTarget.clone().add(new THREE.Vector3(Math.sin(this.yaw) * horizontal, this.distance * .65, Math.cos(this.yaw) * horizontal));
    this.camera.position.lerp(desired, 1 - Math.exp(-dt * 5)); this.camera.lookAt(this.cameraTarget);
    this.camera.updateMatrixWorld(); this.placeLabel(this.playerLabel, this.player.position, 2.8); this.placeLabel(this.goalLabel, this.goal, 2.2);
    this.renderer.render(this.scene, this.camera);
  }
  drawMinimap(ctx) {
    const s = 180, point = p => [(p.x + 12) / 24 * s, (p.z + 31) / 62 * s];
    ctx.clearRect(0, 0, s, s); ctx.fillStyle = '#121a28'; ctx.fillRect(0, 0, s, s);
    ctx.fillStyle = '#293243'; ctx.fillRect(36, 0, 108, 180);
    ctx.strokeStyle = '#3a4352'; ctx.lineWidth = 1;
    for (let y = 0; y < 180; y += 21) { ctx.beginPath(); ctx.moveTo(36, y); ctx.lineTo(144, y); ctx.stroke(); }
    ctx.strokeStyle = '#7b696e'; ctx.strokeRect(34, 0, 112, 180);
    ctx.setLineDash([3, 4]); ctx.strokeStyle = '#60677a'; ctx.beginPath(); ctx.moveTo(90, 0); ctx.lineTo(90, 180); ctx.stroke(); ctx.setLineDash([]);
    for (const n of this.npcs) { const [x, y] = point(n.mesh.position); ctx.beginPath(); ctx.arc(x, y, n.ambient ? 1.3 : 2.4, 0, Math.PI * 2); ctx.fillStyle = n === this.selected ? '#a2e8c7' : n.ambient ? '#596477' : n.profile.guarded ? '#9295ae' : '#e4b48d'; ctx.fill(); }
    const [gx, gy] = point(this.goal); ctx.fillStyle = '#c5a3f2'; ctx.fillRect(gx - 3, gy - 3, 6, 6);
    const [px, py] = point(this.player.position); ctx.fillStyle = '#a2e8c7'; ctx.shadowBlur = 9; ctx.shadowColor = '#a2e8c7'; ctx.beginPath(); ctx.arc(px, py, 3.5, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0;
    ctx.strokeStyle = '#a2e8c755'; ctx.beginPath(); ctx.arc(px, py, 8, 0, Math.PI * 2); ctx.stroke();
  }
}

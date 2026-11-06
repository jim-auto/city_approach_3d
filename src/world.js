import * as THREE from 'three';
import { PROFILES, clamp } from './game.js';
import { bindWorldInput, renderProfile } from './input.js';
import { createCharacter, animateCharacter, isCharacterResource } from './characters.js';
import { mats, boxGeo, material, box, cylinder, textSign } from './scenery.js';
import { buildNagoyaConcourse, buildKabukichoLandmarks, MAP_LAYOUTS } from './locations.js';
import { planPath, resolveDestination, isWalkable } from './navigation.js';

export class CityWorld {
  constructor(container, labels, onSelect, onMove) {
    this.container = container; this.labels = labels; this.onSelect = onSelect; this.onMove = onMove;
    this.scene = new THREE.Scene(); this.scene.background = new THREE.Color('#171d31');
    this.camera = new THREE.PerspectiveCamera(43, innerWidth / innerHeight, .1, 160);
    this.profile = renderProfile(innerWidth, window.matchMedia('(pointer: coarse)').matches, devicePixelRatio);
    this.mobile = this.profile.mobile; this.portraits = new Map();
    this.renderer = new THREE.WebGLRenderer({ antialias: !this.mobile, powerPreference: this.mobile ? 'default' : 'high-performance' });
    this.renderer.setPixelRatio(this.profile.pixelRatio); this.renderer.setSize(innerWidth, innerHeight);
    this.renderer.shadowMap.enabled = this.profile.shadows; this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace; this.renderer.toneMapping = THREE.ACESFilmicToneMapping; this.renderer.toneMappingExposure = 1.3;
    container.append(this.renderer.domElement);
    this.ray = new THREE.Raycaster(); this.pointer = new THREE.Vector2(); this.target = new THREE.Vector3(0, 0, 4);
    this.cameraTarget = this.target.clone(); this.yaw = .22; this.distance = 26; this.keys = new Set(); this.destination = null;
    this.player = createCharacter('#a1d6c8', '#2c3038', 'player'); this.player.position.set(0, 0, 8); this.scene.add(this.player);
    this.playerLabel = this.makeLabel('YOU', 'player-label');
    this.ring = new THREE.Mesh(new THREE.RingGeometry(.62, .68, 48), new THREE.MeshBasicMaterial({ color: '#a5efd0', side: THREE.DoubleSide, transparent: true, opacity: .85, depthWrite: false }));
    this.ring.rotation.x = -Math.PI / 2; this.ring.position.y = .03; this.scene.add(this.ring);
    this.selectionRing = this.ring.clone(); this.selectionRing.material = this.ring.material.clone(); this.selectionRing.visible = false; this.scene.add(this.selectionRing);
    this.marker = this.ring.clone(); this.marker.material = new THREE.MeshBasicMaterial({ color: '#a5efd0', transparent: true, opacity: .5, side: THREE.DoubleSide }); this.marker.visible = false; this.scene.add(this.marker);
    this.registerInput(); this.setMap('kabukicho');
    this.resizeObserver = new ResizeObserver(() => this.resize()); this.resizeObserver.observe(container);
  }
  makeLabel(text, cls = '') { const interactive = !cls.includes('player-label') && !cls.includes('goal-label') && !cls.includes('landmark-label'); const el = document.createElement(interactive ? 'button' : 'div'); if (!interactive) el.setAttribute('aria-hidden', 'true'); el.className = `npc-label ${cls}`; el.textContent = text; this.labels.append(el); return el; }
  setMap(map) {
    if (this.city) {
      this.scene.remove(this.city);
      const resources = new Set(), sharedMaterials = new Set(mats.values());
      this.city.traverse(o => {
        if (o.geometry && o.geometry !== boxGeo && !isCharacterResource(o.geometry)) resources.add(o.geometry);
        if (o.material && !sharedMaterials.has(o.material) && !isCharacterResource(o.material)) { resources.add(o.material); if (o.material.map) resources.add(o.material.map); }
        if (o.isInstancedMesh) resources.add(o);
        o.shadow?.dispose();
      });
      resources.forEach(resource => resource.dispose());
      this.npcs.forEach(n => n.label?.remove()); this.goalLabel.remove(); (this.landmarkLabels || []).forEach(item => item.el.remove());
    }
    this.map = map; this.city = new THREE.Group(); this.scene.add(this.city); this.selected = null; this.companion = null; this.destination = null; this.marker.visible = false;
    this.layout = MAP_LAYOUTS[map]; this.waypoints = [];
    const night = map === 'kabukicho';
    this.scene.background.set(night ? '#141b2d' : '#b4bdbb'); this.scene.fog = new THREE.Fog(night ? '#141b2d' : '#b4bdbb', night ? 42 : 48, 100);
    this.city.add(new THREE.HemisphereLight(night ? '#a9bafa' : '#f5ecdc', night ? '#3d344b' : '#737e7b', night ? 2.1 : 2.8));
    const sun = new THREE.DirectionalLight(night ? '#b7c8ff' : '#ffe3ad', night ? 2 : 3.6); sun.position.set(-12, 27, 15); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); Object.assign(sun.shadow.camera, { left: -28, right: 28, top: 30, bottom: -30, far: 85 }); sun.shadow.bias = -.001; this.city.add(sun);
    if (night) {
      box(this.city, 0, -.7, 0, 47, 1.2, 78, '#1b2436');
      box(this.city, 0, -.07, 0, 17, .18, 62, '#2d3548');
      for (let z = -30; z <= 30; z += 2) for (let x = -8; x < 8; x += 2) box(this.city, x + 1, .026, z, 1.97, .015, .025, '#41485b');
      for (const side of [-1, 1]) {
        box(this.city, side * 8.7, .06, 4, 1.2, .3, 52, '#46495b');
        box(this.city, side * 8.05, .045, 4, .08, .04, 52, '#b68583');
        for (let i = 0; i < 7; i++) this.buildBuilding(side, -17 + i * 7, i, true);
        for (let i = 0; i < 6; i++) this.streetLamp(side * 7.4, -16 + i * 8, true);
        for (let i = 0; i < 4; i++) this.planter(side * 7.4, -13 + i * 11, true);
      }
      this.buildAtmosphere(true); buildKabukichoLandmarks(this.city);
    } else buildNagoyaConcourse(this.city);
    this.goal = new THREE.Vector3(this.layout.goal[0], 0, this.layout.goal[1]);
    const goalRing = new THREE.Mesh(new THREE.RingGeometry(1.1, 1.25, 48), new THREE.MeshBasicMaterial({ color: '#c6a0fa', side: THREE.DoubleSide, transparent: true, opacity: .75 }));
    goalRing.rotation.x = -Math.PI / 2; goalRing.position.copy(this.goal); goalRing.position.y = .04; this.city.add(goalRing);
    this.goalBeacon = new THREE.Mesh(new THREE.CylinderGeometry(.045, .045, 6, 8), new THREE.MeshBasicMaterial({ color: '#c6a0fa', transparent: true, opacity: .3 })); this.goalBeacon.position.copy(this.goal); this.goalBeacon.position.y = 3; this.city.add(this.goalBeacon);
    this.goalLabel = this.makeLabel(this.layout.goalLabel, 'goal-label');
    this.landmarkLabels = this.layout.landmarks.slice(0, 2).map(item => ({ ...item, el: this.makeLabel(item.name, `landmark-label landmark-${item.id}`) }));
    this.batchScenery();
    const positions = this.layout.people;
    this.npcs = PROFILES.map((profile, i) => {
      const mesh = createCharacter(profile.color, profile.hair, profile.id); mesh.position.set(positions[i][0], 0, positions[i][1]); mesh.rotation.y = i % 2 ? Math.PI * .8 : Math.PI * .2; this.city.add(mesh);
      const label = this.makeLabel(profile.traits[0], profile.guarded ? 'guarded' : ''); const n = { profile, mesh, label, home: mesh.position.clone(), phase: i * 1.8, cooldown: 0 };
      mesh.traverse(o => { if (o.isMesh) o.userData.npc = n; }); label.addEventListener('click', e => { e.stopPropagation(); this.onSelect(n); }); return n;
    });
    for (let i = 0; i < (this.mobile ? (night ? 6 : 4) : (night ? 18 : 12)); i++) {
      const mesh = createCharacter(['#72778d', '#9b8392', '#b3a184', '#758e8d'][i % 4], '#3b3440', PROFILES[i % PROFILES.length].id, { detailed: false });
      mesh.position.set((i % 2 ? 1 : -1) * (2.7 + (i * .7) % 3.5), 0, -28 + (i * 4.3) % 56); mesh.scale.setScalar(.88 + (i % 3) * .06); this.city.add(mesh);
      this.npcs.push({ mesh, ambient: true, speed: .45 + (i % 4) * .2, direction: i % 2 ? 1 : -1, phase: i });
    }
    this.player.position.set(this.layout.start[0], 0, this.layout.start[1]); this.player.rotation.y = Math.PI; this.cameraTarget.copy(this.player.position); this.cameraTarget.y = 1; this.resetCamera();
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
  // Static scenery shares geometry/material draw calls; animated people stay separate.
  batchScenery() {
    const batches = new Map();
    this.city.updateMatrixWorld(true);
    const meshesToBatch = []; this.city.traverse(mesh => { if (mesh.geometry === boxGeo) meshesToBatch.push(mesh); });
    const inverse = this.city.matrixWorld.clone().invert();
    for (const mesh of meshesToBatch) {
      const key = `${mesh.material.uuid}-${mesh.castShadow}`;
      if (!batches.has(key)) batches.set(key, []);
      batches.get(key).push(mesh);
    }
    for (const meshes of batches.values()) {
      const batch = new THREE.InstancedMesh(boxGeo, meshes[0].material, meshes.length);
      batch.castShadow = meshes[0].castShadow; batch.receiveShadow = true;
      meshes.forEach((mesh, i) => { batch.setMatrixAt(i, new THREE.Matrix4().multiplyMatrices(inverse, mesh.matrixWorld)); mesh.parent.remove(mesh); });
      batch.computeBoundingSphere(); this.city.add(batch);
    }
  }
  registerInput() { this.resetInput = bindWorldInput(this); }
  zoom(amount) { this.distance = clamp(this.distance + amount, 15, 43); }
  walkTo(pos) {
    const path = planPath(this.player.position, pos, this.layout);
    this.waypoints = path.map(p => new THREE.Vector3(p.x, 0, p.z));
    this.destination = this.waypoints.shift() || null;
    if (path.length) { const end = path.at(-1); this.marker.position.set(end.x, .04, end.z); }
    this.marker.visible = !!path.length;
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
  portrait(n) {
    const { profile } = n;
    if (this.portraits.has(profile.id)) return this.portraits.get(profile.id);
    const size = 192, target = new THREE.WebGLRenderTarget(size, size); target.texture.colorSpace = THREE.SRGBColorSpace;
    const scene = new THREE.Scene(); scene.background = new THREE.Color('#34445a');
    const person = createCharacter(profile.color, profile.hair, profile.id);
    person.rotation.y = -.18; scene.add(person);
    scene.add(new THREE.HemisphereLight('#fff4e4', '#66768f', 2.5));
    const key = new THREE.DirectionalLight('#fff0dc', 3); key.position.set(-2, 4, 3); scene.add(key);
    const camera = new THREE.PerspectiveCamera(31, 1, .1, 12);
    camera.position.set(.25, 1.94, 1.95); camera.lookAt(0, 1.78, 0);
    const previous = this.renderer.getRenderTarget();
    try {
      this.renderer.setRenderTarget(target); this.renderer.render(scene, camera);
      const pixels = new Uint8Array(size * size * 4); this.renderer.readRenderTargetPixels(target, 0, 0, size, size, pixels);
      const canvas = document.createElement('canvas'); canvas.width = canvas.height = size;
      const ctx = canvas.getContext('2d'), data = ctx.createImageData(size, size);
      for (let y = 0; y < size; y++) data.data.set(pixels.subarray((size - 1 - y) * size * 4, (size - y) * size * 4), y * size * 4);
      ctx.putImageData(data, 0, 0);
      const image = canvas.toDataURL('image/png'); this.portraits.set(profile.id, image); return image;
    } finally { this.renderer.setRenderTarget(previous); target.dispose(); }
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
      const stick = this.stick || { x: 0, y: 0 };
      if (x || z || stick.x || stick.y) {
        if (x || z) direction.set(x, 0, z).normalize();
        else direction.set(stick.x, 0, stick.y);
        direction.applyAxisAngle(new THREE.Vector3(0, 1, 0), this.yaw); this.destination = null; this.waypoints = []; this.marker.visible = false; }
      else if (this.destination) { direction.subVectors(this.destination, this.player.position); if (direction.length() < .15) { this.destination = this.waypoints.shift() || null; this.marker.visible = !!this.destination; direction.set(0, 0, 0); } else direction.normalize(); }
      if (direction.lengthSq()) { this.player.position.addScaledVector(direction, 4.6 * dt); this.player.rotation.y = Math.atan2(direction.x, direction.z); }
      const b = this.layout.bounds;
      this.player.position.x = clamp(this.player.position.x, b.minX, b.maxX); this.player.position.z = clamp(this.player.position.z, b.minZ, b.maxZ);
      if (!isWalkable(this.player.position, this.layout)) {
        const next = this.player.position.clone(); this.player.position.copy(previous);
        if (isWalkable({ x: next.x, z: previous.z }, this.layout)) this.player.position.x = next.x;
        else if (isWalkable({ x: previous.x, z: next.z }, this.layout)) this.player.position.z = next.z;
      }
    }
    animateCharacter(this.player, previous.distanceToSquared(this.player.position) > .00001, time);
    for (const n of this.npcs) {
      let moving = false;
      if (!this.paused && n !== this.selected) {
        if (n === this.companion) {
          const follow = resolveDestination(this.player.position.clone().add(new THREE.Vector3(1, 0, 1)), this.layout);
          const route = planPath(n.mesh.position, follow, this.layout);
          const target = route.length ? new THREE.Vector3(route[0].x, 0, route[0].z) : n.mesh.position.clone(); const dir = target.sub(n.mesh.position); if (dir.length() > (route.length > 1 ? .12 : 1.1)) { dir.normalize(); n.mesh.position.addScaledVector(dir, 4.9 * dt); n.mesh.rotation.y = Math.atan2(dir.x, dir.z); moving = true; }
        } else if (n.ambient) { n.mesh.position.z += n.speed * n.direction * dt; n.mesh.rotation.y = n.direction === 1 ? 0 : Math.PI; if (Math.abs(n.mesh.position.z) > 29) n.mesh.position.z *= -.97; moving = true; }
        else if (n.profile.speed > .2) { const delta = Math.sin(time * .15 + n.phase); n.mesh.position.z = n.home.z + delta * (n.profile.guarded ? 3 : 1.4); n.mesh.rotation.y = Math.cos(time * .15 + n.phase) > 0 ? 0 : Math.PI; moving = true; }
      }
      animateCharacter(n.mesh, moving, time, n.phase);
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
    for (const item of this.landmarkLabels) {
      this.placeLabel(item.el, new THREE.Vector3(item.x, 0, item.z), this.map === 'nagoya' ? (item.id === 'gold-clock' ? 5.8 : 4.4) : 11.7);
    }
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
    ctx.font = '9px sans-serif'; ctx.textAlign = 'center';
    for (const item of this.layout.landmarks) {
      const [x, y] = point(item); ctx.fillStyle = item.color; ctx.beginPath(); ctx.arc(x, y, 3.5, 0, Math.PI * 2); ctx.fill();
      if (this.map === 'nagoya' && item.id.includes('clock')) ctx.fillText(item.id === 'gold-clock' ? '金' : '銀', x + 13, y + 3);
      if (item.id === 'toho-cinemas') ctx.fillText('TOHO', x, y + 12);
    }
    const [gx, gy] = point(this.goal); ctx.fillStyle = '#c5a3f2'; ctx.fillRect(gx - 3, gy - 3, 6, 6);
    const [px, py] = point(this.player.position); ctx.fillStyle = '#a2e8c7'; ctx.shadowBlur = 9; ctx.shadowColor = '#a2e8c7'; ctx.beginPath(); ctx.arc(px, py, 3.5, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0;
    ctx.strokeStyle = '#a2e8c755'; ctx.beginPath(); ctx.arc(px, py, 8, 0, Math.PI * 2); ctx.stroke();
  }
}

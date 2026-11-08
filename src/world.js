import { crowdSpawns, visibleCrowd } from './crowd.js';
import { createChallengeEffects, updateChallengeEffects } from './challenge-effects.js';
import { REWARDS } from './challenge.js';
import { disposeCharacterSkeletons } from './authored-characters.js';
import { cameraView } from './camera.js';
import { STREET_PROFILES } from './street-encounters.js';
import * as THREE from 'three';
import { ACTIONS, animateAction } from './actions.js';
import { PROFILES, clamp } from './game.js';
import { bindWorldInput, renderProfile } from './input.js';
import { createCharacter, animateCharacter, isCharacterResource, setCharacterOutfit } from './characters.js';
import { mats, boxGeo } from './scenery.js';
import { buildNagoyaConcourse, buildKabukichoLandmarks, MAP_LAYOUTS } from './locations.js';
import { planPath, resolveDestination, isWalkable, segmentClear } from './navigation.js';

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
    this.player = createCharacter('#303544', '#28232c', 'player'); this.player.position.set(0, 0, 8); this.scene.add(this.player);
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
      disposeCharacterSkeletons(this.city);
      const resources = new Set(), sharedMaterials = new Set(mats.values());
      this.city.traverse(o => {
        if (o.geometry && o.geometry !== boxGeo && !isCharacterResource(o.geometry)) resources.add(o.geometry);
        for (const material of [o.material].flat().filter(Boolean)) if (!sharedMaterials.has(material) && !isCharacterResource(material)) { resources.add(material); if (material.map) resources.add(material.map); }
        if (o.isInstancedMesh) resources.add(o);
        o.shadow?.dispose();
      });
      resources.forEach(resource => resource.dispose());
      this.npcs.forEach(n => n.label?.remove()); this.goalLabel.remove(); (this.landmarkLabels || []).forEach(item => item.el.remove());
    }
    this.cancelAction();
    this.map = map; this.city = new THREE.Group(); this.scene.add(this.city); this.selected = null; this.companion = null; this.destination = null; this.marker.visible = false;
    this.layout = MAP_LAYOUTS[map]; this.waypoints = [];
    const night = map === 'kabukicho';
    this.scene.background.set(night ? '#141b2d' : '#b4bdbb'); this.scene.fog = new THREE.Fog(night ? '#141b2d' : '#b4bdbb', night ? 85 : 48, night ? 160 : 100);
    this.city.add(new THREE.HemisphereLight(night ? '#a9bafa' : '#f5ecdc', night ? '#3d344b' : '#737e7b', night ? 1.3 : 2.8));
    const sun = new THREE.DirectionalLight(night ? '#b7c8ff' : '#ffe3ad', night ? 1.6 : 3.6); sun.position.set(-12, 27, 15); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); Object.assign(sun.shadow.camera, { left: -28, right: 28, top: 30, bottom: -30, far: 85 }); sun.shadow.bias = -.001; this.city.add(sun);
    if (night) buildKabukichoLandmarks(this.city); else buildNagoyaConcourse(this.city);
    if (this.camera) { this.camera.fov = night ? 55 : 43; this.camera.updateProjectionMatrix(); if (this.challengeActive) this.updateChallengeView(); }
    this.goal = new THREE.Vector3(this.layout.goal[0], 0, this.layout.goal[1]);
    const goalRing = new THREE.Mesh(new THREE.RingGeometry(1.1, 1.25, 48), new THREE.MeshBasicMaterial({ color: '#c6a0fa', side: THREE.DoubleSide, transparent: true, opacity: .75 }));
    this.goalRing = goalRing; goalRing.visible = false;
    goalRing.rotation.x = -Math.PI / 2; goalRing.position.copy(this.goal); goalRing.position.y = .04; this.city.add(goalRing);
    this.goalBeacon = new THREE.Mesh(new THREE.CylinderGeometry(.045, .045, 6, 8), new THREE.MeshBasicMaterial({ color: '#c6a0fa', transparent: true, opacity: .3 })); this.goalBeacon.position.copy(this.goal); this.goalBeacon.position.y = 3; this.city.add(this.goalBeacon);
    this.goalLabel = this.makeLabel(this.layout.goalLabel, 'goal-label');
    this.landmarkLabels = this.layout.landmarks.slice(0, 2).map(item => ({ ...item, el: this.makeLabel(item.name, `landmark-label landmark-${item.id}`) }));
    this.cameraBlockers = []; this.city.updateMatrixWorld(true);
    this.city.traverse(o => { if (o.userData.cameraBlocker) this.cameraBlockers.push(new THREE.Box3().setFromObject(o)); });
    this.batchScenery();
    const positions = [...this.layout.people, ...(this.layout.streetPeople || [])];
    this.npcs = (night ? [...PROFILES, ...STREET_PROFILES] : PROFILES).map((profile, i) => {
      const mesh = createCharacter(profile.color, profile.hair, profile.id); mesh.position.set(positions[i][0], 0, positions[i][1]); mesh.rotation.y = profile.role === 'toyoko' ? Math.atan2(-34 - positions[i][0], -35.8 - positions[i][1]) : i % 2 ? Math.PI * .8 : Math.PI * .2; this.city.add(mesh);
      const label = this.makeLabel(profile.role ? profile.name : `♡ ${profile.name}`, profile.zone === 'nightlife' ? 'nightlife-label' : profile.role === 'toyoko' ? 'gathering-label' : profile.role ? 'street-label' : profile.guarded ? 'guarded' : 'date-label'); const n = { profile, mesh, label, home: mesh.position.clone(), phase: i * 1.8, cooldown: 0 };
      mesh.traverse(o => { if (o.isMesh) o.userData.npc = n; }); label.addEventListener('click', e => { e.stopPropagation(); this.onSelect(n); }); return n;
    });
    for (const [i, spawn] of crowdSpawns(map, this.mobile).entries()) {
      const mesh = createCharacter(['#72778d', '#9b8392', '#b3a184', '#758e8d', '#5e697d', '#bd9da3'][i % 6], '#3b3440', spawn.kind, { detailed: false });
      const point = resolveDestination(spawn, this.layout);
      mesh.position.set(point.x, 0, point.z); mesh.scale.setScalar(.88 + (i % 3) * .06); this.city.add(mesh);
      this.npcs.push({ mesh, ambient: true, home: mesh.position.clone(), axis: spawn.axis, speed: .55 + (i % 5) * .16, direction: i % 2 ? 1 : -1, phase: i });
    }
    this.player.position.set(this.layout.start[0], 0, this.layout.start[1]); this.player.rotation.y = Math.PI; this.cameraTarget.copy(this.player.position); this.cameraTarget.y = 1; this.resetCamera();
    this.updateCrowdVisibility();
  }
  updateCrowdVisibility() {
    const visible = visibleCrowd(this.npcs, this.player.position, this.mobile);
    for (const n of this.npcs) if (n.ambient) n.mesh.visible = visible.has(n);
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
  cancelAction() { this.action = null; }
  performAction(id) {
    if ((this.paused && !this.challengeActive) || !ACTIONS.some(action => action.id === id)) return false;
    this.destination = null; this.waypoints = []; this.marker.visible = false; this.keys.clear();
    this.action = { id, elapsed: 0 }; return true;
  }
  beginChallenge(partner) {
    if (!partner?.mesh) return false;
    this.cancelAction(); this.destination = null; this.waypoints = []; this.marker.visible = false; this.keys.clear();
    this.challengeActive = true; this.challengePartner = partner; this.challengePartnerRotation = partner.mesh.rotation.y;
    for (const n of this.npcs || []) { n.challengeVisible = n.mesh.visible; n.mesh.visible = n === partner; }
    this.challengeRotation = this.player.rotation.y;
    this.updateChallengeView();
    return true;
  }
  updateChallengeView() {
    const partner = this.challengePartner; if (!partner) return;
    const focus = this.player.position.clone().add(partner.mesh.position).multiplyScalar(.5).add(new THREE.Vector3(0, 1.55, 0));
    // Look perpendicular to the pair so both silhouettes stay visible on narrow phones.
    const separation = partner.mesh.position.clone().sub(this.player.position);
    let angle = Math.atan2(separation.x, separation.z) + Math.PI / 2;
    const aspect = Math.max(.3, this.camera.aspect || 1);
    const distance = Math.max(6.8, (separation.length() + 1.8) / (2 * Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2)) * aspect) * 1.15);
    const view = candidate => focus.clone().add(new THREE.Vector3(Math.sin(candidate) * distance, .6, Math.cos(candidate) * distance));
    for (const offset of [0, Math.PI, .5, -.5, Math.PI + .5, Math.PI - .5]) {
      const candidate = angle + offset;
      if (!cameraView(focus, view(candidate), this.cameraBlockers, candidate).obstructed) { angle = candidate; break; }
    }
    this.challengeView = { focus, desired: cameraView(focus, view(angle), this.cameraBlockers, angle).position };
    this.player.rotation.y = angle; partner.mesh.rotation.y = angle;
  }
  challengeCue(id) { if (this.challengePartner) this.partnerAction = { id, elapsed: 0 }; }
  endChallenge() {
    this.cancelAction(); this.challengeActive = false; this.challengeView = null;
    for (const n of this.npcs || []) if (n.challengeVisible !== undefined) { n.mesh.visible = n.challengeVisible; delete n.challengeVisible; }
    if (this.challengeRotation !== undefined) { this.player.rotation.y = this.challengeRotation; delete this.challengeRotation; }
    if (this.challengePartner) { this.challengePartner.mesh.rotation.y = this.challengePartnerRotation; animateCharacter(this.challengePartner.mesh, false, 0); }
    this.challengePartner = null; this.partnerAction = null;
  }
  challengeFeedback(grade) {
    this.challengeEffects ||= createChallengeEffects(this.player);
    this.challengeEffects.burstMaterial.color.set(grade === 'perfect' ? '#ffd27a' : grade === 'good' ? '#a6efd2' : '#f18ba0'); this.challengeEffects.life = .65;
  }
  applyRewards(rewards) {
    const outfit = REWARDS.find(r => r.id === rewards.outfit), aura = REWARDS.find(r => r.id === rewards.aura);
    if (outfit) setCharacterOutfit(this.player, outfit.color);
    this.challengeEffects ||= createChallengeEffects(this.player);
    this.challengeEffects.aura.visible = !!aura?.color;
    if (aura?.color) this.challengeEffects.auraMaterial.color.set(aura.color);
  }
  walkRoute(points) {
    let from = this.player.position; const route = [];
    for (const [x, z] of points) {
      const segment = planPath(from, { x, z }, this.layout);
      if (!segment.length) return false;
      route.push(...segment); from = segment.at(-1);
    }
    this.cancelAction(); this.keys.clear();
    this.waypoints = route.map(p => new THREE.Vector3(p.x, 0, p.z)); this.destination = this.waypoints.shift();
    if (route.length) this.marker.position.set(from.x, .04, from.z);
    this.marker.visible = !!route.length; return !!route.length;
  }
  walkTo(pos) {
    this.cancelAction();
    const path = planPath(this.player.position, pos, this.layout);
    this.waypoints = path.map(p => new THREE.Vector3(p.x, 0, p.z));
    this.destination = this.waypoints.shift() || null;
    if (path.length) { const end = path.at(-1); this.marker.position.set(end.x, .04, end.z); }
    this.marker.visible = !!path.length;
  }
  resetCamera() { this.yaw = this.map === 'kabukicho' ? 0 : .23; this.distance = this.camera.aspect < .75 ? 32 : this.mobile ? 23 : 26; }
  setDestination(destination) {
    this.escortDestination = destination; this.goal.set(destination.x, 0, destination.z);
    this.goalRing.position.set(destination.x, .04, destination.z); this.goalBeacon.position.set(destination.x, 3, destination.z);
    this.goalLabel.textContent = destination.label;
  }
  faceEachOther(n) { const dx = n.mesh.position.x - this.player.position.x, dz = n.mesh.position.z - this.player.position.z; this.player.rotation.y = Math.atan2(dx, dz); n.mesh.rotation.y = Math.atan2(-dx, -dz); }
  select(n) { this.selected = n; this.npcs.filter(p => !p.ambient).forEach(p => p.label.classList.toggle('selected', p === n)); }
  resize() {
    const w = this.container.clientWidth, h = this.container.clientHeight;
    if (!w || !h) return;
    const wasPortrait = this.camera.aspect < .75;
    this.camera.aspect = w / h; this.camera.updateProjectionMatrix(); if (this.challengeActive) this.updateChallengeView(); this.renderer.setSize(w, h);
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
    const camera = new THREE.PerspectiveCamera(27, 1, .1, 12);
    const faceY = person.userData.faceY || 1.96;
    camera.position.set(.15, faceY + .07, 1.48); camera.lookAt(0, faceY, 0);
    const previous = this.renderer.getRenderTarget();
    try {
      this.renderer.setRenderTarget(target); this.renderer.render(scene, camera);
      const pixels = new Uint8Array(size * size * 4); this.renderer.readRenderTargetPixels(target, 0, 0, size, size, pixels);
      const canvas = document.createElement('canvas'); canvas.width = canvas.height = size;
      const ctx = canvas.getContext('2d'), data = ctx.createImageData(size, size);
      for (let y = 0; y < size; y++) data.data.set(pixels.subarray((size - 1 - y) * size * 4, (size - y) * size * 4), y * size * 4);
      ctx.putImageData(data, 0, 0);
      const image = canvas.toDataURL('image/png'); this.portraits.set(profile.id, image); return image;
    } finally { this.renderer.setRenderTarget(previous); target.dispose(); disposeCharacterSkeletons(person); }
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
        this.cancelAction();
        if (x || z) direction.set(x, 0, z).normalize();
        else direction.set(stick.x, 0, stick.y);
        direction.applyAxisAngle(new THREE.Vector3(0, 1, 0), this.yaw); this.destination = null; this.waypoints = []; this.marker.visible = false; }
      else if (this.destination) { direction.subVectors(this.destination, this.player.position); if (direction.length() < .15) { this.destination = this.waypoints.shift() || null; this.marker.visible = !!this.destination; direction.set(0, 0, 0); } else direction.normalize(); }
      if (this.destination && this.companion && this.distanceTo(this.companion) > 5) direction.set(0, 0, 0);
      if (direction.lengthSq()) { this.player.position.addScaledVector(direction, (this.companion ? 3.4 : 4.6) * dt); this.player.rotation.y = Math.atan2(direction.x, direction.z); }
      const b = this.layout.bounds;
      this.player.position.x = clamp(this.player.position.x, b.minX, b.maxX); this.player.position.z = clamp(this.player.position.z, b.minZ, b.maxZ);
      if (!isWalkable(this.player.position, this.layout)) {
        const next = this.player.position.clone(); this.player.position.copy(previous);
        if (isWalkable({ x: next.x, z: previous.z }, this.layout)) this.player.position.x = next.x;
        else if (isWalkable({ x: previous.x, z: next.z }, this.layout)) this.player.position.z = next.z;
      }
    }
    animateCharacter(this.player, previous.distanceToSquared(this.player.position) > .00001, time);
    if (this.action && (!this.paused || this.challengeActive)) {
      this.action.elapsed += dt;
      if (!animateAction(this.player, this.action.id, this.action.elapsed)) this.cancelAction();
    }
    updateChallengeEffects(this.challengeEffects, dt, time);
    if (this.challengeActive && this.challengeView) {
      animateCharacter(this.challengePartner.mesh, false, time);
      if (this.partnerAction) { this.partnerAction.elapsed += dt; if (!animateAction(this.challengePartner.mesh, this.partnerAction.id, this.partnerAction.elapsed)) this.partnerAction = null; }
      this.camera.position.lerp(this.challengeView.desired, 1 - Math.exp(-dt * 9)); this.camera.lookAt(this.challengeView.focus); this.camera.updateMatrixWorld();
      this.renderer.render(this.scene, this.camera); return;
    }
    this.updateCrowdVisibility();
    const nearbyLabels = new Set(this.npcs.filter(n => !n.ambient && this.distanceTo(n) <= 9 && segmentClear(this.player.position, n.mesh.position, this.layout))
      .sort((a, b) => this.distanceTo(a) - this.distanceTo(b)).slice(0, 2));
    for (const n of this.npcs) {
      let moving = false;
      if (!this.paused && n !== this.selected) {
        if (n === this.companion) {
          const follow = resolveDestination(this.player.position.clone().add(new THREE.Vector3(.9, 0, .9)), this.layout);
          if (!n.followTarget || (time >= (n.followRefresh || 0) && Math.hypot(follow.x - n.followTarget.x, follow.z - n.followTarget.z) > .65)) {
            n.followPath = planPath(n.mesh.position, follow, this.layout); n.followTarget = follow; n.followRefresh = time + .4;
          }
          const next = n.followPath?.[0];
          if (next) {
            const dir = new THREE.Vector3(next.x, 0, next.z).sub(n.mesh.position), distance = dir.length();
            if (distance <= (n.followPath.length > 1 ? .16 : 1.0)) { if (n.followPath.length > 1) n.followPath.shift(); }
            else { const step = n.mesh.position.clone().addScaledVector(dir.normalize(), Math.min(distance, 3.8 * dt)); if (isWalkable(step, this.layout)) { n.mesh.position.copy(step); n.mesh.rotation.y = Math.atan2(dir.x, dir.z); moving = true; } else n.followTarget = null; }
          }
        } else if (n.ambient) {
          const axis = n.axis || 'z', next = n.mesh.position.clone(); next[axis] += n.speed * n.direction * dt;
          if (isWalkable(next, this.layout) && (!n.home || Math.abs(next[axis] - n.home[axis]) < 12)) { n.mesh.position.copy(next); moving = true; } else n.direction *= -1;
          n.mesh.rotation.y = (axis === 'x' ? Math.PI / 2 : 0) + (n.direction === 1 ? 0 : Math.PI);
        } else if (n.profile.speed > .2) {
          const next = n.mesh.position.clone(); next.z = n.home.z + Math.sin(time * .15 + n.phase) * (n.profile.guarded ? 3 : 1.4);
          if (isWalkable(next, this.layout)) n.mesh.position.copy(next);
          n.mesh.rotation.y = Math.cos(time * .15 + n.phase) > 0 ? 0 : Math.PI; moving = true;
        }
      }
      // Keep navigation responsive; sample distant authored poses less often on phones.
      const interval = this.mobile && this.distanceTo(n) > 14 && n !== this.companion && n !== this.selected ? .12 : 0;
      if ((!n.ambient || n.mesh.visible) && (!n.lastAnimation || time - n.lastAnimation >= interval)) { animateCharacter(n.mesh, moving, time, n.phase); n.lastAnimation = time; }
      if (!n.ambient) {
        n.label.style.opacity = n === this.companion || n.cooldown > time ? '.25' : '1';
        if (!nearbyLabels.has(n) && n !== this.selected) n.label.style.display = 'none';
        else this.placeLabel(n.label, n.mesh.position);
      }
    }
    this.ring.position.copy(this.player.position); this.ring.position.y = .035;
    this.selectionRing.visible = !!this.selected; if (this.selected) { this.selectionRing.position.copy(this.selected.mesh.position); this.selectionRing.position.y = .04; }
    if (this.goalRing) this.goalRing.visible = !!this.companion;
    this.goalBeacon.visible = !!this.companion; this.goalLabel.style.opacity = this.companion ? '1' : '.7';
    this.cameraTarget.lerp(this.player.position.clone().add(new THREE.Vector3(0, this.map === 'kabukicho' ? 4 : 1.1, this.map === 'kabukicho' ? -6 : -2)), 1 - Math.exp(-dt * 3));
    const night = this.map === 'kabukicho', horizontal = this.distance * (night ? .94 : .82);
    const desired = this.cameraTarget.clone().add(new THREE.Vector3(Math.sin(this.yaw) * horizontal, this.distance * (night ? .36 : .65), Math.cos(this.yaw) * horizontal));
    const focus = this.player.position.clone().add(new THREE.Vector3(0, 1.5, 0));
    const view = cameraView(focus, desired, this.cameraBlockers, this.yaw); let blocked = view.obstructed;
    if (view.obstructed) this.camera.position.copy(view.position);
    else { this.camera.position.lerp(view.position, 1 - Math.exp(-dt * 5)); const transition = cameraView(focus, this.camera.position, this.cameraBlockers, this.yaw); if (transition.obstructed) { blocked = true; this.camera.position.copy(transition.position); } }
    this.camera.lookAt(blocked ? focus : this.cameraTarget);
    this.camera.updateMatrixWorld(); this.placeLabel(this.playerLabel, this.player.position, 2.8); if (this.companion) this.placeLabel(this.goalLabel, this.goal, 2.2); else this.goalLabel.style.display = 'none';
    for (const item of this.landmarkLabels) {
      this.placeLabel(item.el, new THREE.Vector3(item.x, 0, item.z), this.map === 'nagoya' ? (item.id === 'gold-clock' ? 5.8 : 4.4) : item.height || 11.7);
    }
    this.renderer.render(this.scene, this.camera);
  }
  drawMinimap(ctx) {
    const s = 180, b = this.layout.bounds;
    const point = p => [(p.x - b.minX) / (b.maxX - b.minX) * s, (p.z - b.minZ) / (b.maxZ - b.minZ) * s];
    ctx.clearRect(0, 0, s, s); ctx.fillStyle = '#121a28'; ctx.fillRect(0, 0, s, s);
    ctx.fillStyle = '#414957';
    if (this.layout.walkways) for (const road of this.layout.walkways) {
      const [x, y] = point({ x: road.minX, z: road.minZ });
      ctx.fillRect(x, y, (road.maxX - road.minX) / (b.maxX - b.minX) * s, (road.maxZ - road.minZ) / (b.maxZ - b.minZ) * s);
    } else ctx.fillRect(0, 0, s, s);
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

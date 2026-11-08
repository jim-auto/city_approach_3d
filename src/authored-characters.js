import * as THREE from 'three';
import { CAST, MODEL_FILES } from './cast.js';
import { createAccessories, placeAccessories } from './avatar-accessories.js';
export { CAST, MODEL_FILES } from './cast.js';
export const AVATAR_URL = './models/yui.vrm';
const templates = new Map(), styledMaterials = new Map(), styledGeometry = new Map(), clothMasks = new WeakMap();
let loading;
const shared = r => { r.userData.characterShared = true; return r; };
const shadowGeometry = shared(new THREE.CircleGeometry(.38, 20));
const shadowMaterial = shared(new THREE.MeshBasicMaterial({ color: '#080b18', transparent: true, opacity: .23, depthWrite: false }));
function pixels(image) {
  if (image.data) return image.data;
  const canvas = document.createElement('canvas'); canvas.width = image.width; canvas.height = image.height;
  const ctx = canvas.getContext('2d'); ctx.drawImage(image, 0, 0); return ctx.getImageData(0, 0, image.width, image.height).data;
}
function sample(image, data, u, v) { return (Math.min(image.height - 1, Math.max(0, Math.floor(v * image.height))) * image.width + Math.min(image.width - 1, Math.max(0, Math.floor(u * image.width)))) * 4; }
function clothMask(mesh) {
  if (clothMasks.has(mesh.geometry)) return clothMasks.get(mesh.geometry);
  const uv = mesh.geometry.attributes.uv, image = mesh.material.map.image, data = pixels(image), mask = new Uint8Array(uv.count);
  for (let i = 0; i < uv.count; i++) { const p = sample(image, data, uv.getX(i), uv.getY(i)); mask[i] = Math.max(data[p], data[p + 1], data[p + 2]) < 110 ? 1 : 0; }
  clothMasks.set(mesh.geometry, mask); return mask;
}
// Parse only four bases, not one download per character. Each visible clone owns its
// skeleton/morph weights; immutable geometry and textures are shared across the crowd.
export function loadAuthoredCharacters(data, onProgress) {
  if (templates.size === Object.keys(MODEL_FILES).length) return Promise.resolve(templates);
  if (loading) return loading;
  loading = (async () => {
    const [{ GLTFLoader }, { VRMLoaderPlugin, VRMUtils }, { clone }] = await Promise.all([
      import('three/addons/loaders/GLTFLoader.js'), import('@pixiv/three-vrm'), import('three/addons/utils/SkeletonUtils.js'),
    ]);
    const progress = new Map(Object.keys(MODEL_FILES).map(key => [key, 0]));
    const report = (key, amount) => { progress.set(key, amount); onProgress?.({ loaded: [...progress.values()].reduce((a, b) => a + b, 0), total: progress.size }); };
    const results = await Promise.all(Object.entries(MODEL_FILES).map(async ([key, file]) => {
      const loader = new GLTFLoader(); loader.register(parser => new VRMLoaderPlugin(parser));
      const buffer = data instanceof ArrayBuffer ? (key === 'yui' ? data : null) : data?.[key];
      const gltf = buffer ? await loader.parseAsync(buffer, '') : await loader.loadAsync('./models/' + file + '?v=cast1', event => report(key, event.total ? Math.min(.9, event.loaded / event.total * .9) : .3));
      const vrm = gltf.userData.vrm;
      if (!vrm?.humanoid?.getNormalizedBoneNode('head')) throw new Error(`Avatar has no humanoid rig: ${key}`);
      VRMUtils.rotateVRM0(vrm); VRMUtils.combineMorphs(vrm); VRMUtils.removeUnnecessaryVertices(vrm.scene); VRMUtils.combineSkeletons(vrm.scene);
      // Static authored hair avoids coupling independent clones through one spring solver.
      vrm.springBoneManager = undefined;
      const colliders = []; vrm.scene.traverse(o => { if (o.colliderMatrix && o.shape) colliders.push(o); }); colliders.forEach(o => o.removeFromParent());
      vrm.scene.updateMatrixWorld(true);
      const bounds = new THREE.Box3().setFromObject(vrm.scene);
      let eyes; vrm.scene.traverse(o => { if (!eyes && o.isMesh && /EyeIris/i.test(o.material.name)) eyes = o; });
      const eyeCenter = eyes ? vrm.scene.worldToLocal(new THREE.Box3().setFromObject(eyes, true).getCenter(new THREE.Vector3())) : new THREE.Vector3(0, bounds.max.y - .17, .1);
      const headCenter = vrm.scene.worldToLocal(vrm.humanoid.getNormalizedBoneNode('head').getWorldPosition(new THREE.Vector3()));
      const eyeHeight = eyeCenter.y;
      const faceOffset = eyeCenter.sub(headCenter);
      const localHand = vrm.scene.worldToLocal(vrm.humanoid.getNormalizedBoneNode('leftHand').getWorldPosition(new THREE.Vector3()));
      const armSign = Math.sign(localHand.x) || 1, forward = vrm.meta.metaVersion === '0' ? -1 : 1;
      vrm.scene.traverse(o => {
        if (o.geometry) shared(o.geometry);
        for (const material of [o.material].flat().filter(Boolean)) {
          shared(material); material.toneMapped = false;
          if (material.map) { material.map.anisotropy = 2; shared(material.map); }
        }
        if (o.isMesh) { o.castShadow = true; o.receiveShadow = false; o.frustumCulled = true; }
        if (key === 'male' && o.isMesh && /Body_00_SKIN/i.test(o.material.name)) clothMask(o);
      });
      report(key, 1); return [key, { vrm, clone, height: bounds.max.y - Math.min(0, bounds.min.y), ground: -Math.min(0, bounds.min.y), armSign, forward, faceOffset, eyeHeight }];
    }));
    results.forEach(([key, value]) => templates.set(key, value)); return templates;
  })().catch(error => { loading = undefined; throw error; });
  return loading;
}
function styleMesh(mesh, style, cacheKey) {
  const original = mesh.material, hair = /HAIR/i.test(original.name), cloth = /CLOTH/i.test(original.name), maleCloth = style.base === 'male' && /Body_00_SKIN/i.test(original.name);
  if (!(hair && style.hair || (cloth || maleCloth) && style.clothes)) return;
  const key = `${cacheKey}/${original.uuid}`;
  if (!styledMaterials.has(key)) {
    const material = original.clone(); shared(material); material.toneMapped = false;
    if (hair) {
      // Multiplication preserves the authored hair texture and highlights.
      const factors = style.base === 'male' ? 12 : style.base === 'yui' ? 3 : 2;
      material.color.set(style.hair).multiplyScalar(factors);
    } else if (maleCloth) material.vertexColors = true;
    else material.color.set(style.clothes);
    styledMaterials.set(key, material);
  }
  mesh.material = styledMaterials.get(key);
  if (maleCloth) {
    const geometryKey = `${cacheKey}/${mesh.geometry.uuid}`;
    if (!styledGeometry.has(geometryKey)) {
      const originalGeometry = mesh.geometry, g = new THREE.BufferGeometry(), mask = clothMasks.get(originalGeometry), tint = new THREE.Color(style.clothes).multiplyScalar(30), colors = new Float32Array(mask.length * 3);
      // Only dark clothing texels are tinted. Face, neck, hands and other skin stay intact.
      for (let i = 0; i < mask.length; i++) colors.set(mask[i] ? [tint.r, tint.g, tint.b] : [1, 1, 1], i * 3);
      for (const [name, attribute] of Object.entries(originalGeometry.attributes)) g.setAttribute(name, attribute);
      g.setAttribute('color', new THREE.BufferAttribute(colors, 3)); g.setIndex(originalGeometry.index);
      g.morphAttributes = originalGeometry.morphAttributes; g.morphTargetsRelative = originalGeometry.morphTargetsRelative;
      g.boundingBox = originalGeometry.boundingBox?.clone() || null; g.boundingSphere = originalGeometry.boundingSphere?.clone() || null;
      shared(g); styledGeometry.set(geometryKey, g);
    }
    mesh.geometry = styledGeometry.get(geometryKey);
  }
}
export function createAuthoredCharacter(kind, detailed, color) {
  const config = CAST[kind]; if (!config || !templates.has(config.base)) return null;
  const style = !detailed && color ? { ...config, clothes: color } : config, source = templates.get(style.base);
  const { vrm, clone } = source, avatar = clone(vrm.scene), root = new THREE.Group(), pairs = [], morphs = [];
  const pair = (a, b) => { if (a.isBone) pairs.push([a, b]); if (a.morphTargetInfluences) morphs.push([a, b]); a.children.forEach((child, i) => pair(child, b.children[i])); };
  pair(vrm.scene, avatar); avatar.traverse(o => { if (o.isMesh) styleMesh(o, style, `${kind}/${style.clothes || ''}`); });
  const { group, items } = createAccessories(style, detailed); avatar.add(group);
  const scale = style.height / source.height; avatar.scale.setScalar(scale); root.add(avatar);
  const shadow = new THREE.Mesh(shadowGeometry, shadowMaterial); shadow.rotation.x = -Math.PI / 2; shadow.position.y = .016; root.add(shadow);
  root.name = `person-${kind}`;
  root.userData = { character: true, kind, detailed, authored: true, style, source, avatar, pairs, morphs, items, faceY: source.eyeHeight * scale - .015, ground: source.ground * scale, resourceOwner: 'characters' };
  animateAuthoredCharacter(root, false, 0); return root;
}
const rotation = new THREE.Euler(), quaternion = new THREE.Quaternion();
export function animateAuthoredCharacter(model, moving, time, seed = 0, action) {
  if (!model.userData.authored) return false;
  const { source, avatar, pairs, morphs, style, items } = model.userData, { vrm, armSign: s, forward: f } = source, h = vrm.humanoid;
  model.userData.lastFrame = { moving, time, seed };
  const wave = Math.sin(time * 7.5 + seed), swing = moving ? wave * .36 : 0;
  h.resetNormalizedPose();
  const pose = (bone, x, y, z) => { const node = h.getNormalizedBoneNode(bone); if (node) node.quaternion.copy(quaternion.setFromEuler(rotation.set(x, y, z))); };
  pose('leftUpperArm', -swing * .55 * f, 0, -s * 1.35); pose('rightUpperArm', swing * .55 * f, 0, s * 1.35);
  pose('leftLowerArm', 0, -s * f * .10, 0); pose('rightLowerArm', 0, s * f * .10, 0);
  const held = items.has('phone') || items.has('coffee') || items.has('menu');
  if (held) { pose('rightUpperArm', -.18 * f, 0, s * 1.35); pose('rightLowerArm', 0, s * f * 1.0, 0); }
  if (items.has('book')) {
    pose('leftUpperArm', -.15 * f, 0, -s * 1.20); pose('rightUpperArm', -.15 * f, 0, s * 1.20);
    pose('leftLowerArm', 0, -s * f * 1.1, 0); pose('rightLowerArm', 0, s * f * 1.1, 0);
  }
  if (held || items.has('book')) for (const hand of items.has('book') ? ['left', 'right'] : ['right']) for (const finger of ['Index', 'Middle', 'Ring', 'Little']) {
    const sign = hand === 'left' ? -1 : 1; pose(`${hand}${finger}Proximal`, 0, sign * s * f * .35, 0); pose(`${hand}${finger}Intermediate`, 0, sign * s * f * .45, 0);
  }
  pose('leftUpperLeg', swing * f, 0, 0); pose('rightUpperLeg', -swing * f, 0, 0);
  pose('leftLowerLeg', Math.max(0, -swing) * .9 * f, 0, 0); pose('rightLowerLeg', Math.max(0, swing) * .9 * f, 0, 0);
  pose('head', 0, moving ? 0 : Math.sin(time * .6 + seed) * .06, 0); pose('chest', moving ? .025 * f : 0, 0, moving ? wave * .015 : 0);
  let lift = 0;
  if (action) {
    const { id, elapsed, duration } = action, t = elapsed / duration, e = Math.min(1, elapsed / .2, (duration - elapsed) / .2);
    if (id === 'wave') { pose('rightUpperArm', 0, 0, s * (1.35 - 2.4 * e)); pose('rightLowerArm', 0, s * f * .25, s * Math.sin(elapsed * 15) * .35 * e); pose('head', 0, 0, -.08 * e); }
    else if (id === 'bow') { pose('spine', .28 * Math.sin(Math.PI * t) ** 2 * f, 0, 0); pose('chest', .22 * Math.sin(Math.PI * t) ** 2 * f, 0, 0); pose('head', .12 * e * f, 0, 0); }
    else if (id === 'jump') { lift = 1.15 * Math.sin(Math.PI * t); pose('leftUpperArm', 0, 0, -s * .7); pose('rightUpperArm', 0, 0, s * .7); pose('leftLowerLeg', .3 * f * Math.sin(Math.PI * t), 0, 0); pose('rightLowerLeg', .3 * f * Math.sin(Math.PI * t), 0, 0); }
    else { const beat = Math.sin(elapsed * 9); lift = Math.abs(beat) * .09 * e; pose('hips', 0, Math.sin(elapsed * 4.5) * .25 * e, beat * .09 * e); pose('leftUpperArm', 0, 0, -s * (.6 + beat * .4)); pose('rightUpperArm', 0, 0, s * (.6 - beat * .4)); pose('leftLowerArm', 0, -s * f * .7, 0); pose('rightLowerArm', 0, s * f * .7, 0); }
  }
  const blinkPhase = (time + seed) % 4.7, blink = Math.max(0, 1 - Math.abs(blinkPhase - 4.5) / .09);
  vrm.expressionManager?.setValue('blink', blink); vrm.expressionManager?.setValue('happy', style.smile || 0); vrm.update(0);
  for (const [a, b] of pairs) { b.position.copy(a.position); b.quaternion.copy(a.quaternion); b.scale.copy(a.scale); }
  for (const [a, b] of morphs) b.morphTargetInfluences = a.morphTargetInfluences.slice();
  placeAccessories(model, vrm.scene, h);
  avatar.position.y = model.userData.ground + lift + (moving ? Math.abs(wave) * .018 : Math.sin(time * 1.8 + seed) * .004);
  model.updateMatrixWorld(true); return true;
}
export function animateAuthoredAction(model, action, elapsed) {
  if (!model.userData.authored) return false;
  const { moving, time, seed } = model.userData.lastFrame || { moving: false, time: 0, seed: 0 };
  animateAuthoredCharacter(model, moving, time, seed, { ...action, elapsed }); return true;
}
export function disposeCharacterSkeletons(model) {
  const skeletons = new Set(); model.traverse(o => { if (o.isSkinnedMesh) skeletons.add(o.skeleton); }); skeletons.forEach(skeleton => skeleton.dispose());
}

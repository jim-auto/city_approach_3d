import * as THREE from 'three';

export const AVATAR_URL = './models/yui.vrm';
let template, loading;
const shadowGeometry = new THREE.CircleGeometry(.38, 20);
const shadowMaterial = new THREE.MeshBasicMaterial({ color: '#080b18', transparent: true, opacity: .23, depthWrite: false });
shadowGeometry.userData.characterShared = shadowMaterial.userData.characterShared = true;
const phoneGeometry = new THREE.BoxGeometry(.066, .12, .012), screenGeometry = new THREE.PlaneGeometry(.054, .095);
const phoneMaterial = new THREE.MeshStandardMaterial({ color: '#252b38', roughness: .5 }), screenMaterial = new THREE.MeshBasicMaterial({ color: '#96c6ce' });
for (const resource of [phoneGeometry, screenGeometry, phoneMaterial, screenMaterial]) resource.userData.characterShared = true;

// Parse once. Geometry, textures and the pose solver are shared; every visible clone owns
// its skeleton and morph weights. No asynchronous replacement can interrupt a conversation.
export function loadAuthoredCharacters(data, onProgress) {
  if (template) return Promise.resolve(template);
  if (loading) return loading;
  loading = (async () => {
    const [{ GLTFLoader }, { VRMLoaderPlugin, VRMUtils }, { clone }] = await Promise.all([
      import('three/addons/loaders/GLTFLoader.js'), import('@pixiv/three-vrm'), import('three/addons/utils/SkeletonUtils.js'),
    ]);
    const loader = new GLTFLoader(); loader.register(parser => new VRMLoaderPlugin(parser));
    const gltf = data ? await loader.parseAsync(data, '') : await loader.loadAsync(AVATAR_URL, onProgress);
    const vrm = gltf.userData.vrm;
    if (!vrm?.humanoid || !vrm.humanoid.getNormalizedBoneNode('head')) throw new Error('Avatar has no humanoid rig');
    VRMUtils.removeUnnecessaryVertices(vrm.scene); VRMUtils.combineSkeletons(vrm.scene);
    // Preserve the authored rest hair. Solving springs on a shared template would couple clones.
    vrm.springBoneManager = undefined;
    const colliders = []; vrm.scene.traverse(o => { if (o.colliderMatrix && o.shape) colliders.push(o); });
    colliders.forEach(o => o.removeFromParent());
    vrm.scene.traverse(o => {
      if (o.geometry) o.geometry.userData.characterShared = true;
      for (const material of [o.material].flat().filter(Boolean)) {
        material.userData.characterShared = true; material.toneMapped = false;
        if (material.map) { material.map.anisotropy = 2; material.map.userData.characterShared = true; }
      }
      if (o.isMesh) { o.castShadow = true; o.receiveShadow = false; o.frustumCulled = false; }
    });
    template = { vrm, clone }; return template;
  })().catch(error => { loading = undefined; throw error; });
  return loading;
}

export function createAuthoredCharacter(kind, detailed) {
  if (!template || kind !== 'waiting' || !detailed) return null;
  const { vrm, clone } = template, avatar = clone(vrm.scene), root = new THREE.Group(), pairs = [], morphs = [];
  // Pair by hierarchy rather than bone name: the source contains duplicate helper names.
  const pair = (a, b) => {
    if (a.isBone) pairs.push([a, b]);
    if (a.morphTargetInfluences) morphs.push([a, b]);
    a.children.forEach((child, i) => pair(child, b.children[i]));
  };
  pair(vrm.scene, avatar);
  const phone = new THREE.Group(); phone.name = 'phone'; phone.add(new THREE.Mesh(phoneGeometry, phoneMaterial));
  const screen = new THREE.Mesh(screenGeometry, screenMaterial); screen.rotation.y = Math.PI; screen.position.z = -.0065; phone.add(screen); avatar.add(phone);
  avatar.scale.setScalar(1.3); root.add(avatar);
  const shadow = new THREE.Mesh(shadowGeometry, shadowMaterial); shadow.rotation.x = -Math.PI / 2; shadow.position.y = .016; root.add(shadow);
  root.name = 'person-waiting'; root.userData = { character: true, kind, detailed, authored: true, avatar, pairs, morphs, phone, resourceOwner: 'characters' };
  animateAuthoredCharacter(root, false, 0); return root;
}
const rotation = new THREE.Euler(), quaternion = new THREE.Quaternion();
export function animateAuthoredCharacter(model, moving, time, seed = 0) {
  if (!model.userData.authored) return false;
  const { vrm } = template, { avatar, pairs, morphs, phone } = model.userData, h = vrm.humanoid;
  const wave = Math.sin(time * 7.5 + seed), swing = moving ? wave * .36 : 0;
  h.resetNormalizedPose();
  const pose = (bone, x, y, z) => { const node = h.getNormalizedBoneNode(bone); if (node) node.quaternion.copy(quaternion.setFromEuler(rotation.set(x, y, z))); };
  // The supplied rig is a T-pose. Lower both arms before adding a restrained walk cycle.
  pose('leftUpperArm', -swing * .55, 0, -1.35); pose('rightUpperArm', -.18, 0, 1.35);
  pose('leftLowerArm', 0, -.10, 0); pose('rightLowerArm', 0, 1.0, 0);
  for (const finger of ['Index', 'Middle', 'Ring', 'Little']) {
    pose(`right${finger}Proximal`, 0, .35, 0); pose(`right${finger}Intermediate`, 0, .45, 0);
  }
  pose('leftUpperLeg', swing, 0, 0); pose('rightUpperLeg', -swing, 0, 0);
  pose('leftLowerLeg', Math.max(0, -swing) * .9, 0, 0); pose('rightLowerLeg', Math.max(0, swing) * .9, 0, 0);
  pose('head', 0, moving ? 0 : Math.sin(time * .6 + seed) * .06, 0);
  pose('chest', moving ? .025 : 0, 0, moving ? wave * .015 : 0);
  const blinkPhase = (time + seed) % 4.7, blink = Math.max(0, 1 - Math.abs(blinkPhase - 4.5) / .09);
  vrm.expressionManager?.setValue('blink', blink); vrm.expressionManager?.setValue('happy', .12);
  vrm.update(0);
  for (const [source, target] of pairs) { target.position.copy(source.position); target.quaternion.copy(source.quaternion); target.scale.copy(source.scale); }
  for (const [source, target] of morphs) target.morphTargetInfluences = source.morphTargetInfluences.slice();
  phone.position.copy(h.getNormalizedBoneNode('rightHand').getWorldPosition(new THREE.Vector3())).add(new THREE.Vector3(0, .035, .025));
  phone.rotation.set(-.3, 0, .1);
  avatar.position.y = moving ? Math.abs(wave) * .018 : Math.sin(time * 1.8 + seed) * .004;
  model.updateMatrixWorld(true); return true;
}
export function disposeCharacterSkeletons(model) {
  const skeletons = new Set(); model.traverse(o => { if (o.isSkinnedMesh) skeletons.add(o.skeleton); });
  skeletons.forEach(skeleton => skeleton.dispose());
}

import * as THREE from 'three';
export function createChallengeEffects(player) {
  const aura = new THREE.Group(); aura.visible = false; player.add(aura);
  const auraMaterial = new THREE.MeshBasicMaterial({ color: '#a6efd2', transparent: true, opacity: .8, depthWrite: false });
  const ring = new THREE.Mesh(new THREE.RingGeometry(.53, .59, 32), auraMaterial); ring.rotation.x = -Math.PI / 2; ring.position.y = .035; aura.add(ring);
  const stars = [], geo = new THREE.OctahedronGeometry(.055);
  for (let i = 0; i < 3; i++) { const star = new THREE.Mesh(geo, auraMaterial); aura.add(star); stars.push(star); }
  const burstMaterial = new THREE.MeshBasicMaterial({ color: '#ffd27a', transparent: true, opacity: 1, depthWrite: false });
  const burst = new THREE.InstancedMesh(geo, burstMaterial, 12); burst.visible = false; burst.frustumCulled = false; player.add(burst);
  return { aura, auraMaterial, stars, burst, burstMaterial, life: 0 };
}
const object = new THREE.Object3D();
export function updateChallengeEffects(fx, dt, time) {
  if (!fx) return;
  if (fx.aura.visible) for (const [i, star] of fx.stars.entries()) { const a = time * 1.4 + i * Math.PI * 2 / 3; star.position.set(Math.sin(a) * .63, .8 + Math.sin(a * 1.7) * .25, Math.cos(a) * .63); star.rotation.set(time, a, 0); }
  if (fx.life > 0) {
    fx.life = Math.max(0, fx.life - dt); const progress = 1 - fx.life / .65;
    for (let i = 0; i < 12; i++) { const a = i * Math.PI * 2 / 12; object.position.set(Math.sin(a) * (.2 + progress * 1.25), 1 + Math.cos(a) * progress * .7 + progress * .5, Math.cos(a) * (.2 + progress * .65)); object.rotation.set(progress * 4, a, progress * 6); object.scale.setScalar(1 - progress * .6); object.updateMatrix(); fx.burst.setMatrixAt(i, object.matrix); }
    fx.burst.instanceMatrix.needsUpdate = true; fx.burstMaterial.opacity = 1 - progress; fx.burst.visible = fx.life > 0;
  }
}

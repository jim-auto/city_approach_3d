import * as THREE from 'three';

export function cameraView(focus, desired, blockers = [], yaw = 0) {
  const direction = desired.clone().sub(focus), distance = direction.length();
  const ray = new THREE.Ray(focus, direction.normalize()), hit = new THREE.Vector3();
  let nearest = distance;
  for (const box of blockers) if (ray.intersectBox(box, hit)) {
    const d = hit.distanceTo(focus); if (d < nearest) nearest = d;
  }
  if (nearest >= distance - .1) return { position: desired, obstructed: false };
  // Side/rear streets must keep the avatar visible when the hotel blocks the trailing camera.
  // A vertical view is unobstructed because the walkable network excludes building footprints.
  return { position: focus.clone().add(new THREE.Vector3(Math.sin(yaw) * .01, 18, Math.cos(yaw) * .01)), obstructed: true };
}

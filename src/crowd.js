// Use the lighter authored bases for passersby, preserving the detailed main cast.
export const CROWD_KINDS = ['eye', 'tourist', 'cafe', 'reader', 'scout'];
export const CROWD_LIMIT = { mobile: 8, desktop: 20 };
const nightSpawns = [
  [-2, 28, 'z'], [2.3, 34, 'z'], [-4.4, 18, 'z'], [4.7, 10, 'z'],
  [-2.2, -8, 'z'], [8, -15, 'x'], [-8, -20, 'x'], [-32, -24, 'x'],
  [-22, 28, 'z'], [21, 16, 'z'], [-17, -34, 'z'], [18.5, -40, 'z'],
  [-4, -44, 'x'], [-32, -34, 'x'], [-20, 15, 'x'], [8, 44, 'x'],
];
export function crowdSpawns(map, mobile) {
  const count = map === 'kabukicho' ? mobile ? 16 : 32 : mobile ? 12 : 24;
  return Array.from({length: count}, (_, i) => {
    const [x, z, axis] = map === 'kabukicho' ? nightSpawns[i % nightSpawns.length] : [(i % 2 ? 1 : -1) * (2.4 + (i % 3) * 1.1), 23 - (i % 12) * 4.1, 'z'];
    return {x: x + (i >= count / 2 && !mobile ? .7 : 0), z: z + (i >= count / 2 && !mobile ? 1.2 : 0), axis, kind: CROWD_KINDS[i % CROWD_KINDS.length]};
  });
}
export function visibleCrowd(npcs, player, mobile) {
  const distance = n => n.mesh.position.distanceTo(player);
  // A small distance bias keeps pedestrians from swapping visibility at every step.
  return new Set(npcs.filter(n => n.ambient && distance(n) < (mobile ? 38 : 65))
    .sort((a, b) => (distance(a) - (a.mesh.visible ? 3 : 0)) - (distance(b) - (b.mesh.visible ? 3 : 0)))
    .slice(0, mobile ? CROWD_LIMIT.mobile : CROWD_LIMIT.desktop));
}

export const MOBILE_CAST_LIMIT = 12;
export function visibleCast(npcs, player, mobile, selected, companion) {
  const cast = npcs.filter(n => !n.ambient);
  if (!mobile) return new Set(cast);
  return new Set(cast.sort((a, b) => {
    const priority = n => n === selected || n === companion ? -10000 : n.mesh.position.distanceTo(player) - (n.mesh.visible ? 2 : 0);
    return priority(a) - priority(b);
  }).slice(0, MOBILE_CAST_LIMIT));
}

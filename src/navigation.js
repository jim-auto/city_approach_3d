const MARGIN = .34;
export function isWalkable(point, layout) {
  const b = layout.bounds;
  return point.x >= b.minX && point.x <= b.maxX && point.z >= b.minZ && point.z <= b.maxZ && layout.obstacles.every(o => Math.hypot(point.x - o.x, point.z - o.z) >= o.radius + MARGIN - .001);
}
export function resolveDestination(point, layout) {
  const b = layout.bounds, p = { x: Math.min(b.maxX, Math.max(b.minX, point.x)), z: Math.min(b.maxZ, Math.max(b.minZ, point.z)) };
  for (const o of layout.obstacles) {
    const dx = p.x - o.x, dz = p.z - o.z, length = Math.hypot(dx, dz), radius = o.radius + MARGIN + .02;
    if (length < radius) { p.x = o.x + (length ? dx / length : 1) * radius; p.z = o.z + (length ? dz / length : 0) * radius; }
  }
  return p;
}
export function segmentClear(a, b, layout) {
  return layout.obstacles.every(o => {
    const dx = b.x - a.x, dz = b.z - a.z, length = dx * dx + dz * dz;
    const t = length ? Math.max(0, Math.min(1, ((o.x - a.x) * dx + (o.z - a.z) * dz) / length)) : 0;
    return Math.hypot(a.x + dx * t - o.x, a.z + dz * t - o.z) >= o.radius + MARGIN;
  });
}
// Only obstacle-crossing routes need the small grid search. Keep the resulting route smooth.
export function planPath(start, requested, layout) {
  const target = resolveDestination(requested, layout);
  if (segmentClear(start, target, layout)) return [target];
  const nodes = [];
  for (let x = Math.ceil(layout.bounds.minX); x <= Math.floor(layout.bounds.maxX); x++) for (let z = Math.ceil(layout.bounds.minZ); z <= Math.floor(layout.bounds.maxZ); z++) if (isWalkable({ x, z }, layout)) nodes.push({ x, z });
  const nearest = p => nodes.filter(n => segmentClear(p, n, layout)).sort((a, b) => Math.hypot(a.x - p.x, a.z - p.z) - Math.hypot(b.x - p.x, b.z - p.z))[0];
  const first = nearest(start), last = nearest(target); if (!first || !last) return [];
  const key = p => `${p.x},${p.z}`, byKey = new Map(nodes.map(n => [key(n), n]));
  const open = [first], cost = new Map([[key(first), 0]]), previous = new Map();
  const heuristic = p => Math.hypot(p.x - last.x, p.z - last.z);
  while (open.length) {
    open.sort((a, b) => cost.get(key(a)) + heuristic(a) - cost.get(key(b)) - heuristic(b));
    const current = open.shift();
    if (current === last) {
      const path = [target]; let cursor = current;
      while (cursor) { path.unshift(cursor); cursor = previous.get(key(cursor)); }
      const smooth = []; let from = start, i = 0;
      while (i < path.length) {
        let end = path.length - 1; while (end > i && !segmentClear(from, path[end], layout)) end--;
        smooth.push(path[end]); from = path[end]; i = end + 1;
      }
      return smooth;
    }
    for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) {
      if (!dx && !dz) continue;
      const next = byKey.get(`${current.x + dx},${current.z + dz}`); if (!next || !segmentClear(current, next, layout)) continue;
      const candidate = cost.get(key(current)) + Math.hypot(dx, dz);
      if (candidate < (cost.get(key(next)) ?? Infinity)) { cost.set(key(next), candidate); previous.set(key(next), current); if (!open.includes(next)) open.push(next); }
    }
  }
  return [];
}

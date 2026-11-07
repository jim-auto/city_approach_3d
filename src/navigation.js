const MARGIN = .34;
const grids = new WeakMap();
function inside(p, r, margin = MARGIN) { return p.x >= r.minX + margin && p.x <= r.maxX - margin && p.z >= r.minZ + margin && p.z <= r.maxZ - margin; }
export function isWalkable(point, layout) {
  const b = layout.bounds;
  return inside(point, b, 0) && (!layout.walkways || layout.walkways.some(r => inside(point, r))) && layout.obstacles.every(o => Math.hypot(point.x - o.x, point.z - o.z) >= o.radius + MARGIN - .001);
}
export function resolveDestination(point, layout) {
  const b = layout.bounds;
  let p = { x: Math.min(b.maxX, Math.max(b.minX, point.x)), z: Math.min(b.maxZ, Math.max(b.minZ, point.z)) };
  if (layout.walkways && !layout.walkways.some(r => inside(p, r))) {
    p = layout.walkways.map(r => ({ x: Math.min(r.maxX - MARGIN - .02, Math.max(r.minX + MARGIN + .02, p.x)), z: Math.min(r.maxZ - MARGIN - .02, Math.max(r.minZ + MARGIN + .02, p.z)) }))
      .sort((a, b) => Math.hypot(a.x - point.x, a.z - point.z) - Math.hypot(b.x - point.x, b.z - point.z))[0];
  }
  for (const o of layout.obstacles) {
    const dx = p.x - o.x, dz = p.z - o.z, length = Math.hypot(dx, dz), radius = o.radius + MARGIN + .02;
    if (length < radius) { p.x = o.x + (length ? dx / length : 1) * radius; p.z = o.z + (length ? dz / length : 0) * radius; }
  }
  return p;
}
function clip(a, b, r) {
  let lo = 0, hi = 1;
  for (const [axis, min, max] of [['x', r.minX + MARGIN, r.maxX - MARGIN], ['z', r.minZ + MARGIN, r.maxZ - MARGIN]]) {
    const delta = b[axis] - a[axis];
    if (Math.abs(delta) < 1e-9) { if (a[axis] < min || a[axis] > max) return null; }
    else { const u = (min - a[axis]) / delta, v = (max - a[axis]) / delta; lo = Math.max(lo, Math.min(u, v)); hi = Math.min(hi, Math.max(u, v)); if (hi < lo) return null; }
  }
  return [lo, hi];
}
export function segmentClear(a, b, layout) {
  if (!isWalkable(a, layout) || !isWalkable(b, layout)) return false;
  if (layout.walkways) {
    const spans = layout.walkways.map(r => clip(a, b, r)).filter(Boolean).sort((a, b) => a[0] - b[0]);
    let covered = 0;
    for (const [lo, hi] of spans) { if (lo > covered + 1e-7) return false; covered = Math.max(covered, hi); if (covered >= 1) break; }
    if (covered < 1 - 1e-7) return false;
  }
  return layout.obstacles.every(o => {
    const dx = b.x - a.x, dz = b.z - a.z, length = dx * dx + dz * dz;
    const t = length ? Math.max(0, Math.min(1, ((o.x - a.x) * dx + (o.z - a.z) * dz) / length)) : 0;
    return Math.hypot(a.x + dx * t - o.x, a.z + dz * t - o.z) >= o.radius + MARGIN;
  });
}
class Heap {
  items = [];
  push(item) { const a = this.items; a.push(item); let i = a.length - 1; while (i) { const parent = (i - 1) >> 1; if (a[parent].f <= item.f) break; a[i] = a[parent]; i = parent; } a[i] = item; }
  pop() { const a = this.items, first = a[0], last = a.pop(); if (a.length) { let i = 0; while (i * 2 + 1 < a.length) { let child = i * 2 + 1; if (child + 1 < a.length && a[child + 1].f < a[child].f) child++; if (last.f <= a[child].f) break; a[i] = a[child]; i = child; } a[i] = last; } return first; }
}
function grid(layout) {
  if (!grids.has(layout)) {
    const nodes = new Map();
    for (let x = Math.ceil(layout.bounds.minX); x <= Math.floor(layout.bounds.maxX); x++) for (let z = Math.ceil(layout.bounds.minZ); z <= Math.floor(layout.bounds.maxZ); z++) if (isWalkable({ x, z }, layout)) nodes.set(`${x},${z}`, { x, z });
    grids.set(layout, nodes);
  }
  return grids.get(layout);
}
export function planPath(start, requested, layout) {
  const target = resolveDestination(requested, layout);
  if (segmentClear(start, target, layout)) return [target];
  const nodes = grid(layout);
  const nearest = p => {
    for (let radius = 0; radius < 5; radius++) {
      const candidates = [];
      for (let x = Math.round(p.x) - radius; x <= Math.round(p.x) + radius; x++) for (let z = Math.round(p.z) - radius; z <= Math.round(p.z) + radius; z++) {
        const n = nodes.get(`${x},${z}`); if (n && segmentClear(p, n, layout)) candidates.push(n);
      }
      if (candidates.length) return candidates.sort((a, b) => Math.hypot(a.x - p.x, a.z - p.z) - Math.hypot(b.x - p.x, b.z - p.z))[0];
    }
  };
  const first = nearest(start), last = nearest(target); if (!first || !last) return [];
  const open = new Heap(), cost = new Map([[first, 0]]), previous = new Map(), closed = new Set();
  const heuristic = p => Math.hypot(p.x - last.x, p.z - last.z);
  open.push({ node: first, f: heuristic(first) });
  while (open.items.length) {
    const current = open.pop().node; if (closed.has(current)) continue; closed.add(current);
    if (current === last) {
      const path = [target]; let cursor = current;
      while (cursor) { path.unshift(cursor); cursor = previous.get(cursor); }
      const smooth = []; let from = start, i = 0;
      while (i < path.length) { let end = path.length - 1; while (end > i && !segmentClear(from, path[end], layout)) end--; smooth.push(path[end]); from = path[end]; i = end + 1; }
      return smooth;
    }
    for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) {
      if (!dx && !dz) continue;
      const next = nodes.get(`${current.x + dx},${current.z + dz}`);
      if (!next || closed.has(next) || !segmentClear(current, next, layout)) continue;
      const candidate = cost.get(current) + Math.hypot(dx, dz);
      if (candidate < (cost.get(next) ?? Infinity)) { cost.set(next, candidate); previous.set(next, current); open.push({ node: next, f: candidate + heuristic(next) }); }
    }
  }
  return [];
}

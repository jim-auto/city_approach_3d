import * as THREE from 'three';

// Continuous indexed surfaces retain smooth vertex normals after the parts are merged.
export function loftGeometry(rings, segments = 20) {
  const vertices = [], indices = [];
  for (const [y, width, depth, z = 0] of rings) for (let i = 0; i <= segments; i++) {
    const a = i / segments * Math.PI * 2; vertices.push(Math.sin(a) * width, y, Math.cos(a) * depth + z);
  }
  for (let j = 0; j < rings.length - 1; j++) for (let i = 0; i < segments; i++) {
    const a = j * (segments + 1) + i, b = a + segments + 1;
    indices.push(a, a + 1, b, a + 1, b + 1, b);
  }
  return smoothSeam(geometry(vertices, indices), rings.length, segments);
}
function smoothSeam(g, rows, segments) {
  const n = g.attributes.normal, normal = new THREE.Vector3();
  for (let row = 0; row < rows; row++) {
    const a = row * (segments + 1), b = a + segments;
    normal.set(n.getX(a) + n.getX(b), n.getY(a) + n.getY(b), n.getZ(a) + n.getZ(b)).normalize();
    n.setXYZ(a, normal.x, normal.y, normal.z); n.setXYZ(b, normal.x, normal.y, normal.z);
  }
  return g;
}
function geometry(vertices, indices) {
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3)); g.setIndex(indices); g.computeVertexNormals(); return g;
}
function headRings(feminine) {
  return [[-.205, .025, .035, .015], [-.18, feminine ? .073 : .092, .078, .014], [-.135, feminine ? .118 : .132, .113, .008], [-.07, .151, .137, 0], [.01, .162, .144, -.003], [.09, .154, .137, -.008], [.155, .127, .111, -.012], [.19, .073, .062, -.015], [.202, .004, .004, -.015]];
}
export function faceFront(x, y, feminine) {
  const rings = headRings(feminine);
  let a = rings[0], b = rings[1];
  for (let i = 1; i < rings.length; i++) { a = rings[i - 1]; b = rings[i]; if (y <= b[0]) break; }
  const t = THREE.MathUtils.clamp((y - a[0]) / (b[0] - a[0]), 0, 1), w = THREE.MathUtils.lerp(a[1], b[1], t), d = THREE.MathUtils.lerp(a[2], b[2], t), z = THREE.MathUtils.lerp(a[3], b[3], t);
  return z + d * Math.sqrt(Math.max(0, 1 - (x / w) ** 2)) + .018 * Math.exp(-1 * (x / .022) ** 2 - ((y + .034) / .043) ** 2);
}
export function headGeometry(feminine, detailed) {
  const rings = headRings(feminine), segments = detailed ? 32 : 16;
  const g = loftGeometry(rings, segments), p = g.attributes.position;
  for (let j = 0; j < rings.length; j++) for (let i = 0; i <= segments; i++) {
    const index = j * (segments + 1) + i, a = i / segments * Math.PI * 2;
    if (Math.cos(a) > 0) p.setZ(index, faceFront(p.getX(index), p.getY(index), feminine));
  }
  g.computeVertexNormals(); smoothSeam(g, rings.length, segments); g.userData.skinGradient = true; return g;
}
export function facePatch(cx, cy, width, height, feminine, almond = false, offset = .002, segments = 20) {
  const vertices = [cx, cy, faceFront(cx, cy, feminine) + offset], indices = [];
  for (let i = 0; i <= segments; i++) {
    const a = i / segments * Math.PI * 2, dx = Math.cos(a) * width;
    const x = cx + dx, y = cy + Math.sin(a) * height * (almond && Math.sin(a) < 0 ? .65 : 1) + (almond ? Math.sign(cx) * dx * .07 : 0);
    vertices.push(x, y, faceFront(x, y, feminine) + offset);
    if (i) indices.push(0, i, i + 1);
  }
  return geometry(vertices, indices);
}
export function faceStroke(points, width, feminine, offset = .003) {
  const curve = new THREE.CatmullRomCurve3(points.map(([x, y]) => new THREE.Vector3(x, y, 0)));
  const vertices = [], indices = [], steps = 16;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps, p = curve.getPoint(t), tangent = curve.getTangent(t), taper = .35 + .65 * Math.sin(Math.PI * t) ** .45;
    for (const side of [-1, 1]) { const x = p.x - tangent.y * width * side * taper, y = p.y + tangent.x * width * side * taper; vertices.push(x, y, faceFront(x, y, feminine) + offset); }
    if (i < steps) { const a = i * 2; indices.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
  }
  return geometry(vertices, indices);
}
export function strandGeometry(points, widths, depths, detailed = true) {
  const curve = new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p))), steps = detailed ? 12 : 6, radial = detailed ? 8 : 5;
  const frames = curve.computeFrenetFrames(steps, false), vertices = [], indices = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps, p = curve.getPoint(t), k = Math.min(points.length - 2, Math.floor(t * (points.length - 1))), u = t * (points.length - 1) - k;
    const w = THREE.MathUtils.lerp(widths[k], widths[k + 1], u), d = THREE.MathUtils.lerp(depths[k], depths[k + 1], u);
    for (let j = 0; j <= radial; j++) {
      const a = j / radial * Math.PI * 2, q = p.clone().addScaledVector(frames.normals[i], Math.cos(a) * w).addScaledVector(frames.binormals[i], Math.sin(a) * d); vertices.push(q.x, q.y, q.z);
    }
    if (i < steps) for (let j = 0; j < radial; j++) { const a = i * (radial + 1) + j, b = a + radial + 1; indices.push(a, a + 1, b, a + 1, b + 1, b); }
  }
  return smoothSeam(geometry(vertices, indices), steps + 1, radial);
}
function hairCap(detailed) {
  const segments = detailed ? 32 : 16, rows = detailed ? 10 : 6, vertices = [], indices = [];
  for (let j = 0; j <= rows; j++) for (let i = 0; i <= segments; i++) {
    const a = i / segments * Math.PI * 2, front = Math.cos(a), limit = front > 0 ? 1.18 + (1 - front) * .65 : 1.83 - front * .65;
    const theta = .015 + j / rows * (limit - .015);
    vertices.push(.188 * Math.sin(theta) * Math.sin(a), .025 + .225 * Math.cos(theta), -.02 + .175 * Math.sin(theta) * Math.cos(a));
    if (j < rows && i < segments) { const b = j * (segments + 1) + i, c = b + segments + 1; indices.push(b, c, b + 1, b + 1, c, c + 1); }
  }
  return smoothSeam(geometry(vertices, indices), rows + 1, segments);
}
function hairCurtain(style, detailed) {
  const rows = 7, segments = detailed ? 24 : 12, long = style === 'long' || style === 'wavy', length = long ? .54 : .26;
  const vertices = [], indices = [], count = (rows + 1) * (segments + 1);
  for (let layer = 0; layer < 2; layer++) for (let j = 0; j <= rows; j++) for (let i = 0; i <= segments; i++) {
    const t = j / rows, a = .43 * Math.PI + i / segments * Math.PI * 1.14, wave = style === 'wavy' ? .012 * Math.sin(t * 12 + a * 4) : .003 * Math.sin(a * 9);
    const w = .17 + Math.sin(t * Math.PI) * (long ? .035 : .016) + wave - layer * .012;
    const y = .06 - length * t - .012 * Math.cos(a * 7) * t ** 5;
    vertices.push(w * Math.sin(a), y, -.023 + (.15 + t * .025 - layer * .012 + wave) * Math.cos(a));
    if (j < rows && i < segments) { const b = layer * count + j * (segments + 1) + i, c = b + segments + 1; if (layer) indices.push(b, b + 1, c, b + 1, c + 1, c); else indices.push(b, c, b + 1, b + 1, c, c + 1); }
  }
  for (let j = 0; j < rows; j++) for (const i of [0, segments]) { const a = j * (segments + 1) + i, b = a + segments + 1; indices.push(a, a + count, b, b, a + count, b + count); }
  for (let i = 0; i < segments; i++) { const a = rows * (segments + 1) + i; indices.push(a, a + 1, a + count, a + 1, a + count + 1, a + count); }
  return geometry(vertices, indices);
}
export function buildHead(b, look, hair, detailed) {
  const f = !!look.feminine, lightHair = new THREE.Color(hair).multiplyScalar(1.10);
  b.geometry(headGeometry(f, detailed), look.skin);
  for (const side of [-1, 1]) {
    b.ball(look.skin, [side * .16, -.025, -.008], [.023, .039, .019]);
    const cx = side * .062, cy = .008;
    b.geometry(facePatch(cx, cy, f ? .039 : .036, f ? .016 : .011, f, true), '#e8e2df');
    b.geometry(facePatch(cx, cy + .001, .012, f ? .017 : .012, f, false, .003), f ? '#6c4850' : '#4a4244');
    b.geometry(facePatch(cx, cy + .001, .006, .009, f, false, .004), '#242431');
    if (detailed) {
      b.geometry(facePatch(cx - .004, cy + .007, .003, .003, f, false, .005, 10), '#fff7ed');
      b.geometry(faceStroke([[cx - .037, cy], [cx, cy + (f ? .015 : .012)], [cx + .037, cy + side * .005]], f ? .0022 : .0017, f, .004), '#49323c');
      b.geometry(faceStroke([[cx - .035, .050], [cx, .057], [cx + .033, .049 + side * .004]], f ? .003 : .004, f), hair);
      if (f) b.ball('#d7be8a', [side * .17, -.067, .008], [.007, .018, .007]);
    }
  }
  b.geometry(faceStroke([[-.023, -.102], [0, -.106], [.024, -.100]], f ? .0025 : .0018, f), f ? '#b5717a' : '#925e5e');
  if (detailed && f) b.geometry(faceStroke([[-.015, -.111], [0, -.113], [.015, -.109]], .0015, f), '#d9979c');
  b.geometry(hairCap(detailed), hair);
  if (['long', 'bob', 'wavy'].includes(look.hair)) b.geometry(hairCurtain(look.hair, detailed), hair);
  const strand = (points, widths, depths, color = hair) => b.geometry(strandGeometry(points, widths, depths, detailed), color);
  if (f || ['long', 'bob', 'wavy', 'ponytail'].includes(look.hair)) {
    for (const side of [-1, 1]) {
      strand([[side * .01, .218, .01], [side * .08, .178, .126], [side * .14, .071, .133], [side * .15, .027, .11]], [.035, .043, .032, .002], [.015, .018, .013, .002], side < 0 ? hair : lightHair);
      if (look.hair !== 'ponytail') strand([[side * .15, .08, .07], [side * .178, -.025, .072], [side * .16, -.20, .065], [side * .14, look.hair === 'bob' ? -.25 : -.35, .025]], [.023, .029, .022, .001], [.018, .019, .016, .001]);
    }
  } else {
    strand([[-.14, .105, .085], [-.09, .22, .06], [.055, .205, .12], [.14, .075, .12]], [.025, .044, .042, .001], [.016, .020, .018, .001], lightHair);
    strand([[-.14, .11, .09], [-.11, .165, .12], [-.03, .14, .155], [.09, .06, .14]], [.020, .032, .025, .001], [.013, .017, .013, .001]);
  }
  if (look.hair === 'ponytail') {
    strand([[0, .11, -.13], [0, .07, -.23], [.02, -.17, -.27], [.045, -.43, -.20]], [.045, .06, .045, .001], [.034, .04, .03, .001]);
    b.arc('#c0a374', [0, .085, -.195], .044, .007, [0, 0, 0]);
  }
  if (look.glasses) { for (const side of [-1, 1]) b.arc('#675462', [side * .063, .009, .145], .043, .0035); b.geometry(faceStroke([[-.019, .016], [0, .023], [.019, .016]], .002, f, .009), '#675462'); }
  if (look.accessory === 'headphones') { b.arc('#b9a9c9', [0, .026, -.012], .19, .014, [0, 0, 0], Math.PI); for (const side of [-1, 1]) { b.ball('#b9a9c9', [side * .18, -.025, -.012], [.025, .055, .045]); b.ball('#5c536b', [side * .197, -.025, -.012], [.012, .039, .031]); } }
}

export function loftFront(rings, x, y) {
  let a = rings[0], b = rings[1];
  for (let i = 1; i < rings.length; i++) { a = rings[i - 1]; b = rings[i]; if (y <= b[0]) break; }
  const t = THREE.MathUtils.clamp((y - a[0]) / (b[0] - a[0]), 0, 1), w = THREE.MathUtils.lerp(a[1], b[1], t), d = THREE.MathUtils.lerp(a[2], b[2], t);
  return THREE.MathUtils.lerp(a[3] || 0, b[3] || 0, t) + d * Math.sqrt(Math.max(0, 1 - (x / w) ** 2));
}
export function clothPanelGeometry(rings, width, minY, maxY, detailed = true) {
  const columns = detailed ? 8 : 4, rows = detailed ? 8 : 4, vertices = [], indices = [];
  for (let j = 0; j <= rows; j++) for (let i = 0; i <= columns; i++) {
    const x = (i / columns * 2 - 1) * width, y = THREE.MathUtils.lerp(minY, maxY, j / rows);
    vertices.push(x, y, loftFront(rings, x, y) + .012);
    if (j < rows && i < columns) { const a = j * (columns + 1) + i, b = a + columns + 1; indices.push(a, a + 1, b, a + 1, b + 1, b); }
  }
  return geometry(vertices, indices);
}
export function lapelGeometry(rings, points) {
  const vertices = points.flatMap(([x, y]) => [x, y, loftFront(rings, x, y) + .020]);
  const faces = THREE.ShapeUtils.triangulateShape(points.map(([x, y]) => new THREE.Vector2(x, y)), []);
  const indices = [];
  for (const [a, b, c] of faces) {
    const u = points[b][0] - points[a][0], v = points[b][1] - points[a][1], s = points[c][0] - points[a][0], t = points[c][1] - points[a][1];
    indices.push(a, ...(u * t - v * s > 0 ? [b, c] : [c, b]));
  }
  return geometry(vertices, indices);
}

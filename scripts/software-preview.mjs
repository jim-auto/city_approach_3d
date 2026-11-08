import * as THREE from 'three';

// Offline depth-buffered geometry preview; never opens or controls a browser.
// Interpolated normals and vertex colours avoid SVG painter-order artifacts on layered clothing.
export function renderGeometry(scene, camera, width, height) {
  const rgb = new Uint8Array(width * height * 3), depth = new Float32Array(width * height); depth.fill(Infinity);
  for (let i = 0; i < rgb.length; i += 3) { rgb[i] = 39; rgb[i + 1] = 51; rgb[i + 2] = 69; }
  scene.updateMatrixWorld(true); camera.updateMatrixWorld(true);
  const light = new THREE.Vector3(-3, 5, 6).normalize(), eye = camera.getWorldDirection(new THREE.Vector3()).negate(), half = light.clone().add(eye).normalize();
  const meshes = []; scene.traverseVisible(o => { if (o.isMesh) meshes.push(o); }); meshes.sort((a, b) => Number(a.material.transparent) - Number(b.material.transparent));
  const linear = n => n <= .04045 ? n / 12.92 : ((n + .055) / 1.055) ** 2.4;
  const srgb = n => Math.max(0, Math.min(255, Math.round(255 * (n <= .0031308 ? n * 12.92 : 1.055 * n ** (1 / 2.4) - .055))));
  for (const mesh of meshes) {
    const g = mesh.geometry, positions = g.attributes.position, normals = g.attributes.normal, colors = g.attributes.color;
    const normalMatrix = new THREE.Matrix3().getNormalMatrix(mesh.matrixWorld), vertices = [];
    const base = mesh.material.color || new THREE.Color('#ffffff'), uv = g.attributes.uv, texture = mesh.material.map?.image;
    const boneMatrix = new THREE.Matrix4(), skinMatrix = new THREE.Matrix4(), skinNormal = new THREE.Matrix3();
    for (let i = 0; i < positions.count; i++) {
      const p = mesh.getVertexPosition(i, new THREE.Vector3()).applyMatrix4(mesh.matrixWorld).project(camera);
      const n = new THREE.Vector3().fromBufferAttribute(normals, i);
      if (mesh.isSkinnedMesh) {
        skinMatrix.elements.fill(0);
        const joints = g.attributes.skinIndex, weights = g.attributes.skinWeight;
        for (let k = 0; k < 4; k++) {
          const joint = joints.getComponent(i, k), weight = weights.getComponent(i, k);
          boneMatrix.multiplyMatrices(mesh.skeleton.bones[joint].matrixWorld, mesh.skeleton.boneInverses[joint]);
          for (let e = 0; e < 16; e++) skinMatrix.elements[e] += boneMatrix.elements[e] * weight;
        }
        skinMatrix.premultiply(mesh.bindMatrixInverse).multiply(mesh.bindMatrix);
        n.applyMatrix3(skinNormal.getNormalMatrix(skinMatrix));
      }
      n.applyMatrix3(normalMatrix).normalize();
      vertices.push({ x: (p.x * .5 + .5) * width, y: (-p.y * .5 + .5) * height, z: p.z, nx: n.x, ny: n.y, nz: n.z, tu: uv?.getX(i) || 0, tv: uv?.getY(i) || 0, r: colors ? colors.getX(i) : base.r, g: colors ? colors.getY(i) : base.g, b: colors ? colors.getZ(i) : base.b });
    }
    const count = g.index ? g.index.count : positions.count;
    for (let j = 0; j < count; j += 3) {
      const a = vertices[g.index ? g.index.getX(j) : j], b = vertices[g.index ? g.index.getX(j + 1) : j + 1], c = vertices[g.index ? g.index.getX(j + 2) : j + 2];
      const area = (c.x - a.x) * (b.y - a.y) - (c.y - a.y) * (b.x - a.x);
      if (area <= 1e-8 && mesh.material.side !== THREE.DoubleSide) continue;
      if (Math.abs(area) < 1e-8) continue;
      const minX = Math.max(0, Math.floor(Math.min(a.x, b.x, c.x))), maxX = Math.min(width - 1, Math.ceil(Math.max(a.x, b.x, c.x)));
      const minY = Math.max(0, Math.floor(Math.min(a.y, b.y, c.y))), maxY = Math.min(height - 1, Math.ceil(Math.max(a.y, b.y, c.y)));
      for (let y = minY; y <= maxY; y++) for (let x = minX; x <= maxX; x++) {
        const px = x + .5, py = y + .5;
        const u = ((px - b.x) * (c.y - b.y) - (py - b.y) * (c.x - b.x)) / area;
        const v = ((px - c.x) * (a.y - c.y) - (py - c.y) * (a.x - c.x)) / area;
        const w = 1 - u - v;
        if (u < 0 || v < 0 || w < 0) continue;
        const z = a.z * u + b.z * v + c.z * w, index = y * width + x;
        if (z < -1 || z > 1 || z >= depth[index]) continue;
        const nx = a.nx * u + b.nx * v + c.nx * w, ny = a.ny * u + b.ny * v + c.ny * w, nz = a.nz * u + b.nz * v + c.nz * w;
        const length = Math.hypot(nx, ny, nz) || 1;
        const diffuse = .39 + .77 * Math.max(0, (nx * light.x + ny * light.y + nz * light.z) / length);
        const specular = .045 * Math.max(0, (nx * half.x + ny * half.y + nz * half.z) / length) ** 30;
        let channels = ['r', 'g', 'b'].map(key => mesh.material.isMeshBasicMaterial ? a[key] * u + b[key] * v + c[key] * w : (a[key] * u + b[key] * v + c[key] * w) * diffuse + specular);
        let alpha = mesh.material.opacity ?? 1;
        if (texture?.data) {
          const tu = Math.max(0, Math.min(.999999, a.tu * u + b.tu * v + c.tu * w)), tv = Math.max(0, Math.min(.999999, a.tv * u + b.tv * v + c.tv * w));
          const ti = (Math.floor(tv * texture.height) * texture.width + Math.floor(tu * texture.width)) * 4;
          alpha *= texture.data[ti + 3] / 255;
          if (alpha < Math.max(.005, mesh.material.alphaTest || 0)) continue;
          channels = channels.map((value, k) => value * linear(texture.data[ti + k] / 255));
        }
        for (let k = 0; k < 3; k++) rgb[index * 3 + k] = Math.round(srgb(channels[k]) * alpha + rgb[index * 3 + k] * (1 - alpha));
        if (mesh.material.depthWrite !== false) depth[index] = z;
      }
    }
  }
  return rgb;
}

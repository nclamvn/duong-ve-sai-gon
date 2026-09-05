/**
 * Nướng skin tầm thường (Sketchfab: mesh buộc vài joint ở bind pose) thành geometry tĩnh — dùng chung convert-weapon (TIP-D10)
 * (convert-model.mjs còn bản inline từ TIP-021). Vị trí = Σ w·(J·IBM)·p; bỏ JOINTS/WEIGHTS/TANGENT; node về gốc scene, ma trận đơn vị.
 */
const mat4mul = (a, b) => {
  const o = new Array(16).fill(0);
  for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) for (let k = 0; k < 4; k++) o[c * 4 + r] += a[k * 4 + r] * b[c * 4 + k];
  return o;
};

/** @returns số node đã nướng */
export function bakeSkins(scene) {
  const skinned = [];
  scene.traverse((node) => {
    if (node.getSkin() && node.getMesh()) skinned.push(node);
  });
  for (const node of skinned) {
    const skin = node.getSkin();
    const joints = skin.listJoints();
    const ibm = skin.getInverseBindMatrices()?.getArray();
    const jm = joints.map((j, i) => {
      const w = j.getWorldMatrix();
      return ibm ? mat4mul(w, Array.from(ibm.slice(i * 16, i * 16 + 16))) : w;
    });
    for (const prim of node.getMesh().listPrimitives()) {
      const pos = prim.getAttribute('POSITION');
      const nor = prim.getAttribute('NORMAL');
      const jnt = prim.getAttribute('JOINTS_0');
      const wgt = prim.getAttribute('WEIGHTS_0');
      if (!pos || !jnt || !wgt) continue;
      const pa = pos.getArray();
      const na = nor?.getArray();
      const ja = jnt.getArray();
      const wa = wgt.getArray();
      const outP = new Float32Array(pa.length);
      const outN = na ? new Float32Array(na.length) : null;
      const n = pos.getCount();
      for (let v = 0; v < n; v++) {
        const px = pa[v * 3], py = pa[v * 3 + 1], pz = pa[v * 3 + 2];
        let x = 0, y = 0, z = 0, nx = 0, ny = 0, nz = 0;
        for (let k = 0; k < 4; k++) {
          const w = wa[v * 4 + k];
          if (!w) continue;
          const m = jm[ja[v * 4 + k]];
          if (!m) continue;
          x += w * (m[0] * px + m[4] * py + m[8] * pz + m[12]);
          y += w * (m[1] * px + m[5] * py + m[9] * pz + m[13]);
          z += w * (m[2] * px + m[6] * py + m[10] * pz + m[14]);
          if (na) {
            const qx = na[v * 3], qy = na[v * 3 + 1], qz = na[v * 3 + 2];
            nx += w * (m[0] * qx + m[4] * qy + m[8] * qz);
            ny += w * (m[1] * qx + m[5] * qy + m[9] * qz);
            nz += w * (m[2] * qx + m[6] * qy + m[10] * qz);
          }
        }
        outP[v * 3] = x;
        outP[v * 3 + 1] = y;
        outP[v * 3 + 2] = z;
        if (outN) {
          const l = Math.hypot(nx, ny, nz) || 1;
          outN[v * 3] = nx / l;
          outN[v * 3 + 1] = ny / l;
          outN[v * 3 + 2] = nz / l;
        }
      }
      pos.setArray(outP);
      if (nor && outN) nor.setArray(outN);
      prim.setAttribute('JOINTS_0', null);
      prim.setAttribute('WEIGHTS_0', null);
      const tan = prim.getAttribute('TANGENT');
      if (tan) prim.setAttribute('TANGENT', null);
    }
    node.setSkin(null);
    const parent = node.getParentNode();
    if (parent) parent.removeChild(node);
    scene.addChild(node);
    node.setMatrix([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
  }
  return skinned.length;
}

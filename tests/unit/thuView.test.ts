/**
 * DV-078 tư thế Thu dựng bằng code: dựng cây xương từ chính chr_thu.glb (đọc JSON của GLB, không cần GPU), chạy ThuView.update,
 * kiểm hướng xương tay đúng hướng mong muốn trong hệ thân (tay trái buông, tay phải giơ đèn trước mặt, cẳng tay hướng lên).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { Bone, Group, Object3D, Vector3 } from 'three/webgpu';
import { ThuView } from '@game/night/thuView';

interface GNode { name?: string; children?: number[]; translation?: number[]; rotation?: number[]; scale?: number[] }

function loadRig(): Object3D {
  const buf = readFileSync('public/assets/characters/chr_thu.glb');
  const len = buf.readUInt32LE(12);
  const json = JSON.parse(buf.subarray(20, 20 + len).toString('utf8')) as { nodes: GNode[]; scenes: Array<{ nodes: number[] }>; skins: Array<{ joints: number[] }> };
  const joints = new Set(json.skins[0]!.joints);
  const objs = json.nodes.map((n, i) => {
    const o = joints.has(i) ? new Bone() : new Object3D();
    o.name = n.name ?? '';
    if (n.translation) o.position.fromArray(n.translation);
    if (n.rotation) o.quaternion.fromArray(n.rotation);
    if (n.scale) o.scale.fromArray(n.scale);
    return o;
  });
  json.nodes.forEach((n, i) => n.children?.forEach((c) => objs[i]!.add(objs[c]!)));
  const root = new Group();
  for (const i of json.scenes[0]!.nodes) root.add(objs[i]!);
  return root;
}

const dirOf = (root: Object3D, a: string, b: string): Vector3 => {
  const pa = root.getObjectByName(a)!.getWorldPosition(new Vector3());
  const pb = root.getObjectByName(b)!.getWorldPosition(new Vector3());
  return pb.sub(pa).normalize();
};

describe('DV-078 ThuView', () => {
  it('tay trái buông xuống, tay phải giơ đèn ra trước, cẳng tay phải hướng lên; đèn dưới tay, nón trên đầu', () => {
    const body = loadRig();
    const lamp = new Object3D();
    const hat = new Object3D();
    const yaw = 0.8;
    const v = new ThuView(body, lamp, hat, [10, 2, -5], yaw);
    const parent = new Group();
    v.attach(parent);
    v.wave = 0;
    v.update(1 / 60);
    parent.updateMatrixWorld(true);
    // hướng thân: trước = (sin yaw, 0, cos yaw), trái (của Thu) = (cos yaw, 0, −sin yaw)
    const fwd = new Vector3(Math.sin(yaw), 0, Math.cos(yaw));
    const left = new Vector3(Math.cos(yaw), 0, -Math.sin(yaw));
    const lu = dirOf(body, 'mixamorigLeftArm', 'mixamorigLeftForeArm');
    expect(lu.y).toBeLessThan(-0.9);
    const ru = dirOf(body, 'mixamorigRightArm', 'mixamorigRightForeArm');
    expect(ru.dot(fwd)).toBeGreaterThan(0.7);
    expect(ru.dot(left)).toBeLessThan(-0.2);
    const rf = dirOf(body, 'mixamorigRightForeArm', 'mixamorigRightHand');
    expect(rf.y).toBeGreaterThan(0.6);
    const hand = body.getObjectByName('mixamorigRightHand')!.getWorldPosition(new Vector3());
    const head = body.getObjectByName('mixamorigHead')!.getWorldPosition(new Vector3());
    expect(hand.y).toBeGreaterThan(head.y - 0.25);
    expect(lamp.position.y).toBeLessThan(hand.y);
    expect(hat.position.y).toBeGreaterThan(head.y);
  });
});

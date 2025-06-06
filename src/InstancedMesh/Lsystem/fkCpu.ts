import { mat4, vec3 } from 'gl-matrix';

type Vec3 = [number, number, number];

interface Segment {
  A: Vec3;
  B: Vec3;
  parentId: number;
  depth: number;
  isBranchStart: boolean;
  // ... nếu có thêm field gì thì thêm vô
}

export function applyFK(segments: Segment[], time: number): Segment[] {
  const result: Segment[] = new Array(segments.length);
  const transformMap = new Map<number, mat4>();

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];

    // Tạo bản sao A/B
    const A = vec3.fromValues(...seg.A);
    const B = vec3.fromValues(...seg.B);

    // Gốc quay là A
    const pivot = vec3.clone(A);

    // Xoay nhẹ quanh trục Z
    const angle = Math.sin(time + i * 0.15) * 0.1;
    const axis: vec3 = [0, 0, 1];

    // Tạo local transform
    const localTransform = mat4.create();
    mat4.translate(localTransform, localTransform, pivot);
    mat4.rotate(localTransform, localTransform, angle, axis);
   mat4.translate(localTransform, localTransform, vec3.negate(vec3.create(), pivot));


    // Nếu có cha thì nhân kế thừa
    const parentTransform = seg.parentId !== -1 ? transformMap.get(seg.parentId) : null;
    const worldTransform = mat4.create();
    if (parentTransform) {
      mat4.multiply(worldTransform, parentTransform, localTransform);
    } else {
      mat4.copy(worldTransform, localTransform);
    }

    // Apply transform cho A và B
    const transformedA = vec3.transformMat4(vec3.create(), A, worldTransform);
    const transformedB = vec3.transformMat4(vec3.create(), B, worldTransform);

    result[i] = {
      ...seg,
      A: [transformedA[0], transformedA[1], transformedA[2]],
      B: [transformedB[0], transformedB[1], transformedB[2]],
    };

    transformMap.set(i, worldTransform);
  }

  return result;
}

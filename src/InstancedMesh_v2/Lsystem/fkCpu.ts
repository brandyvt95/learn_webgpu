import { mat4, vec3 } from '../../lib_strager/gl-matrix/dist/esm/index.js';

type Vec3 = [number, number, number];

interface Segment {
  A: Vec3;
  B: Vec3;
  parentId: number;
  depth: number;
  isBranchStart: boolean;
  // ... nếu có thêm field gì thì thêm vô
}

// Lưu trữ transform bổ sung cho từng segment
const segmentTransforms = new Map<number, any>();

export function applyFK(segments: Segment[], time: number): Segment[] {
  const result: Segment[] = new Array(segments.length);
  const transformMap = new Map<number, any>();

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];

    // Tạo bản sao A/B
    const A = vec3.fromValues(...seg.A);
    const B = vec3.fromValues(...seg.B);

    // Gốc quay là A
    const pivot = vec3.clone(A);

    // Xoay nhẹ quanh trục Z (animation tự nhiên)
    const angle = Math.sin(time + i * 0.15) * 0.1;
    const axis: any = [0, 0, 1];

    // Tạo local transform
    const localTransform = mat4.create();
    mat4.translate(localTransform, localTransform, pivot);
    mat4.rotate(localTransform, localTransform, angle, axis);
    mat4.translate(localTransform, localTransform, vec3.negate(vec3.create(), pivot));

    // **ĐIỂM MỚI**: Nếu segment này có transform bổ sung thì nhân vào
    const additionalTransform = segmentTransforms.get(i);
    if (additionalTransform) {
      mat4.multiply(localTransform, additionalTransform, localTransform);
    }

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
export function applyStaticFK(segments: Segment[]): Segment[] {
  const result: Segment[] = new Array(segments.length);
  const transformMap = new Map<number, any>();

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];

    // Tạo bản sao A/B
    const A = vec3.fromValues(...seg.A);
    const B = vec3.fromValues(...seg.B);

    // Local transform = identity (không làm gì cả)
    const localTransform = mat4.create(); // Identity matrix

    // FK chain: nhân với parent transform
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
export function buildChains(nodes) {
  // Thêm id cho từng node theo index
  nodes.forEach((node, i) => node.id = i);

  // Tạo map parentId -> list con
  const childrenMap = {};
  for (const node of nodes) {
    if (!childrenMap[node.parentId]) childrenMap[node.parentId] = [];
    childrenMap[node.parentId].push(node);
  }

  const chains = [];

  function buildChainFromNode(node, currentChain = []) {
    // Nếu bắt đầu branch mới thì push chain hiện tại rồi tạo chain mới
    if (node.isBranchStart && currentChain.length > 0) {
      chains.push(currentChain);
      currentChain = [];
    }

    currentChain.push(node);

    const children = childrenMap[node.id] || [];
    if (children.length === 0) {
      // node lá, kết thúc chain
      chains.push(currentChain);
      return;
    }

    for (const child of children) {
      buildChainFromNode(child, [...currentChain]); // truyền copy để tách branch
    }
  }

  // Tìm các root node (parentId == -1)
  const roots = childrenMap[-1] || [];
  for (const root of roots) {
    buildChainFromNode(root, []);
  }

  return chains;
}


// HÀM CHÍNH: Tác động force lên 1 segment -> TẤT CẢ cây bị ảnh hưởng
export function applyForceToSegment(
  segments: Segment[], 
  targetSegmentId: number,
  force: Vec3
): Segment[] {
  const result: Segment[] = new Array(segments.length);
  const transformMap = new Map<number, any>();

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];

    // Tạo bản sao A/B
    const A = vec3.fromValues(...seg.A);
    const B = vec3.fromValues(...seg.B);

    // Local transform
    const localTransform = mat4.create();

    // **ĐIỂM QUAN TRỌNG**: Nếu đây là segment được tác động
    if (i === targetSegmentId) {
      // Apply force như translation
      mat4.translate(localTransform, localTransform, vec3.fromValues(...force));
    }

    // FK chain: nhân với parent transform
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







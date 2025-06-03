import { Mat4, mat4, quat, vec3 } from 'wgpu-matrix';
import { BoneObject } from './type';
import { GLTFSkin } from '../utils/glbUtils';

const sampleTrack = (t: number, track: any) => {
  const times = track.times;
  const values = track.values;
  const stride = track.getValueSize(); // thường bằng 3 (vec3) hoặc 4 (quat)

  if (t <= times[0]) {
    return values.slice(0, stride);
  }
  if (t >= times[times.length - 1]) {
    return values.slice((times.length - 1) * stride, times.length * stride);
  }

  for (let i = 0; i < times.length - 1; i++) {
    const t0 = times[i];
    const t1 = times[i + 1];
    if (t >= t0 && t <= t1) {
      const alpha = (t - t0) / (t1 - t0);

      // Nếu stride = 4, giả sử đây là quaternion → dùng SLERP
      if (stride === 4) {
        // Lấy tuần tự giá trị quaternion tại keyframe i và i+1
        const baseIndex0 = i * stride;
        const baseIndex1 = (i + 1) * stride;

        // Tạo 2 quat từ mảng values
        const q0 = quat.create();
        q0[0] = values[baseIndex0 + 0];
        q0[1] = values[baseIndex0 + 1];
        q0[2] = values[baseIndex0 + 2];
        q0[3] = values[baseIndex0 + 3];

        const q1 = quat.create();
        q1[0] = values[baseIndex1 + 0];
        q1[1] = values[baseIndex1 + 1];
        q1[2] = values[baseIndex1 + 2];
        q1[3] = values[baseIndex1 + 3];

        // Nội suy quaternion theo SLERP
        const outQuat = quat.create();
       quat.slerp(q0, q1, alpha, outQuat);

        // Trả về mảng 4 phần tử [x, y, z, w]
        return [outQuat[0], outQuat[1], outQuat[2], outQuat[3]];
      }

      // Ngược lại (stride = 3 hoặc khác) thì nội suy tuyến tính (position hoặc scale)
      const out: number[] = [];
      const baseIndex0 = i * stride;
      const baseIndex1 = (i + 1) * stride;

      for (let j = 0; j < stride; j++) {
        const v0 = values[baseIndex0 + j];
        const v1 = values[baseIndex1 + j];
        out.push(v0 * (1 - alpha) + v1 * alpha);
      }
      return out;
    }
  }

  // fallback (nếu vượt ngoài khoảng)
  return values.slice(0, stride);
};



function sampleTrack2(time: number, track: any): number[] | null {
  const times = track.times; // Float32Array
  const values = track.values; // Float32Array
  const valueSize = values.length / times.length; // 3 for pos, 4 for quat
  const epsilon = 1e-4; // độ lệch nhỏ cho phép

  for (let i = 0; i < times.length; i++) {
    if (Math.abs(time - times[i]) < epsilon) {
      const offset = i * valueSize;

      return Array.from(values.slice(offset, offset + valueSize));
    }
  }

  // Không khớp time nào
  return null;
}
const sanitizeName = (name: string) => name.replace(/\./g, '');
export const animWhaleSkin = (skin: GLTFSkin, animationClip: any, t: number, whaleScene: any) => {
  let elapsedTime = t;
  elapsedTime /= 10
  for (let i = 0; i < skin.joints.length; i++) {

    const joint = skin.joints[i];
    const node = whaleScene.nodes[joint];
    if (!node) continue;
    const jointName = sanitizeName(node.name);

    const positionTrack = animationClip.tracks.find((track: any) => track.name === `${jointName}.position`);

    const quaternionTrack = animationClip.tracks.find((track: any) => track.name === `${jointName}.quaternion`);
    const scaleTrack = animationClip.tracks.find((track: any) => track.name === `${jointName}.scale`);

    if (!positionTrack || !quaternionTrack) continue;



    const pos = sampleTrack(elapsedTime, positionTrack);
    const rot = sampleTrack(elapsedTime, quaternionTrack);
    const scl = sampleTrack(elapsedTime, scaleTrack);
    node.source.position = pos;
    node.source.rotation = rot;
    node.source.scale = scl;
  }
};

export const animWhaleSkinMix = (
  skin: GLTFSkin,
  animationClips: any[], // Thay đổi từ animationClip thành array
  t: number,
  whaleScene: any,
  mixWeights?: number[] // Optional weights để mix
) => {
  // Nếu không có weights, chia đều cho tất cả clips
  const weights = mixWeights || animationClips.map(() => 1 / animationClips.length);

  for (let i = 0; i < skin.joints.length; i++) {
    const joint = skin.joints[i];
    const node = whaleScene.nodes[joint];
    if (!node) continue;

    const sanitizeName = (name: string) => name.replace(/\./g, '');
    const jointName = sanitizeName(node.name);

    // Variables để accumulate values từ tất cả clips
    let finalPos = [0, 0, 0];
    let finalRot = [0, 0, 0, 0];
    let totalWeight = 0;

    // Loop qua tất cả animation clips
    for (let clipIndex = 0; clipIndex < animationClips.length; clipIndex++) {
      const animationClip = animationClips[clipIndex];
      const weight = weights[clipIndex];

      if (weight <= 0) continue;

      const positionTrack = animationClip.tracks.find((track: any) =>
        track.name === `${jointName}.position`
      );
      const quaternionTrack = animationClip.tracks.find((track: any) =>
        track.name === `${jointName}.quaternion`
      );

      if (!positionTrack || !quaternionTrack) continue;

      // Giữ nguyên logic sampling của bạn
      const pos = sampleTrack(Math.sin(t), positionTrack);
      const rot = sampleTrack(Math.sin(t), quaternionTrack);

      // Mix position
      finalPos[0] += pos[0] * weight;
      finalPos[1] += pos[1] * weight;
      finalPos[2] += pos[2] * weight;

      // Mix rotation (quaternion)
      finalRot[0] += rot[0] * weight;
      finalRot[1] += rot[1] * weight;
      finalRot[2] += rot[2] * weight;
      finalRot[3] += rot[3] * weight;

      totalWeight += weight;
    }

    // Normalize kết quả nếu có weight
    if (totalWeight > 0) {
      finalPos = finalPos.map(v => v / totalWeight);

      // Normalize quaternion
      const qLen = Math.sqrt(
        finalRot[0] * finalRot[0] +
        finalRot[1] * finalRot[1] +
        finalRot[2] * finalRot[2] +
        finalRot[3] * finalRot[3]
      );
      if (qLen > 0) {
        finalRot = finalRot.map(v => v / qLen);
      }
    }

    // Giữ nguyên cách assign như code gốc
    node.source.position = finalPos;
    node.source.rotation = finalRot;
    node.source.scale = [1, 1, 1];
  }
};



// export const animWhaleSkin = (skin: GLTFSkin, angle: number, origMatrices: any, whaleScene: any) => {
//     for (let i = 0; i < skin.joints.length; i++) {
//         // Index into the current joint
//         const joint = skin.joints[i];
//         // If our map does
//         if (!origMatrices.has(joint)) {
//             origMatrices.set(joint, whaleScene.nodes[joint].source.getMatrix());
//         }
//         // Get the original position, rotation, and scale of the current joint
//         const origMatrix = origMatrices.get(joint);
//         let m = mat4.create();
//         // Depending on which bone we are accessing, apply a specific rotation to the bone's original
//         // transformation to animate it
//         if (joint === 1 || joint === 0) {
//             m = mat4.rotateY(origMatrix, -angle);
//         } else if (joint === 3 || joint === 4) {
//             m = mat4.rotateX(origMatrix, joint === 3 ? angle : -angle);
//         } else {
//             m = mat4.rotateZ(origMatrix, angle);
//         }
//         // Apply the current transformation to the transform values within the relevant nodes
//         // (these nodes, of course, each being nodes that represent joints/bones)
//         whaleScene.nodes[joint].source.position = mat4.getTranslation(m);
//         whaleScene.nodes[joint].source.scale = mat4.getScaling(m);
//         whaleScene.nodes[joint].source.rotation = quat.fromMat(m);
//     }
// };
export const animSkinnedGrid = (boneTransforms: Mat4[], angle: number) => {
  const m = mat4.identity();
  mat4.rotateZ(m, angle, boneTransforms[0]);
  mat4.translate(boneTransforms[0], vec3.create(4, 0, 0), m);
  mat4.rotateZ(m, angle, boneTransforms[1]);
  mat4.translate(boneTransforms[1], vec3.create(4, 0, 0), m);
  mat4.rotateZ(m, angle, boneTransforms[2]);
};

// Create a group of bones
// Each index associates an actual bone to its transforms, bindPoses, uniforms, etc
export const createBoneCollection = (numBones: number): BoneObject => {
  // Initial bone transformation
  const transforms: Mat4[] = [];
  // Bone bind poses, an extra matrix per joint/bone that represents the starting point
  // of the bone before any transformations are applied
  const bindPoses: Mat4[] = [];
  // Create a transform, bind pose, and inverse bind pose for each bone
  for (let i = 0; i < numBones; i++) {
    transforms.push(mat4.identity());
    bindPoses.push(mat4.identity());
  }

  // Get initial bind pose positions
  animSkinnedGrid(bindPoses, 0);
  const bindPosesInv = bindPoses.map((bindPose) => {
    return mat4.inverse(bindPose);
  });

  return {
    transforms,
    bindPoses,
    bindPosesInv,
  };
};

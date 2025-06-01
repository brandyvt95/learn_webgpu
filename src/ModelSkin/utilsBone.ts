import { Mat4, mat4, quat, vec3 } from 'wgpu-matrix';
import { BoneObject } from './type';
import { GLTFSkin } from '../utils/glbUtils';

const sampleTrack = (t: number, track: any) => {
  const times = track.times;
  const values = track.values;
  const stride = track.getValueSize();

  if (t <= times[0]) return values.slice(0, stride);
  if (t >= times[times.length - 1]) return values.slice((times.length - 1) * stride, times.length * stride);

  for (let i = 0; i < times.length - 1; i++) {
    const t0 = times[i];
    const t1 = times[i + 1];

    if (t >= t0 && t <= t1) {
      const alpha = (t - t0) / (t1 - t0);
      const out = [];

      for (let j = 0; j < stride; j++) {
        const v0 = values[i * stride + j];
        const v1 = values[(i + 1) * stride + j];
        out.push(v0 * (1 - alpha) + v1 * alpha);
      }

      return out;
    }
  }

  return values.slice(0, stride); // fallback
};


// Hàm lấy giá trị nội suy cho QuaternionKeyframeTrack (quaternion)
function sampleQuatTrack(t: number, track: any): any {
  const times = track.times;
  const values = track.values;
  let i = 0;
  while (i < times.length && times[i] < t) i++;
  if (i === 0) return [values[0], values[1], values[2], values[3]];
  if (i >= times.length) return [
    values[(times.length-1)*4],
    values[(times.length-1)*4+1],
    values[(times.length-1)*4+2],
    values[(times.length-1)*4+3]
  ];
  const t0 = times[i-1];
  const t1 = times[i];
  const alpha = (t - t0) / (t1 - t0);
  const offset0 = (i-1)*4;
  const offset1 = i*4;

  // Nội suy quaternion bằng slerp thủ công
  const qa: any = [
    values[offset0],
    values[offset0+1],
    values[offset0+2],
    values[offset0+3]
  ];
  const qb: any = [
    values[offset1],
    values[offset1+1],
    values[offset1+2],
    values[offset1+3]
  ];
  let out: any = [0,0,0,0];
  slerpQuat(out, qa, qb, alpha);
  return out;
}

// Hàm slerpQuat như mình đã gửi ở trên
function slerpQuat(out: any, a: any, b: any, t: number): any {
  let cosHalfTheta = a[0]*b[0] + a[1]*b[1] + a[2]*b[2] + a[3]*b[3];
  if (Math.abs(cosHalfTheta) >= 1.0) {
    out[0] = a[0];
    out[1] = a[1];
    out[2] = a[2];
    out[3] = a[3];
    return out;
  }
  let halfTheta = Math.acos(cosHalfTheta);
  let sinHalfTheta = Math.sqrt(1.0 - cosHalfTheta*cosHalfTheta);
  if (Math.abs(sinHalfTheta) < 0.001) {
    out[0] = (a[0] * 0.5 + b[0] * 0.5);
    out[1] = (a[1] * 0.5 + b[1] * 0.5);
    out[2] = (a[2] * 0.5 + b[2] * 0.5);
    out[3] = (a[3] * 0.5 + b[3] * 0.5);
    return out;
  }
  let ratioA = Math.sin((1 - t) * halfTheta) / sinHalfTheta;
  let ratioB = Math.sin(t * halfTheta) / sinHalfTheta;
  out[0] = a[0] * ratioA + b[0] * ratioB;
  out[1] = a[1] * ratioA + b[1] * ratioB;
  out[2] = a[2] * ratioA + b[2] * ratioB;
  out[3] = a[3] * ratioA + b[3] * ratioB;
  return out;
}

export const animWhaleSkin = (skin: GLTFSkin, animationClip: any, t: number, whaleScene: any) => {
  if (!animationClip || !animationClip.tracks) {
    console.warn("Invalid animation clip:", animationClip);
    return;
  }
  
  for (let i = 0; i < skin.joints.length; i++) {
    const joint = skin.joints[i];
    const node = whaleScene.nodes[joint];
    if (!node) continue;

    const sanitizeName = (name: string) => name.replace(/\./g, '');

    const jointName = sanitizeName(node.name);

    const positionTrack = animationClip.tracks.find((track: any) => track.name === `${jointName}.position`);
    const quaternionTrack = animationClip.tracks.find((track: any) => track.name === `${jointName}.quaternion`);
   
    if (!positionTrack || !quaternionTrack) continue;

    const pos = sampleTrack(Math.sin(t/10), positionTrack);
    const rot = sampleTrack(Math.sin(t/10), quaternionTrack);
    
    node.source.position = pos;
    node.source.rotation = rot;
    node.source.scale = [1, 1, 1]; // hoặc scaleTrack nếu có
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

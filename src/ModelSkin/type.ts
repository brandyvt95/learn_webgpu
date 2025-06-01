import { Mat4, mat4, quat, vec3 } from 'wgpu-matrix';
export interface BoneObject {
  transforms: Mat4[];
  bindPoses: Mat4[];
  bindPosesInv: Mat4[];
}

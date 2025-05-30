// camera.ts
import { mat4, vec3 } from 'wgpu-matrix';

export class Camera {
  viewMatrix: Float32Array;
  projectionMatrix: Float32Array;
  position: Float32Array;
  target: Float32Array;
  up: Float32Array;

  constructor(fov = 45, aspect = 1, near = 0.1, far = 100) {
    this.position = vec3.create(0, 0, 2);
    this.target = vec3.create(0, 0, 0);
    this.up = vec3.create(0, 1, 0);

    this.viewMatrix = mat4.lookAt(this.position, this.target, this.up);
    this.projectionMatrix = mat4.perspective((fov * Math.PI) / 180, aspect, near, far);
  }

  updateView() {
    this.viewMatrix = mat4.lookAt(this.position, this.target, this.up);
  }

  updateProjection(fov: number, aspect: number, near: number, far: number) {
    this.projectionMatrix = mat4.perspective((fov * Math.PI) / 180, aspect, near, far);
  }
}

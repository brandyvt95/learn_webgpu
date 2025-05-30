import type { Camera } from './config';
import { mat4 } from 'wgpu-matrix';

export function initCamera(device: GPUDevice) {
  const cameraBuffer = device.createBuffer({
    size: 64,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });

  const cameraBindGroupLayout = device.createBindGroupLayout({
    entries: [{
      binding: 0,
      visibility: GPUShaderStage.VERTEX,
      buffer: { type: 'uniform' },
    }],
  });

  const pipelineLayout = device.createPipelineLayout({
    bindGroupLayouts: [cameraBindGroupLayout],
  });

  function createBindGroup() {
    return device.createBindGroup({
      layout: cameraBindGroupLayout,
      entries: [
        {
          binding: 0,
          resource: { buffer: cameraBuffer },
        },
      ],
    });
  }

  function updateCamera(camera: Camera) {
    // Tính viewProjection matrix: projection * view
    const viewProj = mat4.multiply(camera.projectionMatrix, camera.viewMatrix);
    // Ghi matrix vào buffer GPU (lưu ý là mat4 ở wgpu-matrix có .buffer chứa ArrayBuffer)
    device.queue.writeBuffer(cameraBuffer, 0, viewProj.buffer, viewProj.byteOffset, viewProj.byteLength);
  }

  return {
    cameraBuffer,
    cameraBindGroupLayout,
    pipelineLayout,
    createBindGroup,
    updateCamera,
  };
}

import { GeometryDescriptor, RenderGeometry } from '../geometry/geometry.js';
import { RenderSkin, SkinDescriptor } from '../geometry/skin.js';
import { RenderGeometryManager } from './render-geometry.js';

export class RendererBase {
  renderGeometryManager: RenderGeometryManager;
  skinBindGroupLayout: GPUBindGroupLayout;

  constructor(public device: GPUDevice) {
    this.renderGeometryManager = new RenderGeometryManager(device);
    this.skinBindGroupLayout = device.createBindGroupLayout({
      label: 'skin bind group layout',
      entries: [{
        binding: 0,
        buffer: { type: 'read-only-storage' },
        visibility: GPUShaderStage.VERTEX | GPUShaderStage.COMPUTE
      }, {
        binding: 1,
        buffer: { type: 'read-only-storage' },
        visibility: GPUShaderStage.VERTEX | GPUShaderStage.COMPUTE
      }]
    });
  }

  createGeometry(desc: GeometryDescriptor): RenderGeometry {
    return this.renderGeometryManager.createGeometry(desc);
  }


  createSkin(desc: SkinDescriptor): RenderSkin {
    let invBindMatrixCount = desc.inverseBindMatrices.length;
    if (desc.inverseBindMatrices instanceof Float32Array) {
      invBindMatrixCount = desc.inverseBindMatrices.length / 16;
    }

    // Create an fill the inverse bind matrix buffer.
    const invBindBuffer = this.device.createBuffer({
      label: 'skin inverse bind matrix buffer',
      size: invBindMatrixCount * 16 * Float32Array.BYTES_PER_ELEMENT,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
      mappedAtCreation: true,
    });
    const invBindArray = new Float32Array(invBindBuffer.getMappedRange());
    if (desc.inverseBindMatrices instanceof Float32Array) {
      invBindArray.set(desc.inverseBindMatrices);
    } else {
      for (const [index, invBindMatrix] of desc.inverseBindMatrices.entries()) {
        invBindArray.set(invBindMatrix, index * 16);
      }
    }
    invBindBuffer.unmap();

    const jointBuffer = this.device.createBuffer({
      label: 'skin joint buffer',
      size: desc.joints.length * 16 * Float32Array.BYTES_PER_ELEMENT,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    });

    // Create a bind group for both the inverse bind matrix buffer and the joint buffer.
    const skinBindGroup = this.device.createBindGroup({
      label: 'skin bind group',
      layout: this.skinBindGroupLayout,
      entries: [{
        binding: 0,
        resource: { buffer: invBindBuffer },
      }, {
        binding: 1,
        resource: { buffer: jointBuffer },
      }]
    });

    return new RenderSkin(this, skinBindGroup, desc.joints, invBindBuffer, jointBuffer);
  }

  cloneSkin(skin: RenderSkin): RenderSkin {
    const jointBuffer = this.device.createBuffer({
      label: 'skin joint buffer',
      size: skin.joints.length * 16 * Float32Array.BYTES_PER_ELEMENT,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    });

    const skinBindGroup = this.device.createBindGroup({
      label: 'skin bind group',
      layout: this.skinBindGroupLayout,
      entries: [{
        binding: 0,
        resource: { buffer: skin.invBindBuffer },
      }, {
        binding: 1,
        resource: { buffer: jointBuffer },
      }]
    });

    return new RenderSkin(this, skinBindGroup, skin.joints, skin.invBindBuffer, jointBuffer);
  }
}
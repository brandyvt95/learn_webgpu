import { mat4, Mat4, vec3 } from 'wgpu-matrix';

import {
  cubeVertexArray,
  cubeVertexSize,
  cubeUVOffset,
  cubePositionOffset,
  cubeVertexCount,
} from '../meshes/cube';

import instancedVertWGSL from './instanced.vert.wgsl';
import vertexPositionColorWGSL from './frag.wgsl'
import { generateLSystemSegments, packSegments } from './utils';

interface InitInstancedMeshOptions {
  device: GPUDevice;
  presentationFormat: GPUTextureFormat;
  frameBindGroupLayout: GPUBindGroupLayout
}

export class InitInstancedMesh {
  device: GPUDevice;
  pipeline: GPURenderPipeline;
  presentationFormat: any
  uniformBindGroup: any
  verticesBuffer: any
  numInstances: any
  frameBindGroupLayout: GPUBindGroupLayout
  modelMatrixBindGroupLayout: GPUBindGroupLayout
  modelMatrixBuffer: any
  modelMatrixBindGroup: GPUBindGroup


  pointsBuffer: GPUBuffer
  pointsBindGroup: GPUBindGroup
  pointsBindGroupLayout: GPUBindGroupLayout

  timeBindGroupLayout: GPUBindGroupLayout
  timeBindGroup: GPUBindGroup
  timeBuffer: GPUBuffer

  branchBindGroupLayout: GPUBindGroupLayout
  branchBindGroup: GPUBindGroup
  constructor({ device, presentationFormat, frameBindGroupLayout }: InitInstancedMeshOptions) {
    this.device = device;
    this.numInstances = 2000
    this.presentationFormat = presentationFormat
    this.frameBindGroupLayout = frameBindGroupLayout

    this.createPipeline();
    this.creatUniform()
    this.createBuffers()
    this.createMesh();
  }

  createPipeline() {
    this.modelMatrixBindGroupLayout = this.device.createBindGroupLayout({
      entries: [
        {
          binding: 0,
          visibility: GPUShaderStage.VERTEX,
          buffer: {
            type: 'read-only-storage', // hoặc 'read-only-storage' nếu bạn có nhiều
          },
        },
      ],
    });
    this.pointsBindGroupLayout = this.device.createBindGroupLayout({
      entries: [
        {
          binding: 0,
          visibility: GPUShaderStage.VERTEX,
          buffer: {
            type: 'read-only-storage', // hoặc 'read-only-storage' nếu bạn có nhiều
          },
        },
      ],
    });
    this.timeBindGroupLayout = this.device.createBindGroupLayout({
      entries: [{
        binding: 0,
        visibility: GPUShaderStage.VERTEX,
        buffer: { type: "uniform" },
      }],
    });
    this.branchBindGroupLayout = this.device.createBindGroupLayout({
      entries: [
        {
          binding: 0, // Points
          visibility: GPUShaderStage.VERTEX,
          buffer: { type: "read-only-storage" },
        },
        {
          binding: 1, // Segment meta
          visibility: GPUShaderStage.VERTEX,
          buffer: { type: "read-only-storage" },
        },
      ],
    });

    const pipelineLayout = this.device.createPipelineLayout({
      bindGroupLayouts: [
        this.frameBindGroupLayout,  
        this.timeBindGroupLayout, 
        this.pointsBindGroupLayout,
         this.branchBindGroupLayout]
    });
    this.pipeline = this.device.createRenderPipeline({

      layout: pipelineLayout,
      vertex: {
        module: this.device.createShaderModule({
          code: instancedVertWGSL,
        }),
        buffers: [
          {
            arrayStride: cubeVertexSize,
            attributes: [
              {
                // position
                shaderLocation: 0,
                offset: cubePositionOffset,
                format: 'float32x4',
              },
              {
                // uv
                shaderLocation: 1,
                offset: cubeUVOffset,
                format: 'float32x2',
              },
            ],
          },
        ],
      },
      fragment: {
        module: this.device.createShaderModule({
          code: vertexPositionColorWGSL,
        }),
        targets: [
          {
            format: this.presentationFormat,
          },
        ],
      },
      primitive: {
        topology: 'triangle-list',

        // Backface culling since the cube is solid piece of geometry.
        // Faces pointing away from the camera will be occluded by faces
        // pointing toward the camera.
        cullMode: 'back',
      },

      // Enable depth testing so that the fragment closest to the camera
      // is rendered in front.
      depthStencil: {
        depthWriteEnabled: true,
        depthCompare: 'less',
        format: 'depth24plus',
      },
    });
  }
  creatUniform() {

    const matrixSize = 64; // bytes
    const bufferSize = matrixSize * this.numInstances;

    this.modelMatrixBuffer = this.device.createBuffer({
      size: bufferSize,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    });
    this.modelMatrixBindGroup = this.device.createBindGroup({
      layout: this.modelMatrixBindGroupLayout,
      entries: [
        {
          binding: 0,
          resource: {
            buffer: this.modelMatrixBuffer,
          },
        },
      ],
    });
    // Tạo array để chứa dữ liệu
    const modelMatrices = new Float32Array(16 * this.numInstances);

    for (let i = 0; i < this.numInstances; i++) {
      const offset = i * 16;
      const tx = (Math.random() - 0.5) * 205; // translate x
      const ty = (Math.random() - 0.5) * 205; // translate y
      const tz = (Math.random() - 0.5) * 205; // translate z

      // Ghi ma trận model đơn giản: identity + translate
      const scale = 0.05;
      modelMatrices.set([
        scale, 0, 0, 0,
        0, scale, 0, 0,
        0, 0, scale, 0,
        tx, ty, tz, 1,
      ], offset);
    }

    // Ghi vào GPU buffer
    this.device.queue.writeBuffer(
      this.modelMatrixBuffer,
      0, // offset
      modelMatrices.buffer,
      modelMatrices.byteOffset,
      modelMatrices.byteLength
    );
  }

  createBuffers() {
    const vec3Size = 12; // 3 floats * 4 bytes
    const bufferSize = vec3Size * 2 * this.numInstances; // 2 điểm A,B mỗi instance

    this.pointsBuffer = this.device.createBuffer({
      size: bufferSize,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    });

    // Tạo array chứa dữ liệu 2 điểm A, B cho mỗi instance
    const pointsArray = new Float32Array(this.numInstances * 6); // 6 floats = 2 vec3

    for (let i = 0; i < this.numInstances; i++) {
      const base = i * 6;

      // Tạo điểm A ngẫu nhiên
      pointsArray[base + 0] = (Math.random() - 0.5) * 5;
      pointsArray[base + 1] = (Math.random() - 0.5) * 5;
      pointsArray[base + 2] = (Math.random() - 0.5) * 5;

      // Tạo điểm B ngẫu nhiên
      pointsArray[base + 3] = pointsArray[base + 0] + (Math.random() + 0.5) * 2;
      pointsArray[base + 4] = pointsArray[base + 1] + (Math.random() + 0.5) * 2;
      pointsArray[base + 5] = pointsArray[base + 2] + (Math.random() + 0.5) * 2;
    }

    this.device.queue.writeBuffer(
      this.pointsBuffer,
      0,
      pointsArray.buffer,
      pointsArray.byteOffset,
      pointsArray.byteLength
    );

    // Tạo bind group cho buffer này
    this.pointsBindGroup = this.device.createBindGroup({
      layout: this.pointsBindGroupLayout,
      entries: [
        {
          binding: 0,
          resource: {
            buffer: this.pointsBuffer,
          },
        },
      ],
    });






    const timeBufferSize = 4;

    this.timeBuffer = this.device.createBuffer({
      size: timeBufferSize,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });


    this.timeBindGroup = this.device.createBindGroup({
      layout: this.timeBindGroupLayout,
      entries: [{
        binding: 0,
        resource: { buffer: this.timeBuffer },
      }],
    });
  }

  createMesh() {
    const segments = generateLSystemSegments(
      "F",
      { F: "F[+F]F[-F]F" },
      3,
      25,
      1
    );
    const { points, meta: segmentMeta } = packSegments(segments);
    const sample = new Float32Array([
      0,0,0,
      0,1,0,
      1,1,1,
      2,2,0,
    ]) 
   
    const pointsBuffer = this.device.createBuffer({
      size: points.byteLength,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    });
    this.device.queue.writeBuffer(pointsBuffer, 0, points);

    const segmentMetaBuffer = this.device.createBuffer({
      size: segmentMeta.byteLength,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    });
    this.device.queue.writeBuffer(segmentMetaBuffer, 0, segmentMeta);
    this.branchBindGroup = this.device.createBindGroup({
      layout: this.branchBindGroupLayout,
      entries: [
        {
          binding: 0,
          resource: { buffer: pointsBuffer },
        },
        {
          binding: 1,
          resource: { buffer: segmentMetaBuffer },
        },
      ],
    });
    console.log("pointsBuffer", points);
 
    // Create a vertex buffer from the cube data.
    this.verticesBuffer = this.device.createBuffer({
      size: cubeVertexArray.byteLength,
      usage: GPUBufferUsage.VERTEX,
      mappedAtCreation: true,
    });
    new Float32Array(this.verticesBuffer.getMappedRange()).set(cubeVertexArray);
    this.verticesBuffer.unmap();
  }

  draw({ renderPass, frameBindGroup, timeValue }: { renderPass: GPURenderPassEncoder, frameBindGroup: GPUBindGroup, timeValue: any }) {
    this.device.queue.writeBuffer(
      this.timeBuffer,
      0,
      timeValue.buffer,
      timeValue.byteOffset,
      timeValue.byteLength
    );

    renderPass.setPipeline(this.pipeline);
    renderPass.setBindGroup(0, frameBindGroup);
    renderPass.setBindGroup(1, this.timeBindGroup);
    renderPass.setBindGroup(2, this.pointsBindGroup);
    renderPass.setBindGroup(3, this.branchBindGroup);
    renderPass.setVertexBuffer(0, this.verticesBuffer);
    renderPass.draw(cubeVertexCount, this.numInstances, 0, 0);
  }
}

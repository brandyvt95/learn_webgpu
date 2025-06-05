import mutilDraw from '../shaders/mutilDraw.wgsl';
import { BoxGeometryDesc, SphereGeometryDesc, CylinderGeometryDesc, ConeGeometryDesc } from '../shapes'
interface MutilDrawOptions {
  device: GPUDevice;
  presentationFormat: GPUTextureFormat;
  frameBindGroupLayout: GPUBindGroupLayout
}

export class MutilDraw {
  device: GPUDevice;
  pipeline: GPURenderPipeline;
  presentationFormat: GPUTextureFormat;

  vertexBuffer: GPUBuffer;
  indexBuffer: GPUBuffer;
  indirectBuffer: GPUBuffer;

  frameBindGroupLayout: GPUBindGroupLayout
  constructor({ device, presentationFormat, frameBindGroupLayout }: MutilDrawOptions) {
    this.device = device;
    this.presentationFormat = presentationFormat;
    this.frameBindGroupLayout = frameBindGroupLayout
    this.createPipeline();
    this.createMesh();
  }

  createPipeline() {
    const pipelineLayout = this.device.createPipelineLayout({
      bindGroupLayouts: [this.frameBindGroupLayout]
    });
    this.pipeline = this.device.createRenderPipeline({
      layout: pipelineLayout,
      vertex: {
        module: this.device.createShaderModule({ code: mutilDraw }),
        entryPoint: 'vs_main',
        buffers: [
          {
            arrayStride: 6 * 4,
            attributes: [
              { shaderLocation: 0, format: 'float32x3', offset: 0 },     // position
              { shaderLocation: 1, format: 'float32x3', offset: 3 * 4 }, // color
            ],
          },
        ],
      },
      fragment: {
        module: this.device.createShaderModule({ code: mutilDraw }),
        entryPoint: 'fs_main',
        targets: [{ format: this.presentationFormat }],
      },
      primitive: { topology: 'triangle-list', cullMode: 'back' },
      depthStencil: {
        format: 'depth24plus',
        depthWriteEnabled: true,
        depthCompare: 'less',
      }
    });
  }

  createMesh() {
    const boxData = new BoxGeometryDesc()
    const sphereData = new SphereGeometryDesc()
    console.log(boxData)
    // --- Cube data 
    const cubeVertexData = new Float32Array([
      -1, 2, -1, 1, 0, 0,  // y = -1 + 3 = 2
      1, 2, -1, 0, 1, 0,
      1, 4, -1, 0, 0, 1,
      -1, 4, -1, 1, 1, 0,
      -1, 2, 1, 1, 0, 1,
      1, 2, 1, 0, 1, 1,
      1, 4, 1, 1, 1, 1,
      -1, 4, 1, 0, 0, 0,

    ]);


    const cubeIndexData = new Uint16Array([
      0, 1, 2, 2, 3, 0, // front
      1, 5, 6, 6, 2, 1, // right
      5, 4, 7, 7, 6, 5, // back
      4, 0, 3, 3, 7, 4, // left
      3, 2, 6, 6, 7, 3, // top
      4, 5, 1, 1, 0, 4, // bottom
    ]);

    // --- Sphere data (đơn giản hơn, cùng số vertex như cube)
    const sphereVertexData = new Float32Array([
      // posX, posY, posZ,   colorR, G, B
      -1, -1, -1, 1, 0, 0, // red
      1, -1, -1, 0, 1, 0, // green
      1, 1, -1, 0, 0, 1, // blue
      -1, 1, -1, 1, 1, 0, // yellow
      -1, -1, 1, 1, 0, 1, // magenta
      1, -1, 1, 0, 1, 1, // cyan
      1, 1, 1, 1, 1, 1, // white
      -1, 1, 1, 0, 0, 0, // black
    ]);

    const sphereIndexData = new Uint16Array([
      0, 1, 2, 2, 3, 0, // front
      1, 5, 6, 6, 2, 1, // right
      5, 4, 7, 7, 6, 5, // back
      4, 0, 3, 3, 7, 4, // left
      3, 2, 6, 6, 7, 3, // top
      4, 5, 1, 1, 0, 4, // bottom
    ]);

    console.log('Cube vertices:', cubeVertexData.length / 6);
    console.log('Sphere vertices:', sphereVertexData.length / 6);
    console.log('Cube indices:', cubeIndexData.length);
    console.log('Sphere indices:', sphereIndexData.length);

    // Tính offset
    const cubeVertexCount = cubeVertexData.length / 6;
    const sphereVertexDataOffset = cubeVertexCount;

    // Offset indices của sphere
    const adjustedSphereIndices = sphereIndexData.map(i => i + sphereVertexDataOffset);

    // Gộp data
    const fullVertexData = new Float32Array([
      ...cubeVertexData,
      ...sphereVertexData
    ]);

    const fullIndexData = new Uint16Array([
      ...cubeIndexData,
      ...adjustedSphereIndices
    ]);

    console.log('Full vertex data length:', fullVertexData.length);
    console.log('Full index data length:', fullIndexData.length);
    console.log('Vertex buffer size needed:', fullVertexData.byteLength);
    console.log('Index buffer size needed:', fullIndexData.byteLength);

    try {
      // Tạo vertex buffer
      this.vertexBuffer = this.device.createBuffer({
        size: fullVertexData.byteLength,
        usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
        mappedAtCreation: true
      });

      const vertexRange = this.vertexBuffer.getMappedRange();
      new Float32Array(vertexRange).set(fullVertexData);
      this.vertexBuffer.unmap();
      console.log('Vertex buffer created successfully');

      // Tạo index buffer
      this.indexBuffer = this.device.createBuffer({
        size: fullIndexData.byteLength,
        usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
        mappedAtCreation: true
      });

      const indexRange = this.indexBuffer.getMappedRange();
      new Uint16Array(indexRange).set(fullIndexData);
      this.indexBuffer.unmap();
      console.log('Index buffer created successfully');

      // Tạo indirect buffer
      const indirectBufferSize = 2 * 5 * 4; // 2 draws × 5 u32 each × 4 bytes
      console.log('Indirect buffer size:', indirectBufferSize);

      this.indirectBuffer = this.device.createBuffer({
        size: indirectBufferSize,
        usage: GPUBufferUsage.INDIRECT | GPUBufferUsage.COPY_DST,
        mappedAtCreation: true
      });

      const indirectRange = this.indirectBuffer.getMappedRange();
      const indirectArray = new Uint32Array(indirectRange);

      // Draw command cho cube
      indirectArray.set([
        cubeIndexData.length,    // indexCount
        1,                       // instanceCount  
        0,                       // firstIndex
        0,                       // baseVertex
        0                        // firstInstance
      ], 0);

      // Draw command cho sphere
      indirectArray.set([
        sphereIndexData.length,         // indexCount
        1,                              // instanceCount
        cubeIndexData.length,           // firstIndex (bắt đầu sau cube indices)
        sphereVertexDataOffset,         // baseVertex (offset vertex)
        0                               // firstInstance
      ], 5);

      this.indirectBuffer.unmap();
      console.log('Indirect buffer created successfully');

      console.log('Draw commands:');
      console.log('Cube: indexCount=', cubeIndexData.length, 'firstIndex=0, baseVertex=0');
      console.log('Sphere: indexCount=', sphereIndexData.length, 'firstIndex=', cubeIndexData.length, 'baseVertex=', sphereVertexDataOffset);

    } catch (error) {
      console.error('Error creating buffers:', error);
      throw error;
    }
  }

  draw({ renderPass, frameBindGroup }: { renderPass: GPURenderPassEncoder, frameBindGroup: GPUBindGroup }) {
    renderPass.setPipeline(this.pipeline);
    renderPass.setBindGroup(0, frameBindGroup)
    renderPass.setVertexBuffer(0, this.vertexBuffer);

    // Draw 1: cube
    renderPass.drawIndexedIndirect(this.indirectBuffer, 0);

    // Draw 2: sphere
    // renderPass.drawIndexedIndirect(this.indirectBuffer, 2 * 4); // offset tính theo byte
  }
}

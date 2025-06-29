import { mat4, vec3 } from 'wgpu-matrix';
import particleWGSL from './particle.wgsl';
import probabilityMapWGSL from './probabilityMap.wgsl';

interface PointDetectSurfaceOptions {
  device: GPUDevice;
  presentationFormat: GPUTextureFormat;
  imageBitmap: ImageBitmap;
  canvas: any;
}

const numParticles = 50000;
const particlePositionOffset = 0;
const particleColorOffset = 4 * 4;
const particleInstanceByteSize =
  3 * 4 + // position
  1 * 4 + // lifetime
  4 * 4 + // color
  3 * 4 + // velocity
  1 * 4 + // padding
  0;

export class PointDetectSurface {
  device: GPUDevice;
  pipeline: GPURenderPipeline;
  computePipeline: GPUComputePipeline;
  presentationFormat: GPUTextureFormat;
  canvas: any;
  imageBitmap: ImageBitmap;
  
  // Buffers
  particlesBuffer: GPUBuffer;
  uniformBuffer: GPUBuffer;
  simulationUBOBuffer: GPUBuffer;
  quadVertexBuffer: GPUBuffer;
  
  // Textures
  texture: GPUTexture;
  depthTexture: GPUTexture;
  
  // Bind Groups
  uniformBindGroup: GPUBindGroup;
  computeBindGroup: GPUBindGroup;
  
  // Render Pass
  renderPassDescriptor: GPURenderPassDescriptor;
  
  // Simulation params
  simulationParams = {
    simulate: true,
    deltaTime: 0.04,
    brightnessFactor: 1.0,
  };

  constructor({ device, presentationFormat, imageBitmap, canvas }: PointDetectSurfaceOptions) {
    this.device = device;
    this.presentationFormat = presentationFormat;
    this.imageBitmap = imageBitmap;
    this.canvas = canvas;
    
    this.createTextureMip();
    this.generateProbabilityMap();
    this.createBuffers();
    this.createPipelines();
    this.createBindGroups();
    this.createMesh();
    this.setupRenderPass();
  }

  createTextureMip() {
    const isPowerOf2 = (v: number) => Math.log2(v) % 1 === 0;
    assert(this.imageBitmap.width === this.imageBitmap.height, 'image must be square');
    assert(isPowerOf2(this.imageBitmap.width), 'image must be a power of 2');

    // Calculate number of mip levels required to generate the probability map
    const mipLevelCount =
      (Math.log2(Math.max(this.imageBitmap.width, this.imageBitmap.height)) + 1) | 0;
    
    this.texture = this.device.createTexture({
      size: [this.imageBitmap.width, this.imageBitmap.height, 1],
      mipLevelCount,
      format: 'rgba8unorm',
      usage:
        GPUTextureUsage.TEXTURE_BINDING |
        GPUTextureUsage.STORAGE_BINDING |
        GPUTextureUsage.COPY_DST |
        GPUTextureUsage.RENDER_ATTACHMENT,
    });
    
    this.device.queue.copyExternalImageToTexture(
      { source: this.imageBitmap },
      { texture: this.texture },
      [this.imageBitmap.width, this.imageBitmap.height]
    );
  }

  generateProbabilityMap() {
    const probabilityMapImportLevelPipeline = this.device.createComputePipeline({
      layout: 'auto',
      compute: {
        module: this.device.createShaderModule({ code: probabilityMapWGSL }),
        entryPoint: 'import_level',
      },
    });
    
    const probabilityMapExportLevelPipeline = this.device.createComputePipeline({
      layout: 'auto',
      compute: {
        module: this.device.createShaderModule({ code: probabilityMapWGSL }),
        entryPoint: 'export_level',
      },
    });

    const probabilityMapUBOBufferSize = 1 * 4 + 3 * 4; // stride + padding
    const probabilityMapUBOBuffer = this.device.createBuffer({
      size: probabilityMapUBOBufferSize,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
    
    const buffer_a = this.device.createBuffer({
      size: this.texture.width * this.texture.height * 4,
      usage: GPUBufferUsage.STORAGE,
    });
    
    const buffer_b = this.device.createBuffer({
      size: buffer_a.size,
      usage: GPUBufferUsage.STORAGE,
    });
    
    this.device.queue.writeBuffer(
      probabilityMapUBOBuffer,
      0,
      new Uint32Array([this.texture.width])
    );
    
    const commandEncoder = this.device.createCommandEncoder();
    
    for (let level = 0; level < this.texture.mipLevelCount; level++) {
      const levelWidth = Math.max(1, this.texture.width >> level);
      const levelHeight = Math.max(1, this.texture.height >> level);
      const pipeline = level == 0
        ? probabilityMapImportLevelPipeline.getBindGroupLayout(0)
        : probabilityMapExportLevelPipeline.getBindGroupLayout(0);
        
      const probabilityMapBindGroup = this.device.createBindGroup({
        layout: pipeline,
        entries: [
          {
            binding: 0,
            resource: { buffer: probabilityMapUBOBuffer },
          },
          {
            binding: 1,
            resource: { buffer: level & 1 ? buffer_a : buffer_b },
          },
          {
            binding: 2,
            resource: { buffer: level & 1 ? buffer_b : buffer_a },
          },
          {
            binding: 3,
            resource: this.texture.createView({
              format: 'rgba8unorm',
              dimension: '2d',
              baseMipLevel: level,
              mipLevelCount: 1,
            }),
          },
        ],
      });
      
      const passEncoder = commandEncoder.beginComputePass();
      if (level == 0) {
        passEncoder.setPipeline(probabilityMapImportLevelPipeline);
      } else {
        passEncoder.setPipeline(probabilityMapExportLevelPipeline);
      }
      passEncoder.setBindGroup(0, probabilityMapBindGroup);
      passEncoder.dispatchWorkgroups(Math.ceil(levelWidth / 64), levelHeight);
      passEncoder.end();
    }
    
    this.device.queue.submit([commandEncoder.finish()]);
  }

  createBuffers() {
    // Particles buffer
    this.particlesBuffer = this.device.createBuffer({
      size: numParticles * particleInstanceByteSize,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.STORAGE,
    });

    // Uniform buffer
    const uniformBufferSize =
      4 * 4 * 4 + // modelViewProjectionMatrix : mat4x4f
      3 * 4 + 4 + // right : vec3f + padding
      3 * 4 + 4; // up : vec3f + padding
      
    this.uniformBuffer = this.device.createBuffer({
      size: uniformBufferSize,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    // Simulation UBO buffer
    const simulationUBOBufferSize =
      1 * 4 + // deltaTime
      1 * 4 + // brightnessFactor
      2 * 4 + // padding
      4 * 4; // seed
      
    this.simulationUBOBuffer = this.device.createBuffer({
      size: simulationUBOBufferSize,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    // Depth texture
    this.depthTexture = this.device.createTexture({
      size: [this.canvas.size[0], this.canvas.size[1]],
      format: 'depth24plus',
      usage: GPUTextureUsage.RENDER_ATTACHMENT,
    });
  }

  createPipelines() {
    // Render pipeline
    this.pipeline = this.device.createRenderPipeline({
      layout: 'auto',
      vertex: {
        module: this.device.createShaderModule({
          code: particleWGSL,
        }),
        buffers: [
          {
            arrayStride: particleInstanceByteSize,
            stepMode: 'instance',
            attributes: [
              {
                shaderLocation: 0,
                offset: particlePositionOffset,
                format: 'float32x3',
              },
              {
                shaderLocation: 1,
                offset: particleColorOffset,
                format: 'float32x4',
              },
            ],
          },
          {
            arrayStride: 2 * 4,
            stepMode: 'vertex',
            attributes: [
              {
                shaderLocation: 2,
                offset: 0,
                format: 'float32x2',
              },
            ],
          },
        ],
      },
      fragment: {
        module: this.device.createShaderModule({
          code: particleWGSL,
        }),
        targets: [
          {
            format: this.presentationFormat,
            blend: {
              color: {
                srcFactor: 'src-alpha',
                dstFactor: 'one',
                operation: 'add',
              },
              alpha: {
                srcFactor: 'zero',
                dstFactor: 'one',
                operation: 'add',
              },
            },
          },
        ],
      },
      primitive: {
        topology: 'triangle-list',
      },
      depthStencil: {
        depthWriteEnabled: false,
        depthCompare: 'less',
        format: 'depth24plus',
      },
    });

    // Compute pipeline
    this.computePipeline = this.device.createComputePipeline({
      layout: 'auto',
      compute: {
        module: this.device.createShaderModule({
          code: particleWGSL,
        }),
        entryPoint: 'simulate',
      },
    });
  }

  createBindGroups() {
    // Uniform bind group
    this.uniformBindGroup = this.device.createBindGroup({
      layout: this.pipeline.getBindGroupLayout(0),
      entries: [
        {
          binding: 0,
          resource: {
            buffer: this.uniformBuffer,
          },
        },
      ],
    });

    // Compute bind group
    this.computeBindGroup = this.device.createBindGroup({
      layout: this.computePipeline.getBindGroupLayout(0),
      entries: [
        {
          binding: 0,
          resource: {
            buffer: this.simulationUBOBuffer,
          },
        },
        {
          binding: 1,
          resource: {
            buffer: this.particlesBuffer,
            offset: 0,
            size: numParticles * particleInstanceByteSize,
          },
        },
        {
          binding: 2,
          resource: this.texture.createView(),
        },
      ],
    });
  }

  createMesh() {
    // Quad vertex buffer
    this.quadVertexBuffer = this.device.createBuffer({
      size: 6 * 2 * 4, // 6x vec2f
      usage: GPUBufferUsage.VERTEX,
      mappedAtCreation: true,
    });
    
    const vertexData = [
      -1.0, -1.0, +1.0, -1.0, -1.0, +1.0, -1.0, +1.0, +1.0, -1.0, +1.0, +1.0,
    ];
    
    new Float32Array(this.quadVertexBuffer.getMappedRange()).set(vertexData);
    this.quadVertexBuffer.unmap();
  }

  setupRenderPass() {
    this.renderPassDescriptor = {
      colorAttachments: [
        {
          view: undefined, // Will be assigned during render
          clearValue: [0, 0, 0, 1],
          loadOp: 'clear',
          storeOp: 'store',
        },
      ],
      depthStencilAttachment: {
        view: this.depthTexture.createView(),
        depthClearValue: 1.0,
        depthLoadOp: 'clear',
        depthStoreOp: 'store',
      },
    };
  }

  updateSimulation() {
    this.device.queue.writeBuffer(
      this.simulationUBOBuffer,
      0,
      new Float32Array([
        this.simulationParams.simulate ? this.simulationParams.deltaTime : 0.0,
        this.simulationParams.brightnessFactor,
        0.0,
        0.0, // padding
        Math.random() * 100,
        Math.random() * 100, // seed.xy
        1 + Math.random(),
        1 + Math.random(), // seed.zw
      ])
    );
  }

  updateUniforms() {
    const aspect = this.canvas.size[0] / this.canvas.size[1];
    const projection = mat4.perspective((2 * Math.PI) / 5, aspect, 1, 100.0);
    const view = mat4.create();
    const mvp = mat4.create();

    mat4.identity(view);
    mat4.translate(view, vec3.fromValues(0, 0, -3), view);
    mat4.rotateX(view, Math.PI * -0.2, view);
    mat4.multiply(projection, view, mvp);

    this.device.queue.writeBuffer(
      this.uniformBuffer,
      0,
      new Float32Array([
        // modelViewProjectionMatrix
        mvp[0], mvp[1], mvp[2], mvp[3],
        mvp[4], mvp[5], mvp[6], mvp[7],
        mvp[8], mvp[9], mvp[10], mvp[11],
        mvp[12], mvp[13], mvp[14], mvp[15],
        // right vector
        view[0], view[4], view[8], 0,
        // up vector
        view[1], view[5], view[9], 0,
      ])
    );
  }

  // Separate compute pass - call this before render
  updateCompute() {
    this.updateSimulation();
    
    const commandEncoder = this.device.createCommandEncoder();
    const passEncoder = commandEncoder.beginComputePass();
    passEncoder.setPipeline(this.computePipeline);
    passEncoder.setBindGroup(0, this.computeBindGroup);
    passEncoder.dispatchWorkgroups(Math.ceil(numParticles / 64));
    passEncoder.end();
    
    this.device.queue.submit([commandEncoder.finish()]);
  }

  draw({ renderPass, frameBindGroup, timeValue }: { 
    renderPass: GPURenderPassEncoder, 
    frameBindGroup?: GPUBindGroup, 
    timeValue?: any 
  }) {
    this.updateUniforms();
    
    renderPass.setPipeline(this.pipeline);
   // renderPass.setBindGroup(0, frameBindGroup);
    renderPass.setBindGroup(0, this.uniformBindGroup); // or use your timeBindGroup
    renderPass.setVertexBuffer(0, this.particlesBuffer);
    renderPass.setVertexBuffer(1, this.quadVertexBuffer);
    renderPass.draw(6, numParticles, 0, 0);
  }

  // Getter/Setter for simulation parameters
  setSimulate(value: boolean) {
    this.simulationParams.simulate = value;
  }

  setDeltaTime(value: number) {
    this.simulationParams.deltaTime = value;
  }

  setBrightnessFactor(value: number) {
    this.simulationParams.brightnessFactor = value;
  }
}

function assert(cond: boolean, msg = '') {
  if (!cond) {
    throw new Error(msg);
  }
}
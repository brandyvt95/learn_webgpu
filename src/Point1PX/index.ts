import groundWGSL from '../shaders/ground.wgsl'; // cách import raw text (tuỳ config bundler)

interface GroundOptions {
  device: GPUDevice;
  presentationFormat: GPUTextureFormat;
  COMMON_DEPTH_MSAA_DESC: any
  POINT_BUFFER:any
  CONFIG_POINT_UBO:any
}
function createFibonacciSphereVertices({
  numSamples,
  radius,
}) {
  const vertices = [];
  const increment = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < numSamples; ++i) {
    vertices.push(Math.random() * 2 - 1, Math.random() * 2 - 1, Math.random() * 2 - 1);
  }
  return new Float32Array(vertices);
}
export class InitPoint1X {
  device: GPUDevice;
  pipeline: GPURenderPipeline;
  presentationFormat: any
  uniformBuffer: any
  uniformValues: any
  kNumPoints: any
  vertexBuffer: any
  pipline: any
  bindGroup: any
  COMMON_DEPTH_MSAA_DESC: any
  POINT_BUFFER:any
  CONFIG_POINT_UBO:any
  constructor({ device, presentationFormat,POINT_BUFFER,CONFIG_POINT_UBO, COMMON_DEPTH_MSAA_DESC }: GroundOptions) {
    this.device = device;
    this.POINT_BUFFER = POINT_BUFFER
    this.CONFIG_POINT_UBO = CONFIG_POINT_UBO
    this.COMMON_DEPTH_MSAA_DESC = COMMON_DEPTH_MSAA_DESC
    this.presentationFormat = presentationFormat
    this.createPipeline();
    this.creatUniform()
    this.createMesh();

  }

  createPipeline() {
    const module = this.device.createShaderModule({
      code: `
      struct Vertex {
        @location(0) position: vec4f,
      };

      struct Uniforms {
        matrix: mat4x4f,
      };

      struct VSOutput {
        @builtin(position) position: vec4f,
      };
      struct CameraUniforms {
        modelMatrix : mat4x4<f32>,
        viewMatrix : mat4x4<f32>,
        projectionMatrix : mat4x4<f32>,
        cameraPosition : vec3<f32>,
        padding : f32, // <- để giữ alignment 16 bytes
      }
      @group(0) @binding(0) var<uniform> uni: Uniforms;
      @group(1) @binding(0) var<uniform> camera_uniforms: CameraUniforms;

      @vertex fn vs(
          vert: Vertex,
      ) -> VSOutput {
        var vsOut: VSOutput;
        let clipPos = camera_uniforms.projectionMatrix * camera_uniforms.viewMatrix  *  camera_uniforms.modelMatrix  * vert.position;
        vsOut.position = clipPos;
        return vsOut;
      }

      @fragment fn fs(vsOut: VSOutput) -> @location(0) vec4f {
        return vec4f(1, 0.5, 0.2, 1);
      }
    `,
    });
    const groundBindGroupLayout = this.device.createBindGroupLayout({
            entries: [{
                binding: 0,
                visibility: GPUShaderStage.VERTEX,
                buffer: { type: 'uniform' }
            }]
        });
        const cameraBindGroupLayout = this.device.createBindGroupLayout({
            entries: [{
                binding: 0,
                visibility: GPUShaderStage.VERTEX,
                buffer: { type: 'uniform' }
            }]
        });
        const pipelineLayout = this.device.createPipelineLayout({
            bindGroupLayouts: [groundBindGroupLayout, cameraBindGroupLayout]
        });
    this.pipeline = this.device.createRenderPipeline({
      label: '3d points with 1px size',
      layout: pipelineLayout,
      vertex: {
        module,
        buffers: [
          {
            arrayStride: (3) * 4, // 3 floats, 4 bytes each
            attributes: [
              { shaderLocation: 0, offset: 0, format: 'float32x3' },  // position
            ],
          },
        ],
      },
      fragment: {
        module,
        targets: [
          {
            format: this.presentationFormat,
          },
        ],
      },
      primitive: {
        topology: 'point-list',
      },
      ...this.COMMON_DEPTH_MSAA_DESC
    });

    const vertexData = createFibonacciSphereVertices({
      radius: 1,
      numSamples: 200000,
    });
    this.kNumPoints = vertexData.length / 3;

    this.vertexBuffer = this.device.createBuffer({
      label: 'vertex buffer vertices',
      size: vertexData.byteLength,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    });
    this.device.queue.writeBuffer(this.vertexBuffer, 0, vertexData);

    this.uniformValues = new Float32Array(16);
    this.uniformBuffer = this.device.createBuffer({
      size: this.uniformValues.byteLength,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
    const kMatrixOffset = 0;
    const matrixValue = this.uniformValues.subarray(
      kMatrixOffset, kMatrixOffset + 16);

    this.bindGroup = this.device.createBindGroup({
      layout: this.pipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: this.uniformBuffer } },
      ],
    });
  }
  creatUniform() {

  }

  createMesh() {

  }

  draw({ renderPass, uniform }: { renderPass: GPURenderPassEncoder, uniform?: GPUBindGroup[] }) {
    this.device.queue.writeBuffer(this.uniformBuffer, 0, this.uniformValues);
    renderPass.setPipeline(this.pipeline);
    renderPass.setVertexBuffer(0, this.POINT_BUFFER);
    // renderPass.setVertexBuffer(1, this.POINT_BUFFER);
    if (uniform && uniform.length > 0) {
      for (let i = 0; i < uniform.length; i++) {
        renderPass.setBindGroup(i + 1, uniform[i]);
      }
    }
    renderPass.setBindGroup(0, this.bindGroup);
    renderPass.draw(this.kNumPoints);
  }
}

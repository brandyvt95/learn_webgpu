
import particleWGSL from '../shaders/particle.wgsl';
interface PointOptions {
  device: GPUDevice;
  presentationFormat: GPUTextureFormat;
  POINT_BUFFER:any;
  CONFIG_POINT_UBO:any;
}

export class InitPoint {
    device: GPUDevice;
    pipeline: GPURenderPipeline;
    vertexBuffer: GPUBuffer;
    indexBuffer: GPUBuffer;
    indexCount: number;
    uniformBindGroup_GROUND: any;
    uniformBuffer_GROUND: any;

    numParticles: any;
    particlePositionOffset: any;
    particleColorOffset: any;
    particleInstanceByteSize: any

    uniformBuffer_PARTICLE: any;
    uniformBindGroup_PARTICLE: any;
    CONFIG_POINT_UBO:any;
    quadVertexBuffer: any
    particlesBuffer: any
    presentationFormat:any
    constructor({device,POINT_BUFFER,CONFIG_POINT_UBO,presentationFormat}:PointOptions) {
        this.device = device;
        this.particlesBuffer = POINT_BUFFER
        this.CONFIG_POINT_UBO = CONFIG_POINT_UBO
        this.numParticles = this.CONFIG_POINT_UBO.numParticles
        this.particlePositionOffset = this.CONFIG_POINT_UBO.particlePositionOffset
        this.particleColorOffset = this.CONFIG_POINT_UBO.particleColorOffset
        this.particleInstanceByteSize = this.CONFIG_POINT_UBO.particleInstanceByteSize
        this.presentationFormat = presentationFormat


       
        this.createMesh();
        this.createPipeline();
        this.creatUniform()
        this.createBindGroup()
    }

    createPipeline() {
        this.pipeline = this.device.createRenderPipeline({
            layout: 'auto',
            vertex: {
                module: this.device.createShaderModule({
                    code: particleWGSL,
                }),
                buffers: [
                    {
                        // instanced particles buffer
                        arrayStride: this.particleInstanceByteSize,
                        stepMode: 'instance',
                        attributes: [
                            {
                                // position
                                shaderLocation: 0,
                                offset: this.particlePositionOffset,
                                format: 'float32x3',
                            },
                            {
                                // color
                                shaderLocation: 1,
                                offset: this.particleColorOffset,
                                format: 'float32x4',
                            },
                        ],
                    },
                    {
                        // quad vertex buffer
                        arrayStride: 2 * 4, // vec2f
                        stepMode: 'vertex',
                        attributes: [
                            {
                                // vertex positions
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
                                srcFactor: 'one',
                                dstFactor: 'one-minus-src-alpha',
                                operation: 'add',
                            },
                            alpha: {
                                srcFactor: 'one',
                                dstFactor: 'one-minus-src-alpha',
                                operation: 'add',
                            },
                        }

                    },
                ],
            },
            primitive: {
                topology: 'triangle-list',
            },

            depthStencil: {
                depthWriteEnabled: true,
                depthCompare: 'less',
                format: 'depth24plus',
            },
        });
    }
    createBuffer() {
        this.particlesBuffer = this.device.createBuffer({
            size: this.numParticles * this.particleInstanceByteSize,
            usage: GPUBufferUsage.VERTEX | GPUBufferUsage.STORAGE,
        });

    }
    createBindGroup() {
        this.uniformBindGroup_PARTICLE = this.device.createBindGroup({
            layout: this.pipeline.getBindGroupLayout(0),
            entries: [
                {
                    binding: 0,
                    resource: {
                        buffer: this.uniformBuffer_PARTICLE,
                    },
                },
            ],
        });

    }
    creatUniform() {
        const uniformBufferSize =
            4 * 4 * 4 + // modelViewProjectionMatrix : mat4x4f
            3 * 4 + // right : vec3f
            4 + // padding
            3 * 4 + // up : vec3f
            4 + // padding
            0;
        this.uniformBuffer_PARTICLE = this.device.createBuffer({
            size: uniformBufferSize,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        });
    }
    createMesh() {
        this.quadVertexBuffer = this.device.createBuffer({
            size: 6 * 2 * 4, // 6x vec2f
            usage: GPUBufferUsage.VERTEX,
            mappedAtCreation: true,
        });
        // prettier-ignore
        const vertexData = [
            -1.0, -1.0, +1.0, -1.0, -1.0, +1.0, -1.0, +1.0, +1.0, -1.0, +1.0, +1.0,
        ];
        new Float32Array(this.quadVertexBuffer.getMappedRange()).set(vertexData);
        this.quadVertexBuffer.unmap();
    }

    draw(passEncoder: GPURenderPassEncoder) {
        passEncoder.setPipeline(this.pipeline);
        passEncoder.setBindGroup(0, this.uniformBindGroup_PARTICLE);
        passEncoder.setVertexBuffer(0, this.particlesBuffer);
        passEncoder.setVertexBuffer(1, this.quadVertexBuffer);
        passEncoder.draw(6, this.numParticles, 0, 0);
    }
}

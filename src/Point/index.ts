
import particleWGSL from '../shaders/particle.wgsl';
import { GUI } from 'dat.gui';
interface PointOptions {
    device: GPUDevice;
    presentationFormat: GPUTextureFormat;
    POINT_BUFFER: any;
    CONFIG_POINT_UBO: any;
    COMMON_PIPLINE_STATE_DESC: any
}

export class InitPoint {
    device: GPUDevice;
    pipeline: GPURenderPipeline;
    vertexBuffer: GPUBuffer;
    indexBuffer: GPUBuffer;
    indexCount: number;

    numParticles: any;
    particlePositionOffset: any;
    particleColorOffset: any;
    particleExtraOffset:any
    particleInstanceByteSize: any

    uniformBuffer: any;
    uniformBindGroup: any;
    CONFIG_POINT_UBO: any;
    quadVertexBuffer: any
    POINT_BUFFER: any
    presentationFormat: any
    gui: any

    COMMON_PIPLINE_STATE_DESC: any
    constructor({ device, POINT_BUFFER, CONFIG_POINT_UBO, presentationFormat,COMMON_PIPLINE_STATE_DESC }: PointOptions) {
        this.device = device;
        this.COMMON_PIPLINE_STATE_DESC = COMMON_PIPLINE_STATE_DESC
        this.POINT_BUFFER = POINT_BUFFER
        this.CONFIG_POINT_UBO = CONFIG_POINT_UBO
        this.numParticles = this.CONFIG_POINT_UBO.numParticles
        this.particlePositionOffset = this.CONFIG_POINT_UBO.particlePositionOffset
        this.particleColorOffset = this.CONFIG_POINT_UBO.particleColorOffset
        this.particleExtraOffset = this.CONFIG_POINT_UBO.particleExtraOffset
        
        this.particleInstanceByteSize = this.CONFIG_POINT_UBO.particleInstanceByteSize
        this.presentationFormat = presentationFormat

        this.gui = {
            pointSize: .72,
            radFade: 1,
            z: 0,
            w: 0,
            pointColor: { r: 255, g: 125, b: 0 }
        }
        this.createGUI()
        this.createMesh();
        this.createPipeline();
        this.creatUniform()
    }

    createGUI() {
        const gui = new GUI();
        gui.width = 200;
        gui.add(this.gui, 'pointSize', 0, 10).step(0.01).name('pointSize');
        gui.add(this.gui, 'radFade', 0, 1).step(0.01).name('radFade');
        gui.addColor(this.gui, 'pointColor').name('pointColor');

    }
    createPipeline() {
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
            layout: pipelineLayout,
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
                            {
                                // extra
                                shaderLocation: 3,
                                offset: this.particleExtraOffset, 
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
             /*                  color: {
            srcFactor: 'src-alpha',
            dstFactor: 'one',
            operation: 'add',
          },
          alpha: {
            srcFactor: 'zero',
            dstFactor: 'one',
            operation: 'add',
          }, */
                        }

                    },
                ],
            },
            primitive: {
                topology: 'triangle-list',
            },

            ...this.COMMON_PIPLINE_STATE_DESC
        });
    }
    creatUniform() {
        const bufferSize = 32
        this.uniformBuffer = this.device.createBuffer({
            size: bufferSize,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        });

        this.uniformBindGroup = this.device.createBindGroup({
            layout: this.pipeline.getBindGroupLayout(0),
            entries: [
                {
                    binding: 0,
                    resource: {
                        buffer: this.uniformBuffer,
                    }
                }

            ],
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


    draw({ renderPass, uniform }: { renderPass: GPURenderPassEncoder, uniform?: GPUBindGroup[] }) {
        renderPass.setPipeline(this.pipeline);
        const data = new Float32Array(8); // 8 floats = 32 bytes
        data[0] = this.gui.pointSize; // pointSize
        data[1] = this.gui.radFade; 
        data[2] = 0; 
        data[3] = 0; 
        // padding 4
        data[4] =this.gui.pointColor.r / 255;
        data[5] = this.gui.pointColor.g / 255;
        data[6] = this.gui.pointColor.b / 255;
        data[7] = 0;

        this.device.queue.writeBuffer(this.uniformBuffer, 0, data.buffer);
      
        renderPass.setBindGroup(0, this.uniformBindGroup);
        if (uniform && uniform.length > 0) {
            for (let i = 0; i < uniform.length; i++) {
                renderPass.setBindGroup(i + 1, uniform[i]);
            }
        }
        renderPass.setVertexBuffer(0, this.POINT_BUFFER);
        renderPass.setVertexBuffer(1, this.quadVertexBuffer);
        renderPass.draw(6, this.numParticles, 0, 0);
    }
}

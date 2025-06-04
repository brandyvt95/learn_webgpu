import { COMMON_DEPTH_MSAA_DESC } from '../contrast';
import { createPlaneSample } from '../meshes/planeSample';
import groundWGSL from './ground.wgsl'; // cách import raw text (tuỳ config bundler)

import { GUI } from 'dat.gui';
interface GroundOptions {
    device: GPUDevice;
    presentationFormat: GPUTextureFormat;
    frameBindGroupLayout: any,
}

export class InitGround {
    device: GPUDevice;
    pipeline: GPURenderPipeline;
    vertexBuffer: GPUBuffer;
    indexBuffer: GPUBuffer;
    indexCount: number;
    uniformBindGroup: any;
    uniformBuffer: any;
    presentationFormat: any
    cameraBuffer: any
    gui:any
    frameBindGroupLayout:any
    constructor({ device, presentationFormat, frameBindGroupLayout }: GroundOptions) {
        this.device = device;
    
        this.frameBindGroupLayout = frameBindGroupLayout
        this.uniformBindGroup = null;
        this.uniformBuffer = null
        this.presentationFormat = presentationFormat
        
        this.createGUI()
        this.createPipeline();
        this.creatUniform()
        this.createMesh();

    }

    createGUI() {
        this.gui = {
            x:0,
            y:-.2,
            z:0,
            w:0
        }
        const gui = new GUI();
        gui.width = 200;
        gui.add(this.gui, 'x', -10, 10).step(0.1).name('Position X');
        gui.add(this.gui, 'y', -10, 10).step(0.1).name('Position Y');
        gui.add(this.gui, 'z', -10, 10).step(0.1).name('Position Z');
        gui.add(this.gui, 'w', -10, 10).step(0.1).name('Position W');
    }
    createPipeline() {
       const groundBindGroupLayout = this.device.createBindGroupLayout({
            entries: [{
                binding: 0,
                visibility: GPUShaderStage.VERTEX,
                buffer: { type: 'uniform' }
            }]
        });
        const pipelineLayout = this.device.createPipelineLayout({
            bindGroupLayouts: [this.frameBindGroupLayout,groundBindGroupLayout]
        });
        this.pipeline = this.device.createRenderPipeline({
            label:'ground pipline',
            layout: pipelineLayout,
            vertex: {
                module: this.device.createShaderModule({ code: groundWGSL }),
                entryPoint: 'vs_main',
                buffers: [
                    {
                        arrayStride: 5 * 4, // 3 float pos + 2 float uv
                        attributes: [
                            { shaderLocation: 0, offset: 0, format: 'float32x3' },
                            { shaderLocation: 1, offset: 3 * 4, format: 'float32x2' },
                        ],
                    },
                ],
            },
            fragment: {
                module: this.device.createShaderModule({ code: groundWGSL }),
                entryPoint: 'fs_main',
                targets: [{ format: this.presentationFormat }],
            },
            primitive: {
                topology: 'triangle-list',
                cullMode: 'none',
            },
            ...COMMON_DEPTH_MSAA_DESC as any
        })
         const bufferSize = 4 * 4; // 4 floats * 4 bytes = 16 bytes
        this.uniformBuffer = this.device.createBuffer({
            size: bufferSize,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        });

        this.uniformBindGroup = this.device.createBindGroup({
            layout: groundBindGroupLayout,
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
        const {vertexBuffer,indexBuffer,indexCount} = createPlaneSample(this.device)
        this.vertexBuffer = vertexBuffer
        this.indexBuffer = indexBuffer
        this.indexCount = indexCount
    }
    creatUniform() {
       
    }
    updateUniforms() {
        const data = new Float32Array([this.gui.x,this.gui.y,this.gui.z,this.gui.w]);
        this.device.queue.writeBuffer(
            this.uniformBuffer,
            0,      
            data.buffer,
            data.byteOffset,
            data.byteLength
        );
    }

    draw({ renderPass, frameBindGroup }: { renderPass: GPURenderPassEncoder, frameBindGroup: GPUBindGroup }) {
        renderPass.setPipeline(this.pipeline);
        this.updateUniforms();
        renderPass.setBindGroup(0, frameBindGroup);
         renderPass.setBindGroup(1, this.uniformBindGroup);
        renderPass.setVertexBuffer(0, this.vertexBuffer);
        renderPass.setIndexBuffer(this.indexBuffer, 'uint16');
        renderPass.drawIndexed(this.indexCount);
    }
}

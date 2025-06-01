import groundWGSL from '../shaders/ground.wgsl'; // cách import raw text (tuỳ config bundler)

import { GUI } from 'dat.gui';
interface GroundOptions {
    device: GPUDevice;
    presentationFormat: GPUTextureFormat;
    cameraBuffer: any
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
    constructor({ device, presentationFormat, cameraBuffer }: GroundOptions) {
        this.device = device;
        this.cameraBuffer = cameraBuffer
        this.uniformBindGroup = null;
        this.uniformBuffer = null
        this.presentationFormat = presentationFormat
        this.gui = {
            x:0,
            y:-.2,
            z:0,
            w:0
        }
        this.createGUI()
        this.createPipeline();
        this.creatUniform()
        this.createMesh();

    }

    createGUI() {
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
            depthStencil: {
                depthWriteEnabled: true,
                depthCompare: 'less',
                format: 'depth24plus',
            },
        } as any);
    }

    createMesh() {
        // Tạo plane đơn giản 2x2, 2 tam giác, có vị trí và UV
        // Vertex data: [x,y,z, u,v]
        const vertices = new Float32Array([
            -1, 0, -1, 0, 0,
            1, 0, -1, 1, 0,
            1, 0, 1, 1, 1,
            -1, 0, 1, 0, 1,
        ]);

        this.vertexBuffer = this.device.createBuffer({
            size: vertices.byteLength,
            usage: GPUBufferUsage.VERTEX,
            mappedAtCreation: true,
        });
        new Float32Array(this.vertexBuffer.getMappedRange()).set(vertices);
        this.vertexBuffer.unmap();

        const indices = new Uint16Array([0, 1, 2, 0, 2, 3]);
        this.indexCount = indices.length;

        this.indexBuffer = this.device.createBuffer({
            size: indices.byteLength,
            usage: GPUBufferUsage.INDEX,
            mappedAtCreation: true,
        });
        new Uint16Array(this.indexBuffer.getMappedRange()).set(indices);
        this.indexBuffer.unmap();
    }
    creatUniform() {
        const bufferSize = 4 * 4; // 4 floats * 4 bytes = 16 bytes
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
    updateUniforms(values: [number, number, number, number]) {
        const data = new Float32Array(values);
        this.device.queue.writeBuffer(
            this.uniformBuffer,
            0,      
            data.buffer,
            data.byteOffset,
            data.byteLength
        );
    }

    draw({ renderPass, uniform }: { renderPass: GPURenderPassEncoder, uniform?: GPUBindGroup[] }) {
        renderPass.setPipeline(this.pipeline);
        this.updateUniforms([this.gui.x,this.gui.y,this.gui.z,this.gui.w]);
        renderPass.setBindGroup(0, this.uniformBindGroup);

        if (uniform && uniform.length > 0) {
            for (let i = 0; i < uniform.length; i++) {
            renderPass.setBindGroup(i + 1, uniform[i]);
            }
        }
        renderPass.setVertexBuffer(0, this.vertexBuffer);
        renderPass.setIndexBuffer(this.indexBuffer, 'uint16');
        renderPass.drawIndexed(this.indexCount);
    }
}

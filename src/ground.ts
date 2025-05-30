import groundWGSL from './shaders/ground.wgsl'; // cách import raw text (tuỳ config bundler)

export class Ground {
    device: GPUDevice;
    pipeline: GPURenderPipeline;
    vertexBuffer: GPUBuffer;
    indexBuffer: GPUBuffer;
    indexCount: number;
    uniformBindGroup_GROUND:any;
    uniformBuffer_GROUND:any;
    
    constructor(device: GPUDevice) {
        this.device = device;
        this.createPipeline();
        this.createMesh();
        this.uniformBindGroup_GROUND = null;
        this.uniformBuffer_GROUND = null
    }

    createPipeline() {
        this.pipeline = this.device.createRenderPipeline({
            layout: 'auto',
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
                targets: [{ format: 'rgba16float' }],
            },
            primitive: {
                topology: 'triangle-list',
                cullMode: 'back',
            },
            depthStencil: {
                depthWriteEnabled: true,
                depthCompare: 'less',
                format: 'depth24plus',
            },
        } as any);
    }
    creatUniform() {
        const uniformBufferSize =
            4 * 4 * 4 + // modelViewProjectionMatrix : mat4x4f
            3 * 4 + // right : vec3f
            4 + // padding
            3 * 4 + // up : vec3f
            4 + // padding
            0;
         this.uniformBuffer_GROUND = this.device.createBuffer({
            size: uniformBufferSize,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        });

         this.uniformBindGroup_GROUND = this.device.createBindGroup({
            layout: this.pipeline.getBindGroupLayout(0),
            entries: [
            {
                binding: 0,
                resource: {
                buffer: this.uniformBuffer_GROUND,
                },
            },
            ],
        });
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

    draw(passEncoder: GPURenderPassEncoder) {
        passEncoder.setPipeline(this.pipeline);
        passEncoder.setBindGroup(0, this.uniformBindGroup_GROUND);
        passEncoder.setVertexBuffer(0, this.vertexBuffer);
        passEncoder.setIndexBuffer(this.indexBuffer, 'uint16');
        passEncoder.drawIndexed(this.indexCount);
    }
}

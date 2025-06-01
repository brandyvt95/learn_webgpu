import fullSceneQuadWGSL from '../shaders/common/fullSceneQuad.wgsl';

interface GroundOptions {
    device: GPUDevice;
    presentationFormat: GPUTextureFormat;
    viewport:any
}

export class InitFullSceneQuad {
    device: GPUDevice;
    pipeline: GPURenderPipeline;
    bindGroupLayout: GPUBindGroupLayout;
    bindGroup: GPUBindGroup;
    vertexCount: number = 6;
    viewport:any
    viewportSizeBuffer : any
    constructor({ device, presentationFormat,viewport }: GroundOptions) {
        this.device = device;
        this.viewport = viewport
        this.createPipeline(presentationFormat);
        this.createUnfirom()
    }

    createPipeline(presentationFormat: GPUTextureFormat) {
        const shaderModule = this.device.createShaderModule({
            code: fullSceneQuadWGSL,
        });

        this.pipeline = this.device.createRenderPipeline({
            layout: 'auto',
            vertex: {
                module: shaderModule,
                entryPoint: 'vs_main',
                buffers: [],
            },
            fragment: {
                module: shaderModule,
                entryPoint: 'fs_main',
                targets: [{ format: presentationFormat }],
            },
            primitive: {
                topology: 'triangle-list',
                cullMode: 'none',
            },
            depthStencil: {
                format: 'depth24plus',
                depthWriteEnabled: false,
                depthCompare: 'always',
            },
        });
    }
    createUnfirom() {
        this.viewportSizeBuffer = this.device.createBuffer({
            size: 8, // 2 * 4 bytes (vec2<f32>)
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        });
          const sizeArray = new Float32Array([this.viewport.width,this.viewport.height]);
        this.device.queue.writeBuffer(this.viewportSizeBuffer, 0, sizeArray.buffer);
    }
    updateBindGroup({ textureView, sampler }: {
        textureView: GPUTextureView;
        sampler: GPUSampler;
    }) {
        this.bindGroup = this.device.createBindGroup({
            layout: this.pipeline.getBindGroupLayout(0),
            entries: [
                {
                    binding: 0,
                    resource: textureView,
                },
                {
                    binding: 1,
                    resource: sampler,
                },
                {
                    binding: 2,
                    resource: {
                        buffer: this.viewportSizeBuffer,
                    },
                }
            ],
        });
    }

    draw({ renderPass }: { renderPass: GPURenderPassEncoder }) {
        renderPass.setPipeline(this.pipeline);
        renderPass.setBindGroup(0, this.bindGroup);
        renderPass.draw(this.vertexCount);
    }
}

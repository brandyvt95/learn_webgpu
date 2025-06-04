
import basicVertWGSL from './basic.vert.wgsl';
import sampleCubemapWGSL from './sampleCubemap.frag.wgsl';
import { GUI } from 'dat.gui';
import {
    cubeVertexArray,
    cubeVertexSize,
    cubeUVOffset,
    cubePositionOffset,
    cubeVertexCount,
} from '../meshes/cube';
import { COMMON_DEPTH_MSAA_DESC } from '../contrast';

interface InitCubeMapOptions {
    device: GPUDevice;
    presentationFormat: GPUTextureFormat;
    frameBindGroupLayout: any;
    cubemapTexture: any
}

export class InitCubeMap {
    device: GPUDevice;
    pipeline: GPURenderPipeline;
    vertexBuffer: GPUBuffer;
    indexBuffer: GPUBuffer;
    indexCount: number;
    uniformBindGroup: any;
    uniformBuffer: any;
    presentationFormat: any
    frameBindGroupLayout: any
    gui: any
    cubemapTexture: GPUTexture
    verticesBuffer: any
    constructor({ device, presentationFormat, frameBindGroupLayout, cubemapTexture }: InitCubeMapOptions) {
        this.device = device;
        this.frameBindGroupLayout = frameBindGroupLayout
        this.uniformBindGroup = null;
        this.uniformBuffer = null
        this.presentationFormat = presentationFormat
        this.cubemapTexture = cubemapTexture

        //this.createGUI()
        this.createPipeline();
        this.creatUniform()
        this.createMesh();

    }

    createGUI() {
        this.gui = {
            x: 0,
            y: -1,
            z: 0,
            w: 0
        }
        const gui = new GUI();
        gui.width = 325;
        gui.add(this.gui, 'x', -10, 10).step(0.1).name('Position X');
        gui.add(this.gui, 'y', -10, 10).step(0.1).name('Position Y');
        gui.add(this.gui, 'z', -10, 10).step(0.1).name('Position Z');
        gui.add(this.gui, 'w', -10, 10).step(0.1).name('Position W');
    }
    createPipeline() {

        const group0Layout = this.device.createBindGroupLayout({
            entries: [
                { binding: 0, visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT, buffer: { type: 'uniform' } }, // uniforms
                { binding: 1, visibility: GPUShaderStage.FRAGMENT, sampler: { type: 'filtering' } },                    // sampler
                { binding: 2, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: 'float', viewDimension: 'cube' } },                   // texture_cube
            ],
        });
        const pipelineLayout = this.device.createPipelineLayout({
            bindGroupLayouts: [this.frameBindGroupLayout, group0Layout],
        });
        this.pipeline = this.device.createRenderPipeline({
            label:'cube map pipline',
            layout: pipelineLayout,
            vertex: {
                module: this.device.createShaderModule({
                    code: basicVertWGSL,
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
                    code: sampleCubemapWGSL,
                }),
                targets: [
                    {
                        format: this.presentationFormat,
                    },
                ],
            },
            primitive: {
                topology: 'triangle-list',

                // Since we are seeing from inside of the cube
                // and we are using the regular cube geomtry data with outward-facing normals,
                // the cullMode should be 'front' or 'none'.
                cullMode: 'none',
            },

            // Enable depth testing so that the fragment closest to the camera
            // is rendered in front.
            ...COMMON_DEPTH_MSAA_DESC as any
        });
    }

    createMesh() {
        this.verticesBuffer = this.device.createBuffer({
            size: cubeVertexArray.byteLength,
            usage: GPUBufferUsage.VERTEX,
            mappedAtCreation: true,
        });
        new Float32Array(this.verticesBuffer.getMappedRange()).set(cubeVertexArray);
        this.verticesBuffer.unmap();
    }
    creatUniform() {

        const uniformBufferSize = 4 * 16; // 4x4 matrix
        this.uniformBuffer = this.device.createBuffer({
            size: uniformBufferSize,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        });

        const sampler = this.device.createSampler({
            magFilter: 'linear',
            minFilter: 'linear',
        });

        this.uniformBindGroup = this.device.createBindGroup({
            layout: this.pipeline.getBindGroupLayout(1),
            entries: [
                {
                    binding: 0,
                    resource: {
                        buffer: this.uniformBuffer,
                        offset: 0,
                        size: uniformBufferSize,
                    },
                },
                {
                    binding: 1,
                    resource: sampler,
                },
                {
                    binding: 2,
                    resource: this.cubemapTexture.createView({
                        dimension: 'cube',
                    }),
                },
            ],
        });
    }
    draw({ renderPass, frameBindGroup }: { renderPass: GPURenderPassEncoder, frameBindGroup: GPUBindGroup }) {

        renderPass.setPipeline(this.pipeline);
        renderPass.setVertexBuffer(0, this.verticesBuffer);
        renderPass.setBindGroup(0, frameBindGroup);
        renderPass.setBindGroup(1, this.uniformBindGroup);
        renderPass.draw(cubeVertexCount);


    }
}

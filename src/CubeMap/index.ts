/* https://06wj.github.io/WebGPU-Playground/#/Samples/CubeTexture
https://06wj.github.io/WebGPU-Playground/#/Samples/CubeTexture
https://06wj.github.io/WebGPU-Playground/#/Samples/CubeTexture
https://06wj.github.io/WebGPU-Playground/#/Samples/CubeTexture

https://06wj.github.io/WebGPU-Playground/#/Samples/CubeTexture
https://06wj.github.io/WebGPU-Playground/#/Samples/CubeTexture
https://06wj.github.io/WebGPU-Playground/#/Samples/CubeTexture
https://06wj.github.io/WebGPU-Playground/#/Samples/CubeTexture
https://06wj.github.io/WebGPU-Playground/#/Samples/CubeTexture
https://06wj.github.io/WebGPU-Playground/#/Samples/CubeTexture

https://06wj.github.io/WebGPU-Playground/#/Samples/CubeTexture
https://06wj.github.io/WebGPU-Playground/#/Samples/CubeTexture
https://06wj.github.io/WebGPU-Playground/#/Samples/CubeTexture

https://06wj.github.io/WebGPU-Playground/#/Samples/CubeTexturehttps://06wj.github.io/WebGPU-Playground/#/Samples/CubeTexture
*/
import basicVertWGSL from '../meshes/basic.vert.wgsl';
import sampleCubemapWGSL from '../meshes/sampleCubemap.frag.wgsl';
import { GUI } from 'dat.gui';
import {
    cubeVertexArray,
    cubeVertexSize,
    cubeUVOffset,
    cubePositionOffset,
    cubeVertexCount,
} from '../meshes/cube';

interface InitCubeMapOptions {
    device: GPUDevice;
    presentationFormat: GPUTextureFormat;
    cameraBuffer: any;
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
    cameraBuffer: any
    gui: any
    cubemapTexture: GPUTexture
    verticesBuffer: any
    constructor({ device, presentationFormat, cameraBuffer, cubemapTexture }: InitCubeMapOptions) {
        this.device = device;
        this.cameraBuffer = cameraBuffer
        this.uniformBindGroup = null;
        this.uniformBuffer = null
        this.presentationFormat = presentationFormat
        this.cubemapTexture = cubemapTexture
        this.gui = {
            x: 0,
            y: -1,
            z: 0,
            w: 0
        }
        //this.createGUI()
        this.createPipeline();
        this.creatUniform()
        this.createMesh();

    }

    createGUI() {
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

        const group1Layout = this.device.createBindGroupLayout({
            entries: [
                { binding: 0, visibility: GPUShaderStage.VERTEX, buffer: { type: 'uniform' } }, // camera_uniforms
            ],
        });
        const pipelineLayout = this.device.createPipelineLayout({
            bindGroupLayouts: [group0Layout, group1Layout],
        });
        this.pipeline = this.device.createRenderPipeline({
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
            depthStencil: {
                depthWriteEnabled: true,
                depthCompare: 'less',
                format: 'depth24plus',
            },
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
            layout: this.pipeline.getBindGroupLayout(0),
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
        renderPass.setVertexBuffer(0, this.verticesBuffer);
        renderPass.setBindGroup(0, this.uniformBindGroup);
        if (uniform && uniform.length > 0) {
            for (let i = 0; i < uniform.length; i++) {
                renderPass.setBindGroup(i + 1, uniform[i]);
            }
        }
        renderPass.draw(cubeVertexCount);


    }
}

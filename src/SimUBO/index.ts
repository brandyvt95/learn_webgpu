
import { GUI } from 'dat.gui';
import particleWGSL from '../shaders/particle.wgsl';

interface SimUBOOptions {
  device: GPUDevice;
  presentationFormat: GPUTextureFormat;
  POINT_BUFFER:any;
  CONFIG_POINT_UBO:any;
  SIM_UBO_PARAMS:any;
  infoTexVATDetail:GPUTexture
}

export class SimUBO {
    device: GPUDevice;
    pipeline: GPURenderPipeline;
    SIM_UBO_PARAMS: any;
    simulationUBOBuffer: any;
    computeBindGroup: any;
    particlesBuffer: any;
    numParticles: any;
    CONFIG_POINT_UBO:any;
    particleInstanceByteSize: any
    infoTexVATDetail: any
    constructor({device, POINT_BUFFER,CONFIG_POINT_UBO, SIM_UBO_PARAMS, infoTexVATDetail}:SimUBOOptions) {
        this.device = device;

        this.particlesBuffer = POINT_BUFFER
        this.SIM_UBO_PARAMS = SIM_UBO_PARAMS;
        this.CONFIG_POINT_UBO = CONFIG_POINT_UBO
        this.numParticles = this.CONFIG_POINT_UBO.numParticles
        this.particleInstanceByteSize = this.CONFIG_POINT_UBO.particleInstanceByteSize
        this.infoTexVATDetail = infoTexVATDetail



        this.createGUI()
        this.createPipeline();
        this.creatUniform()
        this.createBindGroup()

    }

    createGUI() {
        const gui = new GUI();
        gui.width = 100;
        gui.add(this.SIM_UBO_PARAMS, 'simulate');
        gui.add(this.SIM_UBO_PARAMS, 'deltaTime');
    }
    createPipeline() {
        this.pipeline = this.device.createComputePipeline({
            layout: 'auto',
            compute: {
                module: this.device.createShaderModule({
                    code: particleWGSL,
                }),
                entryPoint: 'simulate',
            },
            
        }) as any
    }
    creatUniform() {
        const simulationUBOBufferSize =
            1 * 4 + // deltaTime
            1 * 4 + // brightnessFactor
            1 * 4 + // time
            1 * 4 + // padding
            4 * 4 + // seed
            0;
        this.simulationUBOBuffer = this.device.createBuffer({
            size: simulationUBOBufferSize,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        });
    }
    createBindGroup() {
        this.computeBindGroup = this.device.createBindGroup({
            layout: this.pipeline.getBindGroupLayout(0),
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
                        size: this.numParticles * this.particleInstanceByteSize,
                    },
                },
                {
                    binding: 2,
                    resource: this.infoTexVATDetail.createView(),
                },
            ],
        });
    }

    draw(computePass: any) {

        computePass.setPipeline(this.pipeline);
        computePass.setBindGroup(0, this.computeBindGroup);
        computePass.dispatchWorkgroups(Math.ceil(this.numParticles / 64));
        computePass.end();
    }
}

import groundWGSL from '../shaders/ground.wgsl'; // cách import raw text (tuỳ config bundler)

interface GroundOptions {
  device: GPUDevice;
  presentationFormat: GPUTextureFormat;
}

export class InitModelSkin {
    device: GPUDevice;
    pipeline: GPURenderPipeline;
   
    constructor({device,presentationFormat}: GroundOptions) {
        this.device = device;

        this.createPipeline();
        this.creatUniform()
        this.createMesh();

    }

    createPipeline() {
       
    }
    creatUniform() {
       
    }
    createMesh() {
       
    }

    draw(passEncoder: GPURenderPassEncoder) {
       
    }
}

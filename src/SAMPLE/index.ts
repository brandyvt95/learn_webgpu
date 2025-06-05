import sample from '../shaders/sample.wgsl'; 

interface SampleOptions {
  device: GPUDevice;
  presentationFormat: GPUTextureFormat;
}

export class Sample {
    device: GPUDevice;
    pipeline: GPURenderPipeline;
    presentationFormat:any
    constructor({device,presentationFormat}: SampleOptions) {
        this.device = device;
        this.presentationFormat = presentationFormat
        this.createPipeline();
        this.creatBuffer()
        this.createMesh();

    }

    createPipeline() {
       
    }
    creatBuffer() {
       
    }
    createMesh() {
       
    }

    draw(passEncoder: GPURenderPassEncoder) {
       
    }
}

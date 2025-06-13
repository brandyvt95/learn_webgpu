
export interface IComputeInitOptions {
    device: GPUDevice
    bindGroupList?: GPUBindGroup[]
    layout?: GPUBindGroupLayout[]
    shader:any
}
export async function initComputePipeline({ device, layout, shader }: IComputeInitOptions) {

 
    const pipelineLayout = device.createPipelineLayout({
        bindGroupLayouts: layout
    });
    const computeModule = device.createShaderModule({
        code: shader,
    });

    const computePipeline = await device.createComputePipelineAsync({
        label: 'compute instacne',
        layout: pipelineLayout,
        compute: {
            module: computeModule,
            entryPoint: 'main',
        },
    });

    return computePipeline;
}

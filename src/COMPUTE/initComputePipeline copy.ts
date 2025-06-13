import computeWGSL from './fkCompute.wgsl';
export interface IComputeInitOptions {
    device: GPUDevice
    bindGroupList?: GPUBindGroup[]
    layout?: GPUBindGroupLayout[]
}
export async function initComputePipeline({ device, layout, bindGroupList }: IComputeInitOptions) {

 
    const pipelineLayout = device.createPipelineLayout({
        bindGroupLayouts: layout
    });
    const computeModule = device.createShaderModule({
        code: computeWGSL,
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

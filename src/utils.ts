export const createLightBuffer = ({device}:{device:GPUDevice}) => {
    
      const MAX_POINT_LIGHTS = 64;
      const DIRECTIONAL_LIGHT_STRUCT_SIZE = 32;
      const POINT_LIGHT_STRUCT_SIZE = 32;
      const LIGHT_BUFFER_SIZE = DIRECTIONAL_LIGHT_STRUCT_SIZE + (MAX_POINT_LIGHTS * POINT_LIGHT_STRUCT_SIZE) + 16;
    
    
    // Kích thước từng phần:
    const vec3Size = 12; // 3 * 4 bytes
    const f32Size = 4;
    
    const directionalLightSize = 32; // 2 vec3 + 2 f32 padding
    const pointLightSize = 32;       // vec3 + f32 + vec3 + f32
    const ambientSize = 16;          // vec3 + f32 padding
    const pointLightCountSize = 4;
    const padPointLightCountSize = 12; // vec3<u32> padding
    const totalLightSize = ambientSize + directionalLightSize + pointLightCountSize + padPointLightCountSize + (MAX_POINT_LIGHTS * pointLightSize);
    
    // Dữ liệu mẫu:
    const bufferArray = new Float32Array(totalLightSize / 4);
    
    // Fill ambient light
    bufferArray.set([1.0, 1., 0.1, 0.0], 0); // ambient (vec3 + padding)
    
    // Fill directional light
    bufferArray.set([1.0, -1.0, 0.0, 0.0], 4); // direction + padding
    bufferArray.set([1.0, 1.0, 1.0, 0.0], 8);  // color + padding
    
    // Point light count
    bufferArray[12] = 2;                      // 13-15 là padding
    
    // Point Light 1
    bufferArray.set([0.0, 1.0, 2.0, 5.0], 16); // position + radius
    bufferArray.set([1.0, 1.0, 0.0, 2.0], 20); // color + intensity
    
    // Point Light 2
    bufferArray.set([2.0, 3.0, 4.0, 10.0], 24); // position + radius
    bufferArray.set([0.5, 0.5, 1.0, 1.5], 28);  // color + intensity
    
    // GPU Buffer tạo từ dữ liệu trên
    const lightBuffer = device.createBuffer({
      label: 'Lights buffer',
      size: bufferArray.byteLength,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
      mappedAtCreation: true,
    });
    
    new Float32Array(lightBuffer.getMappedRange()).set(bufferArray);
    lightBuffer.unmap();
    return lightBuffer
}

export const createEnvironmentSampler =  ({device}:{device:GPUDevice}) => {
  const environmentSampler = device.createSampler({
    label: 'environment sampler',
    minFilter: 'linear',
    magFilter: 'linear',
    mipmapFilter: 'linear',
    addressModeU: 'repeat',
    addressModeV: 'repeat',
    addressModeW: 'repeat',
  });
  return environmentSampler
}
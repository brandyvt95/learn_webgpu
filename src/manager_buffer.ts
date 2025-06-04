// ManagerBuffer.ts

export const ManagerBuffer = () => {
  const buffers: Record<string, GPUBuffer> = {};

  const createBuffer = (
    device: GPUDevice,
    name: string,
    size: number,
    usage: GPUBufferUsageFlags,
    mappedAtCreation = false
  ) => {
    const buffer = device.createBuffer({
      label: name,
      size,
      usage,
      mappedAtCreation
    });
    buffers[name] = buffer;
    return buffer;
  };

  const getBuffer = (name: string): GPUBuffer | undefined => {
    return buffers[name];
  };

  const updateBuffer = (
    device: GPUDevice,
    name: string,
    data: ArrayBuffer | ArrayBufferView
  ) => {
    const buffer = buffers[name];
    if (!buffer) throw new Error(`Buffer ${name} not found`);

    device.queue.writeBuffer(buffer, 0, data instanceof ArrayBuffer ? data : data.buffer);
  };

  const destroyBuffer = (name: string) => {
    const buffer = buffers[name];
    if (buffer) {
      buffer.destroy();
      delete buffers[name];
    }
  };

  return {
    createBuffer,
    getBuffer,
    updateBuffer,
    destroyBuffer
  };
};

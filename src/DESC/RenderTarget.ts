export function createRenderTargets(device: GPUDevice, canvas: HTMLCanvasElement, presentationFormat: GPUTextureFormat, presentationFormatDepth: GPUTextureFormat, COMMON_DEPTH_MSAA_DESC: any) {
  const depthTexture = device.createTexture({
    size: [canvas.width, canvas.height],
    format: presentationFormatDepth,
    usage: GPUTextureUsage.RENDER_ATTACHMENT,
  });

  const depthTextureMSAA = device.createTexture({
    size: [canvas.width, canvas.height],
    format: presentationFormatDepth,
    sampleCount: COMMON_DEPTH_MSAA_DESC.multisample.count,
    usage: GPUTextureUsage.RENDER_ATTACHMENT,
  });

  const sceneMSAATexture = device.createTexture({
    size: [canvas.width, canvas.height],
    sampleCount: COMMON_DEPTH_MSAA_DESC.multisample.count,
    format: presentationFormat,
    usage: GPUTextureUsage.RENDER_ATTACHMENT,
  });

  const sceneMainTexture = device.createTexture({
    size: [canvas.width, canvas.height],
    format: presentationFormat,
    usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
  });

  const sceneRenderPassDesc: GPURenderPassDescriptor = {
    colorAttachments: [{
      view: undefined, // bạn set sau tùy theo MSAA hay không
      loadOp: 'clear',
      storeOp: 'store',
      clearValue: { r: 0, g: 0, b: 0, a: 1 },
      resolveTarget: undefined, // set sau nếu dùng MSAA
    }],
    depthStencilAttachment: {
      view: depthTexture.createView(), // hoặc depthTextureMSAA.createView() nếu dùng MSAA
      depthClearValue: 1.0,
      depthLoadOp: 'clear',
      depthStoreOp: 'store',
    },
  };

  return {
    depthTexture,
    depthTextureMSAA,
    sceneMSAATexture,
    sceneMainTexture,
    sceneRenderPassDesc,
  };
}

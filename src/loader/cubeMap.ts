export async function loadCubemapTexture(
  device: GPUDevice,
  imgSrcs: string[]
): Promise<GPUTexture> {
  if (imgSrcs.length !== 6) {
    throw new Error('Cubemap must have exactly 6 images.');
  }

  const imageBitmaps = await Promise.all(
    imgSrcs.map(async (src) => {
      const response = await fetch(src);
      const blob = await response.blob();
      return await createImageBitmap(blob);
    })
  );

  const { width, height } = imageBitmaps[0];

  const cubemapTexture = device.createTexture({
    size: [width, height, 6],
    format: 'rgba8unorm',
    dimension: '2d',
    usage:
      GPUTextureUsage.TEXTURE_BINDING |
      GPUTextureUsage.COPY_DST |
      GPUTextureUsage.RENDER_ATTACHMENT,
  });

  for (let i = 0; i < 6; i++) {
    device.queue.copyExternalImageToTexture(
      { source: imageBitmaps[i] },
      { texture: cubemapTexture, origin: [0, 0, i] },
      [width, height]
    );
  }

  return cubemapTexture;
}

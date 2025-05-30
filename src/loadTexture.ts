const loadPNG = async (url) => {
  const response = await fetch(url);
  const imageBlob = await response.blob();
  const imageBitmap = await createImageBitmap(imageBlob);

  return imageBitmap;
};

export const createTextureFromPNGWithoutMipmaps = async (device,url) => {
  const imageBitmap = await loadPNG(url);

  const imageWidth = imageBitmap.width;
  const imageHeight = imageBitmap.height;

  // Tạo WebGPU texture với mipLevelCount là 1 (không sử dụng mipmaps)
  const texture = device.createTexture({
    size: [imageWidth, imageHeight, 1], // Kích thước ảnh
    mipLevelCount: 1,  // Không tạo mipmaps
    format: 'rgba8unorm',  // Định dạng ảnh PNG
    usage:
      GPUTextureUsage.TEXTURE_BINDING |
      GPUTextureUsage.COPY_DST |
      GPUTextureUsage.RENDER_ATTACHMENT,  // Sử dụng cho các mục đích khác mà không cần mipmaps
  });

  // Sao chép dữ liệu PNG vào texture
  device.queue.copyExternalImageToTexture(
    { source: imageBitmap },
    { texture: texture },
    [imageWidth, imageHeight]
  );

  return texture;
};


export async function cropBinToWebGPUTexture(
  device: GPUDevice,
  binBuffer: ArrayBuffer,
  width: number,
  height: number,
  columnGroups: number[][],
  bytesPerPixel = 8 // mặc định RGBA8
): Promise<{
  texture: GPUTexture
  blockWidths: number[]
  pixelRanges: [number, number][]
  uvRanges: [number, number][]
}> {
  const totalPixels = width * height
  const data = new Uint16Array(binBuffer) // giả sử là Uint8 data, chỉnh lại nếu khác

  // Tính cột hợp lệ và tạo flattened indices
  const blockWidths: number[] = []
  const flattenedIndices: number[] = []
  const pixelRanges: [number, number][] = []
  const uvRanges: [number, number][] = []

  let currentOffset = 0
  for (const group of columnGroups) {
    const validIndices = group.filter(i => i >= 0 && i < width)
    blockWidths.push(validIndices.length)
    flattenedIndices.push(...validIndices)
    const start = currentOffset
    const end = start + validIndices.length
    pixelRanges.push([start, end])
    currentOffset = end
  }

  const croppedWidth = flattenedIndices.length
  const croppedData = new Uint16Array(croppedWidth * height * bytesPerPixel)

  // Copy pixel data theo cột và hàng
  for (let row = 0; row < height; row++) {
    const dstRowStart = row * croppedWidth * bytesPerPixel
    const srcRowStart = row * width * bytesPerPixel
    for (let i = 0; i < croppedWidth; i++) {
      const srcCol = flattenedIndices[i]
      const srcOffset = srcRowStart + srcCol * bytesPerPixel
      const dstOffset = dstRowStart + i * bytesPerPixel
      // copy pixel RGBA
      for (let b = 0; b < bytesPerPixel; b++) {
        croppedData[dstOffset + b] = data[srcOffset + b]
      }
    }
  }

  // Tạo WebGPU texture
  const texture = device.createTexture({
    size: [croppedWidth, height, 1],
    format: 'rgba16float', /// 8byte for unt16
    usage:
      GPUTextureUsage.TEXTURE_BINDING |
      GPUTextureUsage.COPY_DST |
      GPUTextureUsage.STORAGE_BINDING |
      GPUTextureUsage.RENDER_ATTACHMENT,
  })

  device.queue.writeTexture(
    { texture },
    croppedData,
    {
      bytesPerRow: croppedWidth * bytesPerPixel,
      rowsPerImage: height,
    },
    [croppedWidth, height, 1]
  )

  for (const [start, end] of pixelRanges) {
    uvRanges.push([start / croppedWidth, end / croppedWidth])
  }

  return {
    texture,
    blockWidths,
    pixelRanges,
    uvRanges,
  }
}



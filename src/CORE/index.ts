import { configureContext, quitIfWebGPUNotAvailable } from './util.js';
export async function initCoreEngine({ canvas }: { canvas: HTMLCanvasElement }) {
  const devicePixelRatio = window.devicePixelRatio;
  canvas.width = canvas.clientWidth * devicePixelRatio;
  canvas.height = canvas.clientHeight * devicePixelRatio;
  const adapter = await navigator.gpu?.requestAdapter({
    featureLevel: 'compatibility',
  });
  const device = await adapter?.requestDevice();
  quitIfWebGPUNotAvailable(adapter, device);
  const context = canvas.getContext('webgpu') as GPUCanvasContext;
  //FORMAT
  const presentationFormat = navigator.gpu.getPreferredCanvasFormat()
  //CONFIG CONTEXT
  configureContext({
    device: device, context: context, presentationFormat: presentationFormat,
      alphaMode: 'premultiplied',
    /*  toneMapping: SIM_UBO_PARAMS.toneMappingMode */
  });

  return {
    device: device,
    context: context,
    format: {
      presentationFormat: presentationFormat,
      presentationUBOFormat: 'rgba16float',
      presentationFormatDepth: 'depth24plus'
    },
    canvas: {
      el: canvas,
      dpr: devicePixelRatio,
      size: [canvas.width, canvas.height]
    }
  }
}
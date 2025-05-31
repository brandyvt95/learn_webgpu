import { mat4, vec3 } from 'wgpu-matrix';
import { GUI } from 'dat.gui';

import particleWGSL from './shaders/particle.wgsl';
import probabilityMapWGSL from './shaders/probabilityMap.wgsl';
import { configureContext, quitIfWebGPUNotAvailable } from './util';
import { createInputHandler } from './intractive';
import { initCamera } from './camera/index';
import { createTextureFromPNGWithoutMipmaps, cropBinToWebGPUTexture } from './loadTexture';

import DATA_DETAIL_VAT from '../img/fast_run.json'
import { InitGround } from './Ground';
import { SimUBO } from './SimUBO';
import { InitPoint } from './Point';
import { convertGLBToJSONAndBinary } from './utils/glbUtils';
import { createBindGroupCluster } from './bitonicSort/utils'



const CONFIG_VAT = {
  width: 23243,
  height: 63
}

const SIM_UBO_PARAMS = {
  simulate: true,
  deltaTime: 0.04,
  toneMappingMode: 'standard' as GPUCanvasToneMappingMode,
  brightnessFactor: 1.0,
  snapFrame: 0
};
const CONFIG_POINT_UBO = {
  numParticles: 35000,
  particlePositionOffset: 0,
  particleColorOffset: 4 * 4,
  particleInstanceByteSize:
    3 * 4 + // position
    1 * 4 + // lifetime
    4 * 4 + // color
    3 * 4 + // velocity
    1 * 4 + // padding
    0,

}
async function main() {
  const numParticles = 345000;
  const particlePositionOffset = 0;
  const particleColorOffset = 4 * 4;
  const particleInstanceByteSize =
    3 * 4 + // position
    1 * 4 + // lifetime
    4 * 4 + // color
    3 * 4 + // velocity
    1 * 4 + // padding
    0;



  const EL_INFO_FPS = document.getElementById("info")
  const canvas = document.querySelector('canvas') as HTMLCanvasElement;
  const adapter = await navigator.gpu?.requestAdapter({
    featureLevel: 'compatibility',
  });
  const device = await adapter?.requestDevice();
  quitIfWebGPUNotAvailable(adapter, device);

  const context = canvas.getContext('webgpu') as GPUCanvasContext;

  const devicePixelRatio = window.devicePixelRatio;
  canvas.width = canvas.clientWidth * devicePixelRatio;
  canvas.height = canvas.clientHeight * devicePixelRatio;
  const aspect = canvas.width / canvas.height;

  //FORMAT
  const presentationFormat = navigator.gpu.getPreferredCanvasFormat()
  const presentationUBOFormat = 'rgba16float'
  //CONFIG CONTEXT
  configureContext({
    device: device, context: context, presentationFormat: presentationFormat, toneMapping: SIM_UBO_PARAMS.toneMappingMode
  });



  let coutnFrame = 0
  let then = 0;
  let lastInfoUpdate = 0;

  const columnGroups = [
    DATA_DETAIL_VAT.backFaceVAT,
    DATA_DETAIL_VAT.footLeftVAT,
    DATA_DETAIL_VAT.footRightVAT
  ]
  const result = await cropBinToWebGPUTexture(device, '../img/fast_run_vat.bin', CONFIG_VAT.width, CONFIG_VAT.height, columnGroups)
  const infoTexVATDetail = result.texture;

  const { camera, getModelViewProjectionMatrix } = initCamera(window, canvas)

const CAMERABUFFER = device.createBuffer({
  size: 96, // 16 floats cho MVP + 3 right + 1 padding + 3 up + 1 padding = 20
  usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
});
const cameraBGCluster = createBindGroupCluster(
  [0],                               // binding index
  [GPUShaderStage.VERTEX],          // shader visibility
  ['buffer'],                       // resource type
  [{ type: 'uniform' }],            // buffer layout
  [[{ buffer: CAMERABUFFER }]], // actual buffer
  'SharedCamera',
  device
);


  const POINT_BUFFER = device.createBuffer({
    size: numParticles * particleInstanceByteSize,
    usage: GPUBufferUsage.VERTEX | GPUBufferUsage.STORAGE,
  });


  // PASS LIST
  const simUBO = new SimUBO({
    device: device,
    POINT_BUFFER: POINT_BUFFER,
    CONFIG_POINT_UBO: CONFIG_POINT_UBO,
    SIM_UBO_PARAMS: SIM_UBO_PARAMS,
    infoTexVATDetail: infoTexVATDetail,
    presentationFormat: presentationUBOFormat
  })
  const point = new InitPoint({
    device: device,
    POINT_BUFFER: POINT_BUFFER,
    CONFIG_POINT_UBO: CONFIG_POINT_UBO,
    presentationFormat: presentationFormat
  })
  const ground = new InitGround({
    device: device,
    presentationFormat: presentationFormat,
    cameraBuffer:CAMERABUFFER
  });


  const whaleScene = await fetch('/src/assets/model/whale.glb')
    .then((res) => res.arrayBuffer())
    .then((buffer) => convertGLBToJSONAndBinary(buffer, device));
  console.log(whaleScene)







  const depthTexture = device.createTexture({
    size: [canvas.width, canvas.height],
    format: 'depth24plus',
    usage: GPUTextureUsage.RENDER_ATTACHMENT,
  });

  const renderPassDescriptor: GPURenderPassDescriptor = {
    colorAttachments: [
      {
        view: undefined, // Assigned later
        clearValue: [0, 0, 0, 1],
        loadOp: 'clear',
        storeOp: 'store',
      },
    ],
    depthStencilAttachment: {
      view: depthTexture.createView(),

      depthClearValue: 1.0,
      depthLoadOp: 'clear',
      depthStoreOp: 'store',

    },
  };

  function updateUniformGlobal() {
    const { modelViewProjectionMatrix, viewMatrix } = getModelViewProjectionMatrix(SIM_UBO_PARAMS.deltaTime);
    device.queue.writeBuffer(
      simUBO.simulationUBOBuffer,
      0,
      new Float32Array([
        SIM_UBO_PARAMS.simulate ? SIM_UBO_PARAMS.deltaTime * .1 : 0.0,
        coutnFrame,
        0.0,
        0.0, // padding
        Math.random() * 100,
        Math.random() * 100, // seed.xy
        1 + Math.random(),
        1 + Math.random(), // seed.zw
      ])
    );


   const sharedUniformData = new Float32Array([
      ...modelViewProjectionMatrix,
      // right
      viewMatrix[0], viewMatrix[4], viewMatrix[8],
      0,

      // up
      viewMatrix[1], viewMatrix[5], viewMatrix[9],
      0,
    ]);

    device.queue.writeBuffer(CAMERABUFFER, 0, sharedUniformData);
    device.queue.writeBuffer(
      ground.uniformBuffer_GROUND,
      0,
     sharedUniformData
    );
  
  }

  function render() {
    coutnFrame += SIM_UBO_PARAMS.deltaTime * 40
    if (coutnFrame > CONFIG_VAT.height) {
      coutnFrame = 0
    }

    updateUniformGlobal()

    const swapChainTexture = context.getCurrentTexture();
    // prettier-ignore
    renderPassDescriptor.colorAttachments[0].view = swapChainTexture.createView();

    const commandEncoder = device.createCommandEncoder();
    {
      const computePass = commandEncoder.beginComputePass();
      simUBO.draw(computePass)
    }
    {
      const renderPass = commandEncoder.beginRenderPass(renderPassDescriptor);

      ground.draw({
        renderPass:renderPass,
        uniform:[
          cameraBGCluster.bindGroups[0]
        ]
      });
      point.draw(renderPass)
      renderPass.end();
    }

    device.queue.submit([commandEncoder.finish()]);
  }


  function frame(now) {
    console.log(camera)
    now *= 0.001; // giây
    const deltaTime = now - then;
    then = now;

    const startTime = performance.now();
    render();
    const jsTime = performance.now() - startTime;

    // Chỉ cập nhật EL_INFO_FPS mỗi 0.5 giây
    if (now - lastInfoUpdate > 0.5) {
      EL_INFO_FPS.textContent = `\
fps: ${(1 / deltaTime).toFixed(1)}
js: ${jsTime.toFixed(1)}ms
      `;
      lastInfoUpdate = now;
    }

    requestAnimationFrame(frame);
  }

  requestAnimationFrame(frame);

  function assert(cond: boolean, msg = '') {
    if (!cond) {
      throw new Error(msg);
    }
  }


}

main(); 
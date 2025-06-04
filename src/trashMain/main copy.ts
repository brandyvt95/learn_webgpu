import { Mat4, mat4, quat, vec3 } from 'wgpu-matrix';
import { GUI } from 'dat.gui';
import gltfWGSL from './shaders/common/gltf.wgsl';
import gridWGSL from './shaders/common/grid.wgsl';
import particleWGSL from './shaders/particle.wgsl';
import probabilityMapWGSL from './shaders/probabilityMap.wgsl';
import { configureContext, quitIfWebGPUNotAvailable } from './util';
import { createInputHandler } from './intractive';
import { initCamera } from './camera/index';
import { createTextureFromPNGWithoutMipmaps, cropBinToWebGPUTexture, loadCubemapTexture } from './loadTexture';
import {
  createSkinnedGridBuffers,
  createSkinnedGridRenderPipeline,
} from './utils/gridUtils'
import DATA_DETAIL_VAT from '../img/fast_run.json'
import { InitGround } from './Ground';
import { SimUBO } from './SimUBO';
import { InitPoint } from './Point';
import { convertGLBToJSONAndBinary, GLTFSkin } from './utils/glbUtils';
import { createBindGroupCluster } from './bitonicSort/utils'
import { InitCubeMap } from './CubeMap';
import { OrbitCamera } from './camera/OrbitCamera';
import { createModelMatrix, updateProjection } from './camera/utils';
import { animSkinnedGrid, animWhaleSkin, createBoneCollection } from './ModelSkin/utilsBone';

const MAT4X4_BYTES = 64;



enum RenderMode {
  NORMAL,
  JOINTS,
  WEIGHTS,
}

enum SkinMode {
  ON,
  OFF,
}

const columnGroupsVAT = [
  DATA_DETAIL_VAT.backFaceVAT,
  DATA_DETAIL_VAT.footLeftVAT,
  DATA_DETAIL_VAT.footRightVAT
]


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
  numParticles: 200000,
  particlePositionOffset: 0,
  particleColorOffset: 4 * 4,
  particleExtraOffset: 4 * 4,
  particleInstanceByteSize:
    3 * 4 + // position
    1 * 4 + // lifetime
    4 * 4 + // color
    3 * 4 + // velocity
    1 * 4 + // padding
    0,

}
async function main() {



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

  //LOAD TEX
  //LOAD TEX
  //LOAD TEX
  //LOAD TEX
  const result = await cropBinToWebGPUTexture(device, '../img/fast_run_vat.bin', CONFIG_VAT.width, CONFIG_VAT.height, columnGroupsVAT)
  const infoTexVATDetail = result.texture;

  const cubemapUrls = [
    '/src/assets/img/cubemap/posx.jpg',
    '/src/assets/img/cubemap/negx.jpg',
    '/src/assets/img/cubemap/posy.jpg',
    '/src/assets/img/cubemap/negy.jpg',
    '/src/assets/img/cubemap/posz.jpg',
    '/src/assets/img/cubemap/negz.jpg',
  ];

  const cubemapTexture = await loadCubemapTexture(device, cubemapUrls);

  //CAMERA
  const cameraOrbit = new OrbitCamera(canvas);
  cameraOrbit.target = [0, 0, 0]



 const mat4Size = 64; // 4 * 4 * 4
const vec3AlignedSize = 16; // vec3<f32> + padding

const BUFFER_CAMERA_UNIFORM_SIZE = mat4Size * 3 + vec3AlignedSize; // 192 + 16 = 208

  const BUFFER_CAMERA_UNIFORM = device.createBuffer({
    size: BUFFER_CAMERA_UNIFORM_SIZE,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });

  const cameraBGCluster = createBindGroupCluster(
    [0],                               // binding index
    [GPUShaderStage.VERTEX],          // shader visibility
    ['buffer'],                       // resource type
    [{ type: 'uniform' }],            // buffer layout
    [[{ buffer: BUFFER_CAMERA_UNIFORM }]], // actual buffer
    'SharedCamera',
    device
  );


  const POINT_BUFFER = device.createBuffer({
    size: CONFIG_POINT_UBO.numParticles * CONFIG_POINT_UBO.particleInstanceByteSize,
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
    cameraBuffer: BUFFER_CAMERA_UNIFORM
  });

  const enviromentCube = new InitCubeMap({
    device: device,
    presentationFormat: presentationFormat,
    cameraBuffer: BUFFER_CAMERA_UNIFORM,
    cubemapTexture: cubemapTexture
  });





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

  const generalUniformsBuffer = device.createBuffer({
    size: Uint32Array.BYTES_PER_ELEMENT * 2,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });
  const generalUniformsBGCLuster = createBindGroupCluster(
    [0],
    [GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT],
    ['buffer'],
    [{ type: 'uniform' }],
    [[{ buffer: generalUniformsBuffer }]],
    'General',
    device
  );
  // Same bindGroupLayout as in main file.
  const nodeUniformsBindGroupLayout = device.createBindGroupLayout({
    label: 'NodeUniforms.bindGroupLayout',
    entries: [
      {
        binding: 0,
        buffer: {
          type: 'uniform',
        },
        visibility: GPUShaderStage.VERTEX,
      },
    ],
  });
  const whaleScene = await fetch('/src/assets/model/whale.glb')
    .then((res) => res.arrayBuffer())
    .then((buffer) => convertGLBToJSONAndBinary(buffer, device));
  whaleScene.meshes[0].buildRenderPipeline(
    device,
    gltfWGSL,
    gltfWGSL,
    presentationFormat,
    depthTexture.format,
    [
      cameraBGCluster.bindGroupLayout,
      generalUniformsBGCLuster.bindGroupLayout,
      nodeUniformsBindGroupLayout,
      GLTFSkin.skinBindGroupLayout,
    ]
  );

  const origMatrices = new Map<number, Mat4>();

  function updateMeshSkin() {
     const angle = Math.sin(then)

    // Update node matrixes
    for (const scene of whaleScene.scenes) {
      scene.root.updateWorldMatrix(device);
    }

    // Updates skins (we index into skins in the renderer, which is not the best approach but hey)
    animWhaleSkin(whaleScene.skins[0], angle,origMatrices,whaleScene);
    // Node 6 should be the only node with a drawable mesh so hopefully this works fine
    whaleScene.skins[0].update(device, 6, whaleScene.nodes);
  }


  function updateUniformGlobal() {
    const viewMatrix = cameraOrbit.viewMatrix
    const mvpMatrix = cameraOrbit.mvpMatrix
    device.queue.writeBuffer(
      simUBO.simulationUBOBuffer,
      0,
      new Float32Array([
        SIM_UBO_PARAMS.simulate ? SIM_UBO_PARAMS.deltaTime * .1 : 0.0,
        coutnFrame,
        then,
        0.0, // padding
        Math.random() * 100,
        Math.random() * 100, // seed.xy
        1 + Math.random(),
        1 + Math.random(), // seed.zw
      ])
    );
    device.queue.writeBuffer(
      enviromentCube.uniformBuffer,
      0,
      mvpMatrix.buffer,
      mvpMatrix.byteOffset,
      mvpMatrix.byteLength
    );

   const cameraData = new Float32Array(208 / 4); // = 52 floats // 4 m4 + 1 v3
    // Fill: matrixA (16 floats), matrixB (16 floats), matrixC (16 floats)
    cameraData.set(cameraOrbit.modelMatrix, 0);
    cameraData.set(cameraOrbit.viewMatrix, 16);
    cameraData.set(cameraOrbit.projectionMatrix, 32);
    // Fill vec3 (3 floats)
    cameraData.set(cameraOrbit.position, 48);
    // Padding (1 float, optional: can be zero)
    cameraData[51] = 0;
    device.queue.writeBuffer(BUFFER_CAMERA_UNIFORM, 0, cameraData.buffer);

  }

  function render() {
    coutnFrame += SIM_UBO_PARAMS.deltaTime * 40
    if (coutnFrame > CONFIG_VAT.height) {
      coutnFrame = 0
    }
    updateMeshSkin()
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
      // enviromentCube.draw({
      //   renderPass: renderPass,
      //   uniform: [
      //     cameraBGCluster.bindGroups[0]
      //   ]
      // });
      for (const scene of whaleScene.scenes) {
        scene.root.renderDrawables(renderPass, [
          cameraBGCluster.bindGroups[0],
          generalUniformsBGCLuster.bindGroups[0],
        ]);
      }
      ground.draw({
        renderPass: renderPass,
        uniform: [
          cameraBGCluster.bindGroups[0]
        ]
      });
      // point.draw({
      //   renderPass: renderPass,
      //   uniform: [
      //     cameraBGCluster.bindGroups[0]
      //   ]
      // });
      renderPass.end();
    }

    device.queue.submit([commandEncoder.finish()]);
  }


  function frame(now) {

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
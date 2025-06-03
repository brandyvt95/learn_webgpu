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
import { InitModelSkin } from './ModelSkin';
import { InitFullSceneQuad } from './FullSceneQuad';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

import { WebGpuGltfLoader } from './third-party/hoard-gpu/dist/gltf/webgpu-gltf-loader.js'
import { WebGpuTextureLoader } from './third-party/hoard-gpu/dist/texture/webgpu/webgpu-texture-loader.js'
import { ComputeAABB } from './third-party/hoard-gpu/dist/gltf/transforms/compute-aabb.js'
import { GltfLoader } from './loader/gltfFire.js';
import { InitModelSkin2 } from './ModelSkin2/index.js';
import { SceneObject } from './scene/object.js';
import { RenderGeometry } from './geometry/geometry.js';
import { RenderSkin } from './geometry/skin.js';
import { AnimationTarget } from './animation/animation.js';
import { InitPoint1X } from './Point1PX/index.js';


export interface Renderables {
  meshes: any[];
  ambientLight: any,
  directionalLight?: any;
  pointLights: any[];
}

export interface SceneMesh {
  transform: Mat4;
  geometry: RenderGeometry,
  skin?: { skin: RenderSkin, animationTarget: AnimationTarget },
}

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
const IDENTITY_MATRIX = mat4.identity();
const params = {
  isDisplayEnv: false,
  isDisplayGround: false,
};
function createGUIGlobal() {
  const gui = new GUI();
  gui.width = 300;

  gui.add(params, 'isDisplayEnv').name('Display Environment').onChange(value => {
    params.isDisplayEnv = value;

  });
  gui.add(params, 'isDisplayGround').name('Display Ground').onChange(value => {
    params.isDisplayGround = value;

  });
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

  //FORMAT
  const presentationFormat = navigator.gpu.getPreferredCanvasFormat()
  const presentationUBOFormat = 'rgba16float'
  const presentationFormatDepth = 'depth24plus'
  //CONFIG CONTEXT
  configureContext({
    device: device, context: context, presentationFormat: presentationFormat, toneMapping: SIM_UBO_PARAMS.toneMappingMode
  });

  // const CONFIG_RENDER = {
  //   canvas:{
  //     width:canvas.width,
  //     height:canvas.height,
  //     aspect:canvas.width / canvas.height
  //   },
  //   webgpu:{
  //     device:device,
  //     format:{
  //       presentationFormat:presentationFormat,
  //       presentationUBOFormat:presentationUBOFormat
  //     }
  //   },
  //   gui:{
  //     global:{
  //       el:EL_INFO_FPS
  //     }
  //   }

  // }
  createGUIGlobal()

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



  const mat4Size = 64; // 4 * 4 * 4 , model,view,proj
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
  const sampler = device.createSampler({
    magFilter: 'nearest',
    minFilter: 'nearest',
  });

  const fullSceneQuad = new InitFullSceneQuad({
    device: device,
    presentationFormat: presentationFormat,
    viewport: {
      width: canvas.width,
      height: canvas.height
    }
  })
  const COMMON_PIPLINE_STATE_DESC = {
    depthStencil: {
      depthWriteEnabled: true,
      depthCompare: "less",
      format: "depth24plus",
    },
    multisample: {
      count: 1, // <- quan trọng nếu bạn dùng MSAA
    },
  }
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
    presentationFormat: presentationFormat,
    COMMON_PIPLINE_STATE_DESC: COMMON_PIPLINE_STATE_DESC

  })
  const pointX = new InitPoint1X({
    device: device,
    presentationFormat: presentationFormat,
    POINT_BUFFER: POINT_BUFFER,
    CONFIG_POINT_UBO: CONFIG_POINT_UBO,
    // presentationFormat: presentationFormat,
    COMMON_PIPLINE_STATE_DESC: COMMON_PIPLINE_STATE_DESC

  })

  const ground = new InitGround({
    device: device,
    presentationFormat: presentationFormat,
    cameraBuffer: BUFFER_CAMERA_UNIFORM,
    COMMON_PIPLINE_STATE_DESC: COMMON_PIPLINE_STATE_DESC
  });

  const enviromentCube = new InitCubeMap({
    device: device,
    presentationFormat: presentationFormat,
    cameraBuffer: BUFFER_CAMERA_UNIFORM,
    cubemapTexture: cubemapTexture
  });

  // DESC TEXTURE AND RENDERPASS

  const depthTexture = device.createTexture({
    size: [canvas.width, canvas.height],
    format: presentationFormatDepth,
    usage: GPUTextureUsage.RENDER_ATTACHMENT,
  });
  const depthTextureMSAA = device.createTexture({
    size: [canvas.width, canvas.height],
    format: presentationFormatDepth,
    sampleCount: COMMON_PIPLINE_STATE_DESC.multisample.count,
    usage: GPUTextureUsage.RENDER_ATTACHMENT,
  });

  const sceneMSAATexture = device.createTexture({
    size: [canvas.width, canvas.height],
    sampleCount: COMMON_PIPLINE_STATE_DESC.multisample.count,
    format: presentationFormat, // hoặc format của sceneMainTexture
    usage: GPUTextureUsage.RENDER_ATTACHMENT,
  });
  const sceneMainTexture = device.createTexture({
    size: [canvas.width, canvas.height],
    format: presentationFormat,
    usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
  });
  const sceneRenderPassDesc: GPURenderPassDescriptor = {
    colorAttachments: [{
      //CASE MSAA
      // view: sceneMSAATexture.createView(),
      // resolveTarget: sceneMainTexture.createView(),
      // CASE ORIGIN
      view: sceneMainTexture.createView(),
      loadOp: 'clear',
      storeOp: 'store',
      clearValue: { r: 0, g: 0, b: 0, a: 1 },
    }],
    depthStencilAttachment: {
      //CASE MSAA
      //view: depthTextureMSAA.createView(),
      // CASE ORIGIN
      view: depthTexture.createView(),
      depthClearValue: 1.0,
      depthLoadOp: 'clear',
      depthStoreOp: 'store',

    }
  };


  const PostProcessingPassDesc: GPURenderPassDescriptor = {
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



  //LOAD MODEL
  const urlModel = '/src/assets/model/dragon_2.glb'
  // const loaderTHREE = new GLTFLoader();
  // let animationsClip = null
  // let skinMesh = null
  // loaderTHREE.load(urlModel, (gltf) => {
  //   animationsClip = gltf.animations;
  //   console.log(animationsClip)
  // });
  // const sceneFormat = await fetch(urlModel).then((res) => res.arrayBuffer())
  //   .then((buffer) => convertGLBToJSONAndBinary(buffer, device));

  // if (animationsClip && sceneFormat) {
  //   skinMesh = new InitModelSkin({
  //     animationClip: animationsClip,
  //     device: device,
  //     presentationFormat: presentationFormat,
  //     scene: sceneFormat,
  //     cameraBGCluster: cameraBGCluster,
  //     depthTexture: depthTexture
  //   })

  // }

  //LOAD MODE V2
  let skinMesh2
  let sceneRoot = new SceneObject();
  const renderParam = {
    device: device
  }
  let selectedAnimation
  let scene
  const gltfLoader = new GltfLoader(renderParam)
  function loadModel(path) {
    gltfLoader.loadFromUrl(path).then((result) => {

      scene = result.scene;
      sceneRoot.addChild(scene);
      if (result.animations.length) {
        selectedAnimation = result.animations[0];

        const options = [{ text: 'none', value: null }];
        for (const animation of result.animations) {
          if (animation.name.includes('IDLE')) {
            selectedAnimation = animation;
          }
          options.push({ text: animation.name, value: animation });
        }
      } else {
        selectedAnimation = null;
      }
      skinMesh2 = new InitModelSkin2({
        device: device,
        presentationFormat: presentationFormat,
        cameraBGCluster: cameraBGCluster,
        skinBindGroup: result.skinBindGroup,
        gltf: result.core,
        scene: result.scene,
        COMMON_PIPLINE_STATE_DESC: COMMON_PIPLINE_STATE_DESC,
        skinBindGroupLayout: result.skinBindGroupLayout
      })
    });
  }
  loadModel(urlModel);


  function updateUniformGlobal() {
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

    updateUniformGlobal()
    // if (skinMesh) skinMesh.updateSkinMesh(then)


    const swapChainTexture = context.getCurrentTexture();
    // prettier-ignore
    PostProcessingPassDesc.colorAttachments[0].view = swapChainTexture.createView();

    const commandEncoder = device.createCommandEncoder();
    {
      const computePass = commandEncoder.beginComputePass();
      simUBO.draw(computePass)
    }
    {
      const scenePass = commandEncoder.beginRenderPass(sceneRenderPassDesc);

      // if (params.isDisplayEnv) {
      //   enviromentCube.draw({
      //     renderPass: scenePass,
      //     uniform: [
      //       cameraBGCluster.bindGroups[0]
      //     ]
      //   });
      // }

      // if (skinMesh) {
      //   skinMesh.draw({
      //     renderPass: scenePass,
      //     cameraBGCluster: cameraBGCluster
      //   });
      // }

      if (params.isDisplayGround) {
        ground.draw({
          renderPass: scenePass,
          uniform: [
            cameraBGCluster.bindGroups[0]
          ]
        });
      }
      point.draw({
        renderPass: scenePass,
        uniform: [
          cameraBGCluster.bindGroups[0]
        ]
      });


      // if(pointX) {
      //    pointX.draw({
      //     renderPass: scenePass,
      //      uniform: [
      //       cameraBGCluster.bindGroups[0]
      //     ]
      //   });
      // }

     

      if (skinMesh2) {
         const renderables = {
          meshes: [],
        };
        sceneRoot.getRenderables(renderables);
        const skinnedMeshes: SceneMesh[] = [];

        for (const mesh of renderables.meshes) {
          // TODO: A single skin COULD be used for multiple meshes, which would make this redundant.
          if (mesh.skin) {

            skinnedMeshes.push(mesh);
            mesh.skin.skin.updateJoints(device, mesh.skin.animationTarget);
          }
        }
        if (skinnedMeshes) {
          for (const mesh of skinnedMeshes) {
            mesh.transform = IDENTITY_MATRIX;
            mesh.geometry = skinMesh2.skinGeometry(scenePass, mesh.geometry, mesh.skin.skin);
            mesh.skin = null;
          }

        }
        skinMesh2.draw({
          renderPass: scenePass,
          uniform: [
            cameraBGCluster.bindGroups[0]
          ]
        })
      }

      scenePass.end();

      const PostProcessingPass = commandEncoder.beginRenderPass(PostProcessingPassDesc);
      fullSceneQuad.updateBindGroup({
        textureView: sceneMainTexture.createView(),
        sampler,
      });
      fullSceneQuad.draw({ renderPass: PostProcessingPass })
      PostProcessingPass.end();
    }

    device.queue.submit([commandEncoder.finish()]);
  }

  // Frame loop
  let frameCount = 0;
  let lastFrameTime = performance.now();
  function frame(now) {
    const frameStart = performance.now();
    frameCount++;


    if (selectedAnimation) {
      selectedAnimation.applyAtTime(now, scene.animationTarget);
    }



    now *= 0.001;
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
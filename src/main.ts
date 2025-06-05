import { Mat4, mat4, quat, vec3 } from 'wgpu-matrix';
import { GUI } from 'dat.gui';
import DATA_DETAIL_VAT from '../img/fast_run.json'
import { InitGround } from './Ground';
import { createBindGroupCluster } from './bitonicSort/utils'
import { InitCubeMap } from './CubeMap';
import { OrbitCamera } from './camera/OrbitCamera';
import { InitModelSkin2 } from './ModelSkin2/index.js';
import { SceneObject } from './scene/object.js';
import { RenderGeometry } from './geometry/geometry.js';
import { RenderSkin } from './geometry/skin.js';
import { AnimationTarget } from './animation/animation.js';
import { createRenderTargets } from './DESC/RenderTarget.js';
import { loadAssets } from './utils_loader.js';
import { initCoreEngine } from './CORE/index.js';
import { CameraInitializer } from './camera/initCamera.js';
import { COMMON_DEPTH_MSAA_DESC } from './contrast.js';
import { createEnvironmentSampler, createLightBuffer } from './utils.js';
import { ManagerBuffer } from './manager_buffer.js';
import { InitInstancedMesh } from './InstancedMesh/index.js';
import { Sample } from './SAMPLE/index.js';


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
  isDisplayGround: true,
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
const ASSETS_DESC = {
  TEXTURE: [
    {
      type: "cubemap_texture",
      url: [
        '/src/assets/img/cubemap/posx.jpg',
        '/src/assets/img/cubemap/negx.jpg',
        '/src/assets/img/cubemap/posy.jpg',
        '/src/assets/img/cubemap/negy.jpg',
        '/src/assets/img/cubemap/posz.jpg',
        '/src/assets/img/cubemap/negz.jpg',
      ]
    }
  ],
  MODEL: [
    {
      name: 'dragon_model',
      type: 'gltf',
      url: '/src/assets/model/dragon_2.glb'
    },
    {
      name: 'leaf_model',
      type: 'gltf',
      url: '/src/assets/model/leaf.gltf'
    }
  ]
}
async function startApp() {
  const monitor = document.getElementById("info") as HTMLElement
  const canvas = document.querySelector('canvas') as HTMLCanvasElement;
  const result_initCoreEngine = await initCoreEngine({
    canvas: canvas
  })
  const result_loadAssets = await loadAssets({
    device: result_initCoreEngine.device,
    ASSETS_DESC: ASSETS_DESC
  })
  await main({
    CORE_ASSETS: {
      ...result_loadAssets
    },
    CORE_ENGINE: {
      ...result_initCoreEngine,
    },
    MONITOR: {
      el: monitor,
    }
  });
}


async function main({
  CORE_ASSETS,
  CORE_ENGINE,
  MONITOR
}) {
  console.log(CORE_ASSETS)
  createGUIGlobal()

  let coutnFrame = 0
  let then = 0;
  let lastInfoUpdate = 0;

  //CAMERA
  const cameraInit = new CameraInitializer({
    CORE_ENGINE: CORE_ENGINE,
    type: "OrbitCamera"
  });
  const cameraBGCluster = cameraInit.cameraBGCluster
  const cameraBuffer = cameraInit.bufferCamera

  const lightBuffer = createLightBuffer({ device: CORE_ENGINE.device })
  const environmentSampler = createEnvironmentSampler({ device: CORE_ENGINE.device })
  
  const frameBindGroupLayout = CORE_ENGINE.device.createBindGroupLayout({
    label: 'frame bind group layout',
    entries: [{
      binding: 0,
      visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
      buffer: {} // Camera uniforms
    }, {
      binding: 1,
      visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
      buffer: { type: 'read-only-storage' } // Light uniforms
    }, {
      binding: 2,
      visibility: GPUShaderStage.FRAGMENT,
      sampler: {} // Environment sampler
    }, {
      binding: 3,
      visibility: GPUShaderStage.FRAGMENT,
      texture: { viewDimension: 'cube' } // Environment map
    }]
  });

  const frameBindGroup = CORE_ENGINE.device.createBindGroup({
    label: 'frame bind group',
    layout: frameBindGroupLayout,
    entries: [
      {
        binding: 0,
        resource: { buffer: cameraBuffer }
      },
      {
        binding: 1,
        resource: { buffer: lightBuffer }
      }, {
        binding: 2,
        resource: environmentSampler,
      }, {
        binding: 3,
        resource: CORE_ASSETS.textures.cubemap_texture.createView({
          dimension: 'cube'
        })
      }
    ]
  });


  const POINT_BUFFER = CORE_ENGINE.device.createBuffer({
    size: CONFIG_POINT_UBO.numParticles * CONFIG_POINT_UBO.particleInstanceByteSize,
    usage: GPUBufferUsage.VERTEX | GPUBufferUsage.STORAGE,
  });




  let result2 = CORE_ASSETS.models.leaf_model
  
  const instanced = new InitInstancedMesh({
      device: CORE_ENGINE.device,
      presentationFormat: CORE_ENGINE.format.presentationFormat,
     frameBindGroupLayout: frameBindGroupLayout,
       gltf: result2.scene,
  })
  const ground = new InitGround({
    device: CORE_ENGINE.device,
    presentationFormat: CORE_ENGINE.format.presentationFormat,
    frameBindGroupLayout: frameBindGroupLayout
  });

  const enviromentCube = new InitCubeMap({
    device: CORE_ENGINE.device,
    presentationFormat: CORE_ENGINE.format.presentationFormat,
    cubemapTexture: CORE_ASSETS.textures["cubemap_texture"],
    frameBindGroupLayout: frameBindGroupLayout
  });

  const mutilDrawSample =  new Sample({
        device: CORE_ENGINE.device,
    presentationFormat: CORE_ENGINE.format.presentationFormat,
    frameBindGroupLayout:frameBindGroupLayout
  })
  const LIST_PIPLINE = [ground/* , enviromentCube */,instanced,mutilDrawSample]
  const {
    depthTexture,
    depthTextureMSAA,
    sceneMSAATexture,
    sceneMainTexture,
    sceneRenderPassDesc
  } = createRenderTargets(CORE_ENGINE.device, CORE_ENGINE.canvas.el, CORE_ENGINE.format.presentationFormat, CORE_ENGINE.format.presentationFormatDepth, COMMON_DEPTH_MSAA_DESC);

  // sceneRenderPassDesc.colorAttachments[0].view = sceneMSAATexture.createView();
  // sceneRenderPassDesc.colorAttachments[0].resolveTarget = sceneMainTexture.createView();
  // sceneRenderPassDesc.depthStencilAttachment.view = depthTextureMSAA.createView();



  //LOAD MODE V2
  let skinMesh2
  let sceneRoot = new SceneObject();
  let selectedAnimation
  let scene
  function loadModel() {
    let result = CORE_ASSETS.models.dragon_model
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
      device: CORE_ENGINE.device,
      presentationFormat: CORE_ENGINE.format.presentationFormat,
      cameraBGCluster: cameraBGCluster,
      skinBindGroup: result.skinBindGroup,
      gltf: result.core,
      scene: result.scene,
      COMMON_DEPTH_MSAA_DESC: COMMON_DEPTH_MSAA_DESC,
      skinBindGroupLayout: result.skinBindGroupLayout
    })
  }
  loadModel();


  function render() {
    coutnFrame += SIM_UBO_PARAMS.deltaTime * 40
    if (coutnFrame > CONFIG_VAT.height) {
      coutnFrame = 0
    }
    cameraInit.update()

    const swapChainTexture = CORE_ENGINE.context.getCurrentTexture();
    sceneRenderPassDesc.colorAttachments[0].view = swapChainTexture.createView();
    const commandEncoder = CORE_ENGINE.device.createCommandEncoder();
    {
      const timeValue = new Float32Array([then]);
      const scenePass = commandEncoder.beginRenderPass(sceneRenderPassDesc);

  
      for (let i = 0; i < LIST_PIPLINE.length; i++) {
        LIST_PIPLINE[i].draw({
          renderPass: scenePass,
          frameBindGroup: frameBindGroup,
          timeValue:timeValue
        })
      }
   
      // if (skinMesh2) {
      //   const renderables = {
      //     meshes: [],
      //   };
      //   sceneRoot.getRenderables(renderables);
      //   const skinnedMeshes: SceneMesh[] = [];

      //   for (const mesh of renderables.meshes) {
      //     // TODO: A single skin COULD be used for multiple meshes, which would make this redundant.
      //     if (mesh.skin) {

      //       skinnedMeshes.push(mesh);
      //       mesh.skin.skin.updateJoints(CORE_ENGINE.device, mesh.skin.animationTarget);
      //     }
      //   }
      //   if (skinnedMeshes) {
      //     for (const mesh of skinnedMeshes) {
      //       mesh.transform = IDENTITY_MATRIX;
      //       mesh.geometry = skinMesh2.skinGeometry(scenePass, mesh.geometry, mesh.skin.skin);
      //       mesh.skin = null;
      //     }

      //   }
      //   skinMesh2.draw({
      //     renderPass: scenePass,
      //     uniform: [
      //       cameraBGCluster.bindGroups[0]
      //     ]
      //   })

      // }


      scenePass.end();

    }

    CORE_ENGINE.device.queue.submit([commandEncoder.finish()]);
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
      MONITOR.el.textContent = `\
        fps: ${(1 / deltaTime).toFixed(1)}
        js: ${jsTime.toFixed(1)}ms
      `;
      lastInfoUpdate = now;
    }

    requestAnimationFrame(frame);
  }

  requestAnimationFrame(frame);

}

startApp();

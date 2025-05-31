import { Mat4, mat4, quat, vec3 } from 'wgpu-matrix';
import { GUI } from 'dat.gui';
import gltfWGSL from './shaders/common/gltf.wgsl';
import gridWGSL from './shaders/common/grid.wgsl';
import particleWGSL from './shaders/particle.wgsl';
import probabilityMapWGSL from './shaders/probabilityMap.wgsl';
import { configureContext, quitIfWebGPUNotAvailable } from './util';
import { createInputHandler } from './intractive';
import { initCamera } from './camera/index';
import { createTextureFromPNGWithoutMipmaps, cropBinToWebGPUTexture } from './loadTexture';
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

const MAT4X4_BYTES = 64;

interface BoneObject {
  transforms: Mat4[];
  bindPoses: Mat4[];
  bindPosesInv: Mat4[];
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
  numParticles: 350000,
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
  const BUFFER_CAMERA_UNIFORM_SIZE =
    4 * 4 * 4 + // modelViewProjectionMatrix : mat4x4f
    3 * 4 + // right : vec3f
    4 + // padding
    3 * 4 + // up : vec3f
    4 + // padding
    0;
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
    cameraBuffer: BUFFER_CAMERA_UNIFORM
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




  // Pass Descriptor for GLTFs
  const gltfRenderPassDescriptor: GPURenderPassDescriptor = {
    colorAttachments: [
      {
        view: undefined, // Assigned later

        clearValue: [0.3, 0.3, 0.3, 1.0],
        loadOp: 'clear',
        storeOp: 'store',
      },
    ],
    depthStencilAttachment: {
      view: depthTexture.createView(),
      depthLoadOp: 'clear',
      depthClearValue: 1.0,
      depthStoreOp: 'store',
    },
  };

  // Pass descriptor for grid with no depth testing
  const skinnedGridRenderPassDescriptor: GPURenderPassDescriptor = {
    colorAttachments: [
      {
        view: undefined, // Assigned later

        clearValue: [0.3, 0.3, 0.3, 1.0],
        loadOp: 'clear',
        storeOp: 'store',
      },
    ],
  };

  const animSkinnedGrid = (boneTransforms: Mat4[], angle: number) => {
    const m = mat4.identity();
    mat4.rotateZ(m, angle, boneTransforms[0]);
    mat4.translate(boneTransforms[0], vec3.create(4, 0, 0), m);
    mat4.rotateZ(m, angle, boneTransforms[1]);
    mat4.translate(boneTransforms[1], vec3.create(4, 0, 0), m);
    mat4.rotateZ(m, angle, boneTransforms[2]);
  };

  // Create a group of bones
  // Each index associates an actual bone to its transforms, bindPoses, uniforms, etc
  const createBoneCollection = (numBones: number): BoneObject => {
    // Initial bone transformation
    const transforms: Mat4[] = [];
    // Bone bind poses, an extra matrix per joint/bone that represents the starting point
    // of the bone before any transformations are applied
    const bindPoses: Mat4[] = [];
    // Create a transform, bind pose, and inverse bind pose for each bone
    for (let i = 0; i < numBones; i++) {
      transforms.push(mat4.identity());
      bindPoses.push(mat4.identity());
    }

    // Get initial bind pose positions
    animSkinnedGrid(bindPoses, 0);
    const bindPosesInv = bindPoses.map((bindPose) => {
      return mat4.inverse(bindPose);
    });

    return {
      transforms,
      bindPoses,
      bindPosesInv,
    };
  };


  // Create skinned grid resources
  const skinnedGridVertexBuffers = createSkinnedGridBuffers(device);
  // Buffer for our uniforms, joints, and inverse bind matrices
  const skinnedGridUniformBufferUsage: GPUBufferDescriptor = {
    // 5 4x4 matrices, one for each bone
    size: MAT4X4_BYTES * 5,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
  };
  const skinnedGridJointUniformBuffer = device.createBuffer(
    skinnedGridUniformBufferUsage
  );
  const skinnedGridInverseBindUniformBuffer = device.createBuffer(
    skinnedGridUniformBufferUsage
  );
  const skinnedGridBoneBGCluster = createBindGroupCluster(
    [0, 1],
    [GPUShaderStage.VERTEX, GPUShaderStage.VERTEX],
    ['buffer', 'buffer'],
    [{ type: 'read-only-storage' }, { type: 'read-only-storage' }],
    [
      [
        { buffer: skinnedGridJointUniformBuffer },
        { buffer: skinnedGridInverseBindUniformBuffer },
      ],
    ],
    'SkinnedGridJointUniforms',
    device
  );
  const skinnedGridPipeline = createSkinnedGridRenderPipeline(
    device,
    presentationFormat,
    gridWGSL,
    gridWGSL,
    [
      cameraBGCluster.bindGroupLayout,
      generalUniformsBGCLuster.bindGroupLayout,
      skinnedGridBoneBGCluster.bindGroupLayout,
    ]
  );
  const gridBoneCollection = createBoneCollection(5);
  for (let i = 0; i < gridBoneCollection.bindPosesInv.length; i++) {
    device.queue.writeBuffer(
      skinnedGridInverseBindUniformBuffer,
      i * 64,
      gridBoneCollection.bindPosesInv[i]
    );
  }

  const origMatrices = new Map<number, Mat4>();
  const animWhaleSkin = (skin: GLTFSkin, angle: number) => {
    for (let i = 0; i < skin.joints.length; i++) {
      // Index into the current joint
      const joint = skin.joints[i];
      // If our map does
      if (!origMatrices.has(joint)) {
        origMatrices.set(joint, whaleScene.nodes[joint].source.getMatrix());
      }
      // Get the original position, rotation, and scale of the current joint
      const origMatrix = origMatrices.get(joint);
      let m = mat4.create();
      // Depending on which bone we are accessing, apply a specific rotation to the bone's original
      // transformation to animate it
      if (joint === 1 || joint === 0) {
        m = mat4.rotateY(origMatrix, -angle);
      } else if (joint === 3 || joint === 4) {
        m = mat4.rotateX(origMatrix, joint === 3 ? angle : -angle);
      } else {
        m = mat4.rotateZ(origMatrix, angle);
      }
      // Apply the current transformation to the transform values within the relevant nodes
      // (these nodes, of course, each being nodes that represent joints/bones)
      whaleScene.nodes[joint].source.position = mat4.getTranslation(m);
      whaleScene.nodes[joint].source.scale = mat4.getScaling(m);
      whaleScene.nodes[joint].source.rotation = quat.fromMat(m);
    }
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


    const sharedUniformCamera = new Float32Array([
      ...modelViewProjectionMatrix,
      // right
      viewMatrix[0], viewMatrix[4], viewMatrix[8],
      0,

      // up
      viewMatrix[1], viewMatrix[5], viewMatrix[9],
      0,
    ]);

    device.queue.writeBuffer(BUFFER_CAMERA_UNIFORM, 0, sharedUniformCamera);

  }

  function render() {
    coutnFrame += SIM_UBO_PARAMS.deltaTime * 40
    if (coutnFrame > CONFIG_VAT.height) {
      coutnFrame = 0
    }
    updateUniformGlobal()



    // const angle = Math.sin(coutnFrame)
    // animSkinnedGrid(gridBoneCollection.transforms, angle);

    // // Write to skinned grid bone uniform buffer
    // for (let i = 0; i < gridBoneCollection.transforms.length; i++) {
    //   device.queue.writeBuffer(
    //     skinnedGridJointUniformBuffer,
    //     i * 64,
    //     gridBoneCollection.transforms[i]
    //   );
    // }

    // // Difference between these two render passes is just the presence of depthTexture
    // gltfRenderPassDescriptor.colorAttachments[0].view = context
    //   .getCurrentTexture()
    //   .createView();

    // skinnedGridRenderPassDescriptor.colorAttachments[0].view = context
    //   .getCurrentTexture()
    //   .createView();

    // // Update node matrixes
    // for (const scene of whaleScene.scenes) {
    //   scene.root.updateWorldMatrix(device);
    // }

    // // Updates skins (we index into skins in the renderer, which is not the best approach but hey)
    // animWhaleSkin(whaleScene.skins[0], angle);
    // // Node 6 should be the only node with a drawable mesh so hopefully this works fine
    // whaleScene.skins[0].update(device, 6, whaleScene.nodes);



    const swapChainTexture = context.getCurrentTexture();
    // prettier-ignore
    renderPassDescriptor.colorAttachments[0].view = swapChainTexture.createView();

    const commandEncoder = device.createCommandEncoder();
    {
      const computePass = commandEncoder.beginComputePass();
      simUBO.draw(computePass)
    }
    // {
    //   const passEncoder = commandEncoder.beginRenderPass(
    //     gltfRenderPassDescriptor
    //   );
    //   for (const scene of whaleScene.scenes) {
    //     scene.root.renderDrawables(passEncoder, [
    //       cameraBGCluster.bindGroups[0],
    //       generalUniformsBGCLuster.bindGroups[0],
    //     ]);
    //   }
    //   passEncoder.end();
    // }
    {
      const renderPass = commandEncoder.beginRenderPass(renderPassDescriptor);

      ground.draw({
        renderPass: renderPass,
        uniform: [
          cameraBGCluster.bindGroups[0]
        ]
      });
      point.draw({
        renderPass: renderPass,
        uniform: [
          cameraBGCluster.bindGroups[0]
        ]
      });
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
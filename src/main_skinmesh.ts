import { Mat4, mat4, quat, vec3 } from 'wgpu-matrix';
import { GUI } from 'dat.gui';
import gltfWGSL from './shaders/common/gltf.wgsl';
import gridWGSL from './shaders/common/grid.wgsl';
import { configureContext, quitIfWebGPUNotAvailable } from './util';
import {
  createSkinnedGridBuffers,
  createSkinnedGridRenderPipeline,
} from './utils/gridUtils'
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

//Normal setup
const canvas = document.querySelector('canvas') as HTMLCanvasElement;
const adapter = await navigator.gpu?.requestAdapter({
  featureLevel: 'compatibility',
});
const limits: Record<string, GPUSize32> = {};
//quitIfLimitLessThan(adapter, 'maxStorageBuffersInVertexStage', 2, limits);
const device = await adapter?.requestDevice({
  requiredLimits: limits,
});
quitIfWebGPUNotAvailable(adapter, device);

const context = canvas.getContext('webgpu') as GPUCanvasContext;

const devicePixelRatio = window.devicePixelRatio || 1;
canvas.width = canvas.clientWidth * devicePixelRatio;
canvas.height = canvas.clientHeight * devicePixelRatio;
const presentationFormat = navigator.gpu.getPreferredCanvasFormat();

context.configure({
  device,
  format: presentationFormat,
});

const settings = {
  cameraX: 0,
  cameraY: -5.1,
  cameraZ: -14.6,
  objectScale: 1,
  angle: 0.2,
  speed: 50,
  object: 'Whale',
  renderMode: 'NORMAL',
  skinMode: 'ON',
};

const gui = new GUI();

// Determine whether we want to render our whale or our skinned grid
gui.add(settings, 'object', ['Whale', 'Skinned Grid']).onChange(() => {
  if (settings.object === 'Skinned Grid') {
    settings.cameraX = -10;
    settings.cameraY = 0;
    settings.objectScale = 1.27;
  } else {
    if (settings.skinMode === 'OFF') {
      settings.cameraX = 0;
      settings.cameraY = 0;
      settings.cameraZ = -11;
    } else {
      settings.cameraX = 0;
      settings.cameraY = -5.1;
      settings.cameraZ = -14.6;
    }
  }
});

// Output the mesh normals, its joints, or the weights that influence the movement of the joints
gui
  .add(settings, 'renderMode', ['NORMAL', 'JOINTS', 'WEIGHTS'])
  .onChange(() => {
    device.queue.writeBuffer(
      generalUniformsBuffer,
      0,
      new Uint32Array([RenderMode[settings.renderMode]])
    );
  });
// Determine whether the mesh is static or whether skinning is activated
gui.add(settings, 'skinMode', ['ON', 'OFF']).onChange(() => {
  if (settings.object === 'Whale') {
    if (settings.skinMode === 'OFF') {
      settings.cameraX = 0;
      settings.cameraY = 0;
      settings.cameraZ = -22;
    } else {
      settings.cameraX = 0;
      settings.cameraY = -5.1;
      settings.cameraZ = -22.6;
    }
  }
  device.queue.writeBuffer(
    generalUniformsBuffer,
    4,
    new Uint32Array([SkinMode[settings.skinMode]])
  );
});
const animFolder = gui.addFolder('Animation Settings');
animFolder.add(settings, 'angle', 0.05, 0.5).step(0.05);
animFolder.add(settings, 'speed', 10, 100).step(10);

const depthTexture = device.createTexture({
  size: [canvas.width, canvas.height],
  format: 'depth24plus',
  usage: GPUTextureUsage.RENDER_ATTACHMENT,
});

const cameraBuffer = device.createBuffer({
  size: MAT4X4_BYTES * 3,
  usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
});

const cameraBGCluster = createBindGroupCluster(
  [0],
  [GPUShaderStage.VERTEX],
  ['buffer'],
  [{ type: 'uniform' }],
  [[{ buffer: cameraBuffer }]],
  'Camera',
  device
);

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

// Fetch whale resources from the glb file
const whaleScene = await fetch('/src/assets/model/dragon.glb')
  .then((res) => res.arrayBuffer())
  .then((buffer) => convertGLBToJSONAndBinary(buffer, device));

// Builds a render pipeline for our whale mesh
// Since we are building a lightweight gltf parser around a gltf scene with a known
// quantity of meshes, we only build a renderPipeline for the singular mesh present
// within our scene. A more robust gltf parser would loop through all the meshes,
// cache replicated pipelines, and perform other optimizations.
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

// Create skinned grid resources

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

// Global Calc
const aspect = canvas.width / canvas.height;
const perspectiveProjection = mat4.perspective(
  (2 * Math.PI) / 5,
  aspect,
  0.1,
  100.0
);

const orthographicProjection = mat4.ortho(-20, 20, -10, 10, -100, 100);

function getProjectionMatrix() {
  if (settings.object !== 'Skinned Grid') {
    return perspectiveProjection;
  }
  return orthographicProjection;
}

function getViewMatrix() {
  const viewMatrix = mat4.identity();
  if (settings.object === 'Skinned Grid') {
    mat4.translate(
      viewMatrix,
      vec3.fromValues(
        settings.cameraX * settings.objectScale,
        settings.cameraY * settings.objectScale,
        settings.cameraZ
      ),
      viewMatrix
    );
  } else {
    mat4.translate(
      viewMatrix,
      vec3.fromValues(settings.cameraX, settings.cameraY, settings.cameraZ),
      viewMatrix
    );
  }
  return viewMatrix;
}

function getModelMatrix() {
  const modelMatrix = mat4.identity();
  const scaleVector = vec3.fromValues(
    settings.objectScale,
    settings.objectScale,
    settings.objectScale
  );
  mat4.scale(modelMatrix, scaleVector, modelMatrix);
  if (settings.object === 'Whale') {
    mat4.rotateY(modelMatrix, (Date.now() / 1000) * 0.5, modelMatrix);
  }
  return modelMatrix;
}

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

// Create bones of the skinned grid and write the inverse bind positions to
// the skinned grid's inverse bind matrix array
const gridBoneCollection = createBoneCollection(5);
for (let i = 0; i < gridBoneCollection.bindPosesInv.length; i++) {
  device.queue.writeBuffer(
    skinnedGridInverseBindUniformBuffer,
    i * 64,
    gridBoneCollection.bindPosesInv[i]
  );
}

// A map that maps a joint index to the original matrix transformation of a bone
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

function frame() {
  // Calculate camera matrices
  const projectionMatrix = getProjectionMatrix();
  const viewMatrix = getViewMatrix();
  const modelMatrix = getModelMatrix();

  // Calculate bone transformation
  const t = (Date.now() / 20000) * settings.speed;
  const angle = Math.sin(t) * settings.angle;
  // Compute Transforms when angle is applied
  animSkinnedGrid(gridBoneCollection.transforms, angle);

  // Write to mvp to camera buffer
  device.queue.writeBuffer(
    cameraBuffer,
    0,
    projectionMatrix.buffer,
    projectionMatrix.byteOffset,
    projectionMatrix.byteLength
  );

  device.queue.writeBuffer(
    cameraBuffer,
    64,
    viewMatrix.buffer,
    viewMatrix.byteOffset,
    viewMatrix.byteLength
  );

  device.queue.writeBuffer(
    cameraBuffer,
    128,
    modelMatrix.buffer,
    modelMatrix.byteOffset,
    modelMatrix.byteLength
  );

  // Write to skinned grid bone uniform buffer
  for (let i = 0; i < gridBoneCollection.transforms.length; i++) {
    device.queue.writeBuffer(
      skinnedGridJointUniformBuffer,
      i * 64,
      gridBoneCollection.transforms[i]
    );
  }

  // Difference between these two render passes is just the presence of depthTexture
  gltfRenderPassDescriptor.colorAttachments[0].view = context
    .getCurrentTexture()
    .createView();

  // Update node matrixes
  for (const scene of whaleScene.scenes) {
    scene.root.updateWorldMatrix(device);
  }

  // Updates skins (we index into skins in the renderer, which is not the best approach but hey)
  animWhaleSkin(whaleScene.skins[0], Math.sin(t) * settings.angle);
  // Node 6 should be the only node with a drawable mesh so hopefully this works fine
  whaleScene.skins[0].update(device, 6, whaleScene.nodes);

  const commandEncoder = device.createCommandEncoder();
  if (settings.object === 'Whale') {
    const passEncoder = commandEncoder.beginRenderPass(
      gltfRenderPassDescriptor
    );
    for (const scene of whaleScene.scenes) {
      scene.root.renderDrawables(passEncoder, [
        cameraBGCluster.bindGroups[0],
        generalUniformsBGCLuster.bindGroups[0],
      ]);
    }
    passEncoder.end();
  }

  device.queue.submit([commandEncoder.finish()]);

  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

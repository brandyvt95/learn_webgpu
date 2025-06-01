import groundWGSL from '../shaders/ground.wgsl'; // cách import raw text (tuỳ config bundler)
import { createBindGroupCluster } from '../bitonicSort/utils'
import { convertGLBToJSONAndBinary, GLTFSkin } from '../utils/glbUtils';
import { Mat4, mat4, quat, vec3 } from 'wgpu-matrix';
import gltfWGSL from '../shaders/common/gltf.wgsl';
import gridWGSL from '../shaders/common/grid.wgsl';
import { animWhaleSkin } from './utilsBone';


interface ModelSkinOptions {
  device: GPUDevice;
  presentationFormat: GPUTextureFormat;
  cameraBGCluster: any;
  scene: any;
  depthTexture:GPUTexture
  animationClip:any
}
type GLTFPrimitive = {
  attributes: string[];
  attributeMap: Record<string, any>;
};

function removePrimitiveAttributes(
  primitive: GLTFPrimitive,
  toRemove: string[]
) {
  console.log(primitive)
  primitive.attributes = primitive.attributes.filter(attr => !toRemove.includes(attr));
  for (const key of toRemove) {
    delete primitive.attributeMap[key];
  }
}
export class InitModelSkin {
  scene: any
  device: GPUDevice;
  pipeline: GPURenderPipeline;
  generalUniformsBuffer: GPUBuffer
  generalUniformsBGCLuster: any
  nodeUniformsBindGroupLayout: GPUBindGroupLayout
  whaleScene: any
  presentationFormat: string
  depthTexture: GPUTexture
  origMatrices: any
  cameraBGCluster: any
  animationClip:any
  constructor({ device, presentationFormat, cameraBGCluster, scene,depthTexture ,animationClip}: ModelSkinOptions) {
    this.device = device;
    this.whaleScene = scene
    this.origMatrices = new Map<number, Mat4>();
    this.depthTexture = depthTexture
    this.cameraBGCluster = cameraBGCluster
    this.presentationFormat = presentationFormat
    this.animationClip = animationClip
    this.creatUniform()
    this.createPipeline();
    this.createMesh();

  }
  createPipeline() {
    removePrimitiveAttributes(this.whaleScene.meshes[0].primitives[0], ['TEXCOORD_4']);
    console.log( this.whaleScene)
    this.whaleScene.meshes[0].buildRenderPipeline(
      this.device,
      gltfWGSL,
      gltfWGSL,
      this.presentationFormat,
      this.depthTexture.format,
      [
        this.cameraBGCluster.bindGroupLayout,
        this.generalUniformsBGCLuster.bindGroupLayout,
        this.nodeUniformsBindGroupLayout,
        GLTFSkin.skinBindGroupLayout,
      ]
    );
  }
  creatUniform() {
    this.generalUniformsBuffer = this.device.createBuffer({
      size: Uint32Array.BYTES_PER_ELEMENT * 2,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
    this.generalUniformsBGCLuster = createBindGroupCluster(
      [0],
      [GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT],
      ['buffer'],
      [{ type: 'uniform' }],
      [[{ buffer: this.generalUniformsBuffer }]],
      'General',
      this.device
    );
    // Same bindGroupLayout as in main file.
    this.nodeUniformsBindGroupLayout = this.device.createBindGroupLayout({
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
  }
  createMesh() {

  }
  updateSkinMesh(then) {
    const angle = Math.sin(then)

    // Update node matrixes
    for (const scene of this.whaleScene.scenes) {
      scene.root.updateWorldMatrix(this.device);
    }
    // Updates skins (we index into skins in the renderer, which is not the best approach but hey)
    animWhaleSkin(this.whaleScene.skins[0], this.animationClip.find(a => a.name === 'swim'), then, this.whaleScene);
    // Node 6 should be the only node with a drawable mesh so hopefully this works fine
    this.whaleScene.skins[0].update(this.device, 6, this.whaleScene.nodes);
  }
  draw({ renderPass, cameraBGCluster }: { renderPass: GPURenderPassEncoder, cameraBGCluster: any }) {
    for (const scene of this.whaleScene.scenes) {
      scene.root.renderDrawables(renderPass, [
        cameraBGCluster.bindGroups[0],
        this.generalUniformsBGCLuster.bindGroups[0],
      ]);
    }
  }
}
